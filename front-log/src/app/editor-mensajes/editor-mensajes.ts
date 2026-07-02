import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  BotMessage,
  BotMessageType,
  BotMessagesService,
  CreateMessagePayload,
  MESSAGE_LIMITS,
  MESSAGE_TYPE_LABELS,
} from '../shared/bot-messages.service';

type BusinessFlowId = 'global' | 'login' | 'registro' | 'pedidos' | 'precios';

interface FlowView {
  readonly id: BusinessFlowId;
  readonly name: string;
  readonly description: string;
  readonly messages: readonly BotMessage[];
  readonly messageCount: number;
  readonly defaultStateName: string | null;
}

type FeedbackType = 'success' | 'error';

const ALL_MESSAGE_TYPES: readonly BotMessageType[] = [
  'text',
  'button',
  'button_text',
  'list_row_title',
  'list_row_description',
];

const BUSINESS_FLOWS: Readonly<Record<BusinessFlowId, { name: string; description: string; defaultStateName: string | null }>> = {
  global: {
    name: 'Global / Compartido',
    description: 'Mensajes de bienvenida, despedida, menú principal y botones genéricos.',
    defaultStateName: null,
  },
  login: {
    name: 'Login',
    description: 'Inicio de sesión, pasos de acceso y recuperación de cuenta.',
    defaultStateName: 'EstadoLogin',
  },
  registro: {
    name: 'Registro',
    description: 'Alta de usuario, solicitud de email y verificación del formulario.',
    defaultStateName: 'EstadoFormulario',
  },
  pedidos: {
    name: 'Seguimiento de pedidos',
    description: 'Consulta de información y estado de pedidos.',
    defaultStateName: 'EstadoInfoPedido',
  },
  precios: {
    name: 'Vista de precios',
    description: 'Visualización de precios, descuentos y borrado de navegación.',
    defaultStateName: 'EstadoPortalBeneficios',
  },
};

const LOGIN_FLOJO_IDS = new Set([
  'loginPasosDetallados',
  'pasosRecibirCodigo',
  'pasosIngresarEmail',
  'pasosIngresarCodigo',
  'pasosFunciono',
  'preguntaInicioSesion',
  'preguntaIngresoAnterior',
  'formularioPasosLogin',
  'descuentosPasosLogin',
  'portalPreguntaInicioSesion',
]);

const REGISTRO_FLOJO_IDS = new Set([
  'pedirEmail',
  'emailNoReconocido',
  'registroIntro',
  'preguntaFormulario',
  'preguntaFormularioCargado',
  'preguntaCuandoCargado',
  'preguntaAproximadamenteCuando',
  'formularioNoCargado',
  'esperar48hs',
  'formularioConfusion',
  'formularioResuelto',
  'registroAvanceMail',
  'mailEmpresarialOk',
  'menuRegistroTitulo',
  'menuRegistroDescripcion',
]);

const PEDIDOS_FLOJO_IDS = new Set([
  'infoPedido',
  'pedidoAlgoMas',
  'menuPedidoTitulo',
  'menuPedidoDescripcion',
]);

const PRECIOS_FLOJO_IDS = new Set([
  'preciosIntro',
  'descuentosIntro',
  'descuentosFormularioNoCargado',
  'descuentosEsperar48hs',
  'descuentosPasosLogin',
  'descuentosConfusionFormulario',
  'descuentosResuelto',
  'portalBorrarNavegacion',
  'portalPreguntaInicioSesion',
  'menuPreciosTitulo',
  'menuPreciosDescripcion',
  'menuDescuentosTitulo',
  'menuDescuentosDescripcion',
  'borrarNavConfirmar',
  'borrarNavExplicar',
  'borrarNavSaberComo',
  'borrarNavComoHacerlo',
  'borrarNavEsperar',
  'borrarNavTerminaste',
  'borrarNavRecordatorio',
  'borrarNavProbar',
  'borrarNavDeAcuerdo',
  'borrarNavSaberComoFallback',
  'borrarNavCodigoRegistro',
  'borrarNavPasosIndicados',
]);

const STATE_TO_FLOW: Readonly<Record<string, BusinessFlowId>> = {
  EstadoLogin: 'login',
  EstadoPasosInicioSesion: 'login',
  EstadoFormulario: 'registro',
  EstadoRegistroMailEmpresa: 'registro',
  EstadoPedirMail: 'registro',
  EstadoInfoPedido: 'pedidos',
  EstadoPortalBeneficios: 'precios',
  EstadoNoVeoDescuentos: 'precios',
  EstadoBorrarNavegacion: 'precios',
};

function getBusinessFlowId(msg: BotMessage): BusinessFlowId {
  const stateFlow = msg.state_name ? STATE_TO_FLOW[msg.state_name] : undefined;
  if (stateFlow) return stateFlow;

  const flujoId = msg.flujo_identificacion_mensaje ?? '';
  if (LOGIN_FLOJO_IDS.has(flujoId)) return 'login';
  if (REGISTRO_FLOJO_IDS.has(flujoId)) return 'registro';
  if (PEDIDOS_FLOJO_IDS.has(flujoId)) return 'pedidos';
  if (PRECIOS_FLOJO_IDS.has(flujoId)) return 'precios';

  return 'global';
}

@Component({
  selector: 'app-editor-mensajes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DragDropModule],
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
  protected readonly selectedFlowId = signal<BusinessFlowId | null>(null);

  protected readonly newKey = signal('');
  protected readonly newType = signal<BotMessageType>('text');
  protected readonly newStateName = signal('');
  protected readonly newFlujoIdentificacionMensaje = signal('');
  protected readonly newLabel = signal('');
  protected readonly newContent = signal('');
  protected readonly newDefaultContent = signal('');
  protected readonly creating = signal(false);
  protected readonly createError = signal('');

  protected readonly reordering = signal(false);
  protected readonly insertAnchorIndex = signal<number | null>(null);

  protected readonly messageTypes = ALL_MESSAGE_TYPES;
  protected readonly typeLabels = MESSAGE_TYPE_LABELS;
  protected readonly limits = MESSAGE_LIMITS;

  protected readonly flows = computed(() => {
    const grouped = new Map<BusinessFlowId, BotMessage[]>();
    for (const msg of this.messages()) {
      const flowId = getBusinessFlowId(msg);
      const list = grouped.get(flowId) ?? [];
      list.push(msg);
      grouped.set(flowId, list);
    }

    const result: FlowView[] = [];
    for (const [flowId, msgs] of grouped.entries()) {
      const config = BUSINESS_FLOWS[flowId];
      result.push({
        id: flowId,
        name: config.name,
        description: config.description,
        messages: msgs,
        messageCount: msgs.length,
        defaultStateName: config.defaultStateName,
      });
    }

    const order: readonly BusinessFlowId[] = ['global', 'login', 'registro', 'pedidos', 'precios'];
    return result.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  });

  protected readonly selectedFlow = computed(() => {
    const id = this.selectedFlowId();
    if (id === null) return undefined;
    return this.flows().find((flow) => flow.id === id);
  });

  protected readonly selectedFlowMessages = computed(() => {
    const flow = this.selectedFlow();
    if (!flow) return [];
    return [...flow.messages].sort((a, b) => a.orden - b.orden);
  });

  protected readonly insertPositionLabel = computed(() => {
    const index = this.insertAnchorIndex();
    const flowMessages = this.selectedFlowMessages();
    if (index === null) {
      return 'Agregar mensaje al final';
    }
    if (index === -1) {
      return 'Agregar mensaje al inicio del flujo';
    }
    const next = flowMessages[index + 1];
    return next ? `Agregar mensaje antes de "${next.label}"` : 'Agregar mensaje al final';
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.createError.set('');

    this.botMessagesService.getMessages().subscribe({
      next: (msgs) => {
        this.messages.set(msgs);
        this.editedContent.set({});
        this.isLoading.set(false);
        this.selectDefaultFlowIfNeeded();
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar los mensajes. Intentá de nuevo.');
        this.isLoading.set(false);
      },
    });
  }

  protected selectFlow(flowId: BusinessFlowId): void {
    this.selectedFlowId.set(flowId);
    const flow = this.flows().find((f) => f.id === flowId);
    this.newStateName.set(flow?.defaultStateName ?? '');
    this.insertAnchorIndex.set(null);
    this.createError.set('');
  }

  protected isActiveFlow(flowId: BusinessFlowId): boolean {
    return this.selectedFlowId() === flowId;
  }

  protected getContent(key: string, originalContent: string): string {
    return this.editedContent()[key] ?? originalContent;
  }

  protected setContent(key: string, value: string): void {
    this.editedContent.update((current) => ({ ...current, [key]: value }));
  }

  protected isOver(key: string, originalContent: string, type: BotMessageType): boolean {
    return this.getContent(key, originalContent).length > this.limits[type];
  }

  protected updateUpdatedBy(value: string): void {
    this.updatedBy.set(value);
  }

  protected save(msg: BotMessage): void {
    if (this.savingKey()) return;

    const content = this.getContent(msg.key, msg.content).trim();
    if (!content || content.length > this.limits[msg.type]) {
      this.showFeedback(msg.key, 'error');
      return;
    }

    this.savingKey.set(msg.key);

    this.botMessagesService.updateMessage(msg.key, content, this.updatedBy()).subscribe({
      next: () => {
        this.savingKey.set(null);
        this.messages.update((current) =>
          current.map((m: BotMessage) => (m.key === msg.key ? { ...m, content } : m)),
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
    if (!confirmed) return;

    this.setContent(msg.key, msg.default_content);
  }

  protected drop(event: CdkDragDrop<BotMessage[]>): void {
    if (this.reordering()) return;

    const flowMessages = this.selectedFlowMessages();
    if (flowMessages.length < 2) return;

    const reordered = [...flowMessages];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);

    const orders = reordered.map((msg, index) => ({
      message_key: msg.key,
      orden: (index + 1) * 10,
    }));

    this.reordering.set(true);
    this.botMessagesService.reorderMessages(orders).subscribe({
      next: () => {
        this.reordering.set(false);
        this.messages.update((current) =>
          current.map((m) => {
            const updated = orders.find((o) => o.message_key === m.key);
            return updated ? { ...m, orden: updated.orden } : m;
          }),
        );
      },
      error: () => {
        this.reordering.set(false);
      },
    });
  }

  protected startInsertAt(index: number | null): void {
    this.insertAnchorIndex.set(index);
    this.createError.set('');
  }

  protected cancelInsert(): void {
    this.insertAnchorIndex.set(null);
  }

  protected isInsertingAt(index: number | null): boolean {
    return this.insertAnchorIndex() === index;
  }

  protected updateNewKey(value: string): void {
    this.newKey.set(value);
    this.createError.set('');
  }

  protected updateNewType(value: string): void {
    if (this.isMessageType(value)) {
      this.newType.set(value);
    }
  }

  protected updateNewStateName(value: string): void {
    this.newStateName.set(value);
    this.createError.set('');
  }

  protected updateNewFlujoIdentificacionMensaje(value: string): void {
    this.newFlujoIdentificacionMensaje.set(value);
    this.createError.set('');
  }

  protected updateNewLabel(value: string): void {
    this.newLabel.set(value);
    this.createError.set('');
  }

  protected updateNewContent(value: string): void {
    this.newContent.set(value);
    this.createError.set('');
  }

  protected updateNewDefaultContent(value: string): void {
    this.newDefaultContent.set(value);
    this.createError.set('');
  }

  protected createMessage(): void {
    if (this.creating()) return;

    const key = this.newKey().trim();
    const type = this.newType();
    const stateName = this.newStateName().trim() || null;
    const flujoIdentificacion = this.newFlujoIdentificacionMensaje().trim() || null;
    const label = this.newLabel().trim() || key;
    const content = this.newContent().trim();
    const defaultContent = this.newDefaultContent().trim() || content;

    if (!key) {
      this.createError.set('La clave del mensaje es obligatoria.');
      return;
    }
    if (!flujoIdentificacion) {
      this.createError.set('La identificación del mensaje en el flujo es obligatoria.');
      return;
    }
    if (!content) {
      this.createError.set('El contenido es obligatorio.');
      return;
    }
    if (content.length > this.limits[type]) {
      this.createError.set(
        `El contenido excede el límite de ${this.limits[type]} caracteres para ${this.typeLabels[type]}.`,
      );
      return;
    }
    if (defaultContent.length > this.limits[type]) {
      this.createError.set(
        `El contenido por defecto excede el límite de ${this.limits[type]} caracteres.`,
      );
      return;
    }

    const targetFlow = this.selectedFlow();
    const targetFlowId = targetFlow?.id ?? 'global';
    const orden = this.resolveInsertOrden(targetFlowId);

    const payload: CreateMessagePayload = {
      message_key: key,
      message_type: type,
      state_name: stateName,
      flujo_identificacion_mensaje: flujoIdentificacion,
      label,
      content,
      default_content: defaultContent,
      updated_by: this.updatedBy(),
      orden,
    };

    this.creating.set(true);
    this.createError.set('');

    this.botMessagesService.createMessage(payload).subscribe({
      next: () => {
        this.creating.set(false);
        this.insertAnchorIndex.set(null);
        this.resetCreateForm();
        this.load();
      },
      error: (error: unknown) => {
        this.creating.set(false);
        const detail =
          typeof error === 'object' && error !== null && 'error' in error
            ? String((error as { error: { detail?: string } }).error?.detail ?? '')
            : '';
        this.createError.set(detail || 'No se pudo crear el mensaje. Intentá de nuevo.');
      },
    });
  }

  private resolveInsertOrden(flowId: BusinessFlowId): number {
    const anchor = this.insertAnchorIndex();
    const sameFlow = this.messages()
      .filter((m) => getBusinessFlowId(m) === flowId)
      .sort((a, b) => a.orden - b.orden);

    if (sameFlow.length === 0) {
      return 10;
    }

    if (anchor === null) {
      return sameFlow[sameFlow.length - 1].orden + 10;
    }

    if (anchor === -1) {
      const first = sameFlow[0];
      return first.orden > 1 ? Math.floor(first.orden / 2) : 5;
    }

    const current = sameFlow[anchor];
    const next = sameFlow[anchor + 1];
    if (!next) {
      return current.orden + 10;
    }

    const mid = Math.floor((current.orden + next.orden) / 2);
    return mid > current.orden && mid < next.orden ? mid : current.orden + 1;
  }

  private resetCreateForm(): void {
    const flow = this.selectedFlow();
    this.newKey.set('');
    this.newType.set('text');
    this.newStateName.set(flow?.defaultStateName ?? '');
    this.newFlujoIdentificacionMensaje.set('');
    this.newLabel.set('');
    this.newContent.set('');
    this.newDefaultContent.set('');
  }

  private selectDefaultFlowIfNeeded(): void {
    if (this.selectedFlowId() !== null) return;

    const flows = this.flows();
    const globalFlow = flows.find((flow) => flow.id === 'global');
    const defaultFlow = globalFlow ?? flows[0];
    if (defaultFlow) {
      this.selectFlow(defaultFlow.id);
    }
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

  private isMessageType(value: string): value is BotMessageType {
    return ALL_MESSAGE_TYPES.includes(value as BotMessageType);
  }
}
