import { useMemo, useState } from 'react';
import { formatUnits, isAddress, parseUnits } from 'ethers';
import { PAYMENT_ASSET_DECIMALS, PAYMENT_ASSET_SYMBOL } from '../lib/contract';
import { formatUnitsRaw } from '../lib/format';
import type { UserProfile } from '../types/lio';

function shortAddress(value: string): string {
  return value ? `${value.slice(0, 8)}...${value.slice(-6)}` : 'Not connected';
}

function Step({ number, title, text, done, children }: {
  number: number;
  title: string;
  text: string;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`action-step ${done ? 'is-done' : ''}`}>
      <div className="step-number" aria-hidden="true">{done ? '✓' : number}</div>
      <div className="step-content">
        <div className="step-heading">
          <h3>{title}</h3>
          {done && <span className="pill pill-good">Ready</span>}
        </div>
        <p>{text}</p>
        {children}
      </div>
    </div>
  );
}

export function ActionsPanel({
  account,
  treasury,
  profile,
  busy,
  minimumInvestment,
  paymentBalance,
  paymentAllowance,
  onRequestTokens,
  onApprove,
  onActivate,
  onClaimRoi,
  onClaimWeekly,
  onWithdraw,
}: {
  account: string;
  treasury: string;
  profile?: UserProfile;
  busy: boolean;
  minimumInvestment: bigint;
  paymentBalance: bigint;
  paymentAllowance: bigint;
  onRequestTokens: () => void;
  onApprove: (amount: string) => void;
  onActivate: (referrer: string, amount: string) => void;
  onClaimRoi: () => void;
  onClaimWeekly: () => void;
  onWithdraw: () => void;
}) {
  const [referrer, setReferrer] = useState(treasury);
  const [amount, setAmount] = useState(formatUnits(minimumInvestment, PAYMENT_ASSET_DECIMALS));

  const amountUnits = useMemo(() => {
    try {
      return parseUnits(amount || '0', PAYMENT_ASSET_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  const isActive = Boolean(profile?.active);
  const validReferrer = isAddress(referrer) && referrer.toLowerCase() !== account.toLowerCase();
  const hasBalance = paymentBalance >= amountUnits && amountUnits > 0n;
  const hasApproval = paymentAllowance >= amountUnits && amountUnits > 0n;
  const meetsMinimum = amountUnits >= minimumInvestment;

  return (
    <div className="grid-cards">
      <section className="card span-7 action-card">
        <div className="card-head">
          <div>
            <span className="eyebrow">TESTNET SETUP</span>
            <h2 className="card-title action-title">Start your position</h2>
            <p className="card-sub">Complete these steps in order. Your wallet confirms every transaction.</p>
          </div>
        </div>

        <div className="action-steps">
          <Step number={1} title="Get test funds"
            text={`Receive 10,000 free ${PAYMENT_ASSET_SYMBOL}. These tokens have no real-world value.`}
            done={paymentBalance > 0n}>
            <div className="step-actions">
              <button type="button" className="btn" disabled={busy || !account} onClick={onRequestTokens}>
                Get 10,000 {PAYMENT_ASSET_SYMBOL}
              </button>
              <span className="balance-label">Balance: <strong>{formatUnitsRaw(paymentBalance)}</strong></span>
            </div>
          </Step>

          <Step number={2} title="Choose your investment"
            text={`Minimum ${formatUnitsRaw(minimumInvestment)}. Enter the wallet that referred you.`}
            done={meetsMinimum && validReferrer}>
            <div className="field-grid">
              <label>
                <span>Investment amount</span>
                <div className="input-affix">
                  <input value={amount} inputMode="decimal"
                    onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}
                    aria-label="Investment amount" />
                  <span>{PAYMENT_ASSET_SYMBOL}</span>
                </div>
              </label>
              <label>
                <span>Referrer wallet</span>
                <input className="mono" value={referrer}
                  onChange={(event) => setReferrer(event.target.value.trim())}
                  placeholder="0x..." aria-label="Referrer wallet address" />
              </label>
            </div>
            {!meetsMinimum && <p className="form-error">Enter at least {formatUnitsRaw(minimumInvestment)}.</p>}
            {referrer && !validReferrer && <p className="form-error">Use a valid wallet other than your own.</p>}
          </Step>

          <Step number={3} title="Approve and activate"
            text={`Approval lets THE LIOX transfer only the ${PAYMENT_ASSET_SYMBOL} amount you enter.`}
            done={isActive}>
            <div className="step-actions">
              <button type="button" className="btn"
                disabled={busy || !account || !hasBalance || !meetsMinimum || hasApproval}
                onClick={() => onApprove(amount)}>
                {hasApproval ? 'Amount approved' : `Approve ${PAYMENT_ASSET_SYMBOL}`}
              </button>
              <button type="button" className="btn btn-primary"
                disabled={busy || isActive || !validReferrer || !hasBalance || !hasApproval || !meetsMinimum}
                onClick={() => onActivate(referrer, amount)}>
                {isActive ? 'Position active' : 'Activate position'}
              </button>
            </div>
          </Step>
        </div>
      </section>

      <section className="card span-5">
        <div className="card-head">
          <div>
            <span className="eyebrow">YOUR POSITION</span>
            <h2 className="card-title action-title">Rewards and withdrawal</h2>
            <p className="card-sub">Wallet {shortAddress(account)}</p>
          </div>
          <span className={`pill ${isActive ? 'pill-good' : ''}`}>{isActive ? 'Active' : 'Not active'}</span>
        </div>
        <div className="card-body">
          <div className="claim-list">
            <div><strong>Monthly ROI</strong><span>Available after each complete 30-day period.</span>
              <button type="button" className="btn" disabled={busy || !isActive} onClick={onClaimRoi}>Claim ROI</button></div>
            <div><strong>Weekly team reward</strong><span>Available when your matched team volume reaches a tier.</span>
              <button type="button" className="btn" disabled={busy || !isActive} onClick={onClaimWeekly}>Claim weekly reward</button></div>
            <div><strong>Original investment</strong><span>Unlocks 183 days after activation.</span>
              <button type="button" className="btn" disabled={busy || !isActive} onClick={onWithdraw}>Withdraw investment</button></div>
          </div>
          {!isActive && <div className="help-box"><strong>Nothing to claim yet</strong>
            <span>Complete the setup steps to activate your first position.</span></div>}
        </div>
      </section>
    </div>
  );
}
