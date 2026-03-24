import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

function loadArtifact(relPath) {
  const p = path.resolve(relPath);
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const rpc = process.env.RPC_URL;
  const pk = process.env.PRIVATE_KEY;

  if (!rpc || !rpc.startsWith("http")) throw new Error("RPC_URL no definido o inválido en .env");
  if (!pk || !pk.startsWith("0x") || pk.length < 66) throw new Error("PRIVATE_KEY no definida o inválida en .env");

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);

  const address = await wallet.getAddress();
  const bal = await provider.getBalance(address);
  console.log("Deployer:", address);
  console.log("Balance (POL):", ethers.formatEther(bal));

  // Cargar artifacts (rutas típicas de Hardhat)
  const gameArt = loadArtifact("./artifacts/contracts/game.sol/MR_JUEGO.json");
  const autosArt = loadArtifact("./artifacts/contracts/autos.sol/MR_AUTOS.json");

  // Deploy Game
  const GameFactory = new ethers.ContractFactory(gameArt.abi, gameArt.bytecode, wallet);
  const game = await GameFactory.deploy();
  console.log("Deploying Game...");
  await game.waitForDeployment();
  const gameAddress = await game.getAddress();
  console.log("✅ Game:", gameAddress);

  // Deploy Autos
  const baseURI = "https://crackill666.github.io/microracers-pol/";
  const AutosFactory = new ethers.ContractFactory(autosArt.abi, autosArt.bytecode, wallet);
  const autos = await AutosFactory.deploy(gameAddress, baseURI);
  console.log("Deploying Autos...");
  await autos.waitForDeployment();
  const autosAddress = await autos.getAddress();
  console.log("✅ Autos:", autosAddress);

  // setAutos en Game
  console.log("Calling setAutos...");
  const tx = await game.setAutos(autosAddress);
  console.log("Tx:", tx.hash);
  await tx.wait();
  console.log("✅ setAutos OK");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});