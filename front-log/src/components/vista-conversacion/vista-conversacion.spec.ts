import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorBlock } from '../../app/shared/editor-blocks.service';
import { VistaConversacion } from './vista-conversacion';

const conditionalBlock: EditorBlock = {
  block_id: 'borrado_final_internal',
  orden_recorrido: 2,
  grupo_recorrido: 'recorrido_principal',
  titulo: 'Confirmación del borrado',
  mensajes_previos: [
    {
      message_key: 'internal_intro_key',
      label: 'Introducción',
      content: 'Primero, revisá el menú.',
      limite_caracteres: 321,
    },
  ],
  prompt: {
    message_key: 'internal_prompt_key',
    label: 'Mensaje principal',
    content: 'Avisame cuando termines.',
    limite_caracteres: 321,
  },
  tiene_opciones: true,
  acepta_nuevas_opciones: false,
  limites_alta: {
    titulo_botones: 19,
    titulo_lista: 23,
    descripcion_lista: 70,
    respuesta: 321,
  },
  formato: 'botones',
  formato_motivo: '1 opción',
  presentacion: null,
  opciones: [
    {
      option_id: 'listo_internal',
      orden: 1,
      editable: false,
      sintetica: true,
      titulo: 'Ya lo hice',
      titulo_key: 'internal_title_key',
      titulo_limite_caracteres: 19,
      titulo_boton: 'Ya lo hice',
      titulo_boton_key: 'internal_title_key',
      titulo_boton_limite_caracteres: 19,
      descripcion: null,
      descripcion_key: null,
      descripcion_limite_caracteres: 70,
      respuesta: null,
      lleva_a: {
        es_condicional: true,
        label: 'Depende del recorrido que inició la persona',
        destinos_posibles: [
          {
            condicion: 'El recorrido comenzó en registro',
            valor: 'registro',
            state_id: 'EstadoBorrarNavegacion',
            block_id: 'borrar_resultado_registro',
            label: 'Resultado del borrado desde registro',
          },
          {
            condicion: 'El recorrido comenzó en el portal',
            valor: 'portal',
            state_id: 'EstadoBorrarNavegacion',
            block_id: 'borrar_resultado_portal',
            label: 'Resultado del borrado desde el portal',
          },
        ],
      },
    },
  ],
};

describe('VistaConversacion', () => {
  let fixture: ComponentFixture<VistaConversacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VistaConversacion],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(VistaConversacion);
    fixture.componentRef.setInput('block', conditionalBlock);
    fixture.componentRef.setInput('readonlyView', true);
    fixture.detectChanges();
  });

  it('shows the ordered sequence and the conditional route in business language', () => {
    const element: HTMLElement = fixture.nativeElement;
    const text = element.textContent ?? '';
    const numbers = [...element.querySelectorAll('.editable-message__number')].map(
      (node) => node.textContent?.trim(),
    );

    expect(numbers).toEqual(['1', '2']);
    expect(text).toContain('Primero, revisá el menú.');
    expect(text).toContain('Avisame cuando termines.');
    expect(text).toContain('Este botón lleva a distintos lugares');
    expect(text).toContain('Resultado del borrado desde registro');
    expect(text).not.toContain('EstadoBorrarNavegacion');
    expect(text).not.toContain('internal_');
    expect(
      [...element.querySelectorAll<HTMLButtonElement>('.editable-message__actions button')].every(
        (button) => button.disabled,
      ),
    ).toBeTruthy();
  });

  it('shows reply buttons directly below the recorded bot message', () => {
    fixture.componentRef.setInput('mode', 'historial');
    fixture.componentRef.setInput('historyTurn', {
      turnId: 'turn-buttons',
      text: 'Elegí una opción',
      timestamp: '2026-08-11T10:02:00+00:00',
      format: 'botones',
      listName: null,
      options: [
        { id: 'a', title: 'Primera', description: null },
        { id: 'b', title: 'Segunda', description: null },
      ],
    });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelectorAll('.conversation-option--history-button')).toHaveLength(2);
    expect(element.querySelector('.history-list-opener')).toBeNull();
  });

  it('shows a list opener and its expanded rows as a different experience', () => {
    fixture.componentRef.setInput('mode', 'historial');
    fixture.componentRef.setInput('historyTurn', {
      turnId: 'turn-list',
      text: '¿Cuándo lo completaste?',
      timestamp: '2026-08-11T10:03:00+00:00',
      format: 'lista',
      listName: 'Elegí cuándo',
      options: [
        { id: 'a', title: 'Hace menos de 48 horas', description: 'Todavía puede procesarse' },
        { id: 'b', title: 'Hace más de 48 horas', description: 'Te mostramos cómo seguir' },
      ],
    });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const text = element.textContent ?? '';

    expect(element.querySelector('.history-list-opener')).toBeTruthy();
    expect(element.querySelectorAll('.conversation-option--history-list')).toHaveLength(2);
    expect(text).toContain('Elegí cuándo');
    expect(text).toContain('Opciones desplegadas');
    expect(text).toContain('Todavía puede procesarse');
  });
});
