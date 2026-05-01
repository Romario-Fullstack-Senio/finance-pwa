import { Injectable, computed, inject, signal } from '@angular/core';
import { Budget, Category, Transaction, TransactionType } from '../models/finance.models';
import { IndexedDbService, PendingOp } from './indexeddb.service';
import { SupabaseService } from './supabase.service';

const DEFAULT_CATEGORIES: Array<Pick<Category, 'id' | 'name' | 'color'>> = [
  { id: 'cat-food', name: 'Comida', color: '#d97706' },
  { id: 'cat-transport', name: 'Transporte', color: '#2563eb' },
  { id: 'cat-home', name: 'Hogar', color: '#059669' },
  { id: 'cat-health', name: 'Salud', color: '#db2777' },
  { id: 'cat-salary', name: 'Salario', color: '#7c3aed' },
  { id: 'cat-other', name: 'Otros', color: '#475569' },
];

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly indexedDb = inject(IndexedDbService);

  readonly loading = signal(true);
  readonly syncing = signal(false);
  readonly transactions = signal<Transaction[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly budgets = signal<Budget[]>([]);

  readonly totalIncome = computed(() =>
    this.transactions()
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0),
  );

  readonly totalExpense = computed(() =>
    this.transactions()
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0),
  );

  readonly balance = computed(() => this.totalIncome() - this.totalExpense());

  readonly currentMonth = computed(() => new Date().toISOString().slice(0, 7));

  readonly monthExpensesByCategory = computed(() => {
    const month = this.currentMonth();
    const expenseRows = this.transactions().filter(
      (item) => item.type === 'expense' && item.date.startsWith(month),
    );

    return this.categories()
      .map((category) => {
        const spent = expenseRows
          .filter((item) => item.categoryId === category.id)
          .reduce((sum, item) => sum + item.amount, 0);

        const budget = this.budgets().find(
          (item) => item.categoryId === category.id && item.month === month,
        );

        return {
          category,
          spent,
          budget: budget?.limit ?? 0,
          progress: budget ? Math.min((spent / budget.limit) * 100, 100) : 0,
        };
      })
      .filter((item) => item.spent > 0 || item.budget > 0)
      .sort((a, b) => b.spent - a.spent);
  });

  readonly sixMonthTrend = computed(() => {
    const txs = this.transactions();
    if (txs.length === 0) return [];

    // Meses únicos que tienen transacciones, ordenados del más reciente al más antiguo
    const uniqueMonths = [...new Set(txs.map((t) => t.date.slice(0, 7)))].sort().reverse();

    return uniqueMonths.map((month) => {
      const income = txs
        .filter((t) => t.type === 'income' && t.date.startsWith(month))
        .reduce((sum, t) => sum + t.amount, 0);

      const expense = txs
        .filter((t) => t.type === 'expense' && t.date.startsWith(month))
        .reduce((sum, t) => sum + t.amount, 0);

      return { month, income, expense, balance: income - expense };
    });
  });

  async init(): Promise<void> {
    this.loading.set(true);

    try {
      // 1. Cargar desde IndexedDB local (instantáneo, funciona offline)
      const [localTxs, localCats, localBudgets] = await Promise.all([
        this.indexedDb.getAll<Transaction>('transactions'),
        this.indexedDb.getAll<Category>('categories'),
        this.indexedDb.getAll<Budget>('budgets'),
      ]);

      if (localCats.length > 0 || localTxs.length > 0) {
        this.transactions.set(localTxs.sort((a, b) => b.date.localeCompare(a.date)));
        this.categories.set(localCats);
        this.budgets.set(localBudgets);
        this.loading.set(false); // Mostrar datos locales de inmediato
      }

      // 2. Si hay internet, volcar ops pendientes y refrescar desde la nube
      if (navigator.onLine && this.supabaseService.isConfigured()) {
        await this.flushPendingOps();
        await this.refreshFromCloud();

        if (this.categories().length === 0) {
          await this.seedDefaultCategories();
        }
      } else if (localCats.length === 0) {
        // Sin internet y sin datos locales → sembrar categorías localmente
        await this.seedDefaultCategoriesLocal();
      }
    } finally {
      this.loading.set(false);
      // Escuchar reconexión para auto-sincronizar
      window.addEventListener('online', this.handleOnline);
    }
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
      updatedAt: now,
    };

    // 1. Actualización optimista en UI
    this.transactions.set(
      [row, ...this.transactions()].sort((a, b) => b.date.localeCompare(a.date)),
    );

    // 2. Persistir localmente
    await this.indexedDb.put('transactions', row);

    // 3. Intentar Supabase; si falla → encolar operación
    if (navigator.onLine) {
      try {
        await this.supabaseService.insertTransaction(row);
      } catch {
        await this.queueOp('insertTransaction', row);
      }
    } else {
      await this.queueOp('insertTransaction', row);
    }
  }

  async deleteTransaction(id: string): Promise<void> {
    // 1. Actualización optimista
    this.transactions.set(this.transactions().filter((t) => t.id !== id));

    // 2. Borrar de IndexedDB
    await this.indexedDb.delete('transactions', id);

    // 3. Si hay un insert pendiente para este id, cancelarlo (nunca llegó a la nube)
    const pending = await this.indexedDb.getPendingOps();
    const pendingInsert = pending.find(
      (op) => op.action === 'insertTransaction' && (op.payload as Transaction).id === id,
    );

    if (pendingInsert) {
      await this.indexedDb.deletePendingOp(pendingInsert.id);
      return;
    }

    // 4. Si ya estaba en la nube, borrar o encolar
    if (navigator.onLine) {
      try {
        await this.supabaseService.deleteTransaction(id);
      } catch {
        await this.queueOp('deleteTransaction', id);
      }
    } else {
      await this.queueOp('deleteTransaction', id);
    }
  }

  async addCategory(name: string, color: string): Promise<void> {
    const cleanName = name.trim();
    if (!cleanName) return;
    if (this.categories().some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) return;

    const row: Category = {
      id: crypto.randomUUID(),
      name: cleanName,
      color,
      createdAt: new Date().toISOString(),
    };

    this.categories.set([...this.categories(), row]);
    await this.indexedDb.put('categories', row);

    if (navigator.onLine) {
      try {
        await this.supabaseService.insertCategory(row);
      } catch {
        await this.queueOp('insertCategory', row);
      }
    } else {
      await this.queueOp('insertCategory', row);
    }
  }

  async upsertBudget(categoryId: string, month: string, limit: number): Promise<void> {
    const existing = this.budgets().find((b) => b.categoryId === categoryId && b.month === month);

    const row: Budget = {
      id: existing?.id ?? crypto.randomUUID(),
      categoryId,
      month,
      limit: Number(limit),
      updatedAt: new Date().toISOString(),
    };

    const next = this.budgets().filter((b) => b.id !== row.id);
    this.budgets.set([...next, row]);
    await this.indexedDb.put('budgets', row);

    if (navigator.onLine) {
      try {
        await this.supabaseService.upsertBudget(row);
      } catch {
        await this.queueOp('upsertBudget', row);
      }
    } else {
      await this.queueOp('upsertBudget', row);
    }
  }

  async exportCsv(): Promise<string> {
    const headers = ['id', 'tipo', 'monto', 'categoria', 'nota', 'fecha'];
    const rows = this.transactions().map((t) => {
      const category = this.categories().find((c) => c.id === t.categoryId)?.name ?? t.categoryId;
      return [t.id, t.type, t.amount.toString(), category, t.note ?? '', t.date];
    });

    const lines = [headers, ...rows].map((line) =>
      line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','),
    );
    return lines.join('\n');
  }

  // --- Métodos privados ---

  /** Se ejecuta automáticamente cuando el navegador recupera la conexión */
  private readonly handleOnline = async (): Promise<void> => {
    if (!this.supabaseService.isConfigured()) return;
    this.syncing.set(true);
    try {
      await this.flushPendingOps();
      await this.refreshFromCloud();
    } finally {
      this.syncing.set(false);
    }
  };

  /** Vuelca la cola de operaciones pendientes a Supabase */
  private async flushPendingOps(): Promise<void> {
    const ops = await this.indexedDb.getPendingOps();
    for (const op of ops) {
      try {
        switch (op.action) {
          case 'insertTransaction':
            await this.supabaseService.insertTransaction(op.payload as Transaction);
            break;
          case 'deleteTransaction':
            await this.supabaseService.deleteTransaction(op.payload as string);
            break;
          case 'insertCategory':
            await this.supabaseService.insertCategory(op.payload as Category);
            break;
          case 'upsertBudget':
            await this.supabaseService.upsertBudget(op.payload as Budget);
            break;
        }
        await this.indexedDb.deletePendingOp(op.id);
      } catch {
        // Dejar la op para el próximo intento de sincronización
      }
    }
  }

  private async queueOp(action: PendingOp['action'], payload: unknown): Promise<void> {
    await this.indexedDb.addPendingOp({
      id: crypto.randomUUID(),
      action,
      payload,
      createdAt: new Date().toISOString(),
    });
  }

  private async seedDefaultCategories(): Promise<void> {
    const now = new Date().toISOString();
    const rows: Category[] = DEFAULT_CATEGORIES.map((item) => ({ ...item, createdAt: now }));
    await Promise.all(rows.map((row) => this.supabaseService.insertCategory(row)));
    await Promise.all(rows.map((row) => this.indexedDb.put('categories', row)));
    this.categories.set(rows);
  }

  private async seedDefaultCategoriesLocal(): Promise<void> {
    const now = new Date().toISOString();
    const rows: Category[] = DEFAULT_CATEGORIES.map((item) => ({ ...item, createdAt: now }));
    await Promise.all(rows.map((row) => this.indexedDb.put('categories', row)));
    this.categories.set(rows);
  }

  private async refreshFromCloud(): Promise<void> {
    const snapshot = await this.supabaseService.fetchSnapshot();
    const txsSorted = snapshot.transactions.sort((a, b) => b.date.localeCompare(a.date));
    this.transactions.set(txsSorted);
    this.categories.set(snapshot.categories);
    this.budgets.set(snapshot.budgets);

    // Replicar datos de la nube a IndexedDB
    await Promise.all([
      ...txsSorted.map((tx) => this.indexedDb.put('transactions', tx)),
      ...snapshot.categories.map((cat) => this.indexedDb.put('categories', cat)),
      ...snapshot.budgets.map((budget) => this.indexedDb.put('budgets', budget)),
    ]);
  }
}
