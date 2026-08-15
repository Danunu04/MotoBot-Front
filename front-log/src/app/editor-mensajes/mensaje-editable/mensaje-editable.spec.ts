import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MensajeEditable } from './mensaje-editable';

describe('MensajeEditable', () => {
  let fixture: ComponentFixture<MensajeEditable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MensajeEditable],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(MensajeEditable);
    fixture.componentRef.setInput('message', {
      message_key: 'shared_internal_key',
      label: 'Paso compartido',
      content: 'Contenido compartido',
      limite_caracteres: 432,
      compartido: true,
      compartido_con: [
        { block_id: 'other_internal_block', titulo: 'Pasos para formulario' },
      ],
    });
    fixture.detectChanges();
  });

  it('warns with the other readable block name before allowing editing', () => {
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();

    expect(element.textContent).toContain('también se usa en:');
    expect(element.textContent).toContain('Pasos para formulario');
    expect(element.textContent).not.toContain('other_internal_block');
    expect(element.querySelector('textarea')).toBeNull();

    [...element.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Editar de todos modos'))
      ?.click();
    fixture.detectChanges();
    expect(element.querySelector('textarea')).not.toBeNull();
  });
});
