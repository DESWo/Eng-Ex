import { Component } from 'react'
import type { ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /**
   * Shown once rendering below has thrown. `retry` clears the error and
   * renders the children again; for a failed lazy chunk prefer a full
   * `window.location.reload()`, since React caches the failed import.
   */
  fallback: (retry: () => void) => ReactNode
}

interface ErrorBoundaryState {
  failed: boolean
}

/**
 * Catches render errors so one broken subtree (most likely a game chunk that
 * failed to download, e.g. right after a deploy replaced the hashed files)
 * shows a friendly card instead of blanking the whole app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback(() => this.setState({ failed: false }))
    }
    return this.props.children
  }
}
