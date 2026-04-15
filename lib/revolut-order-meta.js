/**
 * Récupère les métadonnées d'une commande pour l'affichage checkout.
 * Essaye plusieurs chemins API (versions Revolut / legacy).
 * @param {string} orderKey — public_id / token renvoyé à la création, ou id UUID de commande
 */
export async function fetchOrderMeta(orderKey, apiKey) {
  if (!orderKey || !apiKey) {
    return { ok: false, status: 400, error: "Configuration ou identifiant manquant" };
  }

  const enc = encodeURIComponent(orderKey);
  const attempts = [
    {
      url: `https://merchant.revolut.com/api/1.0/orders/${enc}`,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Revolut-Api-Version": "2025-12-04",
      },
    },
    {
      url: `https://merchant.revolut.com/api/1.0/orders/${enc}`,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Revolut-Api-Version": "2024-05-01",
      },
    },
    {
      url: `https://merchant.revolut.com/api/orders/${enc}`,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  ];

  let lastErr = "Commande introuvable ou expirée";
  for (const { url, headers } of attempts) {
    try {
      const response = await fetch(url, { headers });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        return { ok: true, data: normalizeOrder(data), raw: data };
      }
      if (data?.message) lastErr = sanitizeExternalMessage(data.message);
    } catch {
      lastErr = "Service momentanément indisponible";
    }
  }

  return { ok: false, status: 404, error: lastErr };
}

function sanitizeExternalMessage(msg) {
  const s = String(msg).replace(/\brevolut\b/gi, "le processeur de paiement");
  return s.length > 200 ? "Impossible de charger la commande." : s;
}

function normalizeOrder(raw) {
  const currency =
    raw.order_amount?.currency ||
    raw.currency ||
    raw.order_amount?.currency_code ||
    "EUR";

  let amountCents = 0;
  if (typeof raw.amount === "number" && Number.isFinite(raw.amount)) {
    amountCents = raw.amount;
  } else if (raw.order_amount?.value != null) {
    amountCents = Number(raw.order_amount.value);
  } else if (raw.amount?.value != null) {
    amountCents = Number(raw.amount.value);
  }

  const line = Array.isArray(raw.line_items) && raw.line_items[0];
  const productName =
    (line && line.name) ||
    raw.merchant_order_data?.description ||
    raw.description ||
    "Agent Pulse";

  const description =
    (line && (line.description || "")) ||
    (raw.description && raw.description !== productName ? raw.description : "") ||
    "";

  const customerEmail =
    raw.customer?.email ||
    raw.customer_email ||
    raw.email ||
    null;

  return {
    productName: String(productName).slice(0, 200),
    description: String(description).slice(0, 500),
    amountCents: Math.max(0, Math.round(amountCents)),
    currency,
    customerEmail,
  };
}
