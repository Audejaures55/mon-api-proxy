export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const apiKey = process.env.REVOLUT_API_KEY;
  // ON FORCE LA VERSION ICI DIRECTEMENT
  const apiVersion = "2023-09-01";

  if (!apiKey) {
    return res.status(500).json({ error: "Clé API Revolut manquante sur le serveur." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const amount = Number(body.amount);
  const currency = String(body.currency || "EUR").toUpperCase();

  if (!firstName || !lastName || !amount) {
    return res.status(400).json({ error: "Prénom, nom et montant sont obligatoires." });
  }

  const amountCents = Math.round(amount * 100);

  try {
    const response = await fetch("https://revolut.com", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Revolut-Api-Version": apiVersion,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountCents,
        currency: currency,
        capture_mode: "AUTOMATIC",
        description: `Agent Pulse - ${firstName} ${lastName}`
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.message || "Erreur Revolut." 
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({ error: "Lien avec Revolut impossible." });
  }
}
