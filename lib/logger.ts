import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export type LogType =
  | "LOGIN_REQUEST"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "PROFILE_SAVE"
  | "RAMP_SYNC"
  | "MAKE_WEBHOOK";

export interface LogEntry {
  id: string;
  type: LogType;
  email: string;
  details: string;
  success: boolean;
  metadata: Record<string, unknown> | null;
  timestamp: Timestamp | null;
}

export async function logEvent(
  type: LogType,
  email: string,
  details: string,
  success: boolean,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!db) {
    console.warn("[Logger] Firebase not initialized – skipping log:", type, email);
    return;
  }
  try {
    await addDoc(collection(db, "logs"), {
      type,
      email,
      details,
      success,
      metadata: metadata ?? null,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("[Logger] Failed to write log to Firebase:", err);
  }
}

export async function getLogs(limitCount = 200): Promise<LogEntry[]> {
  if (!db) {
    console.warn("[Logger] Firebase not initialized – cannot fetch logs");
    return [];
  }
  try {
    const q = query(
      collection(db, "logs"),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<LogEntry, "id">),
    }));
  } catch (err) {
    console.error("[Logger] Failed to fetch logs from Firebase:", err);
    return [];
  }
}
