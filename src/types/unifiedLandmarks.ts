/**
 * 統一されたランドマークシステムの型定義
 * 従来の68点システムと密ランドマークシステムを統合
 */

import type { Point, FaceLandmarks } from './face';

/**
 * 統一されたランドマーク構造
 * 常に密ランドマークを含む設計で、モード切り替えによる不連続性を排除
 */
export interface UnifiedLandmarks {
  /**
   * 標準的な68点ランドマーク（従来システムとの互換性維持）
   */
  standard: FaceLandmarks;
  
  /**
   * 密なランドマーク（常に生成される）
   * 虹彩制御の有無に関わらず一貫した処理を実現
   */
  dense: {
    leftEye?: Point[];   // 左目の密な点群（50-70点）
    rightEye?: Point[];  // 右目の密な点群（50-70点）
  };
}

/**
 * メッシュ変形の入力データ
 * グローバル変数を使わず、明示的なデータフローを実現
 */
export interface MeshDeformationInput {
  originalLandmarks: UnifiedLandmarks;
  deformedLandmarks: UnifiedLandmarks;
  imageWidth: number;
  imageHeight: number;
}

/**
 * 密ランドマーク生成のオプション
 * パフォーマンスと品質のバランスを調整可能
 */
export interface DenseLandmarkOptions {
  /**
   * 虹彩周辺の点の密度（デフォルト: 'medium'）
   */
  irisDensity?: 'low' | 'medium' | 'high';
  
  /**
   * まぶた補間の品質（デフォルト: 'medium'）
   */
  eyelidQuality?: 'low' | 'medium' | 'high';
  
  /**
   * 遷移領域の適応的配置を有効化（デフォルト: true）
   */
  adaptiveTransition?: boolean;
}