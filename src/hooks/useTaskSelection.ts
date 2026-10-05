import { useCallback, useState } from 'react';

export function useTaskSelection() {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setSelectionMode(false);
  }, []);

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
  }, []);

  return {
    selectionMode,
    setSelectionMode,
    selectedIds,
    setSelectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    enterSelectionMode,
  };
}

export function useActiveReminders() {
  const [remindersMap, setRemindersMap] = useState<Record<string, string>>({});

  const loadReminders = async () => {
    try {
      const map = await window.electronAPI.getActiveReminders();
      setRemindersMap(map || {});
    } catch {
      setRemindersMap({});
    }
  };

  return { remindersMap, loadReminders, setRemindersMap };
}
