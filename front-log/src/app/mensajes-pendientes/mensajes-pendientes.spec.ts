import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { MensajesPendientes } from './mensajes-pendientes';

describe('MensajesPendientes', () => {
  let component: MensajesPendientes;
  let fixture: ComponentFixture<MensajesPendientes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MensajesPendientes],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MensajesPendientes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
