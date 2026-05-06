import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Divider,
  ToggleButton,
  Button,
} from '@mui/material';
import { useFaceStore } from '../../stores/faceStore';
import { useStandardizationStore } from '../../stores/standardizationStore';
import { useImageWarping } from '../../hooks/useImageWarping';
import { useFaceDetection } from '../../hooks/useFaceDetection';
import SaveButton from './SaveButton';
import { UnifiedQualitySelector, type UnifiedQualityMode } from './UnifiedQualitySelector';
import type { FaceLandmarks } from '../../types/face';
import { logger } from '../../utils/logger';
import { validateImageFile } from '../../utils/imageValidation';

const ImagePreview: React.FC = memo(() => {
  const { 
    originalImage, 
    processedImageUrl,
    isProcessing, 
    setRenderMode,
    setOriginalImage,
    setError,
    setLoading,
    // 🚀 統合ベースデータを使用
    currentBaseImageUrl,
    currentBaseLandmarks,
    isStandardized,
    // 🎯 自動設定適用機能
    autoApplyStoredSettings
  } = useFaceStore();
  
  const { 
    standardizedImageUrl
  } = useStandardizationStore();
  
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState<{width: number, height: number} | null>(null);
  const [warpingQuality, setWarpingQuality] = useState<'fast' | 'medium' | 'high'>('medium');
  const [showLandmarks, setShowLandmarks] = useState<boolean>(false);
  const [qualityMode, setQualityMode] = useState<UnifiedQualityMode>('balanced');
  
  const { initializeCanvas } = useImageWarping(warpingQuality);
  const { detectFace, initializeModels, isLoadingModels } = useFaceDetection();

  // 統合品質設定の変更ハンドラー
  const handleQualityModeChange = (mode: UnifiedQualityMode) => {
    setQualityMode(mode);
  };

  const handleWarpingQualityChange = (quality: 'fast' | 'medium' | 'high') => {
    setWarpingQuality(quality);
  };

  const handleRenderModeChange = (mode: 'forward' | 'hybrid' | 'backward') => {
    setRenderMode(mode);
  };

  // 新しい画像を開くハンドラー
  const handleOpenNewImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/jpg';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        setLoading(true);
        setError(null);

        const imageData = await validateImageFile(file);

        setOriginalImage(imageData, file.name);

        // 顔検出を実行
        const img = new Image();
        img.onload = async () => {
          try {
            await initializeModels();
            await detectFace(img);
            
            // 🎯 顔検出成功後に保存された設定を自動適用
            setTimeout(() => {
              autoApplyStoredSettings();
            }, 500); // 顔検出完了を待ってから適用
          } catch (faceError) {
            const errorMessage = faceError instanceof Error ? faceError.message : '顔検出でエラーが発生しました。';
            setError(errorMessage);
          }
        };
        img.src = imageData.url;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '画像の処理中にエラーが発生しました。';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    input.click();
  };

  // originalImageが変更された時にimageLoadedをリセット
  useEffect(() => {
    logger.debug('🖼️ originalImage changed:', originalImage ? 'あり' : 'なし');
    setImageLoaded(false);
  }, [originalImage]);

  // Fabric.js Canvas の初期化（canvasSizeが確定してから）
  useEffect(() => {
    console.log('🎨 Fabric.js Canvas 初期化チェック:', {
      hasFabricCanvas: !!fabricCanvasRef.current,
      hasOriginalImage: !!originalImage,
      hasCanvasSize: !!canvasSize,
      canvasSize
    });

    if (fabricCanvasRef.current && originalImage && canvasSize) {
      console.log('✅ Fabric.js Canvas 初期化実行 - サイズ:', canvasSize);
      initializeCanvas(fabricCanvasRef.current, canvasSize.width, canvasSize.height);
    } else {
      console.log('❌ Fabric.js Canvas 初期化スキップ - 条件不足');
    }
  }, [originalImage, canvasSize, initializeCanvas]);

  // Canvas サイズ計算の共通関数（シンプル版）
  const calculateCanvasSize = useCallback((container: HTMLElement | null, imageWidth: number, imageHeight: number, canvasType: string) => {
    if (!container) {
      console.warn(`⚠️ ${canvasType}: Container not found, using default size`);
      return { width: 400, height: 400, scale: 1 };
    }
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    console.log(`📐 ${canvasType} - Container size:`, { containerWidth, containerHeight });
    
    // パディングを考慮（左右合計20px）
    const availableWidth = containerWidth - 20;
    const availableHeight = containerHeight - 20;
    
    // アスペクト比を保持しながらスケールを計算
    const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
    
    const width = Math.floor(imageWidth * scale);
    const height = Math.floor(imageHeight * scale);
    
    const result = { width, height, scale };
    
    console.log(`📐 ${canvasType} - Size calculation:`, {
      image: { width: imageWidth, height: imageHeight },
      available: { width: availableWidth, height: availableHeight },
      result
    });
    
    return result;
  }, []);

  // 🚀 統合ベース画像を Canvas に描画
  useEffect(() => {
    if (!currentBaseImageUrl || !originalCanvasRef.current) {
      console.log('⚠️ ベース画像またはCanvasが利用できません');
      return;
    }

    const canvas = originalCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('❌ Canvas context を取得できません');
      return;
    }

    console.log('🎨 統合ベース画像描画開始:', { 
      url: currentBaseImageUrl,
      isStandardized 
    });
    const img = new Image();
    
    img.onload = () => {
      console.log('✅ 画像読み込み成功:', img.width, 'x', img.height);
      
      // Canvas サイズを計算
      const container = canvas.parentElement;
      const { width, height, scale } = calculateCanvasSize(container, img.width, img.height, '元画像Canvas');
      
      // Canvas サイズを設定
      canvas.width = width;
      canvas.height = height;
      
      // Canvasサイズを保存（編集後Canvasと同期するため）
      setCanvasSize({ width, height });
      
      console.log(`🎨 元画像Canvas設定: ${width}x${height}, scale: ${scale}`);
      
      // 画像を描画
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      console.log('✅ Canvas に画像を描画しました');
      
      // 顔検出結果がある場合、特徴点を描画（表示フラグがオンの時のみ）
      if (currentBaseLandmarks && showLandmarks) {
        console.log('🎯 統合ベースランドマークを描画:', { isStandardized });
        drawLandmarks(ctx, currentBaseLandmarks, scale);
      }
      
      setImageLoaded(true);
    };
    
    img.onerror = (error) => {
      console.error('❌ 画像読み込みエラー:', error);
      setImageLoaded(false);
    };
    
    img.src = currentBaseImageUrl;
  }, [currentBaseImageUrl, currentBaseLandmarks, showLandmarks, calculateCanvasSize, isStandardized]);

  // 重複処理を削除 - useImageWarpingフックでワーピング処理を一本化
  // このuseEffectは削除され、すべてのワーピング処理はuseImageWarpingフックで管理されます
  
  // コメントアウトした重複処理:
  // - パラメータ変更時のワーピング処理
  // - デバウンス処理
  // - 品質別のワーピング処理
  // これらはすべてuseImageWarping.tsで実行されるため、ここでは不要です

  // 編集後画像の表示（ワーピング結果または元画像）
  useEffect(() => {
    if (fabricCanvasRef.current && canvasSize) {
      const canvas = fabricCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // ワーピング結果、標準化結果、元画像の順で表示（最新処理結果を優先）
      const imageUrl = processedImageUrl || standardizedImageUrl || (originalImage?.url);
      
      if (imageUrl) {
        const displayType = processedImageUrl ? '(ワーピング済み)' : standardizedImageUrl ? '(標準化済み)' : '(元画像)';
        console.log(`🔄 編集後Canvas表示: ${canvasSize.width}x${canvasSize.height}`, displayType);
        
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
          ctx.drawImage(img, 0, 0, canvasSize.width, canvasSize.height);
          console.log('✅ 編集後Canvasに画像を描画');
        };
        img.onerror = (error) => {
          console.error('❌ 編集後画像の読み込みエラー:', error);
          // エラー時は元画像にフォールバック
          if (originalImage && imageUrl !== originalImage.url) {
            img.src = originalImage.url;
          }
        };
        img.src = imageUrl;
      }
    }
  }, [canvasSize, originalImage, processedImageUrl, standardizedImageUrl]);

  // 特徴点を描画する関数
  const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    landmarks: FaceLandmarks,
    scale: number
  ) => {
    if (!landmarks) return;

    // 目の特徴点を描画
    const drawPoints = (points: Array<{x: number, y: number}>, color: string) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;

      points.forEach((point, index) => {
        const x = point.x * scale;
        const y = point.y * scale;
        
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
        
        // 番号を表示（デバッグ用）
        ctx.fillText(`${index}`, x + 3, y - 3);
      });
    };

    // 各パーツを異なる色で描画
    if (landmarks.leftEye) drawPoints(landmarks.leftEye, '#FF0000');      // 赤
    if (landmarks.rightEye) drawPoints(landmarks.rightEye, '#00FF00');    // 緑
    if (landmarks.mouth) drawPoints(landmarks.mouth, '#0000FF');          // 青
    if (landmarks.nose) drawPoints(landmarks.nose, '#FF00FF');            // マゼンタ
    if (landmarks.jawline) drawPoints(landmarks.jawline, '#FFFF00');      // 黄
    if (landmarks.leftEyebrow) drawPoints(landmarks.leftEyebrow, '#FF8800'); // オレンジ
    if (landmarks.rightEyebrow) drawPoints(landmarks.rightEyebrow, '#8800FF'); // 紫
  };

  if (!originalImage) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 300,
        }}
      >
        <Typography variant="body1" color="text.secondary">
          画像をアップロードしてください
        </Typography>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        gap: 2, 
        height: '100%',
        flexDirection: { xs: 'column', md: 'row' },
        position: 'relative'
      }}
    >
        {/* 元画像 */}
        <Paper elevation={2} sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ flexShrink: 0 }}>
                {isStandardized ? 'ベース画像' : '元画像'}
              </Typography>
              {isStandardized && (
                <Typography 
                  variant="caption" 
                  sx={{ 
                    bgcolor: 'primary.main', 
                    color: 'white', 
                    px: 1, 
                    py: 0.25, 
                    borderRadius: 1,
                    fontSize: '0.65rem'
                  }}
                >
                  標準化済み
                </Typography>
              )}
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleOpenNewImage}
                sx={{ 
                  py: 0.5, 
                  px: 1, 
                  fontSize: '0.75rem',
                  minWidth: 'auto',
                }}
              >
                📁 新しい画像
              </Button>
              
              <ToggleButton
                value="landmarks"
                selected={showLandmarks}
                onChange={() => setShowLandmarks(!showLandmarks)}
                size="small"
                sx={{ 
                  py: 0.5, 
                  px: 1, 
                  fontSize: '0.75rem',
                  minWidth: 'auto',
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  },
                }}
              >
                👁️ 特徴点
              </ToggleButton>
            </Box>
          </Box>
          
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
              <canvas
                ref={originalCanvasRef}
                style={{
                  border: '1px solid #ddd',
                  display: imageLoaded ? 'block' : 'none',
                }}
              />
              {!imageLoaded && (
                <CircularProgress sx={{ position: 'absolute' }} />
              )}
          </Box>
        </Paper>

        {/* 区切り線 */}
        <Divider 
          orientation="vertical" 
          flexItem 
          sx={{ display: { xs: 'none', md: 'block' } }}
        />
        <Divider 
          orientation="horizontal" 
          flexItem 
          sx={{ display: { xs: 'block', md: 'none' } }}
        />

        {/* 編集後画像 */}
        <Paper elevation={2} sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" sx={{ flexShrink: 0 }}>
              編集後
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {/* 統合品質設定 */}
              <UnifiedQualitySelector
                value={qualityMode}
                onChange={handleQualityModeChange}
                onWarpingQualityChange={handleWarpingQualityChange}
                onRenderModeChange={handleRenderModeChange}
              />
              
              {/* 保存ボタン */}
              {processedImageUrl && (
                <SaveButton canvasRef={fabricCanvasRef} />
              )}
            </Box>
          </Box>
          
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
              <canvas
                ref={fabricCanvasRef}
                style={{
                  border: '1px solid #ddd',
                  display: originalImage && !isProcessing ? 'block' : 'none',
                }}
              />
              {isProcessing && (
                <Box sx={{ textAlign: 'center', position: 'absolute' }}>
                  <CircularProgress sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    処理中...
                  </Typography>
                  {isLoadingModels && (
                    <Typography variant="caption" color="primary.main" sx={{ mt: 1, display: 'block' }}>
                      初回は顔検出モデルの読み込みに時間がかかります
                    </Typography>
                  )}
                </Box>
              )}
              {!originalImage && !isProcessing && (
                <Typography variant="body2" color="text.secondary">
                  パラメータを調整してください
                </Typography>
              )}
          </Box>
        </Paper>

    </Box>
  );
});

ImagePreview.displayName = 'ImagePreview';

export default ImagePreview;
