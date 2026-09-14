import { NotImplemented } from "./errors";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Sends via web-push to every PushSubscription for the user; prunes 404/410 subscriptions. */
export async function send(_userId: string, _payload: PushPayload): Promise<void> {
  throw new NotImplemented("push.send");
}
