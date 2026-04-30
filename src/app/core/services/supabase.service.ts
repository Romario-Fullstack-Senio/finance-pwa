import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Budget, Category, FinanceSnapshot, Transaction } from '../models/finance.models';

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

interface TransactionRow {
  id: string;
  type: 'income' | 'expense';
  amount: number | string;
  category_id: string;
  note: string | null;
  date: string;
  created_at: string;
  updated_at: string;
}

interface BudgetRow {
  id: string;
  category_id: string;
  month: string;
  amount_limit: number | string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly supabase: SupabaseClient | null;

  constructor() {
    if (environment.supabaseUrl && environment.supabaseAnonKey) {
      this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
    } else {
      this.supabase = null;
    }
  }

  isConfigured(): boolean {
    return this.supabase !== null;
  }

  async fetchSnapshot(): Promise<FinanceSnapshot> {
    const client = this.getClient();

    const [categoriesResult, transactionsResult, budgetsResult] = await Promise.all([
      client
        .from('categories')
        .select('id,name,color,created_at')
        .order('created_at', { ascending: true }),
      client
        .from('transactions')
        .select('id,type,amount,category_id,note,date,created_at,updated_at')
        .order('date', { ascending: false }),
      client.from('budgets').select('id,category_id,month,amount_limit,updated_at'),
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
    const client = this.getClient();
    const payload: TransactionRow = {
      id: row.id,
      type: row.type,
      amount: row.amount,
      category_id: row.categoryId,
      note: row.note ?? null,
      date: row.date,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };

    const { error } = await client.from('transactions').insert(payload);
    if (error) {
      throw error;
    }
  }

  async deleteTransaction(id: string): Promise<void> {
    const client = this.getClient();
    const { error } = await client.from('transactions').delete().eq('id', id);
    if (error) {
      throw error;
    }
  }

  async insertCategory(row: Category): Promise<void> {
    const client = this.getClient();
    const payload: CategoryRow = {
      id: row.id,
      name: row.name,
      color: row.color,
      created_at: row.createdAt,
    };

    const { error } = await client.from('categories').insert(payload);
    if (error) {
      throw error;
    }
  }

  async upsertBudget(row: Budget): Promise<void> {
    const client = this.getClient();
    const payload: BudgetRow = {
      id: row.id,
      category_id: row.categoryId,
      month: row.month,
      amount_limit: row.limit,
      updated_at: row.updatedAt,
    };

    const { error } = await client
      .from('budgets')
      .upsert(payload, { onConflict: 'category_id,month' });
    if (error) {
      throw error;
    }
  }

  async pushSnapshot(snapshot: FinanceSnapshot): Promise<void> {
    const client = this.getClient();

    const categories = snapshot.categories.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      created_at: row.createdAt,
    }));

    const transactions = snapshot.transactions.map((row) => ({
      id: row.id,
      type: row.type,
      amount: row.amount,
      category_id: row.categoryId,
      note: row.note ?? null,
      date: row.date,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }));

    const budgets = snapshot.budgets.map((row) => ({
      id: row.id,
      category_id: row.categoryId,
      month: row.month,
      amount_limit: row.limit,
      updated_at: row.updatedAt,
    }));

    const [categoriesResult, transactionsResult, budgetsResult] = await Promise.all([
      client.from('categories').upsert(categories, { onConflict: 'id' }),
      client.from('transactions').upsert(transactions, { onConflict: 'id' }),
      client.from('budgets').upsert(budgets, { onConflict: 'id' }),
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
  }

  private getClient(): SupabaseClient {
    if (!this.supabase) {
      throw new Error('Supabase no esta configurado.');
    }

    return this.supabase;
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
