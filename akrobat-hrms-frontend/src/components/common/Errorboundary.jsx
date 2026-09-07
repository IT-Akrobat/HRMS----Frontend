import { RefreshCw } from "lucide-react";
import { Component } from "react";

// This app had NO error boundary anywhere (main.jsx / App.jsx), which
// means any uncaught render error -- anywhere, for any user -- silently
// unmounted the whole React tree. No error message, nothing actionable,
// just a blank white screen. That's especially bad combined with the
// per-role lazy-loaded routes in App.jsx: Suspense only covers the
// *pending* state of a lazy import, not a *failed* one. After a normal
// deploy (new hashed chunk filenames), anyone with the old app shell
// still cached will have their next lazy import 404 -- and a plain
// reload doesn't fix it, since the stale shell just asks for the same
// missing file again. That combination (blank screen, since a specific
// point in time, survives reloads, affects some users and not others)
// is the single most common cause of "the app just went blank" reports
// in any code-split SPA, and is exactly what this boundary targets.
function isChunkLoadError(error) {
  const msg = String(error?.message || error || "");
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Loading chunk .* failed/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Goes to the browser console (and wherever else console.error is
    // already piped, e.g. an error-tracking service) so this is
    // debuggable even when the person hitting it can't describe what
    // happened beyond "the screen went blank".
    console.error("Uncaught error rendering the app:", error, info);
  }

  handleReload = () => {
    // A stale service worker / HTTP cache is the whole reason a normal
    // reload doesn't already fix a chunk-load failure -- force the
    // browser back to the network instead of repeating the same cached
    // miss.
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const staleDeploy = isChunkLoadError(error);

    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
          <RefreshCw size={24} className="text-orange-500" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">
            {staleDeploy
              ? "A new version of this app is available"
              : "Something went wrong"}
          </p>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            {staleDeploy
              ? "Please reload to get the latest version."
              : "Please reload the page. If this keeps happening, let your admin know."}
          </p>
        </div>
        <button
          onClick={this.handleReload}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <RefreshCw size={15} /> Reload
        </button>
      </div>
    );
  }
}
