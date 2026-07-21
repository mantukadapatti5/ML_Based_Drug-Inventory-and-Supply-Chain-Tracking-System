import { Component } from "react";

/**
 * Error Boundary Component - Catches rendering errors and displays graceful UI
 * Prevents entire dashboard from crashing due to single component failure
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorCount: 0 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("🚨 Error Boundary caught error:", error);
    console.error("Component stack:", errorInfo.componentStack);
    this.setState((prev) => ({
      error,
      errorInfo,
      errorCount: prev.errorCount + 1,
    }));
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    const { hasError, error, errorInfo, errorCount } = this.state;

    if (hasError) {
      return (
        <div className="space-y-4 p-6 rounded-xl bg-red-900/20 border border-red-700 text-red-200">
          <div className="flex items-center gap-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <h2 className="text-lg font-semibold text-red-100">Component Error</h2>
              <p className="text-sm text-red-300">
                {this.props.fallbackMessage || "Something went wrong while rendering this component."}
              </p>
            </div>
          </div>

          {process.env.NODE_ENV === "development" && error && (
            <details className="text-xs text-red-300 mt-3 cursor-pointer">
              <summary className="font-mono hover:text-red-200">Error Details ({errorCount} occurrence{errorCount > 1 ? "s" : ""})</summary>
              <pre className="mt-2 p-3 bg-red-950/50 rounded overflow-auto max-h-32 text-red-400">
                {error.toString()}
                {errorInfo?.componentStack}
              </pre>
            </details>
          )}

          <button
            onClick={this.handleReset}
            className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
