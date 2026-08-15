import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CopiarTextoMensaje } from './copiar-texto-mensaje';

describe('CopiarTextoMensaje', () => {
  let fixture: ComponentFixture<CopiarTextoMensaje>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CopiarTextoMensaje] }).compileComponents();
    fixture = TestBed.createComponent(CopiarTextoMensaje);
    fixture.componentRef.setInput('messages', [
      {
        message_key: 'internal_key_not_visible',
        label: 'Ayuda con garantías',
        content: 'Te contamos cómo funciona la garantía.',
      },
    ]);
    fixture.detectChanges();
  });

  it('shows readable content, never the key, and emits only copied text', () => {
    const copied: string[] = [];
    fixture.componentInstance.textCopied.subscribe((content) => copied.push(content));

    button('Copiar texto de otro mensaje').click();
    fixture.detectChanges();

    expect(host().textContent).toContain('Ayuda con garantías');
    expect(host().textContent).toContain('Te contamos cómo funciona la garantía.');
    expect(host().textContent).not.toContain('internal_key_not_visible');
    button('Ayuda con garantías').click();
    fixture.detectChanges();

    expect(copied).toEqual(['Te contamos cómo funciona la garantía.']);
    expect(host().textContent).toContain('No crea un vínculo');
    expect(host().textContent).toContain('Podés ajustarlo antes de guardar');
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(text: string): HTMLButtonElement {
    return [...host().querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      candidate.textContent?.includes(text),
    )!;
  }
});
