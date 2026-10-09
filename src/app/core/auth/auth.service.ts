import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AviLoginResponse, AviUsuario } from '../models/avi.models';

const TOKEN_KEY = 'avix_token';
const USER_KEY = 'avix_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSubject = new BehaviorSubject<AviUsuario | null>(
    this.readStoredUser()
  );

  readonly user$ = this.userSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  login(codigo: number): Observable<AviLoginResponse> {
    return this.http
      .post<AviLoginResponse>('/api/avi/auth/login', { codigo })
      .pipe(
        tap((response) => {
          localStorage.setItem(TOKEN_KEY, response.token);
          localStorage.setItem(USER_KEY, JSON.stringify(response.usuario));
          this.userSubject.next(response.usuario);
        })
      );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.userSubject.next(null);
  }

  token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  usuario(): AviUsuario | null {
    return this.userSubject.value;
  }

  isAuthenticated(): boolean {
    return Boolean(this.token());
  }

  private readStoredUser(): AviUsuario | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AviUsuario;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }
}
