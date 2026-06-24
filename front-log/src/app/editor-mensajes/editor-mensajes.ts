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
  protected readonly editedDescription = signal<Record<string, string>>({});
  protected readonly savingKey = signal<string | null>(null);
  protected readonly feedbackMap = signal<Record<string, FeedbackType>>({});

  protected readonly groupedMessages = computed<readonly MessageGroup[]>(() => {
    return this.groupByState(this.messages().filter((m) => m.type === 'text'));
  });

  protected readonly groupedButtons = computed<readonly MessageGroup[]>(() => {
    return this.groupByState(this.messages().filter((m) => m.type === 'button'));
  });

  protected readonly listButtonMessages = computed<readonly BotMessage[]>(() => {
    return this.messages().filter((m) => m.type === 'list_button');
  });

  protected readonly groupedListRows = computed<readonly MessageGroup[]>(() => {
    return this.groupByState(this.messages().filter((m) => m.type === 'list_row'));
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
        this.editedDescription.set({});
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

  protected getDesc(key: string, originalDesc: string): string {
    return this.editedDescription()[key] ?? originalDesc;
  }

  protected setDesc(key: string, value: string): void {
    this.editedDescription.update((current) => ({ ...current, [key]: value }));
  }

  protected isOver(key: string, originalContent: string, limit: number): boolean {
    return this.getContent(key, originalContent).length > limit;
  }

  protected isDescOver(key: string, originalDesc: string, limit: number): boolean {
    return this.getDesc(key, originalDesc).length > limit;
  }

  protected updateUpdatedBy(value: string): void {
    this.updatedBy.set(value);
  }

  protected save(msg: BotMessage): void {
    if (this.savingKey()) return;

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

  protected saveListRow(msg: BotMessage): void {
    if (this.savingKey()) return;

    const title = this.getContent(msg.key, msg.content);
    const description = this.getDesc(msg.key, msg.description ?? '');
    this.savingKey.set(msg.key);

    this.botMessagesService.updateListRow(msg.key, title, description, this.updatedBy()).subscribe({
      next: () => {
        this.savingKey.set(null);
        this.messages.update((current) =>
          current.map((m) => (m.key === msg.key ? { ...m, content: title, description } : m)),
        );
        this.editedContent.update((current) => {
          const next = { ...current };
          delete next[msg.key];
          return next;
        });
        this.editedDescription.update((current) => {
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
    if (!confirmed) return;

    this.setContent(msg.key, msg.default_content);
  }

  protected restoreListRow(msg: BotMessage): void {
    const confirmed = globalThis.confirm(
      `¿Restaurar "${msg.label}" a los valores por defecto? Esta acción no guarda automáticamente.`,
    );
    if (!confirmed) return;

    this.setContent(msg.key, msg.default_content);
    this.setDesc(msg.key, msg.default_description ?? '');
  }

  private groupByState(msgs: readonly BotMessage[]): readonly MessageGroup[] {
    const groupMap = new Map<string, BotMessage[]>();
    for (const msg of msgs) {
      const group = groupMap.get(msg.state_name) ?? [];
      group.push(msg);
      groupMap.set(msg.state_name, group);
    }
    return [...groupMap.entries()].map(([stateName, ms]) => ({ stateName, messages: ms }));
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
