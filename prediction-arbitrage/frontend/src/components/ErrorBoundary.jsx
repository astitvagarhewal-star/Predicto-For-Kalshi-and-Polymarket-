import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("UI rendering error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-pa-red/40 bg-pa-red/10 p-4 text-sm text-red-100">
          Something went wrong while rendering the dashboard. Refresh the page to retry.
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
