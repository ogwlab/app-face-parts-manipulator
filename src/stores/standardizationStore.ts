import { create } from 'zustand';
import type { 
  EyeDistanceNormalizationParams 
} from '../features/face-standardization/eyeDistanceNormalizer';
import { 
  DEFAULT_NORMALIZATION_PARAMS 
} from '../features/face-standardization/eyeDistanceNormalizer';
import type { 
  StandardizationResult 
} from '../features/face-standardization/canvasStandardizer';

interface StandardizationStore {
  // 標準化パラメータ（新しい特徴点ベース形式）
  params: EyeDistanceNormalizationParams;
  
  // 標準化結果
  result: StandardizationResult | null;
  standardizedImageUrl: string | null;
  
  // 処理状態
  isStandardizing: boolean;
  standardizationEnabled: boolean;
  
  // エラー
  error: string | null;
  
  // アクション
  updateParams: (params: Partial<EyeDistanceNormalizationParams>) => void;
  setParams: (params: EyeDistanceNormalizationParams) => void;
  resetParams: () => void;
  
  setResult: (result: StandardizationResult | null) => void;
  setStandardizedImageUrl: (url: string | null) => void;
  
  setIsStandardizing: (loading: boolean) => void;
  setStandardizationEnabled: (enabled: boolean) => void;
  
  setError: (error: string | null) => void;
  
  // クリーンアップ
  clearStandardization: () => void;
}

export const useStandardizationStore = create<StandardizationStore>((set, get) => ({
  // 初期状態
  params: DEFAULT_NORMALIZATION_PARAMS,
  result: null,
  standardizedImageUrl: null,
  isStandardizing: false,
  standardizationEnabled: false,
  error: null,
  
  // パラメータ更新
  updateParams: (newParams) => {
    set((state) => ({
      params: { ...state.params, ...newParams },
      error: null
    }));
  },
  
  setParams: (params) => {
    set({
      params,
      error: null
    });
  },
  
  resetParams: () => {
    set({
      params: DEFAULT_NORMALIZATION_PARAMS,
      error: null
    });
  },
  
  // 結果設定
  setResult: (result) => {
    set({ result });
  },
  
  setStandardizedImageUrl: (url) => {
    // 古いURLをクリーンアップ
    const currentUrl = get().standardizedImageUrl;
    if (currentUrl && currentUrl !== url) {
      URL.revokeObjectURL(currentUrl);
    }
    
    set({ standardizedImageUrl: url });
  },
  
  // 状態設定
  setIsStandardizing: (isStandardizing) => {
    set({ isStandardizing });
  },
  
  setStandardizationEnabled: (standardizationEnabled) => {
    set({ standardizationEnabled });
  },
  
  setError: (error) => {
    set({ error });
  },
  
  // クリーンアップ
  clearStandardization: () => {
    const { standardizedImageUrl } = get();
    
    // URLをクリーンアップ
    if (standardizedImageUrl) {
      URL.revokeObjectURL(standardizedImageUrl);
    }
    
    set({
      result: null,
      standardizedImageUrl: null,
      isStandardizing: false,
      error: null
    });
  }
}));