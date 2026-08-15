import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  EDITOR_STORAGE_UNAVAILABLE_MESSAGE,
  EditorStorageState,
} from './editor-storage-state.service';
import type { EditorStorageStatus } from './editor-storage-state.service';

export { EDITOR_STORAGE_UNAVAILABLE_MESSAGE };
export type { EditorStorageStatus };

export type EditorBlockFormat = 'botones' | 'lista' | 'texto_libre' | 'sin_opciones';
export type EditorTraversalGroup = 'recorrido_principal' | 'otros_momentos';

export interface SharedBlockReference {
  readonly block_id: string;
  readonly titulo: string;
}

export interface EditorMessage {
  readonly message_key: string;
  readonly label: string;
  readonly content: string;
  readonly limite_caracteres: number;
  readonly compartido?: boolean;
  readonly compartido_con?: readonly SharedBlockReference[];
}

export interface EditorPresentation {
  readonly texto_boton: string;
  readonly texto_boton_key: string;
  readonly texto_boton_limite_caracteres: number;
  readonly titulo_seccion: string;
  readonly titulo_seccion_key: string;
  readonly titulo_seccion_limite_caracteres: number;
}

export interface EditorCreateLimits {
  readonly titulo_botones: number;
  readonly titulo_lista: number;
  readonly descripcion_lista: number;
  readonly respuesta: number;
}

export interface EditorSimpleDestination {
  readonly es_condicional?: false;
  readonly state_id: string;
  readonly label: string;
  readonly block_id: string | null;
}

export interface EditorConditionalDestinationItem {
  readonly condicion: string;
  readonly valor: string;
  readonly state_id: string;
  readonly block_id: string;
  readonly label: string;
}

export interface EditorConditionalDestination {
  readonly es_condicional: true;
  readonly label: string;
  readonly destinos_posibles: readonly EditorConditionalDestinationItem[];
}

export type EditorDestination = EditorSimpleDestination | EditorConditionalDestination;

export interface EditorOption {
  readonly option_id: string;
  readonly orden: number;
  readonly editable: boolean;
  readonly sintetica: boolean;
  readonly titulo: string;
  readonly titulo_key: string;
  readonly titulo_limite_caracteres: number;
  readonly titulo_boton: string;
  readonly titulo_boton_key: string;
  readonly titulo_boton_limite_caracteres: number;
  readonly descripcion: string | null;
  readonly descripcion_key: string | null;
  readonly descripcion_limite_caracteres: number;
  readonly respuesta: EditorMessage | null;
  readonly lleva_a: EditorDestination | null;
}

export interface EditorBlock {
  readonly block_id: string;
  readonly orden_recorrido: number;
  readonly grupo_recorrido: EditorTraversalGroup;
  readonly titulo: string;
  readonly mensajes_previos: readonly EditorMessage[];
  readonly prompt: EditorMessage;
  readonly tiene_opciones: boolean;
  readonly acepta_nuevas_opciones: boolean;
  readonly limites_alta: EditorCreateLimits;
  readonly formato: EditorBlockFormat;
  readonly formato_motivo: string;
  readonly presentacion: EditorPresentation | null;
  readonly opciones: readonly EditorOption[];
}

export interface EditorBlocksSnapshot {
  readonly blocks: readonly EditorBlock[];
  readonly storage: EditorStorageStatus;
}

export interface FlowState {
  readonly state_id: string;
  readonly label: string;
}

export interface MessageCopyChoice {
  readonly message_key: string;
  readonly label: string;
  readonly content: string;
}

export interface DestinationChoice {
  readonly state_id: string;
  readonly block_id: string | null;
  readonly label: string;
}

export type ComposedResponsePayload =
  | { readonly modo: 'nuevo'; readonly contenido: string }
  | { readonly modo: 'sin_respuesta' };

export interface ComposedOptionCreatePayload {
  readonly titulo: string;
  readonly titulo_boton?: string | null;
  readonly descripcion: string | null;
  readonly respuesta: ComposedResponsePayload;
  readonly lleva_a: string | { readonly state_id: string; readonly block_id: string };
  readonly posicion: number;
  readonly permitir_cambio_a_lista: boolean;
  readonly updated_by: string;
}

interface EditorBlocksResponse {
  readonly ok: boolean;
  readonly blocks: readonly EditorBlock[];
  readonly count: number;
  readonly storage?: EditorStorageStatus;
}

interface EditorBlockCreateResponse {
  readonly ok: boolean;
  readonly block: EditorBlock;
}

interface EditorErrorDetail {
  readonly message?: unknown;
  readonly field?: unknown;
  readonly code?: unknown;
}

export class EditorOptionCreateError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly field: string | null = null,
    readonly code = 'editor_error',
  ) {
    super(message);
    this.name = 'EditorOptionCreateError';
  }
}

function normalizeEditorError(error: unknown): EditorOptionCreateError {
  if (!(error instanceof HttpErrorResponse)) {
    return new EditorOptionCreateError('Ocurrió un error inesperado al guardar la opción.', 0);
  }
  if (error.status === 0) {
    return new EditorOptionCreateError(
      'No se pudo conectar con el backend. Verificá que el servidor esté iniciado.',
      0,
      null,
      'connection_error',
    );
  }

  const detail = error.error?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return new EditorOptionCreateError(detail, error.status);
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { readonly msg?: unknown; readonly loc?: readonly unknown[] };
    const field = Array.isArray(first.loc)
      ? first.loc.filter((part) => part !== 'body').join('.') || null
      : null;
    return new EditorOptionCreateError(
      typeof first.msg === 'string' ? first.msg : 'Los datos enviados no son válidos.',
      error.status,
      field,
      'validation_error',
    );
  }
  if (detail && typeof detail === 'object') {
    const structured = detail as EditorErrorDetail;
    return new EditorOptionCreateError(
      typeof structured.message === 'string'
        ? structured.message
        : 'No se pudo guardar la opción.',
      error.status,
      typeof structured.field === 'string' ? structured.field : null,
      typeof structured.code === 'string' ? structured.code : 'editor_error',
    );
  }
  return new EditorOptionCreateError(
    `No se pudo guardar la opción (error ${error.status}).`,
    error.status,
  );
}

export function isConditionalDestination(
  destination: EditorDestination | null,
): destination is EditorConditionalDestination {
  return destination?.es_condicional === true;
}

@Injectable({ providedIn: 'root' })
export class EditorBlocksService {
  private readonly http = inject(HttpClient);
  private readonly storageState = inject(EditorStorageState);
  private readonly blocksUrl = environment.editorBlocksApiUrl;
  private readonly optionsUrl = environment.optionsApiUrl;
  private readonly flowStatesUrl = environment.flowStatesApiUrl;

  getBlocks(): Observable<EditorBlocksSnapshot> {
    return this.http
      .get<EditorBlocksResponse>(this.blocksUrl)
      .pipe(
        map((response) => ({
          blocks: response.blocks ?? [],
          storage: response.storage ?? {
            writable: false,
            message: EDITOR_STORAGE_UNAVAILABLE_MESSAGE,
          },
        })),
        tap((snapshot) => this.storageState.setStatus(snapshot.storage)),
      );
  }

  getFlowStates(): Observable<readonly FlowState[]> {
    return this.http
      .get<{ readonly ok: boolean; readonly states: readonly FlowState[] }>(this.flowStatesUrl)
      .pipe(map((response) => response.states ?? []));
  }

  createOption(
    blockId: string,
    payload: ComposedOptionCreatePayload,
  ): Observable<EditorBlock> {
    return this.http
      .post<EditorBlockCreateResponse>(
        `${this.blocksUrl}/${encodeURIComponent(blockId)}/opciones`,
        payload,
      )
      .pipe(
        map((response) => response.block),
        catchError((error: unknown) => {
          this.markStorageUnavailable(error);
          return throwError(() => normalizeEditorError(error));
        }),
      );
  }

  setOptionResponse(
    blockId: string,
    optionId: string,
    respuesta: ComposedResponsePayload,
    updatedBy: string,
  ): Observable<EditorBlock> {
    return this.http
      .put<EditorBlockCreateResponse>(
        `${this.blocksUrl}/${encodeURIComponent(blockId)}/opciones/${encodeURIComponent(optionId)}/respuesta`,
        { respuesta, updated_by: updatedBy },
      )
      .pipe(
        map((response) => response.block),
        catchError((error: unknown) => {
          this.markStorageUnavailable(error);
          return throwError(() => normalizeEditorError(error));
        }),
      );
  }

  deleteOption(blockId: string, optionId: string, updatedBy: string): Observable<unknown> {
    const params = new HttpParams().set('updated_by', updatedBy);
    return this.http
      .delete(`${this.optionsUrl}/${encodeURIComponent(blockId)}/${encodeURIComponent(optionId)}`, {
        params,
      })
      .pipe(
        catchError((error: unknown) => {
          this.markStorageUnavailable(error);
          return throwError(() => error);
        }),
      );
  }

  private markStorageUnavailable(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 503) {
      this.storageState.markUnavailable();
    }
  }
}
