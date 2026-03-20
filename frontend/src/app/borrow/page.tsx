"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { CONTRACTS } from "@/constants/contracts";

const LENDING_ABI_FULL = [
  { name: "depositCollateral", type: "function", stateMutability: "nonpayable", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "borrow", type: "function", stateMutability: "nonpayable", inputs: [{ name: "loanId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "repay", type: "function", stateMutability: "nonpayable", inputs: [{ name: "loanId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "addCollateral", type: "function", stateMutability: "nonpayable", inputs: [{ name: "loanId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "withdrawCollateral", type: "function", stateMutability: "nonpayable", inputs: [{ name: "loanId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "loanCounter", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "loans", type: "function", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "id", type: "uint256" }, { name: "borrower", type: "address" }, { name: "collateralAsset", type: "address" }, { name: "collateralAmount", type: "uint256" }, { name: "borrowedAmount", type: "uint256" }, { name: "active", type: "bool" }] },
] as const;

const ERC20_ABI_FULL = [
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

const CM_ABI = [
  { name: "getCollateralValue", type: "function", stateMutability: "view", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "calculateHealthFactor", type: "function", stateMutability: "pure", inputs: [{ name: "borrowedValue", type: "uint256" }, { name: "collateralValue", type: "uint256" }, { name: "collateralFactor", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "getBoostedCollateralFactor", type: "function", stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "asset", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

function HealthGauge({ value }: { value: number }) {
  const color = value >= 2 ? "var(--success)" : value >= 1.5 ? "var(--warning)" : "var(--danger)";
  const width = Math.min(value / 3 * 100, 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <div style={{ flex: 1, height: "8px", background: "var(--border)", borderRadius: "4px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${width}%`, background: color, borderRadius: "4px", transition: "width 0.3s" }} />
      </div>
      <span style={{ fontWeight: 700, color, fontSize: "0.875rem", minWidth: "3rem" }}>{value.toFixed(2)}</span>
    </div>
  );
}

function TxButton({ label, onClick, disabled, loading }: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: "100%",
        padding: "0.75rem",
        borderRadius: "8px",
        border: "none",
        fontWeight: 600,
        fontSize: "0.875rem",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        background: disabled ? "var(--border)" : "var(--accent-gold)",
        color: disabled ? "var(--text-secondary)" : "#0a0a0f",
        opacity: loading ? 0.7 : 1,
        transition: "all 0.2s",
      }}
    >
      {loading ? "⏳ Confirming..." : label}
    </button>
  );
}

export default function BorrowPage() {
  const { address, isConnected } = useAccount();
  const [depositAmt, setDepositAmt] = useState("");
  const [borrowAmt, setBorrowAmt] = useState("");
  const [repayAmt, setRepayAmt] = useState("");
  const [selectedLoan, setSelectedLoan] = useState<number | null>(null);
  const [step, setStep] = useState<"idle" | "approving" | "depositing" | "borrowing" | "repaying">("idle");

  // Read user's wBTC balance
  const { data: wbtcBalance } = useReadContract({
    address: CONTRACTS.wBTC as `0x${string}`,
    abi: ERC20_ABI_FULL,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // Read user's jUSDi balance
  const { data: jusdiBalance } = useReadContract({
    address: CONTRACTS.jUSDi as `0x${string}`,
    abi: ERC20_ABI_FULL,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // Read loan counter
  const { data: loanCounter } = useReadContract({
    address: CONTRACTS.JubileeLending as `0x${string}`,
    abi: LENDING_ABI_FULL,
    functionName: "loanCounter",
  });

  // Write contracts
  const { writeContract: approveWrite, data: approveTx } = useWriteContract();
  const { writeContract: depositWrite, data: depositTx } = useWriteContract();
  const { writeContract: borrowWrite, data: borrowTx } = useWriteContract();
  const { writeContract: repayWrite, data: repayTx } = useWriteContract();
  const { writeContract: approveJusdi } = useWriteContract();

  const { isLoading: isApproving } = useWaitForTransactionReceipt({ hash: approveTx });
  const { isLoading: isDepositing } = useWaitForTransactionReceipt({ hash: depositTx });
  const { isLoading: isBorrowing } = useWaitForTransactionReceipt({ hash: borrowTx });
  const { isLoading: isRepaying } = useWaitForTransactionReceipt({ hash: repayTx });

  const handleDeposit = async () => {
    if (!depositAmt) return;
    const amount = parseUnits(depositAmt, 18);
    setStep("approving");
    approveWrite({
      address: CONTRACTS.wBTC as `0x${string}`,
      abi: ERC20_ABI_FULL,
      functionName: "approve",
      args: [CONTRACTS.JubileeLending as `0x${string}`, amount],
    });
    // Wait, then deposit
    setTimeout(() => {
      setStep("depositing");
      depositWrite({
        address: CONTRACTS.JubileeLending as `0x${string}`,
        abi: LENDING_ABI_FULL,
        functionName: "depositCollateral",
        args: [CONTRACTS.wBTC as `0x${string}`, amount],
      });
    }, 15000);
  };

  const handleBorrow = async () => {
    if (!borrowAmt || selectedLoan === null) return;
    setStep("borrowing");
    borrowWrite({
      address: CONTRACTS.JubileeLending as `0x${string}`,
      abi: LENDING_ABI_FULL,
      functionName: "borrow",
      args: [BigInt(selectedLoan), parseUnits(borrowAmt, 18)],
    });
  };

  const handleRepay = async () => {
    if (!repayAmt || selectedLoan === null) return;
    const amount = parseUnits(repayAmt, 18);
    setStep("repaying");
    approveJusdi({
      address: CONTRACTS.jUSDi as `0x${string}`,
      abi: ERC20_ABI_FULL,
      functionName: "approve",
      args: [CONTRACTS.JubileeLending as `0x${string}`, amount],
    });
    setTimeout(() => {
      repayWrite({
        address: CONTRACTS.JubileeLending as `0x${string}`,
        abi: LENDING_ABI_FULL,
        functionName: "repay",
        args: [BigInt(selectedLoan), amount],
      });
    }, 15000);
  };

  if (!isConnected) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 0" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Connect Your Wallet</h1>
        <p style={{ color: "var(--text-secondary)" }}>Connect a wallet to deposit collateral and borrow jUSDi.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem", letterSpacing: "-0.03em" }}>
        Borrow
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
        Deposit wBTC as collateral and borrow jUSDi at 0% interest.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Deposit Panel */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Deposit Collateral</h3>
          <div style={{ marginBottom: "0.5rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            Balance: {wbtcBalance ? Number(formatUnits(wbtcBalance as bigint, 18)).toFixed(4) : "0"} wBTC
          </div>
          <input
            type="number"
            placeholder="0.0 wBTC"
            value={depositAmt}
            onChange={(e) => setDepositAmt(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontSize: "1.25rem",
              marginBottom: "1rem",
              outline: "none",
            }}
          />
          <TxButton
            label="Approve & Deposit wBTC"
            onClick={handleDeposit}
            disabled={!depositAmt || Number(depositAmt) <= 0}
            loading={isApproving || isDepositing}
          />
        </div>

        {/* Borrow Panel */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Borrow jUSDi</h3>
          <div style={{ marginBottom: "0.5rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            Loan ID:{" "}
            <input
              type="number"
              placeholder="e.g. 1"
              value={selectedLoan ?? ""}
              onChange={(e) => setSelectedLoan(Number(e.target.value))}
              style={{
                width: "60px",
                padding: "0.25rem 0.5rem",
                borderRadius: "4px",
                border: "1px solid var(--border)",
                background: "var(--bg-primary)",
                color: "var(--accent-gold)",
                fontSize: "0.8rem",
              }}
            />
          </div>
          <input
            type="number"
            placeholder="0.0 jUSDi"
            value={borrowAmt}
            onChange={(e) => setBorrowAmt(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontSize: "1.25rem",
              marginBottom: "0.5rem",
              outline: "none",
            }}
          />
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Health Factor</div>
            <HealthGauge value={borrowAmt && Number(borrowAmt) > 0 ? 85000 * 0.75 / Number(borrowAmt) : 999} />
          </div>
          <TxButton
            label="Borrow jUSDi"
            onClick={handleBorrow}
            disabled={!borrowAmt || selectedLoan === null}
            loading={isBorrowing}
          />
        </div>
      </div>

      {/* Repay */}
      <div style={{ marginTop: "1.5rem", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.5rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Repay Debt</h3>
        <div style={{ display: "flex", gap: "1rem", alignItems: "end" }}>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: "0.5rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              jUSDi Balance: {jusdiBalance ? Number(formatUnits(jusdiBalance as bigint, 18)).toLocaleString() : "0"}
            </div>
            <input
              type="number"
              placeholder="0.0 jUSDi"
              value={repayAmt}
              onChange={(e) => setRepayAmt(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                fontSize: "1.25rem",
                outline: "none",
              }}
            />
          </div>
          <div style={{ width: "200px" }}>
            <TxButton
              label="Repay"
              onClick={handleRepay}
              disabled={!repayAmt || selectedLoan === null}
              loading={isRepaying}
            />
          </div>
        </div>
      </div>

      {/* Info */}
      <div style={{ marginTop: "1.5rem", padding: "1rem", borderRadius: "8px", background: "var(--accent-gold-glow)", border: "1px solid rgba(212, 168, 83, 0.2)" }}>
        <p style={{ fontSize: "0.8rem", color: "var(--accent-gold)", margin: 0 }}>
          💡 <strong>How it works:</strong> Deposit wBTC → get a Loan ID → borrow jUSDi up to 75% LTV. Your collateral generates yield that pays off your debt over time. Interest rate is always 0%.
        </p>
      </div>
    </div>
  );
}
