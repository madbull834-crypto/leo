# BSC mainnet deployment runbook

Mainnet deployment is intentionally a separate, guarded flow. It never deploys
`TestUSDT`, never seeds accounts, and refuses to run unless the provider reports
BSC chain ID 56 and the exact deployment confirmation is present.

## Release gates

Do not deploy until all of these are complete:

- An independent smart-contract audit has approved the exact commit and compiler settings.
- Legal/compliance review has approved the investment, referral, and ROI model in every served jurisdiction.
- A production ERC-20 has been selected and tested. Fee-on-transfer, rebasing, and callback tokens are not supported.
- The treasury has a documented solvency policy. New investments create principal liabilities, while ROI and rewards create additional liabilities.
- The default admin and ProxyAdmin owner are multisigs with tested signer recovery.
- Operator, reward-manager, pauser, and treasury-role holders follow least privilege.
- Monitoring, incident response, pause procedures, and upgrade procedures have been rehearsed on testnet.
- The frontend origin, RPC service, wallet flow, and contract addresses have been reviewed independently.

## 1. Configure and preflight

Copy `contracts/.env.example` to `contracts/.env` and replace every mainnet
placeholder. `MAINNET_TREASURY_ADDRESS` is the business treasury recorded by the
contract; assets deposited into the protocol remain held by the proxy. The role
addresses and `MAINNET_PROXY_ADMIN_OWNER` should normally be multisigs.

The public RPC is written into frontend metadata. Do not place an authenticated
or rate-limited secret RPC URL in `BSC_MAINNET_PUBLIC_RPC_URL`.

```bash
cd contracts
npm ci
npm test
npm run preflight:bsc-mainnet
cd ../frontend
npm ci
npm run typecheck
npm run build
```

The preflight is read-only. Confirm its payment-token name, symbol, decimals,
minimum base-unit amount, treasury, default admin, and ProxyAdmin owner.

## 2. Deploy

Use a dedicated, funded deployer. Keep only enough BNB for deployment and role
handoff. The script pauses the new proxy, grants production roles, makes the
deployer renounce every role not explicitly assigned to it, transfers ProxyAdmin
ownership, verifies the handoff, and only then writes deployment records.

```bash
export MAINNET_DEPLOY_CONFIRMATION=DEPLOY_THE_LIOX_TO_BSC_MAINNET
npm run deploy:bsc-mainnet
```

The command refuses to overwrite `contracts/deployments/bsc-mainnet.json`. A
failed handoff leaves `bsc-mainnet.pending.json` with the recovery addresses and
must be reviewed manually before any retry. A successful deployment
also updates `frontend/config/deployment.json` and the frontend ABI. Commit the
deployment record after independently checking the transaction and addresses.

## 3. Verify and launch

```bash
npm run check:bsc-mainnet
npx hardhat verify --network bscMainnet <PROXY_ADDRESS>
cd ../frontend
npm run typecheck
npm run build
```

Before enabling user traffic, verify on BscScan that the proxy points to the
recorded implementation and ProxyAdmin, the ProxyAdmin owner is correct, every
role holder matches the deployment record, the plan is locked, and the payment
asset and minimum are correct. Fund treasury surplus according to the solvency
policy before the first activation; the immediate 5% referral payout otherwise
causes activation to revert.

The deployment script leaves the protocol paused. Fund and verify treasury
surplus, complete monitoring checks, then have the configured pauser submit
`unpause()` as the final controlled-launch action.
