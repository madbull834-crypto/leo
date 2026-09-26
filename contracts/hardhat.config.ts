import { HardhatUserConfig, subtask } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const configuredPrivateKey = process.env.PRIVATE_KEY?.trim();
const privateKey = configuredPrivateKey
  ? (configuredPrivateKey.startsWith("0x") ? configuredPrivateKey : `0x${configuredPrivateKey}`)
  : undefined;

// Use the compiler shipped in node_modules so builds do not depend on the
// Solidity binary download service being available.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args: any, _hre, runSuper) => {
  if (args.solcVersion === "0.8.26") {
    return {
      compilerPath: require.resolve("solc/soljson.js"),
      isSolcJs: true,
      version: "0.8.26",
      longVersion: "0.8.26+commit.8a97fa7a",
    };
  }
  return runSuper(args);
});

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet-dataseed.bnbchain.org",
      chainId: 97,
      accounts: privateKey ? [privateKey] : [],
    },
  },
};

export default config;
