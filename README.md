# THE LIO

This repository contains the smart-contract architecture and implementation for THE LIO, built in line with the Phase 1-3 business requirements and architecture decisions captured during requirements analysis.

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

The contract keeps principal and earned rewards as liabilities. Fund the treasury
with enough surplus before activation so the one-time 5% referral commission can
be paid immediately without using locked principal. ROI, weekly rewards, expense
benefits, and principal withdrawals also require fully backed liabilities.

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

The dashboard signs transactions with Hardhat's unlocked dev accounts (picked in
the "Acting as" dropdown), so no browser wallet is required.

`seed:local` builds a realistic cohort: four investors on different tiers,
unbalanced binary legs, a funded treasury, and real accrued ROI (it advances
chain time by 95 days, since `accrueROI` only credits whole 30-day periods).

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
