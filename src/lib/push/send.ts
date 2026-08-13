import webpush from "web-push";
import { listSubscriptions, removeSubscription } from "./store";
import { isPushConfigured, serverConfig } from "../config";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Sends a Web Push notification to every device of a user. Expired
 *  subscriptions (410/404) are pruned. Returns how many were delivered. */
export async function pushToUser(
  userId: string,
  authed: boolean,
  payload: PushPayload,
): Promise<{ sent: number; total: number }> {
  if (!isPushConfigured()) return { sent: 0, total: 0 };
  webpush.setVapidDetails(
    serverConfig.vapid.subject,
    serverConfig.vapid.publicKey,
    serverConfig.vapid.privateKey,
  );
  const subs = await listSubscriptions(userId, authed);
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body);
        sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) await removeSubscription(userId, authed, s.endpoint);
      }
    }),
  );
  return { sent, total: subs.length };
}
