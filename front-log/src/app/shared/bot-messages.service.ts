import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { EditorStorageState } from './editor-storage-state.service';

export type BotMessageType =
  | 'text'
  | 'button'
  | 'button_text'
  | 'list_row_title'
  | 'list_row_description'
  | 'list_section_title';

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
}

/**
 * Fine-grained message API used behind the business-facing block editor.
 * Character limits deliberately do not live here: every editable block field gets its
 * authoritative effective limit from GET /editor/blocks.
 */
@Injectable({ providedIn: 'root' })
export class BotMessagesService {
  private readonly http = inject(HttpClient);
  private readonly storageState = inject(EditorStorageState);
  private readonly apiUrl = environment.messagesApiUrl;

  getMessages(): Observable<readonly BotMessage[]> {
    return this.http.get<MessagesApiResponse>(this.apiUrl).pipe(
      map(({ messages }) =>
        (messages ?? []).map((message): BotMessage => ({
          key: message.message_key,
          type: message.message_type,
          state_name: message.state_name,
          flujo_identificacion_mensaje: message.flujo_identificacion_mensaje,
          label: message.label ?? 'Mensaje del bot',
          content: message.content,
          default_content: message.default_content,
          orden: message.orden ?? 0,
        })),
      ),
    );
  }

  updateMessage(key: string, content: string, updatedBy: string): Observable<unknown> {
    return this.withStorageFailureDetection(
      this.http.put(`${this.apiUrl}/${encodeURIComponent(key)}`, {
        content,
        updated_by: updatedBy,
      }),
    );
  }

  resetMessage(key: string, updatedBy: string): Observable<unknown> {
    return this.withStorageFailureDetection(
      this.http.post(`${this.apiUrl}/${encodeURIComponent(key)}/reset`, {
        updated_by: updatedBy,
      }),
    );
  }

  private withStorageFailureDetection(request: Observable<unknown>): Observable<unknown> {
    return request.pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 503) {
          this.storageState.markUnavailable();
        }
        return throwError(() => error);
      }),
    );
  }
}
