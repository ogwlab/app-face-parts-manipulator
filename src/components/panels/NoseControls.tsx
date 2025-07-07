import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
} from '@mui/material';
import { useFaceStore } from '../../stores/faceStore';
import ParameterControl from '../ui/ParameterControl';
import { PARAM_LIMITS } from '../../types/face';

const NoseControls: React.FC = () => {
  const { 
    faceParams, 
    updateNose, 
    resetNose 
  } = useFaceStore();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: 1 }}>
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            👃 鼻
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <ParameterControl
              label="幅"
              value={faceParams.nose.width}
              onChange={(value: number) => updateNose({ width: value })}
              min={PARAM_LIMITS.nose.width.min}
              max={PARAM_LIMITS.nose.width.max}
              step={PARAM_LIMITS.nose.width.step}
              unit=""
              onReset={() => updateNose({ width: 1.0 })}
              parameterType="size"
            />
            
            <ParameterControl
              label="高さ"
              value={faceParams.nose.height}
              onChange={(value: number) => updateNose({ height: value })}
              min={PARAM_LIMITS.nose.height.min}
              max={PARAM_LIMITS.nose.height.max}
              step={PARAM_LIMITS.nose.height.step}
              unit=""
              onReset={() => updateNose({ height: 1.0 })}
              parameterType="size"
            />
            
            <ParameterControl
              label="X位置"
              value={faceParams.nose.positionX}
              onChange={(value: number) => updateNose({ positionX: value })}
              min={PARAM_LIMITS.nose.positionX.min}
              max={PARAM_LIMITS.nose.positionX.max}
              step={PARAM_LIMITS.nose.positionX.step}
              unit="%"
              onReset={() => updateNose({ positionX: 0 })}
              parameterType="position"
            />
            
            <ParameterControl
              label="Y位置"
              value={faceParams.nose.positionY}
              onChange={(value: number) => updateNose({ positionY: value })}
              min={PARAM_LIMITS.nose.positionY.min}
              max={PARAM_LIMITS.nose.positionY.max}
              step={PARAM_LIMITS.nose.positionY.step}
              unit="%"
              onReset={() => updateNose({ positionY: 0 })}
              parameterType="position"
            />
          </Box>
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="outlined"
              onClick={resetNose}
              sx={{ minWidth: 120 }}
            >
              鼻をリセット
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default NoseControls; 