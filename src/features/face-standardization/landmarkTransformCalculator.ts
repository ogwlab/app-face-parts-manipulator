import type { Point } from '../../types/face';
import type { LandmarkTransformation } from './eyeDistanceNormalizer';

/**
 * 高精度特徴点変換計算エンジン
 * 
 * このモジュールは以下の機能を提供します:
 * - Thin Plate Spline (TPS) ベースの変換計算
 * - 特徴点の重み付き補間
 * - 局所的変形の制御
 * - 解析的変換の組み合わせ
 */

/**
 * TPS変換パラメータ
 */
export interface TPSTransformParameters {
  weights: number[];           // 径基函数の重み
  affineMatrix: number[][];    // アフィン変換行列 [2x3]
  controlPoints: Point[];      // 制御点座標
  lambda: number;              // 正則化パラメータ
}

/**
 * 変換精度オプション
 */
export interface TransformPrecisionOptions {
  method: 'tps' | 'rbf' | 'hybrid';    // 変換手法
  regularization: number;               // 正則化の強度 (0.0-1.0)
  localInfluence: number;              // 局所影響半径
  preserveRigidity: boolean;           // 剛性保持（特徴点の形状を維持）
  adaptiveWeighting: boolean;          // 適応的重み付け
}

/**
 * デフォルトの精度オプション
 */
export const DEFAULT_PRECISION_OPTIONS: TransformPrecisionOptions = {
  method: 'hybrid',
  regularization: 0.1,
  localInfluence: 100,
  preserveRigidity: true,
  adaptiveWeighting: true
};

/**
 * 高精度特徴点変換パラメータを計算する
 * @param transformation - 基本変換情報
 * @param options - 精度オプション
 * @returns TPS変換パラメータ
 */
export const calculateHighPrecisionTransform = (
  transformation: LandmarkTransformation,
  options: TransformPrecisionOptions = DEFAULT_PRECISION_OPTIONS
): TPSTransformParameters => {
  const { originalPoints, targetPoints } = transformation;
  
  console.log('🔬 高精度変換計算開始:', {
    controlPointCount: originalPoints.length,
    method: options.method,
    regularization: options.regularization
  });
  
  // 制御点の妥当性チェック
  validateControlPoints(originalPoints, targetPoints);
  
  // 手法に応じた変換計算
  switch (options.method) {
    case 'tps':
      return calculateTPSTransform(originalPoints, targetPoints, options);
    case 'rbf':
      return calculateRBFTransform(originalPoints, targetPoints, options);
    case 'hybrid':
      return calculateHybridTransform(originalPoints, targetPoints, options);
    default:
      throw new Error(`Unknown transform method: ${options.method}`);
  }
};

/**
 * TPS（Thin Plate Spline）変換を計算する
 * @param originalPoints - 元制御点
 * @param targetPoints - 目標制御点
 * @param options - オプション
 * @returns TPS変換パラメータ
 */
const calculateTPSTransform = (
  originalPoints: Point[],
  targetPoints: Point[],
  options: TransformPrecisionOptions
): TPSTransformParameters => {
  const n = originalPoints.length;
  const lambda = options.regularization;
  
  // カーネル行列を構築
  const K = buildTPSKernelMatrix(originalPoints, lambda);
  
  // 目標座標行列を構築
  const targetX = targetPoints.map(p => p.x);
  const targetY = targetPoints.map(p => p.y);
  
  // 線形システムを解く
  const weightsX = solveLinearSystem(K, targetX);
  const weightsY = solveLinearSystem(K, targetY);
  
  // アフィン変換部分を抽出
  const affineMatrix = [
    [weightsX[n], weightsX[n + 1], weightsX[n + 2]],
    [weightsY[n], weightsY[n + 1], weightsY[n + 2]]
  ];
  
  // 径基函数の重みを結合
  const weights = [];
  for (let i = 0; i < n; i++) {
    weights.push(weightsX[i], weightsY[i]);
  }
  
  return {
    weights,
    affineMatrix,
    controlPoints: originalPoints,
    lambda
  };
};

/**
 * RBF（Radial Basis Function）変換を計算する
 * @param originalPoints - 元制御点
 * @param targetPoints - 目標制御点
 * @param options - オプション
 * @returns TPS変換パラメータ
 */
const calculateRBFTransform = (
  originalPoints: Point[],
  targetPoints: Point[],
  options: TransformPrecisionOptions
): TPSTransformParameters => {
  const n = originalPoints.length;
  
  // RBF カーネル行列を構築（ガウシアンカーネル）
  const sigma = options.localInfluence;
  const K = buildRBFKernelMatrix(originalPoints, sigma);
  
  // 正則化項を追加
  for (let i = 0; i < n; i++) {
    K[i][i] += options.regularization;
  }
  
  // 目標座標
  const targetX = targetPoints.map(p => p.x);
  const targetY = targetPoints.map(p => p.y);
  
  // 重みを計算
  const weightsX = solveLinearSystem(K, targetX);
  const weightsY = solveLinearSystem(K, targetY);
  
  // 簡易アフィン変換（平均移動）
  const meanOriginal = calculateCentroid(originalPoints);
  const meanTarget = calculateCentroid(targetPoints);
  
  const affineMatrix = [
    [1, 0, meanTarget.x - meanOriginal.x],
    [0, 1, meanTarget.y - meanOriginal.y]
  ];
  
  const weights = [];
  for (let i = 0; i < n; i++) {
    weights.push(weightsX[i], weightsY[i]);
  }
  
  return {
    weights,
    affineMatrix,
    controlPoints: originalPoints,
    lambda: options.regularization
  };
};

/**
 * ハイブリッド変換を計算する（TPS + RBF）
 * @param originalPoints - 元制御点
 * @param targetPoints - 目標制御点
 * @param options - オプション
 * @returns TPS変換パラメータ
 */
const calculateHybridTransform = (
  originalPoints: Point[],
  targetPoints: Point[],
  options: TransformPrecisionOptions
): TPSTransformParameters => {
  // まずTPS変換を計算
  const tpsResult = calculateTPSTransform(originalPoints, targetPoints, options);
  
  // 局所的な調整のためにRBF成分を追加
  const rbfOptions = { ...options, regularization: options.regularization * 0.5 };
  const rbfResult = calculateRBFTransform(originalPoints, targetPoints, rbfOptions);
  
  // 重みを組み合わせ（TPS 70% + RBF 30%）
  const hybridWeights = tpsResult.weights.map((w, i) => 
    w * 0.7 + rbfResult.weights[i] * 0.3
  );
  
  return {
    weights: hybridWeights,
    affineMatrix: tpsResult.affineMatrix,
    controlPoints: originalPoints,
    lambda: tpsResult.lambda
  };
};

/**
 * TPSカーネル行列を構築する
 * @param points - 制御点
 * @param lambda - 正則化パラメータ
 * @returns カーネル行列
 */
const buildTPSKernelMatrix = (points: Point[], lambda: number): number[][] => {
  const n = points.length;
  const K = Array(n + 3).fill(null).map(() => Array(n + 3).fill(0));
  
  // 径基函数部分 K[i][j] = φ(||p_i - p_j||)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        K[i][j] = lambda; // 正則化項
      } else {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const r2 = dx * dx + dy * dy;
        K[i][j] = r2 > 0 ? r2 * Math.log(r2) : 0; // TPS 径基函数
      }
    }
  }
  
  // アフィン制約部分
  for (let i = 0; i < n; i++) {
    K[i][n] = K[n][i] = 1;           // 定数項
    K[i][n + 1] = K[n + 1][i] = points[i].x; // x 項
    K[i][n + 2] = K[n + 2][i] = points[i].y; // y 項
  }
  
  return K;
};

/**
 * RBFカーネル行列を構築する
 * @param points - 制御点
 * @param sigma - カーネル幅パラメータ
 * @returns カーネル行列
 */
const buildRBFKernelMatrix = (points: Point[], sigma: number): number[][] => {
  const n = points.length;
  const K = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const r2 = dx * dx + dy * dy;
      K[i][j] = Math.exp(-r2 / (2 * sigma * sigma)); // ガウシアンカーネル
    }
  }
  
  return K;
};

/**
 * 線形システム Ax = b を解く（ガウス消去法）
 * @param A - 係数行列
 * @param b - 右辺ベクトル
 * @returns 解ベクトル
 */
const solveLinearSystem = (A: number[][], b: number[]): number[] => {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);
  
  // 前進消去
  for (let k = 0; k < n; k++) {
    // ピボット選択
    let maxRow = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(augmented[i][k]) > Math.abs(augmented[maxRow][k])) {
        maxRow = i;
      }
    }
    
    // 行交換
    if (maxRow !== k) {
      [augmented[k], augmented[maxRow]] = [augmented[maxRow], augmented[k]];
    }
    
    // 消去
    for (let i = k + 1; i < n; i++) {
      const factor = augmented[i][k] / augmented[k][k];
      for (let j = k; j < n + 1; j++) {
        augmented[i][j] -= factor * augmented[k][j];
      }
    }
  }
  
  // 後退代入
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j];
    }
    x[i] /= augmented[i][i];
  }
  
  return x;
};

/**
 * 点群の重心を計算する
 * @param points - 点群
 * @returns 重心
 */
const calculateCentroid = (points: Point[]): Point => {
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  
  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  };
};

/**
 * 制御点の妥当性をチェックする
 * @param originalPoints - 元制御点
 * @param targetPoints - 目標制御点
 */
const validateControlPoints = (originalPoints: Point[], targetPoints: Point[]): void => {
  if (originalPoints.length !== targetPoints.length) {
    throw new Error('制御点の数が一致しません');
  }
  
  if (originalPoints.length < 3) {
    throw new Error('制御点が不足しています（最低3点必要）');
  }
  
  // 重複点のチェック
  for (let i = 0; i < originalPoints.length; i++) {
    for (let j = i + 1; j < originalPoints.length; j++) {
      const dx = originalPoints[i].x - originalPoints[j].x;
      const dy = originalPoints[i].y - originalPoints[j].y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 1e-6) {
        console.warn(`⚠️ 重複制御点を検出: index ${i}, ${j}`);
      }
    }
  }
};

/**
 * 変換パラメータを使用して点を変換する
 * @param point - 変換する点
 * @param params - TPS変換パラメータ
 * @returns 変換後の点
 */
export const transformPointWithTPS = (
  point: Point,
  params: TPSTransformParameters
): Point => {
  const { weights, affineMatrix, controlPoints } = params;
  const n = controlPoints.length;
  
  // アフィン変換部分
  let x = affineMatrix[0][0] * point.x + affineMatrix[0][1] * point.y + affineMatrix[0][2];
  let y = affineMatrix[1][0] * point.x + affineMatrix[1][1] * point.y + affineMatrix[1][2];
  
  // 径基函数部分
  for (let i = 0; i < n; i++) {
    const dx = point.x - controlPoints[i].x;
    const dy = point.y - controlPoints[i].y;
    const r2 = dx * dx + dy * dy;
    
    if (r2 > 0) {
      const phi = r2 * Math.log(r2);
      x += weights[i * 2] * phi;
      y += weights[i * 2 + 1] * phi;
    }
  }
  
  return { x, y };
};

/**
 * 変換の品質を評価する
 * @param originalPoints - 元制御点
 * @param targetPoints - 目標制御点  
 * @param params - 変換パラメータ
 * @returns 品質スコア（0-100）
 */
export const evaluateTransformQuality = (
  originalPoints: Point[],
  targetPoints: Point[],
  params: TPSTransformParameters
): number => {
  let totalError = 0;
  const n = originalPoints.length;
  
  for (let i = 0; i < n; i++) {
    const transformed = transformPointWithTPS(originalPoints[i], params);
    const dx = transformed.x - targetPoints[i].x;
    const dy = transformed.y - targetPoints[i].y;
    totalError += Math.sqrt(dx * dx + dy * dy);
  }
  
  const averageError = totalError / n;
  
  // 平均誤差から品質スコアを計算（誤差1ピクセル以下で100%）
  return Math.max(0, 100 - averageError);
};