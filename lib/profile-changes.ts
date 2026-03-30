import { joinFullName } from "@/lib/name-utils";

export interface ProfileSnapshot {
  bank: string;
  account: string;
  routing: string;
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
}

export interface ProfileChange {
  id: string;
  userEmail: string;
  timestamp: string;
  oldBankName: string;
  newBankName: string;
  oldAccountNumber: string;
  newAccountNumber: string;
  oldRoutingNumber: string;
  newRoutingNumber: string;
  oldEmail: string;
  newEmail: string;
  oldFullName: string;
  newFullName: string;
}

type FirestoreStringField = { stringValue?: string };

function s(val: string): FirestoreStringField {
  return { stringValue: val };
}

export async function writeProfileChange(
  userEmail: string,
  oldData: ProfileSnapshot,
  newData: ProfileSnapshot
): Promise<void> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!projectId || !apiKey) {
    console.warn("[VendorLog] Firebase env vars not set – skipping write");
    return;
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/vendor_details_logs?key=${apiKey}`;
  console.log("[VendorLog] POST to Firestore vendor_details_logs, project:", projectId);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          userEmail:         s(userEmail),
          timestamp:         { timestampValue: new Date().toISOString() },
          oldBankName:       s(oldData.bank),
          newBankName:       s(newData.bank),
          oldAccountNumber:  s(oldData.account),
          newAccountNumber:  s(newData.account),
          oldRoutingNumber:  s(oldData.routing),
          newRoutingNumber:  s(newData.routing),
          oldEmail:          s(oldData.email),
          newEmail:          s(newData.email),
          oldFullName:       s(joinFullName(oldData.firstName, oldData.middleName, oldData.lastName)),
          newFullName:       s(joinFullName(newData.firstName, newData.middleName, newData.lastName)),
        },
      }),
      cache: "no-store",
    });
    if (res.ok) {
      console.log("[VendorLog] Firestore write success – status:", res.status);
    } else {
      const text = await res.text();
      console.error("[VendorLog] Firestore write FAILED – status:", res.status, "| body:", text.slice(0, 400));
    }
  } catch (err) {
    console.error("[VendorLog] Firestore write exception:", err);
  }
}

type FirestoreDoc = {
  document?: {
    name?: string;
    fields?: Record<string, FirestoreStringField & { timestampValue?: string }>;
  };
};

export async function getProfileChanges(limit = 100): Promise<ProfileChange[]> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!projectId || !apiKey) return [];

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "vendor_details_logs" }],
          orderBy: [{ field: { fieldPath: "timestamp" }, direction: "DESCENDING" }],
          limit,
        },
      }),
      cache: "no-store",
    });

    const data = (await res.json()) as FirestoreDoc[];
    return data
      .filter((d) => !!d.document?.fields)
      .map((d) => {
        const f = d.document!.fields!;
        const docName = d.document!.name ?? "";
        const id = docName.split("/").pop() ?? "";
        const str = (key: string) => f[key]?.stringValue ?? "";
        return {
          id,
          userEmail:        str("userEmail"),
          timestamp:        (f["timestamp"] as { timestampValue?: string })?.timestampValue ?? "",
          oldBankName:      str("oldBankName"),
          newBankName:      str("newBankName"),
          oldAccountNumber: str("oldAccountNumber"),
          newAccountNumber: str("newAccountNumber"),
          oldRoutingNumber: str("oldRoutingNumber"),
          newRoutingNumber: str("newRoutingNumber"),
          oldEmail:         str("oldEmail"),
          newEmail:         str("newEmail"),
          oldFullName:      str("oldFullName"),
          newFullName:      str("newFullName"),
        };
      });
  } catch (err) {
    console.error("[VendorLog] Failed to fetch:", err);
    return [];
  }
}
