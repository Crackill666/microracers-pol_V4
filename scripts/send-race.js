import { ethers } from "ethers";
import "dotenv/config";

const RPC_URL = process.env.RPC_URL || "https://rpc-amoy.polygon.technology";
const GAME_ADDRESS = process.env.GAME_ADDRESS;

const GAME_ABI = [
  "function race(uint256 tokenId, uint8 position) external",
];

async function main() {
  if (!GAME_ADDRESS) throw new Error("GAME_ADDRESS missing in .env");
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const game = new ethers.Contract(GAME_ADDRESS, GAME_ABI, wallet);

  const tokenId = 1;
  const position = 4;

  console.log(`Sending race tx for token #${tokenId} with position ${position}...`);
  const tx = await game.race(tokenId, position);
  console.log("tx:", tx.hash);

  const rc = await tx.wait();
  console.log("confirmed in block:", rc.blockNumber);
}

main().catch(console.error);
