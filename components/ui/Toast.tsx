"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { clsx } from "@/lib/clsx";

interface ToastItem {
  id: number;
  message: string;
}

interface ToastContextValue {
  toast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

/** Toasts: card fill, 2px ink border (light), radius 8, bottom-centre above the tab bar, 3s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string) => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {items.map((item) => (
          <div
            key={item.id}
            className="animate-fade-in card-frame pointer-events-auto rounded-lg bg-card px-4 py-2.5 text-sm font-medium text-ink shadow-sheet"
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

/** Standalone toast markup, exported for stories/tests that don't want the provider. */
export function ToastPreview({ message, className }: { message: string; className?: string }) {
  return (
    <div className={clsx("card-frame rounded-lg bg-card px-4 py-2.5 text-sm text-ink", className)}>
      {message}
    </div>
  );
}
