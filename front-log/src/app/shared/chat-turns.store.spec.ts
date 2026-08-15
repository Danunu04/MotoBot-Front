import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ChatTurnsStore, buildChatSessionChoices } from './chat-turns.store';

const apiTurn = {
  turn_id: 'turn-1',
  session_id: 'wa:internal-session',
  timestamp: '2026-08-11T13:05:00+00:00',
  fecha: '2026-08-11',
  orden: 3,
  tipo: 'lista',
  autor: 'bot',
  texto: 'Elegí una alternativa',
  opciones: [
    { id: 'first-internal', title: 'Primera opción', description: 'Detalle visible' },
  ],
  nombre_lista: 'Ver alternativas',
  interactive_type: 'list',
  seleccion_opcion: null,
  opcion_id_seleccionada: null,
  nueva_sesion: true,
  status: 'answered',
  channel: 'whatsapp',
  environment: 'cloud_run',
} as const;

describe('ChatTurnsStore', () => {
  let store: ChatTurnsStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(ChatTurnsStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses the new envelope, server filters and parsed options', () => {
    store.load({ sessionId: 'wa:internal-session', from: '2026-08-10', to: '2026-08-12' });

    const request = http.expectOne((candidate) => candidate.url === '/api/chatlog/turns');
    expect(request.request.params.get('session_id')).toBe('wa:internal-session');
    expect(request.request.params.get('from')).toBe('2026-08-10');
    expect(request.request.params.get('to')).toBe('2026-08-12');
    request.flush({ ok: true, turns: [apiTurn], count: 1 });

    expect(store.turns()[0]).toMatchObject({
      type: 'lista',
      listName: 'Ver alternativas',
      newSession: true,
      options: [{ title: 'Primera opción', description: 'Detalle visible' }],
    });
    expect(store.hasAnyTurns()).toBe(true);
  });

  it('probes the unfiltered history to distinguish an initial empty store', () => {
    store.load({ from: '2026-08-10', to: '2026-08-12' });
    http.expectOne((candidate) => candidate.url === '/api/chatlog/turns' && candidate.params.has('from'))
      .flush({ ok: true, turns: [], count: 0 });
    http.expectOne('/api/chatlog/turns').flush({ ok: true, turns: [], count: 0 });

    expect(store.hasAnyTurns()).toBe(false);
    expect(store.isCheckingAvailability()).toBe(false);
  });

  it('distinguishes an empty filter result when turns exist elsewhere', () => {
    store.load({ from: '2026-08-10', to: '2026-08-12' });
    http.expectOne((candidate) => candidate.url === '/api/chatlog/turns' && candidate.params.has('from'))
      .flush({ ok: true, turns: [], count: 0 });
    http.expectOne('/api/chatlog/turns').flush({ ok: true, turns: [apiTurn], count: 1 });

    expect(store.hasAnyTurns()).toBe(true);
    expect(store.turns()).toEqual([]);
  });

  it('builds readable conversation labels without exposing the session identifier', () => {
    store.load();
    http.expectOne('/api/chatlog/turns').flush({ ok: true, turns: [apiTurn], count: 1 });

    const choices = buildChatSessionChoices(store.turns());
    expect(choices[0].label).toContain('Conversación 1');
    expect(choices[0].label).not.toContain('wa:');
    expect(choices[0].label).not.toContain('internal-session');
  });
});
