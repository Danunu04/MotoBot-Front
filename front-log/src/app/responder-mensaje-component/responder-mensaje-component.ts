import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Location } from '@angular/common';
import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../environments/environment';
import { ChatLogRow, ChatLogStore } from '../shared/chat-log.store';
import { HandoffService } from '../shared/handoff.service';

interface ConversationMessage {
  readonly id: string;
  readonly text: string;
  readonly timestamp: string;
  readonly author: 'cliente' | 'agente';
  readonly source: 'historico' | 'local';
}

interface ChatResponse {
  readonly ok?: boolean;
  readonly session_id?: string;
  readonly answer?: string;
  readonly took_ms?: number;
}

interface BotSendRequest {
  readonly session_id: string;
  readonly message?: string;
  readonly handoff?: boolean;
}

@Component({
  selector: 'app-responder-mensaje-component',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './responder-mensaje-component.html',
  styleUrl: './responder-mensaje-component.css',
})
export class ResponderMensajeComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly http = inject(HttpClient);
  private readonly chatLogStore = inject(ChatLogStore);
  private readonly handoffService = inject(HandoffService);
  private readonly sessionParam = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly botSendApiUrl = environment.botSendApiUrl;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private shouldStickToBottom = false;
  private activeSessionId = '';
  private latestHistoricalFingerprint = '';
  private readonly renderedHistoricalIds = new Set<string>();
  @ViewChild('chatBody') private chatBodyRef?: ElementRef<HTMLDivElement>;

  protected readonly isLoading = this.chatLogStore.isLoading;
  protected readonly errorMessage = this.chatLogStore.errorMessage;
  protected readonly draftMessage = signal('');
  protected readonly actionMessage = signal('');
  protected readonly actionError = signal('');
  protected readonly isSending = signal(false);
  protected readonly isResuming = signal(false);
  protected readonly isRequestingHandoff = signal(false);
  protected readonly optimisticPendingSessionId = signal('');
  protected readonly displayedMessages = signal<readonly ConversationMessage[]>([]);
  protected readonly sessionId = computed(() => this.sessionParam().get('sessionId') ?? '');
  protected readonly isPendingSession = computed(() =>
    this.handoffService.sessionIds().has(this.sessionId()) ||
    this.optimisticPendingSessionId() === this.sessionId(),
  );
  protected readonly connectionLabel = computed(() =>
    this.isLoading() ? 'Cargando...' : this.isPendingSession() ? 'Derivado a agente' : 'Bot activo',
  );
  protected readonly sessionLogs = computed(() =>
    this.chatLogStore
      .logs()
      .filter((log) => log.sessionId === this.sessionId())
      .sort((left, right) => left.rawTimestamp.localeCompare(right.rawTimestamp)),
  );
  protected readonly conversation = computed<readonly ConversationMessage[]>(() => this.displayedMessages());
  protected readonly customerName = computed(() => this.sessionId() || 'Sin sesion');
  protected readonly sendButtonLabel = computed(() => 'Enviar por WhatsApp');
  protected readonly canSendMessages = computed(() => this.isPendingSession() && !this.isSending());
  protected readonly canRequestHandoff = computed(
    () => !!this.sessionId() && !this.isPendingSession() && !this.isRequestingHandoff(),
  );

  constructor() {
    this.chatLogStore.load();
    this.handoffService.startPolling();
    this.startPolling();

    effect(() => {
      this.syncConversation(this.sessionId(), this.sessionLogs());
    });

    effect(() => {
      const sessionId = this.sessionId();

      if (this.optimisticPendingSessionId() && this.optimisticPendingSessionId() !== sessionId) {
        this.optimisticPendingSessionId.set('');
      }

      if (
        this.optimisticPendingSessionId() === sessionId &&
        this.handoffService.sessionIds().has(sessionId)
      ) {
        this.optimisticPendingSessionId.set('');
      }
    });
  }

  ngAfterViewChecked(): void {
    if (!this.shouldStickToBottom) {
      return;
    }

    const chatBody = this.chatBodyRef?.nativeElement;

    if (!chatBody) {
      return;
    }

    chatBody.scrollTop = chatBody.scrollHeight;
    this.shouldStickToBottom = false;
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  protected updateDraftMessage(value: string): void {
    this.draftMessage.set(value);
  }

  protected submitMessage(): void {
    if (!this.isPendingSession()) {
      return;
    }

    this.sendToBot();
  }

  protected sendToBot(): void {
    const sessionId = this.sessionId();
    const message = this.draftMessage().trim();

    if (!sessionId || !message || this.isSending()) {
      return;
    }

    this.isSending.set(true);
    this.actionError.set('');
    this.actionMessage.set('');
    this.shouldStickToBottom = true;
    this.appendLocalMessage(message, 'agente');

    this.sendBotRequest({
      session_id: sessionId,
      message,
    }).subscribe({
        next: () => {
          this.draftMessage.set('');
          this.actionMessage.set('Mensaje enviado por WhatsApp correctamente.');
          this.chatLogStore.reload(true);
          this.isSending.set(false);
        },
        error: (error: unknown) => {
          this.actionError.set(this.getRequestErrorMessage(error));
          this.isSending.set(false);
        },
      });
  }

  protected requestHandoff(): void {
    const sessionId = this.sessionId();

    if (!sessionId || this.isPendingSession() || this.isRequestingHandoff()) {
      return;
    }

    this.isRequestingHandoff.set(true);
    this.actionError.set('');
    this.actionMessage.set('');

    this.sendBotRequest({
      session_id: sessionId,
      handoff: true,
    }).subscribe({
      next: () => {
        this.optimisticPendingSessionId.set(sessionId);
        this.actionMessage.set('La sesion fue derivada a seguimiento humano.');
        this.handoffService.loadSessions();
        this.chatLogStore.reload(true);
        this.isRequestingHandoff.set(false);
      },
      error: (error: unknown) => {
        this.actionError.set(this.getRequestErrorMessage(error));
        this.isRequestingHandoff.set(false);
      },
    });
  }

  protected resumeToBot(): void {
    const sessionId = this.sessionId();

    if (!sessionId || this.isResuming()) {
      return;
    }

    this.isResuming.set(true);
    this.actionError.set('');
    this.actionMessage.set('');

    this.handoffService.resumeSession(sessionId).subscribe({
      next: () => {
        if (this.optimisticPendingSessionId() === sessionId) {
          this.optimisticPendingSessionId.set('');
        }
        this.actionMessage.set('La sesion volvio al ciclo del bot.');
        this.handoffService.loadSessions();
        this.chatLogStore.reload(true);
        this.isResuming.set(false);
      },
      error: (error: unknown) => {
        this.actionError.set(this.getRequestErrorMessage(error));
        this.isResuming.set(false);
      },
    });
  }

  protected goBack(): void {
    this.location.back();
  }

  private sendBotRequest(payload: BotSendRequest) {
    return this.http.post<ChatResponse>(this.botSendApiUrl, payload);
  }

  private startPolling(): void {
    if (this.pollTimer) {
      return;
    }

    this.pollTimer = setInterval(() => {
      this.chatLogStore.reload(true);
      this.handoffService.loadSessions();
    }, 5000);
  }

  private syncConversation(sessionId: string, logs: readonly ChatLogRow[]): void {
    if (sessionId !== this.activeSessionId) {
      this.activeSessionId = sessionId;
      this.latestHistoricalFingerprint = '';
      this.renderedHistoricalIds.clear();
      this.displayedMessages.set([]);
    }

    const historicalMessages = this.buildConversationFromLogs(logs);
    const historicalFingerprint = historicalMessages
      .map((message) => `${message.id}::${message.timestamp}::${message.text}`)
      .join('|');

    if (historicalFingerprint === this.latestHistoricalFingerprint) {
      return;
    }

    const historicalSignatures = new Set(historicalMessages.map((message) => this.getMessageSignature(message)));
    const wasNearBottom = this.isNearBottom();

    const nextMessages = this.displayedMessages().filter(
      (message) => message.source === 'historico' || !historicalSignatures.has(this.getMessageSignature(message)),
    );

    let hasNewHistoricalMessages = false;
    let hasNewIncomingMessages = false;

    for (const message of historicalMessages) {
      if (!this.renderedHistoricalIds.has(message.id)) {
        nextMessages.push(message);
        this.renderedHistoricalIds.add(message.id);
        hasNewHistoricalMessages = true;
        hasNewIncomingMessages = hasNewIncomingMessages || message.author === 'cliente';
      }
    }

    this.latestHistoricalFingerprint = historicalFingerprint;

    if (hasNewHistoricalMessages) {
      this.displayedMessages.set(nextMessages);
      this.shouldStickToBottom = wasNearBottom && hasNewIncomingMessages;
    }
  }

  private buildConversationFromLogs(logs: readonly ChatLogRow[]): readonly ConversationMessage[] {
    return logs.flatMap((log, index) => {
      const normalizedQuestion = log.question.trim();
      const normalizedAnswer = log.answer.trim();

      if (this.isWebManualMessage(normalizedQuestion) || this.isWebManualMessage(normalizedAnswer)) {
        const manualMessage = this.getBotManualMessageContent(normalizedQuestion, normalizedAnswer);

        if (!manualMessage) {
          return [];
        }

        return [
          {
            id: `${log.id}-bot-manual-${index}`,
            text: manualMessage,
            timestamp: log.timestamp,
            author: 'agente' as const,
            source: 'historico' as const,
          },
        ];
      }

      if (this.isAgentTaggedMessage(normalizedQuestion) || this.isAgentTaggedMessage(normalizedAnswer)) {
        const agentMessage = this.getTaggedMessageContent(normalizedQuestion, normalizedAnswer);

        if (!agentMessage) {
          return [];
        }

        return [
          {
            id: `${log.id}-agent-${index}`,
            text: agentMessage,
            timestamp: log.timestamp,
            author: 'agente' as const,
            source: 'historico' as const,
          },
        ];
      }

      const messages: ConversationMessage[] = [];

      if (normalizedQuestion && !this.isBracketOnlyMessage(normalizedQuestion)) {
        messages.push({
          id: `${log.id}-question-${index}`,
          text: this.stripBracketPrefixes(normalizedQuestion),
          timestamp: log.timestamp,
          author: 'cliente',
          source: 'historico',
        });
      }

      if (normalizedAnswer && !this.isBracketOnlyMessage(normalizedAnswer)) {
        messages.push({
          id: `${log.id}-answer-${index}`,
          text: this.stripBracketPrefixes(normalizedAnswer),
          timestamp: log.timestamp,
          author: 'agente',
          source: 'historico',
        });
      }

      return messages;
    });
  }

  private appendLocalMessage(text: string, author: 'cliente' | 'agente'): void {
    this.displayedMessages.update((messages) => [
      ...messages,
      {
        id: `local-${author}-${Date.now()}`,
        text,
        timestamp: new Intl.DateTimeFormat('es-AR', {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date()),
        author,
        source: 'local',
      },
    ]);
  }

  private isNearBottom(): boolean {
    const chatBody = this.chatBodyRef?.nativeElement;

    if (!chatBody) {
      return true;
    }

    const remainingScroll = chatBody.scrollHeight - chatBody.scrollTop - chatBody.clientHeight;
    return remainingScroll < 48;
  }

  private getMessageSignature(message: ConversationMessage): string {
    return `${message.author}::${message.text.trim()}`;
  }

  private isBracketOnlyMessage(text: string): boolean {
    const trimmedText = text.trim();

    return /^\[[^\]]+\]$/.test(trimmedText);
  }

  private isAgentTaggedMessage(text: string): boolean {
    const normalizedText = text.trim().toUpperCase();

    return normalizedText.startsWith('[AGENTE]');
  }

  private isWebManualMessage(text: string): boolean {
    const normalizedText = text.trim().toUpperCase();

    return normalizedText.startsWith('[BOT-MANUAL]');
  }

  private getTaggedMessageContent(primaryText: string, secondaryText: string): string {
    const primaryContent = this.stripBracketPrefixes(primaryText);

    if (primaryContent) {
      return primaryContent;
    }

    return this.stripBracketPrefixes(secondaryText);
  }

  private getBotManualMessageContent(question: string, answer: string): string {
    if (this.isWebManualMessage(question)) {
      return this.stripBracketPrefixes(answer);
    }

    return this.stripBracketPrefixes(question);
  }

  private stripBracketPrefixes(text: string): string {
    return text.replace(/^\[[^\]]+\]\s*/gi, '').trim();
  }

  private getRequestErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = this.extractBackendMessage(error.error);

      if (backendMessage) {
        return backendMessage;
      }

      if (error.status) {
        return `La solicitud fallo. HTTP ${error.status}.`;
      }
    }

    return 'La solicitud no se pudo completar.';
  }

  private extractBackendMessage(errorBody: unknown): string {
    if (typeof errorBody === 'string' && errorBody.trim()) {
      return errorBody;
    }

    if (typeof errorBody === 'object' && errorBody !== null) {
      const detail = Reflect.get(errorBody, 'detail');

      if (typeof detail === 'string' && detail.trim()) {
        return detail;
      }

      const message = Reflect.get(errorBody, 'message');

      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }

    return '';
  }
}
