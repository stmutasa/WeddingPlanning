"use client";

import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { ApiError, apiPost } from "@/lib/api";
import { useRefreshAll } from "@/lib/hooks";
import { Button, useToast } from "@/components/ui";

/**
 * Plaid Link (DESIGN.md §9). The link token is minted server-side; when
 * Plaid is not configured the route answers 503 and we say so plainly
 * rather than opening an empty modal — CSV import is the other path.
 */
export function ConnectBankButton({ onError }: { onError: (message: string | null) => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const refreshAll = useRefreshAll();

  async function start() {
    setBusy(true);
    onError(null);
    try {
      const result = await apiPost<{ linkToken: string }>("/api/plaid/link-token");
      setToken(result.linkToken);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        onError("Bank connections are not switched on for this server yet. Import a CSV instead.");
      } else {
        onError(err instanceof Error ? err.message : "Could not start Plaid");
      }
    } finally {
      setBusy(false);
    }
  }

  async function exchange(publicToken: string) {
    try {
      const result = await apiPost<{ institution: string | null }>("/api/plaid/exchange", {
        publicToken,
      });
      toast(`Connected ${result.institution ?? "your bank"}`);
      refreshAll();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not finish connecting");
    } finally {
      setToken(null);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={start} disabled={busy}>
        {busy ? "Starting…" : "Connect bank"}
      </Button>
      {token ? (
        <PlaidLauncher token={token} onSuccess={exchange} onExit={() => setToken(null)} />
      ) : null}
    </>
  );
}

function PlaidLauncher({
  token,
  onSuccess,
  onExit,
}: {
  token: string;
  onSuccess: (publicToken: string) => void;
  onExit: () => void;
}) {
  const { open, ready } = usePlaidLink({
    token,
    // Plaid types the public token as nullable; a null one means Link
    // closed without an item to exchange.
    onSuccess: (publicToken) => {
      if (publicToken) onSuccess(publicToken);
      else onExit();
    },
    onExit: () => onExit(),
  });

  useEffect(() => {
    if (ready) open();
  }, [ready, open]);

  return null;
}
