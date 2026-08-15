import { Routes } from '@angular/router';
import { authGuard, guestOnlyGuard } from './shared/auth.guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'home',
  },
  {
    path: 'login',
    title: 'Iniciar sesion',
    canActivate: [guestOnlyGuard],
    loadComponent: () => import('./log-in/log-in').then((module) => module.LogIn),
  },
  {
    path: 'home',
    title: 'Conversaciones',
    canActivate: [authGuard],
    loadComponent: () => import('./inicio/inicio').then((module) => module.Inicio),
  },
  {
    path: 'mensajes-pendientes',
    title: 'Mensajes pendientes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./mensajes-pendientes/mensajes-pendientes').then(
        (module) => module.MensajesPendientes,
      ),
  },
  {
    path: 'mensajes-pendientes/:sessionId',
    title: 'Responder mensaje',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./responder-mensaje-component/responder-mensaje-component').then(
        (module) => module.ResponderMensajeComponent,
      ),
  },
  {
    path: 'editor-mensajes',
    title: 'Editor de conversación',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./editor-mensajes/editor-mensajes').then((module) => module.EditorMensajes),
  },
  {
    path: 'editor-opciones',
    pathMatch: 'full',
    redirectTo: 'editor-mensajes',
  },
  {
    path: 'editor-opciones/:group',
    redirectTo: 'editor-mensajes',
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
