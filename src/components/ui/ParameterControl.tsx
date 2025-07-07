import React from 'react';
import {
  Box,
  Typography,
  Slider,
  TextField,
  IconButton,
  Button,
} from '@mui/material';

interface ParameterControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  onReset: () => void;
  resetOnly?: boolean;
  resetLabel?: string;
  parameterType?: 'size' | 'position';
}

const ParameterControl: React.FC<ParameterControlProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  onReset,
  resetOnly = false,
  resetLabel = "🔄",
  parameterType = 'position',
}) => {
  const handleSliderChange = (_event: Event, newValue: number | number[]) => {
    if (typeof newValue === 'number') {
      onChange(newValue);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = parseFloat(event.target.value);
    if (isNaN(inputValue)) return;
    
    let actualValue: number;
    let minCheck: number;
    let maxCheck: number;
    
    if (parameterType === 'size') {
      // %表示から倍率に変換 (100% → 1.0)
      actualValue = inputValue / 100;
      minCheck = getDisplayValue(min);
      maxCheck = getDisplayValue(max);
    } else {
      actualValue = inputValue;
      minCheck = min;
      maxCheck = max;
    }
    
    if (inputValue >= minCheck && inputValue <= maxCheck) {
      onChange(actualValue);
    }
  };

  // 表示用の値とラベルを計算
  const getDisplayValue = (val: number) => {
    if (parameterType === 'size') {
      return Math.round(val * 100); // 1.0 → 100%
    }
    if (parameterType === 'position') {
      return val; // 位置は既に%値
    }
    return val;
  };

  const getDisplayUnit = () => {
    if (parameterType === 'size' || parameterType === 'position') {
      return '%';
    }
    return unit;
  };

  const displayValue = getDisplayValue(value);
  const displayUnit = getDisplayUnit();

  // リセット専用の場合
  if (resetOnly) {
    return (
      <Button
        variant="outlined"
        size="small"
        onClick={onReset}
        sx={{ alignSelf: 'flex-start' }}
      >
        {resetLabel}
      </Button>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" fontWeight="medium">
          {label}
        </Typography>
        <IconButton
          size="small"
          onClick={onReset}
          sx={{ 
            fontSize: '0.8rem', 
            minWidth: 'auto',
            width: 24,
            height: 24,
          }}
        >
          🔄
        </IconButton>
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* スライダー */}
        <Box sx={{ flex: 1 }}>
          <Slider
            value={value}
            onChange={handleSliderChange}
            min={min}
            max={max}
            step={step}
            size="small"
            valueLabelDisplay="auto"
            valueLabelFormat={(val) => `${getDisplayValue(val)}${getDisplayUnit()}`}
          />
        </Box>
        
        {/* 数値入力 */}
        <TextField
          size="small"
          type="number"
          value={parameterType === 'size' ? displayValue.toString() : value.toFixed(2)}
          onChange={handleInputChange}
          inputProps={{
            min: parameterType === 'size' ? getDisplayValue(min) : min,
            max: parameterType === 'size' ? getDisplayValue(max) : max,
            step: parameterType === 'size' ? 1 : step,
            style: { textAlign: 'right' }
          }}
          sx={{ 
            width: 80,
            '& input': { 
              fontSize: '0.875rem',
              padding: '4px 8px'
            }
          }}
        />
        
        {/* 単位 */}
        {displayUnit && (
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 20 }}>
            {displayUnit}
          </Typography>
        )}
      </Box>
      
      {/* 値の範囲表示 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {getDisplayValue(min)}{getDisplayUnit()}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {getDisplayValue(max)}{getDisplayUnit()}
        </Typography>
      </Box>
    </Box>
  );
};

export default ParameterControl; 