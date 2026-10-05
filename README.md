# THE LIOX

This repository contains the smart-contract architecture and implementation for THE LIOX, built in line with the Phase 1-3 business requirements and architecture decisions captured during requirements analysis.

## Monorepo layout

- `contracts/`: Solidity contracts, Hardhat config, deployment scripts
- `frontend/`: React + Vite dashboard wired to the deployed contracts
- `docs/`: business rules, architecture, security, deployment, and TODO clarifications

## Important

The fixed percentages, tiers, and tour targets come from the supplied business
plan. Per-user ROI can be assigned only inside the plan's 8%-32% range.

Amounts use the payment asset's smallest unit. The constructor minimum represents
$100 and derives one business-dollar unit from it. For example, pass `100_000_000`
for a six-decimal stablecoin; all thresholds and rewards are scaled automatically.

The BSC Testnet deployment uses `TestUSDT` (`tUSDT`), a six-decimal test-only
token. Any test wallet can call `faucet()` to receive 10,000 tUSDT, then approve
the `TheLio` contract before activating an investment. The faucet and unrestricted
`mint` function are intentionally unsafe and must never be used on mainnet.

BSC mainnet uses a separate guarded deployment path with no test token or seed
step. See [`docs/mainnet-deployment.md`](docs/mainnet-deployment.md) for release
gates, environment variables, role handoff, verification, and launch checks.

Each activation sends 50% of the deposit immediately to the configured business
treasury. The full deposit remains the investor's principal and ROI basis. The
contract retains the other 50%, pays the one-time 5% referral commission, and
allows the deployer to add funds through `fundTreasury` whenever an ROI, reward,
or principal payment requires more cash. Each payout succeeds only when the
contract currently holds enough for that payment. The treasury is the referral
root; all other referrers must hold an active investment.

The PDF does not define binary-tree placement or a fresh-business time window, so
an account with `OPERATOR_ROLE` supplies verified left, right, and fresh volumes.
Weekly qualification uses `2 * min(left, right)`, preventing one-sided volume from
qualifying. Expense benefits are one-time tier entitlements; moving to a higher
tier credits only the difference, so the user's total benefit equals that tier.

## Running locally

Three terminals, from `the-lio/`:

```bash
# 1. contracts: start the local chain
cd contracts
npm install
npm run node

# 2. contracts: compile, deploy, and seed demo data
cd contracts
npm run compile
npm run check:plan
npm run deploy:local
npm run seed:local      # optional: activates a demo investor

# 3. frontend
cd frontend
npm install
npm run dev             # http://localhost:5173
```

`deploy:local` writes `frontend/config/TheLio.abi.json` and
`frontend/config/deployment.json`, which is how the frontend discovers the ABI
and contract address. Re-run it whenever you restart the Hardhat node, since a
fresh node resets the chain.

`TheLio` is deployed behind an ERC-1967 Transparent proxy. The deployment
metadata records the stable proxy address used by the frontend, the replaceable
implementation address, and the dedicated `ProxyAdmin`. Only the `ProxyAdmin`
owner can upgrade the implementation. The implementation disables direct
initialization; all setup must happen atomically through `deployProxy`.

The dashboard signs transactions with Hardhat's unlocked dev accounts (picked in
the "Acting as" dropdown), so no browser wallet is required.

`seed:local` builds a realistic cohort: four investors on different tiers,
unbalanced binary legs, a funded treasury, and real accrued ROI (it advances
chain time by 95 days; ROI accrues continuously, prorated per second from its
configured 30-day monthly rate).

## Dashboard

Four tabs, deep-linked by URL hash (`#overview`, `#tiers`, `#protocol`,
`#actions`), with a light/dark toggle that persists per browser.

Charts are hand-rolled SVG with no chart library. Two conventions are load-
bearing, so keep them if you add charts:

- **Colors are validated, not chosen by eye.** The categorical slots and the
  5-step ordinal tier ramp in `src/styles.css` were checked for colorblind
  separation and surface contrast in *both* themes. The hexes carry comments
  saying what passed; re-validate before changing one.
- **Every chart sizes its viewBox to its measured container**
  (`hooks/useChartWidth.ts`). A fixed viewBox scales its text with the card, so
  the same label renders ~21px on a wide card and ~7px on a phone.

Charts with a low-contrast series ship a table view toggle, which is also the
keyboard/no-hover path to every value.

## Notes on the build

- `viaIR` is enabled in `hardhat.config.ts`. The 15-field `UserProfile` struct is
  returned by value from `getUser`/`getUserProfile`, which overflows the stack
  under the legacy codegen pipeline.
- Every contract except `TheLio` is `abstract`; only `TheLio` supplies the
  `LioCore` constructor arguments.
