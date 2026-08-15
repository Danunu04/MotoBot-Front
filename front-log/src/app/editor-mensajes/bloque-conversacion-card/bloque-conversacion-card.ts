import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';

import { VistaConversacion } from '../../../components/vista-conversacion/vista-conversacion';
import {
  DestinationChoice,
  EditorBlock,
  MessageCopyChoice,
} from '../../shared/editor-blocks.service';
import { AltaOpcionPanel } from '../alta-opcion-panel/alta-opcion-panel';

@Component({
  selector: 'app-bloque-conversacion-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AltaOpcionPanel, VistaConversacion],
  templateUrl: './bloque-conversacion-card.html',
  styleUrl: './bloque-conversacion-card.css',
})
export class BloqueConversacionCard {
  readonly block = input.required<EditorBlock>();
  readonly responses = input.required<readonly MessageCopyChoice[]>();
  readonly destinations = input.required<readonly DestinationChoice[]>();
  readonly updatedBy = input('');
  readonly readonlyView = input(false);

  readonly navigateTo = output<string>();
  readonly contentChanged = output<{ readonly messageKey: string; readonly content: string }>();
  readonly reloadRequested = output<void>();
  readonly blockChanged = output<EditorBlock>();

  protected readonly showAddOption = signal(false);

  constructor() {
    effect(() => {
      if (this.readonlyView()) this.showAddOption.set(false);
    });
  }

  protected handleCreated(block: EditorBlock): void {
    this.showAddOption.set(false);
    this.blockChanged.emit(block);
  }
}
