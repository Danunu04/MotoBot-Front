import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface TablaColumn {
  readonly key: string;
  readonly label: string;
  readonly align?: 'start' | 'center' | 'end';
  readonly emphasis?: boolean;
}

export interface TablaRow {
  readonly id: string;
  readonly values: Record<string, string>;
}

@Component({
  selector: 'app-tabla-component',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './tabla-component.html',
  styleUrl: './tabla-component.css',
})
export class TablaComponent {
  readonly caption = input('');
  readonly columns = input.required<readonly TablaColumn[]>();
  readonly rows = input.required<readonly TablaRow[]>();
  readonly emptyMessage = input('No hay datos para mostrar.');
  readonly loading = input(false);
  readonly loadingMessage = input('Cargando datos...');
  readonly interactiveColumnKey = input<string | null>(null);
  readonly rowClickable = input(false);
  readonly rowActivated = output<string>();

  protected activateRow(rowId: string): void {
    this.rowActivated.emit(rowId);
  }
}
