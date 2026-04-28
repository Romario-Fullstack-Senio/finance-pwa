import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { FinanceSnapshot } from '../models/finance.models';

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

  async pushSnapshot(snapshot: FinanceSnapshot): Promise<void> {
    if (!this.supabase) {
      return;
    }

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

    await this.supabase.from('categories').upsert(categories, { onConflict: 'id' });
    await this.supabase.from('transactions').upsert(transactions, { onConflict: 'id' });
    await this.supabase.from('budgets').upsert(budgets, { onConflict: 'id' });
  }
}
