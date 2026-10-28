import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(scriptDirectory, "..");
const envPath = path.join(backendDirectory, ".env");

let backendEnv;
try {
  backendEnv = dotenv.parse(await readFile(envPath));
} catch {
  console.error(`Email test failed: could not read ${envPath}.`);
  process.exitCode = 1;
}

const safeAddress = (address) => {
  const [localPart, domain] = String(address).split("@");
  if (!localPart || !domain) return "[redacted]";
  return `${localPart.slice(0, 1)}***@${domain}`;
};

const explainFailure = (error) => {
  switch (error.code) {
    case "EAUTH":
      return "Gmail rejected authentication. Check EMAIL_USER and confirm EMAIL_APP_PASSWORD is a valid Gmail App Password.";
    case "ETIMEDOUT":
    case "ESOCKET":
    case "ECONNECTION":
      return "Could not establish the Gmail SMTP connection. Check network access and whether outbound SMTP is available.";
    case "EENVELOPE":
      return "Gmail rejected the sender or recipient address. Check EMAIL_FROM and EMAIL_USER.";
    default:
      if (Number.isInteger(error.responseCode) && error.responseCode >= 500) {
        return "Gmail rejected the message. Check the sender configuration and Gmail account restrictions.";
      }
      if (Number.isInteger(error.responseCode) && error.responseCode >= 400) {
        return "Gmail temporarily rejected the message. Try again later and check Gmail sending limits.";
      }
      return "The SMTP test failed. Check the backend environment configuration and Gmail account status.";
  }
};

if (process.env.NODE_ENV === "production") {
  console.error("Email test refused: this development utility cannot run in production.");
  process.exitCode = 1;
} else if (!backendEnv) {
  process.exitCode = 1;
} else if (!backendEnv.EMAIL_USER || !backendEnv.EMAIL_APP_PASSWORD) {
  console.error(
    `Email test failed: EMAIL_USER or EMAIL_APP_PASSWORD is missing in ${envPath}.`,
  );
  process.exitCode = 1;
} else {
  const port = 465;
  const transporter = nodemailer.createTransport({
    service: "gmail",
    secure: true,
    port,
    auth: {
    user: backendEnv.EMAIL_USER,
    pass: backendEnv.EMAIL_APP_PASSWORD,
    },
  });

  try {
    await transporter.sendMail({
    from: backendEnv.EMAIL_FROM || backendEnv.EMAIL_USER,
    to: backendEnv.EMAIL_USER,
      subject: "Campus Connect SMTP test",
      text: "This is a test email from the Campus Connect backend SMTP configuration.",
    });

    console.log(
    `SMTP test succeeded. A test email was accepted for delivery to ${safeAddress(backendEnv.EMAIL_USER)}.`,
    );
  } catch (error) {
    const code = /^[A-Z0-9_-]{1,32}$/.test(error.code || "")
      ? error.code
      : "UNKNOWN";
    const responseCode = Number.isInteger(error.responseCode)
      ? ` (SMTP response ${error.responseCode})`
      : "";

    console.error(`SMTP test failed [${code}]${responseCode}.`);
    console.error(explainFailure(error));
    process.exitCode = 1;
  } finally {
    transporter.close();
  }
}
