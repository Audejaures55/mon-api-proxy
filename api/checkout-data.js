import { fetchOrderMeta } from "../lib/revolut-order-meta.js";

/**
 * GET /api/checkout-data?public_id=…
 * Données produit pour la page de paiement (sans clé côté client).
 */
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const publicId = req.query.public_id;
  if (!publicId || typeof publicId !== "string") {
    return res.status(400).json({ error: "public_id requis" });
  }

  const apiKey = process.env.REVOLUT_API_KEY;
  const result = await fetchOrderMeta(publicId.trim(), apiKey);

  if (!result.ok) {
    return res.status(result.status || 502).json({
      error: result.error || "Données de commande indisponibles",
    });
  }

  const { productName, description, amountCents, currency, customerEmail } =
    result.data;

  return res.status(200).json({
    productName,
    description,
    amountCents,
    currency,
    customerEmail,
  });
}
