import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM at-rest encryption for the few secrets the app stores in
 * SQLite (today: Plaid access tokens — DESIGN.md §9). The key is
 * `APP_ENCRYPTION_KEY`, 32 bytes base64 (`openssl rand -base64 32`).
 *
 * Ciphertext format: `v1.<iv b64>.<tag b64>.<ciphertext b64>` so the
 * envelope can be versioned if the scheme ever changes.
 */

const VERSION = "v1";

export class EncryptionKeyMissing extends Error {
  constructor() {
    super("APP_ENCRYPTION_KEY is not set (32 bytes base64)");
    this.name = "EncryptionKeyMissing";
  }
}

function key(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY?.trim();
  if (!raw) throw new EncryptionKeyMissing();
  const buf = Buffer.from(raw, "base64");
  if (buf.byteLength !== 32) {
    throw new EncryptionKeyMissing();
  }
  return buf;
}

export function hasEncryptionKey(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

export function decryptSecret(envelope: string): string {
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Unrecognised encrypted value");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
