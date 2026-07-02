import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type DownloadFormat = 'pdf' | 'json' | 'csv' | 'txt';

export interface DownloadParams {
  readonly from: string; // YYYY-MM-DD
  readonly to: string;   // YYYY-MM-DD
  readonly format: DownloadFormat;
  readonly sessionId?: string;
}

/**
 * API contract — GET /chatlog/download
 *
 * Query params:
 *   from       string  Fecha inicio en formato YYYY-MM-DD
 *   to         string  Fecha fin    en formato YYYY-MM-DD
 *   format     string  Formato de salida: "pdf" | "json" | "csv" | "txt"
 *   session_id string  (opcional) Filtrar por session_id exacto
 *
 * Respuestas esperadas:
 *   200  Blob con el archivo (Content-Type según format)
 *   404  Sin conversaciones en el rango — el frontend muestra mensaje informativo
 *   4xx/5xx  Error — el frontend muestra mensaje de error genérico
 */
@Injectable({
  providedIn: 'root',
})
export class ChatLogDownloadService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.chatlogDownloadApiUrl;

  download(params: DownloadParams): Observable<Blob> {
    const { from, to, format, sessionId } = params;
    const query = new URLSearchParams({ from, to, format });
    if (sessionId) {
      query.set('session_id', sessionId);
    }
    const url = `${this.apiUrl}?${query.toString()}`;
    return this.http.get(url, { responseType: 'blob' });
  }
}
