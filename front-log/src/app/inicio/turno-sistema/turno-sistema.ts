import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { VistaConversacion, VistaConversacionHistoryTurn } from '../../../components/vista-conversacion/vista-conversacion';
import { ChatTurn } from '../../shared/chat-turns.store';

@Component({
  selector: 'app-turno-sistema',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VistaConversacion],
  templateUrl: './turno-sistema.html',
  styleUrl: './turno-sistema.css',
})
export class TurnoSistema {
  readonly turn = input.required<ChatTurn>();

  protected readonly deliveredMessage = computed(() =>
    this.turn().status === 'agente' || this.turn().status === 'bot_manual',
  );

  protected readonly historyTurn = computed<VistaConversacionHistoryTurn>(() => ({
    turnId: this.turn().turnId,
    text: this.turn().text,
    timestamp: this.turn().timestamp,
    format: 'mensaje',
    options: [],
    listName: null,
    originLabel:
      this.turn().status === 'agente'
        ? 'Enviado por una persona del equipo'
        : 'Enviado manualmente',
  }));

  protected noteText(): string {
    return this.turn().status === 'handoff_waiting'
      ? 'La conversación pasó a espera de atención.'
      : this.turn().text;
  }

  protected timeLabel(): string {
    const parsed = new Date(this.turn().timestamp);
    if (Number.isNaN(parsed.getTime())) return this.turn().timestamp;
    return new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  }
}
