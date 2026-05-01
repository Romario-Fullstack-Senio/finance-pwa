import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toast } from 'ngx-sonner';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-shell-header',
  standalone: true,
  templateUrl: './shell-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellHeaderComponent {
  private readonly _menuOffset = 8;
  private readonly _menuWidth = 208;

  readonly authService = inject(AuthService);
  readonly uploading = signal(false);
  readonly menuOpen = signal(false);
  readonly menuTrigger = viewChild<ElementRef<HTMLButtonElement>>('menuTrigger');

  public toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  public async signOut(): Promise<void> {
    await this.authService.signOut();
    toast.success('Sesión cerrada');
  }

  public triggerAvatarUpload(): void {
    document.getElementById('avatarInput')?.click();
  }

  public async onAvatarChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validar tipo y tamaño (máx 2MB)
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar 2 MB.');
      return;
    }

    this.uploading.set(true);
    try {
      await this.authService.uploadAvatar(file);
      toast.success('Foto de perfil actualizada');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir la imagen';
      toast.error(msg);
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  public getMenuTop(): number {
    const triggerRect = this._getTriggerRect();

    if (!triggerRect) {
      return 80;
    }

    return triggerRect.bottom + this._menuOffset;
  }

  public getMenuLeft(): number {
    const triggerRect = this._getTriggerRect();
    const maxLeft = Math.max(window.innerWidth - this._menuWidth - 16, 16);

    if (!triggerRect) {
      return maxLeft;
    }

    const alignedLeft = triggerRect.right - this._menuWidth;
    return Math.min(Math.max(alignedLeft, 16), maxLeft);
  }

  private _getTriggerRect(): DOMRect | null {
    return this.menuTrigger()?.nativeElement.getBoundingClientRect() ?? null;
  }
}
