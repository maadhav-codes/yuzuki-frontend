'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled application error:', error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className='flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center'>
          <h1 className='text-3xl font-semibold text-slate-900'>Something went wrong</h1>
          <p className='mt-3 max-w-md text-sm text-slate-600'>
            The app hit an unexpected error. Please try reloading the page.
          </p>
          <button
            className='mt-6 cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm text-white'
            onClick={this.handleReset}
            type='button'
          >
            Reload app
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
