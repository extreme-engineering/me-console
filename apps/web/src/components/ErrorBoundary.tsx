import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex items-center justify-center min-h-[300px] p-8">
          <div
            className="max-w-md w-full text-center rounded-xl p-8"
            style={{ backgroundColor: 'var(--color-paper-2)', border: '1px solid var(--color-border-light)' }}
          >
            <AlertTriangle size={32} style={{ color: 'var(--color-ink-3)', margin: '0 auto 12px' }} />
            <h2 className="text-lg font-medium mb-2" style={{ color: 'var(--color-ink)' }}>
              页面出现了问题
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--color-ink-2)' }}>
              {this.state.error?.message || '发生了未知错误'}
            </p>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors"
              style={{
                backgroundColor: 'var(--color-ink-soft)',
                color: 'var(--color-ink-inverse)',
              }}
            >
              <RefreshCw size={14} />
              重试
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
