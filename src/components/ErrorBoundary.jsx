import React from 'react';

/**
 * ErrorBoundary - Catches JavaScript errors anywhere in a child component tree,
 * logs those errors, and displays a fallback UI instead of a blank screen crash.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 *
 *   Or with a custom fallback:
 *   <ErrorBoundary fallback={<p>Custom error message</p>}>
 *     <YourComponent />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary] Caught an error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback !== undefined) {
                return this.props.fallback;
            }
            return (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        minHeight: '200px',
                        gap: '1rem',
                        padding: '2rem',
                        textAlign: 'center',
                        color: '#94a3b8',
                    }}
                >
                    <div style={{ fontSize: '3rem' }}>⚠️</div>
                    <h3 style={{ color: '#e2e8f0', margin: 0 }}>Something went wrong</h3>
                    <p style={{ margin: 0, maxWidth: '400px', fontSize: '0.9rem', lineHeight: 1.6 }}>
                        An unexpected error occurred in this section. You can try reloading to fix it.
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button
                            onClick={this.handleReset}
                            style={{
                                padding: '0.5rem 1.25rem',
                                borderRadius: '8px',
                                border: '1px solid rgba(99, 102, 241, 0.5)',
                                background: 'rgba(99, 102, 241, 0.15)',
                                color: '#a5b4fc',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                            }}
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '0.5rem 1.25rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: 'var(--primary, #6366f1)',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                            }}
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

export default ErrorBoundary;
