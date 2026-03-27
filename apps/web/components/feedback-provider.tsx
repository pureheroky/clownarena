"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { cn } from "@/lib/utils";

type FeedbackTone = "success" | "error" | "info";

type FeedbackInput = {
  title: string;
  description?: string;
  tone?: FeedbackTone;
};

type FeedbackToast = FeedbackInput & {
  id: string;
  tone: FeedbackTone;
};

type FeedbackContextValue = {
  notify: (input: FeedbackInput) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

function FeedbackItem({
  toast,
  onDismiss
}: {
  toast: FeedbackToast;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(toast.id), 3600);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast.id]);

  const Icon =
    toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? TriangleAlert : Info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "pointer-events-auto w-full max-w-sm rounded-2xl border px-4 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.12)] backdrop-blur",
        toast.tone === "success" && "border-emerald-200 bg-white/95",
        toast.tone === "error" && "border-red-200 bg-white/95",
        toast.tone === "info" && "border-slate-200 bg-white/95"
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0",
            toast.tone === "success" && "text-emerald-600",
            toast.tone === "error" && "text-red-600",
            toast.tone === "info" && "text-primary"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{toast.title}</div>
          {toast.description ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{toast.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<FeedbackToast[]>([]);

  const notify = useCallback((input: FeedbackInput) => {
    setToasts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        tone: input.tone ?? "info",
        title: input.title,
        description: input.description
      }
    ]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-full max-w-sm flex-col gap-3">
        <AnimatePresence>
          {toasts.map((toast) => (
            <FeedbackItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used inside FeedbackProvider.");
  }
  return context;
}
