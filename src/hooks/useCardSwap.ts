import { useCallback, useEffect, useRef, useState } from 'react';
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

function clearSwapTarget(): void {
  document.querySelectorAll('.swap-target').forEach(el => el.classList.remove('swap-target'));
}

interface SwapDragOpts {
  groupId: string | null | undefined;
  itemId: string;
  disabled?: boolean;
  onDrop: (draggedId: string, targetId: string) => void;
}

/**
 * Pointer-based swap drag logic shared by cards and subtask rows.
 * Drag the handle onto another item of the same group to exchange places.
 * No freeform movement — drop target glows, release swaps.
 */
export function useSwapDrag({ groupId, itemId, disabled, onDrop }: SwapDragOpts) {
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const info = useRef<{ startX: number; startY: number; active: boolean } | null>(null);
  const live = useRef({ groupId, itemId, onDrop });
  useEffect(() => {
    live.current = { groupId, itemId, onDrop };
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const { groupId: g, itemId: id } = live.current;
    if (disabled || !g) return;
    e.stopPropagation();
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    info.current = { startX: e.clientX, startY: e.clientY, active: false };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const st = info.current;
    if (!st) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.active) {
      if (Math.hypot(dx, dy) < 7) return;
      st.active = true;
      setDragging(true);
    }
    setDragOffset({ x: dx, y: dy });
    clearSwapTarget();
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const itemEl = under?.closest?.('[data-swap-id]') as HTMLElement | null;
    const groupEl = under?.closest?.('[data-swap-group]') as HTMLElement | null;
    const { groupId: g, itemId: id } = live.current;
    if (itemEl && groupEl && groupEl.getAttribute('data-swap-group') === g) {
      const targetId = itemEl.getAttribute('data-swap-id');
      if (targetId && targetId !== id) itemEl.classList.add('swap-target');
    }
  };

  const finish = (allowDrop: boolean) => {
    const st = info.current;
    info.current = null;
    if (!st) return;
    const target = document.querySelector('.swap-target') as HTMLElement | null;
    const targetId = target?.getAttribute('data-swap-id');
    clearSwapTarget();
    setDragging(false);
    setDragOffset({ x: 0, y: 0 });
    const { itemId: id, onDrop: drop } = live.current;
    if (allowDrop && st.active && targetId && targetId !== id) {
      void drop(id, targetId);
    }
  };

  const dragHandleProps = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: () => finish(true),
    onPointerCancel: () => finish(false),
    onClick: (e: React.SyntheticEvent) => e.stopPropagation(),
    onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
  };

  return {
    draggable: !!groupId && !disabled,
    dragHandleProps,
    dragging,
    dragOffset,
  };
}
