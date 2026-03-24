import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import "dotenv/config";
import { defineConfig } from "hardhat/config";

/** @type import('hardhat/config').HardhatUserConfig */
export default defineConfig({
  plugins: [hardhatEthers],
  solidity: "0.8.20",
  networks: {
    amoy: {
      type: "http",
      chainType: "l1",
      url: process.env.RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
});
