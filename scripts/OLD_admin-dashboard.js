/**
 * MicroRacers POL — Admin Dashboard (ESM, Windows-proof)
 * ------------------------------------------------------
 * Funciona en 2 modos:
 *  A) Si Hardhat expone hre.ethers -> usa provider/signers de Hardhat.
 *  B) Si NO expone hre.ethers -> usa ethers "standalone" con RPC_URL + PRIVATE_KEY del .env.
 *
 * Requiere en .env:
 *   RPC_URL=...
 *   PRIVATE_KEY=...   (con o sin 0x)
 *   GAME_ADDRESS=0x...
 *   AUTOS_ADDRESS=0x...
 *
 * Ejecutar:
 *   npx hardhat run scripts/admin-dashboard.js --network amoy
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import hre from "hardhat";
import * as ethersPkg from "ethers"; // fallback si hre.ethers no existe

// ----- rutas ESM -----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, "../.env");

// ----- lectura robusta .env (sin dotenv) -----
function readEnvVarRobust(key) {
  const direct = process.env?.[key];
  if (direct && String(direct).trim()) return String(direct).trim();

  try {
    if (!fs.existsSync(ENV_PATH)) return null;
    const buf = fs.readFileSync(ENV_PATH);

    // utf8
    let txt = buf.toString("utf8");

    // si parece utf16 (muchos \u0000), utf16le
    const nullCount = (txt.match(/\u0000/g) || []).length;
    if (nullCount > 10) txt = buf.toString("utf16le");

    txt = txt.replace(/^\uFEFF/, ""); // BOM

    const re = new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, "m");
    const m = txt.match(re);
    if (!m) return null;

    let val = m[1].trim();
    val = val.replace(/^["']|["']$/g, "").trim();
    return val || null;
  } catch {
    return null;
  }
}

// ----- validación address SIN ethers -----
function isHexAddress(addr) {
  const a = String(addr || "").trim();
  return /^0x[0-9a-fA-F]{40}$/.test(a);
}

function shortAddr(a) {
  const s = String(a || "");
  if (s.length < 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function padRight(s, n) {
  s = String(s);
  if (s.length >= n) return s.slice(0, n);
  return s + " ".repeat(n - s.length);
}

function padLeft(s, n) {
  s = String(s);
  if (s.length >= n) return s.slice(0, n);
  return " ".repeat(n - s.length) + s;
}

function bnToBigInt(x) {
  // soporta BigNumber (v5), bigint (v6), number
  try {
    return BigInt(x?.toString?.() ?? String(x));
  } catch {
    return 0n;
  }
}

// ----- elegir motor (Hardhat ethers vs ethers standalone) -----
async function getRuntime() {
  // 1) intentar Hardhat ethers
  if (hre && hre.ethers) {
    const ethersHH = hre.ethers;
    const provider = ethersHH.provider;
    const signers = await ethersHH.getSigners();
    const signer = signers?.[0];
    return {
      mode: "hardhat-ethers",
      ethers: ethersHH,
      provider,
      signer,
      formatEther: (x) =>
        typeof ethersHH.formatEther === "function"
          ? ethersHH.formatEther(x) // v6
          : ethersHH.utils.formatEther(x), // v5
      parseEther: (s) =>
        typeof ethersHH.parseEther === "function"
          ? ethersHH.parseEther(s) // v6
          : ethersHH.utils.parseEther(s), // v5
    };
  }

  // 2) fallback: ethers standalone (con RPC_URL + PRIVATE_KEY)
  const RPC_URL = readEnvVarRobust("RPC_URL");
  let PRIVATE_KEY = readEnvVarRobust("PRIVATE_KEY");

  if (!RPC_URL) {
    throw new Error("No se encontró RPC_URL en .env y hre.ethers no está disponible.");
  }
  if (!PRIVATE_KEY) {
    throw new Error("No se encontró PRIVATE_KEY en .env y hre.ethers no está disponible.");
  }
  PRIVATE_KEY = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;

  // ethersPkg puede ser v6 o v5 según tu instalación
  const hasV6 = !!ethersPkg.JsonRpcProvider;

  let provider, wallet, formatEther, parseEther;

  if (hasV6) {
    provider = new ethersPkg.JsonRpcProvider(RPC_URL);
    wallet = new ethersPkg.Wallet(PRIVATE_KEY, provider);
    formatEther = ethersPkg.formatEther;
    parseEther = ethersPkg.parseEther;
  } else {
    // v5 style
    provider = new ethersPkg.providers.JsonRpcProvider(RPC_URL);
    wallet = new ethersPkg.Wallet(PRIVATE_KEY, provider);
    formatEther = ethersPkg.utils.formatEther;
    parseEther = ethersPkg.utils.parseEther;
  }

  return {
    mode: "ethers-standalone",
    ethers: ethersPkg,
    provider,
    signer: wallet,
    formatEther,
    parseEther,
  };
}

function fmtPOL(runtime, x) {
  return `${runtime.formatEther(x)} POL`;
}

async function safeCall(contract, fn, args = []) {
  try {
    if (!contract[fn]) return { ok: false, err: "no_fn" };
    const res = await contract[fn](...args);
    return { ok: true, res };
  } catch (e) {
    return { ok: false, err: e?.shortMessage || e?.message || String(e) };
  }
}

async function getLatestTimestamp(provider) {
  const b = await provider.getBlock("latest");
  return Number(b.timestamp);
}

function secondsToHuman(sec) {
  if (sec <= 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function formatDate(ts) {
  if (!ts || ts === 0) return "(nunca)";
  const d = new Date(ts * 1000);
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

// ---------- ABIs (tus contratos) ----------
const AUTOS_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function maxRacesOf(uint256 tokenId) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
];

const GAME_ABI = [
  "function owner() view returns (address)",
  "function autos() view returns (address)",
  "function autosLocked() view returns (bool)",
  "function carState(uint256 tokenId) view returns (uint256 racesLeft, uint256 returnedAmount, uint256 maxReturn, uint256 lastRaceAt, uint256 nonce, bool initialized)",
  "function setAutos(address autosAddress)", // 👈 existe en tu contrato (solo si autosLocked=false)
  "function withdrawPool(address payable to, uint256 amount)",
];

async function listOwnedTokenIdsByBruteforce(autos, owner) {
  const ts = await autos.totalSupply();
  const max = Number(ts.toString());
  const ids = [];
  for (let id = 1; id <= max; id++) {
    try {
      const o = await autos.ownerOf(id);
      if (String(o).toLowerCase() === String(owner).toLowerCase()) ids.push(id);
    } catch {}
  }
  return ids;
}

function deriveStatusFromCarState(cs) {
  if (!cs || !cs.initialized) return "ACTIVO (no init)";
  const racesLeft = bnToBigInt(cs.racesLeft);
  const returned = bnToBigInt(cs.returnedAmount);
  const maxR = bnToBigInt(cs.maxReturn);
  if (racesLeft === 0n) return "RETIRADO";
  if (returned >= maxR) return "RETIRADO";
  return "ACTIVO";
}

async function getAutoReport(provider, game, autos, tokenId) {
  const [owner, maxRaces, uriRes, csRes, nowTs] = await Promise.all([
    autos.ownerOf(tokenId),
    autos.maxRacesOf(tokenId),
    safeCall(autos, "tokenURI", [tokenId]),
    safeCall(game, "carState", [tokenId]),
    getLatestTimestamp(provider),
  ]);

  const tokenURI = uriRes.ok ? uriRes.res : null;

  let carState = null;
  if (csRes.ok) {
    const c = csRes.res;
    carState = {
      racesLeft: c.racesLeft,
      returnedAmount: c.returnedAmount,
      maxReturn: c.maxReturn,
      lastRaceAt: c.lastRaceAt,
      nonce: c.nonce,
      initialized: c.initialized,
    };
  }

  const status = deriveStatusFromCarState(carState);

  const COOLDOWN_SEC = 10 * 60;
  let cooldownLeft = 0;
  if (carState && carState.initialized) {
    const last = Number(carState.lastRaceAt.toString());
    cooldownLeft = Math.max(0, last + COOLDOWN_SEC - nowTs);
  }

  let roiPct = null;
  if (carState && carState.initialized) {
    const returned = bnToBigInt(carState.returnedAmount);
    const maxR = bnToBigInt(carState.maxReturn);
    if (maxR > 0n) roiPct = Number((returned * 10000n) / maxR) / 100;
  }

  return { tokenId, owner, maxRaces, tokenURI, carState, status, cooldownLeft, roiPct };
}

async function printHeader(runtime, game, autos, GAME_ADDRESS, AUTOS_ADDRESS) {
  const net = await runtime.provider.getNetwork();
  const adminAddr = await runtime.signer.getAddress();

  const [adminBal, gameBal, gameOwner, gameAutos, locked, autosName, autosSym] =
    await Promise.all([
      runtime.provider.getBalance(adminAddr),
      runtime.provider.getBalance(GAME_ADDRESS),
      safeCall(game, "owner", []),
      safeCall(game, "autos", []),
      safeCall(game, "autosLocked", []),
      safeCall(autos, "name", []),
      safeCall(autos, "symbol", []),
    ]);

  console.log("\n==============================");
  console.log(" MicroRacers POL — ADMIN CLI");
  console.log("==============================");
  console.log(`Mode:           ${runtime.mode}`);
  console.log(`ENV_PATH:       ${ENV_PATH}`);
  console.log(`Using GAME:     ${GAME_ADDRESS}`);
  console.log(`Using AUTOS:    ${AUTOS_ADDRESS}`);
  console.log("------------------------------");
  console.log(`Network:        ${net.name ?? "?"} (chainId ${net.chainId})`);
  console.log(`Admin wallet:   ${shortAddr(adminAddr)} | ${fmtPOL(runtime, adminBal)}`);
  console.log(`Pool balance:   ${fmtPOL(runtime, gameBal)}`);
  console.log(`Game.owner():   ${gameOwner.ok ? shortAddr(gameOwner.res) : "(fail/no fn)"}`);
  console.log(`Game.autos():   ${gameAutos.ok ? gameAutos.res : "(fail/no fn)"}`);
  console.log(`autosLocked:    ${locked.ok ? String(locked.res) : "(fail/no fn)"}`);
  console.log(
    `Autos:          ${AUTOS_ADDRESS} | ${autosName.ok ? autosName.res : "?"} (${autosSym.ok ? autosSym.res : "?"})`
  );
  if (gameAutos.ok && String(gameAutos.res).toLowerCase() !== AUTOS_ADDRESS.toLowerCase()) {
    console.log(`⚠️  OJO: Game.autos() ≠ AUTOS_ADDRESS. Game.autos() = ${gameAutos.res}`);
  }
  console.log("==============================\n");
}

function menuText() {
  return `
Elegí una opción:
  1) Ver estado de la pool (balance Game)
  2) Depositar POL a la pool (send POL -> Game)
  3) Retirar pool (withdrawPool) [onlyOwner]
  4) Listar autos de una wallet (1..totalSupply)
  5) Consultar un auto por tokenId (estado + cooldown + ROI)
  7) Reporte global (todos los autos)
  8) Ver balance de cualquier address
  9) setAutos() (solo si autosLocked=false)
  6) Salir
`;
}

async function reportGlobal(runtime, game, autos) {
  const ts = await autos.totalSupply();
  const total = Number(ts.toString());
  const nowTs = await getLatestTimestamp(runtime.provider);

  // ancho columnas
  const COL_ID = 5;
  const COL_OWNER = 13;
  const COL_STATUS = 9;
  const COL_RACES = 7;
  const COL_RET = 11;
  const COL_MAX = 11;
  const COL_CD = 10;

  console.log("\n==================== REPORTE GLOBAL ====================");
  console.log(`totalSupply: ${total} | now: ${formatDate(nowTs)}`);
  console.log(
    padRight("ID", COL_ID) +
      " " +
      padRight("OWNER", COL_OWNER) +
      " " +
      padRight("STATUS", COL_STATUS) +
      " " +
      padLeft("R_LEFT", COL_RACES) +
      " " +
      padLeft("RETURN", COL_RET) +
      " " +
      padLeft("MAX", COL_MAX) +
      " " +
      padLeft("COOLDOWN", COL_CD)
  );
  console.log("-".repeat(COL_ID + COL_OWNER + COL_STATUS + COL_RACES + COL_RET + COL_MAX + COL_CD + 6));

  let act = 0, ret = 0, noinit = 0;

  for (let id = 1; id <= total; id++) {
    let owner;
    try {
      owner = await autos.ownerOf(id);
    } catch {
      continue;
    }

    const csRes = await safeCall(game, "carState", [id]);
    let cs = null;
    if (csRes.ok) {
      const c = csRes.res;
      cs = {
        racesLeft: c.racesLeft,
        returnedAmount: c.returnedAmount,
        maxReturn: c.maxReturn,
        lastRaceAt: c.lastRaceAt,
        nonce: c.nonce,
        initialized: c.initialized,
      };
    }

    const status = deriveStatusFromCarState(cs);
    if (!cs || !cs.initialized) noinit++;
    else if (status === "ACTIVO") act++;
    else ret++;

    const racesLeft = cs && cs.initialized ? bnToBigInt(cs.racesLeft).toString() : "-";
    const returned = cs && cs.initialized ? Number(runtime.formatEther(cs.returnedAmount)).toFixed(3) : "-";
    const maxR = cs && cs.initialized ? Number(runtime.formatEther(cs.maxReturn)).toFixed(3) : "-";

    let cd = "-";
    if (cs && cs.initialized) {
      const last = Number(cs.lastRaceAt.toString());
      const left = Math.max(0, last + 600 - nowTs); // 10m
      cd = left > 0 ? secondsToHuman(left) : "READY";
    }

    console.log(
      padRight(id, COL_ID) +
        " " +
        padRight(shortAddr(owner), COL_OWNER) +
        " " +
        padRight(status === "ACTIVO (no init)" ? "NO_INIT" : status, COL_STATUS) +
        " " +
        padLeft(racesLeft, COL_RACES) +
        " " +
        padLeft(returned, COL_RET) +
        " " +
        padLeft(maxR, COL_MAX) +
        " " +
        padLeft(cd, COL_CD)
    );
  }

  console.log("--------------------------------------------------------");
  console.log(`Resumen: ACTIVO=${act} | RETIRADO=${ret} | NO_INIT=${noinit}`);
  console.log("========================================================\n");
}

async function main() {
  const GAME_ADDRESS = readEnvVarRobust("GAME_ADDRESS");
  const AUTOS_ADDRESS = readEnvVarRobust("AUTOS_ADDRESS");

  if (!isHexAddress(GAME_ADDRESS) || !isHexAddress(AUTOS_ADDRESS)) {
    console.error(
      "❌ Direcciones inválidas o faltantes.\n" +
        "Asegurate de tener en .env:\n" +
        "  GAME_ADDRESS=0x...\n" +
        "  AUTOS_ADDRESS=0x...\n"
    );
    console.log("\nDEBUG:");
    console.log("ENV_PATH:", ENV_PATH);
    console.log("Leído GAME_ADDRESS:", GAME_ADDRESS);
    console.log("Leído AUTOS_ADDRESS:", AUTOS_ADDRESS);
    process.exit(1);
  }

  const runtime = await getRuntime();

  const autos = new runtime.ethers.Contract(AUTOS_ADDRESS, AUTOS_ABI, runtime.provider);
  const gameRead = new runtime.ethers.Contract(GAME_ADDRESS, GAME_ABI, runtime.provider);
  const gameWrite = gameRead.connect(runtime.signer);

  const rl = readline.createInterface({ input, output });

  while (true) {
    await printHeader(runtime, gameRead, autos, GAME_ADDRESS, AUTOS_ADDRESS);

    console.log(menuText());
    const choice = (await rl.question("Opción: ")).trim();
    if (choice === "6") break;

    try {
      if (choice === "1") {
        const bal = await runtime.provider.getBalance(GAME_ADDRESS);
        console.log(`\nPool (Game balance): ${fmtPOL(runtime, bal)}\n`);
      }

      else if (choice === "2") {
        const amtStr = (await rl.question("Monto a depositar (POL): ")).trim();
        const value = runtime.parseEther(amtStr || "0");
        const isZero = value?.toString ? value.toString() === "0" : value === 0n;
        if (isZero) throw new Error("Monto inválido.");

        console.log("Enviando tx (deposit por transferencia al Game)...");
        const tx = await runtime.signer.sendTransaction({ to: GAME_ADDRESS, value });
        console.log(`tx: ${tx.hash}`);
        const rc = await tx.wait();
        console.log(`✅ Confirmada en bloque: ${rc.blockNumber}\n`);
      }

      else if (choice === "3") {
        const to = (await rl.question("Address destino (Enter = tu admin): ")).trim();
        const admin = await runtime.signer.getAddress();
        const dest = to ? to : admin;
        if (!isHexAddress(dest)) throw new Error("Address destino inválida.");

        const amtStr = (await rl.question("Monto a retirar (POL): ")).trim();
        const amount = runtime.parseEther(amtStr || "0");
        const isZero = amount?.toString ? amount.toString() === "0" : amount === 0n;
        if (isZero) throw new Error("Monto inválido.");

        console.log("Enviando tx withdrawPool(to, amount)...");
        const tx = await gameWrite.withdrawPool(dest, amount);
        console.log(`tx: ${tx.hash}`);
        const rc = await tx.wait();
        console.log(`✅ Retiro confirmado en bloque: ${rc.blockNumber}\n`);
      }

      else if (choice === "4") {
        const addr = (await rl.question("Wallet a consultar (Enter = tu admin): ")).trim();
        const owner = addr ? addr : await runtime.signer.getAddress();
        if (!isHexAddress(owner)) throw new Error("Address inválida.");

        const ids = await listOwnedTokenIdsByBruteforce(autos, owner);
        console.log(`\n✅ Encontrados ${ids.length} autos: ${ids.length ? ids.join(", ") : "(ninguno)"}\n`);
      }

      else if (choice === "5") {
        const idStr = (await rl.question("tokenId: ")).trim();
        if (!idStr) throw new Error("tokenId vacío.");
        const tokenId = BigInt(idStr);

        const rep = await getAutoReport(runtime.provider, gameRead, autos, tokenId);

        console.log("\n==================== AUTO ====================");
        console.log(`tokenId:     ${rep.tokenId.toString()}`);
        console.log(`owner:       ${rep.owner}`);
        console.log(`maxRaces:    ${rep.maxRaces.toString()}`);
        console.log(`estado:      ${rep.status}`);

        if (rep.carState && rep.carState.initialized) {
          console.log("\n--- CarState (Game.carState) ---");
          console.log(`initialized:    ${rep.carState.initialized}`);
          console.log(`racesLeft:      ${rep.carState.racesLeft.toString()}`);
          console.log(`returnedAmount: ${fmtPOL(runtime, rep.carState.returnedAmount)}`);
          console.log(`maxReturn:      ${fmtPOL(runtime, rep.carState.maxReturn)}`);
          console.log(`lastRaceAt:     ${formatDate(Number(rep.carState.lastRaceAt.toString()))}`);
          console.log(`nonce:          ${rep.carState.nonce.toString()}`);

          const remaining =
            bnToBigInt(rep.carState.maxReturn) - bnToBigInt(rep.carState.returnedAmount);
          console.log(`remaining ROI:  ${runtime.formatEther(remaining)} POL`);
          if (rep.roiPct !== null) console.log(`avance ROI:     ${rep.roiPct}%`);
          console.log(`cooldown left:  ${secondsToHuman(rep.cooldownLeft)} (COOLDOWN=10m)`);
        } else {
          console.log("\n--- CarState ---");
          console.log("Este auto todavía no inicializó en el Game (nunca corrió).");
        }

        if (rep.tokenURI) {
          console.log("\n--- tokenURI ---");
          console.log(rep.tokenURI.slice(0, 140) + "...");
        }
        console.log("==============================================\n");
      }

      else if (choice === "7") {
        await reportGlobal(runtime, gameRead, autos);
      }

      else if (choice === "8") {
        const a = (await rl.question("Address a consultar balance: ")).trim();
        if (!isHexAddress(a)) throw new Error("Address inválida.");
        const bal = await runtime.provider.getBalance(a);
        console.log(`\nBalance ${a}: ${fmtPOL(runtime, bal)}\n`);
      }

      else if (choice === "9") {
        const lockedRes = await safeCall(gameRead, "autosLocked", []);
        const locked = lockedRes.ok ? Boolean(lockedRes.res) : true;

        if (locked) {
          console.log("\n⚠️ autosLocked ya está TRUE.");
          console.log("En tu contrato MR_JUEGO solo existe setAutos() y queda lockeado para siempre.");
          console.log("No se puede destrabar sin redeploy.\n");
        } else {
          const addr = (await rl.question("Autos address a setear: ")).trim();
          if (!isHexAddress(addr)) throw new Error("Address inválida.");
          console.log("Enviando tx setAutos(address)...");
          const tx = await gameWrite.setAutos(addr);
          console.log(`tx: ${tx.hash}`);
          const rc = await tx.wait();
          console.log(`✅ setAutos confirmado en bloque: ${rc.blockNumber}\n`);
        }
      }

      else {
        console.log("Opción inválida.\n");
      }
    } catch (e) {
      console.log(`\n❌ Error: ${e?.shortMessage || e?.message || String(e)}\n`);
    }

    await rl.question("Enter para continuar...");
  }

  rl.close();
  console.log("\nSaliendo del Admin Dashboard.\n");
}

await main();
