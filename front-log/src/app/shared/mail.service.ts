import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

interface PendingNotificationPayload {
  readonly sessionId: string;
  readonly userName: string;
  readonly lastUserMessage: string;
}

@Injectable({
  providedIn: 'root',
})
export class MailService {
  private readonly http = inject(HttpClient);
  private readonly endpointUrl = 'https://formspree.io/f/xqegaraw';
  private readonly headers = new HttpHeaders({ Accept: 'application/json' });

  sendPendingNotification(payload: PendingNotificationPayload): void {
    const body = {
      tipo: 'Nuevo ususario con problemas para entrar a motorola empresas',
      session_id: payload.sessionId,
      usuario: payload.userName,
      mensaje: "Hay un nuevo ususario con problemas a la hora de utilizar la pagina de motorola empresas, por favor contactalo lo antes posible para ayudarlo a resolver su problema.",
      fecha: new Date().toISOString(),
    };

    this.http.post(this.endpointUrl, body, { headers: this.headers }).subscribe({
      error: (error: unknown) => {
        console.error('No se pudo enviar la notificacion por mail.', error);
      },
    });
  }
}
