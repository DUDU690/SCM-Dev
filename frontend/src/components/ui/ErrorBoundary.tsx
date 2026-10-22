import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-destructive mb-2">Something went wrong</h1>
            <p className="text-muted-foreground text-sm mb-4">{this.state.message}</p>
            <button
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
              onClick={() => { this.setState({ hasError: false, message: '' }); window.location.href = '/dashboard'; }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
