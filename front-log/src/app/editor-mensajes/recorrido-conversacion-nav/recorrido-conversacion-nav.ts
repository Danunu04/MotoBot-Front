import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import {
  EditorBlock,
  isConditionalDestination,
} from '../../shared/editor-blocks.service';

interface ConversationNavNode {
  readonly block: EditorBlock;
  readonly children: readonly ConversationNavNode[];
}

interface VisibleNavItem {
  readonly block: EditorBlock;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
}

export function buildConversationTree(
  blocks: readonly EditorBlock[],
): readonly ConversationNavNode[] {
  const mainBlocks = [...blocks]
    .filter((block) => block.grupo_recorrido === 'recorrido_principal')
    .sort((left, right) => left.orden_recorrido - right.orden_recorrido);
  const byId = new Map(mainBlocks.map((block) => [block.block_id, block]));
  const assigned = new Set<string>();
  const childrenByParent = new Map<string, string[]>();

  const childIds = (block: EditorBlock): readonly string[] => {
    const ids: string[] = [];
    for (const option of block.opciones) {
      const destination = option.lleva_a;
      if (!destination) continue;
      if (isConditionalDestination(destination)) {
        ids.push(...destination.destinos_posibles.map((possible) => possible.block_id));
      } else if (destination.block_id) {
        ids.push(destination.block_id);
      }
    }
    return [...new Set(ids)]
      .filter((id) => byId.has(id))
      .sort(
        (left, right) =>
          (byId.get(left)?.orden_recorrido ?? 0) -
          (byId.get(right)?.orden_recorrido ?? 0),
      );
  };

  const rootIds: string[] = [];
  const assignBreadthFirst = (rootId: string): void => {
    if (assigned.has(rootId)) return;
    rootIds.push(rootId);
    assigned.add(rootId);
    const queue = [rootId];
    for (let index = 0; index < queue.length; index += 1) {
      const parentId = queue[index];
      const parent = byId.get(parentId);
      if (!parent) continue;
      for (const childId of childIds(parent)) {
        if (assigned.has(childId)) continue;
        assigned.add(childId);
        const children = childrenByParent.get(parentId) ?? [];
        children.push(childId);
        childrenByParent.set(parentId, children);
        queue.push(childId);
      }
    }
  };

  for (const block of mainBlocks) {
    assignBreadthFirst(block.block_id);
  }

  const toNode = (blockId: string): ConversationNavNode => ({
    block: byId.get(blockId)!,
    children: (childrenByParent.get(blockId) ?? []).map(toNode),
  });
  return rootIds.map(toNode);
}

@Component({
  selector: 'app-recorrido-conversacion-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './recorrido-conversacion-nav.html',
  styleUrl: './recorrido-conversacion-nav.css',
})
export class RecorridoConversacionNav {
  readonly blocks = input.required<readonly EditorBlock[]>();
  readonly activeBlockId = input<string | null>(null);
  readonly blockSelected = output<string>();

  private readonly collapsed = signal<ReadonlySet<string>>(new Set());
  protected readonly othersCollapsed = signal(false);
  protected readonly tree = computed(() => buildConversationTree(this.blocks()));
  protected readonly otherBlocks = computed(() =>
    [...this.blocks()]
      .filter((block) => block.grupo_recorrido === 'otros_momentos')
      .sort((left, right) => left.orden_recorrido - right.orden_recorrido),
  );
  protected readonly visibleItems = computed<readonly VisibleNavItem[]>(() => {
    const items: VisibleNavItem[] = [];
    const collapsed = this.collapsed();
    const append = (node: ConversationNavNode, depth: number): void => {
      const expanded = !collapsed.has(node.block.block_id);
      items.push({
        block: node.block,
        depth,
        hasChildren: node.children.length > 0,
        expanded,
      });
      if (expanded) node.children.forEach((child) => append(child, depth + 1));
    };
    this.tree().forEach((root) => append(root, 0));
    return items;
  });

  protected toggle(blockId: string): void {
    this.collapsed.update((current) => {
      const next = new Set(current);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }

  protected select(blockId: string): void {
    this.blockSelected.emit(blockId);
  }
}
