"use server";

import { revalidatePath } from "next/cache";
import { requireStore } from "@/lib/auth";
import { getStoreSecret, setStoreSecret, updateStoreRow } from "@/lib/data";
import type { OwnEsewa, OwnKhalti } from "@/lib/payments/service";
import { getPaymentSettings, type GatewayMode, type PaymentSettings } from "@/lib/payments/settings";
import type { FormState } from "@/lib/types";
import { resolveImage } from "@/lib/uploads";

const str = (form: FormData, k: string, max = 500) => String(form.get(k) ?? "").trim().slice(0, max);
const on = (form: FormData, k: string) => form.get(k) === "on";
const mode = (form: FormData, k: string): GatewayMode => (form.get(k) === "own" ? "own" : "farho");

export async function savePayments(storeId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId);
  const current = getPaymentSettings(store);

  let qrImage: string;
  try {
    qrImage = await resolveImage(form, "qr_image", current.qr.image_url);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const next: PaymentSettings = {
    cod: { enabled: on(form, "cod_enabled"), label: str(form, "cod_label", 60) || "Cash on delivery" },
    esewa: { enabled: on(form, "esewa_enabled"), mode: mode(form, "esewa_mode") },
    khalti: { enabled: on(form, "khalti_enabled"), mode: mode(form, "khalti_mode") },
    qr: {
      enabled: on(form, "qr_enabled"),
      label: str(form, "qr_label", 80) || "Scan & pay",
      image_url: qrImage,
      instructions: str(form, "qr_instructions", 500),
    },
    bank: { enabled: on(form, "bank_enabled"), details: str(form, "bank_details", 600) },
  };

  if (!Object.values(next).some((m) => m.enabled)) return { error: "Turn on at least one payment method." };
  if (next.qr.enabled && !next.qr.image_url) return { error: "Upload your payment QR code to turn on QR payments." };
  if (next.bank.enabled && !next.bank.details) return { error: "Add your bank account details to turn on bank transfer." };

  // Own merchant credentials: only overwrite when new values are typed in.
  const esewaCode = str(form, "esewa_product_code", 60);
  const esewaSecret = str(form, "esewa_secret_key", 200);
  if (on(form, "esewa_clear")) await setStoreSecret(store.id, "esewa", null);
  else if (esewaCode && esewaSecret) {
    await setStoreSecret(store.id, "esewa", { product_code: esewaCode, secret_key: esewaSecret, live: on(form, "esewa_live") } satisfies OwnEsewa);
  }
  const khaltiSecret = str(form, "khalti_secret_key", 200);
  if (on(form, "khalti_clear")) await setStoreSecret(store.id, "khalti", null);
  else if (khaltiSecret) {
    await setStoreSecret(store.id, "khalti", { secret_key: khaltiSecret, live: on(form, "khalti_live") } satisfies OwnKhalti);
  }

  if (next.esewa.enabled && next.esewa.mode === "own" && !(await getStoreSecret(store.id, "esewa"))) {
    return { error: "Enter your eSewa merchant code and secret key, or switch eSewa to Farho Pay." };
  }
  if (next.khalti.enabled && next.khalti.mode === "own" && !(await getStoreSecret(store.id, "khalti"))) {
    return { error: "Enter your Khalti live secret key, or switch Khalti to Farho Pay." };
  }

  await updateStoreRow(store.id, { payments: JSON.stringify(next) });
  revalidatePath(`/dashboard/${store.id}`, "layout");
  revalidatePath(`/store/${store.slug}`, "layout");
  return { ok: "Payment settings saved." };
}
