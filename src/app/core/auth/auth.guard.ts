import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated()
    ? true
    : router.createUrlTree(['/login']);
};


export const supervisorGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.usuario()?.rol === 'SUPERVISOR'
    ? true
    : router.createUrlTree(['/dashboard']);
};
