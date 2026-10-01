import type { PaymentStart } from "@/lib/payments/service";

/** Sends the browser to the payment gateway. Returns an error message if it couldn't. */
export function goToPayment(p: PaymentStart): string | null {
  if (p.type === "redirect") {
    window.location.href = p.url;
    return null;
  }
  if (p.type === "form") {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = p.action;
    for (const [name, value] of Object.entries(p.fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    return null;
  }
  return p.message;
}
