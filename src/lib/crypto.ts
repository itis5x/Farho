import "server-only";
import crypto from "node:crypto";

// SECRETS_KEY should be 32+ random characters. Falls back to a key derived from the Appwrite API key so the app
// still works out of the box, but set SECRETS_KEY in production so rotating the API key doesn't lose secrets.
function key() {
  const material = process.env.SECRETS_KEY || `farho:${process.env.APPWRITE_API_KEY ?? ""}`;
  return crypto.createHash("sha256").update(material).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function decrypt(token: string): string {
  const [v, iv, tag, data] = token.split(".");
  if (v !== "v1") throw new Error("Unknown secret format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

/** Shows only the last few characters of a secret, e.g. "••••••f3a9". */
export function mask(secret: string): string {
  return secret ? `••••••${secret.slice(-4)}` : "";
}
