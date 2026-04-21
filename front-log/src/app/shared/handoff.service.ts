import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MailService } from './mail.service';
import { PendingAlertService } from './pending-alert.service';

interface HandoffSessionApiItem {
  readonly session_id: string;
  readonly user_name?: string;
  readonly last_user_message?: string;
  readonly last_user_message_at?: string;
}

interface HandoffSessionApiResponse {
  readonly sessions?: readonly HandoffSessionApiItem[];
}

export interface HandoffSession {
  readonly sessionId: string;
  readonly userName: string;
  readonly lastUserMessage: string;
  readonly lastUserMessageAt: string;
}

interface ResumeResponse {
  readonly ok: boolean;
  readonly human_handoff: boolean;
}

function isHandoffSessionApiResponse(
  response: HandoffSessionApiResponse | readonly HandoffSessionApiItem[],
): response is HandoffSessionApiResponse {
  return !Array.isArray(response);
}

@Injectable({
  providedIn: 'root',
})
export class HandoffService {
  private readonly http = inject(HttpClient);
  private readonly mailService = inject(MailService);
  private readonly pendingAlertService = inject(PendingAlertService);
  private readonly handoffSessionsApiUrl = environment.handoffSessionsApiUrl;
  private readonly agentSendApiUrl = environment.agentSendApiUrl;
  private readonly resumeApiUrl = environment.resumeApiUrl;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly notifiedSessionIds = new Set<string>();

  readonly sessions = signal<readonly HandoffSession[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly sessionIds = computed(() => new Set(this.sessions().map((session) => session.sessionId)));

  startPolling(): void {
    if (this.pollTimer) {
      return;
    }

    this.loadSessions();
    this.pollTimer = setInterval(() => this.loadSessions(), 5000);
  }

  stopPolling(): void {
    if (!this.pollTimer) {
      return;
    }

    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  loadSessions(): void {
    this.isLoading.set(true);
    const previousIds = new Set(this.sessionIds());

    this.http
      .get<HandoffSessionApiResponse | readonly HandoffSessionApiItem[]>(this.handoffSessionsApiUrl)
      .subscribe({
        next: (response) => {
          const sessions: readonly HandoffSessionApiItem[] = isHandoffSessionApiResponse(response)
            ? response.sessions ?? []
            : response;

          this.sessions.set(
            sessions.map((session: HandoffSessionApiItem) => ({
              sessionId: session.session_id,
              userName: session.user_name ?? 'Sin usuario',
              lastUserMessage: session.last_user_message ?? '',
              lastUserMessageAt: session.last_user_message_at ?? '',
            })),
          );
          this.notifyNewPendingSessions(previousIds);
          this.errorMessage.set('');
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('No se pudieron cargar las sesiones derivadas.');
          this.sessions.set([]);
          this.isLoading.set(false);
        },
      });
  }

  sendAgentMessage(sessionId: string, message: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(this.agentSendApiUrl, {
      session_id: sessionId,
      message,
    });
  }

  resumeSession(sessionId: string): Observable<ResumeResponse> {
    return this.http.post<ResumeResponse>(this.resumeApiUrl, { session_id: sessionId });
  }

  private notifyNewPendingSessions(previousIds: ReadonlySet<string>): void {
    const currentSessions = this.sessions();

    for (const session of currentSessions) {
      if (!previousIds.has(session.sessionId) && !this.notifiedSessionIds.has(session.sessionId)) {
        this.mailService.sendPendingNotification({
          sessionId: session.sessionId,
          userName: session.userName,
          lastUserMessage: session.lastUserMessage,
        });
        this.pendingAlertService.notifyNewPendingSession();
        this.notifiedSessionIds.add(session.sessionId);
      }
    }

    const currentIds = new Set(currentSessions.map((session) => session.sessionId));

    for (const notifiedId of [...this.notifiedSessionIds]) {
      if (!currentIds.has(notifiedId)) {
        this.notifiedSessionIds.delete(notifiedId);
      }
    }
  }
}
