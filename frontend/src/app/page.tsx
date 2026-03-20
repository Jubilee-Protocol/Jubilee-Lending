"use client";

import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { CONTRACTS } from "@/constants/contracts";
import Link from "next/link";

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="card" style={{ flex: 1, minWidth: "200px" }}>
      <div className="stat-label">{label}</div>
      <div
        className="stat-value"
        style={accent ? { color: "var(--accent-gold)" } : {}}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "0.7rem",
            color: "var(--text-tertiary)",
            marginTop: "0.25rem",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  desc,
  external,
}: {
  href: string;
  icon: string;
  title: string;
  desc: string;
  external?: boolean;
}) {
  const inner = (
    <div className="card card-interactive" style={{ cursor: "pointer", height: "100%" }}>
      <div
        style={{
          fontSize: "0.875rem",
          marginBottom: "0.75rem",
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          background: "var(--accent-gold-glow)",
          border: "1px solid var(--accent-gold-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontWeight: 600,
          fontSize: "0.9375rem",
          marginBottom: "0.25rem",
          color: "var(--text-primary)",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {desc}
      </div>
    </div>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        style={{ textDecoration: "none", flex: 1, minWidth: "250px" }}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} style={{ textDecoration: "none", flex: 1, minWidth: "250px" }}>
      {inner}
    </Link>
  );
}

export default function Dashboard() {
  const { address, isConnected } = useAccount();

  const { data: btcPrice } = useReadContract({
    address: CONTRACTS.OracleAggregator as `0x${string}`,
    abi: [
      {
        name: "getLatestPrice",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "asset", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ],
    functionName: "getLatestPrice",
    args: [CONTRACTS.wBTC as `0x${string}`],
  });

  const { data: poolBalance } = useReadContract({
    address: CONTRACTS.jUSDi as `0x${string}`,
    abi: [
      {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ],
    functionName: "balanceOf",
    args: [CONTRACTS.JubileeLending as `0x${string}`],
  });

  const { data: loanCount } = useReadContract({
    address: CONTRACTS.JubileeLending as `0x${string}`,
    abi: [
      {
        name: "loanCounter",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
      },
    ],
    functionName: "loanCounter",
  });

  const fmtBtc = btcPrice
    ? `$${Number(formatUnits(btcPrice as bigint, 8)).toLocaleString()}`
    : "—";

  const fmtPool = poolBalance
    ? `${Math.round(Number(formatUnits(poolBalance as bigint, 18))).toLocaleString()}`
    : "—";

  return (
    <div>
      {/* Hero */}
      <div style={{ marginBottom: "2.5rem" }}>
        <h1 style={{ fontSize: "2.25rem", fontWeight: 700, marginBottom: "0.625rem" }}>
          Interest-Free Lending
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "1rem",
            maxWidth: "540px",
            lineHeight: 1.6,
          }}
        >
          Deposit BTC collateral, borrow jUSDi with zero interest.
          Your collateral yield pays off your debt.
        </p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "0.75rem",
          marginBottom: "2.5rem",
        }}
      >
        <StatCard label="BTC / USD" value={fmtBtc} sub="Chainlink Oracle" />
        <StatCard label="Lending Pool" value={fmtPool} sub="jUSDi available" />
        <StatCard label="Active Loans" value={loanCount ? loanCount.toString() : "—"} />
        <StatCard label="Interest Rate" value="0%" accent sub="Always" />
      </div>

      {/* Actions */}
      <div style={{ marginBottom: "2.5rem" }}>
        <h2
          style={{
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "1rem",
          }}
        >
          Get Started
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <ActionCard
            href="/borrow"
            icon="🏦"
            title="Deposit & Borrow"
            desc="Post wBTC collateral and borrow jUSDi interest-free"
          />
          <ActionCard
            href="/stake"
            icon="⚡"
            title="Stake JUBL"
            desc="Boost your LTV, earn emissions and protocol revenue"
          />
          <ActionCard
            href="https://github.com/Jubilee-Protocol/Jubilee-Lending"
            icon="📋"
            title="Documentation"
            desc="Smart contracts, security audits, and technical details"
            external
          />
        </div>
      </div>

      {/* User */}
      {isConnected && (
        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Your Position</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Connected as{" "}
              <span
                style={{
                  color: "var(--accent-gold)",
                  fontFamily: "'Space Grotesk', monospace",
                  fontSize: "0.8rem",
                }}
              >
                {address?.slice(0, 6)}…{address?.slice(-4)}
              </span>
            </div>
          </div>
          <Link href="/borrow" className="btn-primary" style={{ width: "auto", padding: "0.625rem 1.5rem" }}>
            Open a Position →
          </Link>
        </div>
      )}
    </div>
  );
}
