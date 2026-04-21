import { Injectable, signal } from '@angular/core';

const AUTH_STORAGE_KEY = 'inspectia-authenticated';
const VALID_USERNAME = 'sitecnosa';
const VALID_PASSWORD = 'sitecno2021';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  readonly isAuthenticated = signal(this.readStoredAuthState());

  login(username: string, password: string): boolean {
    const isValid =
      username.trim() === VALID_USERNAME &&
      password === VALID_PASSWORD;

    this.isAuthenticated.set(isValid);
    this.persistAuthState(isValid);

    return isValid;
  }

  logout(): void {
    this.isAuthenticated.set(false);
    this.persistAuthState(false);
  }

  private readStoredAuthState(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }

    return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  }

  private persistAuthState(isAuthenticated: boolean): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    if (isAuthenticated) {
      localStorage.setItem(AUTH_STORAGE_KEY, 'true');
      return;
    }

    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}
