import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  EditorBlocksSnapshot,
  EditorBlocksService,
  EditorOptionCreateError,
} from './editor-blocks.service';

describe('EditorBlocksService', () => {
  let service: EditorBlocksService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EditorBlocksService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('reads the ordered block envelope', () => {
    let received: EditorBlocksSnapshot | null = null;
    service.getBlocks().subscribe((snapshot) => (received = snapshot));

    const request = httpTesting.expectOne('/api/editor/blocks');
    request.flush({
      ok: true,
      count: 0,
      blocks: [],
      storage: { writable: false, message: 'Base no disponible' },
    });

    expect(request.request.method).toBe('GET');
    expect(received).toEqual({
      blocks: [],
      storage: { writable: false, message: 'Base no disponible' },
    });
  });

  it('fails closed when an older backend omits the storage capability', () => {
    const received: EditorBlocksSnapshot[] = [];
    service.getBlocks().subscribe((snapshot) => received.push(snapshot));

    httpTesting.expectOne('/api/editor/blocks').flush({ ok: true, count: 0, blocks: [] });

    expect(received[0].storage.writable).toBeFalsy();
    expect(received[0].storage.message).toContain('base de datos');
  });

  it('deletes an option without exposing its identifiers in a body', () => {
    service.deleteOption('menu_principal', 'registro', 'operaciones').subscribe();

    const request = httpTesting.expectOne(
      (candidate) =>
        candidate.url === '/api/options/menu_principal/registro' &&
        candidate.params.get('updated_by') === 'operaciones',
    );
    expect(request.request.method).toBe('DELETE');
    request.flush({ ok: true });
  });

  it('preserves the backend message and field when composed creation fails', () => {
    let received: unknown;
    service
      .createOption('menu_principal', {
        titulo: 'Nueva',
        descripcion: null,
        respuesta: { modo: 'nuevo', contenido: 'Respuesta' },
        lleva_a: 'EstadoFinalizado',
        posicion: 1,
        permitir_cambio_a_lista: false,
        updated_by: '',
      })
      .subscribe({ error: (error: unknown) => (received = error) });

    httpTesting.expectOne('/api/editor/blocks/menu_principal/opciones').flush(
      {
        detail: {
          message: 'titulo excede 20 caracteres',
          field: 'titulo',
          code: 'validation_error',
        },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    expect(received).toBeInstanceOf(EditorOptionCreateError);
    expect(received).toMatchObject({
      message: 'titulo excede 20 caracteres',
      field: 'titulo',
      code: 'validation_error',
      status: 422,
    });
  });

  it('changes an option response through the composed block contract', () => {
    service
      .setOptionResponse(
        'menu principal',
        'ver precios',
        { modo: 'sin_respuesta' },
        'operaciones',
      )
      .subscribe();

    const request = httpTesting.expectOne(
      '/api/editor/blocks/menu%20principal/opciones/ver%20precios/respuesta',
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      respuesta: { modo: 'sin_respuesta' },
      updated_by: 'operaciones',
    });
    request.flush({ ok: true, block: {} });
  });
});
