import { create } from 'zustand';
import type { 
  FaceParams, 
  ImageData, 
  FaceDetectionResult,
  FaceLandmarks
} from '../types/face';
import { 
  defaultFaceParams 
} from '../types/face';

interface ExportSettings {
  format: 'png' | 'jpg';
  jpgQuality: number;
  fileName?: string;
}

interface FaceStore {
  // 画像データ
  originalImage: ImageData | null;
  originalFileName: string | null;
  processedImageUrl: string | null;
  
  // 標準化関連データ
  isStandardized: boolean;
  standardizedImageUrl: string | null;
  standardizedLandmarks: FaceLandmarks | null;
  
  // 顔検出結果
  faceDetection: FaceDetectionResult | null;
  
  // 顔パラメータ
  faceParams: FaceParams;
  
  // 処理状態
  isLoading: boolean;
  isProcessing: boolean;
  error: string | null;
  
  // エクスポート設定
  exportSettings: ExportSettings;
  
  // レンダリング設定
  renderMode: 'forward' | 'backward' | 'hybrid';
  
  // 派生状態（現在のベースデータ）
  currentBaseImageUrl: string | null;
  currentBaseLandmarks: FaceLandmarks | null;
  
  // アクション
  setOriginalImage: (image: ImageData | null, fileName?: string) => void;
  setOriginalFileName: (fileName: string | null) => void;
  setProcessedImageUrl: (url: string | null) => void;
  setFaceDetection: (result: FaceDetectionResult | null) => void;
  updateFaceParams: (params: Partial<FaceParams>) => void;
  updateLeftEye: (params: Partial<FaceParams['leftEye']>) => void;
  updateRightEye: (params: Partial<FaceParams['rightEye']>) => void;
  updateMouth: (params: Partial<FaceParams['mouth']>) => void;
  updateNose: (params: Partial<FaceParams['nose']>) => void;
  resetLeftEye: () => void;
  resetRightEye: () => void;
  resetMouth: () => void;
  resetNose: () => void;
  resetAllParams: () => void;
  setLoading: (loading: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  setExportSettings: (settings: ExportSettings) => void;
  setRenderMode: (mode: 'forward' | 'backward' | 'hybrid') => void;
  
  // 標準化関連アクション
  setStandardizationResult: (imageUrl: string, landmarks: FaceLandmarks) => void;
  clearStandardization: () => void;
  
  clearAll: () => void;
  
  // 内部ヘルパー
  _updateDerivedState: () => void;
}

export const useFaceStore = create<FaceStore>((set, get) => ({
  // 初期状態
  originalImage: null,
  originalFileName: null,
  processedImageUrl: null,
  
  // 標準化関連初期状態
  isStandardized: false,
  standardizedImageUrl: null,
  standardizedLandmarks: null,
  
  faceDetection: null,
  faceParams: { ...defaultFaceParams },
  isLoading: false,
  isProcessing: false,
  error: null,
  exportSettings: {
    format: 'png',
    jpgQuality: 0.9,
  },
  renderMode: 'hybrid',
  
  // 派生状態（初期値）
  currentBaseImageUrl: null,
  currentBaseLandmarks: null,

  // 内部ヘルパー - 派生状態を更新
  _updateDerivedState: () => {
    const state = get();
    const currentBaseImageUrl = state.isStandardized && state.standardizedImageUrl 
      ? state.standardizedImageUrl 
      : state.originalImage?.url || null;
    
    const currentBaseLandmarks = state.isStandardized && state.standardizedLandmarks
      ? state.standardizedLandmarks
      : state.faceDetection?.landmarks || null;

    set({
      currentBaseImageUrl,
      currentBaseLandmarks
    });
  },

  // アクション
  setOriginalImage: (image, fileName) => {
    set({ 
      originalImage: image,
      originalFileName: fileName || (image?.file.name) || null
    });
    get()._updateDerivedState();
  },
  
  setOriginalFileName: (fileName) => set({ originalFileName: fileName }),
  
  setProcessedImageUrl: (url) => set({ processedImageUrl: url }),
  
  setFaceDetection: (result) => {
    set({ faceDetection: result });
    get()._updateDerivedState();
  },
  
  updateFaceParams: (params) => set((state) => ({
    faceParams: { ...state.faceParams, ...params }
  })),
  
  updateLeftEye: (params) => set((state) => ({
    faceParams: {
      ...state.faceParams,
      leftEye: { ...state.faceParams.leftEye, ...params }
    }
  })),
  
  updateRightEye: (params) => set((state) => ({
    faceParams: {
      ...state.faceParams,
      rightEye: { ...state.faceParams.rightEye, ...params }
    }
  })),
  
  updateMouth: (params) => set((state) => ({
    faceParams: {
      ...state.faceParams,
      mouth: { ...state.faceParams.mouth, ...params }
    }
  })),
  
  updateNose: (params) => set((state) => ({
    faceParams: {
      ...state.faceParams,
      nose: { ...state.faceParams.nose, ...params }
    }
  })),
  
  resetLeftEye: () => set((state) => ({
    faceParams: {
      ...state.faceParams,
      leftEye: { ...defaultFaceParams.leftEye }
    }
  })),
  
  resetRightEye: () => set((state) => ({
    faceParams: {
      ...state.faceParams,
      rightEye: { ...defaultFaceParams.rightEye }
    }
  })),
  
  resetMouth: () => set((state) => ({
    faceParams: {
      ...state.faceParams,
      mouth: { ...defaultFaceParams.mouth }
    }
  })),
  
  resetNose: () => set((state) => ({
    faceParams: {
      ...state.faceParams,
      nose: { ...defaultFaceParams.nose }
    }
  })),
  
  resetAllParams: () => set({ faceParams: { ...defaultFaceParams } }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setProcessing: (processing) => set({ isProcessing: processing }),
  
  setError: (error) => set({ error }),
  
  setExportSettings: (settings) => set({ exportSettings: settings }),
  
  setRenderMode: (mode) => set({ renderMode: mode }),
  
  // 標準化関連アクション
  setStandardizationResult: (imageUrl, landmarks) => {
    set({
      isStandardized: true,
      standardizedImageUrl: imageUrl,
      standardizedLandmarks: landmarks,
    });
    get()._updateDerivedState();
  },
  
  clearStandardization: () => {
    set({
      isStandardized: false,
      standardizedImageUrl: null,
      standardizedLandmarks: null,
    });
    get()._updateDerivedState();
  },
  
  clearAll: () => {
    set({
      originalImage: null,
      originalFileName: null,
      processedImageUrl: null,
      
      // 標準化データもクリア
      isStandardized: false,
      standardizedImageUrl: null,
      standardizedLandmarks: null,
      
      faceDetection: null,
      faceParams: { ...defaultFaceParams },
      isLoading: false,
      isProcessing: false,
      error: null,
      exportSettings: {
        format: 'png',
        jpgQuality: 0.9,
      },
      
      // 派生状態もクリア
      currentBaseImageUrl: null,
      currentBaseLandmarks: null,
    });
  },
})); 