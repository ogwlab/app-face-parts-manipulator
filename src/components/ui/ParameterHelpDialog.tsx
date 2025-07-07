import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
} from '@mui/material';

interface ParameterHelpDialogProps {
  open: boolean;
  onClose: () => void;
}

const ParameterHelpDialog: React.FC<ParameterHelpDialogProps> = ({
  open,
  onClose,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        ❓ パラメータの説明
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* サイズパラメータの説明 */}
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              📏 サイズ（大きさ・幅・高さ）
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              各顔パーツの元のサイズを基準とした線形倍率をパーセンテージで表示しています。
            </Typography>
            <Box sx={{ pl: 2 }}>
              <Typography variant="body2">• <strong>100%</strong> = パーツの元の大きさ</Typography>
              <Typography variant="body2">• <strong>150%</strong> = 縦横と1.5倍に拡大（面積は2.25倍）</Typography>
              <Typography variant="body2">• <strong>50%</strong> = 縦横とも半分に縮小（面積は0.25倍）</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
                ※ 線形比：パラメータ値の平方が面積比になります
              </Typography>
            </Box>
          </Box>

          <Divider />

          {/* 位置パラメータの説明 */}
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              📍 位置（X位置・Y位置）
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              各パーツの元の位置からの移動量を顔全体のサイズに対する比率で表示しています。
            </Typography>
            <Box sx={{ pl: 2 }}>
              <Typography variant="body2">• <strong>X位置</strong>: 顔領域の横幅に対する比率（プラスで右、マイナスで左）</Typography>
              <Typography variant="body2">• <strong>Y位置</strong>: 顔領域の縦幅に対する比率（プラスで下、マイナスで上）</Typography>
              <Typography variant="body2">• <strong>10%</strong> = 顔幅の10%移動、<strong>-5%</strong> = 顔高の5%上方向移動</Typography>
              <Typography variant="body2">• <strong>0%</strong> = パーツの元の位置</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
                ※ 顔領域：顔の輪郭と眉毛で囲まれた範囲
              </Typography>
            </Box>
          </Box>

          <Divider />

          {/* 操作方法の説明 */}
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              🎛️ 操作方法
            </Typography>
            <Box sx={{ pl: 2 }}>
              <Typography variant="body2">• <strong>スライダー</strong>: ドラッグして調整</Typography>
              <Typography variant="body2">• <strong>数値入力</strong>: 直接値を入力</Typography>
              <Typography variant="body2">• <strong>🔄ボタン</strong>: その項目を初期値にリセット</Typography>
              <Typography variant="body2">• <strong>リセットボタン</strong>: パーツ全体を初期値にリセット</Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ParameterHelpDialog;