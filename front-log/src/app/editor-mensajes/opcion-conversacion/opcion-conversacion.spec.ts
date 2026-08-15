import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OpcionConversacion } from './opcion-conversacion';

describe('OpcionConversacion', () => {
  let fixture: ComponentFixture<OpcionConversacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OpcionConversacion],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(OpcionConversacion);
    fixture.componentRef.setInput('blockId', 'internal_group');
    fixture.componentRef.setInput('blockFormat', 'lista');
    fixture.componentRef.setInput('totalOptions', 4);
    fixture.componentRef.setInput('option', {
      option_id: 'internal_option',
      orden: 1,
      editable: true,
      sintetica: false,
      titulo: 'Ver garantías',
      titulo_key: 'internal_title',
      titulo_limite_caracteres: 24,
      titulo_boton: 'Ver garantías',
      titulo_boton_key: 'internal_button_title',
      titulo_boton_limite_caracteres: 20,
      descripcion: 'Cobertura y plazos',
      descripcion_key: 'internal_description',
      descripcion_limite_caracteres: 72,
      respuesta: null,
      lleva_a: null,
    });
    fixture.detectChanges();
  });

  it('explains the visible change before a list shrinks back to buttons', () => {
    const element: HTMLElement = fixture.nativeElement;
    [...element.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'Eliminar')
      ?.click();
    fixture.detectChanges();

    expect(element.textContent).toContain('Al quedar 3 opciones');
    expect(element.textContent).toContain('vuelve a presentar las opciones como botones sueltos');
  });

  it('keeps mutation controls visible but disabled in read-only mode', () => {
    fixture.componentRef.setInput('readonlyView', true);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const actions = [...element.querySelectorAll<HTMLButtonElement>('.conversation-option__actions button')];

    expect(actions.map((button) => button.textContent?.trim())).toEqual([
      'Editar opción',
      'Eliminar',
    ]);
    expect(actions.every((button) => button.disabled)).toBeTruthy();
  });
});
