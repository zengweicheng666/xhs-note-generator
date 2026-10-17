import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import { useState, useEffect, useCallback } from 'react';
import type { INoteRecord } from '@/data/note';

const STORAGE_KEY = '__app_note_generator_history';
const MAX_HISTORY = 20;

function loadHistory(): INoteRecord[] {
  try {
    const raw = scopedStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as INoteRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveHistory(records: INoteRecord[]) {
  try {
    scopedStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_HISTORY)));
  } catch {
    // ignore
  }
}

export function useNoteHistory() {
  const [history, setHistory] = useState<INoteRecord[]>(() => loadHistory());

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const addRecord = useCallback((record: INoteRecord) => {
    setHistory((prev) => {
      const filtered = prev.filter((r) => r.id !== record.id);
      return [record, ...filtered].slice(0, MAX_HISTORY);
    });
  }, []);

  /** 按 id 覆盖更新已有记录（如单独重生成某张配图后） */
  const updateRecord = useCallback((record: INoteRecord) => {
    setHistory((prev) => prev.map((r) => (r.id === record.id ? record : r)));
  }, []);

  /** 按 id 删除单条记录 */
  const deleteRecord = useCallback((id: string) => {
    setHistory((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return { history, addRecord, updateRecord, deleteRecord, clearHistory };
}
