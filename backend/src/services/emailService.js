import nodemailer from "nodemailer";

const getTransporter = () => {
  const { EMAIL_USER, EMAIL_APP_PASSWORD, EMAIL_FROM } = process.env;

  if (!EMAIL_USER || !EMAIL_APP_PASSWORD) {
    throw new Error("Email delivery is not configured");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_APP_PASSWORD,
    },
  });
};

const buildEmailHtml = ({ purpose, otp, expiresInMinutes }) => {
  const title =
    purpose === "signup"
      ? "Verify your Campus Connect account"
      : "Reset your Campus Connect password";

  const actionText =
    purpose === "signup"
      ? "Verify your email address"
      : "Reset your password";

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
      </head>
      <body style="margin:0; padding:0; background:#f3f6fb; font-family:Arial, sans-serif; color:#0f172a;">
        <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0;">
          <div style="background:linear-gradient(135deg, #1d4ed8, #0f172a); padding:24px 32px; color:#ffffff;">
            <h1 style="margin:0; font-size:28px;">Campus Connect</h1>
          </div>
          <div style="padding:32px;">
            <p style="margin:0 0 16px; font-size:16px;">Hello,</p>
            <p style="margin:0 0 16px; font-size:16px; line-height:1.6;">
              Use the verification code below to ${actionText.toLowerCase()}.
            </p>
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:24px; text-align:center; margin:20px 0;">
              <div style="font-size:12px; letter-spacing:2px; text-transform:uppercase; color:#1e3a8a; margin-bottom:12px;">Your code</div>
              <div style="font-size:38px; font-weight:700; letter-spacing:8px; color:#0f172a;">${otp}</div>
            </div>
            <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
              This code expires in ${expiresInMinutes} minutes. Do not share it with anyone.
            </p>
            <p style="margin:0; font-size:14px; line-height:1.6; color:#475569;">
              If you did not request this, ignore this email and no changes will be made to your account.
            </p>
          </div>
          <div style="padding:0 32px 28px; font-size:12px; color:#64748b; text-align:center;">
            Campus Connect • Secure student communication
          </div>
        </div>
      </body>
    </html>
  `;
};

export const sendOtpEmail = async ({ to, otp, purpose, expiresInMinutes }) => {
  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  const result = await transporter.sendMail({
    from,
    to,
    subject:
      purpose === "signup"
        ? "Verify your Campus Connect account"
        : "Campus Connect password reset code",
    text: [
      "Campus Connect",
      "",
      purpose === "signup"
        ? "Use this code to verify your email address:"
        : "Use this code to reset your password:",
      `Code: ${otp}`,
      `This code expires in ${expiresInMinutes} minutes.`,
      "Do not share this code with anyone.",
      "",
      "If you did not request this email, ignore it.",
    ].join("\n"),
    html: buildEmailHtml({ purpose, otp, expiresInMinutes }),
  });

  const acceptedAddresses = Array.isArray(result.accepted)
    ? result.accepted.map((address) =>
        typeof address === "string" ? address.toLowerCase() : "",
      )
    : [];

  if (
    !acceptedAddresses.includes(String(to).trim().toLowerCase()) ||
    result.rejected?.some(
      (address) =>
        typeof address === "string" &&
        address.toLowerCase() === String(to).trim().toLowerCase(),
    )
  ) {
    const error = new Error("SMTP did not accept the OTP recipient.");
    error.code = "EMAIL_RECIPIENT_NOT_ACCEPTED";
    throw error;
  }

  return true;
};
