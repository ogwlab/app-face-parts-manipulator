/**
 * エラー通知システムコンポーネント
 * 
 * リアルタイムでエラーを表示し、ユーザーに適切なフィードバックを提供
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Box,
  IconButton,
  Collapse,
  Typography,
  Button,
  Chip,
  Stack,
  Badge,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Tooltip,
  LinearProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  NotificationsActive as NotificationsIcon,
  Clear as ClearIcon,
  History as HistoryIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Refresh as RetryIcon
} from '@mui/icons-material';

import { useErrorHandling } from '../../hooks/useErrorHandling';
import { AppError, ErrorSeverity, ErrorType } from '../../utils/errorHandling';

interface ErrorNotification {
  id: string;
  error: AppError;
  timestamp: number;
  dismissed: boolean;
  expanded: boolean;
  retryAvailable: boolean;
}

interface ErrorNotificationSystemProps {
  maxNotifications?: number;
  autoHideDuration?: number;
  enableRetry?: boolean;
  enableHistory?: boolean;
  position?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
}

export const ErrorNotificationSystem: React.FC<ErrorNotificationSystemProps> = ({
  maxNotifications = 5,
  autoHideDuration = 6000,
  enableRetry = true,
  enableHistory = true,
  position = { vertical: 'top', horizontal: 'right' }
}) => {
  const {
    currentError,
    errorHistory,
    clearError,
    executeWithRetry,
    getLatestErrors,
    hasError
  } = useErrorHandling();

  const [notifications, setNotifications] = useState<ErrorNotification[]>([]);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [retryingErrors, setRetryingErrors] = useState<Set<string>>(new Set());

  /**
   * 新しいエラー通知を追加
   */
  const addNotification = useCallback((error: AppError) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const notification: ErrorNotification = {
      id,
      error,
      timestamp: Date.now(),
      dismissed: false,
      expanded: false,
      retryAvailable: enableRetry && error.recoverable
    };

    setNotifications(prev => {
      const newNotifications = [notification, ...prev.slice(0, maxNotifications - 1)];
      return newNotifications;
    });

    // 自動非表示
    if (autoHideDuration > 0 && error.severity !== ErrorSeverity.CRITICAL) {
      setTimeout(() => {
        dismissNotification(id);
      }, autoHideDuration);
    }
  }, [maxNotifications, autoHideDuration, enableRetry]);

  /**
   * 通知を非表示にする
   */
  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, dismissed: true }
          : notification
      )
    );

    // アニメーション後に削除
    setTimeout(() => {
      setNotifications(prev => prev.filter(notification => notification.id !== id));
    }, 300);
  }, []);

  /**
   * 通知の詳細を展開/折りたたみ
   */
  const toggleNotificationExpanded = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, expanded: !notification.expanded }
          : notification
      )
    );
  }, []);

  /**
   * エラーのリトライを実行
   */
  const retryError = useCallback(async (notificationId: string, error: AppError) => {
    if (retryingErrors.has(notificationId)) return;

    setRetryingErrors(prev => new Set(prev).add(notificationId));

    try {
      // 基本的なリトライロジック（実際の処理は文脈に依存）
      console.log(`エラーのリトライを実行中: ${error.type}`);
      
      // ここで実際のリトライ処理を実装
      // 例: 画像の再読み込み、ネットワークリクエストの再実行など
      await new Promise(resolve => setTimeout(resolve, 2000)); // シミュレーション
      
      // 成功時は通知を削除
      dismissNotification(notificationId);
      
      // 成功通知を表示
      addNotification({
        type: ErrorType.UNKNOWN,
        severity: ErrorSeverity.LOW,
        message: 'リトライが成功しました',
        userMessage: '問題が解決されました',
        timestamp: new Date(),
        recoverable: false
      });
      
    } catch (retryError) {
      console.error('リトライに失敗しました:', retryError);
      
      // 失敗通知を追加
      addNotification({
        type: ErrorType.UNKNOWN,
        severity: ErrorSeverity.MEDIUM,
        message: 'リトライに失敗しました',
        userMessage: 'リトライに失敗しました。しばらく待ってから再度お試しください。',
        timestamp: new Date(),
        recoverable: true
      });
    } finally {
      setRetryingErrors(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  }, [retryingErrors, dismissNotification, addNotification]);

  /**
   * 全ての通知をクリア
   */
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // 現在のエラーを監視
  useEffect(() => {
    if (currentError) {
      addNotification(currentError);
      clearError(); // 通知に追加後、グローバルエラーをクリア
    }
  }, [currentError, addNotification, clearError]);

  /**
   * エラー重要度に応じたアイコンを取得
   */
  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return <ErrorIcon color="error" />;
      case ErrorSeverity.HIGH:
        return <WarningIcon color="warning" />;
      case ErrorSeverity.MEDIUM:
        return <InfoIcon color="info" />;
      case ErrorSeverity.LOW:
        return <SuccessIcon color="success" />;
    }
  };

  /**
   * エラー重要度に応じた色を取得
   */
  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'error';
      case ErrorSeverity.HIGH:
        return 'warning';
      case ErrorSeverity.MEDIUM:
        return 'info';
      case ErrorSeverity.LOW:
        return 'success';
    }
  };

  const visibleNotifications = notifications.filter(n => !n.dismissed);
  const latestErrors = getLatestErrors(10);

  return (
    <>
      {/* 通知表示 */}
      <Box
        sx={{
          position: 'fixed',
          [position.vertical]: 20,
          [position.horizontal]: 20,
          zIndex: 1400,
          maxWidth: 400,
          width: '100%'
        }}
      >
        <Stack spacing={1}>
          {visibleNotifications.map((notification) => (
            <Collapse
              key={notification.id}
              in={!notification.dismissed}
              timeout={300}
            >
              <Alert
                severity={getSeverityColor(notification.error.severity) as any}
                action={
                  <Box display="flex" alignItems="center" gap={1}>
                    {notification.retryAvailable && enableRetry && (
                      <Tooltip title="再試行">
                        <IconButton
                          size="small"
                          color="inherit"
                          onClick={() => retryError(notification.id, notification.error)}
                          disabled={retryingErrors.has(notification.id)}
                        >
                          {retryingErrors.has(notification.id) ? (
                            <Box sx={{ width: 20, height: 20 }}>
                              <LinearProgress 
                                size={20} 
                                sx={{ 
                                  width: '100%', 
                                  height: '100%',
                                  borderRadius: '50%'
                                }} 
                              />
                            </Box>
                          ) : (
                            <RetryIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    <Tooltip title={notification.expanded ? "詳細を隠す" : "詳細を表示"}>
                      <IconButton
                        size="small"
                        color="inherit"
                        onClick={() => toggleNotificationExpanded(notification.id)}
                      >
                        {notification.expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="閉じる">
                      <IconButton
                        size="small"
                        color="inherit"
                        onClick={() => dismissNotification(notification.id)}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
                sx={{
                  width: '100%',
                  alignItems: 'flex-start'
                }}
              >
                <AlertTitle>
                  <Box display="flex" alignItems="center" gap={1}>
                    {notification.error.userMessage || notification.error.message}
                    <Chip
                      label={notification.error.type}
                      size="small"
                      variant="outlined"
                      color={getSeverityColor(notification.error.severity) as any}
                    />
                  </Box>
                </AlertTitle>
                
                <Collapse in={notification.expanded} timeout={200}>
                  <Box mt={1}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      エラー詳細:
                    </Typography>
                    <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                      {notification.error.message}
                    </Typography>
                    
                    {notification.error.context && (
                      <Typography variant="body2" color="textSecondary" mt={1}>
                        コンテキスト: {notification.error.context}
                      </Typography>
                    )}
                    
                    <Typography variant="caption" color="textSecondary" display="block" mt={1}>
                      発生時刻: {new Date(notification.error.timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                </Collapse>
              </Alert>
            </Collapse>
          ))}
        </Stack>
      </Box>

      {/* エラー履歴ボタン */}
      {enableHistory && latestErrors.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 1300
          }}
        >
          <Tooltip title="エラー履歴を表示">
            <IconButton
              color="primary"
              onClick={() => setHistoryDrawerOpen(true)}
              sx={{
                backgroundColor: 'background.paper',
                boxShadow: 2,
                '&:hover': {
                  backgroundColor: 'background.paper',
                  boxShadow: 4
                }
              }}
            >
              <Badge badgeContent={latestErrors.length} color="error" max={99}>
                <HistoryIcon />
              </Badge>
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* エラー履歴ドロワー */}
      <Drawer
        anchor="right"
        open={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        PaperProps={{
          sx: { width: 400 }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6">
              エラー履歴
            </Typography>
            <Box>
              <Tooltip title="全てクリア">
                <IconButton onClick={clearAllNotifications} size="small">
                  <ClearIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="閉じる">
                <IconButton onClick={() => setHistoryDrawerOpen(false)} size="small">
                  <CloseIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <List>
            {latestErrors.map((error, index) => (
              <React.Fragment key={`${error.timestamp}-${index}`}>
                <ListItem alignItems="flex-start">
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {getSeverityIcon(error.severity)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          {error.userMessage || error.message}
                        </Typography>
                        <Stack direction="row" spacing={1} mt={1}>
                          <Chip
                            label={error.type}
                            size="small"
                            variant="outlined"
                            color={getSeverityColor(error.severity) as any}
                          />
                          <Chip
                            label={error.severity}
                            size="small"
                            color={getSeverityColor(error.severity) as any}
                          />
                        </Stack>
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="textSecondary">
                        {new Date(error.timestamp).toLocaleString()}
                      </Typography>
                    }
                  />
                </ListItem>
                {index < latestErrors.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>

          {latestErrors.length === 0 && (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              py={4}
            >
              <SuccessIcon color="success" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="body2" color="textSecondary">
                エラーはありません
              </Typography>
            </Box>
          )}
        </Box>
      </Drawer>
    </>
  );
};

export default ErrorNotificationSystem;