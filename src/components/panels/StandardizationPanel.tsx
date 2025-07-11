import React, { useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Button,
} from '@mui/material';
import { useFaceStore } from '../../stores/faceStore';
import { useStandardizationStore } from '../../stores/standardizationStore';
import StandardizationControls from '../ui/StandardizationControls';
import { standardizeFaceImage } from '../../features/face-standardization/canvasStandardizer';

const StandardizationPanel: React.FC = () => {
  const { 
    faceDetection, 
    originalImage,
    setStandardizationResult,
    clearStandardization: clearFaceStoreStandardization
  } = useFaceStore();
  const {
    params,
    result,
    isStandardizing,
    standardizationEnabled,
    error,
    updateParams,
    setResult,
    setStandardizedImageUrl,
    setIsStandardizing,
    setStandardizationEnabled,
    setError,
    clearStandardization
  } = useStandardizationStore();
  
  // 簡略化されたデバッグログ
  if (process.env.NODE_ENV === 'development') {
    console.log('📋 標準化パネル:', { 
      enabled: standardizationEnabled, 
      ready: !!(faceDetection && originalImage),
      processing: isStandardizing 
    });
  }

  // 標準化処理の実行
  const executeStandardization = useCallback(async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 標準化処理開始:', params);
    }
    
    if (!faceDetection || !originalImage) {
      setError('顔検出結果または画像がありません');
      return;
    }

    setIsStandardizing(true);
    setError(null);

    try {
      // HTMLImageElementを作成
      const img = new Image();
      img.src = originalImage.url;
      
      await new Promise((resolve, reject) => {
        img.onload = () => resolve(undefined);
        img.onerror = reject;
      });

      // face-api.jsのランドマークを取得
      const landmarks = faceDetection.landmarks as any;
      
      // 特徴点ベース標準化実行
      const standardizationResult = await standardizeFaceImage(
        img,
        landmarks,
        params
      );
      
      // 結果をURLに変換して保存
      const url = standardizationResult.canvas.toDataURL('image/png');
      setResult(standardizationResult);
      setStandardizedImageUrl(url);
      
      // 🚀 新機能: faceStoreに標準化結果を自動保存
      setStandardizationResult(url, standardizationResult.transformedLandmarks);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ 標準化完了 & faceStore連携:', {
          size: `${standardizationResult.canvas.width}x${standardizationResult.canvas.height}`,
          transform: standardizationResult.appliedTransform,
          landmarksCount: Object.keys(standardizationResult.transformedLandmarks).length
        });
      }

    } catch (err) {
      console.error('❌ 標準化処理エラー:', err);
      setError(err instanceof Error ? err.message : '標準化処理に失敗しました');
    } finally {
      setIsStandardizing(false);
    }
  }, [faceDetection, originalImage, params, setResult, setStandardizedImageUrl, setIsStandardizing, setError]);

  // パラメータ変更時の自動実行
  useEffect(() => {
    if (standardizationEnabled && faceDetection && originalImage) {
      const timeoutId = setTimeout(() => {
        executeStandardization();
      }, 500); // 500ms の遅延でデバウンス

      return () => clearTimeout(timeoutId);
    }
  }, [params, standardizationEnabled, executeStandardization, faceDetection, originalImage]);

  // 標準化有効/無効の切り替え
  const handleStandardizationToggle = (enabled: boolean) => {
    setStandardizationEnabled(enabled);
    if (!enabled) {
      // 両方のストアの標準化データをクリア
      clearStandardization();
      clearFaceStoreStandardization();
    } else if (faceDetection && originalImage) {
      executeStandardization();
    }
  };

  const canStandardize = faceDetection && originalImage;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      <Typography variant="h6" gutterBottom>
        顔画像標準化
      </Typography>
      
      {!canStandardize && (
        <Alert severity="info" sx={{ mb: 2 }}>
          標準化機能を使用するには、画像をアップロードして顔検出を実行してください。
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 標準化機能ON/OFF */}
        <Card>
          <CardContent>
            <FormControlLabel
              control={
                <Switch
                  checked={standardizationEnabled}
                  onChange={(e) => handleStandardizationToggle(e.target.checked)}
                  disabled={!canStandardize || isStandardizing}
                />
              }
              label={
                <Box>
                  <Typography variant="subtitle1">
                    📏 顔標準化を有効にする
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    眼間距離を基準として顔画像のサイズと傾きを統一します
                  </Typography>
                </Box>
              }
            />
            
            {isStandardizing && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="caption">
                  標準化処理中...
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* 手動実行ボタン */}
        {standardizationEnabled && canStandardize && (
          <Card>
            <CardContent>
              <Button
                variant="outlined"
                onClick={executeStandardization}
                disabled={isStandardizing}
              >
                🔄 手動で標準化実行
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* 標準化パラメータ */}
        {standardizationEnabled && (
          <StandardizationControls
            params={params}
            onParamsChange={updateParams}
            disabled={!canStandardize || isStandardizing}
          />
        )}

        {/* 標準化結果情報 */}
        {result && (
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                ✅ 標準化完了
              </Typography>
              <Typography variant="body2" color="text.secondary">
                スケール: {(result.appliedTransform.scale * 100).toFixed(1)}%<br />
                回転: {(result.appliedTransform.rotation * 180 / Math.PI).toFixed(1)}°<br />
                移動: ({result.appliedTransform.translation.x.toFixed(1)}, {result.appliedTransform.translation.y.toFixed(1)})px
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* 背景除去セクション */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              🖼️ 背景除去
            </Typography>
            <Typography variant="body2" color="text.secondary">
              画像の背景を自動で除去し、顔部分のみを抽出します
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.disabled">
                実装予定: Phase 3で背景除去機能を追加
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default StandardizationPanel;