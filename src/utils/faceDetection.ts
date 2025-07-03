import * as faceapi from 'face-api.js';

// モデルの読み込み状態を管理
let modelsLoaded = false;

/**
 * face-api.jsのモデルを読み込む
 */
export const loadModels = async (): Promise<void> => {
  if (modelsLoaded) return;

  try {
    // モデルファイルのパスを設定
    const MODEL_URL = '/models';
    
    // 必要なモデルを並列で読み込み
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    ]);

    modelsLoaded = true;
    console.log('✅ face-api.js models loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load face-api.js models:', error);
    throw new Error('顔検出モデルの読み込みに失敗しました');
  }
};

/**
 * 画像から顔を検出し、68個の特徴点を取得する
 * @param imageElement - 画像要素（HTMLImageElement）
 * @returns 検出された顔の特徴点データ
 */
export const detectFaceLandmarks = async (
  imageElement: HTMLImageElement
): Promise<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>> => {
  // モデルが読み込まれていない場合は読み込む
  if (!modelsLoaded) {
    await loadModels();
  }

  try {
    // 顔検出と特徴点検出を同時に実行
    const detections = await faceapi
      .detectAllFaces(
        imageElement,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,    // 入力サイズ（大きいほど精度が良いが遅い）
          scoreThreshold: 0.5 // 検出スコアの閾値
        })
      )
      .withFaceLandmarks();

    // 検出結果の検証
    if (detections.length === 0) {
      throw new Error('顔が検出されませんでした。別の画像を試してください。');
    }

    if (detections.length > 1) {
      console.warn('⚠️ 複数の顔が検出されました。最初の顔を使用します。');
    }

    // 最初の顔の特徴点を返す
    return detections[0];
  } catch (error) {
    console.error('❌ Face detection failed:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('顔検出処理でエラーが発生しました');
  }
};

/**
 * 検出された特徴点から顔パーツ別の座標を抽出する
 * @param landmarks - face-api.jsの特徴点データ
 * @returns 各パーツの特徴点座標
 */
export const extractFaceParts = (
  landmarks: faceapi.FaceLandmarks68
): {
  leftEye: { x: number; y: number }[];
  rightEye: { x: number; y: number }[];
  mouth: { x: number; y: number }[];
  nose: { x: number; y: number }[];
  jawline: { x: number; y: number }[];
  leftEyebrow: { x: number; y: number }[];
  rightEyebrow: { x: number; y: number }[];
} => {
  const points = landmarks.positions;

  return {
    // 左目: 特徴点 36-41 (6個)
    leftEye: points.slice(36, 42).map(p => ({ x: p.x, y: p.y })),
    
    // 右目: 特徴点 42-47 (6個)
    rightEye: points.slice(42, 48).map(p => ({ x: p.x, y: p.y })),
    
    // 口: 特徴点 48-67 (20個)
    mouth: points.slice(48, 68).map(p => ({ x: p.x, y: p.y })),
    
    // 鼻: 特徴点 27-35 (9個)
    nose: points.slice(27, 36).map(p => ({ x: p.x, y: p.y })),
    
    // 顎ライン: 特徴点 0-16 (17個)
    jawline: points.slice(0, 17).map(p => ({ x: p.x, y: p.y })),
    
    // 左眉毛: 特徴点 17-21 (5個)
    leftEyebrow: points.slice(17, 22).map(p => ({ x: p.x, y: p.y })),
    
    // 右眉毛: 特徴点 22-26 (5個)
    rightEyebrow: points.slice(22, 27).map(p => ({ x: p.x, y: p.y }))
  };
};

/**
 * 各パーツの中心点を計算する
 * @param points - パーツの特徴点座標配列
 * @returns 中心点座標
 */
export const calculatePartCenter = (
  points: { x: number; y: number }[]
): { x: number; y: number } => {
  const sum = points.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y
    }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  };
};

/**
 * 各パーツの境界ボックスを計算する
 * @param points - パーツの特徴点座標配列
 * @returns 境界ボックス情報
 */
export const calculatePartBounds = (
  points: { x: number; y: number }[]
): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
} => {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);

  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top
  };
};

/**
 * 顔検出の結果を検証する
 * @param detection - 検出結果
 * @returns 検証結果のメッセージ
 */
export const validateDetection = (
  detection: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>
): string | null => {
  const confidence = detection.detection.score;
  
  if (confidence < 0.5) {
    return '顔の検出信頼度が低いです。より鮮明な画像を使用してください。';
  }
  
  if (confidence < 0.7) {
    return '顔の検出信頼度がやや低いです。結果が不正確になる可能性があります。';
  }
  
  return null; // 問題なし
};

/**
 * モデルが読み込まれているかチェックする
 */
export const isModelsLoaded = (): boolean => {
  return modelsLoaded;
}; 