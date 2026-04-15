import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

app.all("/api/1.0/{*path}", async (req, res) => {
  try {
    const revolutUrl = `https://merchant.revolut.com${req.originalUrl}`;

    const response = await fetch(revolutUrl, {
      method: req.method,
      headers: {
        "Authorization": `Bearer ${process.env.REVOLUT_API_KEY}`,
        "Content-Type": "application/json",
        "Revolut-Api-Version": "2023-09-01"
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

app.listen(3000, () => console.log("✅ Proxy lancé sur http://localhost:3000"));
