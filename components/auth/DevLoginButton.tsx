"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function DevLoginButton({ email }: { email: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/dev-login", { method: "POST" });
      if (!res.ok) {
        const { error: message } = await res.json().catch(() => ({ error: "Dev sign-in failed" }));
        setError(message ?? "Dev sign-in failed");
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="secondary" onClick={handleClick} disabled={isPending}>
        {isPending ? "Signing in…" : `Dev sign-in as ${email}`}
      </Button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
