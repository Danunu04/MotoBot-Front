import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import {
  VistaConversacion,
  VistaConversacionHistoryTurn,
} from '../../../components/vista-conversacion/vista-conversacion';
import { ChatSessionChoice, ChatTurn } from '../../shared/chat-turns.store';
import { SeparadorSesion } from '../separador-sesion/separador-sesion';
import { TurnoSistema } from '../turno-sistema/turno-sistema';
import { TurnoUsuario } from '../turno-usuario/turno-usuario';

interface ConversationGroup {
  readonly sessionId: string;
  readonly label: string;
  readonly turns: readonly ChatTurn[];
}

@Component({
  selector: 'app-visor-turnos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VistaConversacion, SeparadorSesion, TurnoSistema, TurnoUsuario],
  templateUrl: './visor-turnos.html',
  styleUrl: './visor-turnos.css',
})
export class VisorTurnos {
  readonly turns = input.required<readonly ChatTurn[]>();
  readonly sessionChoices = input.required<readonly ChatSessionChoice[]>();

  // Con volumen real, el resumen de cada conversación es más útil que abrirlas todas.
  // Un id solo entra en este conjunto cuando la persona decide expandirlo.
  private readonly expandedSessionIds = signal<ReadonlySet<string>>(new Set());

  protected readonly groups = computed<readonly ConversationGroup[]>(() => {
    const labels = new Map(
      this.sessionChoices().map((choice) => [choice.sessionId, choice.label] as const),
    );
    const grouped = new Map<string, ChatTurn[]>();
    for (const turn of this.turns()) {
      const sessionTurns = grouped.get(turn.sessionId) ?? [];
      sessionTurns.push(turn);
      grouped.set(turn.sessionId, sessionTurns);
    }

    return [...grouped.entries()]
      .map(([sessionId, sessionTurns]) => ({
        sessionId,
        label: labels.get(sessionId) ?? 'Conversación',
        turns: [...sessionTurns].sort((left, right) => left.order - right.order),
      }))
      .sort((left, right) => {
        const leftTimestamp = left.turns[0]?.timestamp ?? '';
        const rightTimestamp = right.turns[0]?.timestamp ?? '';
        return rightTimestamp.localeCompare(leftTimestamp);
      });
  });

  protected readonly allCollapsed = computed(() =>
    this.groups().every((group) => !this.expandedSessionIds().has(group.sessionId)),
  );
  protected readonly allExpanded = computed(() => {
    const groups = this.groups();
    return (
      groups.length > 0 &&
      groups.every((group) => this.expandedSessionIds().has(group.sessionId))
    );
  });

  protected isExpanded(sessionId: string): boolean {
    return this.expandedSessionIds().has(sessionId);
  }

  protected toggleConversation(sessionId: string): void {
    this.expandedSessionIds.update((current) => {
      const next = new Set(current);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  protected collapseAll(): void {
    this.expandedSessionIds.set(new Set());
  }

  protected expandAll(): void {
    this.expandedSessionIds.set(new Set(this.groups().map((group) => group.sessionId)));
  }

  protected isBotTurn(turn: ChatTurn): boolean {
    return turn.type === 'mensaje' || turn.type === 'botones' || turn.type === 'lista';
  }

  protected toHistoryTurn(turn: ChatTurn): VistaConversacionHistoryTurn {
    return {
      turnId: turn.turnId,
      text: turn.text,
      timestamp: turn.timestamp,
      format: turn.type === 'botones' || turn.type === 'lista' ? turn.type : 'mensaje',
      options: turn.options,
      listName: turn.listName,
    };
  }
}
