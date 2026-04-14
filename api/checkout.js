export default async function handler(req, res) {
  try {
    const { amount, currency = "EUR", description = "Paiement" } = req.query;

    if (!amount) {
      return res.status(400).send("Paramètre amount manquant");
    }

    const response = await fetch("https://merchant.revolut.com/api/orders", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.REVOLUT_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: Number(amount),
        currency: currency,
        capture_mode: "AUTOMATIC"
      })
    });

    const data = await response.json();

    if (!data.public_id) {
      return res.status(500).send("Erreur Revolut : public_id manquant");
    }

    const publicId = data.public_id;
    const currencySymbol = currency === "EUR" ? "€" : "$";
    const formattedAmount = (Number(amount) / 100).toFixed(2);

    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Paiement sécurisé</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      background: #0b0d14;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      font-family: 'Inter', sans-serif;
    }
    .card {
      background: #13161f;
      border: 0.5px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      width: 100%;
      max-width: 420px;
      padding: 2rem;
    }
    .header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding-bottom: 1.5rem;
      margin-bottom: 1.5rem;
      border-bottom: 0.5px solid rgba(255,255,255,0.07);
    }
    .logo-wrap {
      width: 56px; height: 56px;
      background: #1a2233;
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
    }
    .brand-name { font-size: 14px; font-weight: 500; color: #ffffff; letter-spacing: 0.04em; }
    .brand-url { font-size: 12px; color: rgba(255,255,255,0.35); }
    .amount-block { text-align: center; margin-bottom: 1.5rem; }
    .amount-label { font-size: 12px; color: rgba(255,255,255,0.35); margin-bottom: 4px; }
    .amount-value { font-size: 36px; font-weight: 500; color: #ffffff; margin: 4px 0; }
    .amount-desc { font-size: 13px; color: rgba(255,255,255,0.4); margin-top: 4px; }
    .loading-box {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 12px; padding: 2rem 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner {
      width: 28px; height: 28px;
      border: 2px solid rgba(106,174,237,0.15);
      border-top: 2px solid #6aaeed;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .loading-text { font-size: 13px; color: rgba(255,255,255,0.3); }
    .security-row {
      display: flex; align-items: center;
      justify-content: center; gap: 6px; margin-top: 1.25rem;
    }
    .security-text { font-size: 11px; color: rgba(255,255,255,0.22); }
    .error-text { font-size: 13px; color: #e24b4a; text-align: center; padding: 0.5rem 0; }
    [data-testid="revolut-pay-button"],
    .rp-button, button[class*="revolut"], [class*="RevolutPay"] {
      display: none !important;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-wrap">
        <svg width="34" height="34" viewBox="0 0 100 100" fill="none">
          <rect x="8" y="8" width="55" height="55" rx="14" fill="#6aaeed"/>
          <rect x="18" y="18" width="28" height="28" rx="7" fill="#0f1117"/>
          <rect x="8" y="70" width="18" height="18" rx="4" fill="#6aaeed"/>
          <rect x="32" y="70" width="18" height="18" rx="4" fill="#6aaeed"/>
          <rect x="70" y="8" width="18" height="55" rx="9" fill="#6aaeed"/>
        </svg>
      </div>
      <div style="text-align:center">
        <p class="brand-name">VELOURA STORE LTD</p>
        <p class="brand-url">agent-pulse.io</p>
      </div>
    </div>
    <div class="amount-block">
      <p class="amount-label">Montant à payer</p>
      <p class="amount-value">${currencySymbol}${formattedAmount}</p>
      <p class="amount-desc">${description}</p>
    </div>
    <div class="loading-box" id="loading">
      <div class="spinner"></div>
      <span class="loading-text">Chargement sécurisé...</span>
    </div>
    <div id="error-box" style="display:none">
      <p class="error-text" id="error-msg"></p>
    </div>
    <div id="revolut-widget-container" style="display:none"></div>
    <div class="security-row" id="security-row" style="display:none">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
        stroke="rgba(255,255,255,0.22)" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      <span class="security-text">Paiement sécurisé · SSL 256-bit</span>
    </div>
  </div>
  <script>
    const PUBLIC_ID = "${publicId}";
    function showError(msg) {
      document.getElementById("loading").style.display = "none";
      document.getElementById("error-box").style.display = "block";
      document.getElementById("error-msg").textContent = msg;
    }
    const script = document.createElement("script");
    script.src = "https://merchant.revolut.com/embed.js";
    script.async = true;
    script.onerror = () => showError("Impossible de charger le paiement. Réessayez.");
    script.onload = () => {
      try {
        RevolutCheckout(PUBLIC_ID).payments({
          target: document.getElementById("revolut-widget-container"),
          hidePaymentMethods: ["revolut_pay"],
          locale: "fr",
          onSuccess() { window.location.href = "/success"; },
          onError(message) { showError(message); }
        });
        document.getElementById("loading").style.display = "none";
        document.getElementById("revolut-widget-container").style.display = "block";
        document.getElementById("security-row").style.display = "flex";
      } catch(e) {
        showError("Impossible d'initialiser le paiement. Réessayez.");
      }
    };
    document.body.appendChild(script);
  </script>
</body>
</html>`);

  } catch (error) {
    return res.status(500).send("Erreur serveur : " + error.message);
  }
}
