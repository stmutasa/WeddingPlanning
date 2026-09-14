import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

function uploadDir(): string {
  return process.env.UPLOAD_DIR ?? "./uploads";
}

/** Saves a Blob/File under UPLOAD_DIR and returns the path stored in the DB (relative to UPLOAD_DIR). */
export async function saveUpload(file: Blob, originalName: string): Promise<{
  relativePath: string;
  bytes: number;
}> {
  const dir = uploadDir();
  // UPLOAD_DIR is an env-configured runtime path outside the build (e.g.
  // /data/uploads on Railway) — intentionally dynamic, so it must never be
  // traced/bundled into the standalone output.
  await mkdir(/* turbopackIgnore: true */ dir, { recursive: true });

  const ext = path.extname(originalName) || "";
  const relativePath = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(/* turbopackIgnore: true */ path.join(dir, relativePath), buffer);

  return { relativePath, bytes: buffer.byteLength };
}

export async function readUpload(relativePath: string): Promise<Buffer> {
  return readFile(/* turbopackIgnore: true */ path.join(uploadDir(), relativePath));
}
