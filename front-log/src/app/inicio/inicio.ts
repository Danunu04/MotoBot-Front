import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import {
  ChatTurnsStore,
  buildChatSessionChoices,
} from '../shared/chat-turns.store';
import { HistorialAnterior } from './historial-anterior/historial-anterior';
import { VisorTurnos } from './visor-turnos/visor-turnos';

type HistoryView = 'nuevas' | 'anterior';

@Component({
  selector: 'app-inicio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HistorialAnterior, VisorTurnos],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  private readonly chatTurnsStore = inject(ChatTurnsStore);

  protected readonly activeView = signal<HistoryView>('nuevas');
  protected readonly fromDate = signal(this.buildDefaultFromDate());
  protected readonly toDate = signal(this.buildDefaultToDate());
  protected readonly selectedSession = signal('');

  protected readonly turns = this.chatTurnsStore.turns;
  protected readonly turnCount = this.chatTurnsStore.count;
  protected readonly isLoading = this.chatTurnsStore.isLoading;
  protected readonly isCheckingAvailability = this.chatTurnsStore.isCheckingAvailability;
  protected readonly hasAnyTurns = this.chatTurnsStore.hasAnyTurns;
  protected readonly errorMessage = this.chatTurnsStore.errorMessage;

  protected readonly sessionChoices = computed(() =>
    buildChatSessionChoices(this.chatTurnsStore.catalogTurns()),
  );
  protected readonly conversationCount = computed(
    () => new Set(this.turns().map((turn) => turn.sessionId)).size,
  );
  protected readonly newSessionCount = computed(
    () => this.turns().filter((turn) => turn.newSession).length,
  );
  protected readonly dateRangeError = computed(() => {
    const from = this.fromDate();
    const to = this.toDate();
    if (!from && !to) return '';
    if (!from || !to) return 'Completá las dos fechas para filtrar por rango.';
    if (from > to) return 'La fecha de inicio no puede ser posterior a la fecha de fin.';

    const fromDate = new Date(`${from}T12:00:00`);
    const toDate = new Date(`${to}T12:00:00`);
    const inclusiveDays = Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
    return inclusiveDays > 90 ? 'El rango no puede superar los 90 días.' : '';
  });

  protected readonly showInitialEmpty = computed(
    () =>
      !this.isLoading() &&
      !this.isCheckingAvailability() &&
      !this.errorMessage() &&
      this.turns().length === 0 &&
      this.hasAnyTurns() === false,
  );
  protected readonly showFilteredEmpty = computed(
    () =>
      !this.isLoading() &&
      !this.isCheckingAvailability() &&
      !this.errorMessage() &&
      this.turns().length === 0 &&
      this.hasAnyTurns() === true,
  );

  constructor() {
    this.loadNewConversations();
  }

  protected selectView(view: HistoryView): void {
    this.activeView.set(view);
  }

  protected updateFromDate(value: string): void {
    this.fromDate.set(value);
  }

  protected updateToDate(value: string): void {
    this.toDate.set(value);
  }

  protected updateSelectedSession(value: string): void {
    this.selectedSession.set(value);
    this.loadNewConversations();
  }

  protected applyFilters(): void {
    if (!this.dateRangeError()) this.loadNewConversations();
  }

  protected clearNewFilters(): void {
    this.fromDate.set('');
    this.toDate.set('');
    this.selectedSession.set('');
    this.loadNewConversations();
  }

  private loadNewConversations(): void {
    const from = this.fromDate();
    const to = this.toDate();
    this.chatTurnsStore.load({
      ...(from && to ? { from, to } : {}),
      ...(this.selectedSession() ? { sessionId: this.selectedSession() } : {}),
    });
  }

  private buildDefaultFromDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  }

  private buildDefaultToDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}
