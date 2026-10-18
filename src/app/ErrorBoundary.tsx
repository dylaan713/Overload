import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../ui/Button";
import styles from "./ErrorScreen.module.css";

// Catches render errors so a crash shows a recoverable screen instead of a blank page.
// Data is stored on the device, so a reload usually recovers; if stored data is what crashes it,
// the raw download still gets it out.
export class ErrorBoundary extends Component<{ children: ReactNode; onDownloadRaw?: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Overload crashed:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className={styles.screen}>
        <h1 className={styles.title}>Something broke</h1>
        <p className={styles.body}>Your logged data is safe: it&apos;s stored on this device. Reload to get back in.</p>
        <Button variant="primary" block onClick={() => window.location.reload()}>
          Reload
        </Button>
        {this.props.onDownloadRaw && (
          <Button variant="secondary" block onClick={this.props.onDownloadRaw}>
            Download raw data
          </Button>
        )}
        <pre className={styles.detail}>{String(this.state.error.message || this.state.error)}</pre>
      </div>
    );
  }
}
