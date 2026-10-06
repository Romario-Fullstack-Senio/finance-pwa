import { Injectable, inject } from '@angular/core';
import {
  Budget,
  BudgetRule,
  Category,
  CategoryKind,
  FinanceSnapshot,
  Transaction,
} from '../models/finance.models';
import { ApiError, apiRequest } from './api-client';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class FinanceApiService {
  private readonly authService = inject(AuthService);

  isConfigured(): boolean {
    return this.authService.isAuthenticated();
  }

  fetchSnapshot(): Promise<FinanceSnapshot> {
    return this.request<FinanceSnapshot>('/finance/snapshot');
  }

  insertTransaction(row: Transaction): Promise<void> {
    return this.request('/finance/transactions', 'POST', row);
  }

  deleteTransaction(id: string): Promise<void> {
    return this.request(`/finance/transactions/${encodeURIComponent(id)}`, 'DELETE');
  }

  insertCategory(row: Category): Promise<void> {
    return this.request('/finance/categories', 'POST', row);
  }

  updateCategory(id: string, kind: CategoryKind): Promise<void> {
    return this.request(`/finance/categories/${encodeURIComponent(id)}`, 'PATCH', { kind });
  }

  upsertBudget(row: Budget): Promise<void> {
    return this.request('/finance/budgets', 'PUT', row);
  }

  updateRule(rule: BudgetRule): Promise<void> {
    return this.request('/finance/rule', 'PUT', rule);
  }

  private async request<T = void>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown,
  ): Promise<T> {
    try {
      return await apiRequest<T>(path, { method, body, token: this.authService.token() });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await this.authService.expireSession();
      throw err;
    }
  }
}
