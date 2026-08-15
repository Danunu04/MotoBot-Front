import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeparadorSesion } from './separador-sesion';

describe('SeparadorSesion', () => {
  let fixture: ComponentFixture<SeparadorSesion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SeparadorSesion] }).compileComponents();
    fixture = TestBed.createComponent(SeparadorSesion);
  });

  it('shows a readable date instead of the technical timestamp', () => {
    fixture.componentRef.setInput('date', '2026-08-11');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Nueva sesión');
    expect(text).toContain('11 de agosto de 2026');
    expect(text).not.toContain('2026-08-11');
  });
});
