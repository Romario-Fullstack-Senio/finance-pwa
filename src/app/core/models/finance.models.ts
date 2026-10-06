/** income: ingreso · expense: gasto · saving: dinero apartado (cuenta de ahorros, CDT...) */
export type TransactionType = 'income' | 'expense' | 'saving';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  note?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

/** fixed = necesidades y variable = deseos en la regla de distribución del ingreso */
export type CategoryKind = 'income' | 'fixed' | 'variable' | 'savings';

/** Categorías que aplican a cada tipo de movimiento */
export const KINDS_BY_TYPE: Record<TransactionType, CategoryKind[]> = {
  income: ['income'],
  expense: ['fixed', 'variable'],
  saving: ['savings'],
};

export const KIND_LABELS: Record<CategoryKind, string> = {
  income: 'Ingreso',
  fixed: 'Gasto fijo',
  variable: 'Gasto variable',
  savings: 'Ahorro',
};

export interface Category {
  id: string;
  name: string;
  color: string;
  kind: CategoryKind;
  createdAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  month: string;
  limit: number;
  updatedAt: string;
}

/** Porcentajes del ingreso mensual para necesidades, deseos y ahorro (suman 100) */
export interface BudgetRule {
  needs: number;
  wants: number;
  savings: number;
}

export const DEFAULT_RULE: BudgetRule = { needs: 50, wants: 30, savings: 20 };

export interface FinanceSnapshot {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  rule: BudgetRule;
}
