import { Injectable, inject } from '@angular/core';
import { Budget, Category, FinanceSnapshot, Transaction } from '../models/finance.models';
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

  upsertBudget(row: Budget): Promise<void> {
    return this.request('/finance/budgets', 'PUT', row);
  }

  private async request<T = void>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
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
