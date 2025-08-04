import type { FaceParams } from '../types/face';

// 保存される設定の型定義
export interface SavedSettings {
  faceParams: FaceParams;
  qualityMode: 'fast' | 'balanced' | 'highest';
  standardizationEnabled: boolean;
  timestamp: number;
  version: string;
}

// ローカルストレージキー
const STORAGE_KEY = 'face-app-settings';
const BACKUP_KEY = 'face-app-settings-backup';
const CURRENT_VERSION = '1.1.0'; // Version bump for faceShape migration

/**
 * 設定をLocalStorageに保存
 */
export const saveSettingsToStorage = (
  faceParams: FaceParams,
  qualityMode: 'fast' | 'balanced' | 'highest' = 'balanced',
  standardizationEnabled: boolean = false
): boolean => {
  try {
    const settings: SavedSettings = {
      faceParams,
      qualityMode,
      standardizationEnabled,
      timestamp: Date.now(),
      version: CURRENT_VERSION
    };

    const settingsJson = JSON.stringify(settings);
    
    // メイン設定を保存
    localStorage.setItem(STORAGE_KEY, settingsJson);
    
    // バックアップも作成
    localStorage.setItem(BACKUP_KEY, settingsJson);
    
    console.log('✅ 設定を保存しました:', settings);
    return true;
  } catch (error) {
    console.error('❌ 設定保存エラー:', error);
    return false;
  }
};

/**
 * 設定のマイグレーション（roundness → faceShape）
 */
const migrateSettings = (settings: any): SavedSettings => {
  // contourパラメータのマイグレーション
  if (settings.faceParams?.contour && 'roundness' in settings.faceParams.contour) {
    console.log('📦 設定をマイグレーション: roundness → faceShape');
    settings.faceParams.contour.faceShape = settings.faceParams.contour.roundness;
    delete settings.faceParams.contour.roundness;
  }
  
  // バージョンを更新
  settings.version = CURRENT_VERSION;
  
  return settings as SavedSettings;
};

/**
 * 設定をLocalStorageから読み込み
 */
export const loadSettingsFromStorage = (): SavedSettings | null => {
  try {
    const settingsJson = localStorage.getItem(STORAGE_KEY);
    if (!settingsJson) {
      console.log('💡 保存された設定がありません');
      return null;
    }

    let settings: SavedSettings = JSON.parse(settingsJson);
    
    // バージョンチェックとマイグレーション
    if (settings.version !== CURRENT_VERSION) {
      console.warn('⚠️ 設定のバージョンが異なります。マイグレーションを試みます。', 
        { saved: settings.version, current: CURRENT_VERSION });
      
      // 古いバージョンの設定をマイグレーション
      if (settings.version === '1.0.0') {
        settings = migrateSettings(settings);
        // マイグレーション後の設定を保存
        saveSettingsToStorage(settings.faceParams, settings.qualityMode, settings.standardizationEnabled);
      } else {
        // 未知のバージョンは無視
        return null;
      }
    }

    // データ整合性チェック
    if (!isValidSettings(settings)) {
      console.error('❌ 設定データが破損しています。バックアップを試します。');
      return loadSettingsFromBackup();
    }

    console.log('✅ 設定を読み込みました:', settings);
    return settings;
  } catch (error) {
    console.error('❌ 設定読み込みエラー:', error);
    return loadSettingsFromBackup();
  }
};

/**
 * バックアップ設定から読み込み
 */
const loadSettingsFromBackup = (): SavedSettings | null => {
  try {
    const backupJson = localStorage.getItem(BACKUP_KEY);
    if (!backupJson) {
      console.log('💡 バックアップ設定もありません');
      return null;
    }

    let settings: SavedSettings = JSON.parse(backupJson);
    
    // バージョンチェックとマイグレーション
    if (settings.version !== CURRENT_VERSION) {
      if (settings.version === '1.0.0') {
        settings = migrateSettings(settings);
      } else {
        // 未知のバージョンは無視
        console.warn('⚠️ 未知のバージョンです:', settings.version);
        return null;
      }
    }
    
    if (!isValidSettings(settings)) {
      console.error('❌ バックアップ設定も破損しています。');
      return null;
    }

    console.log('✅ バックアップ設定を読み込みました:', settings);
    
    // メイン設定を復旧
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    
    return settings;
  } catch (error) {
    console.error('❌ バックアップ読み込みエラー:', error);
    return null;
  }
};

/**
 * 設定をLocalStorageから削除
 */
export const clearSettingsFromStorage = (): boolean => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BACKUP_KEY);
    console.log('✅ 保存された設定を削除しました');
    return true;
  } catch (error) {
    console.error('❌ 設定削除エラー:', error);
    return false;
  }
};

/**
 * 保存された設定があるかチェック
 */
export const hasStoredSettings = (): boolean => {
  return localStorage.getItem(STORAGE_KEY) !== null;
};

/**
 * 設定データの整合性チェック
 */
const isValidSettings = (settings: unknown): settings is SavedSettings => {
  if (!settings || typeof settings !== 'object' || settings === null) {
    return false;
  }

  const settingsObj = settings as Record<string, unknown>;

  // 必須フィールドのチェック
  if (!settingsObj.faceParams || typeof settingsObj.faceParams !== 'object') {
    return false;
  }

  // FaceParamsの構造チェック
  const faceParams = settingsObj.faceParams as Record<string, unknown>;
  const requiredParts = ['leftEye', 'rightEye', 'mouth', 'nose'];
  
  for (const part of requiredParts) {
    if (!faceParams[part] || typeof faceParams[part] !== 'object') {
      return false;
    }
  }

  // タイムスタンプとバージョンの存在チェック
  if (typeof settingsObj.timestamp !== 'number' || typeof settingsObj.version !== 'string') {
    return false;
  }

  return true;
};

/**
 * LocalStorageの利用可能性をチェック
 */
export const isStorageAvailable = (): boolean => {
  try {
    const testKey = 'storage-test';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

/**
 * 設定の要約情報を取得（UI表示用）
 */
export const getSettingsSummary = (): { 
  hasSettings: boolean;
  lastSaved?: Date;
  settingsCount?: number;
} => {
  const settings = loadSettingsFromStorage();
  
  if (!settings) {
    return { hasSettings: false };
  }

  // パラメータがデフォルト値から変更されている数をカウント
  const { faceParams } = settings;
  let settingsCount = 0;
  
  // 簡易的なデフォルト値判定
  Object.values(faceParams).forEach(partParams => {
    Object.values(partParams as Record<string, unknown>).forEach(value => {
      if (typeof value === 'number' && Math.abs(value - (value > 0.5 ? 1.0 : 0)) > 0.01) {
        settingsCount++;
      }
    });
  });

  return {
    hasSettings: true,
    lastSaved: new Date(settings.timestamp),
    settingsCount
  };
};