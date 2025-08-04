// 顔特徴点の座標
export interface Point {
  x: number;
  y: number;
}

// 顔の各パーツの特徴点
export interface FaceLandmarks {
  leftEye: Point[];      // 特徴点 36-41
  rightEye: Point[];     // 特徴点 42-47
  mouth: Point[];        // 特徴点 48-67
  nose: Point[];         // 特徴点 27-35
  jawline: Point[];      // 特徴点 0-16
  leftEyebrow: Point[];  // 特徴点 17-21
  rightEyebrow: Point[]; // 特徴点 22-26
}

// 目のパラメータ
export interface EyeParams {
  size: number;      // 大きさ: 0.5-2.0
  positionX: number; // X位置: -20 to +20
  positionY: number; // Y位置: -20 to +20
}

// 口のパラメータ
export interface MouthParams {
  width: number;     // 幅: 0.5-2.0
  height: number;    // 高さ: 0.5-2.0
  positionX: number; // X位置: -30 to +30
  positionY: number; // Y位置: -30 to +30
}

// 鼻のパラメータ
export interface NoseParams {
  width: number;     // 幅: 0.7-1.5
  height: number;    // 高さ: 0.7-1.5
  positionX: number; // X位置: -15 to +15
  positionY: number; // Y位置: -15 to +15
}

// 全体の顔パラメータ
// 輪郭操作パラメータ
export interface ContourParams {
  faceShape: number;      // -1.0〜1.0 (負: 四角い, 正: 丸い)
  jawWidth: number;       // 0.7〜1.3 (顎の幅)
  cheekFullness: number;  // 0.7〜1.3 (頬の膨らみ)
  chinHeight: number;     // 0.8〜1.2 (顎の長さ)
  smoothness: number;     // 0.0〜1.0 (輪郭の滑らかさ)
}

export interface FaceParams {
  leftEye: EyeParams;
  rightEye: EyeParams;
  mouth: MouthParams;
  nose: NoseParams;
  contour: ContourParams;
}

// デフォルト値
export const defaultEyeParams: EyeParams = {
  size: 1.0,
  positionX: 0,
  positionY: 0,
};

export const defaultMouthParams: MouthParams = {
  width: 1.0,
  height: 1.0,
  positionX: 0,
  positionY: 0,
};

export const defaultNoseParams: NoseParams = {
  width: 1.0,
  height: 1.0,
  positionX: 0,
  positionY: 0,
};

export const defaultContourParams: ContourParams = {
  faceShape: 0,       // デフォルトは元の輪郭形状
  jawWidth: 1.0,      // デフォルトは変更なし
  cheekFullness: 1.0, // デフォルトは変更なし
  chinHeight: 1.0,    // デフォルトは変更なし
  smoothness: 0.5,    // 中程度の滑らかさ
};

export const defaultFaceParams: FaceParams = {
  leftEye: { ...defaultEyeParams },
  rightEye: { ...defaultEyeParams },
  mouth: { ...defaultMouthParams },
  nose: { ...defaultNoseParams },
  contour: { ...defaultContourParams },
};

// 画像関連の型定義
export interface ImageData {
  file: File;
  url: string;
  width: number;
  height: number;
}

// 顔検出結果
export interface FaceDetectionResult {
  isDetected: boolean;
  landmarks: FaceLandmarks;
  confidence: number;
  warning?: string;
  centers?: {
    leftEye: Point;
    rightEye: Point;
    mouth: Point;
    nose: Point;
  };
  bounds?: {
    leftEye: { left: number; top: number; right: number; bottom: number; width: number; height: number };
    rightEye: { left: number; top: number; right: number; bottom: number; width: number; height: number };
    mouth: { left: number; top: number; right: number; bottom: number; width: number; height: number };
    nose: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  };
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// パラメータの範囲定義（創造的変形のための拡張範囲）
export const PARAM_LIMITS = {
  eye: {
    size: { min: 0.2, max: 4.0, step: 0.01 },        // 20倍の範囲（1/5縮小〜5倍拡大）
    positionX: { min: -25, max: 25, step: 0.1 },      // ±25%（顔領域横幅に対する比率）
    positionY: { min: -25, max: 25, step: 0.1 },      // ±25%（顔領域縦幅に対する比率）
  },
  mouth: {
    width: { min: 0.2, max: 4.0, step: 0.01 },       // 20倍の範囲（1/5縮小〜5倍拡大）
    height: { min: 0.2, max: 4.0, step: 0.01 },      // 20倍の範囲（1/5縮小〜5倍拡大）
    positionX: { min: -30, max: 30, step: 0.1 },      // ±30%（顔領域横幅に対する比率）
    positionY: { min: -30, max: 30, step: 0.1 },      // ±30%（顔領域縦幅に対する比率）
  },
  nose: {
    width: { min: 0.3, max: 3.0, step: 0.01 },       // 10倍の範囲（1/3縮小〜3倍拡大）
    height: { min: 0.3, max: 3.0, step: 0.01 },      // 10倍の範囲（1/3縮小〜3倍拡大）
    positionX: { min: -25, max: 25, step: 0.1 },      // ±25%（顔領域横幅に対する比率）
    positionY: { min: -25, max: 25, step: 0.1 },      // ±25%（顔領域縦幅に対する比率）
  },
  contour: {
    faceShape: { min: -1.0, max: 1.0, step: 0.01 },     // 角張り⇔丸み
    jawWidth: { min: 0.7, max: 1.3, step: 0.01 },       // 顎の幅
    cheekFullness: { min: 0.7, max: 1.3, step: 0.01 },  // 頬の膨らみ
    chinHeight: { min: 0.8, max: 1.2, step: 0.01 },     // 顎の長さ
    smoothness: { min: 0.0, max: 1.0, step: 0.01 },     // 輪郭の滑らかさ
  },
} as const; 