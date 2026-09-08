import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

// If a library throws while the app is starting, show the error instead of
// a silent blank page. That is what happened with the MACI assert import.
export class BootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("VenekoVox failed to start:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main style={{ minHeight: "100vh", padding: 32, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>The page failed to start</h1>
        <p style={{ marginBottom: 16, maxWidth: 640 }}>
          A JavaScript module crashed before React could draw the site. The message
          below is the actual error.
        </p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#111827",
            color: "#f9fafb",
            padding: 16,
            borderRadius: 8,
          }}
        >
          {this.state.error.message}
        </pre>
      </main>
    );
  }
}
