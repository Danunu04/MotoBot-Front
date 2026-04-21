import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  TablaColumn,
  TablaComponent,
  TablaRow,
} from '../../components/tabla-component/tabla-component';
import { ChatLogStore, ChatLogRow } from '../shared/chat-log.store';
import { HandoffService, HandoffSession } from '../shared/handoff.service';

interface PendingMessageRow {
  readonly id: string;
  readonly sessionId: string;
  readonly chat: string;
  readonly usuario: string;
  readonly mensaje: string;
  readonly fecha: string;
  readonly estado: string;
}

@Component({
  selector: 'app-mensajes-pendientes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TablaComponent],
  templateUrl: './mensajes-pendientes.html',
  styleUrl: './mensajes-pendientes.css',
})
export class MensajesPendientes {
  private readonly chatLogStore = inject(ChatLogStore);
  private readonly handoffService = inject(HandoffService);
  private readonly router = inject(Router);

  protected readonly tableColumns: readonly TablaColumn[] = [
    { key: 'chat', label: 'Chat', emphasis: true },
    { key: 'usuario', label: 'Usuario' },
    { key: 'mensaje', label: 'Mensaje' },
    { key: 'fecha', label: 'Fecha' },
    { key: 'estado', label: 'Estado', align: 'center' },
  ];

  protected readonly isLoading = this.chatLogStore.isLoading;
  protected readonly errorMessage = this.chatLogStore.errorMessage;
  protected readonly pendingMessages = computed(() =>
    this.buildSessionRows(this.chatLogStore.sortedLogs(), this.handoffService.sessions()),
  );
  protected readonly tableRows = computed<readonly TablaRow[]>(() =>
    this.pendingMessages().map((message) => ({
      id: message.sessionId,
      values: {
        chat: message.chat,
        usuario: message.usuario,
        mensaje: message.mensaje,
        fecha: message.fecha,
        estado: message.estado,
      },
    })),
  );

  protected readonly totalPendientes = computed(
    () => this.pendingMessages().filter((message) => message.estado === 'Pendiente').length,
  );
  protected readonly totalRespondidas = computed(
    () => this.pendingMessages().filter((message) => message.estado === 'Respondido').length,
  );

  constructor() {
    this.chatLogStore.load();
    this.handoffService.startPolling();
  }

  ngOnDestroy(): void {
    this.handoffService.stopPolling();
  }

  protected openConversation(sessionId: string): void {
    void this.router.navigate(['/mensajes-pendientes', sessionId]);
  }

  private buildSessionRows(
    logs: readonly ChatLogRow[],
    handoffSessions: readonly HandoffSession[],
  ): readonly PendingMessageRow[] {
    const sessions = new Map<string, ChatLogRow[]>();
    const handoffSessionsById = new Map(
      handoffSessions.map((session) => [session.sessionId, session] as const),
    );

    for (const log of logs) {
      const sessionLogs = sessions.get(log.sessionId) ?? [];
      sessionLogs.push(log);
      sessions.set(log.sessionId, sessionLogs);
    }

    for (const handoffSession of handoffSessions) {
      if (!sessions.has(handoffSession.sessionId)) {
        sessions.set(handoffSession.sessionId, []);
      }
    }

    return [...sessions.entries()].map(([sessionId, sessionLogs], index) => {
      const orderedLogs = [...sessionLogs].sort((left, right) =>
        right.rawTimestamp.localeCompare(left.rawTimestamp),
      );
      const latestLog = orderedLogs[0];
      const handoffSession = handoffSessionsById.get(sessionId);
      const usuario = handoffSession?.userName
        ? handoffSession.userName
        : latestLog
          ? this.getUsuario(latestLog.question)
          : 'Sin usuario';
      const mensaje = handoffSession?.lastUserMessage || latestLog?.question || 'Sin mensajes';
      const fecha = handoffSession?.lastUserMessageAt
        ? this.formatTimestamp(handoffSession.lastUserMessageAt)
        : latestLog?.timestamp || 'Sin fecha';

      return {
        id: `${sessionId}-${index}`,
        sessionId,
        chat: sessionId,
        usuario,
        mensaje,
        fecha,
        estado: handoffSession ? 'Pendiente' : 'Respondido',
      };
    });
  }

  private getUsuario(question: string): string {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      return 'Sin usuario';
    }

    return trimmedQuestion.split(' ').slice(0, 2).join(' ');
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
}
