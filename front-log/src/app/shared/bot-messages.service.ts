import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export type BotMessageType = 'text' | 'button' | 'button_text' | 'list_row_title' | 'list_row_description' | 'list_section_title';

export function extractApiError(err: unknown): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const e = (err as { error: unknown }).error;
    if (e && typeof e === 'object' && 'detail' in e) return String((e as { detail: unknown }).detail);
  }
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return 'Error desconocido.';
}

export interface BotMessage {
  readonly key: string;
  readonly state_name: string | null;
  readonly flujo_identificacion_mensaje: string | null;
  readonly label: string;
  readonly content: string;
  readonly default_content: string;
  readonly type: BotMessageType;
  readonly orden: number;
}

export interface CreateMessagePayload {
  readonly message_key: string;
  readonly message_type: BotMessageType;
  readonly state_name: string | null;
  readonly flujo_identificacion_mensaje: string | null;
  readonly label: string | null;
  readonly content: string;
  readonly default_content: string | null;
  readonly updated_by: string;
  readonly orden: number;
}

export interface ReorderMessagePayload {
  readonly message_key: string;
  readonly orden: number;
}

export const MESSAGE_LIMITS: Readonly<Record<BotMessageType, number>> = {
  text: 2000,
  button: 20,
  button_text: 2000,
  list_row_title: 24,
  list_row_description: 72,
  list_section_title: 24,
};

export const MESSAGE_TYPE_LABELS: Readonly<Record<BotMessageType, string>> = {
  text: 'Mensaje de texto',
  button: 'Botón reply',
  button_text: 'Texto de botón',
  list_row_title: 'Título de fila',
  list_row_description: 'Descripción de fila',
  list_section_title: 'Título de sección',
};

interface MessagesApiResponse {
  readonly ok: boolean;
  readonly messages: readonly ApiMessage[];
}

interface ApiMessage {
  readonly message_key: string;
  readonly message_type: BotMessageType;
  readonly state_name: string | null;
  readonly flujo_identificacion_mensaje: string | null;
  readonly label: string | null;
  readonly content: string;
  readonly default_content: string;
  readonly orden: number;
  readonly updated_at?: string;
  readonly updated_by?: string;
  readonly source?: string;
}

/**
 * API contract — Bot Messages
 *
 * GET /messages
 *   Response: { ok: true, messages: ApiMessage[] }
 *
 * PUT /messages/{key}
 *   Body: { content: string, updated_by: string }
 *   Response: { ok: true, message_key: string }
 *
 * POST /messages
 *   Body: CreateMessagePayload
 *   Response: { ok: true, message_key: string }
 *
 * PATCH /messages/reorder
 *   Body: { orders: ReorderMessagePayload[] }
 *   Response: { ok: true, updated: number }
 */
@Injectable({
  providedIn: 'root',
})
export class BotMessagesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.messagesApiUrl;

  getMessages(): Observable<readonly BotMessage[]> {
    return this.http.get<MessagesApiResponse>(this.apiUrl).pipe(
      map((response) =>
        (response.messages ?? []).map((m) => ({
          key: m.message_key,
          type: m.message_type,
          state_name: m.state_name,
          flujo_identificacion_mensaje: m.flujo_identificacion_mensaje,
          label: m.label ?? m.message_key,
          content: m.content,
          default_content: m.default_content,
          orden: m.orden ?? 0,
        })),
      ),
    );
  }

  updateMessage(key: string, content: string, updatedBy: string): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/${key}`, { content, updated_by: updatedBy });
  }

  createMessage(payload: CreateMessagePayload): Observable<unknown> {
    return this.http.post(this.apiUrl, payload);
  }

  reorderMessages(orders: readonly ReorderMessagePayload[]): Observable<unknown> {
    return this.http.patch(`${this.apiUrl}/reorder`, { orders });
  }

  deleteMessage(key: string, updatedBy: string): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/${key}`, { params: { updated_by: updatedBy } });
  }
}
