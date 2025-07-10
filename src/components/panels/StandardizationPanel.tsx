import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
} from '@mui/material';

const StandardizationPanel: React.FC = () => {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      <Typography variant="h6" gutterBottom>
        顔画像標準化
      </Typography>
      
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 顔標準化セクション */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              📏 顔の位置・サイズ・傾きの標準化
            </Typography>
            <Typography variant="body2" color="text.secondary">
              眼間距離を基準として顔画像のサイズと傾きを統一します
            </Typography>
            <Box sx={{ mt: 2 }}>
              {/* TODO: 標準化パラメータのコントロールを追加 */}
              <Typography variant="caption" color="text.disabled">
                実装予定: 基準線の位置調整、眼間距離設定
              </Typography>
            </Box>
          </CardContent>
        </Card>

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
              {/* TODO: 背景除去のコントロールを追加 */}
              <Typography variant="caption" color="text.disabled">
                実装予定: 背景除去ON/OFF、除去品質設定
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default StandardizationPanel;