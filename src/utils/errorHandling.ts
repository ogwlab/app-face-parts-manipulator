/**
 * 統合エラーハンドリングシステム
 * 
 * このファイルは、アプリケーション全体のエラーハンドリングを統合管理します。
 * ブラウザ機能検出、メモリ管理、エラー報告、リトライ機能などを提供します。
 */

// エラーの種類を定義
export enum ErrorType {
  MODEL_LOADING = 'MODEL_LOADING',
  IMAGE_PROCESSING = 'IMAGE_PROCESSING',
  FACE_DETECTION = 'FACE_DETECTION',
  IMAGE_WARPING = 'IMAGE_WARPING',
  FILE_SYSTEM = 'FILE_SYSTEM',
  NETWORK = 'NETWORK',
  BROWSER_COMPATIBILITY = 'BROWSER_COMPATIBILITY',
  STATE_MANAGEMENT = 'STATE_MANAGEMENT',
  UI_INTERACTION = 'UI_INTERACTION',
  MEMORY_LIMIT = 'MEMORY_LIMIT',
  PERFORMANCE = 'PERFORMANCE',
  UNKNOWN = 'UNKNOWN'
}

// エラー重要度レベル
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// 統合エラー情報
export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  details?: Record<string, any>;
  timestamp: Date;
  stack?: string;
  browserInfo?: BrowserCapabilities;
  memoryInfo?: MemoryInfo;
  recoverable: boolean;
  retryCount?: number;
  context?: string;
}

// ブラウザ機能情報
export interface BrowserCapabilities {
  webGL: boolean;
  webGL2: boolean;
  canvas: boolean;
  canvasContext2d: boolean;
  webWorkers: boolean;
  offscreenCanvas: boolean;
  imageData: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  indexedDB: boolean;
  fileAPI: boolean;
  performance: boolean;
  memoryAPI: boolean;
  userAgent: string;
  platform: string;
  cookieEnabled: boolean;
  language: string;
  maxTextureSize?: number;
  maxCanvasSize?: number;
  devicePixelRatio: number;
  colorDepth: number;
  screenResolution: { width: number; height: number };
  availableMemory?: number;
  performanceScore?: number;
}

// メモリ情報
export interface MemoryInfo {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
  estimatedUsage?: number;
  estimatedQuota?: number;
  usagePercentage?: number;
  isLowMemory: boolean;
  isCriticalMemory: boolean;
}

// リトライ設定
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors: ErrorType[];
}

// デフォルトリトライ設定
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryableErrors: [
    ErrorType.MODEL_LOADING,
    ErrorType.NETWORK,
    ErrorType.FILE_SYSTEM,
    ErrorType.FACE_DETECTION
  ]
};

/**
 * ブラウザ機能検出システム
 */
export class BrowserCapabilityDetector {
  private static instance: BrowserCapabilityDetector;
  private capabilities: BrowserCapabilities | null = null;

  private constructor() {}

  public static getInstance(): BrowserCapabilityDetector {
    if (!BrowserCapabilityDetector.instance) {
      BrowserCapabilityDetector.instance = new BrowserCapabilityDetector();
    }
    return BrowserCapabilityDetector.instance;
  }

  /**
   * ブラウザ機能の包括的検出
   */
  public async detectCapabilities(): Promise<BrowserCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    const capabilities: BrowserCapabilities = {
      webGL: this.checkWebGLSupport(),
      webGL2: this.checkWebGL2Support(),
      canvas: this.checkCanvasSupport(),
      canvasContext2d: this.checkCanvas2DSupport(),
      webWorkers: this.checkWebWorkersSupport(),
      offscreenCanvas: this.checkOffscreenCanvasSupport(),
      imageData: this.checkImageDataSupport(),
      localStorage: this.checkLocalStorageSupport(),
      sessionStorage: this.checkSessionStorageSupport(),
      indexedDB: this.checkIndexedDBSupport(),
      fileAPI: this.checkFileAPISupport(),
      performance: this.checkPerformanceAPISupport(),
      memoryAPI: this.checkMemoryAPISupport(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      language: navigator.language,
      devicePixelRatio: window.devicePixelRatio || 1,
      colorDepth: screen.colorDepth,
      screenResolution: {
        width: screen.width,
        height: screen.height
      }
    };

    // WebGL情報の取得
    if (capabilities.webGL) {
      const webglInfo = this.getWebGLInfo();
      capabilities.maxTextureSize = webglInfo.maxTextureSize;
    }

    // Canvas最大サイズの取得
    capabilities.maxCanvasSize = this.getMaxCanvasSize();

    // メモリ情報の取得
    if (capabilities.memoryAPI) {
      const memoryInfo = await this.getMemoryInfo();
      capabilities.availableMemory = memoryInfo.jsHeapSizeLimit;
    }

    // パフォーマンススコアの計算
    capabilities.performanceScore = await this.calculatePerformanceScore();

    this.capabilities = capabilities;
    return capabilities;
  }

  /**
   * WebGL サポートチェック
   */
  private checkWebGLSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  }

  /**
   * WebGL2 サポートチェック
   */
  private checkWebGL2Support(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!canvas.getContext('webgl2');
    } catch (e) {
      return false;
    }
  }

  /**
   * Canvas サポートチェック
   */
  private checkCanvasSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return typeof canvas.getContext === 'function';
    } catch (e) {
      return false;
    }
  }

  /**
   * Canvas 2D サポートチェック
   */
  private checkCanvas2DSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!canvas.getContext('2d');
    } catch (e) {
      return false;
    }
  }

  /**
   * Web Workers サポートチェック
   */
  private checkWebWorkersSupport(): boolean {
    return typeof Worker !== 'undefined';
  }

  /**
   * OffscreenCanvas サポートチェック
   */
  private checkOffscreenCanvasSupport(): boolean {
    return typeof OffscreenCanvas !== 'undefined';
  }

  /**
   * ImageData サポートチェック
   */
  private checkImageDataSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      return ctx && typeof ctx.createImageData === 'function';
    } catch (e) {
      return false;
    }
  }

  /**
   * LocalStorage サポートチェック
   */
  private checkLocalStorageSupport(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * SessionStorage サポートチェック
   */
  private checkSessionStorageSupport(): boolean {
    try {
      const testKey = '__storage_test__';
      sessionStorage.setItem(testKey, 'test');
      sessionStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * IndexedDB サポートチェック
   */
  private checkIndexedDBSupport(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  /**
   * File API サポートチェック
   */
  private checkFileAPISupport(): boolean {
    return typeof FileReader !== 'undefined' && typeof File !== 'undefined';
  }

  /**
   * Performance API サポートチェック
   */
  private checkPerformanceAPISupport(): boolean {
    return typeof performance !== 'undefined' && typeof performance.now === 'function';
  }

  /**
   * Memory API サポートチェック
   */
  private checkMemoryAPISupport(): boolean {
    return typeof performance !== 'undefined' && 
           typeof (performance as any).memory !== 'undefined';
  }

  /**
   * WebGL 情報取得
   */
  private getWebGLInfo(): { maxTextureSize: number } {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        return { maxTextureSize: 0 };
      }
      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      return { maxTextureSize };
    } catch (e) {
      return { maxTextureSize: 0 };
    }
  }

  /**
   * Canvas 最大サイズ取得
   */
  private getMaxCanvasSize(): number {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;

      // 段階的にサイズを増やしてテスト
      let maxSize = 1024;
      while (maxSize <= 32768) {
        canvas.width = maxSize;
        canvas.height = maxSize;
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 1, 1);
        
        const imageData = ctx.getImageData(0, 0, 1, 1);
        if (imageData.data[0] !== 255) {
          return maxSize / 2;
        }
        maxSize *= 2;
      }
      return maxSize / 2;
    } catch (e) {
      return 2048; // デフォルト値
    }
  }

  /**
   * メモリ情報取得
   */
  private async getMemoryInfo(): Promise<MemoryInfo> {
    const memoryInfo: MemoryInfo = {
      isLowMemory: false,
      isCriticalMemory: false
    };

    try {
      // Performance Memory API
      if (typeof performance !== 'undefined' && (performance as any).memory) {
        const memory = (performance as any).memory;
        memoryInfo.usedJSHeapSize = memory.usedJSHeapSize;
        memoryInfo.totalJSHeapSize = memory.totalJSHeapSize;
        memoryInfo.jsHeapSizeLimit = memory.jsHeapSizeLimit;
        
        if (memory.jsHeapSizeLimit) {
          memoryInfo.usagePercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
          memoryInfo.isLowMemory = memoryInfo.usagePercentage > 70;
          memoryInfo.isCriticalMemory = memoryInfo.usagePercentage > 90;
        }
      }

      // Storage Quota API
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        memoryInfo.estimatedUsage = estimate.usage;
        memoryInfo.estimatedQuota = estimate.quota;
      }
    } catch (e) {
      console.warn('メモリ情報の取得に失敗しました:', e);
    }

    return memoryInfo;
  }

  /**
   * パフォーマンススコア計算
   */
  private async calculatePerformanceScore(): Promise<number> {
    try {
      const start = performance.now();
      
      // 計算集約的なタスクを実行
      let result = 0;
      for (let i = 0; i < 100000; i++) {
        result += Math.sin(i) * Math.cos(i);
      }
      
      const end = performance.now();
      const duration = end - start;
      
      // スコアを0-100の範囲で計算（低い時間 = 高いスコア）
      const score = Math.max(0, Math.min(100, 100 - (duration / 10)));
      return Math.round(score);
    } catch (e) {
      return 50; // デフォルトスコア
    }
  }

  /**
   * 機能制限チェック
   */
  public checkLimitations(capabilities: BrowserCapabilities): string[] {
    const limitations: string[] = [];

    if (!capabilities.webGL) {
      limitations.push('WebGL がサポートされていません');
    }

    if (!capabilities.canvas) {
      limitations.push('Canvas API がサポートされていません');
    }

    if (!capabilities.fileAPI) {
      limitations.push('File API がサポートされていません');
    }

    if (capabilities.maxTextureSize && capabilities.maxTextureSize < 2048) {
      limitations.push('テクスチャサイズが制限されています');
    }

    if (capabilities.maxCanvasSize && capabilities.maxCanvasSize < 4096) {
      limitations.push('Canvas サイズが制限されています');
    }

    if (capabilities.performanceScore && capabilities.performanceScore < 30) {
      limitations.push('パフォーマンスが低下しています');
    }

    return limitations;
  }
}

/**
 * メモリ管理システム
 */
export class MemoryManager {
  private static instance: MemoryManager;
  private memoryThreshold = 0.8; // 80%使用時に警告
  private criticalThreshold = 0.9; // 90%使用時に緊急処理

  private constructor() {}

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * メモリ使用量監視
   */
  public async monitorMemory(): Promise<MemoryInfo> {
    const detector = BrowserCapabilityDetector.getInstance();
    const capabilities = await detector.detectCapabilities();
    
    if (!capabilities.memoryAPI) {
      return {
        isLowMemory: false,
        isCriticalMemory: false
      };
    }

    const memoryInfo = await this.getCurrentMemoryInfo();
    
    if (memoryInfo.isCriticalMemory) {
      await this.handleCriticalMemory();
    } else if (memoryInfo.isLowMemory) {
      await this.handleLowMemory();
    }

    return memoryInfo;
  }

  /**
   * 現在のメモリ情報取得
   */
  private async getCurrentMemoryInfo(): Promise<MemoryInfo> {
    const memoryInfo: MemoryInfo = {
      isLowMemory: false,
      isCriticalMemory: false
    };

    try {
      if (typeof performance !== 'undefined' && (performance as any).memory) {
        const memory = (performance as any).memory;
        memoryInfo.usedJSHeapSize = memory.usedJSHeapSize;
        memoryInfo.totalJSHeapSize = memory.totalJSHeapSize;
        memoryInfo.jsHeapSizeLimit = memory.jsHeapSizeLimit;
        
        if (memory.jsHeapSizeLimit) {
          memoryInfo.usagePercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
          memoryInfo.isLowMemory = memoryInfo.usagePercentage > (this.memoryThreshold * 100);
          memoryInfo.isCriticalMemory = memoryInfo.usagePercentage > (this.criticalThreshold * 100);
        }
      }
    } catch (e) {
      console.warn('メモリ情報の取得に失敗しました:', e);
    }

    return memoryInfo;
  }

  /**
   * 低メモリ時の処理
   */
  private async handleLowMemory(): Promise<void> {
    console.warn('メモリ使用量が高くなっています。パフォーマンスが低下する可能性があります。');
    
    // ガベージコレクションの強制実行（可能な場合）
    if (typeof gc !== 'undefined') {
      gc();
    }
  }

  /**
   * 緊急メモリ不足時の処理
   */
  private async handleCriticalMemory(): Promise<void> {
    console.error('メモリ使用量が危険レベルに達しました。処理を制限します。');
    
    // 緊急処理
    if (typeof gc !== 'undefined') {
      gc();
    }
    
    // 可能な場合、メモリを多く使用する処理をキャンセル
    this.requestMemoryCleanup();
  }

  /**
   * メモリクリーンアップ要求
   */
  private requestMemoryCleanup(): void {
    // カスタムイベントを発行してメモリクリーンアップを要求
    const event = new CustomEvent('memoryCleanupRequested', {
      detail: { timestamp: Date.now() }
    });
    window.dispatchEvent(event);
  }

  /**
   * 画像サイズの適切な制限計算
   */
  public calculateImageSizeLimit(memoryInfo: MemoryInfo): number {
    const availableMemory = memoryInfo.jsHeapSizeLimit || 2147483648; // 2GB default
    const usedMemory = memoryInfo.usedJSHeapSize || 0;
    const freeMemory = availableMemory - usedMemory;
    
    // 利用可能メモリの30%を画像処理に使用
    const imageMemoryBudget = freeMemory * 0.3;
    
    // RGBA画像の場合、1ピクセルあたり4バイト
    const maxPixels = imageMemoryBudget / 4;
    
    // 正方形画像と仮定して一辺の長さを計算
    const maxSide = Math.sqrt(maxPixels);
    
    // 安全マージンを考慮して80%に制限
    return Math.floor(maxSide * 0.8);
  }
}

/**
 * エラー報告システム
 */
export class ErrorReporter {
  private static instance: ErrorReporter;
  private errorHistory: AppError[] = [];
  private maxHistorySize = 100;

  private constructor() {}

  public static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter();
    }
    return ErrorReporter.instance;
  }

  /**
   * エラー報告
   */
  public async reportError(error: Error | AppError, context?: string): Promise<AppError> {
    const appError = this.createAppError(error, context);
    this.errorHistory.push(appError);
    
    // 履歴サイズ制限
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // コンソールログ出力
    this.logError(appError);

    // カスタムイベント発行
    this.dispatchErrorEvent(appError);

    return appError;
  }

  /**
   * AppError オブジェクト作成
   */
  private createAppError(error: Error | AppError, context?: string): AppError {
    if (this.isAppError(error)) {
      return error;
    }

    const errorType = this.classifyError(error);
    const severity = this.determineSeverity(errorType);
    const userMessage = this.generateUserMessage(errorType, error.message);

    return {
      type: errorType,
      severity,
      message: error.message,
      userMessage,
      timestamp: new Date(),
      stack: error.stack,
      recoverable: this.isRecoverable(errorType),
      context
    };
  }

  /**
   * AppError 判定
   */
  private isAppError(error: any): error is AppError {
    return error && typeof error === 'object' && 'type' in error && 'severity' in error;
  }

  /**
   * エラー分類
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('model') || message.includes('モデル')) {
      return ErrorType.MODEL_LOADING;
    }
    if (message.includes('image') || message.includes('画像')) {
      return ErrorType.IMAGE_PROCESSING;
    }
    if (message.includes('face') || message.includes('顔')) {
      return ErrorType.FACE_DETECTION;
    }
    if (message.includes('warp') || message.includes('変形')) {
      return ErrorType.IMAGE_WARPING;
    }
    if (message.includes('file') || message.includes('ファイル')) {
      return ErrorType.FILE_SYSTEM;
    }
    if (message.includes('network') || message.includes('ネットワーク')) {
      return ErrorType.NETWORK;
    }
    if (message.includes('memory') || message.includes('メモリ')) {
      return ErrorType.MEMORY_LIMIT;
    }
    if (stack.includes('canvas') || stack.includes('webgl')) {
      return ErrorType.BROWSER_COMPATIBILITY;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * エラー重要度判定
   */
  private determineSeverity(errorType: ErrorType): ErrorSeverity {
    switch (errorType) {
      case ErrorType.MEMORY_LIMIT:
      case ErrorType.BROWSER_COMPATIBILITY:
        return ErrorSeverity.CRITICAL;
      case ErrorType.MODEL_LOADING:
      case ErrorType.FACE_DETECTION:
        return ErrorSeverity.HIGH;
      case ErrorType.IMAGE_PROCESSING:
      case ErrorType.IMAGE_WARPING:
        return ErrorSeverity.MEDIUM;
      default:
        return ErrorSeverity.LOW;
    }
  }

  /**
   * ユーザー向けメッセージ生成
   */
  private generateUserMessage(errorType: ErrorType, originalMessage: string): string {
    const messageMap: Record<ErrorType, string> = {
      [ErrorType.MODEL_LOADING]: '顔検出モデルの読み込みに失敗しました。ネットワーク接続を確認してください。',
      [ErrorType.IMAGE_PROCESSING]: '画像の処理中にエラーが発生しました。画像ファイルを確認してください。',
      [ErrorType.FACE_DETECTION]: '顔の検出に失敗しました。別の画像を試してください。',
      [ErrorType.IMAGE_WARPING]: '画像の変形処理中にエラーが発生しました。',
      [ErrorType.FILE_SYSTEM]: 'ファイルの読み込みまたは保存に失敗しました。',
      [ErrorType.NETWORK]: 'ネットワークエラーが発生しました。接続を確認してください。',
      [ErrorType.BROWSER_COMPATIBILITY]: 'お使いのブラウザでは一部の機能がサポートされていません。',
      [ErrorType.STATE_MANAGEMENT]: 'アプリケーションの状態管理でエラーが発生しました。',
      [ErrorType.UI_INTERACTION]: 'ユーザーインターフェースでエラーが発生しました。',
      [ErrorType.MEMORY_LIMIT]: 'メモリ不足のため処理を完了できませんでした。画像サイズを小さくしてください。',
      [ErrorType.PERFORMANCE]: 'パフォーマンスの問題が発生しました。処理を軽量化してください。',
      [ErrorType.UNKNOWN]: '不明なエラーが発生しました。しばらく待ってから再試行してください。'
    };

    return messageMap[errorType] || originalMessage;
  }

  /**
   * エラー回復可能性判定
   */
  private isRecoverable(errorType: ErrorType): boolean {
    const recoverableErrors = [
      ErrorType.MODEL_LOADING,
      ErrorType.IMAGE_PROCESSING,
      ErrorType.FACE_DETECTION,
      ErrorType.NETWORK,
      ErrorType.FILE_SYSTEM
    ];

    return recoverableErrors.includes(errorType);
  }

  /**
   * エラーログ出力
   */
  private logError(error: AppError): void {
    const logMethod = this.getLogMethod(error.severity);
    logMethod(`[${error.type}] ${error.message}`, {
      severity: error.severity,
      userMessage: error.userMessage,
      timestamp: error.timestamp,
      context: error.context,
      recoverable: error.recoverable
    });
  }

  /**
   * ログメソッド取得
   */
  private getLogMethod(severity: ErrorSeverity): (message: string, data?: any) => void {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return console.error;
      case ErrorSeverity.HIGH:
        return console.error;
      case ErrorSeverity.MEDIUM:
        return console.warn;
      case ErrorSeverity.LOW:
        return console.info;
      default:
        return console.log;
    }
  }

  /**
   * エラーイベント発行
   */
  private dispatchErrorEvent(error: AppError): void {
    const event = new CustomEvent('appError', {
      detail: error
    });
    window.dispatchEvent(event);
  }

  /**
   * エラー履歴取得
   */
  public getErrorHistory(): AppError[] {
    return [...this.errorHistory];
  }

  /**
   * エラー履歴クリア
   */
  public clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * 重要度別エラー数取得
   */
  public getErrorStats(): Record<ErrorSeverity, number> {
    const stats: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    };

    this.errorHistory.forEach(error => {
      stats[error.severity]++;
    });

    return stats;
  }
}

/**
 * リトライ機能
 */
export class RetryManager {
  private static instance: RetryManager;
  private defaultConfig = DEFAULT_RETRY_CONFIG;

  private constructor() {}

  public static getInstance(): RetryManager {
    if (!RetryManager.instance) {
      RetryManager.instance = new RetryManager();
    }
    return RetryManager.instance;
  }

  /**
   * リトライ付き関数実行
   */
  public async executeWithRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: string
  ): Promise<T> {
    const finalConfig = { ...this.defaultConfig, ...config };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 最後の試行の場合はエラーを投げる
        if (attempt === finalConfig.maxRetries) {
          break;
        }

        // リトライ可能なエラーかチェック
        const errorReporter = ErrorReporter.getInstance();
        const appError = await errorReporter.reportError(lastError, context);
        
        if (!finalConfig.retryableErrors.includes(appError.type)) {
          throw lastError;
        }

        // 遅延時間計算
        const delay = Math.min(
          finalConfig.initialDelay * Math.pow(finalConfig.backoffFactor, attempt),
          finalConfig.maxDelay
        );

        console.warn(`リトライ ${attempt + 1}/${finalConfig.maxRetries} を ${delay}ms 後に実行します: ${lastError.message}`);

        // 遅延
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  /**
   * 遅延処理
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 統合エラーハンドリングマネージャー
 */
export class ErrorHandlingManager {
  private static instance: ErrorHandlingManager;
  private browserDetector: BrowserCapabilityDetector;
  private memoryManager: MemoryManager;
  private errorReporter: ErrorReporter;
  private retryManager: RetryManager;
  private initialized = false;

  private constructor() {
    this.browserDetector = BrowserCapabilityDetector.getInstance();
    this.memoryManager = MemoryManager.getInstance();
    this.errorReporter = ErrorReporter.getInstance();
    this.retryManager = RetryManager.getInstance();
  }

  public static getInstance(): ErrorHandlingManager {
    if (!ErrorHandlingManager.instance) {
      ErrorHandlingManager.instance = new ErrorHandlingManager();
    }
    return ErrorHandlingManager.instance;
  }

  /**
   * システム初期化
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // ブラウザ機能検出
      const capabilities = await this.browserDetector.detectCapabilities();
      
      // 機能制限チェック
      const limitations = this.browserDetector.checkLimitations(capabilities);
      if (limitations.length > 0) {
        console.warn('ブラウザ機能の制限が検出されました:', limitations);
      }

      // メモリ監視開始
      await this.memoryManager.monitorMemory();

      // グローバルエラーハンドラー設定
      this.setupGlobalErrorHandlers();

      this.initialized = true;
      console.log('✅ エラーハンドリングシステムが初期化されました');
    } catch (error) {
      console.error('❌ エラーハンドリングシステムの初期化に失敗しました:', error);
      throw error;
    }
  }

  /**
   * グローバルエラーハンドラー設定
   */
  private setupGlobalErrorHandlers(): void {
    // 未処理のエラー
    window.addEventListener('error', (event) => {
      this.errorReporter.reportError(event.error, 'global-error');
    });

    // 未処理のPromise拒否
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      this.errorReporter.reportError(error, 'unhandled-promise-rejection');
    });

    // メモリクリーンアップ要求
    window.addEventListener('memoryCleanupRequested', () => {
      console.log('メモリクリーンアップが要求されました');
    });
  }

  /**
   * 便利なアクセスメソッド
   */
  public getBrowserCapabilities(): Promise<BrowserCapabilities> {
    return this.browserDetector.detectCapabilities();
  }

  public monitorMemory(): Promise<MemoryInfo> {
    return this.memoryManager.monitorMemory();
  }

  public reportError(error: Error | AppError, context?: string): Promise<AppError> {
    return this.errorReporter.reportError(error, context);
  }

  public executeWithRetry<T>(
    fn: () => Promise<T>,
    config?: Partial<RetryConfig>,
    context?: string
  ): Promise<T> {
    return this.retryManager.executeWithRetry(fn, config, context);
  }
}

// エクスポート
export default ErrorHandlingManager;