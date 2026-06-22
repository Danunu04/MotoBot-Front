import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BotMessage {
  readonly key: string;
  readonly state_name: string;
  readonly label: string;
  readonly content: string;
  readonly default_content: string;
  readonly type: string;
}

/**
 * API contract — Bot Messages
 *
 * GET /messages
 *   Response: BotMessage[]
 *   El frontend filtra los de type === 'text' y los agrupa por state_name.
 *
 * PUT /messages/{key}
 *   Body: { content: string, updated_by: string }
 *   Response: 200 OK (body ignorado)
 *   Errores: 4xx/5xx → el frontend muestra mensaje de error en el mensaje correspondiente.
 */
@Injectable({
  providedIn: 'root',
})
export class BotMessagesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.messagesApiUrl;

  getMessages(): Observable<readonly BotMessage[]> {
    return this.http.get<readonly BotMessage[]>(this.apiUrl);
  }

  updateMessage(key: string, content: string, updatedBy: string): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/${key}`, { content, updated_by: updatedBy });
  }
}
