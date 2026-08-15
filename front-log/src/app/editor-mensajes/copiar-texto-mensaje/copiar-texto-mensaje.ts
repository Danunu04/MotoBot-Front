import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { MessageCopyChoice } from '../../shared/editor-blocks.service';

let nextCopyPickerId = 0;

@Component({
  selector: 'app-copiar-texto-mensaje',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './copiar-texto-mensaje.html',
  styleUrl: './copiar-texto-mensaje.css',
})
export class CopiarTextoMensaje {
  readonly messages = input.required<readonly MessageCopyChoice[]>();
  readonly disabled = input(false);
  readonly textCopied = output<string>();

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly copiedLabel = signal('');
  protected readonly panelId = `copy-message-panel-${nextCopyPickerId++}`;
  protected readonly filteredMessages = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('es');
    if (!query) return this.messages();
    return this.messages().filter(
      (message) =>
        message.label.toLocaleLowerCase('es').includes(query) ||
        message.content.toLocaleLowerCase('es').includes(query),
    );
  });

  protected toggle(): void {
    if (this.disabled()) return;
    this.open.update((current) => !current);
  }

  protected close(): void {
    this.open.set(false);
    this.query.set('');
  }

  protected updateQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected copy(message: MessageCopyChoice): void {
    if (this.disabled()) return;
    this.textCopied.emit(message.content);
    this.copiedLabel.set(message.label);
    this.close();
  }
}
