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

/**
 * Best-effort push: FCM credentials are an optional, separately-provisioned
 * integration (RULES.md/TECH_STACK.md don't fix env var names for it). If
 * they aren't configured, notifications are still recorded in the database
 * (see Notification model) but the push itself is skipped rather than
 * failing the KTR detection ingestion request.
 */
export async function sendPushToTokens(
  tokens: string[],
  notification: { title: string; body: string },
) {
  if (tokens.length === 0) return { sent: 0, skipped: true };

  const app = getFirebaseApp();
  if (!app) return { sent: 0, skipped: true };

  const messaging = getMessaging(app);
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification,
  });

  return { sent: response.successCount, skipped: false };
}
