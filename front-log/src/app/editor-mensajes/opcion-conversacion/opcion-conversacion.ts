import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import {
  EditorBlock,
  EditorBlockFormat,
  EditorBlocksService,
  EditorMessage,
  EditorOption,
  MessageCopyChoice,
  isConditionalDestination,
} from '../../shared/editor-blocks.service';
import { MensajeEditable } from '../mensaje-editable/mensaje-editable';
import { RespuestaOpcionControl } from '../respuesta-opcion-control/respuesta-opcion-control';

@Component({
  selector: 'app-opcion-conversacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MensajeEditable, RespuestaOpcionControl],
  templateUrl: './opcion-conversacion.html',
  styleUrl: './opcion-conversacion.css',
})
export class OpcionConversacion {
  private readonly editorBlocksService = inject(EditorBlocksService);

  readonly option = input.required<EditorOption>();
  readonly blockId = input.required<string>();
  readonly blockFormat = input.required<EditorBlockFormat>();
  readonly totalOptions = input.required<number>();
  readonly updatedBy = input('');
  readonly readonlyView = input(false);
  readonly responses = input<readonly MessageCopyChoice[]>([]);
  readonly responseLimit = input(2000);
  readonly appearance = input<'editor' | 'history-button' | 'history-list'>('editor');

  readonly navigateTo = output<string>();
  readonly contentChanged = output<{ readonly messageKey: string; readonly content: string }>();
  readonly reloadRequested = output<void>();
  readonly blockChanged = output<EditorBlock>();

  protected readonly showEditor = signal(false);
  protected readonly confirmDelete = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal(false);

  constructor() {
    effect(() => {
      if (this.readonlyView()) {
        this.showEditor.set(false);
        this.confirmDelete.set(false);
      }
    });
  }

  protected displayTitle(): string {
    return this.blockFormat() === 'botones'
      ? this.option().titulo_boton
      : this.option().titulo;
  }

  protected titleMessage(): EditorMessage {
    const currentIsButton = this.blockFormat() === 'botones';
    return {
      message_key: currentIsButton ? this.option().titulo_boton_key : this.option().titulo_key,
      label: 'Texto de la opción',
      content: currentIsButton ? this.option().titulo_boton : this.option().titulo,
      limite_caracteres: currentIsButton
        ? this.option().titulo_boton_limite_caracteres
        : this.option().titulo_limite_caracteres,
    };
  }

  protected alternateTitleMessage(): EditorMessage | null {
    if (this.option().titulo_key === this.option().titulo_boton_key) return null;
    const currentIsButton = this.blockFormat() === 'botones';
    return {
      message_key: currentIsButton ? this.option().titulo_key : this.option().titulo_boton_key,
      label: currentIsButton
        ? 'Texto que usará si cambia a lista'
        : 'Texto que usará si vuelve a botones',
      content: currentIsButton ? this.option().titulo : this.option().titulo_boton,
      limite_caracteres: currentIsButton
        ? this.option().titulo_limite_caracteres
        : this.option().titulo_boton_limite_caracteres,
    };
  }

  protected descriptionMessage(): EditorMessage | null {
    const key = this.option().descripcion_key;
    if (!key) return null;
    return {
      message_key: key,
      label: 'Descripción de la opción',
      content: this.option().descripcion ?? '',
      limite_caracteres: this.option().descripcion_limite_caracteres,
    };
  }

  protected conditionalDestination(): boolean {
    return isConditionalDestination(this.option().lleva_a);
  }

  protected simpleDestinationBlockId(): string | null {
    const destination = this.option().lleva_a;
    return destination && !isConditionalDestination(destination) ? destination.block_id : null;
  }

  protected requestDelete(): void {
    if (this.readonlyView()) return;
    this.deleteError.set(false);
    this.confirmDelete.set(true);
  }

  protected cancelDelete(): void {
    this.confirmDelete.set(false);
  }

  protected deleteOption(): void {
    if (this.deleting() || this.readonlyView()) return;
    this.deleting.set(true);
    this.deleteError.set(false);
    this.editorBlocksService
      .deleteOption(this.blockId(), this.option().option_id, this.updatedBy())
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.confirmDelete.set(false);
          this.reloadRequested.emit();
        },
        error: () => {
          this.deleting.set(false);
          this.deleteError.set(true);
        },
      });
  }

  protected changesToButtons(): boolean {
    return this.blockFormat() === 'lista' && this.totalOptions() === 4;
  }

  protected relayChange(change: { readonly messageKey: string; readonly content: string }): void {
    this.contentChanged.emit(change);
  }
}
