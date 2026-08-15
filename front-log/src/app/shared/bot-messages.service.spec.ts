import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { BotMessageType, BotMessagesService } from './bot-messages.service';
import {
  EDITOR_STORAGE_UNAVAILABLE_MESSAGE,
  EditorStorageState,
} from './editor-storage-state.service';

describe('BotMessagesService', () => {
  let service: BotMessagesService;
  let httpTesting: HttpTestingController;
  let storageState: EditorStorageState;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BotMessagesService);
    httpTesting = TestBed.inject(HttpTestingController);
    storageState = TestBed.inject(EditorStorageState);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('preserves every backend message type without filtering or renaming', () => {
    const types: readonly BotMessageType[] = [
      'text',
      'button',
      'button_text',
      'list_row_title',
      'list_row_description',
      'list_section_title',
    ];
    let receivedTypes: readonly BotMessageType[] = [];

    service.getMessages().subscribe((messages) => {
      receivedTypes = messages.map((message) => message.type);
    });

    const request = httpTesting.expectOne('/api/messages');
    request.flush({
      ok: true,
      messages: types.map((messageType, index) => ({
        message_key: `message_${index}`,
        message_type: messageType,
        state_name: null,
        flujo_identificacion_mensaje: null,
        label: `Mensaje ${index}`,
        content: `Contenido ${index}`,
        default_content: `Contenido ${index}`,
        orden: index * 10,
      })),
    });

    expect(receivedTypes).toEqual(types);
  });

  it('restores a message through the backend reset endpoint', () => {
    service.resetMessage('welcome_message', 'operaciones').subscribe();

    const request = httpTesting.expectOne('/api/messages/welcome_message/reset');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ updated_by: 'operaciones' });
    request.flush({ ok: true });
  });

  it('switches the whole editor to read-only when a save gets storage_unavailable', () => {
    service.updateMessage('welcome_message', 'Hola', 'operaciones').subscribe({ error: () => undefined });

    httpTesting.expectOne('/api/messages/welcome_message').flush(
      {
        detail: {
          message: EDITOR_STORAGE_UNAVAILABLE_MESSAGE,
          field: null,
          code: 'storage_unavailable',
        },
      },
      { status: 503, statusText: 'Service Unavailable' },
    );

    expect(storageState.status()).toEqual({
      writable: false,
      message: EDITOR_STORAGE_UNAVAILABLE_MESSAGE,
    });
  });
});
