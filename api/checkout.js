export default async function handler(req, res) {
  try {
    // ─── Étape 1 : Le client soumet le montant via POST interne ───
    if (req.method === "POST") {
      const { amount, currency = "EUR", description = "Paiement" } = req.body;

      if (!amount || isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }

      const response = await fetch("https://merchant.revolut.com/api/orders", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.REVOLUT_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: Math.round(Number(amount) * 100), // convertir € en centimes
          currency: currency,
          capture_mode: "AUTOMATIC",
          description: description
        })
      });

      const data = await response.json();

      if (!data.public_id) {
        return res.status(500).json({ error: "Erreur Revolut : public_id manquant" });
      }

      return res.status(200).json({ public_id: data.public_id });
    }

    // ─── Étape 2 : Afficher la page HTML avec formulaire ───
    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Paiement sécurisé</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg: #080a10;
      --card: #0e1018;
      --border: rgba(255,255,255,0.07);
      --accent: #5b8dee;
      --accent-glow: rgba(91,141,238,0.18);
      --text: #f0f2f8;
      --muted: rgba(240,242,248,0.35);
      --error: #e05c5c;
      --success: #4ecca3;
    }

    body {
      min-height: 100vh;
      background: var(--bg);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      font-family: 'DM Sans', sans-serif;
      color: var(--text);
    }

    /* subtle grid background */
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image:
        linear-gradient(rgba(91,141,238,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(91,141,238,0.03) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
    }

    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      width: 100%;
      max-width: 440px;
      padding: 2.25rem 2rem;
      position: relative;
      overflow: hidden;
      animation: fadeUp 0.5s ease both;
    }

    /* top accent line */
    .card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 1.5rem;
      margin-bottom: 1.75rem;
      border-bottom: 1px solid var(--border);
    }

    .logo-wrap {
      width: 48px; height: 48px;
      background: rgba(91,141,238,0.08);
      border: 1px solid rgba(91,141,238,0.2);
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }

    .brand-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      letter-spacing: 0.02em;
    }

    .brand-url {
      font-size: 12px;
      color: var(--muted);
      margin-top: 2px;
      font-family: 'DM Mono', monospace;
    }

    /* ── Form ── */
    #form-section { animation: fadeUp 0.4s ease 0.1s both; }

    .field-label {
      font-size: 11px;
      font-weight: 500;
      color: var(--muted);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 8px;
      display: block;
    }

    .amount-input-wrap {
      display: flex;
      align-items: center;
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 0 16px;
      gap: 8px;
      transition: border-color 0.2s, box-shadow 0.2s;
      margin-bottom: 1rem;
    }

    .amount-input-wrap:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }

    .currency-badge {
      font-size: 15px;
      font-weight: 500;
      color: var(--accent);
      font-family: 'DM Mono', monospace;
      flex-shrink: 0;
    }

    #amount-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      font-size: 28px;
      font-weight: 500;
      font-family: 'DM Mono', monospace;
      color: var(--text);
      padding: 16px 0;
      width: 100%;
    }

    #amount-input::placeholder { color: rgba(255,255,255,0.12); }

    .desc-input {
      width: 100%;
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 16px;
      font-size: 14px;
      font-family: 'DM Sans', sans-serif;
      color: var(--text);
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      margin-bottom: 1.5rem;
    }

    .desc-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }

    .desc-input::placeholder { color: rgba(255,255,255,0.2); }

    .pay-btn {
      width: 100%;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 14px;
      padding: 15px;
      font-size: 15px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s, box-shadow 0.2s;
      letter-spacing: 0.01em;
      box-shadow: 0 4px 20px rgba(91,141,238,0.25);
    }

    .pay-btn:hover { opacity: 0.9; box-shadow: 0 4px 28px rgba(91,141,238,0.4); }
    .pay-btn:active { transform: scale(0.98); }
    .pay-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

    /* ── Widget section ── */
    #widget-section { display: none; animation: fadeUp 0.4s ease both; }

    .amount-recap {
      text-align: center;
      margin-bottom: 1.5rem;
    }

    .amount-recap-label {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 4px;
    }

    .amount-recap-value {
      font-size: 38px;
      font-weight: 500;
      color: var(--text);
      font-family: 'DM Mono', monospace;
    }

    .amount-recap-desc {
      font-size: 13px;
      color: var(--muted);
      margin-top: 4px;
    }

    /* ── Loading ── */
    .loading-box {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 12px; padding: 2rem 0;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .spinner {
      width: 26px; height: 26px;
      border: 2px solid rgba(91,141,238,0.15);
      border-top: 2px solid var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .loading-text { font-size: 13px; color: var(--muted); }

    /* ── Error ── */
    .error-msg {
      font-size: 13px;
      color: var(--error);
      text-align: center;
      padding: 0.5rem 0;
      display: none;
    }

    /* ── Security row ── */
    .security-row {
      display: flex; align-items: center;
      justify-content: center; gap: 6px;
      margin-top: 1.25rem;
    }

    .security-text { font-size: 11px; color: rgba(255,255,255,0.2); }

    /* Hide Revolut Pay button */
    [data-testid="revolut-pay-button"],
    .rp-button, button[class*="revolut"], [class*="RevolutPay"] {
      display: none !important;
    }

    #revolut-widget-container { display: none; }
  </style>
</head>
<body>
  <div class="card">

    <!-- Header -->
    <div class="header">
      <div class="logo-wrap">
        <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
          <rect x="8" y="8" width="55" height="55" rx="14" fill="#5b8dee"/>
          <rect x="18" y="18" width="28" height="28" rx="7" fill="#0e1018"/>
          <rect x="8" y="70" width="18" height="18" rx="4" fill="#5b8dee"/>
          <rect x="32" y="70" width="18" height="18" rx="4" fill="#5b8dee"/>
          <rect x="70" y="8" width="18" height="55" rx="9" fill="#5b8dee"/>
        </svg>
      </div>
      <div>
        <p class="brand-name">VELOURA STORE LTD</p>
        <p class="brand-url">agent-pulse.io</p>
      </div>
    </div>

    <!-- ── Formulaire montant ── -->
    <div id="form-section">
      <label class="field-label" for="amount-input">Montant à payer</label>
      <div class="amount-input-wrap">
        <span class="currency-badge">€</span>
        <input
          id="amount-input"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          autocomplete="off"
        />
      </div>

      <label class="field-label" for="desc-input">Description <span style="opacity:.4">(optionnel)</span></label>
      <input
        id="desc-input"
        class="desc-input"
        type="text"
        placeholder="Ex: Commande #001, Abonnement..."
        maxlength="80"
      />

      <p class="error-msg" id="form-error"></p>

      <button class="pay-btn" id="pay-btn" onclick="startPayment()">
        Continuer vers le paiement
      </button>
    </div>

    <!-- ── Widget Revolut ── -->
    <div id="widget-section">
      <div class="amount-recap">
        <p class="amount-recap-label">Montant à payer</p>
        <p class="amount-recap-value" id="recap-amount">—</p>
        <p class="amount-recap-desc" id="recap-desc"></p>
      </div>

      <div class="loading-box" id="widget-loading">
        <div class="spinner"></div>
        <span class="loading-text">Chargement sécurisé...</span>
      </div>

      <p class="error-msg" id="widget-error"></p>

      <div id="revolut-widget-container"></div>

      <div class="security-row" id="security-row" style="display:none">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.22)" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span class="security-text">Paiement sécurisé · SSL 256-bit</span>
      </div>
    </div>

  </div>

  <script>
    async function startPayment() {
      const amountRaw = document.getElementById("amount-input").value.trim();
      const description = document.getElementById("desc-input").value.trim() || "Paiement";
      const formError = document.getElementById("form-error");
      const btn = document.getElementById("pay-btn");

      formError.style.display = "none";

      if (!amountRaw || isNaN(amountRaw) || Number(amountRaw) <= 0) {
        formError.textContent = "Veuillez entrer un montant valide.";
        formError.style.display = "block";
        return;
      }

      const amount = parseFloat(amountRaw);

      btn.disabled = true;
      btn.textContent = "Chargement...";

      try {
        const res = await fetch("/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, currency: "EUR", description })
        });

        const data = await res.json();

        if (!data.public_id) {
          throw new Error(data.error || "Erreur serveur");
        }

        // Afficher la section widget
        document.getElementById("form-section").style.display = "none";
        document.getElementById("widget-section").style.display = "block";
        document.getElementById("recap-amount").textContent = "€" + amount.toFixed(2);
        document.getElementById("recap-desc").textContent = description;

        // Charger le widget Revolut
        loadRevolutWidget(data.public_id);

      } catch (err) {
        formError.textContent = err.message || "Une erreur est survenue. Réessayez.";
        formError.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Continuer vers le paiement";
      }
    }

    function loadRevolutWidget(publicId) {
      function showWidgetError(msg) {
        document.getElementById("widget-loading").style.display = "none";
        const e = document.getElementById("widget-error");
        e.textContent = msg;
        e.style.display = "block";
      }

      const script = document.createElement("script");
      script.src = "https://merchant.revolut.com/embed.js";
      script.async = true;
      script.onerror = () => showWidgetError("Impossible de charger le paiement. Réessayez.");
      script.onload = () => {
        try {
          RevolutCheckout(publicId).payments({
            target: document.getElementById("revolut-widget-container"),
            hidePaymentMethods: ["revolut_pay"],
            locale: "fr",
            onSuccess() { window.location.href = "/success"; },
            onError(message) { showWidgetError(message); }
          });
          document.getElementById("widget-loading").style.display = "none";
          document.getElementById("revolut-widget-container").style.display = "block";
          document.getElementById("security-row").style.display = "flex";
        } catch(e) {
          showWidgetError("Impossible d'initialiser le paiement. Réessayez.");
        }
      };
      document.body.appendChild(script);
    }

    // Permettre la touche Entrée pour valider
    document.getElementById("amount-input").addEventListener("keydown", e => {
      if (e.key === "Enter") startPayment();
    });
    document.getElementById("desc-input").addEventListener("keydown", e => {
      if (e.key === "Enter") startPayment();
    });
  </script>
</body>
</html>`);

  } catch (error) {
    return res.status(500).send("Erreur serveur : " + error.message);
  }
}
