import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import { useState, useEffect, useCallback } from 'react';
import type { IMemeRecord } from '@/data/meme';

const STORAGE_KEY = '__app_meme_generator_history';
const MAX_HISTORY = 20;

function loadHistory(): IMemeRecord[] {
  try {
    const raw = scopedStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as IMemeRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveHistory(records: IMemeRecord[]) {
  try {
    scopedStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_HISTORY)));
  } catch {
    // ignore
  }
}

export function useMemeHistory() {
  const [history, setHistory] = useState<IMemeRecord[]>(() => loadHistory());

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const addRecord = useCallback((record: IMemeRecord) => {
    setHistory((prev) => {
      const filtered = prev.filter((r) => r.id !== record.id);
      return [record, ...filtered].slice(0, MAX_HISTORY);
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return { history, addRecord, clearHistory };
}
