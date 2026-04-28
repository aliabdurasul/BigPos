import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Caught by Error Boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-destructive/10 text-destructive p-4">
          <div className="text-center max-w-md">
            <h1 className="font-bold text-2xl mb-4">Sistem Hatası</h1>
            <p className="mb-6 opacity-80">
              Oturum kilitlenmesi veya veri erişim hatası oluştu. Lütfen sayfayı yenileyin.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:opacity-90 transition-opacity"
            >
              Yeniden Başlat
            </button>
            {this.state.error && (
              <details className="mt-6 text-left text-xs opacity-60 break-all">
                <summary className="cursor-pointer font-medium mb-1">Hata detayı</summary>
                <pre className="bg-black/10 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
