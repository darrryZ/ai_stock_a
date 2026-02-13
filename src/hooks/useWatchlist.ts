'use client';

import { useState, useEffect, useCallback } from 'react';

export interface WatchlistItem {
  code: string;        // sh600519
  name: string;
  addedAt: number;     // timestamp
}

const STORAGE_KEY = 'stock-watchlist';

function loadWatchlist(): WatchlistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWatchlist(items: WatchlistItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 初始化加载
  useEffect(() => {
    setWatchlist(loadWatchlist());
    setLoaded(true);
  }, []);

  // 添加自选
  const addStock = useCallback((code: string, name: string) => {
    setWatchlist((prev) => {
      if (prev.some((item) => item.code === code)) return prev;
      const next = [{ code, name, addedAt: Date.now() }, ...prev];
      saveWatchlist(next);
      return next;
    });
  }, []);

  // 删除自选
  const removeStock = useCallback((code: string) => {
    setWatchlist((prev) => {
      const next = prev.filter((item) => item.code !== code);
      saveWatchlist(next);
      return next;
    });
  }, []);

  // 是否已收藏
  const isInWatchlist = useCallback(
    (code: string) => watchlist.some((item) => item.code === code),
    [watchlist]
  );

  // 切换收藏
  const toggleStock = useCallback(
    (code: string, name: string) => {
      if (isInWatchlist(code)) {
        removeStock(code);
      } else {
        addStock(code, name);
      }
    },
    [isInWatchlist, addStock, removeStock]
  );

  return { watchlist, loaded, addStock, removeStock, isInWatchlist, toggleStock };
}
