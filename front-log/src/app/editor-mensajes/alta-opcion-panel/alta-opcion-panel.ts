import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { startWith } from 'rxjs';

import {
  ComposedOptionCreatePayload,
  DestinationChoice,
  EditorBlock,
  EditorBlocksService,
  EditorOptionCreateError,
  MessageCopyChoice,
} from '../../shared/editor-blocks.service';
import { CopiarTextoMensaje } from '../copiar-texto-mensaje/copiar-texto-mensaje';

interface PositionChoice {
  readonly value: number;
  readonly label: string;
}

type FormFieldName =
  | 'title'
  | 'buttonTitle'
  | 'description'
  | 'newResponse'
  | 'destinationIndex'
  | 'position';

@Component({
  selector: 'app-alta-opcion-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CopiarTextoMensaje, ReactiveFormsModule],
  templateUrl: './alta-opcion-panel.html',
  styleUrl: './alta-opcion-panel.css',
})
export class AltaOpcionPanel implements OnInit {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly editorBlocksService = inject(EditorBlocksService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly block = input.required<EditorBlock>();
  readonly responses = input.required<readonly MessageCopyChoice[]>();
  readonly destinations = input.required<readonly DestinationChoice[]>();
  readonly updatedBy = input('');

  readonly created = output<EditorBlock>();
  readonly cancelled = output<void>();

  protected readonly creating = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly backendFieldErrors = signal<Partial<Record<FormFieldName, string>>>({});
  protected readonly destinationOpen = signal(false);
  protected readonly form = this.formBuilder.group({
    title: [''],
    buttonTitle: [''],
    description: [''],
    responseMode: ['nuevo' as 'nuevo' | 'sin_respuesta'],
    newResponse: [''],
    destinationSearch: [''],
    destinationIndex: [-1],
    position: [1],
  });

  private readonly destinationSearch = toSignal(
    this.form.controls.destinationSearch.valueChanges.pipe(startWith('')),
    { initialValue: '' },
  );
  private readonly destinationIndex = toSignal(
    this.form.controls.destinationIndex.valueChanges.pipe(startWith(-1)),
    { initialValue: -1 },
  );

  protected readonly titleLimit = computed(() =>
    this.resultingFormatIsList()
      ? this.block().limites_alta.titulo_lista
      : this.block().limites_alta.titulo_botones,
  );
  protected readonly descriptionLimit = computed(
    () => this.block().limites_alta.descripcion_lista,
  );
  protected readonly buttonTitleLimit = computed(
    () => this.block().limites_alta.titulo_botones,
  );
  protected readonly responseLimit = computed(() => this.block().limites_alta.respuesta);
  protected readonly requiresListFields = computed(() => this.resultingFormatIsList());
  protected readonly requiresDescription = this.requiresListFields;
  protected readonly changesToList = computed(
    () => this.block().formato !== 'lista' && this.block().opciones.length === 3,
  );
  protected readonly selectedDestination = computed(
    () => this.destinations()[this.destinationIndex()] ?? null,
  );
  protected readonly filteredDestinations = computed(() => {
    const search = this.destinationSearch().trim().toLocaleLowerCase('es');
    return this.destinations()
      .map((destination, index) => ({ destination, index }))
      .filter(({ destination }) =>
        search ? destination.label.toLocaleLowerCase('es').includes(search) : true,
      );
  });
  protected readonly positions = computed<readonly PositionChoice[]>(() => {
    const choices: PositionChoice[] = [{ value: 1, label: 'Primera opción' }];
    this.block().opciones.forEach((option, index) => {
      const title = this.block().formato === 'botones' ? option.titulo_boton : option.titulo;
      choices.push({
        value: index + 2,
        label:
          index === this.block().opciones.length - 1
            ? `Al final, después de “${title}”`
            : `Después de “${title}”`,
      });
    });
    return choices;
  });

  ngOnInit(): void {
    this.form.controls.position.setValue(this.block().opciones.length + 1);
    this.applyBackendValidators();
    this.form.controls.responseMode.valueChanges
      .pipe(startWith(this.form.controls.responseMode.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((mode) => this.applyResponseValidators(mode));
    this.form.controls.destinationSearch.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => {
        const selected = this.selectedDestination();
        if (selected && search !== selected.label) {
          this.form.controls.destinationIndex.setValue(-1);
        }
      });
    this.watchFieldChanges();
  }

  protected submit(): void {
    this.errorMessage.set('');
    this.clearBackendErrors();
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity({ emitEvent: false });
    if (this.creating() || this.form.invalid || this.titleLimit() < 1) {
      this.focusFirstInvalidField();
      return;
    }

    const value = this.form.getRawValue();
    const destination = this.destinations()[value.destinationIndex];
    if (!destination) {
      this.form.controls.destinationIndex.setErrors({ required: true });
      this.focusField('destinationIndex');
      return;
    }

    const response =
      value.responseMode === 'nuevo'
        ? { modo: 'nuevo' as const, contenido: value.newResponse.trim() }
        : { modo: 'sin_respuesta' as const };
    const llevaA = destination.block_id
      ? { state_id: destination.state_id, block_id: destination.block_id }
      : destination.state_id;
    const payload: ComposedOptionCreatePayload = {
      titulo: value.title.trim(),
      titulo_boton: this.requiresListFields() ? value.buttonTitle.trim() : null,
      descripcion: this.requiresDescription() ? value.description.trim() : null,
      respuesta: response,
      lleva_a: llevaA,
      posicion: value.position,
      permitir_cambio_a_lista: this.changesToList(),
      updated_by: this.updatedBy(),
    };

    this.creating.set(true);
    this.editorBlocksService.createOption(this.block().block_id, payload).subscribe({
      next: (block) => {
        this.creating.set(false);
        this.created.emit(block);
      },
      error: (error: unknown) => {
        this.creating.set(false);
        const normalized =
          error instanceof EditorOptionCreateError
            ? error
            : new EditorOptionCreateError('Ocurrió un error inesperado al guardar la opción.', 0);
        this.errorMessage.set(normalized.message);
        const field = this.controlForBackendField(normalized.field);
        if (!field) return;
        this.backendFieldErrors.update((current) => ({
          ...current,
          [field]: normalized.message,
        }));
        const control = this.form.controls[field];
        control.setErrors({ ...(control.errors ?? {}), server: true });
        control.markAsTouched();
        this.focusField(field);
      },
    });
  }

  protected selectDestination(index: number): void {
    const destination = this.destinations()[index];
    if (!destination) return;
    this.form.controls.destinationIndex.setValue(index);
    this.form.controls.destinationIndex.markAsTouched();
    this.form.controls.destinationSearch.setValue(destination.label);
    this.destinationOpen.set(false);
  }

  protected showDestinationResults(): void {
    this.destinationOpen.set(true);
  }

  protected hideDestinationResults(): void {
    globalThis.setTimeout(() => this.destinationOpen.set(false), 120);
  }

  protected fieldInvalid(field: FormFieldName): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  protected fieldError(field: FormFieldName): string {
    const serverError = this.backendFieldErrors()[field];
    if (serverError) return serverError;
    const errors = this.form.controls[field].errors;
    if (!errors) return '';
    if (errors['required']) {
      const messages: Record<FormFieldName, string> = {
        title: 'Escribí el texto de la opción.',
        buttonTitle: 'Escribí el texto que se usará como botón.',
        description: 'Escribí la descripción que se verá debajo del título.',
        newResponse: 'Escribí qué responderá el bot.',
        destinationIndex: 'Elegí a dónde lleva la opción.',
        position: 'Elegí la posición de la opción.',
      };
      return messages[field];
    }
    if (errors['maxlength']) {
      return `No puede superar ${errors['maxlength'].requiredLength} caracteres.`;
    }
    if (errors['min'] || errors['max']) {
      return field === 'destinationIndex'
        ? 'Elegí a dónde lleva la opción.'
        : 'Elegí una posición válida.';
    }
    return 'Revisá este campo.';
  }

  protected responseModeIs(mode: 'nuevo' | 'sin_respuesta'): boolean {
    return this.form.controls.responseMode.value === mode;
  }

  protected copyResponseText(content: string): void {
    this.form.controls.responseMode.setValue('nuevo');
    this.form.controls.newResponse.setValue(content);
    this.form.controls.newResponse.markAsDirty();
    this.form.controls.newResponse.updateValueAndValidity();
  }

  protected titleLength(): number {
    return this.form.controls.title.value.length;
  }

  protected buttonTitleLength(): number {
    return this.form.controls.buttonTitle.value.length;
  }

  protected descriptionLength(): number {
    return this.form.controls.description.value.length;
  }

  protected newResponseLength(): number {
    return this.form.controls.newResponse.value.length;
  }

  private resultingFormatIsList(): boolean {
    return this.block().formato === 'lista' || this.block().opciones.length + 1 >= 4;
  }

  private applyBackendValidators(): void {
    this.form.controls.title.setValidators([
      Validators.required,
      Validators.maxLength(this.titleLimit()),
    ]);
    this.form.controls.buttonTitle.setValidators(
      this.requiresListFields()
        ? [Validators.required, Validators.maxLength(this.buttonTitleLimit())]
        : [Validators.maxLength(this.buttonTitleLimit())],
    );
    this.form.controls.description.setValidators(
      this.requiresDescription()
        ? [Validators.required, Validators.maxLength(this.descriptionLimit())]
        : [Validators.maxLength(this.descriptionLimit())],
    );
    this.form.controls.destinationIndex.setValidators([Validators.min(0)]);
    this.form.controls.position.setValidators([
      Validators.required,
      Validators.min(1),
      Validators.max(this.block().opciones.length + 1),
    ]);
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  private applyResponseValidators(mode: 'nuevo' | 'sin_respuesta'): void {
    this.form.controls.newResponse.setValidators(
      mode === 'nuevo'
        ? [Validators.required, Validators.maxLength(this.responseLimit())]
        : [],
    );
    this.form.controls.newResponse.updateValueAndValidity({ emitEvent: false });
  }

  private watchFieldChanges(): void {
    const controls: Record<FormFieldName, AbstractControl> = {
      title: this.form.controls.title,
      buttonTitle: this.form.controls.buttonTitle,
      description: this.form.controls.description,
      newResponse: this.form.controls.newResponse,
      destinationIndex: this.form.controls.destinationIndex,
      position: this.form.controls.position,
    };
    for (const field of Object.keys(controls) as FormFieldName[]) {
      controls[field].valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          if (!this.backendFieldErrors()[field]) return;
          this.backendFieldErrors.update((current) => {
            const next = { ...current };
            delete next[field];
            return next;
          });
        });
    }
  }

  private clearBackendErrors(): void {
    this.backendFieldErrors.set({});
    const fields: readonly FormFieldName[] = [
      'title',
      'buttonTitle',
      'description',
      'newResponse',
      'destinationIndex',
      'position',
    ];
    fields.forEach((field) =>
      this.form.controls[field].updateValueAndValidity({ emitEvent: false }),
    );
  }

  private controlForBackendField(field: string | null): FormFieldName | null {
    if (!field) return null;
    if (field === 'titulo') return 'title';
    if (field === 'titulo_boton') return 'buttonTitle';
    if (field === 'descripcion') return 'description';
    if (field.startsWith('respuesta')) return 'newResponse';
    if (field.startsWith('lleva_a')) return 'destinationIndex';
    if (field === 'posicion') return 'position';
    return null;
  }

  private focusFirstInvalidField(): void {
    const order: readonly FormFieldName[] = [
      'title',
      'buttonTitle',
      'description',
      'newResponse',
      'destinationIndex',
      'position',
    ];
    const first = order.find((field) => this.form.controls[field].invalid);
    if (first) this.focusField(first);
  }

  private focusField(field: FormFieldName): void {
    globalThis.setTimeout(() => {
      this.host.nativeElement.querySelector<HTMLElement>(`[data-control="${field}"]`)?.focus();
    });
  }
}
