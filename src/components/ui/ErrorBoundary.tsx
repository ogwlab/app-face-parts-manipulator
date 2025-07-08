/**
 * 統合エラーバウンダリーコンポーネント
 * 
 * React エラーバウンダリーと包括的エラーハンドリングシステムを組み合わせた
 * 高度なエラー処理・回復機能を提供
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  AlertTitle,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  LinearProgress
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  BugReport as BugReportIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
  RestoreFrom as RestoreIcon
} from '@mui/icons-material';

import { useErrorHandling } from '../../hooks/useErrorHandling';
import { globalStateManager } from '../../utils/stateManagement';
import { AppError, ErrorSeverity, ErrorType } from '../../utils/errorHandling';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  retryCount: number;
  lastErrorTime: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  maxRetries?: number;
  retryDelay?: number;
  enableRecovery?: boolean;
  enableReporting?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * クラスコンポーネントとしてのエラーバウンダリー
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
      lastErrorTime: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
      lastErrorTime: Date.now()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // カスタムエラーハンドラー呼び出し
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // エラーハンドリングシステムに報告
    this.reportError(error, errorInfo);
  }

  /**
   * エラーをシステムに報告
   */
  private async reportError(error: Error, errorInfo: ErrorInfo): Promise<void> {
    try {
      const errorManager = (await import('../../utils/errorHandling')).default.getInstance();
      await errorManager.reportError(error, `error-boundary-${this.state.errorId}`);
    } catch (reportingError) {
      console.error('エラー報告に失敗しました:', reportingError);
    }
  }

  /**
   * エラーから回復を試行
   */
  private handleRetry = (): void => {
    const { maxRetries = 3, retryDelay = 1000 } = this.props;
    
    if (this.state.retryCount >= maxRetries) {
      console.warn(`最大リトライ回数 (${maxRetries}) に達しました`);
      return;
    }

    this.setState(prevState => ({
      retryCount: prevState.retryCount + 1
    }));

    // 遅延後に回復を試行
    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null
      });
    }, retryDelay * (this.state.retryCount + 1)); // 段階的遅延
  };

  /**
   * 状態復旧を実行
   */
  private handleStateRecovery = async (): Promise<void> => {
    try {
      const restoredState = await globalStateManager.recoverState();
      console.log('状態が復旧されました:', restoredState);
      
      // 回復後にエラー状態をリセット
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: 0
      });
    } catch (recoveryError) {
      console.error('状態復旧に失敗しました:', recoveryError);
    }
  };

  /**
   * エラーレポートをダウンロード
   */
  private handleDownloadReport = (): void => {
    const report = {
      timestamp: new Date().toISOString(),
      errorId: this.state.errorId,
      error: {
        name: this.state.error?.name,
        message: this.state.error?.message,
        stack: this.state.error?.stack
      },
      errorInfo: this.state.errorInfo,
      userAgent: navigator.userAgent,
      url: window.location.href,
      retryCount: this.state.retryCount
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${this.state.errorId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * ページ全体をリロード
   */
  private handlePageReload = (): void => {
    window.location.reload();
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      const { fallback, maxRetries = 3, enableRecovery = true, enableReporting = true } = this.props;
      
      // カスタムフォールバックが提供されている場合
      if (fallback) {
        return fallback;
      }

      const severity = this.determineSeverity(this.state.error);
      const canRetry = this.state.retryCount < maxRetries;

      return (
        <ErrorBoundaryDisplay
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          retryCount={this.state.retryCount}
          maxRetries={maxRetries}
          severity={severity}
          canRetry={canRetry}
          enableRecovery={enableRecovery}
          enableReporting={enableReporting}
          onRetry={this.handleRetry}
          onStateRecovery={this.handleStateRecovery}
          onDownloadReport={this.handleDownloadReport}
          onPageReload={this.handlePageReload}
        />
      );
    }

    return this.props.children;
  }

  /**
   * エラーの重要度を判定
   */
  private determineSeverity(error: Error | null): ErrorSeverity {
    if (!error) return ErrorSeverity.LOW;

    const message = error.message.toLowerCase();
    
    if (message.includes('memory') || message.includes('メモリ')) {
      return ErrorSeverity.CRITICAL;
    }
    if (message.includes('network') || message.includes('ネットワーク')) {
      return ErrorSeverity.HIGH;
    }
    if (message.includes('validation') || message.includes('検証')) {
      return ErrorSeverity.MEDIUM;
    }
    
    return ErrorSeverity.MEDIUM;
  }
}

/**
 * エラー表示コンポーネント
 */
interface ErrorBoundaryDisplayProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  retryCount: number;
  maxRetries: number;
  severity: ErrorSeverity;
  canRetry: boolean;
  enableRecovery: boolean;
  enableReporting: boolean;
  onRetry: () => void;
  onStateRecovery: () => void;
  onDownloadReport: () => void;
  onPageReload: () => void;
}

const ErrorBoundaryDisplay: React.FC<ErrorBoundaryDisplayProps> = ({
  error,
  errorInfo,
  errorId,
  retryCount,
  maxRetries,
  severity,
  canRetry,
  enableRecovery,
  enableReporting,
  onRetry,
  onStateRecovery,
  onDownloadReport,
  onPageReload
}) => {
  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return <ErrorIcon color="error" />;
      case ErrorSeverity.HIGH:
        return <WarningIcon color="warning" />;
      case ErrorSeverity.MEDIUM:
        return <InfoIcon color="info" />;
      default:
        return <BugReportIcon color="action" />;
    }
  };

  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'error';
      case ErrorSeverity.HIGH:
        return 'warning';
      case ErrorSeverity.MEDIUM:
        return 'info';
      default:
        return 'default';
    }
  };

  const getSeverityLabel = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return '緊急';
      case ErrorSeverity.HIGH:
        return '重要';
      case ErrorSeverity.MEDIUM:
        return '中程度';
      default:
        return '軽微';
    }
  };

  const getUserMessage = (error: Error | null): string => {
    if (!error) return '不明なエラーが発生しました';

    const message = error.message.toLowerCase();
    
    if (message.includes('memory') || message.includes('メモリ')) {
      return 'メモリ不足が発生しました。他のアプリケーションを終了してから再試行してください。';
    }
    if (message.includes('network') || message.includes('ネットワーク')) {
      return 'ネットワークエラーが発生しました。接続を確認してから再試行してください。';
    }
    if (message.includes('permission') || message.includes('権限')) {
      return 'アクセス権限の問題が発生しました。ブラウザの設定を確認してください。';
    }
    
    return 'アプリケーションでエラーが発生しました。しばらく待ってから再試行してください。';
  };

  return (
    <Box
      sx={{
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3
      }}
    >
      <Paper
        elevation={4}
        sx={{
          p: 4,
          maxWidth: 800,
          width: '100%'
        }}
      >
        <Stack spacing={3}>
          {/* ヘッダー */}
          <Box display="flex" alignItems="center" gap={2}>
            {getSeverityIcon(severity)}
            <Typography variant="h5" component="h1">
              エラーが発生しました
            </Typography>
            <Chip
              label={getSeverityLabel(severity)}
              color={getSeverityColor(severity) as any}
              size="small"
            />
          </Box>

          {/* ユーザー向けメッセージ */}
          <Alert severity={getSeverityColor(severity) as any}>
            <AlertTitle>
              {severity === ErrorSeverity.CRITICAL ? '緊急エラー' : 'エラー詳細'}
            </AlertTitle>
            {getUserMessage(error)}
          </Alert>

          {/* リトライ進行状況 */}
          {retryCount > 0 && (
            <Box>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                リトライ進行状況: {retryCount} / {maxRetries}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(retryCount / maxRetries) * 100}
                color={canRetry ? 'primary' : 'error'}
              />
            </Box>
          )}

          {/* アクションボタン */}
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={onRetry}
              disabled={!canRetry}
              color="primary"
            >
              再試行 {canRetry ? `(${maxRetries - retryCount}回残り)` : '(上限に達しました)'}
            </Button>

            {enableRecovery && (
              <Button
                variant="outlined"
                startIcon={<RestoreIcon />}
                onClick={onStateRecovery}
                color="secondary"
              >
                状態復旧
              </Button>
            )}

            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={onPageReload}
              color="warning"
            >
              ページ再読み込み
            </Button>

            {enableReporting && (
              <Button
                variant="text"
                startIcon={<DownloadIcon />}
                onClick={onDownloadReport}
                size="small"
              >
                エラーレポート
              </Button>
            )}
          </Stack>

          {/* 詳細情報（開発者向け） */}
          {process.env.NODE_ENV === 'development' && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">
                  開発者向け詳細情報 (ID: {errorId})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      エラー名:
                    </Typography>
                    <Typography variant="body2" fontFamily="monospace">
                      {error?.name || 'Unknown'}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      エラーメッセージ:
                    </Typography>
                    <Typography variant="body2" fontFamily="monospace">
                      {error?.message || 'No message'}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      スタックトレース:
                    </Typography>
                    <Typography
                      variant="body2"
                      fontFamily="monospace"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.75rem',
                        backgroundColor: 'grey.100',
                        p: 1,
                        borderRadius: 1,
                        maxHeight: 200,
                        overflow: 'auto'
                      }}
                    >
                      {error?.stack || 'No stack trace available'}
                    </Typography>
                  </Box>

                  {errorInfo?.componentStack && (
                    <Box>
                      <Typography variant="subtitle2" color="textSecondary">
                        コンポーネントスタック:
                      </Typography>
                      <Typography
                        variant="body2"
                        fontFamily="monospace"
                        sx={{
                          whiteSpace: 'pre-wrap',
                          fontSize: '0.75rem',
                          backgroundColor: 'grey.100',
                          p: 1,
                          borderRadius: 1,
                          maxHeight: 200,
                          overflow: 'auto'
                        }}
                      >
                        {errorInfo.componentStack}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};

export default ErrorBoundary;