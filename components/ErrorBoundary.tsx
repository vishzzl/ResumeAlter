'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                    <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-200 p-8">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                                <AlertCircle className="h-8 w-8 text-red-600" />
                            </div>

                            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                                Something went wrong
                            </h1>

                            <p className="text-gray-600 mb-6">
                                We encountered an unexpected error. Don't worry, your data is safe.
                            </p>

                            {this.state.error && (
                                <div className="w-full mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <p className="text-xs font-mono text-gray-700 break-all">
                                        {this.state.error.message}
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={this.handleReset}
                                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Reload Application
                            </button>

                            <a
                                href="/"
                                className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                                Go to Dashboard
                            </a>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
