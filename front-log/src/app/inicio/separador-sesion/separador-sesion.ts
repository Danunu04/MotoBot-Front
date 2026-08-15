import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-separador-sesion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './separador-sesion.html',
  styleUrl: './separador-sesion.css',
})
export class SeparadorSesion {
  readonly date = input.required<string>();

  protected readonly label = computed(() => {
    const rawDate = this.date();
    const simpleDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate);
    const parsed = simpleDate
      ? new Date(Number(simpleDate[1]), Number(simpleDate[2]) - 1, Number(simpleDate[3]))
      : new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return rawDate;
    return new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' }).format(parsed);
  });
}
