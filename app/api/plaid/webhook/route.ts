import { NextResponse } from "next/server";
import * as plaid from "@/lib/services/plaid";
import * as transactions from "@/lib/services/transactions";

export const dynamic = "force-dynamic";

/**
 * POST /api/plaid/webhook — DESIGN.md §9: no session gate, verified instead
 * by the ES256 JWT Plaid sends in `plaid-verification`, whose key comes from
 * /webhook_verification_key/get and whose payload carries the SHA-256 of
 * this exact body.
 *
 * Plaid retries on a non-2xx, so a sync failure still answers 200 with a
 * note rather than causing a retry storm.
 */
export async function POST(request: Request) {
  if (!plaid.isConfigured()) {
    return NextResponse.json({ error: "Plaid is not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const verified = await plaid.verifyWebhook(raw, request.headers.get("plaid-verification"));
  if (!verified) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let body: { webhook_type?: string; webhook_code?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const shouldSync =
    body.webhook_type === "TRANSACTIONS" &&
    ["SYNC_UPDATES_AVAILABLE", "DEFAULT_UPDATE", "INITIAL_UPDATE", "HISTORICAL_UPDATE"].includes(
      body.webhook_code ?? ""
    );

  if (!shouldSync) return NextResponse.json({ ok: true, ignored: body.webhook_code ?? null });

  try {
    const result = await transactions.sync(null);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[plaid] webhook sync failed", err);
    return NextResponse.json({ ok: true, synced: false });
  }
}
