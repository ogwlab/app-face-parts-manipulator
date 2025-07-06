import { create } from 'zustand';
import type { 
  FaceParams, 
  ImageData, 
  FaceDetectionResult 
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
  processedImageUrl: string | null;
  
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
  
  // アクション
  setOriginalImage: (image: ImageData | null) => void;
  setProcessedImageUrl: (url: string | null) => void;
  setFaceDetection: (result: FaceDetectionResult | null) => void;
  updateFaceParams: (params: Partial<FaceParams>) => void;
  updateLeftEye: (params: Partial<FaceParams['leftEye']>) => void;
  updateRightEye: (params: Partial<FaceParams['rightEye']>) => void;
  updateLeftEyeIrisOffset: (offsetX: number, offsetY: number) => void;
  updateRightEyeIrisOffset: (offsetX: number, offsetY: number) => void;
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
  clearAll: () => void;
}

export const useFaceStore = create<FaceStore>((set) => ({
  // 初期状態
  originalImage: null,
  processedImageUrl: null,
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

  // アクション
  setOriginalImage: (image) => set({ originalImage: image }),
  
  setProcessedImageUrl: (url) => set({ processedImageUrl: url }),
  
  setFaceDetection: (result) => set({ faceDetection: result }),
  
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
  
  updateLeftEyeIrisOffset: (offsetX: number, offsetY: number) => set((state) => ({
    faceParams: {
      ...state.faceParams,
      leftEye: { 
        ...state.faceParams.leftEye, 
        irisOffsetX: offsetX,
        irisOffsetY: offsetY
      }
    }
  })),
  
  updateRightEyeIrisOffset: (offsetX: number, offsetY: number) => set((state) => ({
    faceParams: {
      ...state.faceParams,
      rightEye: { 
        ...state.faceParams.rightEye, 
        irisOffsetX: offsetX,
        irisOffsetY: offsetY
      }
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
  
  clearAll: () => set({
    originalImage: null,
    processedImageUrl: null,
    faceDetection: null,
    faceParams: { ...defaultFaceParams },
    isLoading: false,
    isProcessing: false,
    error: null,
    exportSettings: {
      format: 'png',
      jpgQuality: 0.9,
    },
  }),
})); 