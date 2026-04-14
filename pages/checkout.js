"use client";

import React, {
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useSearchParams } from "next/navigation";

declare function RevolutCheckout(publicId: string): {
  payments: (options: {
    target: HTMLElement | null;
    hidePaymentMethods?: string[];
    locale?: string;
    onSuccess?: () => void;
    onError?: (message: string) => void;
  }) => void;
};

function AgentPulseLogo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <rect x="8" y="8" width="55" height="55" rx="14" fill="#6aaeed" />
      <rect x="18" y="18" width="28" height="28" rx="7" fill="#0f1117" />
      <rect x="8" y="70" width="18" height="18" rx="4" fill="#6aaeed" />
      <rect x="32" y="70" width="18" height="18" rx="4" fill="#6aaeed" />
      <rect x="70" y="8" width="18" height="55" rx="9" fill="#6aaeed" />
    </svg>
  );
}

interface CheckoutPageProps {
  amount?: number;
  currency?: string;
  description?: string;
  customerEmail?: string;
  onSuccess?: () => void;
  onError?: (msg: string) => void;
}

function parseAmountCents(raw: string | null): number {
  if (raw == null || raw === "") return 0;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function CheckoutPageContent({
  amount: amountProp,
  currency: currencyProp,
  description: descProp,
  customerEmail: emailProp,
  onSuccess,
  onError,
}: CheckoutPageProps) {
  const searchParams = useSearchParams();

  // ✅ Lit le public_id depuis l'URL — créé par ta Cloud Function
  const publicId = searchParams.get("public_id");

  // Données d'affichage depuis l'URL
  const amount = amountProp ?? parseAmountCents(searchParams.get("amount"));
  const currency = currencyProp ?? searchParams.get("currency") ?? "EUR";
  const description = descProp ?? searchParams.get("description") ?? "Paiement";
  const customerEmail = emailProp ?? searchParams.get("email") ?? undefined;

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  const [loading, setLoading] = useState(!!publicId);
  const [error, setError] = useState<string | null>(null);

  const formattedAmount = amount > 0 ? (amount / 100).toFixed(2) : null;
  const currencySymbol = currency === "EUR" ? "€" : "$";

  useEffect(() => {
    const clearWidget = () => {
      document.getElementById("revolut-embed-script")?.remove();
      document.getElementById("revolut-widget-container")?.replaceChildren();
    };

    // ✅ On utilise directement le public_id de l'URL
    // Plus besoin de créer un order — la CF s'en charge déjà
    if (!publicId) {
      setLoading(false);
      clearWidget();
      return;
    }

    setLoading(true);
    setError(null);

    const script = document.createElement("script");
    script.id = "revolut-embed-script";
    script.src = "https://merchant.revolut.com/embed.js";
    script.async = true;

    script.onerror = () => {
      setError("Impossible de charger le paiement. Réessayez.");
      setLoading(false);
    };

    script.onload = () => {
      try {
        RevolutCheckout(publicId).payments({
          target: document.getElementById("revolut-widget-container"),
          // ✅ Cache le bouton "Revolut Pay", garde carte + Apple Pay + Google Pay
          hidePaymentMethods: ["revolut_pay"],
          locale: "fr",
          onSuccess() {
            onSuccessRef.current?.();
          },
          onError(message: string) {
            setError(message);
            onErrorRef.current?.(message);
          },
        });
      } catch {
        setError("Impossible d'initialiser le paiement. Réessayez.");
      }
      setLoading(false);
    };

    clearWidget();
    document.body.appendChild(script);

    return () => {
      clearWidget();
    };
  }, [publicId]);

  // public_id manquant dans l'URL
  if (!publicId) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={{ color: "#e24b4a", textAlign: "center", fontSize: 14 }}>
            Erreur : public_id manquant dans l'URL.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        [data-testid="revolut-pay-button"],
        .rp-button,
        button[class*="revolut"],
        [class*="RevolutPay"] {
          display: none !important;
        }
      `}</style>

      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoWrap}>
            <AgentPulseLogo />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={styles.brandName}>VELOURA STORE LTD</p>
            <p style={styles.brandUrl}>agent-pulse.io</p>
          </div>
        </div>

        {/* Montant */}
        <div style={styles.amountBlock}>
          <p style={styles.amountLabel}>Montant à payer</p>
          {formattedAmount && (
            <p style={styles.amountValue}>
              {currencySymbol}{formattedAmount}
            </p>
          )}
          {description && <p style={styles.amountDesc}>{description}</p>}
          {customerEmail && <p style={styles.amountEmail}>{customerEmail}</p>}
        </div>

        {/* Loading */}
        {loading && (
          <div style={styles.loadingBox}>
            <div style={styles.spinner} />
            <span style={styles.loadingText}>Chargement sécurisé...</span>
          </div>
        )}

        {/* Erreur */}
        {error && <p style={styles.errorText}>{error}</p>}

        {/* ✅ Widget Revolut — carte + Apple Pay + Google Pay natifs */}
        <div
          id="revolut-widget-container"
          style={{ display: loading ? "none" : "block" }}
        />

        {/* Sécurité */}
        {!loading && !error && (
          <div style={styles.securityRow}>
            <LockIcon />
            <span style={styles.securityText}>
              Paiement sécurisé · SSL 256-bit
            </span>
          </div>
        )}

      </div>
    </div>
  );
}

function CheckoutPageFallback() {
  return (
    <div style={styles.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={styles.card}>
        <div style={styles.loadingBox}>
          <div style={styles.spinner} />
          <span style={styles.loadingText}>Chargement…</span>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage(props: CheckoutPageProps) {
  return (
    <Suspense fallback={<CheckoutPageFallback />}>
      <CheckoutPageContent {...props} />
    </Suspense>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b0d14",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    fontFamily: "'Inter', sans-serif",
  },
  card: {
    background: "#13161f",
    border: "0.5px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    width: "100%",
    maxWidth: 420,
    padding: "2rem",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    paddingBottom: "1.5rem",
    marginBottom: "1.5rem",
    borderBottom: "0.5px solid rgba(255,255,255,0.07)",
  },
  logoWrap: {
    width: 56,
    height: 56,
    background: "#1a2233",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontSize: 14,
    fontWeight: 500,
    color: "#ffffff",
    letterSpacing: "0.04em",
    margin: 0,
  },
  brandUrl: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    margin: 0,
  },
  amountBlock: {
    textAlign: "center",
    marginBottom: "1.5rem",
  },
  amountLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    margin: "0 0 4px",
  },
  amountValue: {
    fontSize: 36,
    fontWeight: 500,
    color: "#ffffff",
    margin: "4px 0",
  },
  amountDesc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    margin: "4px 0 0",
  },
  amountEmail: {
    fontSize: 12,
    color: "rgba(255,255,255,0.25)",
    margin: "4px 0 0",
  },
  loadingBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: "2rem 0",
  },
  spinner: {
    width: 28,
    height: 28,
    border: "2px solid rgba(106,174,237,0.15)",
    borderTop: "2px solid #6aaeed",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.3)",
  },
  errorText: {
    fontSize: 13,
    color: "#e24b4a",
    textAlign: "center",
    padding: "0.5rem 0",
    margin: 0,
  },
  securityRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: "1.25rem",
  },
  securityText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.22)",
  },
};

function LockIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="rgba(255,255,255,0.22)"
      strokeWidth="2"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
