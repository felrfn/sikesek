import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

function getFirebaseApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) return null;

  return (
    getApps()[0] ??
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    })
  );
}

export interface PushSendResult {
  sent: number;
  skipped: boolean;
  /**
   * Tokens Firebase reported as permanently invalid/unregistered - the
   * caller (features/notifications/pushService.ts) deactivates these in the
   * database rather than retrying them forever (section 39).
   */
  invalidTokens: string[];
}

const PERMANENTLY_INVALID_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

/** FCM accepts at most 500 tokens per multicast request. */
const MAX_TOKENS_PER_REQUEST = 500;

/**
 * Best-effort push: FCM credentials are an optional, separately-provisioned
 * integration (RULES.md/TECH_STACK.md don't fix env var names for it). If
 * they aren't configured, notifications are still recorded in the database
 * (see Notification model) but the push itself is skipped rather than
 * failing the caller's business transaction (section 35 - a push failure
 * must never roll back the operation that triggered it).
 *
 * `data` values must be strings (an FCM data-payload constraint) and should
 * stay small/structural (an entity type + id, per section 37) - the mobile
 * app is expected to fetch fresh details from the API rather than trust a
 * potentially-stale payload embedded in the push itself.
 */
export async function sendPushToTokens(
  tokens: string[],
  notification: { title: string; body: string },
  data?: Record<string, string>,
): Promise<PushSendResult> {
  if (tokens.length === 0) return { sent: 0, skipped: true, invalidTokens: [] };

  const app = getFirebaseApp();
  if (!app) return { sent: 0, skipped: true, invalidTokens: [] };

  const messaging = getMessaging(app);
  const uniqueTokens = [...new Set(tokens)];
  const invalidTokens: string[] = [];
  let sent = 0;

  for (let offset = 0; offset < uniqueTokens.length; offset += MAX_TOKENS_PER_REQUEST) {
    const chunk = uniqueTokens.slice(offset, offset + MAX_TOKENS_PER_REQUEST);
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification,
      data,
    });

    sent += response.successCount;
    invalidTokens.push(
      ...response.responses
        .map((result, index) => ({ result, token: chunk[index] }))
        .filter(
          ({ result }) =>
            !result.success &&
            result.error &&
            PERMANENTLY_INVALID_ERROR_CODES.has(result.error.code),
        )
        .map(({ token }) => token),
    );
  }

  return { sent, skipped: false, invalidTokens };
}
