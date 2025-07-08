/**
 * 並行処理安全性システム
 * 
 * 複数の非同期処理が同時に実行されることによる競合状態を防止し、
 * データの整合性を保証するためのシステム
 */

// ミューテックス（排他制御）の実装
export class Mutex {
  private locked = false;
  private waitingQueue: Array<() => void> = [];

  /**
   * ミューテックスを取得（ロック）する
   * 既にロック中の場合は、解放されるまで待機
   */
  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    // 既にロック中の場合は待機キューに登録
    return new Promise<void>((resolve) => {
      this.waitingQueue.push(resolve);
    });
  }

  /**
   * ミューテックスを解放（アンロック）する
   */
  release(): void {
    if (!this.locked) {
      console.warn('⚠️ ロックされていないミューテックスを解放しようとしました');
      return;
    }

    if (this.waitingQueue.length > 0) {
      // 待機中のタスクがある場合は次のタスクを実行
      const nextResolve = this.waitingQueue.shift();
      if (nextResolve) {
        nextResolve();
      }
    } else {
      // 待機中のタスクがない場合はロックを解放
      this.locked = false;
    }
  }

  /**
   * ミューテックス内で関数を安全に実行
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * 現在のロック状態を取得
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * 待機中のタスク数を取得
   */
  getWaitingCount(): number {
    return this.waitingQueue.length;
  }
}

// セマフォ（リソース数制限）の実装
export class Semaphore {
  private permits: number;
  private maxPermits: number;
  private waitingQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
    this.maxPermits = permits;
  }

  /**
   * セマフォを取得（リソースを1つ確保）
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    // リソースが不足している場合は待機
    return new Promise<void>((resolve) => {
      this.waitingQueue.push(resolve);
    });
  }

  /**
   * セマフォを解放（リソースを1つ返却）
   */
  release(): void {
    if (this.permits >= this.maxPermits) {
      console.warn('⚠️ 最大数を超えてセマフォを解放しようとしました');
      return;
    }

    if (this.waitingQueue.length > 0) {
      // 待機中のタスクがある場合は次のタスクを実行
      const nextResolve = this.waitingQueue.shift();
      if (nextResolve) {
        nextResolve();
      }
    } else {
      // 待機中のタスクがない場合はリソースを増加
      this.permits++;
    }
  }

  /**
   * セマフォ内で関数を安全に実行
   */
  async withPermit<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * 利用可能なリソース数を取得
   */
  getAvailablePermits(): number {
    return this.permits;
  }

  /**
   * 待機中のタスク数を取得
   */
  getWaitingCount(): number {
    return this.waitingQueue.length;
  }
}

// 処理キューの実装
export class ProcessingQueue<T> {
  private queue: Array<{
    id: string;
    task: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: any) => void;
    timestamp: number;
    priority: number;
  }> = [];
  private processing = false;
  private maxConcurrency: number;
  private currentlyProcessing = 0;
  private processedCount = 0;
  private errorCount = 0;

  constructor(maxConcurrency: number = 1) {
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * タスクをキューに追加
   */
  async enqueue(
    task: () => Promise<T>,
    options: {
      id?: string;
      priority?: number;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const { id = `task-${Date.now()}-${Math.random()}`, priority = 0, timeout } = options;

    return new Promise<T>((resolve, reject) => {
      const queueItem = {
        id,
        task: timeout ? this.withTimeout(task, timeout) : task,
        resolve,
        reject,
        timestamp: Date.now(),
        priority
      };

      // 優先度順に挿入
      const insertIndex = this.queue.findIndex(item => item.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(queueItem);
      } else {
        this.queue.splice(insertIndex, 0, queueItem);
      }

      this.processQueue();
    });
  }

  /**
   * キューの処理を開始
   */
  private async processQueue(): Promise<void> {
    if (this.currentlyProcessing >= this.maxConcurrency) {
      return;
    }

    const item = this.queue.shift();
    if (!item) {
      return;
    }

    this.currentlyProcessing++;

    try {
      const result = await item.task();
      item.resolve(result);
      this.processedCount++;
    } catch (error) {
      item.reject(error);
      this.errorCount++;
    } finally {
      this.currentlyProcessing--;
      // 次のタスクを処理
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }

  /**
   * タイムアウト付きタスク実行
   */
  private withTimeout<T>(task: () => Promise<T>, timeoutMs: number): () => Promise<T> {
    return () => {
      return Promise.race([
        task(),
        new Promise<T>((_, reject) => {
          setTimeout(() => reject(new Error(`タスクがタイムアウトしました (${timeoutMs}ms)`)), timeoutMs);
        })
      ]);
    };
  }

  /**
   * キューの状態を取得
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      currentlyProcessing: this.currentlyProcessing,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      maxConcurrency: this.maxConcurrency
    };
  }

  /**
   * キューをクリア
   */
  clear(): void {
    this.queue.forEach(item => {
      item.reject(new Error('キューがクリアされました'));
    });
    this.queue = [];
  }

  /**
   * 特定のタスクをキャンセル
   */
  cancel(taskId: string): boolean {
    const index = this.queue.findIndex(item => item.id === taskId);
    if (index !== -1) {
      const item = this.queue.splice(index, 1)[0];
      item.reject(new Error('タスクがキャンセルされました'));
      return true;
    }
    return false;
  }
}

// 競合状態検出システム
export class ConcurrencyMonitor {
  private activeOperations = new Map<string, {
    startTime: number;
    context: string;
    resourceId?: string;
  }>();
  private conflictLog: Array<{
    timestamp: number;
    operation1: string;
    operation2: string;
    resourceId?: string;
    resolved: boolean;
  }> = [];

  /**
   * 操作の開始を記録
   */
  startOperation(operationId: string, context: string, resourceId?: string): void {
    if (this.activeOperations.has(operationId)) {
      console.warn(`⚠️ 操作 ${operationId} は既に実行中です`);
    }

    // 同じリソースに対する競合をチェック
    if (resourceId) {
      const conflictingOps = Array.from(this.activeOperations.entries())
        .filter(([_, op]) => op.resourceId === resourceId);
      
      if (conflictingOps.length > 0) {
        const conflictingOpId = conflictingOps[0][0];
        this.logConflict(operationId, conflictingOpId, resourceId);
      }
    }

    this.activeOperations.set(operationId, {
      startTime: Date.now(),
      context,
      resourceId
    });
  }

  /**
   * 操作の完了を記録
   */
  endOperation(operationId: string): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      console.warn(`⚠️ 操作 ${operationId} は記録されていません`);
      return;
    }

    const duration = Date.now() - operation.startTime;
    this.activeOperations.delete(operationId);

    // 長時間実行された操作を記録
    if (duration > 5000) { // 5秒以上
      console.warn(`⚠️ 操作 ${operationId} の実行時間が長すぎます: ${duration}ms`);
    }
  }

  /**
   * 競合の記録
   */
  private logConflict(operation1: string, operation2: string, resourceId?: string): void {
    this.conflictLog.push({
      timestamp: Date.now(),
      operation1,
      operation2,
      resourceId,
      resolved: false
    });

    console.warn(`⚠️ 競合が検出されました: ${operation1} と ${operation2}`, 
                 resourceId ? `(リソース: ${resourceId})` : '');
  }

  /**
   * アクティブな操作一覧を取得
   */
  getActiveOperations(): Array<{
    operationId: string;
    context: string;
    duration: number;
    resourceId?: string;
  }> {
    const now = Date.now();
    return Array.from(this.activeOperations.entries()).map(([id, op]) => ({
      operationId: id,
      context: op.context,
      duration: now - op.startTime,
      resourceId: op.resourceId
    }));
  }

  /**
   * 競合ログを取得
   */
  getConflictLog() {
    return [...this.conflictLog];
  }

  /**
   * 統計情報を取得
   */
  getStatistics() {
    const activeCount = this.activeOperations.size;
    const totalConflicts = this.conflictLog.length;
    const unresolvedConflicts = this.conflictLog.filter(c => !c.resolved).length;
    
    return {
      activeOperations: activeCount,
      totalConflicts,
      unresolvedConflicts,
      averageOperationTime: this.calculateAverageOperationTime()
    };
  }

  /**
   * 平均操作時間を計算
   */
  private calculateAverageOperationTime(): number {
    const activeOps = this.getActiveOperations();
    if (activeOps.length === 0) return 0;
    
    const totalTime = activeOps.reduce((sum, op) => sum + op.duration, 0);
    return totalTime / activeOps.length;
  }

  /**
   * モニターをリセット
   */
  reset(): void {
    this.activeOperations.clear();
    this.conflictLog = [];
  }
}

// 安全な関数実行ヘルパー
export class SafeExecutor {
  private imageMutex = new Mutex();
  private detectionSemaphore = new Semaphore(1); // 同時に1つの顔検出のみ
  private warpingSemaphore = new Semaphore(2); // 同時に2つの画像変形まで
  private processingQueue = new ProcessingQueue(3); // 最大3つの同時処理
  private monitor = new ConcurrencyMonitor();

  /**
   * 画像読み込みを安全に実行
   */
  async safeImageLoad<T>(fn: () => Promise<T>, context: string): Promise<T> {
    const operationId = `image-load-${Date.now()}`;
    this.monitor.startOperation(operationId, context, 'image-resource');

    try {
      return await this.imageMutex.withLock(async () => {
        return await this.processingQueue.enqueue(fn, {
          id: operationId,
          priority: 1,
          timeout: 30000 // 30秒タイムアウト
        });
      });
    } finally {
      this.monitor.endOperation(operationId);
    }
  }

  /**
   * 顔検出を安全に実行
   */
  async safeFaceDetection<T>(fn: () => Promise<T>, context: string): Promise<T> {
    const operationId = `face-detection-${Date.now()}`;
    this.monitor.startOperation(operationId, context, 'face-detection');

    try {
      return await this.detectionSemaphore.withPermit(async () => {
        return await this.processingQueue.enqueue(fn, {
          id: operationId,
          priority: 2,
          timeout: 60000 // 60秒タイムアウト
        });
      });
    } finally {
      this.monitor.endOperation(operationId);
    }
  }

  /**
   * 画像変形を安全に実行
   */
  async safeImageWarping<T>(fn: () => Promise<T>, context: string): Promise<T> {
    const operationId = `image-warping-${Date.now()}`;
    this.monitor.startOperation(operationId, context, 'image-warping');

    try {
      return await this.warpingSemaphore.withPermit(async () => {
        return await this.processingQueue.enqueue(fn, {
          id: operationId,
          priority: 0,
          timeout: 120000 // 120秒タイムアウト
        });
      });
    } finally {
      this.monitor.endOperation(operationId);
    }
  }

  /**
   * 状態更新を安全に実行
   */
  async safeStateUpdate<T>(fn: () => Promise<T>, context: string, stateKey?: string): Promise<T> {
    const operationId = `state-update-${Date.now()}`;
    const resourceId = stateKey ? `state-${stateKey}` : 'global-state';
    this.monitor.startOperation(operationId, context, resourceId);

    try {
      return await this.processingQueue.enqueue(fn, {
        id: operationId,
        priority: 3, // 状態更新は最高優先度
        timeout: 5000 // 5秒タイムアウト
      });
    } finally {
      this.monitor.endOperation(operationId);
    }
  }

  /**
   * 現在の実行状況を取得
   */
  getExecutionStatus() {
    return {
      imageMutex: {
        locked: this.imageMutex.isLocked(),
        waiting: this.imageMutex.getWaitingCount()
      },
      detectionSemaphore: {
        available: this.detectionSemaphore.getAvailablePermits(),
        waiting: this.detectionSemaphore.getWaitingCount()
      },
      warpingSemaphore: {
        available: this.warpingSemaphore.getAvailablePermits(),
        waiting: this.warpingSemaphore.getWaitingCount()
      },
      processingQueue: this.processingQueue.getStatus(),
      monitor: this.monitor.getStatistics(),
      activeOperations: this.monitor.getActiveOperations()
    };
  }

  /**
   * 全ての処理をリセット
   */
  reset(): void {
    this.processingQueue.clear();
    this.monitor.reset();
  }

  /**
   * 競合ログを取得
   */
  getConflictLog() {
    return this.monitor.getConflictLog();
  }
}

// グローバルな安全実行器のインスタンス
export const globalSafeExecutor = new SafeExecutor();

// デッドロック検出システム
export class DeadlockDetector {
  private resourceGraph = new Map<string, Set<string>>();
  private waitingGraph = new Map<string, Set<string>>();
  private detectionInterval: NodeJS.Timeout | null = null;

  /**
   * デッドロック検出を開始
   */
  startDetection(intervalMs: number = 5000): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
    }

    this.detectionInterval = setInterval(() => {
      this.detectDeadlocks();
    }, intervalMs);
  }

  /**
   * デッドロック検出を停止
   */
  stopDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  /**
   * リソース依存関係を記録
   */
  addResourceDependency(from: string, to: string): void {
    if (!this.resourceGraph.has(from)) {
      this.resourceGraph.set(from, new Set());
    }
    this.resourceGraph.get(from)!.add(to);
  }

  /**
   * リソース依存関係を削除
   */
  removeResourceDependency(from: string, to: string): void {
    const dependencies = this.resourceGraph.get(from);
    if (dependencies) {
      dependencies.delete(to);
      if (dependencies.size === 0) {
        this.resourceGraph.delete(from);
      }
    }
  }

  /**
   * デッドロックを検出
   */
  private detectDeadlocks(): void {
    const cycles = this.findCycles();
    if (cycles.length > 0) {
      console.error('🚨 デッドロックが検出されました:', cycles);
      // カスタムイベントを発行
      window.dispatchEvent(new CustomEvent('deadlockDetected', {
        detail: { cycles }
      }));
    }
  }

  /**
   * 循環依存を検出
   */
  private findCycles(): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    for (const [node] of this.resourceGraph) {
      if (!visited.has(node)) {
        this.dfsForCycles(node, visited, recursionStack, [], cycles);
      }
    }

    return cycles;
  }

  /**
   * DFSで循環を検出
   */
  private dfsForCycles(
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    currentPath: string[],
    cycles: string[][]
  ): void {
    visited.add(node);
    recursionStack.add(node);
    currentPath.push(node);

    const neighbors = this.resourceGraph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        this.dfsForCycles(neighbor, visited, recursionStack, currentPath, cycles);
      } else if (recursionStack.has(neighbor)) {
        // 循環発見
        const cycleStart = currentPath.indexOf(neighbor);
        cycles.push(currentPath.slice(cycleStart));
      }
    }

    recursionStack.delete(node);
    currentPath.pop();
  }

  /**
   * 現在のリソース依存関係を取得
   */
  getResourceGraph(): Map<string, Set<string>> {
    return new Map(this.resourceGraph);
  }
}

// エクスポート
export default {
  Mutex,
  Semaphore,
  ProcessingQueue,
  ConcurrencyMonitor,
  SafeExecutor,
  globalSafeExecutor,
  DeadlockDetector
};