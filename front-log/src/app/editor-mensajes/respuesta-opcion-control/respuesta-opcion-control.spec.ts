import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorOption } from '../../shared/editor-blocks.service';
import { RespuestaOpcionControl } from './respuesta-opcion-control';

const option = (withResponse: boolean): EditorOption => ({
  option_id: 'continuar',
  orden: 10,
  editable: true,
  sintetica: false,
  titulo: 'Continuar',
  titulo_key: 'continuar_title',
  titulo_limite_caracteres: 20,
  titulo_boton: 'Continuar',
  titulo_boton_key: 'continuar_title',
  titulo_boton_limite_caracteres: 20,
  descripcion: null,
  descripcion_key: null,
  descripcion_limite_caracteres: 72,
  respuesta: withResponse
    ? {
        message_key: 'continuar_reply',
        label: 'Respuesta actual',
        content: 'Este es el mensaje que se va a descartar.',
        limite_caracteres: 2000,
      }
    : null,
  lleva_a: null,
});

describe('RespuestaOpcionControl', () => {
  let fixture: ComponentFixture<RespuestaOpcionControl>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RespuestaOpcionControl],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('confirms activation before showing the form and saves a new reply', () => {
    create(option(false));
    expect(host().textContent).toContain(
      'Después de esta elección, el bot no envía un mensaje adicional.',
    );

    switchButton().click();
    fixture.detectChanges();
    expect(host().textContent).toContain('El bot va a enviar un mensaje adicional');
    expect(host().querySelector('textarea')).toBeNull();

    button('Sí, agregar respuesta').click();
    fixture.detectChanges();
    button('Copiar texto de otro mensaje').click();
    fixture.detectChanges();
    expect(host().textContent).not.toContain('source_internal_key');
    button('Mensaje para copiar').click();
    fixture.detectChanges();
    const textarea = host().querySelector<HTMLTextAreaElement>('textarea')!;
    expect(textarea.value).toBe('Respuesta copiada e independiente.');
    button('Guardar respuesta').click();

    const request = http.expectOne(
      '/api/editor/blocks/demo/opciones/continuar/respuesta',
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.respuesta).toEqual({
      modo: 'nuevo',
      contenido: 'Respuesta copiada e independiente.',
    });
    request.flush({ ok: true, block: { opciones: [] } });
  });

  it('shows the current content and requires confirmation before removing it', () => {
    create(option(true));
    switchButton().click();
    fixture.detectChanges();

    expect(host().textContent).toContain('El texto actual se va a descartar.');
    expect(host().querySelector('blockquote')?.textContent).toContain(
      'Este es el mensaje que se va a descartar.',
    );
    button('Cancelar').click();
    fixture.detectChanges();
    http.expectNone('/api/editor/blocks/demo/opciones/continuar/respuesta');

    switchButton().click();
    fixture.detectChanges();
    button('Sí, quitar respuesta').click();
    const request = http.expectOne(
      '/api/editor/blocks/demo/opciones/continuar/respuesta',
    );
    expect(request.request.body.respuesta).toEqual({ modo: 'sin_respuesta' });
    request.flush({ ok: true, block: { opciones: [] } });
  });

  it('copies catalog text into an existing response editor without linking its key', () => {
    create(option(true));
    button('Editar').click();
    fixture.detectChanges();
    button('Copiar texto de otro mensaje').click();
    fixture.detectChanges();
    button('Mensaje para copiar').click();
    fixture.detectChanges();

    const textarea = host().querySelector<HTMLTextAreaElement>('textarea')!;
    expect(textarea.value).toBe('Respuesta copiada e independiente.');
    button('Guardar').click();

    const request = http.expectOne('/api/messages/continuar_reply');
    expect(request.request.body).toEqual({
      content: 'Respuesta copiada e independiente.',
      updated_by: '',
    });
    expect(JSON.stringify(request.request.body)).not.toContain('source_internal_key');
    request.flush({ ok: true });
  });

  function create(value: EditorOption): void {
    fixture = TestBed.createComponent(RespuestaOpcionControl);
    fixture.componentRef.setInput('option', value);
    fixture.componentRef.setInput('blockId', 'demo');
    fixture.componentRef.setInput('responses', [
      {
        message_key: 'source_internal_key',
        label: 'Mensaje para copiar',
        content: 'Respuesta copiada e independiente.',
      },
    ]);
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function switchButton(): HTMLButtonElement {
    return host().querySelector<HTMLButtonElement>('[role="switch"]')!;
  }

  function button(text: string): HTMLButtonElement {
    return [...host().querySelectorAll<HTMLButtonElement>('button')].find((item) =>
      item.textContent?.includes(text),
    )!;
  }
});
