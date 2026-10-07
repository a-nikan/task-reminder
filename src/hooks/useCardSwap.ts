import { useCallback, useRef } from 'react';
import type { Task } from '../types';

/**
 * Swap (not free-move) drag & drop for task cards.
 * The view wraps its grid with gridRef + data-swap-group, passes
 * swapGroupId + onSwapCards to each TaskCard, and runs the actual
 * order change inside animateSwap so both cards glide (FLIP) with
 * a springy, playful easing.
 */
export function useCardSwap() {
  const gridRef = useRef<HTMLDivElement>(null);

  const animateSwap = useCallback(async (runSwap: () => Promise<void>) => {
    const grid = gridRef.current;
    const first = new Map<string, DOMRect>();
    if (grid) {
      grid.querySelectorAll('[data-swap-id]').forEach(el => {
        const id = el.getAttribute('data-swap-id');
        if (id) first.set(id, el.getBoundingClientRect());
      });
    }
    await runSwap();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (!grid) return;
    grid.querySelectorAll('[data-swap-id]').forEach(el => {
      const id = el.getAttribute('data-swap-id');
      const f = id ? first.get(id) : undefined;
      if (!f) return;
      const l = el.getBoundingClientRect();
      const dx = f.left - l.left;
      const dy = f.top - l.top;
      if (dx !== 0 || dy !== 0) {
        (el as HTMLElement).animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
          { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
        );
      }
    });
  }, []);

  return { gridRef, animateSwap };
}

/** Exchange the order of two tasks by swapping their order_index. */
export async function swapCardOrder(a: Task, b: Task): Promise<void> {
  const ao = (a as any).order_index ?? 0;
  const bo = (b as any).order_index ?? 0;
  const newAo = ao === bo ? ao + 0.5 : bo;
  const newBo = ao === bo ? ao : ao;
  await window.electronAPI.updateTask(a.id, { order_index: newAo });
  await window.electronAPI.updateTask(b.id, { order_index: newBo });
}
