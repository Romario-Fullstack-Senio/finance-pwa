import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'resumen' },
      {
        path: 'resumen',
        title: 'Resumen | Mis finanzas personales',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page.component').then(
            (m) => m.DashboardPageComponent,
          ),
      },
      {
        path: 'movimientos',
        title: 'Movimientos | Mis finanzas personales',
        loadComponent: () =>
          import('./features/movements/movements-page.component').then(
            (m) => m.MovementsPageComponent,
          ),
      },
      {
        path: 'presupuestos',
        title: 'Presupuestos | Mis finanzas personales',
        loadComponent: () =>
          import('./features/budgets/budgets-page.component').then((m) => m.BudgetsPageComponent),
      },
    ],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
    canActivate: [guestGuard],
  },
  { path: '**', redirectTo: '' },
];
