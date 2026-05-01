import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../core/services/auth.service';

/** Espera a que la sesión inicial se haya resuelto antes de activar la ruta */
function waitForSession(auth: AuthService) {
  return toObservable(auth.loading).pipe(
    filter((loading) => !loading),
    take(1),
  );
}

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return waitForSession(auth).pipe(
    map(() => (auth.isAuthenticated() ? true : router.createUrlTree(['/login']))),
  );
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return waitForSession(auth).pipe(
    map(() => (!auth.isAuthenticated() ? true : router.createUrlTree(['/']))),
  );
};
