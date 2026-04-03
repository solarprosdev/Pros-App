import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;
if (apiKey) {
  sgMail.setApiKey(apiKey);
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "developer@solarpros.io";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "Sales Rep Portal";
const SUBJECT_LOGIN = process.env.SENDGRID_SUBJECT_LOGIN || "Verify your Pros App Portal login";
const TEMPLATE_ID_LOGIN = process.env.SENDGRID_TEMPLATE_ID_LOGIN;

export function isSendGridConfigured(): boolean {
  return Boolean(apiKey && apiKey.length > 10 && TEMPLATE_ID_LOGIN);
}

/**
 * Removes an email from SendGrid's bounce/block/spam suppression lists so
 * future sends are not silently dropped with "Bounced Address".
 */
async function clearSuppressions(email: string): Promise<void> {
  if (!apiKey) return;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const lists = ["bounces", "blocks", "spam_reports"] as const;

  await Promise.allSettled(
    lists.map((list) =>
      fetch(`https://api.sendgrid.com/v3/suppression/${list}/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers,
      })
    )
  );
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  if (!apiKey || apiKey.length < 10) {
    throw new Error("SENDGRID_API_KEY is not set or invalid");
  }

  // Clear any prior bounce/block/spam suppression so the email is not silently dropped.
  await clearSuppressions(to);

  const codeVar = process.env.SENDGRID_TEMPLATE_CODE_VAR;
  const templateData: Record<string, string> = {
    code,
    verification: code,
    verification_code: code,
    otp: code,
    token: code,
    verificationCode: code,
    login_code: code,
    loginCode: code,
    one_time_code: code,
    oneTimeCode: code,
    value: code,
    appName: FROM_NAME,
  };
  if (codeVar) {
    templateData[codeVar] = code;
  }
  if (!TEMPLATE_ID_LOGIN) {
    throw new Error("SENDGRID_TEMPLATE_ID_LOGIN is not set. A dynamic template is required.");
  }

  await sgMail.send({
    to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject: SUBJECT_LOGIN,
    templateId: TEMPLATE_ID_LOGIN,
    dynamicTemplateData: templateData,
  });
}
