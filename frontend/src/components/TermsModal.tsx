"use client";

import { useState, useEffect } from "react";

interface TermsModalProps {
  onAccept: () => void;
}

export function TermsModal({ onAccept }: TermsModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>✦</div>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Terms of Use
          </h2>
        </div>

        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
            lineHeight: 1.7,
            marginBottom: "1.5rem",
          }}
        >
          <p style={{ marginBottom: "0.75rem" }}>
            By using Jubilee Lending, a product of Jubilee Protocol governed by
            Hundredfold Foundation and developed by Jubilee Labs, you acknowledge
            and agree:
          </p>
          <p style={{ marginBottom: "0.5rem" }}>
            <strong style={{ color: "var(--text-primary)" }}>(a)</strong> Jubilee
            Lending is provided on an &ldquo;AS-IS&rdquo; and &ldquo;AS
            AVAILABLE&rdquo; basis. Hundredfold Foundation, Jubilee Labs, and
            their affiliates expressly disclaim all warranties.
          </p>
          <p style={{ marginBottom: "0.5rem" }}>
            <strong style={{ color: "var(--text-primary)" }}>(b)</strong> Neither
            Hundredfold Foundation nor Jubilee Labs warrants that Jubilee
            Lending will be available on an uninterrupted, secure, or
            error-free basis.
          </p>
          <p style={{ marginBottom: "0.5rem" }}>
            <strong style={{ color: "var(--text-primary)" }}>(c)</strong> You
            shall have no claim against Hundredfold Foundation, Jubilee Labs,
            or their affiliates for any loss arising from your use of Jubilee
            Lending.
          </p>
          <p style={{ marginBottom: "0.5rem" }}>
            <strong style={{ color: "var(--text-primary)" }}>(d)</strong> DeFi
            protocols carry significant risks including: smart contract
            vulnerabilities, market volatility, oracle failures, and potential
            total loss of deposited funds.
          </p>
          <p>
            <strong style={{ color: "var(--text-primary)" }}>(e)</strong> This
            is not financial, legal, or tax advice. You are solely responsible
            for your own investment decisions.
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={onAccept}
          style={{ marginBottom: "0.5rem" }}
        >
          Accept &amp; Continue
        </button>
        <p
          style={{
            textAlign: "center",
            fontSize: "0.7rem",
            color: "var(--text-tertiary)",
          }}
        >
          By clicking Accept, you agree to the Jubilee Protocol Terms of Service
        </p>
      </div>
    </div>
  );
}

export function useTermsAccepted() {
  const [accepted, setAccepted] = useState(true); // default true to prevent flash
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("jubilee-lending-tos");
    setAccepted(stored === "accepted");
    setReady(true);
  }, []);

  const accept = () => {
    localStorage.setItem("jubilee-lending-tos", "accepted");
    setAccepted(true);
  };

  return { accepted, accept, ready };
}
