"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/borrow", label: "Borrow" },
  { href: "/stake", label: "Stake" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.875rem 2rem",
        borderBottom: "1px solid var(--border)",
        background: "rgba(10, 10, 15, 0.85)",
        backdropFilter: "blur(16px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "2.5rem" }}>
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            textDecoration: "none",
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: "-0.02em",
          }}
        >
          <span style={{ color: "var(--accent-gold)", fontSize: "1.25rem" }}>✦</span>
          <span>Jubilee</span>
          <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Lending</span>
        </Link>

        <nav style={{ display: "flex", gap: "0.125rem" }}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  textDecoration: "none",
                  color: active ? "var(--accent-gold)" : "var(--text-secondary)",
                  background: active ? "var(--accent-gold-glow)" : "transparent",
                  border: active ? "1px solid var(--accent-gold-border)" : "1px solid transparent",
                  transition: "all 0.2s",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.375rem 0.75rem",
            borderRadius: "6px",
            background: "var(--success-dim)",
            border: "1px solid rgba(74, 222, 128, 0.15)",
            fontSize: "0.7rem",
            color: "var(--success)",
            fontWeight: 500,
          }}
        >
          <span className="live-indicator" />
          Base Sepolia
        </div>
        <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        padding: "1.25rem 2rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "0.75rem",
        color: "var(--text-tertiary)",
      }}
    >
      <span>2026 © Jubilee Labs</span>
      <div style={{ display: "flex", gap: "1.5rem" }}>
        {[
          { label: "GitHub", href: "https://github.com/Jubilee-Protocol/Jubilee-Lending" },
          { label: "X", href: "https://x.com/jubileeprotocol" },
          { label: "Telegram", href: "https://t.me/jubileeprotocol" },
          { label: "Docs", href: "https://github.com/Jubilee-Protocol/whitepaper" },
        ].map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener"
            style={{
              color: "var(--text-tertiary)",
              textDecoration: "none",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
          >
            {l.label}
          </a>
        ))}
      </div>
    </footer>
  );
}
