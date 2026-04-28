export type TransactionType = 'income' | 'expense';

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

export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  month: string;
  limit: number;
  updatedAt: string;
}

export interface FinanceSnapshot {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
}
