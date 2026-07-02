import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ResponderMensajeComponent } from './responder-mensaje-component';

describe('ResponderMensajeComponent', () => {
  let component: ResponderMensajeComponent;
  let fixture: ComponentFixture<ResponderMensajeComponent>;
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResponderMensajeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ sessionId: 'session-123' }),
            },
            paramMap: of(convertToParamMap({ sessionId: 'session-123' })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResponderMensajeComponent);
    component = fixture.componentInstance;
    httpTestingController = TestBed.inject(HttpTestingController);
    flushInitialRequests();
    await fixture.whenStable();
  });

  afterEach(() => {
    component.ngOnDestroy();
    httpTestingController.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should request human handoff through the bot endpoint', () => {
    component['requestHandoff']();

    const request = httpTestingController.expectOne('/api/bot/send');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      session_id: 'session-123',
      handoff: true,
    });

    request.flush({ ok: true, session_id: 'session-123' });
    httpTestingController.expectOne('/api/handoff/sessions').flush({
      sessions: [{ session_id: 'session-123' }],
    });
    httpTestingController.expectOne('https://formspree.io/f/xqegaraw').flush({});
    httpTestingController.expectOne('/api/chatlog').flush(
      JSON.stringify({
        ok: true,
        source: 'test',
        logs: [],
      }),
    );
  });

  it('should enable replies immediately after requesting handoff', () => {
    component['requestHandoff']();

    const request = httpTestingController.expectOne('/api/bot/send');
    request.flush({ ok: true, session_id: 'session-123' });

    expect(component['isPendingSession']()).toBe(true);
    expect(component['canSendMessages']()).toBe(true);

    httpTestingController.expectOne('/api/handoff/sessions').flush({
      sessions: [{ session_id: 'session-123' }],
    });
    httpTestingController.expectOne('https://formspree.io/f/xqegaraw').flush({});
    httpTestingController.expectOne('/api/chatlog').flush(
      JSON.stringify({
        ok: true,
        source: 'test',
        logs: [],
      }),
    );
  });

  function flushInitialRequests(): void {
    httpTestingController.expectOne('/api/chatlog').flush(
      JSON.stringify({
        ok: true,
        source: 'test',
        logs: [],
      }),
    );

    httpTestingController.expectOne('/api/handoff/sessions').flush({
      sessions: [],
    });
  }
});
