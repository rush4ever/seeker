const OLLAMA_BASE = "http://localhost:11434";

export type ModelRole = "reasoning" | "vision" | "lightweight";

interface ModelConfig {
  default: string;
  fallback?: string;
}

export const MODEL_CONFIG: Record<ModelRole, ModelConfig> = {
  reasoning: { default: "kimi-k2.5:cloud", fallback: "qwen2.5:32b" },
  vision: { default: "qwen2.5vl:7b", fallback: "llava:13b" },
  lightweight: { default: "qwen2.5:7b" },
};

export interface ModelAvailability {
  model: string;
  isFallback: boolean;
}

export async function resolveModel(role: ModelRole): Promise<ModelAvailability | null> {
  const config = MODEL_CONFIG[role];
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { method: "GET" });
    if (!res.ok) return null;

    const data = (await res.json()) as { models: { name: string }[] };
    const installed = new Set(data.models.map((m) => m.name));

    if (installed.has(config.default)) {
      return { model: config.default, isFallback: false };
    }
    if (config.fallback && installed.has(config.fallback)) {
      return { model: config.fallback, isFallback: true };
    }
    return null;
  } catch {
    return null;
  }
}

export async function checkModelAvailable(modelName: string): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { method: "GET" });
    if (!res.ok) return false;
    const data = (await res.json()) as { models: { name: string }[] };
    return data.models.some((m) => m.name === modelName);
  } catch {
    return false;
  }
}
