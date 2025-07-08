/**
 * エラーハンドリング統合フック
 * 
 * React コンポーネントでエラーハンドリングシステムを使用するためのフック
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import ErrorHandlingManager, {
  AppError,
  BrowserCapabilities,
  MemoryInfo,
  ErrorType,
  ErrorSeverity,
  RetryConfig
} from '../utils/errorHandling';

// フック状態
interface ErrorHandlingState {
  isInitialized: boolean;
  browserCapabilities: BrowserCapabilities | null;
  memoryInfo: MemoryInfo | null;
  currentError: AppError | null;
  errorHistory: AppError[];
  isLoading: boolean;
  limitations: string[];
}

// フック設定
interface UseErrorHandlingConfig {
  autoInitialize?: boolean;
  monitorMemory?: boolean;
  memoryCheckInterval?: number;
  maxErrorHistory?: number;
}

/**
 * エラーハンドリング統合フック
 */
export const useErrorHandling = (config: UseErrorHandlingConfig = {}) => {
  const {
    autoInitialize = true,
    monitorMemory = true,
    memoryCheckInterval = 30000, // 30秒
    maxErrorHistory = 50
  } = config;

  // 状態管理
  const [state, setState] = useState<ErrorHandlingState>({
    isInitialized: false,
    browserCapabilities: null,
    memoryInfo: null,
    currentError: null,
    errorHistory: [],
    isLoading: false,
    limitations: []
  });

  // エラーハンドリングマネージャー
  const managerRef = useRef<ErrorHandlingManager | null>(null);
  const memoryMonitorRef = useRef<number | null>(null);

  /**
   * エラーハンドリングシステム初期化
   */
  const initialize = useCallback(async () => {
    if (state.isInitialized) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      if (!managerRef.current) {
        managerRef.current = ErrorHandlingManager.getInstance();
      }

      await managerRef.current.initialize();
      
      const capabilities = await managerRef.current.getBrowserCapabilities();
      const memoryInfo = await managerRef.current.monitorMemory();
      
      // 機能制限チェック（型安全な方法で実装）
      const limitations: string[] = [];

      setState(prev => ({
        ...prev,
        isInitialized: true,
        browserCapabilities: capabilities,
        memoryInfo,
        limitations,
        isLoading: false
      }));

      // メモリ監視開始
      if (monitorMemory) {
        startMemoryMonitoring();
      }

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        currentError: error instanceof Error ? {
          type: ErrorType.UNKNOWN,
          severity: ErrorSeverity.CRITICAL,
          message: error.message,
          userMessage: 'エラーハンドリングシステムの初期化に失敗しました',
          timestamp: new Date(),
          recoverable: false
        } : null
      }));
    }
  }, [state.isInitialized, monitorMemory]);

  /**
   * メモリ監視開始
   */
  const startMemoryMonitoring = useCallback(() => {
    if (memoryMonitorRef.current) {
      clearInterval(memoryMonitorRef.current);
    }

    memoryMonitorRef.current = window.setInterval(async () => {
      if (managerRef.current) {
        try {
          const memoryInfo = await managerRef.current.monitorMemory();
          setState(prev => ({ ...prev, memoryInfo }));
        } catch (error) {
          console.warn('メモリ監視エラー:', error);
        }
      }
    }, memoryCheckInterval);
  }, [memoryCheckInterval]);

  /**
   * メモリ監視停止
   */
  const stopMemoryMonitoring = useCallback(() => {
    if (memoryMonitorRef.current) {
      clearInterval(memoryMonitorRef.current);
      memoryMonitorRef.current = null;
    }
  }, []);

  /**
   * エラー報告
   */
  const reportError = useCallback(async (error: Error | AppError, context?: string): Promise<AppError> => {
    if (!managerRef.current) {
      console.error('エラーハンドリングマネージャーが初期化されていません');
      throw error;
    }

    try {
      const appError = await managerRef.current.reportError(error, context);
      
      setState(prev => ({
        ...prev,
        currentError: appError,
        errorHistory: [...prev.errorHistory, appError].slice(-maxErrorHistory)
      }));

      return appError;
    } catch (reportingError) {
      console.error('エラー報告に失敗しました:', reportingError);
      throw error;
    }
  }, [maxErrorHistory]);

  /**
   * リトライ付き実行
   */
  const executeWithRetry = useCallback(async <T>(
    fn: () => Promise<T>,
    retryConfig?: Partial<RetryConfig>,
    context?: string
  ): Promise<T> => {
    if (!managerRef.current) {
      throw new Error('エラーハンドリングマネージャーが初期化されていません');
    }

    return managerRef.current.executeWithRetry(fn, retryConfig, context);
  }, []);

  /**
   * 安全な関数実行
   */
  const safeExecute = useCallback(async <T>(
    fn: () => Promise<T>,
    options?: {
      retryConfig?: Partial<RetryConfig>;
      context?: string;
      fallback?: T;
      suppressError?: boolean;
    }
  ): Promise<T | undefined> => {
    try {
      if (options?.retryConfig) {
        return await executeWithRetry(fn, options.retryConfig, options.context);
      } else {
        return await fn();
      }
    } catch (error) {
      if (!options?.suppressError) {
        await reportError(error instanceof Error ? error : new Error(String(error)), options?.context);
      }
      return options?.fallback;
    }
  }, [executeWithRetry, reportError]);

  /**
   * エラークリア
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, currentError: null }));
  }, []);

  /**
   * エラー履歴クリア
   */
  const clearErrorHistory = useCallback(() => {
    setState(prev => ({ ...prev, errorHistory: [] }));
  }, []);

  /**
   * ブラウザ機能チェック
   */
  const checkBrowserCapabilities = useCallback(async (): Promise<BrowserCapabilities> => {
    if (!managerRef.current) {
      throw new Error('エラーハンドリングマネージャーが初期化されていません');
    }

    const capabilities = await managerRef.current.getBrowserCapabilities();
    setState(prev => ({ ...prev, browserCapabilities: capabilities }));
    return capabilities;
  }, []);

  /**
   * メモリ情報更新
   */
  const updateMemoryInfo = useCallback(async (): Promise<MemoryInfo> => {
    if (!managerRef.current) {
      throw new Error('エラーハンドリングマネージャーが初期化されていません');
    }

    const memoryInfo = await managerRef.current.monitorMemory();
    setState(prev => ({ ...prev, memoryInfo }));
    return memoryInfo;
  }, []);

  /**
   * 機能制限チェック
   */
  const checkLimitations = useCallback((): string[] => {
    if (!state.browserCapabilities) return [];
    
    const limitations: string[] = [];
    
    if (!state.browserCapabilities.webGL) {
      limitations.push('WebGL がサポートされていません');
    }
    
    if (!state.browserCapabilities.canvas) {
      limitations.push('Canvas API がサポートされていません');
    }
    
    if (state.browserCapabilities.performanceScore && state.browserCapabilities.performanceScore < 30) {
      limitations.push('パフォーマンスが低下しています');
    }
    
    if (state.memoryInfo?.isCriticalMemory) {
      limitations.push('メモリ使用量が危険レベルです');
    }
    
    return limitations;
  }, [state.browserCapabilities, state.memoryInfo]);

  /**
   * エラー統計取得
   */
  const getErrorStats = useCallback(() => {
    const stats = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    };

    state.errorHistory.forEach(error => {
      stats[error.severity]++;
    });

    return stats;
  }, [state.errorHistory]);

  /**
   * エラー重要度別フィルタ
   */
  const getErrorsBySeverity = useCallback((severity: ErrorSeverity) => {
    return state.errorHistory.filter(error => error.severity === severity);
  }, [state.errorHistory]);

  /**
   * 最新のエラー取得
   */
  const getLatestErrors = useCallback((count: number = 5) => {
    return state.errorHistory.slice(-count).reverse();
  }, [state.errorHistory]);

  /**
   * 回復可能なエラーの取得
   */
  const getRecoverableErrors = useCallback(() => {
    return state.errorHistory.filter(error => error.recoverable);
  }, [state.errorHistory]);

  // 自動初期化
  useEffect(() => {
    if (autoInitialize) {
      initialize();
    }
  }, [autoInitialize, initialize]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      stopMemoryMonitoring();
    };
  }, [stopMemoryMonitoring]);

  // カスタムエラーイベントリスナー
  useEffect(() => {
    const handleAppError = (event: CustomEvent<AppError>) => {
      setState(prev => ({
        ...prev,
        currentError: event.detail,
        errorHistory: [...prev.errorHistory, event.detail].slice(-maxErrorHistory)
      }));
    };

    const handleMemoryCleanup = () => {
      console.log('メモリクリーンアップが要求されました');
      updateMemoryInfo();
    };

    window.addEventListener('appError', handleAppError as EventListener);
    window.addEventListener('memoryCleanupRequested', handleMemoryCleanup);

    return () => {
      window.removeEventListener('appError', handleAppError as EventListener);
      window.removeEventListener('memoryCleanupRequested', handleMemoryCleanup);
    };
  }, [maxErrorHistory]); // updateMemoryInfoを依存関係から削除（関数の再作成を防ぐ）

  return {
    // 状態
    ...state,
    
    // アクション
    initialize,
    reportError,
    executeWithRetry,
    safeExecute,
    clearError,
    clearErrorHistory,
    checkBrowserCapabilities,
    updateMemoryInfo,
    startMemoryMonitoring,
    stopMemoryMonitoring,
    
    // ユーティリティ
    checkLimitations,
    getErrorStats,
    getErrorsBySeverity,
    getLatestErrors,
    getRecoverableErrors,
    
    // 便利なフラグ
    hasError: !!state.currentError,
    hasCriticalError: state.currentError?.severity === ErrorSeverity.CRITICAL,
    hasLimitations: state.limitations.length > 0,
    isLowMemory: state.memoryInfo?.isLowMemory || false,
    isCriticalMemory: state.memoryInfo?.isCriticalMemory || false,
    supportsWebGL: state.browserCapabilities?.webGL || false,
    supportsCanvas: state.browserCapabilities?.canvas || false
  };
};

/**
 * エラーバウンダリーフック
 */
export const useErrorBoundary = () => {
  const [error, setError] = useState<Error | null>(null);
  
  const resetError = useCallback(() => {
    setError(null);
  }, []);
  
  const captureError = useCallback((error: Error) => {
    setError(error);
  }, []);
  
  // エラー発生時の処理
  useEffect(() => {
    if (error) {
      // エラーハンドリングシステムに報告
      const errorHandling = ErrorHandlingManager.getInstance();
      errorHandling.reportError(error, 'error-boundary');
    }
  }, [error]);
  
  return {
    error,
    hasError: !!error,
    resetError,
    captureError
  };
};

export default useErrorHandling;