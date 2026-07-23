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
    title: 'Mensajes historicos',
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
    title: 'Editor de mensajes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./editor-mensajes/editor-mensajes').then((module) => module.EditorMensajes),
  },
  {
    path: 'editor-opciones',
    title: 'Editor de opciones',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./editor-opciones/editor-opciones').then((module) => module.EditorOpciones),
  },
  {
    path: 'editor-opciones/:group',
    title: 'Editor de grupo de opciones',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./editor-opciones-detalle/editor-opciones-detalle').then(
        (module) => module.EditorOpcionesDetalle,
      ),
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
