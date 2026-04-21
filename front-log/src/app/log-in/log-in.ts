import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators, NonNullableFormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../shared/auth.service';

@Component({
  selector: 'app-log-in',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './log-in.html',
  styleUrl: './log-in.css',
})
export class LogIn {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly authError = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly loginForm = this.formBuilder.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  protected togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  protected submitLogin(): void {
    if (this.loginForm.invalid || this.isSubmitting()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.authError.set('');

    const { username, password } = this.loginForm.getRawValue();
    const isValid = this.authService.login(username, password);

    if (!isValid) {
      this.authError.set('Usuario o contrasena incorrectos.');
      this.isSubmitting.set(false);
      return;
    }

    const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo') || '/home';

    void this.router.navigateByUrl(redirectTo).finally(() => {
      this.isSubmitting.set(false);
    });
  }
}
