import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect("amoy");

  const Game = await ethers.getContractFactory("MR_JUEGO");
  const game = await Game.deploy();
  await game.waitForDeployment();
  const gameAddress = await game.getAddress();
  console.log("Game:", gameAddress);

  const Autos = await ethers.getContractFactory("MR_AUTOS");
  const autos = await Autos.deploy(
    gameAddress,
    "https://crackill666.github.io/microracers-pol/"
  );
  await autos.waitForDeployment();
  const autosAddress = await autos.getAddress();
  console.log("Autos:", autosAddress);

  const tx = await game.setAutos(autosAddress);
  await tx.wait();
  console.log("setAutos OK");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
