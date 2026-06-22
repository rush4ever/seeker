import { useState, useRef, useEffect, useCallback } from "react";
import { chatWithAnalysis, type ChatMessage } from "../../lib/ollama";
import { MathContent } from "../common/MathContent";
import { Send, Loader2, MessageSquare, Check } from "lucide-react";

interface Props {
  questionContent: string;
  solutionApproach: string | null | undefined;
  solutionSteps: string | null | undefined;
  onAdopt: (approach: string, steps: string[]) => Promise<void>;
}

export default function AIChatBox({ questionContent, solutionApproach, solutionSteps, onAdopt }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `当前分析结果已显示在上方。如果你发现解题思路或步骤中有误，可以在这里指出来，我会帮你修正。\n\n例如：\n- "第 3 步计算错了，应该是 …"\n- "解题思路不对，应该从 … 入手"`,
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [adoptingMsg, setAdoptingMsg] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);

    try {
      // Build conversation history for the API call (exclude the welcome message from context)
      const chatHistory = [...messages, { role: "user" as const, content: text }];
      const approach = solutionApproach ?? null;
      const steps = solutionSteps ?? null;
      const response = await chatWithAnalysis(
        questionContent,
        { approach, steps },
        chatHistory,
      );
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ 请求失败：${err instanceof Error ? err.message : "未知错误"}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, questionContent, solutionApproach, solutionSteps]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-notion-border">
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 text-xs font-medium text-notion-muted uppercase tracking-wide">
          <MessageSquare size={14} />
          AI 讨论
        </div>
      </div>
      <div
        ref={listRef}
        className="px-4 space-y-3 max-h-[300px] overflow-y-auto"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-notion px-3 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary-500 text-white"
                  : "bg-notion-surface text-notion-text"
              }`}
            >
              <MathContent text={msg.content} />
              {/* Adopt button on assistant messages (skip welcome msg for indices where msg has real content) */}
              {msg.role === "assistant" && i > 0 && (
                <button
                  onClick={async () => {
                    setAdoptingMsg(i);
                    try {
                      const lines = msg.content
                        .split("\n")
                        .map((l) => l.trim())
                        .filter(Boolean);
                      // Heuristic: extract numbered steps (lines starting with a digit + ".")
                      const stepLines = lines.filter((l) => /^\d+[\.\、]/.test(l));
                      const steps = stepLines.length > 0
                        ? stepLines.map((l) => l.replace(/^\d+[\.\、]\s*/, ""))
                        : [msg.content];
                      // Use the first few lines as approach description
                      const approachLines = lines.filter((l) => !/^\d+[\.\、]/.test(l));
                      const approach = approachLines.length > 0
                        ? approachLines.join("\n")
                        : msg.content;
                      await onAdopt(approach, steps);
                    } finally {
                      setAdoptingMsg(null);
                    }
                  }}
                  disabled={adoptingMsg !== null}
                  className={`mt-2 flex items-center gap-1 text-xs px-2 py-1 rounded-notion border transition-colors ${
                    adoptingMsg === i
                      ? "opacity-50 cursor-not-allowed border-gray-200 text-gray-400"
                      : "border-primary-200 text-primary-600 hover:bg-primary-50 cursor-pointer"
                  }`}
                >
                  {adoptingMsg === i ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Check size={12} />
                  )}
                  {adoptingMsg === i ? "保存中..." : "采纳此回答"}
                </button>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-notion-surface rounded-notion px-3 py-2 text-sm text-notion-muted flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              思考中...
            </div>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-notion-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="指出分析中的错误或提问..."
            disabled={sending}
            className="flex-1 px-3 py-2 text-sm border border-notion-border rounded-notion focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-3 py-2 bg-primary-500 text-white rounded-notion hover:bg-primary-600 transition-colors disabled:opacity-40 flex items-center gap-1"
          >
            {sending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
