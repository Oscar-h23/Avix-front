import { Routes } from '@angular/router';
import { authGuard, supervisorGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'historial',
        loadComponent: () =>
          import('./features/historial/historial.component').then((m) => m.HistorialComponent)
      },
      {
        path: 'configuracion-vias',
        canActivate: [supervisorGuard],
        loadComponent: () =>
          import('./features/configuracion-vias/configuracion-vias.component').then(
            (m) => m.ConfiguracionViasComponent
          )
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
