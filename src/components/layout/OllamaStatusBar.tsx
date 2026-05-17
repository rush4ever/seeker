import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { detectOllamaState, getStatusMessage, getStatusColor, type OllamaState } from "../../lib/ollamaStatus";

export default function OllamaStatusBar() {
  const [state, setState] = useState<OllamaState>({ status: "checking", model: null, checked: false });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    detectOllamaState().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => { cancelled = true; };
  }, []);

  if (state.status === "ready") return null;
  if (dismissed) return null;

  const icon = state.status === "checking" ? (
    <Loader2 size={14} className="animate-spin" />
  ) : (
    <AlertCircle size={14} />
  );

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-xs border-b ${getStatusColor(state)}`}>
      {icon}
      <span className="flex-1">{getStatusMessage(state)}</span>
      <a
        href="https://ollama.com/download"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:no-underline"
      >
        下载 Ollama
      </a>
      <button onClick={() => setDismissed(true)} className="hover:opacity-70">
        <X size={14} />
      </button>
    </div>
  );
}
