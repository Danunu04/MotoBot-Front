import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  BotOptionsService,
  OptionGroupSummary,
} from '../shared/bot-options.service';
import { BotMessagesService, extractApiError } from '../shared/bot-messages.service';

@Component({
  selector: 'app-editor-opciones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './editor-opciones.html',
  styleUrl: './editor-opciones.css',
})
export class EditorOpciones implements OnInit {
  private readonly service = inject(BotOptionsService);
  private readonly messagesService = inject(BotMessagesService);
  private readonly router = inject(Router);

  protected readonly groups = signal<readonly OptionGroupSummary[]>([]);
  protected readonly messageMap = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');

  ngOnInit(): void {
    this.loadData();
  }

  protected goToGroup(group: string): void {
    this.router.navigate(['/editor-opciones', group]);
  }

  protected interactiveLabel(type: string | null): string {
    if (type === 'button') return 'Botones';
    if (type === 'list') return 'Lista';
    return 'Sin opciones';
  }

  protected formatGroupName(name: string): string {
    const s = name.replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  protected resolvedText(key: string): string {
    return this.messageMap().get(key) ?? '';
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    forkJoin([
      this.service.getGroups(),
      this.messagesService.getMessages(),
    ]).subscribe({
      next: ([groups, msgs]) => {
        this.groups.set(groups);
        this.messageMap.set(new Map(msgs.map((m) => [m.key, m.content])));
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.errorMessage.set(extractApiError(err));
        this.isLoading.set(false);
      },
    });
  }
}
