async function readJsonBody(req) {
  // Cas 1 : déjà parsé en objet (Express / Vercel runtime récent)
  if (req.body !== null && req.body !== undefined && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  // Cas 2 : Buffer
  if (Buffer.isBuffer(req.body)) {
    try { return JSON.parse(req.body.toString("utf8")); } catch { return {}; }
  }
  // Cas 3 : string
  if (typeof req.body === "string" && req.body.trim()) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  // Cas 4 : stream brut (Vercel sans body parser)
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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  // ── Clé API ───────────────────────────────────────────────────────────────
  const apiKey = process.env.REVOLUT_API_KEY;
  if (!apiKey) {
    console.error("[checkout] ❌ REVOLUT_API_KEY manquante");
    return res.status(500).json({ error: "Configuration serveur incomplète : clé API manquante." });
  }

  const apiVersion = process.env.REVOLUT_API_VERSION || "2024-09-01";
  const isSandbox  = (process.env.REVOLUT_ENV || "").toLowerCase() === "sandbox";
  const baseUrl    = isSandbox
    ? "https://sandbox-merchant.revolut.com"
    : "https://merchant.revolut.com";

  console.log(`[checkout] 🔑 Clé: ${apiKey.slice(0, 10)}... | Mode: ${isSandbox ? "SANDBOX" : "PROD"} | API: ${apiVersion}`);

  // ── Lecture du body ───────────────────────────────────────────────────────
  let body = await readJsonBody(req);
  if (!body || typeof body !== "object") body = {};
  console.log("[checkout] 📦 Body:", JSON.stringify(body));

  // ── Validation ────────────────────────────────────────────────────────────
  const firstName = String(body.firstName ?? "").trim().slice(0, 80);
  const lastName  = String(body.lastName  ?? "").trim().slice(0, 80);
  const currency  = String(body.currency  ?? "EUR").trim().toUpperCase().slice(0, 3);

  const rawAmount = body.amountEuros ?? body.amount;
  let amountEuros = typeof rawAmount === "string"
    ? parseFloat(rawAmount.replace(/\s/g, "").replace(",", "."))
    : Number(rawAmount);

  const minEur = Number(process.env.CHECKOUT_MIN_EUROS ?? 0.5);
  const maxEur = Number(process.env.CHECKOUT_MAX_EUROS ?? 50000);

  if (!firstName || !lastName) {
    return res.status(400).json({ error: "Le prénom et le nom sont obligatoires." });
  }
  if (!Number.isFinite(amountEuros) || amountEuros < minEur || amountEuros > maxEur) {
    return res.status(400).json({ error: `Montant invalide (entre ${minEur} et ${maxEur} €).` });
  }

  const amountCents = Math.round(amountEuros * 100);
  if (amountCents < 50) {
    return res.status(400).json({ error: "Montant minimum : 0,50 €." });
  }

  const description = `Agent Pulse — ${firstName} ${lastName}`.slice(0, 255);

  // ── Appel Revolut ─────────────────────────────────────────────────────────
  const requestBody = {
    amount: amountCents,
    currency,
    description,
  };
  console.log("[checkout] 🌐 Requête Revolut:", JSON.stringify(requestBody));

  try {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Authorization":        `Bearer ${apiKey}`,
        "Revolut-Api-Version":  apiVersion,
        "Content-Type":         "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const rawText = await response.text();
    console.log(`[checkout] 📡 Revolut ${response.status}: ${rawText}`);

    let data = {};
    try { data = JSON.parse(rawText); } catch { /* non-JSON */ }

    // L'API 2024-09-01 retourne 'token', les versions antérieures 'public_id'
    const publicId = data.public_id || data.token;

    if (!response.ok || !publicId) {
      const revolut_error = data.message || data.error || rawText || "Erreur inconnue Revolut";
      console.error(`[checkout] ❌ Pas de public_id/token. Revolut ${response.status}:`, revolut_error);
      return res.status(502).json({
        error: `Revolut: ${revolut_error}`,
        revolut_status: response.status,
        revolut_code: data.code ?? null,
      });
    }

    console.log(`[checkout] ✅ OK! public_id/token: ${publicId}`);
    return res.status(200).json({
      public_id:    publicId,
      checkout_url: data.checkout_url || null,
      amountCents,
      currency,
      description,
    });

  } catch (err) {
    console.error("[checkout] 💥 Exception:", err.message);
    return res.status(502).json({ error: `Erreur réseau : ${err.message}` });
  }
}
