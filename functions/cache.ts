// 内存 LRU + TTL 缓存（isolate 内 best-effort）。可注入时钟便于单测 TTL/逐出。
export class LruTtlCache {
  private map = new Map<string, { value: unknown; expires: number }>();
  constructor(
    private max = 500,
    private now: () => number = Date.now,
  ) {}

  get(key: string): unknown | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry); // LRU 刷新到最新
    return entry.value;
  }

  set(key: string, value: unknown, ttlMs: number): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expires: this.now() + ttlMs });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value as string;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }
}