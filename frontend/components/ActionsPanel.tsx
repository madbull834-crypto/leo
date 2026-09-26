import { useState } from 'react';
import type { UserProfile } from '../types/lio';

function shortAddress(value: string): string {
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

export function ActionsPanel({
  accounts,
  account,
  profile,
  busy,
  minimumInvestment,
  onActivate,
  onClaimRoi,
  onClaimWeekly,
  onWithdraw,
}: {
  accounts: string[];
  account: string;
  profile?: UserProfile;
  busy: boolean;
  minimumInvestment: bigint;
  onActivate: (referrer: string, amount: string) => void;
  onClaimRoi: () => void;
  onClaimWeekly: () => void;
  onWithdraw: () => void;
}) {
  const [referrer, setReferrer] = useState(accounts[0] ?? '');
  const [amount, setAmount] = useState('5000');

  const isActive = Boolean(profile?.active);
  const belowMinimum = amount !== '' && BigInt(amount || '0') < minimumInvestment;

  return (
    <>
      <div className="grid-cards">
        <section className="card span-6">
          <div className="card-head">
            <div>
              <h2 className="card-title">Activate a position</h2>
              <p className="card-sub">Calls TheLio.activateInvestor as the selected account</p>
            </div>
          </div>
          <div className="card-body">
            <div className="field-row">
              <label htmlFor="referrer">Referrer</label>
              <select
                id="referrer"
                className="mono"
                value={referrer}
                onChange={(event) => setReferrer(event.target.value)}
              >
                {accounts
                  .filter((candidate) => candidate !== account)
                  .map((candidate) => (
                    <option key={candidate} value={candidate}>{candidate}</option>
                  ))}
              </select>
            </div>

            <div className="field-row">
              <label htmlFor="amount">Amount</label>
              <input
                id="amount"
                className="mono"
                value={amount}
                inputMode="numeric"
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ''))}
              />
            </div>

            {belowMinimum && (
              <p className="note" style={{ color: 'var(--status-critical)' }}>
                Below the configured minimum of {minimumInvestment.toString()}; the call would revert.
              </p>
            )}

            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || isActive || !referrer || !amount || belowMinimum}
                onClick={() => onActivate(referrer, amount)}
              >
                Activate investment
              </button>
            </div>

            <p className="note">
              Activation transfers the configured payment asset into the contract.
              ERC20 deployments require an approval before activation.
              {isActive && ' This account already holds a position.'}
            </p>
          </div>
        </section>

        <section className="card span-6">
          <div className="card-head">
            <div>
              <h2 className="card-title">Claims and withdrawal</h2>
              <p className="card-sub">Acting as {shortAddress(account || '0x')}</p>
            </div>
          </div>
          <div className="card-body">
            <div className="btn-row" style={{ marginTop: 0 }}>
              <button type="button" className="btn" disabled={busy || !isActive} onClick={onClaimRoi}>
                Claim ROI
              </button>
              <button type="button" className="btn" disabled={busy || !isActive} onClick={onClaimWeekly}>
                Claim weekly reward
              </button>
              <button type="button" className="btn" disabled={busy || !isActive} onClick={onWithdraw}>
                Withdraw principal
              </button>
            </div>

            <p className="note">
              These reverts are the contracts working as intended, not bugs:
              Claim ROI needs a full 30-day period accrued since the last claim,
              Claim weekly reward rejects a second claim in the same week id, and
              Withdraw principal stays locked until the 183-day unlock timestamp.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
