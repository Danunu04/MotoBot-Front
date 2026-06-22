import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BotMessage, BotMessagesService } from '../shared/bot-messages.service';

interface MessageGroup {
  readonly stateName: string;
  readonly messages: readonly BotMessage[];
}

type FeedbackType = 'success' | 'error';

@Component({
  selector: 'app-editor-mensajes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './editor-mensajes.html',
  styleUrl: './editor-mensajes.css',
})
export class EditorMensajes {
  private readonly botMessagesService = inject(BotMessagesService);

  protected readonly messages = signal<readonly BotMessage[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly updatedBy = signal('');
  protected readonly editedContent = signal<Record<string, string>>({});
  protected readonly savingKey = signal<string | null>(null);
  protected readonly feedbackMap = signal<Record<string, FeedbackType>>({});

  protected readonly groupedMessages = computed<readonly MessageGroup[]>(() => {
    const textMessages = this.messages().filter((msg) => msg.type === 'text');
    const groupMap = new Map<string, BotMessage[]>();

    for (const msg of textMessages) {
      const group = groupMap.get(msg.state_name) ?? [];
      group.push(msg);
      groupMap.set(msg.state_name, group);
    }

    return [...groupMap.entries()].map(([stateName, msgs]) => ({ stateName, messages: msgs }));
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.botMessagesService.getMessages().subscribe({
      next: (msgs) => {
        this.messages.set(msgs);
        this.editedContent.set({});
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar los mensajes. Intentá de nuevo.');
        this.isLoading.set(false);
      },
    });
  }

  protected getContent(key: string, originalContent: string): string {
    return this.editedContent()[key] ?? originalContent;
  }

  protected setContent(key: string, value: string): void {
    this.editedContent.update((current) => ({ ...current, [key]: value }));
  }

  protected updateUpdatedBy(value: string): void {
    this.updatedBy.set(value);
  }

  protected save(msg: BotMessage): void {
    if (this.savingKey()) {
      return;
    }

    const content = this.getContent(msg.key, msg.content);
    this.savingKey.set(msg.key);

    this.botMessagesService.updateMessage(msg.key, content, this.updatedBy()).subscribe({
      next: () => {
        this.savingKey.set(null);
        this.messages.update((current) =>
          current.map((m) => (m.key === msg.key ? { ...m, content } : m)),
        );
        this.editedContent.update((current) => {
          const next = { ...current };
          delete next[msg.key];
          return next;
        });
        this.showFeedback(msg.key, 'success');
      },
      error: () => {
        this.savingKey.set(null);
        this.showFeedback(msg.key, 'error');
      },
    });
  }

  protected restore(msg: BotMessage): void {
    const confirmed = globalThis.confirm(
      `¿Restaurar "${msg.label}" al texto por defecto? Esta acción no guarda automáticamente.`,
    );

    if (!confirmed) {
      return;
    }

    this.setContent(msg.key, msg.default_content);
  }

  private showFeedback(key: string, type: FeedbackType): void {
    this.feedbackMap.update((current) => ({ ...current, [key]: type }));

    globalThis.setTimeout(() => {
      this.feedbackMap.update((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }, 3500);
  }
}
