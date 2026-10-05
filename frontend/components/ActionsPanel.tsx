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
  isTestnet,
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
  isTestnet: boolean;
}) {
  const [referrer, setReferrer] = useState(() => {
    const fromLink = new URLSearchParams(window.location.search).get('ref');
    return fromLink && isAddress(fromLink) ? fromLink : treasury;
  });
  const [amount, setAmount] = useState(formatUnits(minimumInvestment, PAYMENT_ASSET_DECIMALS));

  const amountUnits = useMemo(() => {
    try {
      return parseUnits(amount || '0', PAYMENT_ASSET_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  const isActive = Boolean(profile?.active);
  const linkedReferrer = new URLSearchParams(window.location.search).get('ref');
  const referralApplied = Boolean(
    linkedReferrer && isAddress(linkedReferrer) && linkedReferrer.toLowerCase() === referrer.toLowerCase(),
  );
  const validReferrer = isAddress(referrer) && referrer.toLowerCase() !== account.toLowerCase();
  const hasBalance = paymentBalance >= amountUnits && amountUnits > 0n;
  const hasApproval = paymentAllowance >= amountUnits && amountUnits > 0n;
  const meetsMinimum = amountUnits >= minimumInvestment;

  return (
    <div className="grid-cards">
      <section className="card span-7 action-card">
        <div className="card-head">
          <div>
            <span className="eyebrow">{isTestnet ? 'TESTNET SETUP' : 'MAINNET'}</span>
            <h2 className="card-title action-title">Make your investment</h2>
            <p className="card-sub">Follow these steps. Your wallet will ask you to confirm each transaction.</p>
          </div>
        </div>

        <div className="action-steps">
          {isTestnet && (
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
          )}

          <Step number={isTestnet ? 2 : 1} title="Enter your amount"
            text={`The minimum is ${formatUnitsRaw(minimumInvestment)}. Your ROI is calculated on the full amount. If someone invited you, their referral address is filled in automatically.`}
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
                <span>Who invited you?</span>
                <input className="mono" value={referrer}
                  onChange={(event) => setReferrer(event.target.value.trim())}
                  placeholder="0x..." aria-label="Referrer wallet address" />
              </label>
            </div>
            {referralApplied && <p className="form-hint">Referral link applied. This wallet will receive the referral reward.</p>}
            {!meetsMinimum && <p className="form-error">Enter at least {formatUnitsRaw(minimumInvestment)}.</p>}
            {referrer && !validReferrer && <p className="form-error">Use a valid wallet other than your own.</p>}
          </Step>

          <Step number={isTestnet ? 3 : 2} title="Confirm your investment"
            text={`First approve the exact ${PAYMENT_ASSET_SYMBOL} amount, then activate your investment.`}
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
                {isActive ? 'Investment active' : 'Activate investment'}
              </button>
            </div>
          </Step>
        </div>
      </section>

      <section className="card span-5">
        <div className="card-head">
          <div>
            <span className="eyebrow">YOUR INVESTMENT</span>
            <h2 className="card-title action-title">Your earnings</h2>
            <p className="card-sub">Wallet {shortAddress(account)}</p>
          </div>
          <span className={`pill ${isActive ? 'pill-good' : ''}`}>{isActive ? 'Active' : 'Not invested'}</span>
        </div>
        <div className="card-body">
          <div className="claim-list">
            <div><strong>ROI earnings</strong><span>Your ROI grows every second. Claim it whenever you want.</span>
              <button type="button" className="btn" disabled={busy || !isActive} onClick={onClaimRoi}>Claim ROI</button></div>
            <div><strong>Weekly team reward</strong><span>Available when both sides of your team reach a reward level.</span>
              <button type="button" className="btn" disabled={busy || !isActive} onClick={onClaimWeekly}>Claim weekly reward</button></div>
            <div><strong>Investment amount</strong><span>Available to withdraw 183 days after activation.</span>
              <button type="button" className="btn" disabled={busy || !isActive} onClick={onWithdraw}>Withdraw investment</button></div>
          </div>
          {!isActive && <div className="help-box"><strong>Nothing to claim yet</strong>
            <span>Make an investment first, then your claim options will appear here.</span></div>}
        </div>
      </section>
    </div>
  );
}
