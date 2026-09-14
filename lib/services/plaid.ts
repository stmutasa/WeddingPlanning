import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
  type Transaction as PlaidTransaction,
} from "plaid";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { log } from "./actor";
import { NotFound, PlaidNotConfigured, ServiceError } from "./errors";

/**
 * DESIGN.md §9. Access tokens are AES-256-GCM encrypted at rest with
 * `APP_ENCRYPTION_KEY` and only ever decrypted inside this file.
 *
 * Without `PLAID_CLIENT_ID` / `PLAID_SECRET` every entry point throws
 * `PlaidNotConfigured`, which the routes answer as a clear 503 — CSV import
 * is the path that always works.
 */

let api: PlaidApi | null = null;

export function isConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID?.trim() && process.env.PLAID_SECRET?.trim());
}

export function environment(): string {
  return process.env.PLAID_ENV?.trim() || "sandbox";
}

function client(): PlaidApi {
  if (!isConfigured()) throw new PlaidNotConfigured();
  if (!api) {
    const basePath = PlaidEnvironments[environment()] ?? PlaidEnvironments.sandbox;
    api = new PlaidApi(
      new Configuration({
        basePath,
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
            "PLAID-SECRET": process.env.PLAID_SECRET,
          },
        },
      })
    );
  }
  return api;
}

function countryCodes(): CountryCode[] {
  const known = new Set(Object.values(CountryCode) as string[]);
  const parsed = (process.env.PLAID_COUNTRY_CODES ?? "US")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => known.has(c)) as CountryCode[];
  return parsed.length > 0 ? parsed : [CountryCode.Us];
}

function products(): Products[] {
  const known = new Set(Object.values(Products) as string[]);
  const parsed = (process.env.PLAID_PRODUCTS ?? "transactions")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p) => known.has(p)) as Products[];
  return parsed.length > 0 ? parsed : [Products.Transactions];
}

export async function createLinkToken(userId: string): Promise<{ linkToken: string; expiration: string }> {
  const appName = process.env.APP_NAME?.trim() || "Harusi";
  const res = await client().linkTokenCreate({
    client_name: appName,
    language: "en",
    country_codes: countryCodes(),
    products: products(),
    user: { client_user_id: userId },
  });
  return { linkToken: res.data.link_token, expiration: res.data.expiration };
}

export async function exchange(
  userId: string,
  publicToken: string
): Promise<{ itemId: string; institution: string | null; accounts: number }> {
  const plaid = client();
  const exchanged = await plaid.itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = exchanged.data.access_token;
  const itemId = exchanged.data.item_id;

  let institution: string | null = null;
  try {
    const item = await plaid.itemGet({ access_token: accessToken });
    const institutionId = item.data.item.institution_id;
    if (institutionId) {
      const inst = await plaid.institutionsGetById({
        institution_id: institutionId,
        country_codes: countryCodes(),
      });
      institution = inst.data.institution.name;
    }
  } catch {
    // The institution name is decoration; never fail the link over it.
  }

  const accounts = await plaid.accountsGet({ access_token: accessToken });

  const stored = await db.plaidItem.upsert({
    where: { itemId },
    update: {
      accessTokenEnc: encryptSecret(accessToken),
      institution,
      lastError: null,
    },
    create: {
      userId,
      itemId,
      accessTokenEnc: encryptSecret(accessToken),
      institution,
    },
  });

  for (const account of accounts.data.accounts) {
    await db.plaidAccount.upsert({
      where: { accountId: account.account_id },
      update: { name: account.name, mask: account.mask ?? null, subtype: account.subtype ?? null },
      create: {
        itemId: stored.id,
        accountId: account.account_id,
        name: account.name,
        mask: account.mask ?? null,
        subtype: account.subtype ?? null,
      },
    });
  }

  await log({
    userId,
    action: "CREATED",
    entityType: "Settings",
    entityId: stored.id,
    summary: `connected ${institution ?? "a bank"} (${accounts.data.accounts.length} accounts)`,
  });

  return { itemId, institution, accounts: accounts.data.accounts.length };
}

export async function removeItem(userId: string, id: string): Promise<void> {
  const item = await db.plaidItem.findFirst({ where: { OR: [{ id }, { itemId: id }] } });
  if (!item) throw new NotFound("Bank connection");

  try {
    await client().itemRemove({ access_token: decryptSecret(item.accessTokenEnc) });
  } catch (err) {
    // Plaid may have removed it already; the local row still goes.
    console.warn("[plaid] item/remove failed", err);
  }

  await db.plaidItem.delete({ where: { id: item.id } });

  await log({
    userId,
    action: "DELETED",
    entityType: "Settings",
    entityId: item.id,
    summary: `disconnected ${item.institution ?? "a bank"}`,
  });
}

export async function setAccountWatched(
  userId: string,
  accountRowId: string,
  watched: boolean
) {
  const account = await db.plaidAccount.findUnique({ where: { id: accountRowId } });
  if (!account) throw new NotFound("Account");

  const updated = await db.plaidAccount.update({
    where: { id: accountRowId },
    data: { watched },
  });

  await log({
    userId,
    action: "UPDATED",
    entityType: "Settings",
    entityId: accountRowId,
    summary: `${watched ? "started" : "stopped"} watching ${account.name} for wedding spending`,
  });

  return updated;
}

export interface SyncedTransactions {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removedIds: string[];
  cursor: string;
}

/**
 * `/transactions/sync` with the stored cursor, paged to the end. Errors are
 * recorded on the item so Settings can show them rather than swallowed.
 */
export async function syncItem(itemRowId: string): Promise<SyncedTransactions> {
  const item = await db.plaidItem.findUnique({ where: { id: itemRowId } });
  if (!item) throw new NotFound("Bank connection");

  const accessToken = decryptSecret(item.accessTokenEnc);
  const added: PlaidTransaction[] = [];
  const modified: PlaidTransaction[] = [];
  const removedIds: string[] = [];
  let cursor = item.cursor ?? undefined;

  try {
    for (;;) {
      const res = await client().transactionsSync({ access_token: accessToken, cursor, count: 250 });
      added.push(...res.data.added);
      modified.push(...res.data.modified);
      removedIds.push(...res.data.removed.map((r) => r.transaction_id).filter(Boolean as never));
      cursor = res.data.next_cursor;
      if (!res.data.has_more) break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await db.plaidItem.update({ where: { id: itemRowId }, data: { lastError: message } });
    throw new ServiceError(`Bank sync failed: ${message}`, 502);
  }

  await db.plaidItem.update({
    where: { id: itemRowId },
    data: { cursor, lastSyncAt: new Date(), lastError: null },
  });

  return { added, modified, removedIds, cursor: cursor ?? "" };
}

export async function items() {
  return db.plaidItem.findMany({
    include: { accounts: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Plaid signs webhooks with a JWT in `plaid-verification` whose key is
 * fetched from `/webhook_verification_key/get` by the JWT's `kid`. We verify
 * the header, the key and the SHA-256 of the body; a failure means the
 * request is not answered as valid.
 */
export async function verifyWebhook(rawBody: string, jwtHeader: string | null): Promise<boolean> {
  if (!jwtHeader) return false;

  const [headerB64, payloadB64, signatureB64] = jwtHeader.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) return false;

  let header: { alg?: string; kid?: string };
  let payload: { iat?: number; request_body_sha256?: string };
  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return false;
  }

  if (header.alg !== "ES256" || !header.kid) return false;

  // Replay window: Plaid's own guidance is five minutes.
  if (!payload.iat || Date.now() / 1000 - payload.iat > 5 * 60) return false;

  let jwk;
  try {
    const res = await client().webhookVerificationKeyGet({ key_id: header.kid });
    jwk = res.data.key;
  } catch {
    return false;
  }
  if (jwk.expired_at) return false;

  const { createHash, createPublicKey, createVerify } = await import("node:crypto");

  const bodyHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
  if (payload.request_body_sha256 !== bodyHash) return false;

  try {
    const keyObject = createPublicKey({
      key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
      format: "jwk",
    });
    const verifier = createVerify("SHA256");
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    return verifier.verify(
      { key: keyObject, dsaEncoding: "ieee-p1363" },
      Buffer.from(signatureB64, "base64url")
    );
  } catch {
    return false;
  }
}
