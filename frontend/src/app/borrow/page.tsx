"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { CONTRACTS } from "@/constants/contracts";

const LENDING_ABI = [
  { name: "depositCollateral", type: "function", stateMutability: "nonpayable", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "borrow", type: "function", stateMutability: "nonpayable", inputs: [{ name: "loanId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "repay", type: "function", stateMutability: "nonpayable", inputs: [{ name: "loanId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "addCollateral", type: "function", stateMutability: "nonpayable", inputs: [{ name: "loanId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "withdrawCollateral", type: "function", stateMutability: "nonpayable", inputs: [{ name: "loanId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "loanCounter", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

const ERC20_ABI = [
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

function HealthGauge({ value }: { value: number }) {
  const color =
    value >= 2 ? "var(--success)" : value >= 1.5 ? "var(--warning)" : "var(--danger)";
  const label = value >= 2 ? "Safe" : value >= 1.5 ? "Caution" : "At Risk";
  const width = Math.min((value / 3) * 100, 100);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <div className="gauge-track" style={{ flex: 1 }}>
        <div className="gauge-fill" style={{ width: `${width}%`, background: color }} />
      </div>
      <div style={{ textAlign: "right", minWidth: "3.5rem" }}>
        <div style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: "0.875rem", color }}>
          {value >= 100 ? "∞" : value.toFixed(2)}
        </div>
        <div style={{ fontSize: "0.6rem", color: "var(--text-tertiary)" }}>{label}</div>
      </div>
    </div>
  );
}

export default function BorrowPage() {
  const { address, isConnected } = useAccount();
  const [depositAmt, setDepositAmt] = useState("");
  const [borrowAmt, setBorrowAmt] = useState("");
  const [repayAmt, setRepayAmt] = useState("");
  const [loanId, setLoanId] = useState("");
  const [addCollAmt, setAddCollAmt] = useState("");

  const { data: wbtcBalance } = useReadContract({
    address: CONTRACTS.wBTC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { data: jusdiBalance } = useReadContract({
    address: CONTRACTS.jUSDi as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { writeContract: write1, data: tx1 } = useWriteContract();
  const { writeContract: write2, data: tx2 } = useWriteContract();
  const { writeContract: write3, data: tx3 } = useWriteContract();
  const { writeContract: write4, data: tx4 } = useWriteContract();
  const { writeContract: write5, data: tx5 } = useWriteContract();

  const { isLoading: l1 } = useWaitForTransactionReceipt({ hash: tx1 });
  const { isLoading: l2 } = useWaitForTransactionReceipt({ hash: tx2 });
  const { isLoading: l3 } = useWaitForTransactionReceipt({ hash: tx3 });
  const { isLoading: l4 } = useWaitForTransactionReceipt({ hash: tx4 });

  const handleDeposit = () => {
    if (!depositAmt) return;
    const amt = parseUnits(depositAmt, 18);
    write1({
      address: CONTRACTS.wBTC as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACTS.JubileeLending as `0x${string}`, amt],
    });
    setTimeout(() => {
      write2({
        address: CONTRACTS.JubileeLending as `0x${string}`,
        abi: LENDING_ABI,
        functionName: "depositCollateral",
        args: [CONTRACTS.wBTC as `0x${string}`, amt],
      });
    }, 15000);
  };

  const handleBorrow = () => {
    if (!borrowAmt || !loanId) return;
    write3({
      address: CONTRACTS.JubileeLending as `0x${string}`,
      abi: LENDING_ABI,
      functionName: "borrow",
      args: [BigInt(loanId), parseUnits(borrowAmt, 18)],
    });
  };

  const handleRepay = () => {
    if (!repayAmt || !loanId) return;
    const amt = parseUnits(repayAmt, 18);
    write4({
      address: CONTRACTS.jUSDi as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACTS.JubileeLending as `0x${string}`, amt],
    });
    setTimeout(() => {
      write5({
        address: CONTRACTS.JubileeLending as `0x${string}`,
        abi: LENDING_ABI,
        functionName: "repay",
        args: [BigInt(loanId), amt],
      });
    }, 15000);
  };

  const handleAddCollateral = () => {
    if (!addCollAmt || !loanId) return;
    const amt = parseUnits(addCollAmt, 18);
    write1({
      address: CONTRACTS.wBTC as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACTS.JubileeLending as `0x${string}`, amt],
    });
    setTimeout(() => {
      write2({
        address: CONTRACTS.JubileeLending as `0x${string}`,
        abi: LENDING_ABI,
        functionName: "addCollateral",
        args: [BigInt(loanId), amt],
      });
    }, 15000);
  };

  if (!isConnected) {
    return (
      <div style={{ textAlign: "center", padding: "6rem 0" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem", opacity: 0.5 }}>🏦</div>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Connect Your Wallet</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Connect to Base Sepolia to deposit collateral and borrow jUSDi.
        </p>
      </div>
    );
  }

  const wbtcBal = wbtcBalance ? Number(formatUnits(wbtcBalance as bigint, 18)) : 0;
  const jusdiBal = jusdiBalance ? Number(formatUnits(jusdiBalance as bigint, 18)) : 0;
  const hf = borrowAmt && Number(borrowAmt) > 0 ? (85000 * 0.75) / Number(borrowAmt) : 999;

  return (
    <div>
      <h1 style={{ fontSize: "2.25rem", fontWeight: 700, marginBottom: "0.625rem" }}>Borrow</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
        Deposit wBTC as collateral and borrow jUSDi at 0% interest.
      </p>

      {/* Loan ID selector */}
      <div className="card" style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <span className="stat-label" style={{ marginBottom: 0 }}>Loan ID</span>
        <input
          type="number"
          placeholder="Enter ID after deposit"
          value={loanId}
          onChange={(e) => setLoanId(e.target.value)}
          className="input-field"
          style={{ maxWidth: "200px", fontSize: "0.875rem", padding: "0.5rem 0.75rem" }}
        />
        <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
          Depositing creates a new Loan ID. Use it to borrow, repay, or add collateral.
        </span>
      </div>

      {/* Deposit + Borrow */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        {/* Deposit */}
        <div className="card">
          <div className="stat-label">Deposit Collateral</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.75rem" }}>
            Balance: <span style={{ color: "var(--text-secondary)" }}>{wbtcBal.toFixed(4)} wBTC</span>
          </div>
          <input
            type="number"
            placeholder="0.0"
            value={depositAmt}
            onChange={(e) => setDepositAmt(e.target.value)}
            className="input-field"
            style={{ marginBottom: "1rem" }}
          />
          <button
            className="btn-primary"
            onClick={handleDeposit}
            disabled={!depositAmt || Number(depositAmt) <= 0 || l1 || l2}
          >
            {l1 || l2 ? "⏳ Confirming…" : "Approve & Deposit wBTC"}
          </button>
        </div>

        {/* Borrow */}
        <div className="card">
          <div className="stat-label">Borrow jUSDi</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.75rem" }}>
            Max LTV: <span style={{ color: "var(--text-secondary)" }}>75%</span>
          </div>
          <input
            type="number"
            placeholder="0.0"
            value={borrowAmt}
            onChange={(e) => setBorrowAmt(e.target.value)}
            className="input-field"
            style={{ marginBottom: "0.75rem" }}
          />
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginBottom: "0.375rem" }}>
              Health Factor
            </div>
            <HealthGauge value={hf} />
          </div>
          <button
            className="btn-primary"
            onClick={handleBorrow}
            disabled={!borrowAmt || !loanId || l3}
          >
            {l3 ? "⏳ Confirming…" : "Borrow jUSDi"}
          </button>
        </div>
      </div>

      {/* Repay + Add Collateral */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        {/* Repay */}
        <div className="card">
          <div className="stat-label">Repay Debt</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.75rem" }}>
            jUSDi Balance: <span style={{ color: "var(--text-secondary)" }}>{jusdiBal.toLocaleString()}</span>
          </div>
          <input
            type="number"
            placeholder="0.0"
            value={repayAmt}
            onChange={(e) => setRepayAmt(e.target.value)}
            className="input-field"
            style={{ marginBottom: "1rem" }}
          />
          <button
            className="btn-secondary"
            onClick={handleRepay}
            disabled={!repayAmt || !loanId || l4}
          >
            {l4 ? "⏳ Confirming…" : "Approve & Repay"}
          </button>
        </div>

        {/* Add Collateral */}
        <div className="card">
          <div className="stat-label">Add Collateral</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.75rem" }}>
            Strengthen your position without a new loan
          </div>
          <input
            type="number"
            placeholder="0.0 wBTC"
            value={addCollAmt}
            onChange={(e) => setAddCollAmt(e.target.value)}
            className="input-field"
            style={{ marginBottom: "1rem" }}
          />
          <button
            className="btn-secondary"
            onClick={handleAddCollateral}
            disabled={!addCollAmt || !loanId || l1 || l2}
          >
            {l1 || l2 ? "⏳ Confirming…" : "Add Collateral"}
          </button>
        </div>
      </div>

      {/* Info tip */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderRadius: "12px",
          background: "var(--accent-gold-glow)",
          border: "1px solid var(--accent-gold-border)",
          fontSize: "0.8rem",
          color: "var(--text-secondary)",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "var(--accent-gold)" }}>How it works:</strong>{" "}
        Deposit wBTC → receive a Loan ID → borrow jUSDi up to 75% LTV.
        Your collateral generates yield that pays off your debt over time. Interest: <strong style={{ color: "var(--accent-gold)" }}>always 0%</strong>.
      </div>
    </div>
  );
}
