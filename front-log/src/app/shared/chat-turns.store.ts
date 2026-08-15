import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

import { environment } from '../../environments/environment';

export type ChatTurnType = 'mensaje' | 'lista' | 'botones' | 'respuesta_usuario' | 'sistema';
export type ChatTurnAuthor = 'bot' | 'usuario' | 'sistema';

interface ChatTurnApiOption {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
}

interface ChatTurnApiItem {
  readonly turn_id: string;
  readonly session_id: string;
  readonly timestamp: string;
  readonly fecha: string | null;
  readonly orden: number;
  readonly tipo: ChatTurnType;
  readonly autor: ChatTurnAuthor;
  readonly texto: string;
  readonly opciones: readonly ChatTurnApiOption[];
  readonly nombre_lista: string | null;
  readonly interactive_type: string | null;
  readonly seleccion_opcion: boolean | null;
  readonly opcion_id_seleccionada: string | null;
  readonly nueva_sesion: boolean;
  readonly status: string | null;
  readonly channel: string | null;
  readonly environment: string | null;
}

interface ChatTurnsEnvelope {
  readonly ok: boolean;
  readonly turns: readonly ChatTurnApiItem[];
  readonly count: number;
}

export interface ChatTurnOption {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
}

export interface ChatTurn {
  readonly turnId: string;
  readonly sessionId: string;
  readonly timestamp: string;
  readonly date: string | null;
  readonly order: number;
  readonly type: ChatTurnType;
  readonly author: ChatTurnAuthor;
  readonly text: string;
  readonly options: readonly ChatTurnOption[];
  readonly listName: string | null;
  readonly interactiveType: string | null;
  readonly isOptionSelection: boolean;
  readonly selectedOptionId: string | null;
  readonly newSession: boolean;
  readonly status: string | null;
  readonly channel: string | null;
  readonly environment: string | null;
}

export interface ChatTurnFilters {
  readonly sessionId?: string;
  readonly from?: string;
  readonly to?: string;
}

export interface ChatSessionChoice {
  readonly sessionId: string;
  readonly label: string;
  readonly turnCount: number;
  readonly firstTimestamp: string;
}

export function buildChatSessionChoices(turns: readonly ChatTurn[]): readonly ChatSessionChoice[] {
  const grouped = new Map<string, ChatTurn[]>();
  for (const turn of turns) {
    const sessionTurns = grouped.get(turn.sessionId) ?? [];
    sessionTurns.push(turn);
    grouped.set(turn.sessionId, sessionTurns);
  }

  return [...grouped.entries()]
    .map(([sessionId, sessionTurns]) => {
      const ordered = [...sessionTurns].sort((left, right) =>
        left.timestamp.localeCompare(right.timestamp),
      );
      return {
        sessionId,
        turnCount: ordered.length,
        firstTimestamp: ordered[0]?.timestamp ?? '',
      };
    })
    .sort((left, right) => right.firstTimestamp.localeCompare(left.firstTimestamp))
    .map((session, index) => ({
      ...session,
      label: `Conversación ${index + 1} · ${formatSessionStart(session.firstTimestamp)}`,
    }));
}

function formatSessionStart(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return 'fecha no disponible';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

@Injectable({ providedIn: 'root' })
export class ChatTurnsStore {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.chatTurnsApiUrl;
  private requestSequence = 0;
  private checkingAvailability = false;

  readonly turns = signal<readonly ChatTurn[]>([]);
  readonly catalogTurns = signal<readonly ChatTurn[]>([]);
  readonly count = signal(0);
  readonly isLoading = signal(false);
  readonly isCheckingAvailability = signal(false);
  readonly hasAnyTurns = signal<boolean | null>(null);
  readonly errorMessage = signal('');

  load(filters: ChatTurnFilters = {}): void {
    const requestId = ++this.requestSequence;
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.http.get<ChatTurnsEnvelope>(this.apiUrl, { params: this.buildParams(filters) }).subscribe({
      next: (response) => {
        if (requestId !== this.requestSequence) return;
        if (!response.ok || !Array.isArray(response.turns)) {
          this.turns.set([]);
          this.count.set(0);
          this.errorMessage.set('El historial nuevo no devolvió una respuesta válida.');
          this.isLoading.set(false);
          return;
        }

        const nextTurns = response.turns.map((turn) => this.mapTurn(turn));
        this.turns.set(nextTurns);
        this.count.set(response.count ?? nextTurns.length);
        if (!filters.sessionId) {
          this.catalogTurns.set(nextTurns);
        }
        if (nextTurns.length > 0) {
          this.hasAnyTurns.set(true);
        } else if (!this.hasFilters(filters)) {
          this.hasAnyTurns.set(false);
        } else if (this.hasAnyTurns() === null) {
          this.probeAvailability();
        }
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        if (requestId !== this.requestSequence) return;
        this.turns.set([]);
        this.count.set(0);
        this.errorMessage.set(this.getErrorMessage(error));
        this.isLoading.set(false);
      },
    });
  }

  private probeAvailability(): void {
    if (this.checkingAvailability) return;
    this.checkingAvailability = true;
    this.isCheckingAvailability.set(true);
    this.http.get<ChatTurnsEnvelope>(this.apiUrl).subscribe({
      next: (response) => {
        this.hasAnyTurns.set(Boolean(response.ok && response.count > 0));
        this.checkingAvailability = false;
        this.isCheckingAvailability.set(false);
      },
      error: () => {
        this.checkingAvailability = false;
        this.isCheckingAvailability.set(false);
      },
    });
  }

  private buildParams(filters: ChatTurnFilters): HttpParams {
    let params = new HttpParams();
    if (filters.sessionId) params = params.set('session_id', filters.sessionId);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    return params;
  }

  private hasFilters(filters: ChatTurnFilters): boolean {
    return Boolean(filters.sessionId || filters.from || filters.to);
  }

  private mapTurn(turn: ChatTurnApiItem): ChatTurn {
    return {
      turnId: turn.turn_id,
      sessionId: turn.session_id,
      timestamp: turn.timestamp,
      date: turn.fecha,
      order: turn.orden,
      type: turn.tipo,
      author: turn.autor,
      text: turn.texto,
      options: (turn.opciones ?? []).map((option) => ({
        id: option.id,
        title: option.title,
        description: option.description ?? null,
      })),
      listName: turn.nombre_lista,
      interactiveType: turn.interactive_type,
      isOptionSelection: turn.seleccion_opcion === true,
      selectedOptionId: turn.opcion_id_seleccionada,
      newSession: turn.nueva_sesion === true,
      status: turn.status,
      channel: turn.channel,
      environment: turn.environment,
    };
  }

  private getErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const status = Reflect.get(error, 'status');
      if (typeof status === 'number' && status > 0) {
        return `No se pudieron cargar las conversaciones nuevas. HTTP ${status}.`;
      }
    }
    return 'No se pudieron cargar las conversaciones nuevas.';
  }
}
