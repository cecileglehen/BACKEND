import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    const msg = String(this.state.error?.message || this.state.error || "Erreur inconnue");
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">⚠️</span>
            <h2 className="text-lg font-bold text-red-900">Quelque chose s'est mal passé</h2>
          </div>
          <p className="text-sm text-red-800 mb-3">
            Une erreur est survenue dans l'interface. Tu peux réessayer ou recharger la page.
          </p>
          <pre className="text-[11px] font-mono bg-white border border-red-200 rounded-lg p-3 overflow-x-auto text-red-700 mb-4 max-h-40">
            {msg}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="px-4 py-2 rounded-full text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#2563eb,#06b6d4)" }}
            >
              Réessayer
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-full text-sm font-semibold border border-red-300 text-red-800 bg-white hover:bg-red-100"
            >
              Recharger la page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
