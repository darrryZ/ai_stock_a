'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="card p-4 border-red-500/20">
          <p className="text-xs text-red-400">组件加载失败</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs text-blue-400 mt-2 hover:underline"
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
