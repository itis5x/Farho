"use server";

import { revalidatePath } from "next/cache";
import { requireStore } from "@/lib/auth";
import { setStoreSecret } from "@/lib/data";
import { getSms, nepaliMobile, sendSms, type SmsSettings } from "@/lib/sms";
import type { FormState } from "@/lib/types";

export async function saveSms(storeId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId, "owner");
  const current = await getSms(store.id);
  if (form.get("disconnect") === "1") {
    await setStoreSecret(store.id, "sms", null);
    revalidatePath(`/dashboard/${store.id}/settings`);
    return { ok: "SMS notifications turned off." };
  }
  const provider = form.get("provider") === "aakash" ? "aakash" : "sparrow";
  const token = String(form.get("token") ?? "").trim() || current?.token || "";
  if (!token) return { error: "Enter your SMS API token." };
  const settings: SmsSettings = {
    provider,
    token,
    sender: String(form.get("sender") ?? "").trim().slice(0, 20),
    events: { placed: form.get("placed") === "on", shipped: form.get("shipped") === "on", delivered: form.get("delivered") === "on" },
  };
  const test = String(form.get("test_to") ?? "").trim();
  if (test) {
    const to = nepaliMobile(test);
    if (!to) return { error: "Test number must be a Nepali mobile number (98XXXXXXXX)." };
    try {
      await sendSms(settings, to, `${store.name}: SMS notifications are working! 🎉`);
    } catch (e) {
      return { error: `The SMS gateway said: ${(e as Error).message}` };
    }
  }
  await setStoreSecret(store.id, "sms", settings);
  revalidatePath(`/dashboard/${store.id}/settings`);
  return { ok: test ? "Saved, and a test SMS was sent." : "SMS settings saved." };
}
