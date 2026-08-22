import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureDiagnostic } from '../lib/diagnostics';
import { clearAllQRYverseLocalData } from '../lib/storage';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const diagnostic = new Error(error.message);
    diagnostic.stack = `${error.stack ?? ''}\n${info.componentStack ?? ''}`;
    captureDiagnostic('render', diagnostic);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="recovery-screen">
        <span className="recovery-mark">QRY</span>
        <h1>Something went wrong</h1>
        <p>A private diagnostic was saved on this device. Your scans and Track records were not removed.</p>
        <button onClick={() => window.location.reload()}>Restart QRY</button>
        <button className="recovery-reset" onClick={() => {
          if (!window.confirm('Permanently erase this device’s QRYverse Library, Track, Studio, preferences, and diagnostics? Exported files are not affected.')) return;
          clearAllQRYverseLocalData();
          window.location.reload();
        }}>Erase local data and restart</button>
      </main>
    );
  }
}
