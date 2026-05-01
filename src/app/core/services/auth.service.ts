import { computed, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export interface AuthUser {
  id: string;
  email: string;
  avatarUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase: SupabaseClient;

  private readonly _session = signal<Session | null>(null);
  private readonly _loading = signal(true);

  readonly session = this._session.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly user = computed<AuthUser | null>(() => {
    const s = this._session();
    if (!s) return null;
    return {
      id: s.user.id,
      email: s.user.email ?? '',
      avatarUrl: (s.user.user_metadata?.['avatar_url'] as string | null) ?? null,
    };
  });

  readonly isAuthenticated = computed(() => this._session() !== null);

  constructor(private readonly router: Router) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
    this.initSession();
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  private initSession(): void {
    // Restaurar sesión desde localStorage (persistencia automática de Supabase)
    this.supabase.auth.getSession().then(({ data }) => {
      this._session.set(data.session);
      this._loading.set(false);
    });

    // Escuchar cambios de sesión en tiempo real
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this._session.set(session);
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await this.router.navigate(['/']);
  }

  async signUp(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    await this.router.navigate(['/login']);
  }

  async uploadAvatar(file: File): Promise<string> {
    const user = this.user();
    if (!user) throw new Error('No autenticado');

    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await this.supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = this.supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await this.supabase.auth.updateUser({
      data: { avatar_url: publicUrl },
    });
    if (updateError) throw updateError;

    // Refrescar la sesión para obtener el avatar actualizado
    const { data: refreshed } = await this.supabase.auth.getSession();
    this._session.set(refreshed.session);

    return publicUrl;
  }
}
