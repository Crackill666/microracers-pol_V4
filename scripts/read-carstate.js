import { ethers } from "ethers";
import "dotenv/config";

const RPC_URL = process.env.RPC_URL || "https://rpc-amoy.polygon.technology";
const GAME_ADDRESS = process.env.GAME_ADDRESS;

const GAME_ABI = [
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "carState",
    "outputs": [
      { "internalType": "uint256", "name": "racesUsed", "type": "uint256" },
      { "internalType": "uint256", "name": "maxRaces", "type": "uint256" },
      { "internalType": "uint256", "name": "accumulatedReturn", "type": "uint256" },
      { "internalType": "uint256", "name": "maxReturn", "type": "uint256" },
      { "internalType": "uint8", "name": "status", "type": "uint8" },
      { "internalType": "uint256", "name": "lastRaceAt", "type": "uint256" },
      { "internalType": "bool", "name": "initialized", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "COOLDOWN",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

function statusLabel(status) {
  if (status === 1) return "READY_TO_CLAIM";
  if (status === 2) return "RETIRED";
  return "ACTIVE";
}

async function main() {
  if (!GAME_ADDRESS) throw new Error("GAME_ADDRESS missing in .env");
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const game = new ethers.Contract(GAME_ADDRESS, GAME_ABI, provider);

  const tokenId = 1;

  const state = await game.carState(tokenId);
  const cooldown = await game.COOLDOWN();

  console.log("=== carState(", tokenId, ") ===");
  console.log("racesUsed        :", state.racesUsed.toString());
  console.log("maxRaces         :", state.maxRaces.toString());
  console.log("accumulatedReturn:", ethers.formatEther(state.accumulatedReturn), "POL");
  console.log("maxReturn        :", ethers.formatEther(state.maxReturn), "POL");
  console.log("status           :", statusLabel(Number(state.status)));
  console.log("lastRaceAt       :", state.lastRaceAt.toString());
  console.log("initialized      :", state.initialized);

  const now = Math.floor(Date.now() / 1000);
  const nextRaceAt = Number(state.lastRaceAt) + Number(cooldown);

  console.log("\n=== COOLDOWN ===");
  console.log("cooldown (s)     :", cooldown.toString());
  console.log("now              :", now);
  console.log("next race at     :", nextRaceAt);

  if (now < nextRaceAt) {
    console.log("COOLDOWN ACTIVO - faltan", nextRaceAt - now, "segundos");
  } else {
    console.log("Puede correr nuevamente");
  }
}

main().catch(console.error);
