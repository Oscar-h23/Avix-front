import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  codigo = '';
  loading = false;
  error = '';

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      void this.router.navigate(['/dashboard']);
    }
  }

  ingresar(): void {
    this.error = '';
    const codigo = Number(this.codigo);

    if (!Number.isInteger(codigo) || codigo <= 0) {
      this.error = 'Ingresa un código de trabajador válido.';
      return;
    }

    this.loading = true;

    this.auth.login(codigo).subscribe({
      next: () => {
        this.loading = false;
        void this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.loading = false;
        this.error =
          error?.error?.message ??
          'No se pudo iniciar sesión. Verifica el código e intenta nuevamente.';
      }
    });
  }
}
