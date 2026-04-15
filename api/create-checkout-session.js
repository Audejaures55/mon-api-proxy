async function readJsonBody(req) {
  // Cas 1 : Vercel / Express ont déjà parsé le body en objet
  if (req.body !== null && req.body !== undefined && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  // Cas 2 : body est un Buffer (ancienne runtime Vercel)
  if (Buffer.isBuffer(req.body)) {
    try { return JSON.parse(req.body.toString("utf8")); } catch { return {}; }
  }

  // Cas 3 : body est déjà une chaîne JSON
  if (typeof req.body === "string" && req.body.trim()) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }

  // Cas 4 : body non encore lu — on streame (fallback Node.js)
  if (typeof req.on === "function") {
    return new Promise((resolve) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8").trim();
        try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
      });
      req.on("error", () => resolve({}));
    });
  }

  return {};
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const apiKey = process.env.REVOLUT_API_KEY;
  const apiVersion = process.env.REVOLUT_API_VERSION || "2025-12-04";
  const isSandbox = (process.env.REVOLUT_ENV || "").toLowerCase() === "sandbox";
  const revolutBaseUrl = isSandbox
    ? "https://sandbox-merchant.revolut.com"
    : "https://merchant.revolut.com";

  if (!apiKey) {
    console.error("[checkout] ❌ REVOLUT_API_KEY manquante dans .env");
    return res.status(500).json({ error: "Configuration serveur incomplète." });
  }
  console.log(`[checkout] 🔑 Clé: ${apiKey.slice(0, 12)}... | Env: ${isSandbox ? "sandbox" : "production"} | URL: ${revolutBaseUrl}`);

  let body = await readJsonBody(req);
  if (!body || typeof body !== "object") {
    body = {};
  }
  console.log("[checkout] 📦 Body reçu:", JSON.stringify(body));

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
    const response = await fetch(`${revolutBaseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Revolut-Api-Version": apiVersion,
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
      console.error(`[checkout] ❌ Revolut ${response.status}:`, JSON.stringify(data));
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
