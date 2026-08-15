import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatTurn } from '../../shared/chat-turns.store';
import { TurnoSistema } from './turno-sistema';

function systemTurn(status: string, text: string): ChatTurn {
  return {
    turnId: `turn-${status}`,
    sessionId: 'wa:hidden',
    timestamp: '2026-08-11T10:06:00+00:00',
    date: '2026-08-11',
    order: 4,
    type: 'sistema',
    author: 'sistema',
    text,
    options: [],
    listName: null,
    interactiveType: null,
    isOptionSelection: false,
    selectedOptionId: null,
    newSession: false,
    status,
    channel: 'whatsapp',
    environment: 'cloud_run',
  };
}

describe('TurnoSistema', () => {
  let fixture: ComponentFixture<TurnoSistema>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TurnoSistema],
      providers: [provideHttpClient()],
    }).compileComponents();
    fixture = TestBed.createComponent(TurnoSistema);
  });

  it('renders handoff as an automatic centered note', () => {
    fixture.componentRef.setInput('turn', systemTurn('handoff_waiting', '[EN ESPERA DE AGENTE]'));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('.system-note')).toBeTruthy();
    expect(element.textContent).toContain('La conversación pasó a espera de atención.');
    expect(element.textContent).not.toContain('[EN ESPERA');
  });

  it('renders an agent message as a delivered bot-side bubble with its origin', () => {
    fixture.componentRef.setInput('turn', systemTurn('agente', 'Te ayudo con tu consulta.'));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('.history-bot-turn')).toBeTruthy();
    expect(element.textContent).toContain('Enviado por una persona del equipo');
    expect(element.textContent).toContain('Te ayudo con tu consulta.');
  });

  it('marks manual bot messages separately from agent messages', () => {
    fixture.componentRef.setInput('turn', systemTurn('bot_manual', 'Revisá nuevamente, por favor.'));
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Enviado manualmente');
    expect(text).not.toContain('persona del equipo');
  });
});
