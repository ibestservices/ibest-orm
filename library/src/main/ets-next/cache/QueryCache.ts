/**
 * 查询缓存
 */

/**
 * 缓存项
 */
interface CacheItem<T> {
  data: T;
  expireAt: number;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number; // 毫秒
  maxSize: number;
}

/**
 * 查询缓存管理器
 */
export class QueryCache {
  private cache: Map<string, CacheItem<unknown>> = new Map();
  private config: CacheConfig;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      enabled: config?.enabled ?? false,
      ttl: config?.ttl ?? 60000, // 默认 1 分钟
      maxSize: config?.maxSize ?? 1000
    };
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | undefined {
    if (!this.config.enabled) return undefined;

    const item = this.cache.get(key);
    if (!item) return undefined;

    // 检查是否过期
    if (Date.now() > item.expireAt) {
      this.cache.delete(key);
      return undefined;
    }

    return item.data as T;
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, ttl?: number): void {
    if (!this.config.enabled) return;

    // 检查缓存大小
    if (this.cache.size >= this.config.maxSize) {
      this.evict();
    }

    this.cache.set(key, {
      data,
      expireAt: Date.now() + (ttl ?? this.config.ttl)
    });
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 按表名失效缓存
   */
  invalidateByTable(tableName: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(tableName)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * 生成缓存键
   */
  static generateKey(sql: string, params?: unknown[]): string {
    const paramsStr = params ? JSON.stringify(params) : '';
    return `${sql}:${paramsStr}`;
  }

  /**
   * 启用缓存
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * 禁用缓存
   */
  disable(): void {
    this.config.enabled = false;
    this.clear();
  }

  /**
   * 是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 设置 TTL
   */
  setTTL(ttl: number): void {
    this.config.ttl = ttl;
  }

  // ========== 私有方法 ==========

  /**
   * 淘汰过期缓存
   */
  private evict(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expireAt) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    // 如果还是超过限制，删除最早的
    if (this.cache.size >= this.config.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }
}

/**
 * 全局查询缓存实例
 */
let globalCache: QueryCache | null = null;

/**
 * 获取全局缓存
 */
export function getQueryCache(): QueryCache {
  if (!globalCache) {
    globalCache = new QueryCache();
  }
  return globalCache;
}

/**
 * 初始化查询缓存
 */
export function initQueryCache(config?: Partial<CacheConfig>): QueryCache {
  globalCache = new QueryCache(config);
  return globalCache;
}
