import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI render failed', { message: error.message, componentStack: info.componentStack });
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="fullscreen-state">
          <div className="error-block">
            Не удалось отобразить страницу. Обновите её и повторите действие.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
