const getEmailConfig = () => {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM || "Campus Connect <noreply@campus-connect.com.ng>";

  if (!apiKey) {
    const error = new Error("Resend API key is not configured.");
    error.code = "EMAIL_CONFIG_MISSING";
    throw error;
  }

  return { apiKey, from };
};

export const logEmailDeliveryFailure = (purpose, error) => {
  const safePurpose = ["signup", "reset", "email_change"].includes(purpose)
    ? purpose
    : "unknown";

  const safeCode =
    typeof error?.code === "string" && /^[A-Z0-9_-]{1,32}$/.test(error.code)
      ? error.code
      : "UNKNOWN";

  const statusCode = Number.isInteger(error?.statusCode)
    ? error.statusCode
    : undefined;

  console.error("Email delivery failed", {
    purpose: safePurpose,
    code: safeCode,
    ...(statusCode ? { statusCode } : {}),
  });
};

const buildEmailHtml = ({ purpose, otp, expiresInMinutes }) => {
  const title =
    purpose === "signup"
      ? "Verify your Campus Connect account"
      : purpose === "email_change"
        ? "Verify your new Campus Connect email"
      : "Reset your Campus Connect password";

  const actionText =
    purpose === "signup"
      ? "verify your email address"
      : purpose === "email_change"
        ? "confirm your new email address"
        : "reset your password";

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
      </head>

      <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">

          <div style="background:linear-gradient(135deg,#1d4ed8,#0f172a);padding:24px 32px;color:#ffffff;">
            <h1 style="margin:0;font-size:28px;">Campus Connect</h1>
          </div>

          <div style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;">Hello,</p>

            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
              Use the verification code below to ${actionText}.
            </p>

            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
              <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#1e3a8a;margin-bottom:12px;">
                Your code
              </div>

              <div style="font-size:38px;font-weight:700;letter-spacing:8px;color:#0f172a;">
                ${otp}
              </div>
            </div>

            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">
              This code expires in ${expiresInMinutes} minutes. Do not share it with anyone.
            </p>

            <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">
              If you did not request this, ignore this email. No changes will be made to your account.
            </p>
          </div>

          <div style="padding:0 32px 28px;font-size:12px;color:#64748b;text-align:center;">
            Campus Connect • Secure student communication
          </div>

        </div>
      </body>
    </html>
  `;
};

export const sendOtpEmail = async ({ to, otp, purpose, expiresInMinutes }) => {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to))) {
    const error = new Error("A valid recipient email is required.");
    error.code = "EMAIL_INVALID_RECIPIENT";
    throw error;
  }

  const { apiKey, from } = getEmailConfig();

  const subject =
    purpose === "signup"
      ? "Verify your Campus Connect account"
      : purpose === "email_change"
        ? "Verify your new Campus Connect email"
      : "Campus Connect password reset code";

  const text = [
    "Campus Connect",
    "",
    purpose === "signup"
      ? "Use this code to verify your email address:"
      : purpose === "email_change"
        ? "Use this code to confirm your new email address:"
        : "Use this code to reset your password:",
    `Code: ${otp}`,
    `This code expires in ${expiresInMinutes} minutes.`,
    "Do not share this code with anyone.",
    "",
    "If you did not request this email, ignore it.",
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [String(to).trim().toLowerCase()],
        subject,
        text,
        html: buildEmailHtml({ purpose, otp, expiresInMinutes }),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(
        data.message || "Resend could not deliver the email.",
      );

      error.code = "RESEND_API_ERROR";
      error.statusCode = response.status;

      throw error;
    }

    if (!data.id) {
      const error = new Error("Resend did not return an email ID.");
      error.code = "RESEND_INVALID_RESPONSE";
      throw error;
    }

    return true;
  } catch (error) {
    logEmailDeliveryFailure(purpose, error);
    throw error;
  }
};
