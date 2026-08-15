import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  ComposedResponsePayload,
  EditorBlock,
  EditorBlocksService,
  EditorOption,
  EditorOptionCreateError,
  MessageCopyChoice,
} from '../../shared/editor-blocks.service';
import { CopiarTextoMensaje } from '../copiar-texto-mensaje/copiar-texto-mensaje';
import { MensajeEditable } from '../mensaje-editable/mensaje-editable';

type Confirmation = 'activar' | 'desactivar' | null;

@Component({
  selector: 'app-respuesta-opcion-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CopiarTextoMensaje, MensajeEditable, ReactiveFormsModule],
  templateUrl: './respuesta-opcion-control.html',
  styleUrl: './respuesta-opcion-control.css',
})
export class RespuestaOpcionControl {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly editorBlocksService = inject(EditorBlocksService);

  readonly option = input.required<EditorOption>();
  readonly blockId = input.required<string>();
  readonly responses = input<readonly MessageCopyChoice[]>([]);
  readonly responseLimit = input(2000);
  readonly updatedBy = input('');
  readonly readonlyView = input(false);

  readonly blockChanged = output<EditorBlock>();
  readonly contentChanged = output<{ readonly messageKey: string; readonly content: string }>();
  readonly reloadRequested = output<void>();

  protected readonly confirmation = signal<Confirmation>(null);
  protected readonly addingResponse = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly form = this.formBuilder.group({
    content: ['', [Validators.required]],
  });

  protected readonly hasResponse = computed(() => this.option().respuesta !== null);
  protected readonly switchChecked = computed(() => this.hasResponse() || this.addingResponse());

  protected requestToggle(): void {
    if (this.readonlyView() || this.saving()) return;
    this.errorMessage.set('');
    if (this.addingResponse()) {
      this.cancelAdding();
      return;
    }
    this.confirmation.set(this.hasResponse() ? 'desactivar' : 'activar');
  }

  protected confirmEnable(): void {
    this.confirmation.set(null);
    this.addingResponse.set(true);
    this.form.controls.content.setValidators([
      Validators.required,
      Validators.maxLength(this.responseLimit()),
    ]);
    this.form.reset({ content: '' });
  }

  protected confirmDisable(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set('');
    this.editorBlocksService
      .setOptionResponse(
        this.blockId(),
        this.option().option_id,
        { modo: 'sin_respuesta' },
        this.updatedBy(),
      )
      .subscribe({
        next: (block) => {
          this.saving.set(false);
          this.confirmation.set(null);
          this.blockChanged.emit(block);
          this.reloadRequested.emit();
        },
        error: (error: unknown) => this.handleError(error),
      });
  }

  protected cancelConfirmation(): void {
    if (!this.saving()) this.confirmation.set(null);
  }

  protected cancelAdding(): void {
    this.addingResponse.set(false);
    this.errorMessage.set('');
  }

  protected saveResponse(): void {
    this.errorMessage.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const value = this.form.getRawValue();
    const response: ComposedResponsePayload = {
      modo: 'nuevo',
      contenido: value.content.trim(),
    };
    this.saving.set(true);
    this.editorBlocksService
      .setOptionResponse(this.blockId(), this.option().option_id, response, this.updatedBy())
      .subscribe({
        next: (block) => {
          this.saving.set(false);
          this.addingResponse.set(false);
          this.blockChanged.emit(block);
          this.reloadRequested.emit();
        },
        error: (error: unknown) => this.handleError(error),
      });
  }

  protected contentError(): string {
    const control = this.form.controls.content;
    if (!control.touched || !control.invalid) return '';
    return control.errors?.['maxlength']
      ? `La respuesta no puede superar ${this.responseLimit()} caracteres.`
      : 'Escribí la respuesta que enviará el bot.';
  }

  protected copyResponseText(content: string): void {
    this.form.controls.content.setValue(content);
    this.form.controls.content.markAsDirty();
    this.form.controls.content.updateValueAndValidity();
  }

  protected sharedBlockNames(): string {
    return (this.option().respuesta?.compartido_con ?? [])
      .map((block) => block.titulo)
      .join(', ');
  }

  private handleError(error: unknown): void {
    this.saving.set(false);
    this.errorMessage.set(
      error instanceof EditorOptionCreateError
        ? error.message
        : 'No se pudo cambiar la respuesta. Intentá de nuevo.',
    );
  }
}
