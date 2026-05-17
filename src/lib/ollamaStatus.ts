import { checkOllamaStatus } from "./ollama";

export type OllamaStatus =
  | "checking"
  | "ready"
  | "not_running"
  | "no_model";

export interface OllamaState {
  status: OllamaStatus;
  model: string | null;
  checked: boolean;
}

export async function detectOllamaState(): Promise<OllamaState> {
  const result = await checkOllamaStatus();
  if (result.available) {
    return { status: "ready", model: result.model ?? null, checked: true };
  }
  return { status: "not_running", model: null, checked: true };
}

export function getStatusMessage(state: OllamaState): string {
  switch (state.status) {
    case "checking":
      return "正在检测 Ollama...";
    case "ready":
      return state.model ? `Ollama 就绪 (${state.model})` : "Ollama 就绪";
    case "not_running":
      return "Ollama 未运行，AI 分析功能不可用";
    case "no_model":
      return "Ollama 运行中但未安装模型";
    default:
      return "";
  }
}

export function getStatusColor(state: OllamaState): string {
  switch (state.status) {
    case "ready":
      return "text-green-600 bg-green-50 border-green-200";
    case "checking":
      return "text-amber-600 bg-amber-50 border-amber-200";
    default:
      return "text-red-600 bg-red-50 border-red-200";
  }
}
