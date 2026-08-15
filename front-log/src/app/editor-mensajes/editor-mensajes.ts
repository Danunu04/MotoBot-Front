import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { BotMessagesService } from '../shared/bot-messages.service';
import {
  DestinationChoice,
  EditorBlock,
  EditorBlocksService,
  EditorMessage,
  EditorOption,
  MessageCopyChoice,
  FlowState,
  isConditionalDestination,
} from '../shared/editor-blocks.service';
import { EditorStorageState } from '../shared/editor-storage-state.service';
import { BloqueConversacionCard } from './bloque-conversacion-card/bloque-conversacion-card';
import { RecorridoConversacionNav } from './recorrido-conversacion-nav/recorrido-conversacion-nav';

@Component({
  selector: 'app-editor-mensajes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BloqueConversacionCard, ReactiveFormsModule, RecorridoConversacionNav],
  templateUrl: './editor-mensajes.html',
  styleUrl: './editor-mensajes.css',
})
export class EditorMensajes {
  private readonly editorBlocksService = inject(EditorBlocksService);
  private readonly botMessagesService = inject(BotMessagesService);
  private readonly editorStorageState = inject(EditorStorageState);

  protected readonly blocks = signal<readonly EditorBlock[]>([]);
  protected readonly flowStates = signal<readonly FlowState[]>([]);
  protected readonly responseChoices = signal<readonly MessageCopyChoice[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly storage = this.editorStorageState.status;
  protected readonly activeBlockId = signal<string | null>(null);
  protected readonly updatedBy = new FormControl('', { nonNullable: true });

  protected readonly orderedBlocks = computed(() =>
    [...this.blocks()].sort((left, right) => left.orden_recorrido - right.orden_recorrido),
  );
  protected readonly destinationChoices = computed(() =>
    this.buildDestinationChoices(this.blocks(), this.flowStates()),
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    forkJoin({
      blocks: this.editorBlocksService.getBlocks(),
      messages: this.botMessagesService.getMessages(),
      states: this.editorBlocksService.getFlowStates(),
    }).subscribe({
      next: ({ blocks: snapshot, messages, states }) => {
        const blocks = snapshot.blocks;
        this.blocks.set(blocks);
        this.editorStorageState.setStatus(snapshot.storage);
        this.flowStates.set(states);
        this.responseChoices.set(
          messages
            .filter((message) => message.type === 'text')
            .map((message) => ({
              message_key: message.key,
              label: message.label,
              content: message.content,
            })),
        );
        if (!this.activeBlockId() && blocks.length > 0) {
          this.activeBlockId.set(blocks[0].block_id);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.editorStorageState.setStatus({ writable: false, message: null });
        this.errorMessage.set('No se pudo cargar el recorrido. Intentá de nuevo.');
        this.isLoading.set(false);
      },
    });
  }

  protected scrollToBlock(blockId: string): void {
    this.activeBlockId.set(blockId);
    globalThis.setTimeout(() => {
      const wrapper = globalThis.document.getElementById(this.domId(blockId));
      wrapper?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      wrapper?.querySelector<HTMLElement>('article')?.focus({ preventScroll: true });
    });
  }

  protected domId(blockId: string): string {
    return `conversation-block-${blockId}`;
  }

  protected updateResolvedContent(change: {
    readonly messageKey: string;
    readonly content: string;
  }): void {
    this.blocks.update((blocks) =>
      blocks.map((block) => this.updateBlockMessage(block, change.messageKey, change.content)),
    );
    this.responseChoices.update((choices) =>
      choices.map((choice) =>
        choice.message_key === change.messageKey ? { ...choice, content: change.content } : choice,
      ),
    );
  }

  protected replaceBlock(updatedBlock: EditorBlock): void {
    this.blocks.update((blocks) =>
      blocks.map((block) => (block.block_id === updatedBlock.block_id ? updatedBlock : block)),
    );
    const returnedResponses = updatedBlock.opciones
      .map((option) => option.respuesta)
      .filter((message): message is EditorMessage => message !== null);
    this.responseChoices.update((current) => {
      const next = [...current];
      for (const message of returnedResponses) {
        const existingIndex = next.findIndex((choice) => choice.message_key === message.message_key);
        const choice = {
          message_key: message.message_key,
          label: message.label,
          content: message.content,
        };
        if (existingIndex >= 0) next[existingIndex] = choice;
        else next.push(choice);
      }
      return next;
    });
  }

  protected isFirstOtherMoment(index: number): boolean {
    const blocks = this.orderedBlocks();
    return (
      blocks[index]?.grupo_recorrido === 'otros_momentos' &&
      blocks[index - 1]?.grupo_recorrido !== 'otros_momentos'
    );
  }

  private buildDestinationChoices(
    blocks: readonly EditorBlock[],
    states: readonly FlowState[],
  ): readonly DestinationChoice[] {
    const choices = new Map<string, DestinationChoice>();
    const add = (choice: DestinationChoice): void => {
      const key = `${choice.state_id}|${choice.block_id ?? ''}`;
      if (!choices.has(key)) choices.set(key, choice);
    };

    for (const block of blocks) {
      for (const option of block.opciones) {
        const destination = option.lleva_a;
        if (!destination) continue;
        if (isConditionalDestination(destination)) {
          destination.destinos_posibles.forEach((possible) =>
            add({
              state_id: possible.state_id,
              block_id: possible.block_id,
              label: possible.label,
            }),
          );
        } else {
          add({
            state_id: destination.state_id,
            block_id: destination.block_id,
            label: destination.label,
          });
        }
      }
    }

    const representedStates = new Set([...choices.values()].map((choice) => choice.state_id));
    states.forEach((state) => {
      if (!representedStates.has(state.state_id)) {
        add({ state_id: state.state_id, block_id: null, label: state.label });
      }
    });

    const orderByBlock = new Map(blocks.map((block) => [block.block_id, block.orden_recorrido]));
    return [...choices.values()].sort((left, right) => {
      const leftOrder = left.block_id ? (orderByBlock.get(left.block_id) ?? Number.MAX_VALUE) : Number.MAX_VALUE;
      const rightOrder = right.block_id ? (orderByBlock.get(right.block_id) ?? Number.MAX_VALUE) : Number.MAX_VALUE;
      return leftOrder - rightOrder || left.label.localeCompare(right.label, 'es');
    });
  }

  private updateBlockMessage(block: EditorBlock, key: string, content: string): EditorBlock {
    const updateMessage = (message: EditorMessage): EditorMessage =>
      message.message_key === key ? { ...message, content } : message;
    const updateOption = (option: EditorOption): EditorOption => ({
      ...option,
      titulo: option.titulo_key === key ? content : option.titulo,
      titulo_boton: option.titulo_boton_key === key ? content : option.titulo_boton,
      descripcion: option.descripcion_key === key ? content : option.descripcion,
      respuesta: option.respuesta ? updateMessage(option.respuesta) : null,
    });
    const presentation = block.presentacion
      ? {
          ...block.presentacion,
          texto_boton:
            block.presentacion.texto_boton_key === key
              ? content
              : block.presentacion.texto_boton,
          titulo_seccion:
            block.presentacion.titulo_seccion_key === key
              ? content
              : block.presentacion.titulo_seccion,
        }
      : null;
    return {
      ...block,
      mensajes_previos: block.mensajes_previos.map(updateMessage),
      prompt: updateMessage(block.prompt),
      presentacion: presentation,
      opciones: block.opciones.map(updateOption),
    };
  }
}
