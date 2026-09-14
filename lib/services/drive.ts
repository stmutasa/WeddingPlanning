import { db } from "@/lib/db";

/**
 * DESIGN.md §8 Drive sync, behind `FEATURE_DRIVE_BRIEF`. Settings asks the
 * clicking user to re-consent for `https://www.googleapis.com/auth/drive.file`
 * through Auth.js; we then create or update one file, "{APP_NAME} Brief.md",
 * with their credentials and remember its id.
 *
 * Failure is always tolerated: it records an error and never blocks the
 * Brief from being generated (§8, "never blocks generation").
 */

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export function isEnabled(): boolean {
  return (process.env.FEATURE_DRIVE_BRIEF ?? "false").toLowerCase() === "true";
}

function fileName(): string {
  return `${process.env.APP_NAME?.trim() || "Harusi"} Brief.md`;
}

let lastError: string | null = null;

export interface DriveState {
  enabled: boolean;
  fileId: string | null;
  ownerUserId: string | null;
  hasScope: boolean;
  lastError: string | null;
}

export async function state(): Promise<DriveState> {
  const settings = await db.appSettings.findUnique({ where: { id: "main" } });
  const ownerUserId = settings?.briefDriveOwnerUserId ?? null;
  return {
    enabled: isEnabled(),
    fileId: settings?.briefDriveFileId ?? null,
    ownerUserId,
    hasScope: ownerUserId ? await hasDriveScope(ownerUserId) : false,
    lastError: lastError,
  };
}

async function hasDriveScope(userId: string): Promise<boolean> {
  const account = await db.account.findFirst({ where: { userId, provider: "google" } });
  return Boolean(account?.scope?.includes(DRIVE_SCOPE));
}

/** Turns on sync for this user; the next generate() writes the file. */
export async function enableFor(userId: string): Promise<DriveState> {
  await db.appSettings.update({
    where: { id: "main" },
    data: { briefDriveOwnerUserId: userId },
  });
  return state();
}

export async function disable(): Promise<DriveState> {
  await db.appSettings.update({
    where: { id: "main" },
    data: { briefDriveOwnerUserId: null, briefDriveFileId: null },
  });
  return state();
}

async function accessToken(userId: string): Promise<string | null> {
  const account = await db.account.findFirst({ where: { userId, provider: "google" } });
  if (!account) return null;

  const stillValid = account.expires_at && account.expires_at * 1000 > Date.now() + 60_000;
  if (stillValid && account.access_token) return account.access_token;

  if (!account.refresh_token) return account.access_token ?? null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });
  if (!res.ok) return null;

  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) return null;

  await db.account.update({
    where: { id: account.id },
    data: {
      access_token: body.access_token,
      expires_at: body.expires_in
        ? Math.floor(Date.now() / 1000) + body.expires_in
        : account.expires_at,
    },
  });

  return body.access_token;
}

/**
 * Writes the Brief to Drive when the flag is on and a user has consented.
 * Returns the file id, or null when sync is off or failed.
 */
export async function syncBriefToDrive(markdown: string): Promise<string | null> {
  if (!isEnabled()) return null;

  const settings = await db.appSettings.findUnique({ where: { id: "main" } });
  const ownerUserId = settings?.briefDriveOwnerUserId;
  if (!ownerUserId) return null;

  try {
    if (!(await hasDriveScope(ownerUserId))) {
      lastError = "Google Drive access has not been granted yet — re-consent in Settings.";
      return null;
    }

    const token = await accessToken(ownerUserId);
    if (!token) {
      lastError = "Could not refresh the Google access token — sign in again in Settings.";
      return null;
    }

    const existingId = settings?.briefDriveFileId ?? null;
    const fileId = existingId
      ? await updateFile(token, existingId, markdown)
      : await createFile(token, markdown);

    if (fileId && fileId !== existingId) {
      await db.appSettings.update({ where: { id: "main" }, data: { briefDriveFileId: fileId } });
    }

    lastError = null;
    return fileId;
  } catch (err) {
    lastError = err instanceof Error ? err.message : "Drive sync failed";
    console.error("[brief] Drive sync failed", err);
    return null;
  }
}

async function createFile(token: string, markdown: string): Promise<string | null> {
  const boundary = `harusi-${Date.now()}`;
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify({ name: fileName(), mimeType: "text/markdown" }),
    `--${boundary}`,
    "Content-Type: text/markdown; charset=UTF-8",
    "",
    markdown,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) throw new Error(`Drive create failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { id?: string };
  return json.id ?? null;
}

async function updateFile(token: string, fileId: string, markdown: string): Promise<string | null> {
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/markdown; charset=UTF-8",
      },
      body: markdown,
    }
  );

  // The file was deleted or unshared: fall back to creating a new one.
  if (res.status === 404) return createFile(token, markdown);
  if (!res.ok) throw new Error(`Drive update failed: ${res.status} ${await res.text()}`);

  const json = (await res.json()) as { id?: string };
  return json.id ?? fileId;
}
