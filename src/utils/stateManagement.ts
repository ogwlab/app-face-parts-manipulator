/**
 * 状態管理安全性システム
 * 
 * Zustand ストアの安全性を向上させ、状態の整合性を保証し、
 * 競合状態や不正な状態変更を防止するシステム
 */

import { FaceParams, ImageData, FaceDetectionResult } from '../types/face';
import { globalSafeExecutor } from './concurrency';
import ErrorHandlingManager, { ErrorType } from './errorHandling';

// 状態変更のタイプ
export enum StateChangeType {
  IMAGE_UPLOAD = 'IMAGE_UPLOAD',
  FACE_DETECTION = 'FACE_DETECTION',
  PARAM_UPDATE = 'PARAM_UPDATE',
  PROCESSING_START = 'PROCESSING_START',
  PROCESSING_END = 'PROCESSING_END',
  ERROR_SET = 'ERROR_SET',
  RESET = 'RESET'
}

// 状態変更ログ
export interface StateChangeLog {
  timestamp: number;
  type: StateChangeType;
  previousState: any;
  newState: any;
  context?: string;
  userId?: string;
  version: number;
}

// 状態バリデーションルール
export interface ValidationRule<T> {
  field: keyof T;
  validator: (value: any, fullState: T) => string | null;
  severity: 'error' | 'warning';
}

// 状態スナップショット
export interface StateSnapshot {
  timestamp: number;
  state: any;
  version: number;
  checksum: string;
}

/**
 * 状態整合性バリデーター
 */
export class StateValidator {
  private rules: ValidationRule<any>[] = [];

  /**
   * バリデーションルールを追加
   */
  addRule<T>(rule: ValidationRule<T>): void {
    this.rules.push(rule);
  }

  /**
   * 状態を検証
   */
  validate<T>(state: T): Array<{ field: string; message: string; severity: 'error' | 'warning' }> {
    const violations: Array<{ field: string; message: string; severity: 'error' | 'warning' }> = [];

    for (const rule of this.rules) {
      try {
        const fieldValue = (state as any)[rule.field];
        const errorMessage = rule.validator(fieldValue, state);
        
        if (errorMessage) {
          violations.push({
            field: String(rule.field),
            message: errorMessage,
            severity: rule.severity
          });
        }
      } catch (error) {
        violations.push({
          field: String(rule.field),
          message: `バリデーションエラー: ${error instanceof Error ? error.message : String(error)}`,
          severity: 'error'
        });
      }
    }

    return violations;
  }

  /**
   * デフォルトのバリデーションルールを設定
   */
  setupDefaultRules(): void {
    // 画像データの整合性チェック
    this.addRule({
      field: 'originalImage',
      validator: (image: ImageData | null) => {
        if (image && (!image.width || !image.height || image.width <= 0 || image.height <= 0)) {
          return '画像データが不正です（幅または高さが無効）';
        }
        return null;
      },
      severity: 'error'
    });

    // 顔検出結果の整合性チェック
    this.addRule({
      field: 'faceDetection',
      validator: (detection: FaceDetectionResult | null, state: any) => {
        if (detection && !state.originalImage) {
          return '顔検出結果が存在しますが、元画像がありません';
        }
        if (detection && detection.landmarks && detection.landmarks.length !== 68) {
          return '顔検出結果のランドマーク数が正しくありません（68個である必要があります）';
        }
        return null;
      },
      severity: 'error'
    });

    // パラメータ範囲チェック
    this.addRule({
      field: 'faceParams',
      validator: (params: FaceParams) => {
        const violations: string[] = [];
        
        // 目のパラメータチェック
        if (params.leftEye.size < 0.2 || params.leftEye.size > 4.0) {
          violations.push('左目のサイズが範囲外です（0.2-4.0）');
        }
        if (params.rightEye.size < 0.2 || params.rightEye.size > 4.0) {
          violations.push('右目のサイズが範囲外です（0.2-4.0）');
        }
        
        // 口のパラメータチェック
        if (params.mouth.width < 0.2 || params.mouth.width > 4.0) {
          violations.push('口の幅が範囲外です（0.2-4.0）');
        }
        if (params.mouth.height < 0.2 || params.mouth.height > 4.0) {
          violations.push('口の高さが範囲外です（0.2-4.0）');
        }
        
        // 鼻のパラメータチェック
        if (params.nose.width < 0.3 || params.nose.width > 3.0) {
          violations.push('鼻の幅が範囲外です（0.3-3.0）');
        }
        if (params.nose.height < 0.3 || params.nose.height > 3.0) {
          violations.push('鼻の高さが範囲外です（0.3-3.0）');
        }
        
        return violations.length > 0 ? violations.join(', ') : null;
      },
      severity: 'error'
    });

    // 処理状態の整合性チェック
    this.addRule({
      field: 'isProcessing',
      validator: (isProcessing: boolean, state: any) => {
        if (isProcessing && !state.originalImage) {
          return '処理中ですが、処理対象の画像がありません';
        }
        if (isProcessing && state.isLoading) {
          return '処理中と読み込み中が同時に有効になっています';
        }
        return null;
      },
      severity: 'warning'
    });
  }
}

/**
 * 状態変更ログシステム
 */
export class StateChangeLogger {
  private logs: StateChangeLog[] = [];
  private maxLogSize = 1000;
  private version = 0;

  /**
   * 状態変更を記録
   */
  logChange(
    type: StateChangeType,
    previousState: any,
    newState: any,
    context?: string
  ): void {
    this.version++;
    
    const log: StateChangeLog = {
      timestamp: Date.now(),
      type,
      previousState: this.cloneState(previousState),
      newState: this.cloneState(newState),
      context,
      version: this.version
    };

    this.logs.push(log);

    // ログサイズ制限
    if (this.logs.length > this.maxLogSize) {
      this.logs.shift();
    }

    // 重要な変更をコンソールログに出力
    if (this.isImportantChange(type)) {
      console.log(`🔄 状態変更: ${type}`, { context, version: this.version });
    }
  }

  /**
   * 状態を安全にクローン
   */
  private cloneState(state: any): any {
    try {
      return JSON.parse(JSON.stringify(state));
    } catch (error) {
      console.warn('状態のクローンに失敗しました:', error);
      return { error: '状態のクローンに失敗' };
    }
  }

  /**
   * 重要な変更かどうかを判定
   */
  private isImportantChange(type: StateChangeType): boolean {
    return [
      StateChangeType.IMAGE_UPLOAD,
      StateChangeType.FACE_DETECTION,
      StateChangeType.ERROR_SET,
      StateChangeType.RESET
    ].includes(type);
  }

  /**
   * 変更履歴を取得
   */
  getHistory(limit?: number): StateChangeLog[] {
    const logs = [...this.logs].reverse();
    return limit ? logs.slice(0, limit) : logs;
  }

  /**
   * 特定タイプの変更履歴を取得
   */
  getHistoryByType(type: StateChangeType): StateChangeLog[] {
    return this.logs.filter(log => log.type === type);
  }

  /**
   * 現在のバージョンを取得
   */
  getCurrentVersion(): number {
    return this.version;
  }

  /**
   * ログをクリア
   */
  clear(): void {
    this.logs = [];
    this.version = 0;
  }

  /**
   * 統計情報を取得
   */
  getStatistics() {
    const typeStats: Record<string, number> = {};
    this.logs.forEach(log => {
      typeStats[log.type] = (typeStats[log.type] || 0) + 1;
    });

    return {
      totalChanges: this.logs.length,
      currentVersion: this.version,
      typeBreakdown: typeStats,
      oldestChange: this.logs[0]?.timestamp,
      newestChange: this.logs[this.logs.length - 1]?.timestamp
    };
  }
}

/**
 * 状態スナップショットマネージャー
 */
export class StateSnapshotManager {
  private snapshots: StateSnapshot[] = [];
  private maxSnapshots = 50;

  /**
   * 状態のスナップショットを作成
   */
  createSnapshot(state: any, version: number): StateSnapshot {
    const serializedState = JSON.stringify(state);
    const checksum = this.calculateChecksum(serializedState);
    
    const snapshot: StateSnapshot = {
      timestamp: Date.now(),
      state: JSON.parse(serializedState),
      version,
      checksum
    };

    this.snapshots.push(snapshot);

    // スナップショット数制限
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  /**
   * チェックサムを計算
   */
  private calculateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return hash.toString(16);
  }

  /**
   * 最新のスナップショットを取得
   */
  getLatestSnapshot(): StateSnapshot | null {
    return this.snapshots[this.snapshots.length - 1] || null;
  }

  /**
   * 特定バージョンのスナップショットを取得
   */
  getSnapshotByVersion(version: number): StateSnapshot | null {
    return this.snapshots.find(snapshot => snapshot.version === version) || null;
  }

  /**
   * 全スナップショットを取得
   */
  getAllSnapshots(): StateSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * スナップショットの整合性を検証
   */
  validateSnapshot(snapshot: StateSnapshot): boolean {
    try {
      const serializedState = JSON.stringify(snapshot.state);
      const calculatedChecksum = this.calculateChecksum(serializedState);
      return calculatedChecksum === snapshot.checksum;
    } catch (error) {
      console.error('スナップショットの検証に失敗しました:', error);
      return false;
    }
  }

  /**
   * 状態を復元
   */
  restoreFromSnapshot(snapshot: StateSnapshot): any {
    if (!this.validateSnapshot(snapshot)) {
      throw new Error('スナップショットが破損しています');
    }
    return JSON.parse(JSON.stringify(snapshot.state));
  }

  /**
   * スナップショットをクリア
   */
  clear(): void {
    this.snapshots = [];
  }
}

/**
 * 安全な状態管理システム
 */
export class SafeStateManager {
  private validator = new StateValidator();
  private logger = new StateChangeLogger();
  private snapshotManager = new StateSnapshotManager();
  private errorManager: ErrorHandlingManager | null = null;
  private autoSnapshotInterval = 10; // 10回の変更ごとにスナップショット作成

  constructor() {
    this.validator.setupDefaultRules();
    this.initializeErrorManager();
  }

  /**
   * エラーマネージャー初期化
   */
  private async initializeErrorManager(): Promise<void> {
    try {
      this.errorManager = ErrorHandlingManager.getInstance();
      await this.errorManager.initialize();
    } catch (error) {
      console.warn('エラーマネージャーの初期化に失敗しました:', error);
    }
  }

  /**
   * 安全な状態更新
   */
  async safeStateUpdate<T>(
    currentState: T,
    updates: Partial<T>,
    changeType: StateChangeType,
    context?: string
  ): Promise<T> {
    return globalSafeExecutor.safeStateUpdate(async () => {
      // 新しい状態を作成
      const newState = { ...currentState, ...updates };

      // 状態を検証
      const violations = this.validator.validate(newState);
      
      // エラーレベルの違反があれば例外を投げる
      const errors = violations.filter(v => v.severity === 'error');
      if (errors.length > 0) {
        const errorMessage = `状態の整合性エラー: ${errors.map(e => e.message).join(', ')}`;
        if (this.errorManager) {
          await this.errorManager.reportError(new Error(errorMessage), context);
        }
        throw new Error(errorMessage);
      }

      // 警告レベルの違反をログ出力
      const warnings = violations.filter(v => v.severity === 'warning');
      if (warnings.length > 0) {
        console.warn('⚠️ 状態の警告:', warnings.map(w => w.message).join(', '));
      }

      // 変更をログに記録
      this.logger.logChange(changeType, currentState, newState, context);

      // 定期的にスナップショットを作成
      const changeCount = this.logger.getCurrentVersion();
      if (changeCount % this.autoSnapshotInterval === 0) {
        this.snapshotManager.createSnapshot(newState, changeCount);
      }

      return newState;
    }, context || 'state-update');
  }

  /**
   * 状態復旧
   */
  async recoverState(targetVersion?: number): Promise<any> {
    try {
      let snapshot: StateSnapshot | null;
      
      if (targetVersion) {
        snapshot = this.snapshotManager.getSnapshotByVersion(targetVersion);
      } else {
        snapshot = this.snapshotManager.getLatestSnapshot();
      }

      if (!snapshot) {
        throw new Error('復旧可能なスナップショットが見つかりません');
      }

      const restoredState = this.snapshotManager.restoreFromSnapshot(snapshot);
      
      // 復旧した状態を検証
      const violations = this.validator.validate(restoredState);
      const errors = violations.filter(v => v.severity === 'error');
      
      if (errors.length > 0) {
        throw new Error(`復旧した状態に問題があります: ${errors.map(e => e.message).join(', ')}`);
      }

      console.log(`✅ 状態をバージョン ${snapshot.version} から復旧しました`);
      return restoredState;
    } catch (error) {
      if (this.errorManager) {
        await this.errorManager.reportError(
          error instanceof Error ? error : new Error(String(error)),
          'state-recovery'
        );
      }
      throw error;
    }
  }

  /**
   * 状態の健全性チェック
   */
  async healthCheck(state: any): Promise<{
    isHealthy: boolean;
    issues: Array<{ field: string; message: string; severity: 'error' | 'warning' }>;
    recommendations: string[];
  }> {
    const violations = this.validator.validate(state);
    const errors = violations.filter(v => v.severity === 'error');
    const warnings = violations.filter(v => v.severity === 'warning');
    
    const recommendations: string[] = [];
    
    if (errors.length > 0) {
      recommendations.push('状態にエラーがあります。復旧機能を使用することを推奨します。');
    }
    
    if (warnings.length > 0) {
      recommendations.push('状態に警告があります。パラメータを確認してください。');
    }
    
    // メモリ使用量チェック
    if (this.errorManager) {
      const memoryInfo = await this.errorManager.monitorMemory();
      if (memoryInfo.isLowMemory) {
        recommendations.push('メモリ使用量が高くなっています。不要なデータをクリアしてください。');
      }
    }

    return {
      isHealthy: errors.length === 0,
      issues: violations,
      recommendations
    };
  }

  /**
   * 統計情報を取得
   */
  getStatistics() {
    return {
      logger: this.logger.getStatistics(),
      snapshots: {
        count: this.snapshotManager.getAllSnapshots().length,
        latest: this.snapshotManager.getLatestSnapshot()?.version || 0
      },
      validator: {
        ruleCount: this.validator['rules'].length
      }
    };
  }

  /**
   * カスタムバリデーションルールを追加
   */
  addValidationRule<T>(rule: ValidationRule<T>): void {
    this.validator.addRule(rule);
  }

  /**
   * 変更履歴を取得
   */
  getChangeHistory(limit?: number): StateChangeLog[] {
    return this.logger.getHistory(limit);
  }

  /**
   * スナップショット一覧を取得
   */
  getSnapshots(): StateSnapshot[] {
    return this.snapshotManager.getAllSnapshots();
  }

  /**
   * システムをリセット
   */
  reset(): void {
    this.logger.clear();
    this.snapshotManager.clear();
  }
}

// グローバルインスタンス
export const globalStateManager = new SafeStateManager();

// エクスポート
export default {
  StateValidator,
  StateChangeLogger,
  StateSnapshotManager,
  SafeStateManager,
  globalStateManager,
  StateChangeType
};