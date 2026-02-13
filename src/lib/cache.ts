// 简单内存缓存层 — 避免短时间重复请求东方财富

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTTL: number;

  constructor(defaultTTL = 15000) { // 默认 15 秒
    this.defaultTTL = defaultTTL;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    // 防止缓存无限增长
    if (this.cache.size > 500) {
      this.cleanup();
    }
    this.cache.set(key, { data, timestamp: Date.now() });
    if (ttl) {
      setTimeout(() => this.cache.delete(key), ttl);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.defaultTTL) {
        this.cache.delete(key);
      }
    }
    // 如果还是太多，删最旧的一半
    if (this.cache.size > 400) {
      const entries = [...this.cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
      entries.slice(0, entries.length / 2).forEach(([key]) => this.cache.delete(key));
    }
  }
}

// 全局缓存实例
export const apiCache = new MemoryCache(15000);  // 行情 15 秒
export const newsCache = new MemoryCache(300000); // 资讯 5 分钟
export const sectorCache = new MemoryCache(60000); // 板块 1 分钟
