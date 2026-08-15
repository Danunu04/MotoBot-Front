import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { BotMessagesService } from '../../shared/bot-messages.service';
import { EditorMessage, MessageCopyChoice } from '../../shared/editor-blocks.service';
import { CopiarTextoMensaje } from '../copiar-texto-mensaje/copiar-texto-mensaje';

type PendingAction = 'edit' | 'restore' | null;

@Component({
  selector: 'app-mensaje-editable',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CopiarTextoMensaje, ReactiveFormsModule],
  templateUrl: './mensaje-editable.html',
  styleUrl: './mensaje-editable.css',
})
export class MensajeEditable {
  private readonly messagesService = inject(BotMessagesService);

  readonly message = input.required<EditorMessage>();
  readonly updatedBy = input('');
  readonly sequenceNumber = input<number | null>(null);
  readonly contextLabel = input('');
  readonly appearance = input<'bubble' | 'compact'>('bubble');
  readonly copyChoices = input<readonly MessageCopyChoice[]>([]);
  readonly editable = input(true);
  readonly disabled = input(false);

  readonly contentChanged = output<{ readonly messageKey: string; readonly content: string }>();
  readonly restored = output<void>();

  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly pendingAction = signal<PendingAction>(null);
  protected readonly feedback = signal<'saved' | 'error' | ''>('');
  protected readonly draft = new FormControl('', { nonNullable: true });
  protected readonly draftValue = toSignal(this.draft.valueChanges.pipe(startWith('')), {
    initialValue: '',
  });

  constructor() {
    effect(() => {
      if (this.disabled()) {
        this.editing.set(false);
        this.pendingAction.set(null);
      }
      if (this.saving() || this.disabled()) {
        this.draft.disable({ emitEvent: false });
      } else {
        this.draft.enable({ emitEvent: false });
      }
    });
  }

  protected requestEdit(): void {
    if (this.disabled()) return;
    this.feedback.set('');
    if (this.isShared()) {
      this.pendingAction.set('edit');
      return;
    }
    this.beginEditing();
  }

  protected requestRestore(): void {
    if (this.disabled()) return;
    this.feedback.set('');
    this.pendingAction.set('restore');
  }

  protected confirmPendingAction(): void {
    const action = this.pendingAction();
    this.pendingAction.set(null);
    if (action === 'edit') {
      this.beginEditing();
    } else if (action === 'restore') {
      this.restoreNow();
    }
  }

  protected cancelPendingAction(): void {
    this.pendingAction.set(null);
  }

  protected cancelEditing(): void {
    this.editing.set(false);
    this.draft.setValue(this.message().content);
    this.feedback.set('');
  }

  protected save(): void {
    if (this.saving() || this.disabled()) return;
    const content = this.draftValue().trim();
    if (!content || content.length > this.message().limite_caracteres) {
      this.feedback.set('error');
      return;
    }

    this.saving.set(true);
    this.feedback.set('');
    this.messagesService
      .updateMessage(this.message().message_key, content, this.updatedBy())
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editing.set(false);
          this.feedback.set('saved');
          this.contentChanged.emit({ messageKey: this.message().message_key, content });
        },
        error: () => {
          this.saving.set(false);
          this.feedback.set('error');
        },
      });
  }

  protected isShared(): boolean {
    return this.message().compartido === true && this.sharedWith().length > 0;
  }

  protected sharedWith(): readonly string[] {
    return (this.message().compartido_con ?? []).map((block) => block.titulo);
  }

  protected isOverLimit(): boolean {
    return this.draftValue().length > this.message().limite_caracteres;
  }

  protected applyCopiedText(content: string): void {
    if (!this.editing() || this.disabled()) return;
    this.draft.setValue(content);
    this.draft.markAsDirty();
  }

  private beginEditing(): void {
    this.draft.setValue(this.message().content);
    this.editing.set(true);
  }

  private restoreNow(): void {
    if (this.saving() || this.disabled()) return;
    this.saving.set(true);
    this.messagesService
      .resetMessage(this.message().message_key, this.updatedBy())
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editing.set(false);
          this.restored.emit();
        },
        error: () => {
          this.saving.set(false);
          this.feedback.set('error');
        },
      });
  }
}
