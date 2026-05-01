import { Injectable, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { Budget, Category, FinanceSnapshot, Transaction } from '../models/finance.models';
import { AuthService } from './auth.service';

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  user_id?: string;
  created_at: string;
}

interface TransactionRow {
  id: string;
  type: 'income' | 'expense';
  amount: number | string;
  category_id: string;
  user_id?: string;
  note: string | null;
  date: string;
  created_at: string;
  updated_at: string;
}

interface BudgetRow {
  id: string;
  category_id: string;
  user_id?: string;
  month: string;
  amount_limit: number | string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly authService = inject(AuthService);

  private get supabase(): SupabaseClient {
    return this.authService.getClient();
  }

  private get userId(): string {
    const user = this.authService.user();
    if (!user) throw new Error('No autenticado');
    return user.id;
  }

  isConfigured(): boolean {
    return this.authService.isAuthenticated();
  }

  async fetchSnapshot(): Promise<FinanceSnapshot> {
    const uid = this.userId;

    const [categoriesResult, transactionsResult, budgetsResult] = await Promise.all([
      this.supabase
        .from('categories')
        .select('id,name,color,created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: true }),
      this.supabase
        .from('transactions')
        .select('id,type,amount,category_id,note,date,created_at,updated_at')
        .eq('user_id', uid)
        .order('date', { ascending: false }),
      this.supabase
        .from('budgets')
        .select('id,category_id,month,amount_limit,updated_at')
        .eq('user_id', uid),
    ]);

    if (categoriesResult.error) {
      throw categoriesResult.error;
    }

    if (transactionsResult.error) {
      throw transactionsResult.error;
    }

    if (budgetsResult.error) {
      throw budgetsResult.error;
    }

    const categories = (categoriesResult.data ?? []).map((row: CategoryRow) =>
      this.mapCategoryRow(row),
    );
    const transactions = (transactionsResult.data ?? []).map((row: TransactionRow) =>
      this.mapTransactionRow(row),
    );
    const budgets = (budgetsResult.data ?? []).map((row: BudgetRow) => this.mapBudgetRow(row));

    return {
      categories,
      transactions,
      budgets,
    };
  }

  async insertTransaction(row: Transaction): Promise<void> {
    const payload: TransactionRow = {
      id: row.id,
      type: row.type,
      amount: row.amount,
      category_id: row.categoryId,
      user_id: this.userId,
      note: row.note ?? null,
      date: row.date,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
    const { error } = await this.supabase.from('transactions').insert(payload);
    if (error) throw error;
  }

  async deleteTransaction(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId);
    if (error) throw error;
  }

  async insertCategory(row: Category): Promise<void> {
    const payload: CategoryRow = {
      id: row.id,
      name: row.name,
      color: row.color,
      user_id: this.userId,
      created_at: row.createdAt,
    };
    const { error } = await this.supabase.from('categories').insert(payload);
    if (error) throw error;
  }

  async upsertBudget(row: Budget): Promise<void> {
    const payload: BudgetRow = {
      id: row.id,
      category_id: row.categoryId,
      user_id: this.userId,
      month: row.month,
      amount_limit: row.limit,
      updated_at: row.updatedAt,
    };
    const { error } = await this.supabase
      .from('budgets')
      .upsert(payload, { onConflict: 'category_id,month' });
    if (error) throw error;
  }

  async pushSnapshot(snapshot: FinanceSnapshot): Promise<void> {
    const uid = this.userId;
    const categories = snapshot.categories.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      user_id: uid,
      created_at: row.createdAt,
    }));
    const transactions = snapshot.transactions.map((row) => ({
      id: row.id,
      type: row.type,
      amount: row.amount,
      category_id: row.categoryId,
      user_id: uid,
      note: row.note ?? null,
      date: row.date,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }));
    const budgets = snapshot.budgets.map((row) => ({
      id: row.id,
      category_id: row.categoryId,
      user_id: uid,
      month: row.month,
      amount_limit: row.limit,
      updated_at: row.updatedAt,
    }));
    const [c, t, b] = await Promise.all([
      this.supabase.from('categories').upsert(categories, { onConflict: 'id' }),
      this.supabase.from('transactions').upsert(transactions, { onConflict: 'id' }),
      this.supabase.from('budgets').upsert(budgets, { onConflict: 'id' }),
    ]);
    if (c.error) throw c.error;
    if (t.error) throw t.error;
    if (b.error) throw b.error;
  }

  private mapCategoryRow(row: CategoryRow): Category {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      createdAt: row.created_at,
    };
  }

  private mapTransactionRow(row: TransactionRow): Transaction {
    return {
      id: row.id,
      type: row.type,
      amount: Number(row.amount),
      categoryId: row.category_id,
      note: row.note ?? undefined,
      date: row.date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapBudgetRow(row: BudgetRow): Budget {
    return {
      id: row.id,
      categoryId: row.category_id,
      month: row.month,
      limit: Number(row.amount_limit),
      updatedAt: row.updated_at,
    };
  }
}
