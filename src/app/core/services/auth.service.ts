import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError, apiRequest } from './api-client';

export interface AuthUser {
  id: string;
  email: string;
  avatarUrl: string | null;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

const SESSION_KEY = 'finance_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly _session = signal<AuthSession | null>(null);
  private readonly _loading = signal(true);

  readonly session = this._session.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly user = computed<AuthUser | null>(() => this._session()?.user ?? null);

  readonly isAuthenticated = computed(() => this._session() !== null);

  constructor() {
    this.initSession();
  }

  token(): string | null {
    return this._session()?.token ?? null;
  }

  private initSession(): void {
    // Restaurar sesión desde localStorage (funciona offline mientras el token no venza)
    const stored = readStoredSession();
    if (stored && !isTokenExpired(stored.token)) {
      this._session.set(stored);
      // Renovar token y datos del usuario en segundo plano
      if (navigator.onLine) void this.refreshSession();
    } else if (stored) {
      this.setSession(null);
    }
    this._loading.set(false);
  }

  private async refreshSession(): Promise<void> {
    try {
      this.setSession(await apiRequest<AuthSession>('/auth/me', { token: this.token() }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await this.expireSession();
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    this.setSession(
      await apiRequest<AuthSession>('/auth/login', { method: 'POST', body: { email, password } }),
    );
    await this.router.navigate(['/']);
  }

  async signUp(email: string, password: string): Promise<void> {
    this.setSession(
      await apiRequest<AuthSession>('/auth/register', {
        method: 'POST',
        body: { email, password },
      }),
    );
    await this.router.navigate(['/']);
  }

  async signOut(): Promise<void> {
    this.setSession(null);
    await this.router.navigate(['/login']);
  }

  /** El servidor rechazó el token (vencido o inválido): volver al login */
  async expireSession(): Promise<void> {
    if (!this._session()) return;
    await this.signOut();
  }

  async uploadAvatar(file: File): Promise<string> {
    const current = this._session();
    if (!current) throw new Error('No autenticado');

    const form = new FormData();
    form.append('file', file);
    const { user } = await apiRequest<{ user: AuthUser }>('/auth/avatar', {
      method: 'POST',
      body: form,
      token: current.token,
    });

    this.setSession({ ...current, user });
    return user.avatarUrl ?? '';
  }

  private setSession(session: AuthSession | null): void {
    this._session.set(session);
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      // Almacenamiento no disponible (modo privado): la sesión dura lo que la pestaña
    }
  }
}

function readStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const parsed = raw ? (JSON.parse(raw) as AuthSession) : null;
    return parsed?.token && parsed.user?.id ? parsed : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload)) as { exp?: number };
    return !exp || exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
