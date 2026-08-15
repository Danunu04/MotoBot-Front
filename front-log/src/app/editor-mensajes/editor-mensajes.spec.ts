import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BotMessagesService } from '../shared/bot-messages.service';
import {
  EDITOR_STORAGE_UNAVAILABLE_MESSAGE,
  EditorBlocksService,
} from '../shared/editor-blocks.service';
import { EditorMensajes } from './editor-mensajes';

describe('EditorMensajes', () => {
  let fixture: ComponentFixture<EditorMensajes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorMensajes],
      providers: [
        {
          provide: EditorBlocksService,
          useValue: {
            getBlocks: () =>
              of({
                blocks: [],
                storage: {
                  writable: false,
                  message: EDITOR_STORAGE_UNAVAILABLE_MESSAGE,
                },
              }),
            getFlowStates: () => of([]),
          },
        },
        {
          provide: BotMessagesService,
          useValue: { getMessages: () => of([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditorMensajes);
    fixture.detectChanges();
  });

  it('announces read-only mode as soon as the storage capability is loaded', () => {
    const element: HTMLElement = fixture.nativeElement;
    const warning = element.querySelector<HTMLElement>('.storage-warning');

    expect(warning).toBeTruthy();
    expect(warning?.textContent).toContain('Editor en modo lectura');
    expect(warning?.textContent).toContain(EDITOR_STORAGE_UNAVAILABLE_MESSAGE);
    expect(warning?.textContent).toContain('acciones de edición están deshabilitadas');
  });
});
