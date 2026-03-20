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
  const maxBoost = 25;
  const percent = Math.min((level / maxBoost) * 100, 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
        <span>LTV Boost</span>
        <span style={{ color: "var(--accent-gold)", fontWeight: 600 }}>+{level}%</span>
      </div>
      <div style={{ height: "10px", background: "var(--border)", borderRadius: "5px", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${percent}%`,
            background: "linear-gradient(90deg, var(--accent-gold-dim), var(--accent-gold))",
            borderRadius: "5px",
            transition: "width 0.5s ease",
          }}
        />
      </div>
      <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
        Max boost: +{maxBoost}%
      </div>
    </div>
  );
}

export default function StakePage() {
  const { address, isConnected } = useAccount();
  const [stakeAmt, setStakeAmt] = useState("");
  const [unstakeAmt, setUnstakeAmt] = useState("");

  // Read balances
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

  // Write
  const { writeContract: approveJubl, data: approveTx } = useWriteContract();
  const { writeContract: stakeWrite, data: stakeTx } = useWriteContract();
  const { writeContract: unstakeWrite, data: unstakeTx } = useWriteContract();
  const { writeContract: claimWrite, data: claimTx } = useWriteContract();

  const { isLoading: staking } = useWaitForTransactionReceipt({ hash: stakeTx });
  const { isLoading: unstaking } = useWaitForTransactionReceipt({ hash: unstakeTx });
  const { isLoading: claiming } = useWaitForTransactionReceipt({ hash: claimTx });

  const handleStake = () => {
    if (!stakeAmt) return;
    const amount = parseUnits(stakeAmt, 18);
    approveJubl({
      address: CONTRACTS.JUBL as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACTS.JUBLBoost as `0x${string}`, amount],
    });
    setTimeout(() => {
      stakeWrite({
        address: CONTRACTS.JUBLBoost as `0x${string}`,
        abi: JUBL_BOOST_ABI,
        functionName: "stake",
        args: [amount],
      });
    }, 15000);
  };

  const handleUnstake = () => {
    if (!unstakeAmt) return;
    unstakeWrite({
      address: CONTRACTS.JUBLBoost as `0x${string}`,
      abi: JUBL_BOOST_ABI,
      functionName: "unstake",
      args: [parseUnits(unstakeAmt, 18)],
    });
  };

  const handleClaim = () => {
    claimWrite({
      address: CONTRACTS.JUBLEmissions as `0x${string}`,
      abi: EMISSIONS_ABI,
      functionName: "claim",
    });
  };

  if (!isConnected) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 0" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Connect Your Wallet</h1>
        <p style={{ color: "var(--text-secondary)" }}>Connect a wallet to stake JUBL and earn rewards.</p>
      </div>
    );
  }

  const boost = boostLevel ? Number(boostLevel) : 0;
  const staked = stakedBalance ? Number(formatUnits(stakedBalance as bigint, 18)) : 0;
  const pending = earned ? Number(formatUnits(earned as bigint, 18)) : 0;

  return (
    <div>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem", letterSpacing: "-0.03em" }}>
        Stake JUBL
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
        Stake JUBL to boost your LTV, earn emissions, and receive protocol revenue.
      </p>

      {/* Stats */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "200px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.5rem" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Your Staked JUBL</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>{staked.toLocaleString()}</div>
        </div>
        <div style={{ flex: 1, minWidth: "200px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.5rem" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Pending Rewards</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--accent-gold)" }}>{pending.toFixed(4)}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>JUBL tokens</div>
        </div>
        <div style={{ flex: 1, minWidth: "200px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.5rem" }}>
          <BoostMeter level={boost} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Stake Panel */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Stake</h3>
          <div style={{ marginBottom: "0.5rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            JUBL Balance: {jublBalance ? Number(formatUnits(jublBalance as bigint, 18)).toLocaleString() : "0"}
          </div>
          <input
            type="number"
            placeholder="0.0 JUBL"
            value={stakeAmt}
            onChange={(e) => setStakeAmt(e.target.value)}
            style={{
              width: "100%", padding: "0.75rem", borderRadius: "8px",
              border: "1px solid var(--border)", background: "var(--bg-primary)",
              color: "var(--text-primary)", fontSize: "1.25rem", marginBottom: "1rem", outline: "none",
            }}
          />
          <button
            onClick={handleStake}
            disabled={!stakeAmt || Number(stakeAmt) <= 0 || staking}
            style={{
              width: "100%", padding: "0.75rem", borderRadius: "8px", border: "none",
              fontWeight: 600, fontSize: "0.875rem", cursor: "pointer",
              background: (!stakeAmt || Number(stakeAmt) <= 0) ? "var(--border)" : "var(--accent-gold)",
              color: (!stakeAmt || Number(stakeAmt) <= 0) ? "var(--text-secondary)" : "#0a0a0f",
            }}
          >
            {staking ? "⏳ Staking..." : "Approve & Stake JUBL"}
          </button>
        </div>

        {/* Unstake Panel */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Unstake</h3>
          <div style={{ marginBottom: "0.5rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            Staked: {staked.toLocaleString()} JUBL
          </div>
          <input
            type="number"
            placeholder="0.0 JUBL"
            value={unstakeAmt}
            onChange={(e) => setUnstakeAmt(e.target.value)}
            style={{
              width: "100%", padding: "0.75rem", borderRadius: "8px",
              border: "1px solid var(--border)", background: "var(--bg-primary)",
              color: "var(--text-primary)", fontSize: "1.25rem", marginBottom: "0.5rem", outline: "none",
            }}
          />
          <div style={{ fontSize: "0.7rem", color: "var(--warning)", marginBottom: "0.75rem" }}>
            ⚠️ 7-day minimum stake period. Unstaking checks your loan health factor.
          </div>
          <button
            onClick={handleUnstake}
            disabled={!unstakeAmt || Number(unstakeAmt) <= 0 || unstaking}
            style={{
              width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)",
              fontWeight: 600, fontSize: "0.875rem", cursor: "pointer",
              background: "transparent", color: "var(--text-primary)",
            }}
          >
            {unstaking ? "⏳ Unstaking..." : "Unstake JUBL"}
          </button>
        </div>
      </div>

      {/* Claim */}
      {pending > 0 && (
        <div style={{ marginTop: "1.5rem", background: "var(--accent-gold-glow)", border: "1px solid rgba(212, 168, 83, 0.3)", borderRadius: "12px", padding: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, color: "var(--accent-gold)" }}>🎁 Claim {pending.toFixed(4)} JUBL Rewards</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>From staking emissions (250M over 5 years)</div>
          </div>
          <button
            onClick={handleClaim}
            disabled={claiming}
            style={{
              padding: "0.625rem 1.5rem", borderRadius: "8px", border: "none",
              fontWeight: 600, cursor: "pointer",
              background: "var(--accent-gold)", color: "#0a0a0f",
            }}
          >
            {claiming ? "⏳..." : "Claim"}
          </button>
        </div>
      )}
    </div>
  );
}
