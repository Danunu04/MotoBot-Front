import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatTurn } from '../../shared/chat-turns.store';
import { VisorTurnos } from './visor-turnos';

function turn(partial: Partial<ChatTurn>): ChatTurn {
  return {
    turnId: 'turn-default',
    sessionId: 'wa:hidden',
    timestamp: '2026-08-11T10:00:00+00:00',
    date: '2026-08-11',
    order: 0,
    type: 'mensaje',
    author: 'bot',
    text: 'Hola',
    options: [],
    listName: null,
    interactiveType: null,
    isOptionSelection: false,
    selectedOptionId: null,
    newSession: false,
    status: 'answered',
    channel: 'whatsapp',
    environment: 'cloud_run',
    ...partial,
  };
}

describe('VisorTurnos', () => {
  let fixture: ComponentFixture<VisorTurnos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisorTurnos],
      providers: [provideHttpClient()],
    }).compileComponents();
    fixture = TestBed.createComponent(VisorTurnos);
  });

  it('starts collapsed and expands the conversation from its header', () => {
    fixture.componentRef.setInput('sessionChoices', [
      {
        sessionId: 'wa:hidden',
        label: 'Conversación 1 · 11 ago 2026, 10:00',
        turnCount: 5,
        firstTimestamp: '2026-08-11T10:00:00+00:00',
      },
    ]);
    fixture.componentRef.setInput('turns', [
      turn({ turnId: 'message', newSession: true }),
      turn({
        turnId: 'buttons',
        order: 1,
        type: 'botones',
        options: [{ id: 'a', title: 'Sí', description: null }],
      }),
      turn({
        turnId: 'list',
        order: 2,
        type: 'lista',
        listName: 'Ver alternativas',
        options: [{ id: 'b', title: 'Alternativa', description: 'Detalle' }],
      }),
      turn({
        turnId: 'user',
        order: 3,
        type: 'respuesta_usuario',
        author: 'usuario',
        text: 'Sí',
        isOptionSelection: true,
      }),
      turn({
        turnId: 'system',
        order: 4,
        type: 'sistema',
        author: 'sistema',
        status: 'handoff_waiting',
      }),
    ]);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelectorAll('app-vista-conversacion')).toHaveLength(0);
    const conversationToggle = element.querySelector<HTMLButtonElement>(
      '.conversation-group__toggle',
    )!;
    expect(conversationToggle.getAttribute('aria-expanded')).toBe('false');
    conversationToggle.click();
    fixture.detectChanges();

    expect(element.querySelectorAll('app-vista-conversacion')).toHaveLength(3);
    expect(element.querySelector('app-turno-usuario')).toBeTruthy();
    expect(element.querySelector('app-turno-sistema')).toBeTruthy();
    expect(element.querySelector('app-separador-sesion')).toBeTruthy();
    expect(element.textContent).not.toContain('wa:hidden');
    expect(conversationToggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('expands and collapses every conversation with the global controls', () => {
    fixture.componentRef.setInput('sessionChoices', [
      {
        sessionId: 'wa:hidden',
        label: 'Conversación 1 · 11 ago 2026, 10:00',
        turnCount: 1,
        firstTimestamp: '2026-08-11T10:00:00+00:00',
      },
      {
        sessionId: 'wa:second',
        label: 'Conversación 2 · 10 ago 2026, 09:00',
        turnCount: 1,
        firstTimestamp: '2026-08-10T09:00:00+00:00',
      },
    ]);
    fixture.componentRef.setInput('turns', [
      turn({ turnId: 'first' }),
      turn({
        turnId: 'second',
        sessionId: 'wa:second',
        timestamp: '2026-08-10T09:00:00+00:00',
      }),
    ]);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const buttons = element.querySelectorAll<HTMLButtonElement>(
      '.conversation-controls__actions button',
    );
    expect(element.querySelectorAll('.conversation-group__chat')).toHaveLength(0);

    buttons[1].click();
    fixture.detectChanges();
    expect(element.querySelectorAll('.conversation-group__chat')).toHaveLength(2);

    buttons[0].click();
    fixture.detectChanges();
    expect(element.querySelectorAll('.conversation-group__chat')).toHaveLength(0);
  });
});
