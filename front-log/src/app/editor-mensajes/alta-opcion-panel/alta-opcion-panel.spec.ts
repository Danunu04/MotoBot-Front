import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DestinationChoice, EditorBlock } from '../../shared/editor-blocks.service';
import { AltaOpcionPanel } from './alta-opcion-panel';

const option = (index: number) => ({
  option_id: `option_${index}`,
  orden: index,
  editable: true,
  sintetica: false,
  titulo: `Opción ${index}`,
  titulo_key: `title_${index}`,
  titulo_limite_caracteres: 23,
  titulo_boton: `Opción ${index}`,
  titulo_boton_key: `title_${index}`,
  titulo_boton_limite_caracteres: 19,
  descripcion: null,
  descripcion_key: null,
  descripcion_limite_caracteres: 67,
  respuesta: null,
  lleva_a: null,
});

const threeOptionBlock: EditorBlock = {
  block_id: 'internal_group',
  orden_recorrido: 1,
  grupo_recorrido: 'recorrido_principal',
  titulo: 'Consulta adicional',
  mensajes_previos: [],
  prompt: {
    message_key: 'prompt_internal',
    label: 'Pregunta',
    content: '¿Necesitás algo más?',
    limite_caracteres: 987,
  },
  tiene_opciones: true,
  acepta_nuevas_opciones: true,
  limites_alta: {
    titulo_botones: 19,
    titulo_lista: 23,
    descripcion_lista: 67,
    respuesta: 987,
  },
  formato: 'botones',
  formato_motivo: '3 opciones',
  presentacion: {
    texto_boton: 'Ver opciones',
    texto_boton_key: 'button_internal',
    texto_boton_limite_caracteres: 19,
    titulo_seccion: 'Opciones',
    titulo_seccion_key: 'section_internal',
    titulo_seccion_limite_caracteres: 23,
  },
  opciones: [option(1), option(2), option(3)],
};

const destinations: readonly DestinationChoice[] = [
  { state_id: 'EstadoFinalizado', block_id: 'finalizado', label: 'Cierre de la conversación' },
  {
    state_id: 'EstadoPreFlujo',
    block_id: 'preflujo_desde_registro',
    label: 'Mensaje de espera para registro',
  },
  {
    state_id: 'EstadoPreFlujo',
    block_id: 'preflujo_desde_precios',
    label: 'Mensaje de espera para consultar precios',
  },
];

describe('AltaOpcionPanel', () => {
  let fixture: ComponentFixture<AltaOpcionPanel>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AltaOpcionPanel],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AltaOpcionPanel);
    fixture.componentRef.setInput('block', threeOptionBlock);
    fixture.componentRef.setInput('responses', []);
    fixture.componentRef.setInput('destinations', destinations);
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for a description and explains the fourth-option format change', () => {
    const element: HTMLElement = fixture.nativeElement;
    const text = element.textContent ?? '';
    const title = element.querySelector<HTMLInputElement>('input[formControlName="title"]');
    const buttonTitle = element.querySelector<HTMLInputElement>(
      'input[formControlName="buttonTitle"]',
    );
    const description = element.querySelector<HTMLTextAreaElement>(
      'textarea[formControlName="description"]',
    );

    expect(title?.maxLength).toBe(23);
    expect(buttonTitle?.maxLength).toBe(19);
    expect(description?.maxLength).toBe(67);
    expect(text).toContain('WhatsApp ya no muestra botones sueltos');
    expect(text).toContain('No se recorta nada');
    expect(text).toContain('Descripción');
  });

  it('marks every missing field and focuses the first one', async () => {
    host().querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    fixture.detectChanges();
    await new Promise((resolve) => globalThis.setTimeout(resolve));

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('.field--invalid').length).toBe(5);
    expect(element.textContent).toContain('Escribí el texto de la opción.');
    expect(element.textContent).toContain('Escribí la descripción');
    expect(element.textContent).toContain('Escribí el texto que se usará como botón.');
    expect(element.textContent).toContain('Escribí qué responderá el bot.');
    expect(element.textContent).toContain('Elegí a dónde lleva la opción.');
    expect(document.activeElement?.getAttribute('data-control')).toBe('title');
  });

  it('filters the independent waiting blocks without showing the obsolete warning', () => {
    const search = host().querySelector<HTMLInputElement>('#destination-search')!;
    search.dispatchEvent(new Event('focus'));
    search.value = 'espera';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const results = host().querySelectorAll<HTMLButtonElement>(
      '.destination-results button',
    );
    expect(results.length).toBe(2);
    expect(results[0].textContent).toContain('Mensaje de espera para registro');
    results[0].click();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).not.toContain('necesita una configuración adicional');
    expect(text).not.toContain('la conversación se deriva a una persona del equipo');
  });

  it('sends the composed payload and shows a backend field error on its control', () => {
    setInput('title', 'Garantías');
    setInput('buttonTitle', 'Garantías');
    setTextarea('description', 'Cobertura y plazos');
    setTextarea('newResponse', 'Te contamos cómo funciona la garantía.');
    chooseDestination('Cierre');

    host().querySelector<HTMLButtonElement>('button[type="submit"]')?.click();

    const request = http.expectOne('/api/editor/blocks/internal_group/opciones');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      titulo: 'Garantías',
      titulo_boton: 'Garantías',
      descripcion: 'Cobertura y plazos',
      respuesta: { modo: 'nuevo', contenido: 'Te contamos cómo funciona la garantía.' },
      lleva_a: { state_id: 'EstadoFinalizado', block_id: 'finalizado' },
      posicion: 4,
      permitir_cambio_a_lista: true,
      updated_by: '',
    });
    request.flush(
      {
        detail: {
          message: 'titulo ya existe en este bloque',
          field: 'titulo',
          code: 'validation_error',
        },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();

    const titleField = host()
      .querySelector<HTMLInputElement>('[data-control="title"]')
      ?.closest('.field');
    expect(titleField?.classList.contains('field--invalid')).toBe(true);
    expect(titleField?.textContent).toContain('titulo ya existe en este bloque');
    expect(fixture.nativeElement.textContent).toContain('titulo ya existe en este bloque');
  });

  it('copies readable catalog text into a new private response', () => {
    fixture.componentRef.setInput('responses', [
      {
        message_key: 'source_internal_key',
        label: 'Ayuda con garantías',
        content: 'Texto copiado para ajustar.',
      },
    ]);
    fixture.detectChanges();

    expect(host().textContent).not.toContain('Usar una respuesta existente');
    expect(host().querySelectorAll('input[formControlName="responseMode"]').length).toBe(2);
    button('Copiar texto de otro mensaje').click();
    fixture.detectChanges();
    expect(host().textContent).toContain('Ayuda con garantías');
    expect(host().textContent).not.toContain('source_internal_key');
    button('Ayuda con garantías').click();
    fixture.detectChanges();
    expect(
      host().querySelector<HTMLTextAreaElement>('textarea[formControlName="newResponse"]')?.value,
    ).toBe('Texto copiado para ajustar.');

    setInput('title', 'Garantías');
    setInput('buttonTitle', 'Garantías');
    setTextarea('description', 'Cobertura y plazos');
    setTextarea('newResponse', 'Texto copiado y ajustado.');
    chooseDestination('Cierre');
    button('Guardar opción completa').click();

    const request = http.expectOne('/api/editor/blocks/internal_group/opciones');
    expect(request.request.body.respuesta).toEqual({
      modo: 'nuevo',
      contenido: 'Texto copiado y ajustado.',
    });
    expect(JSON.stringify(request.request.body)).not.toContain('source_internal_key');
    request.flush({ ok: true, block: threeOptionBlock });
  });

  it('can create an option without an additional bot response', () => {
    setInput('title', 'Continuar con ayuda');
    setInput('buttonTitle', 'Continuar');
    setTextarea('description', 'Pasar al siguiente momento');
    chooseRadio('responseMode', 'sin_respuesta');
    chooseDestination('Cierre');

    host().querySelector<HTMLButtonElement>('button[type="submit"]')?.click();

    const request = http.expectOne('/api/editor/blocks/internal_group/opciones');
    expect(request.request.body.respuesta).toEqual({ modo: 'sin_respuesta' });
    expect(request.request.body.titulo_boton).toBe('Continuar');
    request.flush({ ok: true, block: threeOptionBlock });
  });

  function setInput(control: string, value: string): void {
    const input = host().querySelector<HTMLInputElement>(
      `input[formControlName="${control}"]`,
    )!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function setTextarea(control: string, value: string): void {
    const textarea = host().querySelector<HTMLTextAreaElement>(
      `textarea[formControlName="${control}"]`,
    )!;
    textarea.value = value;
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function chooseRadio(control: string, value: string): void {
    const input = host().querySelector<HTMLInputElement>(
      `input[formControlName="${control}"][value="${value}"]`,
    )!;
    input.click();
    fixture.detectChanges();
  }

  function chooseDestination(searchText: string): void {
    const search = host().querySelector<HTMLInputElement>('#destination-search')!;
    search.dispatchEvent(new Event('focus'));
    search.value = searchText;
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    host().querySelector<HTMLButtonElement>('.destination-results button')?.click();
    fixture.detectChanges();
  }

  function button(text: string): HTMLButtonElement {
    return [...host().querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      candidate.textContent?.includes(text),
    )!;
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }
});
