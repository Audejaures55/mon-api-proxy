export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Méthode non autorisée");
  }

  const q = req.query || {};
  const presetMontant = q.montant != null ? String(q.montant) : "";

  // URL de retour après paiement (paramètre ?return_url= ou variable d'env)
  const successUrlBase =
    q.return_url ||
    process.env.CHECKOUT_SUCCESS_URL ||
    "https://agent-pulse.io/success";

  const minEur = Number(process.env.CHECKOUT_MIN_EUROS ?? 0.5);
  const maxEur = Number(process.env.CHECKOUT_MAX_EUROS ?? 50000);

  const bootstrap = {
    successUrlBase,
    presetMontant,
    minEur,
    maxEur,
  };

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Paiement sécurisé · Agent Pulse</title>
  <link rel="preconnect" href="https://merchant.revolut.com" crossorigin/>
  <link rel="dns-prefetch" href="https://merchant.revolut.com"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      background: linear-gradient(180deg, #07080c 0%, #0b0d14 40%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem 1rem 2rem;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Inter", sans-serif;
      color: #f1f3f8;
    }
    .card {
      background: #13161f;
      border: 0.5px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      width: 100%;
      max-width: 420px;
      padding: 1.75rem 1.5rem 2rem;
      box-shadow: 0 24px 80px rgba(0,0,0,0.45);
    }
    .header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding-bottom: 1.35rem;
      margin-bottom: 1.35rem;
      border-bottom: 0.5px solid rgba(255,255,255,0.07);
    }
    .logo-wrap {
      width: 56px; height: 56px;
      background: #1a2233;
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
    }
    .brand-title {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #ffffff;
    }
    .brand-sub {
      font-size: 12px;
      color: rgba(255,255,255,0.38);
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: rgba(255,255,255,0.9);
      margin-bottom: 12px;
    }
    .form-group { margin-bottom: 14px; }
    .form-group label {
      display: block;
      font-size: 12px;
      color: rgba(255,255,255,0.45);
      margin-bottom: 6px;
    }
    .form-group input {
      width: 100%;
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.12);
      background: #0d0f16;
      color: #fff;
      font-size: 15px;
    }
    .form-group input:focus {
      outline: none;
      border-color: rgba(106,174,237,0.5);
    }
    .form-group input::placeholder { color: rgba(255,255,255,0.25); }
    .quick-label {
      font-size: 12px;
      color: rgba(255,255,255,0.45);
      margin-bottom: 8px;
    }
    .quick-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .quick-btn {
      flex: 1;
      min-width: 76px;
      padding: 10px 8px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.12);
      background: #1c2230;
      color: #e8ecf5;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .quick-btn:hover { background: #252b3d; }
    .quick-btn:active { transform: scale(0.98); }
    .btn-primary {
      width: 100%;
      margin-top: 6px;
      padding: 14px 16px;
      background: #6aaeed;
      color: #0b0d14;
      font-size: 15px;
      font-weight: 600;
      border: none;
      border-radius: 12px;
      cursor: pointer;
    }
    .btn-primary:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .btn-primary:not(:disabled):hover { filter: brightness(1.05); }
    .amount-block { text-align: center; margin-bottom: 1rem; display: none; }
    .amount-block.visible { display: block; }
    .amount-label { font-size: 12px; color: rgba(255,255,255,0.38); margin-bottom: 6px; }
    .amount-value {
      font-size: 1.75rem;
      font-weight: 600;
      color: #ffffff;
    }
    .payer-name {
      font-size: 12px;
      color: rgba(255,255,255,0.35);
      margin-top: 6px;
    }
    .loading-box {
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 1.5rem 0;
    }
    .loading-box.visible { display: flex; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner {
      width: 28px; height: 28px;
      border: 2px solid rgba(106,174,237,0.15);
      border-top: 2px solid #6aaeed;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .loading-text { font-size: 13px; color: rgba(255,255,255,0.32); }
    .error-box {
      display: none;
      background: rgba(226, 75, 74, 0.08);
      border: 1px solid rgba(226, 75, 74, 0.25);
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 12px;
      font-size: 13px;
      color: #f0a8a7;
      text-align: center;
      line-height: 1.45;
    }
    .error-box.visible { display: block; }
    .btn-retry {
      margin-top: 10px;
      width: 100%;
      padding: 12px 16px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.12);
      background: #1c2230;
      color: #fff;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    #payment-widget-root { min-height: 8px; }
    [data-testid="revolut-pay-button"],
    .rp-button,
    button[class*="revolut"],
    [class*="RevolutPay"] {
      display: none !important;
    }
    .security-row {
      display: none;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 1.25rem;
    }
    .security-row.visible { display: flex; }
    .security-text { font-size: 11px; color: rgba(255,255,255,0.22); }
    .success-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(7,8,12,0.92);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .success-overlay.visible { display: flex; }
    .success-card {
      background: #13161f;
      border: 0.5px solid rgba(106,174,237,0.35);
      border-radius: 20px;
      padding: 2rem 1.75rem;
      max-width: 360px;
      text-align: center;
    }
    .success-card h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #a8d4ff;
    }
    .success-card p { font-size: 13px; color: rgba(255,255,255,0.45); }
    .hint-pay { font-size: 11px; color: rgba(255,255,255,0.22); margin-top: 14px; text-align: center; display: none; }
    .hint-pay.visible { display: block; }
    #step-form.hidden { display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-wrap" aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 100 100" fill="none">
          <rect x="8" y="8" width="55" height="55" rx="14" fill="#6aaeed"/>
          <rect x="18" y="18" width="28" height="28" rx="7" fill="#0f1117"/>
          <rect x="8" y="70" width="18" height="18" rx="4" fill="#6aaeed"/>
          <rect x="32" y="70" width="18" height="18" rx="4" fill="#6aaeed"/>
          <rect x="70" y="8" width="18" height="55" rx="9" fill="#6aaeed"/>
        </svg>
      </div>
      <div style="text-align:center">
        <p class="brand-title">Agent Pulse</p>
        <p class="brand-sub">VELOURA STORE LTD · agent-pulse.io</p>
      </div>
    </div>

    <div id="step-form">
      <p class="section-title">Vos informations</p>
      <div class="form-group">
        <label for="firstName">Prénom</label>
        <input id="firstName" name="firstName" type="text" autocomplete="given-name" required placeholder="Jean"/>
      </div>
      <div class="form-group">
        <label for="lastName">Nom</label>
        <input id="lastName" name="lastName" type="text" autocomplete="family-name" required placeholder="Dupont"/>
      </div>
      <p class="quick-label">Montant (€)</p>
      <div class="quick-row" id="quick-tarifs">
        <button type="button" class="quick-btn" data-euros="29.99">29,99 €</button>
        <button type="button" class="quick-btn" data-euros="49.99">49,99 €</button>
        <button type="button" class="quick-btn" data-euros="99.99">99,99 €</button>
      </div>
      <div class="form-group">
        <label for="amount">Ou saisissez un montant</label>
        <input id="amount" name="amount" type="text" inputmode="decimal" placeholder="ex. 35,00" required/>
      </div>
      <div class="error-box" id="form-error"></div>
      <button type="button" class="btn-primary" id="btn-continue">Continuer vers le paiement</button>
    </div>

    <div class="amount-block" id="amount-section">
      <p class="amount-label">Montant à payer</p>
      <p class="amount-value" id="amount-display">—</p>
      <p class="payer-name" id="payer-display"></p>
    </div>

    <div class="loading-box" id="loading">
      <div class="spinner"></div>
      <span class="loading-text">Préparation du paiement sécurisé…</span>
    </div>

    <div class="error-box" id="pay-error"></div>
    <button type="button" class="btn-retry" id="btn-retry-pay" style="display:none">Réessayer</button>

    <div id="payment-widget-root" style="display:none"></div>
    <p class="hint-pay" id="wallet-hint">Carte bancaire, Apple&nbsp;Pay ou Google&nbsp;Pay selon votre appareil.</p>

    <div class="security-row" id="security-row">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
        stroke="rgba(255,255,255,0.22)" stroke-width="2" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      <span class="security-text">Paiement sécurisé · SSL</span>
    </div>
  </div>

  <div class="success-overlay" id="success-overlay" role="alert" aria-live="polite">
    <div class="success-card">
      <h2>Paiement confirmé !</h2>
      <p>Redirection en cours…</p>
    </div>
  </div>

  <script id="checkout-bootstrap" type="application/json">${JSON.stringify(bootstrap).replace(/</g, "\\u003c")}</script>
  <script>
    (function () {
      var cfg = JSON.parse(document.getElementById("checkout-bootstrap").textContent);
      var minEur = cfg.minEur;
      var maxEur = cfg.maxEur;

      function parseEuros(str) {
        if (str == null || str === "") return NaN;
        return parseFloat(String(str).replace(/\\s/g, "").replace(",", "."));
      }

      function formatFrEUR(n) {
        try {
          return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
        } catch (e) {
          return n.toFixed(2) + " €";
        }
      }

      function buildSuccessUrl(publicId) {
        var base = cfg.successUrlBase;
        var sep = base.indexOf("?") >= 0 ? "&" : "?";
        return base + sep + "public_id=" + encodeURIComponent(publicId);
      }

      function userFacingPayError(msg) {
        var m = String(msg || "");
        if (/revolut/i.test(m)) {
          return "Paiement échoué, réessayez ou contactez-nous.";
        }
        return m || "Paiement échoué, réessayez ou contactez-nous.";
      }

      var firstName = document.getElementById("firstName");
      var lastName = document.getElementById("lastName");
      var amountInput = document.getElementById("amount");
      if (cfg.presetMontant) amountInput.value = cfg.presetMontant;

      document.querySelectorAll(".quick-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          amountInput.value = btn.getAttribute("data-euros");
        });
      });

      function showFormError(msg) {
        var el = document.getElementById("form-error");
        el.textContent = msg;
        el.classList.add("visible");
      }
      function hideFormError() {
        var el = document.getElementById("form-error");
        el.classList.remove("visible");
        el.textContent = "";
      }

      [firstName, lastName, amountInput].forEach(function (el) {
        el.addEventListener("input", hideFormError);
      });

      var btnContinue = document.getElementById("btn-continue");
      btnContinue.addEventListener("click", function () {
        hideFormError();
        var fn = firstName.value.trim();
        var ln = lastName.value.trim();
        var eur = parseEuros(amountInput.value);
        if (!fn || !ln) {
          showFormError("Merci de renseigner le prénom et le nom.");
          return;
        }
        if (!Number.isFinite(eur) || eur < minEur || eur > maxEur) {
          showFormError("Montant : entre " + minEur + " et " + maxEur + " €.");
          return;
        }
        if (Math.round(eur * 100) < 50) {
          showFormError("Montant minimum : 0,50 €.");
          return;
        }

        btnContinue.disabled = true;
        document.getElementById("loading").classList.add("visible");

        fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: fn,
            lastName: ln,
            amountEuros: eur,
            currency: "EUR",
            returnUrl: cfg.successUrlBase
          })
        })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (_ref) {
            document.getElementById("loading").classList.remove("visible");
            btnContinue.disabled = false;
            if (!_ref.ok || !_ref.j.public_id) {
              showFormError(_ref.j.error || "Impossible de continuer. Réessayez.");
              return;
            }
            startPayment(_ref.j.public_id, _ref.j.checkout_url, fn, ln, eur);
          })
          .catch(function () {
            document.getElementById("loading").classList.remove("visible");
            btnContinue.disabled = false;
            showFormError("Connexion impossible. Réessayez.");
          });
      });

      function startPayment(publicId, checkoutUrl, fn, ln, eur) {
        // Affiche le résumé de la commande
        document.getElementById("step-form").classList.add("hidden");
        document.getElementById("amount-section").classList.add("visible");
        document.getElementById("amount-display").textContent = formatFrEUR(eur);
        document.getElementById("payer-display").textContent = fn + " " + ln;
        document.getElementById("loading").classList.add("visible");

        // Redirection vers la page de paiement sécurisée
        setTimeout(function () {
          window.location.href = checkoutUrl;
        }, 800);
      }
    })();
  </script>
</body>
</html>`);
}
