import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type BotMessageType =
  | 'text'
  | 'button'
  | 'button_text'
  | 'list_row_title'
  | 'list_row_description';

export interface BotMessage {
  readonly key: string;
  readonly state_name: string | null;
  readonly flujo_identificacion_mensaje: string | null;
  readonly label: string;
  readonly content: string;
  readonly default_content: string;
  readonly type: string;
  readonly orden: number;
  readonly id?: string;
  readonly description?: string;
  readonly default_description?: string;
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
};

export const MESSAGE_TYPE_LABELS: Readonly<Record<BotMessageType, string>> = {
  text: 'Mensaje de texto',
  button: 'Botón reply',
  button_text: 'Texto de botón',
  list_row_title: 'Título de fila',
  list_row_description: 'Descripción de fila',
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
 *   Backend types mapeados al frontend:
 *     list_row_title        → list_row   (title + descripción embebida del list_row_description par)
 *     list_row_description  → filtrado   (embebido en el list_row correspondiente)
 *     button_text           → list_button
 *     list_section_title    → filtrado   (sin UI en el editor)
 *     text / button         → igual
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
 *
 * Para list_row: se hacen dos PUT — uno para el título (key) y otro para la
 * descripción (key con sufijo _title → _description).
 */
@Injectable({
  providedIn: 'root',
})
export class BotMessagesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.messagesApiUrl;

  getMessages(): Observable<readonly BotMessage[]> {
    return this.http.get<MessagesApiResponse>(this.apiUrl).pipe(
      map(({ messages }) => {
        const descMap = new Map<string, ApiMessage>();
        for (const m of messages) {
          if (m.message_type === 'list_row_description') {
            descMap.set(m.message_key, m);
          }
        }

        const SKIP_TYPES = new Set(['list_row_description', 'list_section_title']);

        return (messages ?? [])
          .filter((m) => !SKIP_TYPES.has(m.message_type))
          .map((m): BotMessage => {
            const isListRowTitle = m.message_type === 'list_row_title';
            const isButtonText = m.message_type === 'button_text';
            const descKey = isListRowTitle
              ? m.message_key.replace(/_title$/, '_description')
              : undefined;
            const descMsg = descKey ? descMap.get(descKey) : undefined;

            return {
              key: m.message_key,
              type: isListRowTitle ? 'list_row' : isButtonText ? 'list_button' : m.message_type,
              state_name: m.state_name,
              flujo_identificacion_mensaje: m.flujo_identificacion_mensaje,
              label: m.label ?? m.message_key,
              content: m.content,
              default_content: m.default_content,
              orden: m.orden ?? 0,
              ...(descMsg && {
                description: descMsg.content,
                default_description: descMsg.default_content,
              }),
            };
          });
      }),
    );
  }

  updateMessage(key: string, content: string, updatedBy: string): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/${key}`, { content, updated_by: updatedBy });
  }

  updateListRow(
    key: string,
    title: string,
    description: string,
    updatedBy: string,
  ): Observable<unknown> {
    const titleUpdate$ = this.http.put(`${this.apiUrl}/${key}`, {
      content: title,
      updated_by: updatedBy,
    });

    const descKey = key.replace(/_title$/, '_description');
    if (descKey === key) {
      return titleUpdate$;
    }

    const descUpdate$ = this.http.put(`${this.apiUrl}/${descKey}`, {
      content: description,
      updated_by: updatedBy,
    });

    return forkJoin([titleUpdate$, descUpdate$]);
  }

  createMessage(payload: CreateMessagePayload): Observable<unknown> {
    return this.http.post(this.apiUrl, payload);
  }

  reorderMessages(orders: readonly ReorderMessagePayload[]): Observable<unknown> {
    return this.http.patch(`${this.apiUrl}/reorder`, { orders });
  }
}
