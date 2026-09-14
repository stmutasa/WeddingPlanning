/**
 * Client-side fetch helpers (DESIGN.md §2 "lib/api.ts"). Every screen talks
 * to the routes documented in README.md through these; nothing in
 * `components/` imports a service, a Prisma client or anything else that
 * only runs on the server.
 *
 * Errors are always `{ error }` with a status, so `ApiError` carries both.
 */

export class ApiError extends Error {
  readonly status: number;
  /** Extra fields a route returned alongside `error` (e.g. CSV `headers`). */
  readonly body: Record<string, unknown>;

  constructor(message: string, status: number, body: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const data = await parse(res);
  if (!res.ok) {
    const body = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    const message = typeof body.error === "string" ? body.error : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, body);
  }
  return data as T;
}

/** SWR fetcher. */
export function fetcher<T>(url: string): Promise<T> {
  return fetch(url, { headers: { Accept: "application/json" } }).then((res) => unwrap<T>(res));
}

export function apiGet<T>(url: string): Promise<T> {
  return fetcher<T>(url);
}

async function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return unwrap<T>(res);
}

export function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return send<T>("POST", url, body);
}

export function apiPatch<T>(url: string, body: unknown): Promise<T> {
  return send<T>("PATCH", url, body);
}

export function apiPut<T>(url: string, body: unknown): Promise<T> {
  return send<T>("PUT", url, body);
}

export function apiDelete<T>(url: string, body?: unknown): Promise<T> {
  return send<T>("DELETE", url, body);
}

/** Multipart upload (attachments, receipts, CSV imports). */
export async function apiUpload<T>(url: string, form: FormData): Promise<T> {
  const res = await fetch(url, { method: "POST", body: form });
  return unwrap<T>(res);
}

/** Dollars typed into a form → integer cents, with no float arithmetic kept. */
export function dollarsToCents(value: string | number): number {
  const text = typeof value === "number" ? String(value) : value.trim().replace(/[$,\s]/g, "");
  if (!text) return 0;
  const negative = text.startsWith("-");
  const digits = negative ? text.slice(1) : text;
  const [whole = "0", fraction = ""] = digits.split(".");
  const cents = Number(whole || "0") * 100 + Number(`${(fraction + "00").slice(0, 2)}` || "0");
  return negative ? -cents : cents;
}

/** Integer cents → the string an <input type="number" step="0.01"> wants. */
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
