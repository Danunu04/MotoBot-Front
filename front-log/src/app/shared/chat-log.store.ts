import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';

interface ChatLogApiItem {
  readonly timestamp: string;
  readonly session_id: string;
  readonly question: string;
  readonly answer: string;
  readonly channel?: string;
  readonly environment?: string;
}

interface ChatLogEnvelope {
  readonly ok: boolean;
  readonly source: string;
  readonly logs: readonly ChatLogApiItem[];
}

export interface ChatLogRow {
  readonly id: string;
  readonly rawTimestamp: string;
  readonly timestamp: string;
  readonly sessionId: string;
  readonly question: string;
  readonly answer: string;
  readonly channel: string;
  readonly environment: string;
}

@Injectable({
  providedIn: 'root',
})
export class ChatLogStore {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.chatlogApiUrl;
  private readonly hasLoaded = signal(false);

  readonly logs = signal<readonly ChatLogRow[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly sortedLogs = computed(() =>
    [...this.logs()].sort((left, right) => right.rawTimestamp.localeCompare(left.rawTimestamp)),
  );

  load(force = false, background = false): void {
    if (!force && (this.hasLoaded() || this.isLoading())) {
      return;
    }

    if (!background) {
      this.isLoading.set(true);
      this.errorMessage.set('');
    }

    this.http.get(this.apiUrl, { responseType: 'text' }).subscribe({
      next: (responseText) => {
        const response = this.parseResponse(responseText);

        if (!response) {
          if (!background) {
            this.errorMessage.set(
              environment.production
                ? 'El endpoint no devolvio un JSON valido.'
                : 'El backend local no devolvio un JSON valido en /chatlog.',
            );
            this.isLoading.set(false);
          }
          return;
        }

        const nextRows = this.buildRows(response.logs);

        if (this.hasLogChanges(nextRows)) {
          this.logs.set(nextRows);
        }

        this.hasLoaded.set(true);

        if (!background) {
          this.isLoading.set(false);
        }
      },
      error: (error: unknown) => {
        if (!background) {
          this.errorMessage.set(this.getErrorMessage(error));
          this.isLoading.set(false);
        }
      },
    });
  }

  reload(background = false): void {
    this.hasLoaded.set(false);
    this.load(true, background);
  }

  private buildRows(logs: readonly ChatLogApiItem[]): readonly ChatLogRow[] {
    return logs.map((log, index) => ({
            id: `${log.session_id}-${log.timestamp}-${index}`,
            rawTimestamp: log.timestamp,
            timestamp: this.formatTimestamp(log.timestamp),
            sessionId: log.session_id,
            question: log.question,
            answer: log.answer,
            channel: log.channel ?? 'sin canal',
            environment: log.environment ?? 'sin entorno',
          }));
  }

  private hasLogChanges(nextRows: readonly ChatLogRow[]): boolean {
    const currentRows = this.logs();

    if (currentRows.length !== nextRows.length) {
      return true;
    }

    return currentRows.some((currentRow, index) => {
      const nextRow = nextRows[index];

      return (
        currentRow.id !== nextRow.id ||
        currentRow.rawTimestamp !== nextRow.rawTimestamp ||
        currentRow.question !== nextRow.question ||
        currentRow.answer !== nextRow.answer
      );
    });
  }

  private formatTimestamp(timestamp: string): string {
    const parsedDate = new Date(timestamp);

    if (Number.isNaN(parsedDate.getTime())) {
      return timestamp;
    }

    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(parsedDate);
  }

  private parseResponse(responseText: string): ChatLogEnvelope | null {
    try {
      const parsed: unknown = JSON.parse(responseText);

      if (Array.isArray(parsed)) {
        return {
          ok: true,
          source: 'direct-json',
          logs: parsed as readonly ChatLogApiItem[],
        };
      }

      if (typeof parsed === 'object' && parsed !== null) {
        const logs = Reflect.get(parsed, 'logs');

        if (Array.isArray(logs)) {
          return parsed as ChatLogEnvelope;
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  private getErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const status = Reflect.get(error, 'status');

      if (typeof status === 'number' && status > 0) {
        return `No se pudieron cargar los logs. HTTP ${status}.`;
      }
    }

    return 'No se pudieron cargar los logs desde el endpoint.';
  }
}
