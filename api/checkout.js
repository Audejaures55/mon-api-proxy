export default async function handler(req, res) {
  try {
    // ✅ API backend (POST) → création commande Revolut
    if (req.method === "POST") {
      const { amountEuros, currency = "EUR", firstName, lastName } = req.body;

      if (!amountEuros || isNaN(amountEuros) || Number(amountEuros) <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }

      const response = await fetch("https://merchant.revolut.com/api/orders", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.REVOLUT_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: Math.round(Number(amountEuros) * 100),
          currency,
          capture_mode: "AUTOMATIC",
          description: `Paiement ${firstName || ""} ${lastName || ""}`
        })
      });

      const data = await response.json();

      if (!data.public_id) {
        return res.status(500).json({ error: "Erreur Revolut" });
      }

      return res.status(200).json({ public_id: data.public_id });
    }

    // ❌ Bloquer autres méthodes sauf GET
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).send("Méthode non autorisée");
    }

    // ✅ CONFIG FRONT
    const bootstrap = {
      successUrlBase: process.env.CHECKOUT_SUCCESS_URL || "/success",
      presetMontant: "",
      minEur: 0.5,
      maxEur: 50000
    };

    res.setHeader("Content-Type", "text/html; charset=utf-8");

    return res.status(200).send(`
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Paiement sécurisé</title>
</head>

<body style="background:#0b0d14;color:white;font-family:sans-serif;text-align:center;padding:40px;">

<h2>Paiement sécurisé</h2>

<input id="amount" placeholder="Montant €" />
<br><br>
<button onclick="pay()">Payer</button>

<script>
async function pay(){
  const amount = document.getElementById("amount").value;

  const res = await fetch("", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ amountEuros: amount })
  });

  const data = await res.json();

  if(!data.public_id){
    alert("Erreur paiement");
    return;
  }

  const script = document.createElement("script");
  script.src = "https://merchant.revolut.com/embed.js";
  script.onload = () => {
    RevolutCheckout(data.public_id).payments({
      target: document.body,
      locale:"fr",
      onSuccess(){ window.location.href="/success"; }
    });
  };
  document.body.appendChild(script);
}
</script>

</body>
</html>
`);
  } catch (err) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
