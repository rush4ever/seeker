/**
 * Thin wrapper around the `sonner` toast library.
 *
 * Why wrap?
 *   1. Centralizes styling/positioning (the <Toaster /> is mounted in
 *      App.tsx and uses Tailwind theme colors).
 *   2. Constrains the API surface to the 3 variants we actually use,
 *      so call sites can't accidentally pass weird options that break
 *      visual consistency.
 *   3. Makes it trivial to swap the underlying library later if needed.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success("已导出", { description: "/path/.../file.pdf",
 *                              action: { label: "打开", onClick: ... }});
 *   toast.error("导入失败", { description: err.message });
 *   toast.info("批量分析完成", { description: "5 成功, 1 失败" });
 */
import { toast as sonner } from "sonner";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  description?: string;
  action?: ToastAction;
  /** milliseconds; default 3000 for success, 6000 for error */
  duration?: number;
}

export interface ToastApi {
  success: (title: string, opts?: ToastOptions) => void;
  error: (title: string, opts?: ToastOptions) => void;
  info: (title: string, opts?: ToastOptions) => void;
}

export function useToast(): ToastApi {
  return {
    success: (title, opts) => {
      sonner.success(title, {
        description: opts?.description,
        action: opts?.action
          ? { label: opts.action.label, onClick: opts.action.onClick }
          : undefined,
        duration: opts?.duration ?? 3000,
      });
    },
    error: (title, opts) => {
      sonner.error(title, {
        description: opts?.description,
        action: opts?.action
          ? { label: opts.action.label, onClick: opts.action.onClick }
          : undefined,
        duration: opts?.duration ?? 6000,
      });
    },
    info: (title, opts) => {
      sonner.info(title, {
        description: opts?.description,
        action: opts?.action
          ? { label: opts.action.label, onClick: opts.action.onClick }
          : undefined,
        duration: opts?.duration ?? 4000,
      });
    },
  };
}
