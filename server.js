import express from "express";
import dotenv from "dotenv";
dotenv.config();

// Import des handlers (Vercel-style)
import checkoutHandler from "./api/checkout.js";
import createCheckoutSessionHandler from "./api/create-checkout-session.js";

const app = express();
app.use(express.json());

// ─── Redirection racine vers /checkout ────────────────────────────────────────
app.get("/", (req, res) => {
  res.redirect(302, "/checkout");
});

// ─── Page de checkout (HTML) ──────────────────────────────────────────────────
app.get("/checkout", (req, res) => {
  checkoutHandler(req, res);
});

// ─── API : Créer une session de paiement ──────────────────────────────────────
app.post("/api/create-checkout-session", (req, res) => {
  createCheckoutSessionHandler(req, res);
});

// ─── Proxy Revolut : toutes les routes /api/1.0/* ────────────────────────────
app.all("/api/1.0/*path", async (req, res) => {
  try {
    const revolutUrl = `https://merchant.revolut.com${req.originalUrl}`;
    const response = await fetch(revolutUrl, {
      method: req.method,
      headers: {
        "Authorization": `Bearer ${process.env.REVOLUT_API_KEY}`,
        "Content-Type": "application/json",
        "Revolut-Api-Version": process.env.REVOLUT_API_VERSION || "2025-12-04"
      },
      body: ["POST", "PUT", "PATCH"].includes(req.method)
        ? JSON.stringify(req.body)
        : undefined
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur proxy" });
  }
});

// ─── Démarrage ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Serveur lancé → http://localhost:${PORT}`);
  console.log(`   • Checkout   : http://localhost:${PORT}/checkout`);
  console.log(`   • API session: http://localhost:${PORT}/api/create-checkout-session`);
});
