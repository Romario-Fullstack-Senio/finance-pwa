import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Budget,
  BudgetRule,
  Category,
  CategoryKind,
  DEFAULT_RULE,
  Transaction,
  TransactionType,
} from '../models/finance.models';
import {
  applyRule,
  emptySummary,
  expensesByCategory,
  summarizeByMonth,
} from '../utils/finance-stats';
import { currentMonthKey, monthRange, monthsBetween, shiftMonth } from '../utils/month';
import { IndexedDbService, PendingOp } from './indexeddb.service';
import { FinanceApiService } from './finance-api.service';

const DEFAULT_CATEGORIES: Pick<Category, 'id' | 'name' | 'color' | 'kind'>[] = [
  { id: 'cat-home', name: 'Vivienda', color: '#059669', kind: 'fixed' },
  { id: 'cat-services', name: 'Servicios', color: '#0891b2', kind: 'fixed' },
  { id: 'cat-food', name: 'Alimentación', color: '#d97706', kind: 'variable' },
  { id: 'cat-transport', name: 'Transporte', color: '#2563eb', kind: 'variable' },
  { id: 'cat-health', name: 'Salud', color: '#db2777', kind: 'variable' },
  { id: 'cat-fun', name: 'Entretenimiento', color: '#ca8a04', kind: 'variable' },
  { id: 'cat-other', name: 'Otros gastos', color: '#475569', kind: 'variable' },
  { id: 'cat-salary', name: 'Salario', color: '#7c3aed', kind: 'income' },
  { id: 'cat-other-income', name: 'Otros ingresos', color: '#4f46e5', kind: 'income' },
  { id: 'cat-savings', name: 'Ahorro', color: '#9085e9', kind: 'savings' },
  { id: 'cat-emergency', name: 'Fondo de emergencia', color: '#a855f7', kind: 'savings' },
];

const RULE_SETTING = 'rule';

const TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  saving: 'Ahorro',
};

/** Categorías guardadas antes de existir el tipo: mismo criterio que la migración 002 */
function withKind(category: Category): Category {
  if (category.kind) return category;
  const kind: CategoryKind =
    category.id === 'cat-salary' ? 'income' : category.id === 'cat-home' ? 'fixed' : 'variable';
  return { ...category, kind };
}

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly api = inject(FinanceApiService);
  private readonly indexedDb = inject(IndexedDbService);

  readonly loading = signal(true);
  readonly syncing = signal(false);
  readonly transactions = signal<Transaction[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly budgets = signal<Budget[]>([]);
  readonly rule = signal<BudgetRule>(DEFAULT_RULE);

  /** Mes que se está viendo ('YYYY-MM'); lo comparten todas las pestañas */
  readonly selectedMonth = signal(currentMonthKey());

  readonly monthSummaries = computed(() =>
    summarizeByMonth(this.transactions(), this.categories()),
  );

  readonly selectedSummary = computed(
    () => this.monthSummaries().get(this.selectedMonth()) ?? emptySummary(this.selectedMonth()),
  );

  readonly previousSummary = computed(() => {
    const previous = shiftMonth(this.selectedMonth(), -1);
    return this.monthSummaries().get(previous) ?? emptySummary(previous);
  });

  /** Hasta 12 meses que terminan en el seleccionado, desde el primero con datos (mínimo 6) */
  readonly history = computed(() => {
    const end = this.selectedMonth();
    const summaries = this.monthSummaries();
    const first = [...summaries.keys()].sort()[0] ?? end;
    const count = Math.min(12, Math.max(6, monthsBetween(first, end) + 1));
    return monthRange(end, count).map((month) => summaries.get(month) ?? emptySummary(month));
  });

  /** Totales desde el primer movimiento hasta el final del mes seleccionado */
  readonly accumulated = computed(() => {
    const end = this.selectedMonth();
    let available = 0;
    let saved = 0;
    for (const summary of this.monthSummaries().values()) {
      if (summary.month > end) continue;
      available += summary.available;
      saved += summary.saved;
    }
    return { available, saved };
  });

  readonly ruleProgress = computed(() => applyRule(this.selectedSummary(), this.rule()));

  readonly selectedTransactions = computed(() =>
    this.transactions().filter((tx) => tx.date.startsWith(this.selectedMonth())),
  );

  /** Gasto por categoría del mes seleccionado, con presupuesto */
  readonly categoryBreakdown = computed(() =>
    expensesByCategory(
      this.transactions(),
      this.categories(),
      this.budgets(),
      this.selectedMonth(),
    ),
  );

  setSelectedMonth(month: string): void {
    this.selectedMonth.set(month);
  }

  async init(): Promise<void> {
    this.loading.set(true);

    try {
      // 1. Cargar desde IndexedDB local (instantáneo, funciona offline)
      const [localTxs, localCats, localBudgets, localRule] = await Promise.all([
        this.indexedDb.getAll<Transaction>('transactions'),
        this.indexedDb.getAll<Category>('categories'),
        this.indexedDb.getAll<Budget>('budgets'),
        this.indexedDb.getSetting<BudgetRule>(RULE_SETTING),
      ]);

      if (localRule) this.rule.set(localRule);

      if (localCats.length > 0 || localTxs.length > 0) {
        this.transactions.set(localTxs.sort((a, b) => b.date.localeCompare(a.date)));
        this.categories.set(localCats.map(withKind));
        this.budgets.set(localBudgets);
        this.loading.set(false); // Mostrar datos locales de inmediato
      }

      // 2. Si hay internet, volcar ops pendientes y refrescar desde la nube
      if (navigator.onLine && this.api.isConfigured()) {
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

    // 3. Intentar el servidor; si falla → encolar operación
    if (navigator.onLine) {
      try {
        await this.api.insertTransaction(row);
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
        await this.api.deleteTransaction(id);
      } catch {
        await this.queueOp('deleteTransaction', id);
      }
    } else {
      await this.queueOp('deleteTransaction', id);
    }
  }

  async addCategory(name: string, color: string, kind: CategoryKind): Promise<void> {
    const cleanName = name.trim();
    if (!cleanName) return;
    if (this.categories().some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) return;

    const row: Category = {
      id: crypto.randomUUID(),
      name: cleanName,
      color,
      kind,
      createdAt: new Date().toISOString(),
    };

    this.categories.set([...this.categories(), row]);
    await this.indexedDb.put('categories', row);

    if (navigator.onLine) {
      try {
        await this.api.insertCategory(row);
      } catch {
        await this.queueOp('insertCategory', row);
      }
    } else {
      await this.queueOp('insertCategory', row);
    }
  }

  async updateCategoryKind(id: string, kind: CategoryKind): Promise<void> {
    const current = this.categories().find((c) => c.id === id);
    if (!current || current.kind === kind) return;

    const row: Category = { ...current, kind };
    this.categories.set(this.categories().map((c) => (c.id === id ? row : c)));
    await this.indexedDb.put('categories', row);

    if (navigator.onLine) {
      try {
        await this.api.updateCategory(id, kind);
      } catch {
        await this.queueOp('updateCategory', { id, kind });
      }
    } else {
      await this.queueOp('updateCategory', { id, kind });
    }
  }

  async updateRule(rule: BudgetRule): Promise<void> {
    this.rule.set(rule);
    await this.indexedDb.putSetting(RULE_SETTING, rule);

    if (navigator.onLine) {
      try {
        await this.api.updateRule(rule);
      } catch {
        await this.queueOp('updateRule', rule);
      }
    } else {
      await this.queueOp('updateRule', rule);
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
        await this.api.upsertBudget(row);
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
      return [t.id, TYPE_LABELS[t.type], t.amount.toString(), category, t.note ?? '', t.date];
    });

    const lines = [headers, ...rows].map((line) =>
      line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','),
    );
    return lines.join('\n');
  }

  // --- Métodos privados ---

  /** Se ejecuta automáticamente cuando el navegador recupera la conexión */
  private readonly handleOnline = async (): Promise<void> => {
    if (!this.api.isConfigured()) return;
    this.syncing.set(true);
    try {
      await this.flushPendingOps();
      await this.refreshFromCloud();
    } finally {
      this.syncing.set(false);
    }
  };

  /** Vuelca la cola de operaciones pendientes al servidor */
  private async flushPendingOps(): Promise<void> {
    const ops = await this.indexedDb.getPendingOps();
    for (const op of ops) {
      try {
        switch (op.action) {
          case 'insertTransaction':
            await this.api.insertTransaction(op.payload as Transaction);
            break;
          case 'deleteTransaction':
            await this.api.deleteTransaction(op.payload as string);
            break;
          case 'insertCategory':
            await this.api.insertCategory(op.payload as Category);
            break;
          case 'updateCategory': {
            const { id, kind } = op.payload as { id: string; kind: CategoryKind };
            await this.api.updateCategory(id, kind);
            break;
          }
          case 'upsertBudget':
            await this.api.upsertBudget(op.payload as Budget);
            break;
          case 'updateRule':
            await this.api.updateRule(op.payload as BudgetRule);
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
    await Promise.all(rows.map((row) => this.api.insertCategory(row)));
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
    const snapshot = await this.api.fetchSnapshot();
    const txsSorted = snapshot.transactions.sort((a, b) => b.date.localeCompare(a.date));
    this.transactions.set(txsSorted);
    this.categories.set(snapshot.categories);
    this.budgets.set(snapshot.budgets);
    this.rule.set(snapshot.rule);

    // Replicar datos de la nube a IndexedDB
    await Promise.all([
      this.indexedDb.putSetting(RULE_SETTING, snapshot.rule),
      ...txsSorted.map((tx) => this.indexedDb.put('transactions', tx)),
      ...snapshot.categories.map((cat) => this.indexedDb.put('categories', cat)),
      ...snapshot.budgets.map((budget) => this.indexedDb.put('budgets', budget)),
    ]);
  }
}
