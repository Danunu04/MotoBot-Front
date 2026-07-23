import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  BotOptionsService,
  FlowStateSummary,
  GroupConfigPayload,
  OptionBinding,
  OptionGroupConfig,
  OptionGroupPayload,
} from '../shared/bot-options.service';
import {
  BotMessage,
  BotMessagesService,
  extractApiError,
} from '../shared/bot-messages.service';

const CURRENT_USER = 'sitecnosa';
const NEW_OPTION_MARKER = '__new__';

type JsonParseResult =
  | { ok: true; value: Record<string, unknown> | null }
  | { ok: false };

function tryParseJsonObject(raw: string): JsonParseResult {
  const trimmed = raw?.trim();
  if (!trimmed) return { ok: true, value: null };
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return { ok: true, value: parsed as Record<string, unknown> };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

@Component({
  selector: 'app-editor-opciones-detalle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './editor-opciones-detalle.html',
  styleUrl: './editor-opciones-detalle.css',
})
export class EditorOpcionesDetalle implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(BotOptionsService);
  private readonly messagesService = inject(BotMessagesService);
  private readonly fb = inject(FormBuilder);

  protected readonly groupName = signal('');
  protected readonly groupData = signal<OptionGroupPayload | null>(null);
  protected readonly groupConfig = signal<OptionGroupConfig | null>(null);
  protected readonly flowStates = signal<readonly FlowStateSummary[]>([]);
  protected readonly messages = signal<readonly BotMessage[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly actionMessage = signal('');
  protected readonly isSaving = signal(false);
  protected readonly showConfigEditor = signal(false);
  protected readonly editingOptionId = signal<string | null>(null);
  protected readonly confirmDeleteId = signal<string | null>(null);
  protected readonly isEditingExisting = signal(false);

  protected readonly stayInState = signal(false);
  protected readonly targetStateValue = signal('');

  protected readonly options = computed(() => this.groupData()?.options ?? []);

  protected readonly interactiveType = computed(() => {
    const count = this.groupData()?.option_count ?? 0;
    if (count >= 1 && count <= 3) return 'button';
    if (count >= 4 && count <= 10) return 'list';
    return null;
  });

  protected readonly interactiveLabel = computed(() => {
    const t = this.interactiveType();
    if (t === 'button') return 'Botones';
    if (t === 'list') return 'Lista';
    return 'Sin tipo';
  });

  protected readonly thresholdWarning = computed(() => {
    const count = this.options().length;
    if (count === 3) return 'Si agregás una opción más, el grupo pasará a lista.';
    if (count === 4) return 'Si eliminás una opción, el grupo pasará a botones.';
    return null;
  });

  protected readonly deleteWillChangeType = computed(() => this.options().length === 4);

  protected readonly isSoporteTarget = computed(
    () => this.targetStateValue() === 'EstadoSoporte',
  );

  // Filtered message lists for key selectors
  protected readonly titleKeyMessages = computed(() =>
    this.messages().filter((m) => m.type === 'list_row_title' || m.type === 'button'),
  );
  protected readonly buttonTitleKeyMessages = computed(() =>
    this.messages().filter((m) => m.type === 'button'),
  );
  protected readonly descriptionKeyMessages = computed(() =>
    this.messages().filter((m) => m.type === 'list_row_description'),
  );
  protected readonly replyKeyMessages = computed(() =>
    this.messages().filter((m) => m.type === 'text'),
  );
  protected readonly buttonTextKeyMessages = computed(() =>
    this.messages().filter((m) => m.type === 'button_text'),
  );
  protected readonly sectionTitleKeyMessages = computed(() =>
    this.messages().filter((m) => m.type === 'list_section_title'),
  );

  protected readonly isDefaultFallback = computed(
    () => this.groupConfig()?.source === 'default-fallback' || this.groupConfig()?.source === 'default',
  );

  protected configForm = this.fb.group({
    button_text_key: ['', Validators.required],
    section_title_key: ['', Validators.required],
  });

  protected optionForm = this.fb.group({
    option_id: ['', [Validators.required, Validators.pattern(/^[a-z0-9_]+$/)]],
    orden: [1, [Validators.required, Validators.min(0)]],
    title_key: ['', Validators.required],
    button_title_key: [''],
    description_key: [''],
    stay_in_state: [false],
    target_state: [''],
    target_substep_key: [''],
    target_substep_value: [''],
    reply_key: [''],
    target_vars_json: [''],
    extra_flags_json: [''],
  });

  ngOnInit(): void {
    const group = this.route.snapshot.paramMap.get('group') ?? '';
    this.groupName.set(group);

    this.optionForm.get('stay_in_state')!.valueChanges.subscribe((v) => {
      this.stayInState.set(!!v);
    });

    this.optionForm.get('target_state')!.valueChanges.subscribe((v) => {
      const state = (v ?? '').trim();
      this.targetStateValue.set(state);
      if (state === 'EstadoSoporte') {
        const current = (this.optionForm.get('extra_flags_json')?.value ?? '').trim();
        if (!current) {
          this.optionForm.patchValue({
            extra_flags_json: '{"handoff": true}',
            reply_key: this.optionForm.get('reply_key')?.value || 'handoff_text',
          });
        }
      }
    });

    this.loadAll(group);
  }

  protected goBack(): void {
    this.router.navigate(['/editor-opciones']);
  }

  protected toggleConfigEditor(): void {
    this.showConfigEditor.update((v) => !v);
    this.actionMessage.set('');
  }

  protected saveConfig(): void {
    if (this.configForm.invalid || this.isSaving()) return;
    const raw = this.configForm.value as { button_text_key: string; section_title_key: string };
    const payload: GroupConfigPayload = {
      button_text_key: raw.button_text_key.trim(),
      section_title_key: raw.section_title_key.trim(),
      updated_by: CURRENT_USER,
    };
    this.isSaving.set(true);
    this.actionMessage.set('');
    this.service.updateGroupConfig(this.groupName(), payload).subscribe({
      next: (config) => {
        this.groupConfig.set(config);
        this.isSaving.set(false);
        this.actionMessage.set('Configuración guardada.');
        this.showConfigEditor.set(false);
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.actionMessage.set(extractApiError(err));
      },
    });
  }

  protected startNewOption(): void {
    const nextOrden =
      this.options().length > 0
        ? Math.max(...this.options().map((o) => o.orden)) + 10
        : 10;
    this.editingOptionId.set(NEW_OPTION_MARKER);
    this.isEditingExisting.set(false);
    this.confirmDeleteId.set(null);
    this.actionMessage.set('');
    this.stayInState.set(false);
    this.targetStateValue.set('');
    this.optionForm.reset({
      option_id: '',
      orden: nextOrden,
      title_key: '',
      button_title_key: '',
      description_key: '',
      stay_in_state: false,
      target_state: '',
      target_substep_key: '',
      target_substep_value: '',
      reply_key: '',
      target_vars_json: '',
      extra_flags_json: '',
    });
    this.optionForm.get('option_id')!.enable();
  }

  protected startEditOption(opt: OptionBinding): void {
    this.editingOptionId.set(opt.option_id);
    this.isEditingExisting.set(true);
    this.confirmDeleteId.set(null);
    this.actionMessage.set('');
    const sis = opt.stay_in_state;
    this.stayInState.set(sis);
    this.targetStateValue.set(opt.target_state ?? '');
    this.optionForm.reset({
      option_id: opt.option_id,
      orden: opt.orden,
      title_key: opt.title_key,
      button_title_key: opt.button_title_key ?? '',
      description_key: opt.description_key ?? '',
      stay_in_state: sis,
      target_state: opt.target_state ?? '',
      target_substep_key: opt.target_substep_key ?? '',
      target_substep_value: opt.target_substep_value ?? '',
      reply_key: opt.reply_key ?? '',
      target_vars_json: opt.target_vars ?? '',
      extra_flags_json: opt.extra_flags ?? '',
    });
    this.optionForm.get('option_id')!.disable();
  }

  protected cancelOptionEdit(): void {
    this.editingOptionId.set(null);
    this.actionMessage.set('');
    this.optionForm.get('option_id')!.enable();
  }

  protected saveOption(): void {
    if (this.isSaving()) return;
    const v = this.optionForm.getRawValue() as {
      option_id: string;
      orden: number;
      title_key: string;
      button_title_key: string;
      description_key: string;
      stay_in_state: boolean;
      target_state: string;
      target_substep_key: string;
      target_substep_value: string;
      reply_key: string;
      target_vars_json: string;
      extra_flags_json: string;
    };

    const sis = !!v.stay_in_state;
    const targetState = v.target_state?.trim() || null;
    const replyKey = v.reply_key?.trim() || null;
    const substepKey = v.target_substep_key?.trim() || null;
    const substepValue = v.target_substep_value?.trim() || null;
    const isSoporte = targetState === 'EstadoSoporte';

    if (!v.title_key?.trim()) {
      this.actionMessage.set('Error: el campo title_key es obligatorio.');
      return;
    }
    if (!sis && !targetState) {
      this.actionMessage.set('Error: "Ir a otro estado" requiere seleccionar un estado destino.');
      return;
    }
    if (sis && !replyKey) {
      this.actionMessage.set('Error: "Permanecer y cambiar paso" requiere una reply_key.');
      return;
    }
    if (sis && (!substepKey || !substepValue)) {
      this.actionMessage.set('Error: "Permanecer y cambiar paso" requiere target_substep_key y target_substep_value.');
      return;
    }
    if (isSoporte && !replyKey) {
      this.actionMessage.set('Error: EstadoSoporte requiere una reply_key.');
      return;
    }

    const tvResult = tryParseJsonObject(v.target_vars_json ?? '');
    if (!tvResult.ok) {
      this.actionMessage.set('Error: target_vars no es un JSON de objeto válido.');
      return;
    }
    const efResult = tryParseJsonObject(v.extra_flags_json ?? '');
    if (!efResult.ok) {
      this.actionMessage.set('Error: extra_flags no es un JSON de objeto válido.');
      return;
    }
    const targetVars = tvResult.value;
    const extraFlags = efResult.value;

    if (isSoporte && (!extraFlags || !extraFlags['handoff'])) {
      this.actionMessage.set('Error: EstadoSoporte requiere extra_flags con { "handoff": true }.');
      return;
    }

    this.isSaving.set(true);
    this.actionMessage.set('');

    const group = this.groupName();
    const isNew = !this.isEditingExisting();

    if (isNew) {
      const payload = {
        option_id: v.option_id.trim(),
        orden: v.orden,
        title_key: v.title_key.trim(),
        button_title_key: v.button_title_key?.trim() || null,
        description_key: v.description_key?.trim() || null,
        stay_in_state: sis,
        target_state: targetState,
        target_substep_key: substepKey,
        target_substep_value: substepValue,
        reply_key: replyKey,
        target_vars: targetVars,
        extra_flags: extraFlags,
        updated_by: CURRENT_USER,
      };
      this.service.createOption(group, payload).subscribe({
        next: (data) => this.handleOptionSaveSuccess(data, `Opción "${payload.option_id}" creada.`),
        error: (err: unknown) => {
          this.isSaving.set(false);
          this.actionMessage.set(extractApiError(err));
        },
      });
    } else {
      const id = this.editingOptionId()!;
      const payload = {
        orden: v.orden,
        title_key: v.title_key.trim(),
        button_title_key: v.button_title_key?.trim() || null,
        description_key: v.description_key?.trim() || null,
        stay_in_state: sis,
        target_state: targetState,
        target_substep_key: substepKey,
        target_substep_value: substepValue,
        reply_key: replyKey,
        target_vars: targetVars,
        extra_flags: extraFlags,
        updated_by: CURRENT_USER,
      };
      this.service.updateOption(group, id, payload).subscribe({
        next: (data) => this.handleOptionSaveSuccess(data, `Opción "${id}" actualizada.`),
        error: (err: unknown) => {
          this.isSaving.set(false);
          this.actionMessage.set(extractApiError(err));
        },
      });
    }
  }

  protected requestDelete(id: string): void {
    this.confirmDeleteId.set(id);
    this.actionMessage.set('');
  }

  protected cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  protected confirmDelete(): void {
    const id = this.confirmDeleteId();
    if (!id || this.isSaving()) return;
    this.isSaving.set(true);
    this.actionMessage.set('');
    this.service.deleteOption(this.groupName(), id, CURRENT_USER).subscribe({
      next: (data) => this.handleOptionSaveSuccess(data, `Opción "${id}" eliminada.`),
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.actionMessage.set(extractApiError(err));
      },
    });
  }

  protected readonly isEditingNew = computed(() => this.editingOptionId() === NEW_OPTION_MARKER);

  protected msgLabel(msg: BotMessage): string {
    const label = msg.label ? ` — ${msg.label}` : '';
    const preview = msg.content.slice(0, 28);
    const ellipsis = msg.content.length > 28 ? '…' : '';
    return `${msg.key}${label} (${preview}${ellipsis})`;
  }

  private handleOptionSaveSuccess(data: OptionGroupPayload, msg: string): void {
    this.groupData.set(data);
    this.isSaving.set(false);
    this.actionMessage.set(msg);
    this.editingOptionId.set(null);
    this.confirmDeleteId.set(null);
    this.optionForm.get('option_id')!.enable();
  }

  private loadAll(group: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    forkJoin([
      this.service.getGroup(group),
      this.service.getGroupConfig(group),
      this.service.getFlowStates(),
      this.messagesService.getMessages(),
    ]).subscribe({
      next: ([groupData, config, states, msgs]) => {
        this.groupData.set(groupData);
        this.groupConfig.set(config);
        this.flowStates.set(states);
        this.messages.set(msgs);
        this.configForm.setValue({
          button_text_key: config.button_text_key,
          section_title_key: config.section_title_key,
        });
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.errorMessage.set(extractApiError(err));
        this.isLoading.set(false);
      },
    });
  }
}
