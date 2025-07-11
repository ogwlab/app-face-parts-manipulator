import React from 'react';
import {
  Box,
  Typography,
  Slider,
  TextField,
  Card,
  CardContent,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import type { EyeDistanceNormalizationParams } from '../../features/face-standardization/eyeDistanceNormalizer';

interface StandardizationControlsProps {
  params: EyeDistanceNormalizationParams;
  onParamsChange: (params: EyeDistanceNormalizationParams) => void;
  disabled?: boolean;
}

const StandardizationControls: React.FC<StandardizationControlsProps> = ({
  params,
  onParamsChange,
  disabled = false
}) => {
  const handleEyeDistanceChange = (value: number) => {
    onParamsChange({
      ...params,
      targetEyeDistanceRatio: value / 100 // 0-100 to 0.0-1.0
    });
  };

  const handleBaselineYChange = (value: number) => {
    onParamsChange({
      ...params,
      baselineYPosition: value / 100 // 0-100 to 0.0-1.0
    });
  };

  const handleBaselineXChange = (value: number) => {
    onParamsChange({
      ...params,
      baselineXPosition: value / 100 // 0-100 to 0.0-1.0
    });
  };

  const handleRotationChange = (value: number) => {
    onParamsChange({
      ...params,
      rotationAngle: (value * Math.PI) / 180 // 度からラジアンに変換
    });
  };

  const handleRotationEnabledChange = (enabled: boolean) => {
    onParamsChange({
      ...params,
      enableRotation: enabled
    });
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          📏 顔標準化パラメータ
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          眼間距離を基準として顔の位置・サイズ・傾きを統一します
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* 目標眼間距離 */}
          <Box>
            <Typography variant="body2" gutterBottom>
              目標眼間距離: {Math.round(params.targetEyeDistanceRatio * 100)}%
            </Typography>
            <Slider
              value={params.targetEyeDistanceRatio * 100}
              onChange={(_, value) => handleEyeDistanceChange(value as number)}
              min={10}
              max={40}
              step={1}
              disabled={disabled}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}%`}
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                type="number"
                value={Math.round(params.targetEyeDistanceRatio * 100)}
                onChange={(e) => handleEyeDistanceChange(Number(e.target.value))}
                inputProps={{ min: 10, max: 40, step: 1 }}
                disabled={disabled}
                sx={{ width: 80 }}
              />
              <Typography variant="caption" color="text.secondary">
                % (画像横幅に対する比率)
              </Typography>
            </Box>
          </Box>

          <Box>
            <Divider />
          </Box>

          {/* 基準線中点Y位置 */}
          <Box>
            <Typography variant="body2" gutterBottom>
              基準線中点Y位置: {Math.round(params.baselineYPosition * 100)}%
            </Typography>
            <Slider
              value={params.baselineYPosition * 100}
              onChange={(_, value) => handleBaselineYChange(value as number)}
              min={20}
              max={80}
              step={1}
              disabled={disabled}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}%`}
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                type="number"
                value={Math.round(params.baselineYPosition * 100)}
                onChange={(e) => handleBaselineYChange(Number(e.target.value))}
                inputProps={{ min: 20, max: 80, step: 1 }}
                disabled={disabled}
                sx={{ width: 80 }}
              />
              <Typography variant="caption" color="text.secondary">
                % (画像高さに対する比率)
              </Typography>
            </Box>
          </Box>

          {/* 基準線中点X位置 */}
          <Box>
            <Typography variant="body2" gutterBottom>
              基準線中点X位置: {Math.round(params.baselineXPosition * 100)}%
            </Typography>
            <Slider
              value={params.baselineXPosition * 100}
              onChange={(_, value) => handleBaselineXChange(value as number)}
              min={20}
              max={80}
              step={1}
              disabled={disabled}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}%`}
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                type="number"
                value={Math.round(params.baselineXPosition * 100)}
                onChange={(e) => handleBaselineXChange(Number(e.target.value))}
                inputProps={{ min: 20, max: 80, step: 1 }}
                disabled={disabled}
                sx={{ width: 80 }}
              />
              <Typography variant="caption" color="text.secondary">
                % (画像幅に対する比率)
              </Typography>
            </Box>
          </Box>

          <Box>
            <Divider />
          </Box>

          {/* 回転機能の有効/無効 */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={params.enableRotation ?? true}
                  onChange={(e) => handleRotationEnabledChange(e.target.checked)}
                  disabled={disabled}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">
                    🔄 回転補正を有効にする
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    両眼の傾きを自動で水平に補正します
                  </Typography>
                </Box>
              }
            />
          </Box>

          {/* 回転角度（回転機能が有効な場合のみ表示） */}
          {params.enableRotation && (
            <Box>
              <Typography variant="body2" gutterBottom>
                目標回転角度: {Math.round(((params.rotationAngle || 0) * 180) / Math.PI)}°
              </Typography>
              <Slider
                value={((params.rotationAngle || 0) * 180) / Math.PI}
                onChange={(_, value) => handleRotationChange(value as number)}
                min={-30}
                max={30}
                step={1}
                disabled={disabled}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}°`}
                sx={{ mb: 1 }}
              />
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small"
                  type="number"
                  value={Math.round(((params.rotationAngle || 0) * 180) / Math.PI)}
                  onChange={(e) => handleRotationChange(Number(e.target.value))}
                  inputProps={{ min: -30, max: 30, step: 1 }}
                  disabled={disabled}
                  sx={{ width: 80 }}
                />
                <Typography variant="caption" color="text.secondary">
                  度 (0°=水平、正=時計回り)
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            💡 ヒント: 眼間距離（％）でサイズ、基準線中点位置（Y・X）で配置、回転角度で傾きを調整できます。回転補正をONにすると顔を自動で水平に補正します。
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default StandardizationControls;