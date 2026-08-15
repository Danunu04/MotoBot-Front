import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatTurn } from '../../shared/chat-turns.store';
import { TurnoUsuario } from './turno-usuario';

const baseTurn: ChatTurn = {
  turnId: 'turn-user',
  sessionId: 'wa:hidden',
  timestamp: '2026-08-11T10:03:00+00:00',
  date: '2026-08-11',
  order: 1,
  type: 'respuesta_usuario',
  author: 'usuario',
  text: 'No me puedo registrar',
  options: [],
  listName: null,
  interactiveType: null,
  isOptionSelection: true,
  selectedOptionId: 'internal-option',
  newSession: false,
  status: null,
  channel: 'whatsapp',
  environment: 'cloud_run',
};

describe('TurnoUsuario', () => {
  let fixture: ComponentFixture<TurnoUsuario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TurnoUsuario] }).compileComponents();
    fixture = TestBed.createComponent(TurnoUsuario);
  });

  it('marks a tapped option without showing its internal identifier', () => {
    fixture.componentRef.setInput('turn', baseTurn);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('✓ Opción elegida');
    expect(text).toContain('No me puedo registrar');
    expect(text).not.toContain('internal-option');
  });

  it('shows free text as a regular user bubble', () => {
    fixture.componentRef.setInput('turn', {
      ...baseTurn,
      text: 'Lo cargué ayer.',
      isOptionSelection: false,
      selectedOptionId: null,
    });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Lo cargué ayer.');
    expect(text).not.toContain('Opción elegida');
  });
});
