import { ethers } from "ethers";
import "dotenv/config";

const RPC_URL = process.env.RPC_URL || "https://rpc-amoy.polygon.technology";
const GAME_ADDRESS = process.env.GAME_ADDRESS;

// ABI mínimo para debug
const GAME_ABI = [
  "function carState(uint256) view returns (uint256 racesUsed,uint256 maxRaces,uint256 accumulatedReturn,uint256 maxReturn,uint8 status,uint256 lastRaceAt,bool initialized)",
  "function COOLDOWN() view returns (uint256)",
  "function autosLocked() view returns (bool)",
  "function autos() view returns (address)",
  "function race(uint256 tokenId, uint8 position) external"
];

const CARS_ABI = [
  "function ownerOf(uint256) view returns (address)"
];

async function main() {
  if (!GAME_ADDRESS) throw new Error("GAME_ADDRESS missing in .env");
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // Necesitás PRIVATE_KEY en .env (la misma que usaste para deploy)
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const game = new ethers.Contract(GAME_ADDRESS, GAME_ABI, wallet);

  const tokenId = 1;
  const position = 4;

  const autosAddr = await game.autos();
  const autosLocked = await game.autosLocked();
  const cars = new ethers.Contract(autosAddr, CARS_ABI, provider);

  const [state, cooldown, gameBal, nftOwner] = await Promise.all([
    game.carState(tokenId),
    game.COOLDOWN(),
    provider.getBalance(GAME_ADDRESS),
    cars.ownerOf(tokenId),
  ]);

  console.log("=== BASIC ===");
  console.log("wallet:", wallet.address);
  console.log("nftOwner:", nftOwner);
  console.log("autosLocked:", autosLocked);
  console.log("autos:", autosAddr);
  console.log("game balance:", ethers.formatEther(gameBal), "POL");

  console.log("\n=== carState ===");
  console.log("racesUsed:", state.racesUsed.toString());
  console.log("maxRaces:", state.maxRaces.toString());
  console.log("returned:", ethers.formatEther(state.accumulatedReturn), "POL");
  console.log("maxReturn:", ethers.formatEther(state.maxReturn), "POL");
  console.log("status:", state.status.toString());
  console.log("lastRaceAt:", state.lastRaceAt.toString());
  console.log("initialized:", state.initialized);
  console.log("cooldown(s):", cooldown.toString());

  console.log("\n=== STATIC CALL (revert reason) ===");
  try {
    await game.race.staticCall(tokenId, position); // simula sin enviar tx
    console.log("✅ staticCall OK (no revert)");
  } catch (e) {
    console.log("❌ staticCall REVERT:", e.shortMessage || e.message);
  }

  console.log("\n=== ESTIMATE GAS ===");
  try {
    const gas = await game.race.estimateGas(tokenId, position);
    console.log("✅ estimateGas:", gas.toString());
  } catch (e) {
    console.log("❌ estimateGas FAIL:", e.shortMessage || e.message);
  }
}

main().catch(console.error);
