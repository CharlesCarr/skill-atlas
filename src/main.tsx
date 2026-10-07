import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal-error">
          <h1>This workspace could not be opened.</h1>
          <p>
            A stored document may be invalid. Downloaded bundles and local files are unaffected.
          </p>
          <button
            className="button primary"
            onClick={() => {
              localStorage.removeItem('skill-atlas:workspaces:v1');
              location.reload();
            }}
          >
            Reset browser workspace
          </button>
        </main>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
