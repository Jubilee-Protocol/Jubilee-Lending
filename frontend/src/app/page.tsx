"use client";

import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { CONTRACTS, ORACLE_ABI, ERC20_ABI, LENDING_ABI } from "@/constants/contracts";
import Link from "next/link";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "1.5rem",
        flex: 1,
        minWidth: "200px",
      }}
    >
      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function ActionCard({ href, emoji, title, desc }: { href: string; emoji: string; title: string; desc: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none", flex: 1, minWidth: "250px" }}>
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "1.5rem",
          cursor: "pointer",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-card-hover)";
          e.currentTarget.style.borderColor = "var(--accent-gold)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--bg-card)";
          e.currentTarget.style.borderColor = "var(--border)";
        }}
      >
        <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{emoji}</div>
        <div style={{ fontWeight: 600, marginBottom: "0.25rem", color: "var(--text-primary)" }}>{title}</div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{desc}</div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { address, isConnected } = useAccount();

  const { data: btcPrice } = useReadContract({
    address: CONTRACTS.OracleAggregator as `0x${string}`,
    abi: [{ name: "getLatestPrice", type: "function", stateMutability: "view", inputs: [{ name: "asset", type: "address" }], outputs: [{ name: "", type: "uint256" }] }],
    functionName: "getLatestPrice",
    args: [CONTRACTS.wBTC as `0x${string}`],
  });

  const { data: poolBalance } = useReadContract({
    address: CONTRACTS.jUSDi as `0x${string}`,
    abi: [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] }],
    functionName: "balanceOf",
    args: [CONTRACTS.JubileeLending as `0x${string}`],
  });

  const { data: loanCount } = useReadContract({
    address: CONTRACTS.JubileeLending as `0x${string}`,
    abi: [{ name: "loanCounter", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] }],
    functionName: "loanCounter",
  });

  const formattedBtcPrice = btcPrice
    ? `$${Number(formatUnits(btcPrice as bigint, 8)).toLocaleString()}`
    : "—";

  const formattedPool = poolBalance
    ? `${Number(formatUnits(poolBalance as bigint, 18)).toLocaleString()} jUSDi`
    : "—";

  return (
    <div>
      {/* Hero */}
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
            letterSpacing: "-0.03em",
          }}
        >
          Interest-Free Lending
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "1rem", maxWidth: "600px" }}>
          Deposit BTC collateral, borrow jUSDi with zero interest. Your collateral yield pays off your debt.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <StatCard label="BTC Price (Chainlink)" value={formattedBtcPrice} sub="Base Sepolia Oracle" />
        <StatCard label="Lending Pool" value={formattedPool} sub="Available to borrow" />
        <StatCard label="Total Loans" value={loanCount ? loanCount.toString() : "—"} sub="Active positions" />
        <StatCard label="Interest Rate" value="0%" sub="Always. Forever." />
      </div>

      {/* Quick Actions */}
      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>Get Started</h2>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem" }}>
        <ActionCard href="/borrow" emoji="🏦" title="Deposit & Borrow" desc="Deposit wBTC collateral and borrow jUSDi interest-free" />
        <ActionCard href="/stake" emoji="⚡" title="Stake JUBL" desc="Stake JUBL for LTV boosts, emissions, and revenue share" />
        <ActionCard
          href="https://github.com/Jubilee-Protocol/Jubilee-Lending"
          emoji="📋"
          title="Documentation"
          desc="Smart contracts, audits, and technical details"
        />
      </div>

      {/* User Position */}
      {isConnected && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Your Position</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Connected as{" "}
            <span style={{ color: "var(--accent-gold)", fontFamily: "monospace" }}>
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
          </p>
          <Link
            href="/borrow"
            style={{
              display: "inline-block",
              marginTop: "1rem",
              padding: "0.625rem 1.5rem",
              background: "var(--accent-gold)",
              color: "#0a0a0f",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.875rem",
              textDecoration: "none",
            }}
          >
            Open a Position →
          </Link>
        </div>
      )}
    </div>
  );
}
