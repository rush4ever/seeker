import { useState, useEffect } from "react";
import {
  detectOllamaState,
  getStatusMessage,
  type OllamaState,
} from "../../lib/ollamaStatus";

export default function OllamaStatusBar() {
  const [state, setState] = useState<OllamaState>({
    status: "checking",
    model: null,
    checked: false,
  });

  useEffect(() => {
    let cancelled = false;
    detectOllamaState().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state.checked) {
    return <span className="text-xs text-notion-subtle">检测中…</span>;
  }

  const dotClass =
    state.status === "ready"
      ? "bg-green-500"
      : state.status === "checking"
      ? "bg-gray-400"
      : "bg-red-500";

  const label =
    state.status === "ready"
      ? state.model ?? "Ollama"
      : state.status === "checking"
      ? "检测中"
      : "Ollama 未就绪";

  // When not ready, surface the download link inline so the user still has the
  // affordance the old banner gave them.
  if (state.status !== "ready") {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-notion-muted"
        title={getStatusMessage(state)}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        <span>{label}</span>
        <a
          href="https://ollama.com/download"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:no-underline text-notion-accent"
        >
          下载
        </a>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-notion-muted"
      title={getStatusMessage(state)}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      <span>{label}</span>
    </span>
  );
}
