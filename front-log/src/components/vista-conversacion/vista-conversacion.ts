import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { MensajeEditable } from '../../app/editor-mensajes/mensaje-editable/mensaje-editable';
import { OpcionConversacion } from '../../app/editor-mensajes/opcion-conversacion/opcion-conversacion';
import {
  EditorBlock,
  EditorMessage,
  EditorOption,
  MessageCopyChoice,
} from '../../app/shared/editor-blocks.service';

export type VistaConversacionMode = 'editor' | 'historial';
export type VistaConversacionFormat = 'mensaje' | 'botones' | 'lista';

export interface VistaConversacionHistoryOption {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
}

export interface VistaConversacionHistoryTurn {
  readonly turnId: string;
  readonly text: string;
  readonly timestamp: string;
  readonly format: VistaConversacionFormat;
  readonly options: readonly VistaConversacionHistoryOption[];
  readonly listName: string | null;
  readonly originLabel?: string | null;
}

@Component({
  selector: 'app-vista-conversacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MensajeEditable, OpcionConversacion],
  templateUrl: './vista-conversacion.html',
  styleUrl: './vista-conversacion.css',
})
export class VistaConversacion {
  readonly block = input<EditorBlock | null>(null);
  readonly historyTurn = input<VistaConversacionHistoryTurn | null>(null);
  readonly mode = input<VistaConversacionMode>('editor');
  readonly updatedBy = input('');
  readonly readonlyView = input(false);
  readonly responses = input<readonly MessageCopyChoice[]>([]);

  readonly navigateTo = output<string>();
  readonly contentChanged = output<{ readonly messageKey: string; readonly content: string }>();
  readonly reloadRequested = output<void>();
  readonly blockChanged = output<EditorBlock>();

  protected readonly historyOptions = computed<readonly EditorOption[]>(() =>
    (this.historyTurn()?.options ?? []).map((option, index) => ({
      option_id: option.id || `opcion-${index + 1}`,
      orden: index + 1,
      editable: false,
      sintetica: false,
      titulo: option.title,
      titulo_key: `historial-${index + 1}-titulo`,
      titulo_limite_caracteres: Math.max(option.title.length, 1),
      titulo_boton: option.title,
      titulo_boton_key: `historial-${index + 1}-boton`,
      titulo_boton_limite_caracteres: Math.max(option.title.length, 1),
      descripcion: option.description,
      descripcion_key: option.description ? `historial-${index + 1}-descripcion` : null,
      descripcion_limite_caracteres: Math.max(option.description?.length ?? 0, 1),
      respuesta: null,
      lleva_a: null,
    })),
  );

  protected sequenceNumber(index: number): number | null {
    return (this.block()?.mensajes_previos.length ?? 0) > 0 ? index + 1 : null;
  }

  protected promptSequenceNumber(): number | null {
    return (this.block()?.mensajes_previos.length ?? 0) > 0
      ? (this.block()?.mensajes_previos.length ?? 0) + 1
      : null;
  }

  protected listButtonMessage(): EditorMessage | null {
    const presentation = this.block()?.presentacion;
    if (!presentation) return null;
    return {
      message_key: presentation.texto_boton_key,
      label: 'Botón que abre el listado',
      content: presentation.texto_boton,
      limite_caracteres: presentation.texto_boton_limite_caracteres,
    };
  }

  protected listSectionMessage(): EditorMessage | null {
    const presentation = this.block()?.presentacion;
    if (!presentation) return null;
    return {
      message_key: presentation.titulo_seccion_key,
      label: 'Título del listado',
      content: presentation.titulo_seccion,
      limite_caracteres: presentation.titulo_seccion_limite_caracteres,
    };
  }

  protected formatLabel(): string {
    const block = this.block();
    if (!block) return '';
    if (block.formato === 'lista') {
      return `Se muestra como lista · ${block.opciones.length} opciones`;
    }
    if (block.formato === 'botones') {
      return `Se muestra como botones · ${block.opciones.length} opciones`;
    }
    return block.formato_motivo;
  }

  protected historyTime(): string {
    const rawTimestamp = this.historyTurn()?.timestamp ?? '';
    const parsed = new Date(rawTimestamp);
    if (Number.isNaN(parsed.getTime())) return rawTimestamp;
    return new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  }

  protected relayChange(change: { readonly messageKey: string; readonly content: string }): void {
    this.contentChanged.emit(change);
  }
}
