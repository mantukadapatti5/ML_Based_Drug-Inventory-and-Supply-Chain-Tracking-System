// ============================================================================
// ERROR BOUNDARIES & FALLBACK COMPONENTS
// ============================================================================
// Graceful error handling when backend services are unavailable. Shows
// friendly warnings instead of crashing the UI.
// ============================================================================

import React from 'react';

/**
 * HIGH-LEVEL ERROR BOUNDARY FOR ENTIRE APP
 */
export class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Global error caught:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="max-w-md">
            <h1 className="text-2xl font-bold text-red-900 mb-4">Something Went Wrong</h1>
            <p className="text-red-700 mb-4">
              The application encountered an unexpected error. Please refresh the page or contact support.
            </p>
            <details className="text-sm text-red-600 bg-white p-3 rounded border border-red-200">
              <summary className="cursor-pointer font-semibold mb-2">Error Details</summary>
              <pre className="text-xs overflow-auto">{this.state.error?.toString()}</pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * SECTION-LEVEL ERROR BOUNDARY (for individual components)
 */
export class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Section error caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-semibold text-amber-900">Unable to Load This Section</h3>
              <p className="text-sm text-amber-800 mt-1">
                {this.state.error?.message || 'An error occurred while rendering this component.'}
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="mt-2 text-sm px-3 py-1 bg-amber-200 text-amber-900 rounded hover:bg-amber-300"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * FALLBACK COMPONENT FOR LOADING STATES
 */
export function LoadingFallback({ message = 'Loading...', fullHeight = false }) {
  return (
    <div className={`flex items-center justify-center ${fullHeight ? 'h-screen' : 'py-12'}`}>
      <div className="text-center">
        <div className="inline-block">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-slate-600 text-sm">{message}</p>
      </div>
    </div>
  );
}

/**
 * FALLBACK COMPONENT FOR OFFLINE/UNAVAILABLE BACKEND
 */
export function BackendUnavailable({ service = 'Backend', message = 'The service is currently unavailable.' }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-4">
        <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 2.476M2 10a8 8 0 008 8v-8h8a8 8 0 11-16 0z" clipRule="evenodd" />
        </svg>
        <div>
          <h3 className="font-semibold text-red-900">{service} Unavailable</h3>
          <p className="text-sm text-red-700 mt-2">{message}</p>
          <p className="text-xs text-red-600 mt-3">
            Please check your internet connection and try again. If the problem persists, contact support.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * FALLBACK COMPONENT FOR NO DATA
 */
export function NoDataPlaceholder({ title = 'No Data Available', description = 'There is no data to display.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <svg className="w-16 h-16 text-slate-300 mb-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M18 11a1 1 0 11-2 0 1 1 0 012 0z"></path>
        <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"></path>
      </svg>
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="text-sm text-slate-500 mt-2">{description}</p>
    </div>
  );
}

/**
 * ASYNC DATA WRAPPER - handles loading, error, and success states
 */
export function AsyncDataWrapper({ loading, error, data, children, emptyMessage = 'No data available' }) {
  if (loading) {
    return <LoadingFallback />;
  }

  if (error) {
    return <BackendUnavailable service="Data Service" message={error} />;
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return <NoDataPlaceholder description={emptyMessage} />;
  }

  return children(data);
}

/**
 * FIELD-LEVEL ERROR MESSAGE
 */
export function FieldError({ message, show = true }) {
  if (!show || !message) return null;
  return (
    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18.101 12.93a1 1 0 00-1.414-1.414L10 15.586l-6.687-6.687a1 1 0 00-1.414 1.414l8 8a1 1 0 001.414 0l8-8z" clipRule="evenodd" />
      </svg>
      {message}
    </p>
  );
}

/**
 * INLINE WARNING/INFO BANNER
 */
export function InfoBanner({ type = 'info', title, message, onClose }) {
  const bgColor = {
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-amber-50 border-amber-200',
    error: 'bg-red-50 border-red-200',
    success: 'bg-green-50 border-green-200',
  }[type];

  const textColor = {
    info: 'text-blue-900',
    warning: 'text-amber-900',
    error: 'text-red-900',
    success: 'text-green-900',
  }[type];

  const iconColor = {
    info: 'text-blue-600',
    warning: 'text-amber-600',
    error: 'text-red-600',
    success: 'text-green-600',
  }[type];

  return (
    <div className={`rounded-lg border ${bgColor} p-4 flex items-start gap-3`}>
      <svg className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      <div className="flex-1">
        {title && <h4 className={`font-semibold ${textColor}`}>{title}</h4>}
        <p className={`text-sm ${textColor} ${title ? 'mt-1' : ''}`}>{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className={`text-${type}-400 hover:text-${type}-600 flex-shrink-0`}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * RETRY WRAPPER COMPONENT
 */
export function RetryableComponent({ onRetry, children, isRetrying = false }) {
  return (
    <div>
      {children}
      <button
        onClick={onRetry}
        disabled={isRetrying}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isRetrying ? 'Retrying...' : 'Retry'}
      </button>
    </div>
  );
}

export default {
  GlobalErrorBoundary,
  SectionErrorBoundary,
  LoadingFallback,
  BackendUnavailable,
  NoDataPlaceholder,
  AsyncDataWrapper,
  FieldError,
  InfoBanner,
  RetryableComponent,
};
