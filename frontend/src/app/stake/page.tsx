"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { CONTRACTS } from "@/constants/contracts";

const JUBL_BOOST_ABI = [
  { name: "stake", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "unstake", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "stakedBalance", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "getBoostLevel", type: "function", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

const EMISSIONS_ABI = [
  { name: "earned", type: "function", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "claim", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
] as const;

function BoostMeter({ level }: { level: number }) {
  const max = 25;
  const pct = Math.min((level / max) * 100, 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <span className="stat-label" style={{ marginBottom: 0 }}>LTV Boost</span>
        <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: "1rem", color: "var(--accent-gold)" }}>+{level}%</span>
      </div>
      <div style={{ height: "8px", background: "rgba(255,255,255,0.04)", borderRadius: "4px", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--accent-gold-dim), var(--accent-gold))",
            borderRadius: "4px",
            transition: "width 0.5s ease",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.375rem", fontSize: "0.65rem", color: "var(--text-tertiary)" }}>
        <span>0%</span>
        <span>Max +{max}%</span>
      </div>
    </div>
  );
}

export default function StakePage() {
  const { address, isConnected } = useAccount();
  const [stakeAmt, setStakeAmt] = useState("");
  const [unstakeAmt, setUnstakeAmt] = useState("");

  const { data: jublBalance } = useReadContract({
    address: CONTRACTS.JUBL as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { data: stakedBalance } = useReadContract({
    address: CONTRACTS.JUBLBoost as `0x${string}`,
    abi: JUBL_BOOST_ABI,
    functionName: "stakedBalance",
    args: address ? [address] : undefined,
  });

  const { data: boostLevel } = useReadContract({
    address: CONTRACTS.JUBLBoost as `0x${string}`,
    abi: JUBL_BOOST_ABI,
    functionName: "getBoostLevel",
    args: address ? [address] : undefined,
  });

  const { data: earned } = useReadContract({
    address: CONTRACTS.JUBLEmissions as `0x${string}`,
    abi: EMISSIONS_ABI,
    functionName: "earned",
    args: address ? [address] : undefined,
  });

  const { writeContract: w1, data: t1 } = useWriteContract();
  const { writeContract: w2, data: t2 } = useWriteContract();
  const { writeContract: w3, data: t3 } = useWriteContract();
  const { writeContract: w4, data: t4 } = useWriteContract();

  const { isLoading: staking } = useWaitForTransactionReceipt({ hash: t2 });
  const { isLoading: unstaking } = useWaitForTransactionReceipt({ hash: t3 });
  const { isLoading: claiming } = useWaitForTransactionReceipt({ hash: t4 });

  const handleStake = () => {
    if (!stakeAmt) return;
    const amt = parseUnits(stakeAmt, 18);
    w1({
      address: CONTRACTS.JUBL as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACTS.JUBLBoost as `0x${string}`, amt],
    });
    setTimeout(() => {
      w2({
        address: CONTRACTS.JUBLBoost as `0x${string}`,
        abi: JUBL_BOOST_ABI,
        functionName: "stake",
        args: [amt],
      });
    }, 15000);
  };

  const handleUnstake = () => {
    if (!unstakeAmt) return;
    w3({
      address: CONTRACTS.JUBLBoost as `0x${string}`,
      abi: JUBL_BOOST_ABI,
      functionName: "unstake",
      args: [parseUnits(unstakeAmt, 18)],
    });
  };

  const handleClaim = () => {
    w4({
      address: CONTRACTS.JUBLEmissions as `0x${string}`,
      abi: EMISSIONS_ABI,
      functionName: "claim",
    });
  };

  if (!isConnected) {
    return (
      <div style={{ textAlign: "center", padding: "6rem 0" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem", opacity: 0.5 }}>⚡</div>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Connect Your Wallet</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Connect to stake JUBL and earn rewards.
        </p>
      </div>
    );
  }

  const boost = boostLevel ? Number(boostLevel) : 0;
  const staked = stakedBalance ? Number(formatUnits(stakedBalance as bigint, 18)) : 0;
  const pending = earned ? Number(formatUnits(earned as bigint, 18)) : 0;
  const bal = jublBalance ? Number(formatUnits(jublBalance as bigint, 18)) : 0;

  return (
    <div>
      <h1 style={{ fontSize: "2.25rem", fontWeight: 700, marginBottom: "0.625rem" }}>Stake JUBL</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
        Stake JUBL to boost your LTV, earn emissions, and receive protocol revenue.
      </p>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <div className="card">
          <div className="stat-label">Staked</div>
          <div className="stat-value">{staked.toLocaleString()}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>JUBL</div>
        </div>
        <div className="card">
          <div className="stat-label">Pending Rewards</div>
          <div className="stat-value" style={{ color: "var(--accent-gold)" }}>{pending.toFixed(4)}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>JUBL claimable</div>
        </div>
        <div className="card">
          <BoostMeter level={boost} />
        </div>
      </div>

      {/* Stake + Unstake */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div className="card">
          <div className="stat-label">Stake</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.75rem" }}>
            Balance: <span style={{ color: "var(--text-secondary)" }}>{bal.toLocaleString()} JUBL</span>
          </div>
          <input
            type="number"
            placeholder="0.0"
            value={stakeAmt}
            onChange={(e) => setStakeAmt(e.target.value)}
            className="input-field"
            style={{ marginBottom: "1rem" }}
          />
          <button
            className="btn-primary"
            onClick={handleStake}
            disabled={!stakeAmt || Number(stakeAmt) <= 0 || staking}
          >
            {staking ? "⏳ Staking…" : "Approve & Stake JUBL"}
          </button>
        </div>

        <div className="card">
          <div className="stat-label">Unstake</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.75rem" }}>
            Currently staked: <span style={{ color: "var(--text-secondary)" }}>{staked.toLocaleString()} JUBL</span>
          </div>
          <input
            type="number"
            placeholder="0.0"
            value={unstakeAmt}
            onChange={(e) => setUnstakeAmt(e.target.value)}
            className="input-field"
            style={{ marginBottom: "0.5rem" }}
          />
          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--warning)",
              marginBottom: "0.75rem",
              padding: "0.5rem",
              borderRadius: "6px",
              background: "var(--warning-dim)",
            }}
          >
            ⚠️ 7-day minimum stake period. Unstaking checks your loan health factor.
          </div>
          <button
            className="btn-secondary"
            onClick={handleUnstake}
            disabled={!unstakeAmt || Number(unstakeAmt) <= 0 || unstaking}
          >
            {unstaking ? "⏳ Unstaking…" : "Unstake JUBL"}
          </button>
        </div>
      </div>

      {/* Claim */}
      {pending > 0 && (
        <div
          className="card"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--accent-gold-glow)",
            border: "1px solid var(--accent-gold-border)",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: "var(--accent-gold)", marginBottom: "0.125rem" }}>
              🎁 Claim {pending.toFixed(4)} JUBL
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>
              From staking emissions (250M over 5 years)
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={handleClaim}
            disabled={claiming}
            style={{ width: "auto", padding: "0.625rem 1.5rem" }}
          >
            {claiming ? "⏳…" : "Claim"}
          </button>
        </div>
      )}
    </div>
  );
}
