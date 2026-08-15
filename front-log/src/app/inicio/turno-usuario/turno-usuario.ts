import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ChatTurn } from '../../shared/chat-turns.store';

@Component({
  selector: 'app-turno-usuario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './turno-usuario.html',
  styleUrl: './turno-usuario.css',
})
export class TurnoUsuario {
  readonly turn = input.required<ChatTurn>();

  protected timeLabel(): string {
    const parsed = new Date(this.turn().timestamp);
    if (Number.isNaN(parsed.getTime())) return this.turn().timestamp;
    return new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  }
}
