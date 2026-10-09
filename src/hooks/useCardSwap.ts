import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '../types';

/**
 * Insertion reorder (not swap) for task cards.
 * The view wraps its grid with gridRef + data-swap-group, renders the
 * dropIndicator line, and performs the insertion from dropTargetRef.
 */
export function useCardSwap() {
  const gridRef = useRef<HTMLDivElement>(null);
  // The drop line is painted via direct DOM writes (no React state) so it
  // tracks the pointer with zero re-renders, even on slow devices.
  const indicatorRef = useRef<HTMLDivElement>(null);
  // Single source of truth for the drop target (set during moves, read on drop)
  const dropTargetRef = useRef<{ targetId: string; before: boolean } | null>(null);

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

  /** Compute insertion point under the pointer; null when not over this grid. */
  const updateDropTarget = useCallback((clientX: number, clientY: number, draggedId: string) => {
    const grid = gridRef.current;
    if (!grid) return null;
    const groupId = grid.getAttribute('data-swap-group');
    const under = document.elementFromPoint(clientX, clientY);
    const itemEl = under?.closest?.('[data-swap-id]') as HTMLElement | null;
    const groupEl = under?.closest?.('[data-swap-group]') as HTMLElement | null;

    let pick: { el: HTMLElement; before: boolean } | null = null;
    if (itemEl && groupEl && groupEl.getAttribute('data-swap-group') === groupId) {
      const targetId = itemEl.getAttribute('data-swap-id');
      if (targetId && targetId !== draggedId) {
        const rect = itemEl.getBoundingClientRect();
        pick = { el: itemEl, before: clientY < rect.top + rect.height / 2 };
      }
    }
    if (!pick) {
      // Inside the grid but over a gap: snap to the nearest EDGE (not center)
      // so the line always lands exactly on a border, even between items
      const gridRect = grid.getBoundingClientRect();
      if (clientX >= gridRect.left && clientX <= gridRect.right && clientY >= gridRect.top && clientY <= gridRect.bottom) {
        let best: HTMLElement | null = null;
        let bestD = Infinity;
        let bestBefore = true;
        grid.querySelectorAll('[data-swap-id]').forEach(el => {
          const id = el.getAttribute('data-swap-id');
          if (!id || id === draggedId) return;
          const r = (el as HTMLElement).getBoundingClientRect();
          const dx = clientX < r.left ? r.left - clientX : clientX > r.right ? clientX - r.right : 0;
          const dTop = Math.abs(clientY - r.top);
          const dBottom = Math.abs(clientY - r.bottom);
          const d = Math.min(dTop, dBottom) + dx;
          if (d < bestD) {
            bestD = d;
            best = el as HTMLElement;
            bestBefore = dTop <= dBottom;
          }
        });
        if (best) pick = { el: best, before: bestBefore };
      }
    }
    if (!pick) {
      paintIndicator(null);
      dropTargetRef.current = null;
      return null;
    }
    const rect = pick.el.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    // -1px centers the 2-3px line exactly on the border
    const x = rect.left - gridRect.left;
    const y = (pick.before ? rect.top : rect.bottom) - gridRect.top - 1;
    paintIndicator(x, y, rect.width);
    const res = { targetId: pick.el.getAttribute('data-swap-id') as string, before: pick.before };
    dropTargetRef.current = res;
    return res;
  }, []);

  function paintIndicator(x: number | null, y?: number, w?: number): void {
    const el = indicatorRef.current;
    if (!el) return;
    if (x === null) {
      el.style.display = 'none';
    } else {
      el.style.display = 'block';
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.width = `${w}px`;
    }
  }

  const clearDropIndicator = useCallback(() => {
    paintIndicator(null);
    dropTargetRef.current = null;
  }, []);

  return { gridRef, indicatorRef, dropTargetRef, animateSwap, updateDropTarget, clearDropIndicator };
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
  onDrop: (draggedId: string) => void;
  onDragMove?: (clientX: number, clientY: number, draggedId: string) => void;
  onDragEnd?: () => void;
}

/**
 * Pointer-based drag logic shared by cards and subtask rows.
 * Drag onto another item: a line shows where it will be inserted;
 * release inserts before/after the target (no swap).
 */
export function useSwapDrag({ groupId, itemId, disabled, onDrop, onDragMove, onDragEnd }: SwapDragOpts) {
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const info = useRef<{ startX: number; startY: number; active: boolean } | null>(null);
  const lastPos = useRef({ x: 0, y: 0 });
  const live = useRef({ groupId, itemId, onDrop, onDragEnd });
  useEffect(() => {
    live.current = { groupId, itemId, onDrop, onDragEnd };
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const { groupId: g, itemId: id } = live.current;
    if (disabled || !g) return;
    e.stopPropagation();
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    info.current = { startX: e.clientX, startY: e.clientY, active: false };
    lastPos.current = { x: e.clientX, y: e.clientY };
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
    lastPos.current = { x: e.clientX, y: e.clientY };
    setDragOffset({ x: dx, y: dy });
    if (live.current.groupId) onDragMove?.(e.clientX, e.clientY, live.current.itemId);
  };

  const finish = (allowDrop: boolean) => {
    const st = info.current;
    info.current = null;
    if (!st) return;
    clearSwapTarget();
    setDragging(false);
    setDragOffset({ x: 0, y: 0 });
    const { itemId: id, onDrop: drop, onDragEnd: end } = live.current;
    // Read the drop target FIRST (views read dropTargetRef synchronously),
    // then clear the line — never the other way around.
    if (allowDrop && st.active) {
      void drop(id);
    }
    end?.();
  };

  // Backup: if pointer capture is lost mid-gesture (node replaced, touch
  // interruption), the handle's own listeners may never fire. Window-level
  // listeners guarantee the drag always finishes. finish() is idempotent.
  useEffect(() => {
    if (!dragging) return;
    const onUp = () => finish(true);
    const onCancel = () => finish(true);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const dragHandleProps = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: () => finish(true),
    // Treat cancel as a drop too: a real hover target must exist for anything
    // to happen (otherwise no-op), and on touch this is what actually fires.
    onPointerCancel: () => finish(true),
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
