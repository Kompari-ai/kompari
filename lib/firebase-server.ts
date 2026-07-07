// Server-safe Firestore read, for use from server components / generateMetadata only.
// Do not import firebase/auth here (no getAuth / GoogleAuthProvider) — this file must
// stay usable from a Node.js server context without dragging in browser-oriented
// persistence code. Do not import firebase-admin either: events/* is public read
// (see firestore.rules), so the regular client SDK is sufficient and needs no
// service account / secret.
import { getApps, initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { isPublicEvent, type KompariEventDoc } from "@/lib/events";

// Named app, kept separate from the client app in lib/firebase.ts, so this module
// never shares an app instance with client-only code (auth, onSnapshot listeners, etc).
const SERVER_APP_NAME = "kompari-server";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getServerFirestore() {
  const existing = getApps().find((app) => app.name === SERVER_APP_NAME);
  const app = existing ?? initializeApp(firebaseConfig, SERVER_APP_NAME);
  return getFirestore(app);
}

export type EventMetadataSource = {
  title: string;
};

// event本体フィールドのみを1回読む。predictions は読まない。
// manual-fixture(sample)は null を返し、呼び出し側で汎用metadataにフォールバックさせる。
// 環境変数不足・取得失敗時も throw せず null を返す。
export async function getEventMetadataSource(
  slug: string
): Promise<EventMetadataSource | null> {
  try {
    const db = getServerFirestore();
    const snapshot = await getDoc(doc(db, "events", slug));

    if (!snapshot.exists()) return null;

    const data = snapshot.data() as KompariEventDoc;

    if (!isPublicEvent(data)) return null;
    if (!data.title) return null;

    return { title: data.title };
  } catch (error) {
    console.error(
      `[firebase-server] failed to fetch event metadata for slug=${slug}:`,
      error
    );
    return null;
  }
}
