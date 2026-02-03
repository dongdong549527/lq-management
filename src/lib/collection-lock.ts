// 简单的内存锁，用于防止同一设备（Topic）并发采集
// 注意：这在单实例部署（如 VPS、Docker）中有效。
// 如果是 Serverless 环境（如 Vercel），需要使用 Redis 或数据库来实现分布式锁。

class CollectionLock {
  private locks: Set<string> = new Set();

  // 尝试获取锁
  acquire(key: string): boolean {
    if (this.locks.has(key)) {
      return false;
    }
    this.locks.add(key);
    return true;
  }

  // 释放锁
  release(key: string): void {
    this.locks.delete(key);
  }

  // 检查是否锁定
  isLocked(key: string): boolean {
    return this.locks.has(key);
  }
}

// 导出单例
export const collectionLock = new CollectionLock();
