import "server-only";
import { InputFile } from "node-appwrite/file";
import { appwriteConfig, ID, storage } from "./appwrite";
import { BUCKET_ID } from "./appwrite-schema";

const ALLOWED: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Resolves an image field from a form: an uploaded file wins (stored in Appwrite Storage),
 * otherwise the URL text field is used, otherwise the current value is kept.
 */
export async function resolveImage(form: FormData, field: string, current = ""): Promise<string> {
  const file = form.get(`${field}_file`);
  if (file instanceof File && file.size > 0) {
    const ext = ALLOWED[file.type];
    if (!ext) throw new Error("Images must be PNG, JPG, WEBP or GIF.");
    if (file.size > MAX_BYTES) throw new Error("Images must be smaller than 4 MB.");
    const id = ID.unique();
    await storage.createFile({
      bucketId: BUCKET_ID,
      fileId: id,
      file: InputFile.fromBuffer(new Uint8Array(await file.arrayBuffer()), `${id}${ext}`),
    });
    return `${appwriteConfig.endpoint}/storage/buckets/${BUCKET_ID}/files/${id}/view?project=${appwriteConfig.projectId}`;
  }
  if (form.get(`${field}_clear`) === "1") return "";
  const url = String(form.get(field) ?? "").trim();
  if (url && !/^https?:\/\//.test(url)) throw new Error("Image URL must start with http:// or https://");
  return url || current;
}
