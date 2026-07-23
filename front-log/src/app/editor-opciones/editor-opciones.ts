import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  BotOptionsService,
  OptionGroupSummary,
} from '../shared/bot-options.service';
import { extractApiError } from '../shared/bot-messages.service';

@Component({
  selector: 'app-editor-opciones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './editor-opciones.html',
  styleUrl: './editor-opciones.css',
})
export class EditorOpciones implements OnInit {
  private readonly service = inject(BotOptionsService);
  private readonly router = inject(Router);

  protected readonly groups = signal<readonly OptionGroupSummary[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');

  ngOnInit(): void {
    this.loadGroups();
  }

  protected goToGroup(group: string): void {
    this.router.navigate(['/editor-opciones', group]);
  }

  protected interactiveLabel(type: string | null): string {
    if (type === 'button') return 'Botones';
    if (type === 'list') return 'Lista';
    return 'Sin opciones';
  }

  private loadGroups(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.service.getGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.errorMessage.set(extractApiError(err));
        this.isLoading.set(false);
      },
    });
  }
}
