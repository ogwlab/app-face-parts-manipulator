import * as faceapi from 'face-api.js';

// モデルの読み込み状態を管理
let modelsLoaded = false;

/**
 * face-api.jsのモデルを読み込む
 */
export const loadModels = async (): Promise<void> => {
  if (modelsLoaded) return;

  try {
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
 * 画像の妥当性チェック
 */
const validateImage = (imageElement: HTMLImageElement): void => {
  if (!imageElement) {
    throw new Error('画像要素が指定されていません');
  }
  
  if (!imageElement.complete) {
    throw new Error('画像の読み込みが完了していません');
  }
  
  if (imageElement.naturalWidth === 0 || imageElement.naturalHeight === 0) {
    throw new Error('画像が破損しているか、読み込めません');
  }
  
  // 画像サイズの制限チェック
  const maxSize = 8000;
  if (imageElement.naturalWidth > maxSize || imageElement.naturalHeight > maxSize) {
    throw new Error(`画像サイズが大きすぎます（最大${maxSize}x${maxSize}px）`);
  }
  
  // 最小サイズの制限チェック
  const minSize = 100;
  if (imageElement.naturalWidth < minSize || imageElement.naturalHeight < minSize) {
    throw new Error(`画像サイズが小さすぎます（最小${minSize}x${minSize}px）`);
  }
};

/**
 * 顔検出パラメータの動的調整
 */
const getOptimalDetectionOptions = (imageElement: HTMLImageElement): faceapi.TinyFaceDetectorOptions => {
  const imageSize = Math.max(imageElement.naturalWidth, imageElement.naturalHeight);
  
  // 画像サイズに応じて検出パラメータを調整
  let inputSize = 416;
  let scoreThreshold = 0.5;
  
  if (imageSize > 2000) {
    // 高解像度画像の場合
    inputSize = 608;
    scoreThreshold = 0.6;
  } else if (imageSize < 500) {
    // 低解像度画像の場合
    inputSize = 320;
    scoreThreshold = 0.4;
  }
  
  return new faceapi.TinyFaceDetectorOptions({
    inputSize,
    scoreThreshold
  });
};

/**
 * 顔検出結果の品質チェック
 */
const validateFaceDetectionQuality = (
  detection: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>
): void => {
  const confidence = detection.detection.score;
  const landmarks = detection.landmarks;
  
  // 信頼度の詳細チェック
  if (confidence < 0.3) {
    throw new Error('顔の検出信頼度が非常に低いです。より鮮明な画像を使用してください。');
  }
  
  // ランドマークの妥当性チェック
  if (landmarks.positions.length !== 68) {
    throw new Error('顔の特徴点検出に失敗しました。');
  }
  
  // 顔の向きや角度の極端さをチェック
  const faceBox = detection.detection.box;
  const aspectRatio = faceBox.width / faceBox.height;
  
  if (aspectRatio < 0.5 || aspectRatio > 2.0) {
    console.warn('⚠️ 顔の向きが極端です。結果が不正確になる可能性があります。');
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
  try {
    // 画像の妥当性チェック
    validateImage(imageElement);

    // モデルが読み込まれていない場合は読み込む
    if (!modelsLoaded) {
      await loadModels();
    }

    // 最適な検出パラメータを取得
    const detectionOptions = getOptimalDetectionOptions(imageElement);

    // 顔検出実行
    const detections = await faceapi
      .detectAllFaces(imageElement, detectionOptions)
      .withFaceLandmarks();

    // 検出結果の検証
    if (detections.length === 0) {
      // 低い閾値で再試行
      const fallbackOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: detectionOptions.inputSize,
        scoreThreshold: Math.max(0.3, detectionOptions.scoreThreshold - 0.2)
      });
      
      const fallbackDetections = await faceapi
        .detectAllFaces(imageElement, fallbackOptions)
        .withFaceLandmarks();
      
      if (fallbackDetections.length === 0) {
        throw new Error('顔が検出されませんでした。別の画像を試してください。');
      }
      
      console.warn('⚠️ 低い閾値で顔を検出しました。結果が不正確になる可能性があります。');
      return fallbackDetections[0];
    }

    if (detections.length > 1) {
      console.warn('⚠️ 複数の顔が検出されました。最初の顔を使用します。');
    }

    // 最初の顔の品質チェック
    const primaryDetection = detections[0];
    validateFaceDetectionQuality(primaryDetection);

    return primaryDetection;
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

/**
 * 顔検出システムの状態をリセットする
 */
export const resetFaceDetectionSystem = (): void => {
  modelsLoaded = false;
};