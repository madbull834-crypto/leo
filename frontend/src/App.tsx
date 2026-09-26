import { useState } from 'react';
import { useLio } from '../hooks/useLio';
import { useTheme } from '../hooks/useTheme';
import { Tabs, type TabDef } from '../components/ui/Tabs';
import { OverviewTab } from '../components/OverviewTab';
import { TiersTab } from '../components/TiersTab';
import { ProtocolTab } from '../components/ProtocolTab';
import { ActionsPanel } from '../components/ActionsPanel';
import { CONTRACT_ADDRESS } from '../lib/contract';

const TABS: TabDef[] = [
  { id: 'overview', label: 'Dashboard' },
  { id: 'tiers', label: 'Rewards' },
  { id: 'protocol', label: 'Contract details' },
  { id: 'actions', label: 'Get started' },
];

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

/** Tabs are reflected in the URL hash so a view can be linked and reloaded. */
function initialTab(): string {
  const fromHash = window.location.hash.replace('#', '');
  return TABS.some((tab) => tab.id === fromHash) ? fromHash : 'overview';
}

export default function App() {
  const {
    state, busy, txMessage, reload, connectWallet, selectAccount,
    requestTestUsdt, approveInvestment, activate, claimRoi, claimWeekly, withdrawPrincipal,
  } = useLio();
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState(initialTab);

  const changeTab = (id: string) => {
    setTab(id);
    window.history.replaceState(null, '', `#${id}`);
  };

  const isDown = state.status === 'error';
  const isLoading = state.status === 'loading';

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-main">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true"><span>L</span></span>
              <span className="brand-text">
                <strong>THE LIO</strong>
                <span>BUSINESS PROTOCOL</span>
              </span>
            </div>

            <div className="topbar-actions">
              <span className="net-chip">
                <span className={`net-dot ${isDown ? 'is-down' : 'is-live'}`} aria-hidden="true" />
                {isDown ? 'Unavailable' : state.chainId === '97' ? 'BSC Testnet' : `Chain ${state.chainId}`}
              </span>
              <span className="net-chip mono" title={CONTRACT_ADDRESS}>
                {shortAddress(CONTRACT_ADDRESS)}
              </span>
              <button
                type="button"
                className="btn btn-icon"
                onClick={toggle}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                {theme === 'dark' ? '☀' : '☾'}
              </button>
            </div>
          </div>

          <Tabs tabs={TABS} active={tab} onChange={changeTab} />
        </div>
      </header>

      <main className="content">
        <section className="dashboard-intro" aria-labelledby="dashboard-title">
          <div>
            <span className="eyebrow">THE LIO · BSC TESTNET</span>
            <h1 id="dashboard-title">Your growth, clearly tracked</h1>
            <p>Follow your investment, monthly returns, referral rewards and team progress from one secure dashboard.</p>
          </div>
          <div className="intro-emblem" aria-hidden="true">
            <span>THE</span>
            <strong>LIO</strong>
          </div>
        </section>

        {isDown && (
          <div className="banner banner-crit">
            <span aria-hidden="true">⚠</span>
            <span>{state.message}</span>
          </div>
        )}

        {txMessage && (
          <div className={`banner ${txMessage.includes('failed') ? 'banner-crit' : 'banner-good'}`}>
            <span aria-hidden="true">{txMessage.includes('failed') ? '⚠' : '✓'}</span>
            <span>{txMessage}</span>
          </div>
        )}

        {state.status === 'ready' && state.accounts.length === 0 && (
          <div className="wallet-callout">
            <div>
              <strong>Connect your wallet to get started</strong>
              <span>Use BSC Testnet only. Test tokens have no real-world value.</span>
            </div>
            <button type="button" className="btn btn-primary" onClick={connectWallet} disabled={busy}>
              Connect wallet
            </button>
          </div>
        )}

        {state.accounts.length > 0 && (
          <div className="filter-bar">
            <span className="filter-label">Connected wallet</span>
            <select
              className="mono"
              value={state.account}
              onChange={(event) => selectAccount(event.target.value)}
              aria-label="Select account"
            >
              {state.accounts.map((candidate) => (
                <option key={candidate} value={candidate}>{candidate}</option>
              ))}
            </select>
            <button type="button" className="btn" onClick={reload} disabled={busy}>
              Refresh data
            </button>
          </div>
        )}

        {isLoading && (
          <div className="grid-cards">
            <div className="skeleton span-3" /><div className="skeleton span-3" />
            <div className="skeleton span-3" /><div className="skeleton span-3" />
            <div className="skeleton span-4" style={{ height: 300 }} />
            <div className="skeleton span-8" style={{ height: 300 }} />
          </div>
        )}

        {state.status === 'ready' && (
          /* Refetch keeps the frame: hold the render, no layout jump. */
          <div className={busy ? 'is-refreshing' : undefined}>
            {tab === 'overview' && <OverviewTab state={state} />}
            {tab === 'tiers' && <TiersTab state={state} />}
            {tab === 'protocol' && <ProtocolTab state={state} />}
            {tab === 'actions' && state.config && (
              <ActionsPanel
                account={state.account}
                treasury={state.config.treasury}
                profile={state.profile}
                busy={busy}
                minimumInvestment={state.config.minimumInvestment}
                paymentBalance={state.paymentBalance}
                paymentAllowance={state.paymentAllowance}
                onRequestTokens={requestTestUsdt}
                onApprove={approveInvestment}
                onActivate={activate}
                onClaimRoi={claimRoi}
                onClaimWeekly={claimWeekly}
                onWithdraw={withdrawPrincipal}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
