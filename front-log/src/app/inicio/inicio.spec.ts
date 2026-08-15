import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Inicio } from './inicio';

const apiTurn = {
  turn_id: 'turn-1',
  session_id: 'wa:internal-session',
  timestamp: '2026-08-11T10:00:00+00:00',
  fecha: '2026-08-11',
  orden: 0,
  tipo: 'botones',
  autor: 'bot',
  texto: 'Elegí una opción',
  opciones: [{ id: 'internal-option', title: 'Continuar' }],
  nombre_lista: null,
  interactive_type: 'button',
  seleccion_opcion: null,
  opcion_id_seleccionada: null,
  nueva_sesion: true,
  status: 'answered',
  channel: 'whatsapp',
  environment: 'cloud_run',
} as const;

describe('Inicio', () => {
  let fixture: ComponentFixture<Inicio>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Inicio);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function initialRequest() {
    return http.expectOne(
      (request) => request.url === '/api/chatlog/turns' && request.params.has('from'),
    );
  }

  it('opens the new turn viewer by default with readable session labels', () => {
    initialRequest().flush({ ok: true, turns: [apiTurn], count: 1 });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain(
      'Conversaciones nuevas',
    );
    expect(element.textContent).toContain('Así se vio en WhatsApp');
    expect(element.textContent).toContain('Conversación 1');
    expect(element.textContent).not.toContain('internal-session');
  });

  it('explains an initially empty chat_turns and links to the legacy history', () => {
    initialRequest().flush({ ok: true, turns: [], count: 0 });
    http.expectOne('/api/chatlog/turns').flush({ ok: true, turns: [], count: 0 });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('Todavía no hay conversaciones registradas con el formato nuevo');
    const legacyLink = [...element.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Ir a Historial anterior'),
    );
    legacyLink?.click();
    fixture.detectChanges();
    http.expectOne('/api/chatlog').flush('[]');
    fixture.detectChanges();

    expect(element.textContent).toContain('Estas conversaciones se guardaron antes del nuevo registro');
  });

  it('uses a different empty state when data exists outside the selected range', () => {
    initialRequest().flush({ ok: true, turns: [], count: 0 });
    http.expectOne('/api/chatlog/turns').flush({ ok: true, turns: [apiTurn], count: 1 });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('No hay conversaciones para estos filtros');
    expect(text).toContain('Ver todas las conversaciones');
    expect(text).not.toContain('Todavía no hay conversaciones registradas');
  });

  it('sends the visible date range to the new endpoint', () => {
    initialRequest().flush({ ok: true, turns: [apiTurn], count: 1 });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const from = element.querySelector<HTMLInputElement>('#new-from')!;
    const to = element.querySelector<HTMLInputElement>('#new-to')!;
    from.value = '2026-08-01';
    from.dispatchEvent(new Event('input'));
    to.value = '2026-08-10';
    to.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    [...element.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Aplicar filtros'))
      ?.click();

    const request = http.expectOne(
      (candidate) => candidate.url === '/api/chatlog/turns' && candidate.params.get('from') === '2026-08-01',
    );
    expect(request.request.params.get('to')).toBe('2026-08-10');
    request.flush({ ok: true, turns: [apiTurn], count: 1 });
  });
});
