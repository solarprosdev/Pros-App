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
  return Boolean(apiKey && apiKey.length > 10);
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  if (!apiKey || apiKey.length < 10) {
    throw new Error("SENDGRID_API_KEY is not set or invalid");
  }

  // If a dynamic template ID is configured, use it. Pass the code under many possible
  // variable names so the template shows it. If yours uses something else, set
  // SENDGRID_TEMPLATE_CODE_VAR in .env.local to that name (e.g. SENDGRID_TEMPLATE_CODE_VAR=loginCode).
  const codeVar = process.env.SENDGRID_TEMPLATE_CODE_VAR;
  const templateData: Record<string, string> = {
    code,
    verificatio: code,
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
  if (TEMPLATE_ID_LOGIN) {
    await sgMail.send({
      to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: SUBJECT_LOGIN,
      templateId: TEMPLATE_ID_LOGIN,
      dynamicTemplateData: templateData,
    });
    return;
  }

  // Fallback: simple subject + text/html email.
  await sgMail.send({
    to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject: "Your login code – Sales Rep Portal",
    text: `Your login code is: ${code}\n\nIt expires in 10 minutes.`,
    html: `<p>Your login code is: <strong>${code}</strong></p><p>It expires in 10 minutes.</p>`,
  });
}
