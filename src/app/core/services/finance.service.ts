import { Injectable, computed, signal } from '@angular/core';
import { Budget, Category, FinanceSnapshot, Transaction, TransactionType } from '../models/finance.models';
import { IndexedDbService } from './indexeddb.service';
import { SupabaseService } from './supabase.service';

const DEFAULT_CATEGORIES: Array<Pick<Category, 'id' | 'name' | 'color'>> = [
  { id: 'cat-food', name: 'Comida', color: '#d97706' },
  { id: 'cat-transport', name: 'Transporte', color: '#2563eb' },
  { id: 'cat-home', name: 'Hogar', color: '#059669' },
  { id: 'cat-health', name: 'Salud', color: '#db2777' },
  { id: 'cat-salary', name: 'Salario', color: '#7c3aed' },
  { id: 'cat-other', name: 'Otros', color: '#475569' }
];

@Injectable({ providedIn: 'root' })
export class FinanceService {
  readonly loading = signal(true);
  readonly syncing = signal(false);
  readonly transactions = signal<Transaction[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly budgets = signal<Budget[]>([]);

  readonly totalIncome = computed(() =>
    this.transactions()
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0)
  );

  readonly totalExpense = computed(() =>
    this.transactions()
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0)
  );

  readonly balance = computed(() => this.totalIncome() - this.totalExpense());

  readonly currentMonth = computed(() => new Date().toISOString().slice(0, 7));

  readonly monthExpensesByCategory = computed(() => {
    const month = this.currentMonth();
    const expenseRows = this.transactions().filter((item) => item.type === 'expense' && item.date.startsWith(month));

    return this.categories()
      .map((category) => {
        const spent = expenseRows
          .filter((item) => item.categoryId === category.id)
          .reduce((sum, item) => sum + item.amount, 0);

        const budget = this.budgets().find((item) => item.categoryId === category.id && item.month === month);

        return {
          category,
          spent,
          budget: budget?.limit ?? 0,
          progress: budget ? Math.min((spent / budget.limit) * 100, 100) : 0
        };
      })
      .filter((item) => item.spent > 0 || item.budget > 0)
      .sort((a, b) => b.spent - a.spent);
  });

  readonly sixMonthTrend = computed(() => {
    const now = new Date();
    const months: string[] = [];

    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(date.toISOString().slice(0, 7));
    }

    return months.map((month) => {
      const income = this.transactions()
        .filter((item) => item.type === 'income' && item.date.startsWith(month))
        .reduce((sum, item) => sum + item.amount, 0);

      const expense = this.transactions()
        .filter((item) => item.type === 'expense' && item.date.startsWith(month))
        .reduce((sum, item) => sum + item.amount, 0);

      return {
        month,
        income,
        expense,
        balance: income - expense
      };
    });
  });

  constructor(
    private readonly db: IndexedDbService,
    private readonly supabaseService: SupabaseService
  ) {}

  async init(): Promise<void> {
    this.loading.set(true);

    if (typeof indexedDB === 'undefined') {
      this.transactions.set([]);
      this.categories.set([]);
      this.budgets.set([]);
      this.loading.set(false);
      return;
    }

    const [transactions, categories, budgets] = await Promise.all([
      this.db.getAll<Transaction>('transactions'),
      this.db.getAll<Category>('categories'),
      this.db.getAll<Budget>('budgets')
    ]);

    const fixedCategories = categories.length > 0 ? categories : await this.seedDefaultCategories();

    this.transactions.set(transactions.sort((a, b) => b.date.localeCompare(a.date)));
    this.categories.set(fixedCategories);
    this.budgets.set(budgets);
    this.loading.set(false);
  }

  async addTransaction(input: {
    type: TransactionType;
    amount: number;
    categoryId: string;
    note?: string;
    date: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const row: Transaction = {
      id: crypto.randomUUID(),
      type: input.type,
      amount: Number(input.amount),
      categoryId: input.categoryId,
      note: input.note?.trim() || undefined,
      date: input.date,
      createdAt: now,
      updatedAt: now
    };

    await this.db.put<Transaction>('transactions', row);
    this.transactions.set([row, ...this.transactions()].sort((a, b) => b.date.localeCompare(a.date)));
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.db.delete('transactions', id);
    this.transactions.set(this.transactions().filter((item) => item.id !== id));
  }

  async addCategory(name: string, color: string): Promise<void> {
    const cleanName = name.trim();
    if (!cleanName) {
      return;
    }

    if (this.categories().some((item) => item.name.toLowerCase() === cleanName.toLowerCase())) {
      return;
    }

    const row: Category = {
      id: crypto.randomUUID(),
      name: cleanName,
      color,
      createdAt: new Date().toISOString()
    };

    await this.db.put<Category>('categories', row);
    this.categories.set([...this.categories(), row]);
  }

  async upsertBudget(categoryId: string, month: string, limit: number): Promise<void> {
    const existing = this.budgets().find((item) => item.categoryId === categoryId && item.month === month);

    const row: Budget = {
      id: existing?.id ?? crypto.randomUUID(),
      categoryId,
      month,
      limit: Number(limit),
      updatedAt: new Date().toISOString()
    };

    await this.db.put<Budget>('budgets', row);
    const next = this.budgets().filter((item) => item.id !== row.id);
    this.budgets.set([...next, row]);
  }

  async exportCsv(): Promise<string> {
    const headers = ['id', 'tipo', 'monto', 'categoria', 'nota', 'fecha'];
    const rows = this.transactions().map((item) => {
      const category = this.categories().find((cat) => cat.id === item.categoryId)?.name ?? item.categoryId;
      return [item.id, item.type, item.amount.toString(), category, item.note ?? '', item.date];
    });

    const lines = [headers, ...rows].map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','));
    return lines.join('\n');
  }

  async syncToSupabase(): Promise<void> {
    if (!this.supabaseService.isConfigured()) {
      return;
    }

    this.syncing.set(true);

    const payload: FinanceSnapshot = {
      transactions: this.transactions(),
      categories: this.categories(),
      budgets: this.budgets()
    };

    try {
      await this.supabaseService.pushSnapshot(payload);
    } finally {
      this.syncing.set(false);
    }
  }

  private async seedDefaultCategories(): Promise<Category[]> {
    const now = new Date().toISOString();
    const rows: Category[] = DEFAULT_CATEGORIES.map((item) => ({
      ...item,
      createdAt: now
    }));

    await Promise.all(rows.map((row) => this.db.put<Category>('categories', row)));
    return rows;
  }
}
