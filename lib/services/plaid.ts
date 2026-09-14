import { NotImplemented } from "./errors";

/** Access tokens are encrypted at rest with APP_ENCRYPTION_KEY (DESIGN.md §9). */
export async function createLinkToken(_userId: string): Promise<{ linkToken: string }> {
  throw new NotImplemented("plaid.createLinkToken");
}

export async function exchange(
  _userId: string,
  _publicToken: string
): Promise<{ itemId: string }> {
  throw new NotImplemented("plaid.exchange");
}

export async function removeItem(_userId: string, _itemId: string): Promise<void> {
  throw new NotImplemented("plaid.removeItem");
}
