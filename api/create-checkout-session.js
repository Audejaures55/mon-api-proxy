/**
 * POST /api/create-checkout-session
 * Body JSON: { firstName, lastName, amountEuros | amount, currency? }
 * Crée une commande Revolut (montant choisi par le client) et renvoie public_id.
 */
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const apiKey = process.env.REVOLUT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Configuration serveur incomplète." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      body = {};
    }
  }
  if (!body || typeof body !== "object") body = {};

  const firstName = String(body.firstName ?? "").trim().slice(0, 80);
  const lastName = String(body.lastName ?? "").trim().slice(0, 80);
  const currency = String(body.currency ?? "EUR")
    .trim()
    .toUpperCase()
    .slice(0, 3);

  const rawAmount = body.amountEuros ?? body.amount;
  let amountEuros;
  if (typeof rawAmount === "string") {
    amountEuros = parseFloat(rawAmount.replace(/\s/g, "").replace(",", "."));
  } else {
    amountEuros = Number(rawAmount);
  }

  const minEur = Number(process.env.CHECKOUT_MIN_EUROS ?? 0.5);
  const maxEur = Number(process.env.CHECKOUT_MAX_EUROS ?? 50000);

  if (!firstName || !lastName) {
    return res.status(400).json({ error: "Le prénom et le nom sont obligatoires." });
  }

  if (
    !Number.isFinite(amountEuros) ||
    amountEuros < minEur ||
    amountEuros > maxEur
  ) {
    return res.status(400).json({
      error: `Indiquez un montant entre ${minEur} et ${maxEur} €.`,
    });
  }

  const amountCents = Math.round(amountEuros * 100);
  if (amountCents < 50) {
    return res.status(400).json({ error: "Montant minimum : 0,50 €." });
  }

  const description = `Agent Pulse — ${firstName} ${lastName}`.slice(0, 255);

  try {
    const response = await fetch("https://merchant.revolut.com/api/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountCents,
        currency: currency || "EUR",
        capture_mode: "AUTOMATIC",
        description,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.public_id) {
      const msg =
        typeof data.message === "string"
          ? data.message.replace(/\brevolut\b/gi, "le service de paiement")
          : "Impossible de préparer le paiement.";
      return res.status(response.status >= 400 ? response.status : 502).json({
        error: msg.length > 180 ? "Impossible de préparer le paiement." : msg,
      });
    }

    return res.status(200).json({
      public_id: data.public_id,
      amountCents,
      currency: currency || "EUR",
      description,
    });
  } catch {
    return res.status(502).json({ error: "Service temporairement indisponible." });
  }
}
