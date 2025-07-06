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
  irisOffsetX: number; // 虹彩X方向オフセット: -0.3 to +0.3
  irisOffsetY: number; // 虹彩Y方向オフセット: -0.2 to +0.2
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
export interface FaceParams {
  leftEye: EyeParams;
  rightEye: EyeParams;
  mouth: MouthParams;
  nose: NoseParams;
}

// デフォルト値
export const defaultEyeParams: EyeParams = {
  size: 1.0,
  positionX: 0,
  positionY: 0,
  irisOffsetX: 0,
  irisOffsetY: 0,
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

export const defaultFaceParams: FaceParams = {
  leftEye: { ...defaultEyeParams },
  rightEye: { ...defaultEyeParams },
  mouth: { ...defaultMouthParams },
  nose: { ...defaultNoseParams },
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
    positionX: { min: -50, max: 50, step: 0.5 },      // 2.5倍拡張（±50px）
    positionY: { min: -50, max: 50, step: 0.5 },      // 2.5倍拡張（±50px）
    irisOffsetX: { min: -0.3, max: 0.3, step: 0.01 }, // 虹彩X方向（目の幅の30%）
    irisOffsetY: { min: -0.2, max: 0.2, step: 0.01 }, // 虹彩Y方向（目の高さの20%、まぶた考慮）
  },
  mouth: {
    width: { min: 0.2, max: 4.0, step: 0.01 },       // 20倍の範囲（1/5縮小〜5倍拡大）
    height: { min: 0.2, max: 4.0, step: 0.01 },      // 20倍の範囲（1/5縮小〜5倍拡大）
    positionX: { min: -80, max: 80, step: 0.5 },      // 2.7倍拡張（±80px）
    positionY: { min: -80, max: 80, step: 0.5 },      // 2.7倍拡張（±80px）
  },
  nose: {
    width: { min: 0.3, max: 3.0, step: 0.01 },       // 10倍の範囲（1/3縮小〜3倍拡大）
    height: { min: 0.3, max: 3.0, step: 0.01 },      // 10倍の範囲（1/3縮小〜3倍拡大）
    positionX: { min: -40, max: 40, step: 0.5 },      // 2.7倍拡張（±40px）
    positionY: { min: -40, max: 40, step: 0.5 },      // 2.7倍拡張（±40px）
  },
} as const; 