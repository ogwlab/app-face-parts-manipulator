import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import { useFaceStore } from '../../stores/faceStore';
import ParameterControl from '../ui/ParameterControl';
import { PARAM_LIMITS } from '../../types/face';

const EyeControls: React.FC = () => {
  const { 
    faceParams, 
    updateLeftEye, 
    updateRightEye, 
    updateLeftEyeIrisOffset,
    updateRightEyeIrisOffset,
    resetLeftEye, 
    resetRightEye 
  } = useFaceStore();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 左目制御 */}
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            👁️ 左目
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <ParameterControl
              label="大きさ"
              value={faceParams.leftEye.size}
              onChange={(value: number) => updateLeftEye({ size: value })}
              min={PARAM_LIMITS.eye.size.min}
              max={PARAM_LIMITS.eye.size.max}
              step={PARAM_LIMITS.eye.size.step}
              unit=""
              onReset={() => updateLeftEye({ size: 1.0 })}
            />
            
            <ParameterControl
              label="X位置"
              value={faceParams.leftEye.positionX}
              onChange={(value: number) => updateLeftEye({ positionX: value })}
              min={PARAM_LIMITS.eye.positionX.min}
              max={PARAM_LIMITS.eye.positionX.max}
              step={PARAM_LIMITS.eye.positionX.step}
              unit="px"
              onReset={() => updateLeftEye({ positionX: 0 })}
            />
            
            <ParameterControl
              label="Y位置"
              value={faceParams.leftEye.positionY}
              onChange={(value: number) => updateLeftEye({ positionY: value })}
              min={PARAM_LIMITS.eye.positionY.min}
              max={PARAM_LIMITS.eye.positionY.max}
              step={PARAM_LIMITS.eye.positionY.step}
              unit="px"
              onReset={() => updateLeftEye({ positionY: 0 })}
            />
            
            {/* 視線方向制御 */}
            <Box sx={{ mt: 2, mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                🎯 視線方向
              </Typography>
            </Box>
            
            <ParameterControl
              label="虹彩X方向"
              value={faceParams.leftEye.irisOffsetX}
              onChange={(value: number) => updateLeftEyeIrisOffset(value, faceParams.leftEye.irisOffsetY)}
              min={PARAM_LIMITS.eye.irisOffsetX.min}
              max={PARAM_LIMITS.eye.irisOffsetX.max}
              step={PARAM_LIMITS.eye.irisOffsetX.step}
              unit=""
              onReset={() => updateLeftEyeIrisOffset(0, faceParams.leftEye.irisOffsetY)}
            />
            
            <ParameterControl
              label="虹彩Y方向"
              value={faceParams.leftEye.irisOffsetY}
              onChange={(value: number) => updateLeftEyeIrisOffset(faceParams.leftEye.irisOffsetX, value)}
              min={PARAM_LIMITS.eye.irisOffsetY.min}
              max={PARAM_LIMITS.eye.irisOffsetY.max}
              step={PARAM_LIMITS.eye.irisOffsetY.step}
              unit=""
              onReset={() => updateLeftEyeIrisOffset(faceParams.leftEye.irisOffsetX, 0)}
            />
          </Box>
          
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <ParameterControl
              label=""
              value={0}
              onChange={() => {}}
              min={0}
              max={1}
              step={0.1}
              unit=""
              onReset={resetLeftEye}
              resetOnly
              resetLabel="左目リセット"
            />
          </Box>
        </CardContent>
      </Card>

      <Divider />

      {/* 右目制御 */}
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            👁️ 右目
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <ParameterControl
              label="大きさ"
              value={faceParams.rightEye.size}
              onChange={(value: number) => updateRightEye({ size: value })}
              min={PARAM_LIMITS.eye.size.min}
              max={PARAM_LIMITS.eye.size.max}
              step={PARAM_LIMITS.eye.size.step}
              unit=""
              onReset={() => updateRightEye({ size: 1.0 })}
            />
            
            <ParameterControl
              label="X位置"
              value={faceParams.rightEye.positionX}
              onChange={(value: number) => updateRightEye({ positionX: value })}
              min={PARAM_LIMITS.eye.positionX.min}
              max={PARAM_LIMITS.eye.positionX.max}
              step={PARAM_LIMITS.eye.positionX.step}
              unit="px"
              onReset={() => updateRightEye({ positionX: 0 })}
            />
            
            <ParameterControl
              label="Y位置"
              value={faceParams.rightEye.positionY}
              onChange={(value: number) => updateRightEye({ positionY: value })}
              min={PARAM_LIMITS.eye.positionY.min}
              max={PARAM_LIMITS.eye.positionY.max}
              step={PARAM_LIMITS.eye.positionY.step}
              unit="px"
              onReset={() => updateRightEye({ positionY: 0 })}
            />
            
            {/* 視線方向制御 */}
            <Box sx={{ mt: 2, mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                🎯 視線方向
              </Typography>
            </Box>
            
            <ParameterControl
              label="虹彩X方向"
              value={faceParams.rightEye.irisOffsetX}
              onChange={(value: number) => updateRightEyeIrisOffset(value, faceParams.rightEye.irisOffsetY)}
              min={PARAM_LIMITS.eye.irisOffsetX.min}
              max={PARAM_LIMITS.eye.irisOffsetX.max}
              step={PARAM_LIMITS.eye.irisOffsetX.step}
              unit=""
              onReset={() => updateRightEyeIrisOffset(0, faceParams.rightEye.irisOffsetY)}
            />
            
            <ParameterControl
              label="虹彩Y方向"
              value={faceParams.rightEye.irisOffsetY}
              onChange={(value: number) => updateRightEyeIrisOffset(faceParams.rightEye.irisOffsetX, value)}
              min={PARAM_LIMITS.eye.irisOffsetY.min}
              max={PARAM_LIMITS.eye.irisOffsetY.max}
              step={PARAM_LIMITS.eye.irisOffsetY.step}
              unit=""
              onReset={() => updateRightEyeIrisOffset(faceParams.rightEye.irisOffsetX, 0)}
            />
          </Box>
          
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <ParameterControl
              label=""
              value={0}
              onChange={() => {}}
              min={0}
              max={1}
              step={0.1}
              unit=""
              onReset={resetRightEye}
              resetOnly
              resetLabel="右目リセット"
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default EyeControls; 