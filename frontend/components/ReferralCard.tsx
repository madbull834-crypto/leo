import { useMemo, useState } from 'react';

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

export function ReferralCard({ account, active, rewardPercent }: {
  account: string;
  active: boolean;
  rewardPercent: number;
}) {
  const [message, setMessage] = useState('');
  const referralLink = useMemo(() => {
    if (!account) return '';
    const url = new URL(window.location.href);
    url.searchParams.set('ref', account);
    url.hash = 'actions';
    return url.toString();
  }, [account]);

  const copy = async (value: string, success: string) => {
    try {
      await copyText(value);
      setMessage(success);
    } catch {
      setMessage('Could not copy. Please select and copy it manually.');
    }
  };

  const share = async () => {
    if (!referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join THE LIOX',
          text: 'Use my referral link to join THE LIOX.',
          url: referralLink,
        });
        setMessage('Referral link shared.');
        return;
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') return;
      }
    }
    await copy(referralLink, 'Referral link copied. You can share it anywhere.');
  };

  return (
    <section className="card span-12 referral-card">
      <div className="card-head">
        <div>
          <span className="eyebrow">INVITE &amp; EARN</span>
          <h2 className="card-title">Your referral link</h2>
          <p className="card-sub">
            Share this link with someone you know. You receive {rewardPercent}% when they activate their investment.
          </p>
        </div>
        <span className={`pill ${active ? 'pill-good' : ''}`}>{active ? 'Ready to share' : 'Activate first'}</span>
      </div>
      <div className="card-body">
        {active ? (
          <>
            <div className="referral-value">
              <input className="mono" readOnly value={referralLink} aria-label="Your referral link" />
              <button type="button" className="btn btn-primary" onClick={() => void share()}>Share link</button>
            </div>
            <div className="referral-actions">
              <button type="button" className="btn" onClick={() => void copy(referralLink, 'Referral link copied.')}>Copy link</button>
              <button type="button" className="btn" onClick={() => void copy(account, 'Wallet address copied.')}>Copy wallet address</button>
              {message && <span className="copy-message" role="status">{message}</span>}
            </div>
          </>
        ) : (
          <p className="empty-state">Activate your investment first. Your personal referral link will appear here.</p>
        )}
      </div>
    </section>
  );
}
