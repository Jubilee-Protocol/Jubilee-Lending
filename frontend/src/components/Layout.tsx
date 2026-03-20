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
        padding: "1rem 2rem",
        borderBottom: "1px solid var(--border)",
        background: "rgba(10, 10, 15, 0.8)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
        <Link
          href="/"
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--accent-gold)",
            textDecoration: "none",
            letterSpacing: "-0.02em",
          }}
        >
          ✦ Jubilee Lending
        </Link>

        <nav style={{ display: "flex", gap: "0.25rem" }}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
                color:
                  pathname === item.href
                    ? "var(--accent-gold)"
                    : "var(--text-secondary)",
                background:
                  pathname === item.href
                    ? "var(--accent-gold-glow)"
                    : "transparent",
                transition: "all 0.2s",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <ConnectButton
        showBalance={false}
        chainStatus="icon"
        accountStatus="address"
      />
    </header>
  );
}

export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        padding: "1.5rem 2rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "0.8rem",
        color: "var(--text-secondary)",
      }}
    >
      <span>2026 © Jubilee Labs</span>
      <div style={{ display: "flex", gap: "1.5rem" }}>
        <a
          href="https://github.com/Jubilee-Protocol/Jubilee-Lending"
          target="_blank"
          rel="noopener"
          style={{ color: "var(--text-secondary)", textDecoration: "none" }}
        >
          GitHub
        </a>
        <a
          href="https://x.com/jubileeprotocol"
          target="_blank"
          rel="noopener"
          style={{ color: "var(--text-secondary)", textDecoration: "none" }}
        >
          X
        </a>
        <a
          href="https://t.me/jubileeprotocol"
          target="_blank"
          rel="noopener"
          style={{ color: "var(--text-secondary)", textDecoration: "none" }}
        >
          Telegram
        </a>
      </div>
    </footer>
  );
}
