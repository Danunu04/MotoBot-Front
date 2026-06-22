import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type DownloadFormat = 'pdf' | 'json' | 'csv';

export interface DownloadParams {
  readonly from: string; // YYYY-MM-DD
  readonly to: string;   // YYYY-MM-DD
  readonly format: DownloadFormat;
}

/**
 * API contract — GET /chatlog/download
 *
 * Query params:
 *   from   string  Fecha inicio en formato YYYY-MM-DD
 *   to     string  Fecha fin    en formato YYYY-MM-DD
 *   format string  Formato de salida: "pdf" | "json" | "csv"
 *
 * Respuestas esperadas:
 *   200  Blob con el archivo (Content-Type: application/pdf | application/json | text/csv)
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
    const { from, to, format } = params;
    const url = `${this.apiUrl}?from=${from}&to=${to}&format=${format}`;
    return this.http.get(url, { responseType: 'blob' });
  }
}
