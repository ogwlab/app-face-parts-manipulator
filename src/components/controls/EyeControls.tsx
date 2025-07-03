import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import { useFaceStore } from '../../stores/faceStore';
import ParameterControl from '../common/ParameterControl';
import { PARAM_LIMITS } from '../../types/face';

const EyeControls: React.FC = () => {
  const { 
    faceParams, 
    updateLeftEye, 
    updateRightEye, 
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