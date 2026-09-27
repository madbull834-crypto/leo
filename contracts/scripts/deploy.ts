import { ethers, network, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Local/demo deployment parameters.
//
// The native-asset demo maps one wei to one business-dollar unit. For an ERC20,
// pass $100 in its smallest unit (for example 100_000_000 for six decimals).
const MINIMUM_INVESTMENT = 100;

// address(0) selects the native-asset code path in LioTreasury, which avoids
// requiring a separate ERC20 deployment for local runs.
const PAYMENT_ASSET = ethers.constants.AddressZero;

async function main() {
  const [deployer] = await ethers.getSigners();
  const treasury = deployer.address;

  console.log(`Network:  ${network.name} (chainId ${network.config.chainId ?? "?"})`);
  console.log(`Deployer: ${deployer.address}`);

  const factory = await ethers.getContractFactory("TheLio");
  const theLio = await upgrades.deployProxy(
    factory,
    [treasury, PAYMENT_ASSET, MINIMUM_INVESTMENT],
    { kind: "transparent", initializer: "initialize" },
  );
  await theLio.deployed();
  const implementation = await upgrades.erc1967.getImplementationAddress(theLio.address);
  const proxyAdmin = await upgrades.erc1967.getAdminAddress(theLio.address);

  console.log(`TheLio proxy:          ${theLio.address}`);
  console.log(`TheLio implementation: ${implementation}`);
  console.log(`ProxyAdmin:            ${proxyAdmin}`);

  const chainId = (await ethers.provider.getNetwork()).chainId;
  const artifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/TheLio.sol/TheLio.json"),
      "utf8",
    ),
  );

  const outDir = path.join(__dirname, "../../frontend/config");
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    path.join(outDir, "TheLio.abi.json"),
    JSON.stringify(artifact.abi, null, 2),
  );

  fs.writeFileSync(
    path.join(outDir, "deployment.json"),
    JSON.stringify(
      {
        chainId,
        network: network.name,
        address: theLio.address,
        implementation,
        proxyAdmin,
        treasury,
        paymentAsset: PAYMENT_ASSET,
        minimumInvestment: MINIMUM_INVESTMENT,
        rpcUrl: "http://127.0.0.1:8545",
        deployedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Wrote ABI + deployment metadata to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
