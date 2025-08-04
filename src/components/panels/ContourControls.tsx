import React from 'react';
import { Box, Typography, Button, Card, CardContent, FormControlLabel, Checkbox } from '@mui/material';
import ParameterControl from '../ui/ParameterControl';
import { useFaceStore } from '../../stores/faceStore';
import { PARAM_LIMITS, defaultContourParams } from '../../types/face';

const ContourControls: React.FC = () => {
  const { faceParams, updateContourParams } = useFaceStore();
  const params = faceParams.contour;

  const handleChange = (field: keyof typeof params) => (value: number | boolean) => {
    updateContourParams({ [field]: value });
  };

  const handleReset = () => {
    updateContourParams(defaultContourParams);
  };

  const hasChanges = JSON.stringify(params) !== JSON.stringify(defaultContourParams);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: 1 }}>
      <Card elevation={2}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              🔷 輪郭操作
            </Typography>
            <Button
              size="small"
              onClick={handleReset}
              disabled={!hasChanges}
              sx={{ minWidth: 'auto' }}
            >
              リセット
            </Button>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <ParameterControl
                label="顔の形状"
                value={params.faceShape}
                onChange={handleChange('faceShape')}
                min={PARAM_LIMITS.contour.faceShape.min}
                max={PARAM_LIMITS.contour.faceShape.max}
                step={PARAM_LIMITS.contour.faceShape.step}
                unit=""
                onReset={() => handleChange('faceShape')(defaultContourParams.faceShape)}
                parameterType="size"
              />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                負の値: 四角い顔 / 正の値: 丸い顔
              </Typography>
            </Box>

            <ParameterControl
              label="顎の幅"
              value={params.jawWidth}
              onChange={handleChange('jawWidth')}
              min={PARAM_LIMITS.contour.jawWidth.min}
              max={PARAM_LIMITS.contour.jawWidth.max}
              step={PARAM_LIMITS.contour.jawWidth.step}
              unit=""
              onReset={() => handleChange('jawWidth')(defaultContourParams.jawWidth)}
              parameterType="size"
            />

            <ParameterControl
              label="頬の膨らみ"
              value={params.cheekFullness}
              onChange={handleChange('cheekFullness')}
              min={PARAM_LIMITS.contour.cheekFullness.min}
              max={PARAM_LIMITS.contour.cheekFullness.max}
              step={PARAM_LIMITS.contour.cheekFullness.step}
              unit=""
              onReset={() => handleChange('cheekFullness')(defaultContourParams.cheekFullness)}
              parameterType="size"
            />

            <ParameterControl
              label="顎の長さ"
              value={params.chinHeight}
              onChange={handleChange('chinHeight')}
              min={PARAM_LIMITS.contour.chinHeight.min}
              max={PARAM_LIMITS.contour.chinHeight.max}
              step={PARAM_LIMITS.contour.chinHeight.step}
              unit=""
              onReset={() => handleChange('chinHeight')(defaultContourParams.chinHeight)}
              parameterType="size"
              disabled={params.fixMenton}
            />

            <ParameterControl
              label="滑らかさ"
              value={params.smoothness}
              onChange={handleChange('smoothness')}
              min={PARAM_LIMITS.contour.smoothness.min}
              max={PARAM_LIMITS.contour.smoothness.max}
              step={PARAM_LIMITS.contour.smoothness.step}
              unit=""
              onReset={() => handleChange('smoothness')(defaultContourParams.smoothness)}
              parameterType="size"
            />
            
            <Box sx={{ mt: 2, mb: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={params.fixMenton || false}
                    onChange={(e) => handleChange('fixMenton')(e.target.checked)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">
                    顎先を固定
                    {params.fixMenton && (
                      <Typography variant="caption" color="text.secondary" component="span" sx={{ ml: 1 }}>
                        （顎の長さ調整は無効）
                      </Typography>
                    )}
                  </Typography>
                }
              />
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ContourControls;