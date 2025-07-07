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

const MouthControls: React.FC = () => {
  const { 
    faceParams, 
    updateMouth, 
    resetMouth 
  } = useFaceStore();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: 1 }}>
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            👄 口
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <ParameterControl
              label="幅"
              value={faceParams.mouth.width}
              onChange={(value: number) => updateMouth({ width: value })}
              min={PARAM_LIMITS.mouth.width.min}
              max={PARAM_LIMITS.mouth.width.max}
              step={PARAM_LIMITS.mouth.width.step}
              unit=""
              onReset={() => updateMouth({ width: 1.0 })}
              parameterType="size"
            />
            
            <ParameterControl
              label="高さ"
              value={faceParams.mouth.height}
              onChange={(value: number) => updateMouth({ height: value })}
              min={PARAM_LIMITS.mouth.height.min}
              max={PARAM_LIMITS.mouth.height.max}
              step={PARAM_LIMITS.mouth.height.step}
              unit=""
              onReset={() => updateMouth({ height: 1.0 })}
              parameterType="size"
            />
            
            <ParameterControl
              label="X位置"
              value={faceParams.mouth.positionX}
              onChange={(value: number) => updateMouth({ positionX: value })}
              min={PARAM_LIMITS.mouth.positionX.min}
              max={PARAM_LIMITS.mouth.positionX.max}
              step={PARAM_LIMITS.mouth.positionX.step}
              unit="%"
              onReset={() => updateMouth({ positionX: 0 })}
              parameterType="position"
            />
            
            <ParameterControl
              label="Y位置"
              value={faceParams.mouth.positionY}
              onChange={(value: number) => updateMouth({ positionY: value })}
              min={PARAM_LIMITS.mouth.positionY.min}
              max={PARAM_LIMITS.mouth.positionY.max}
              step={PARAM_LIMITS.mouth.positionY.step}
              unit="%"
              onReset={() => updateMouth({ positionY: 0 })}
              parameterType="position"
            />
          </Box>
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="outlined"
              onClick={resetMouth}
              sx={{ minWidth: 120 }}
            >
              口をリセット
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default MouthControls; 