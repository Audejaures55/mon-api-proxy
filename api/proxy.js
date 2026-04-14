import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const path = req.url.replace("/api/proxy", "/api/1.0");
    const revolutUrl = `https://merchant.revolut.com${path}`;

    const response = await fetch(revolutUrl, {
      method: req.method,
      headers: {
        "Authorization": `Bearer ${process.env.REVOLUT_API_KEY}`,
        "Content-Type": "application/json"
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
}
