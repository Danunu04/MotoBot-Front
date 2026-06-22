import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import {
  TablaColumn,
  TablaComponent,
  TablaRow,
} from '../../components/tabla-component/tabla-component';
import { ChatLogDownloadService, DownloadFormat } from '../shared/chat-log-download.service';
import { ChatLogStore } from '../shared/chat-log.store';

interface FilterOption {
  readonly label: string;
  readonly value: string;
}

type PeriodFilter = 'all' | 'today' | '7d' | '30d';

interface InicioDisplayRow {
  readonly id: string;
  readonly sessionId: string;
  readonly timestamp: string;
  readonly channel: string;
  readonly environment: string;
  readonly userMessage: string;
  readonly botMessage: string;
}

@Component({
  selector: 'app-inicio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TablaComponent],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  private readonly chatLogStore = inject(ChatLogStore);
  private readonly downloadService = inject(ChatLogDownloadService);
  private readonly pageSize = 10;

  protected readonly selectedSession = signal('');
  protected readonly selectedPeriod = signal<PeriodFilter>('all');
  protected readonly currentPage = signal(1);
  protected readonly logs = this.chatLogStore.logs;
  protected readonly isLoading = this.chatLogStore.isLoading;
  protected readonly errorMessage = this.chatLogStore.errorMessage;

  protected readonly downloadFromDate = signal(this.buildDefaultFromDate());
  protected readonly downloadToDate = signal(this.buildDefaultToDate());
  protected readonly downloadFormat = signal<DownloadFormat>('pdf');
  protected readonly isDownloading = signal(false);
  protected readonly downloadError = signal('');
  protected readonly downloadEmpty = signal(false);

  protected readonly dateRangeError = computed(() => {
    const from = this.downloadFromDate();
    const to = this.downloadToDate();
    return from && to && from > to
      ? 'La fecha de inicio no puede ser posterior a la fecha de fin.'
      : '';
  });

  protected readonly tableColumns: readonly TablaColumn[] = [
    { key: 'sessionId', label: 'Chat', emphasis: true },
    { key: 'question', label: 'Usuario' },
    { key: 'answer', label: 'Bot' },
    { key: 'timestamp', label: 'Fecha' },
  ];

  protected readonly displayRows = computed<readonly InicioDisplayRow[]>(() =>
    this.buildDisplayRows(),
  );

  protected readonly sessionOptions = computed(() =>
    this.buildFilterOptions(this.logs().map((log) => log.sessionId)),
  );

  protected readonly periodOptions: readonly FilterOption[] = [
    { label: 'Todo el periodo', value: 'all' },
    { label: 'Hoy', value: 'today' },
    { label: 'Ultimos 7 dias', value: '7d' },
    { label: 'Ultimos 30 dias', value: '30d' },
  ];

  protected readonly filteredRows = computed(() =>
    this.displayRows().filter(
      (row) =>
        (!this.selectedSession() || row.sessionId === this.selectedSession()) &&
        this.matchesSelectedPeriod(row.timestamp, this.selectedPeriod()),
    ),
  );

  protected readonly tableRows = computed<readonly TablaRow[]>(() =>
    this.paginatedRows().map((row) => {
      return {
        id: row.id,
        values: {
          sessionId: `${row.sessionId}\n${row.channel} / ${row.environment}`,
          question: row.userMessage,
          answer: row.botMessage,
          timestamp: row.timestamp,
        },
      }
    }),
  );

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize)),
  );

  protected readonly paginatedRows = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;

    return this.filteredRows().slice(start, start + this.pageSize);
  });

  protected readonly paginationLabel = computed(() => {
    if (!this.filteredRows().length) {
      return 'Sin resultados';
    }

    const start = (this.currentPage() - 1) * this.pageSize + 1;
    const end = Math.min(start + this.pageSize - 1, this.filteredRows().length);

    return `${start}-${end} de ${this.filteredRows().length}`;
  });

  protected readonly emptyTableMessage = computed(() => {
    if (this.errorMessage()) {
      return this.errorMessage();
    }

    return this.logs().length
      ? 'No hay resultados para los filtros seleccionados.'
      : 'No hay mensajes historicos todavia.';
  });

  protected readonly totalMessages = computed(() => this.logs().length);
  protected readonly visibleMessages = computed(() => this.filteredRows().length);
  protected readonly sessionCount = computed(() => new Set(this.logs().map((log) => log.sessionId)).size);

  constructor() {
    this.chatLogStore.load();
    effect(() => {
      const totalPages = this.totalPages();
      const currentPage = this.currentPage();

      if (currentPage > totalPages) {
        this.currentPage.set(totalPages);
      }
    });
  }

  protected printLogs(): void {
    globalThis.print();
  }

  protected clearFilters(): void {
    this.selectedSession.set('');
    this.selectedPeriod.set('all');
    this.currentPage.set(1);
  }

  protected updateSelectedSession(value: string): void {
    this.selectedSession.set(value);
    this.currentPage.set(1);
  }

  protected updateSelectedPeriod(value: string): void {
    this.selectedPeriod.set(this.isPeriodFilter(value) ? value : 'all');
    this.currentPage.set(1);
  }

  protected goToPreviousPage(): void {
    this.currentPage.update((page) => Math.max(1, page - 1));
  }

  protected goToNextPage(): void {
    this.currentPage.update((page) => Math.min(this.totalPages(), page + 1));
  }
  private buildFilterOptions(values: readonly string[]): readonly FilterOption[] {
    return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)).map(
      (value) => ({
        label: value,
        value,
      }),
    );
  }

  private buildDisplayRows(): readonly InicioDisplayRow[] {
    return this.logs().map((log, index, logs) => {
      const question = log.question.trim();
      const answer = log.answer.trim();

      if (this.isBotManualMessage(question)) {
        const previousLog = logs[index - 1];
        const previousAnswer = previousLog?.answer.trim() ?? '';
        const previousQuestion = previousLog?.question.trim() ?? '';
        const hasExpectedPreviousMessage = this.isWaitingAgentMessage(previousAnswer);

        return {
          id: log.id,
          sessionId: log.sessionId,
          timestamp: log.timestamp,
          channel: log.channel,
          environment: log.environment,
          userMessage: hasExpectedPreviousMessage ? previousQuestion || '-' : '-',
          botMessage: hasExpectedPreviousMessage ? this.stripTag(answer) || '-' : '-',
        };
      }

      return {
        id: log.id,
        sessionId: log.sessionId,
        timestamp: log.timestamp,
        channel: log.channel,
        environment: log.environment,
        userMessage: this.isBracketOnlyMessage(question) ? '' : this.stripTag(question),
        botMessage: this.isBracketOnlyMessage(answer) ? '' : this.stripTag(answer),
      };
    });
  }

  private isBotManualMessage(message: string): boolean {
    const normalizedMessage = message.toUpperCase();

    return normalizedMessage.startsWith('[BOT-MANUAL]');
  }

  private isWaitingAgentMessage(message: string): boolean {
    return message.toUpperCase() === '[EN ESPERA DE AGENTE]';
  }

  private isBracketOnlyMessage(message: string): boolean {
    return /^\[[^\]]+\]$/.test(message);
  }

  private stripTag(message: string): string {
    return message.replace(/^\[[^\]]+\]\s*/gi, '').trim();
  }

  protected updateDownloadFromDate(value: string): void {
    this.downloadFromDate.set(value);
    this.downloadError.set('');
    this.downloadEmpty.set(false);
  }

  protected updateDownloadToDate(value: string): void {
    this.downloadToDate.set(value);
    this.downloadError.set('');
    this.downloadEmpty.set(false);
  }

  protected updateDownloadFormat(value: string): void {
    if (value === 'pdf' || value === 'json' || value === 'csv') {
      this.downloadFormat.set(value);
    }
  }

  protected downloadConversations(): void {
    if (this.dateRangeError() || this.isDownloading()) {
      return;
    }

    const from = this.downloadFromDate();
    const to = this.downloadToDate();
    const format = this.downloadFormat();

    this.isDownloading.set(true);
    this.downloadError.set('');
    this.downloadEmpty.set(false);

    this.downloadService.download({ from, to, format }).subscribe({
      next: (blob) => {
        this.isDownloading.set(false);

        if (blob.size === 0) {
          this.downloadEmpty.set(true);
          return;
        }

        const fromStr = from.replace(/-/g, '');
        const toStr = to.replace(/-/g, '');
        const filename = `chat_log_${fromStr}_${toStr}.${format}`;
        const objectUrl = URL.createObjectURL(blob);
        const anchor = globalThis.document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
      },
      error: (error: unknown) => {
        this.isDownloading.set(false);
        const status =
          typeof error === 'object' && error !== null && 'status' in error
            ? (error as { status: unknown }).status
            : null;
        if (status === 404 || status === 204) {
          this.downloadEmpty.set(true);
        } else {
          this.downloadError.set('No se pudo descargar el archivo. Intentá de nuevo más tarde.');
        }
      },
    });
  }

  private buildDefaultFromDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  }

  private buildDefaultToDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private isPeriodFilter(value: string): value is PeriodFilter {
    return value === 'all' || value === 'today' || value === '7d' || value === '30d';
  }

  private matchesSelectedPeriod(timestamp: string, period: PeriodFilter): boolean {
    if (period === 'all') {
      return true;
    }

    const [day, month, yearAndTime] = timestamp.split('/');
    const year = yearAndTime?.split(',')[0];
    const parsedDate = new Date(`${year}-${month}-${day}`);

    if (Number.isNaN(parsedDate.getTime())) {
      return true;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const entryDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
    const diffDays = Math.floor((today.getTime() - entryDate.getTime()) / 86_400_000);

    if (period === 'today') {
      return diffDays === 0;
    }

    if (period === '7d') {
      return diffDays >= 0 && diffDays < 7;
    }

    return diffDays >= 0 && diffDays < 30;
  }
}
