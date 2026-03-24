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

// ----- helpers de FS -----
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

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

function bigIntToNumberSafe(x) {
  // solo para display (si es demasiado grande, recorta)
  try {
    const n = Number(x);
    if (!Number.isFinite(n)) return null;
    return n;
  } catch {
    return null;
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
        typeof ethersHH.formatEther === "function" ? ethersHH.formatEther(x) : ethersHH.utils.formatEther(x),
      parseEther: (s) =>
        typeof ethersHH.parseEther === "function" ? ethersHH.parseEther(s) : ethersHH.utils.parseEther(s),
    };
  }

  // 2) fallback: ethers standalone (con RPC_URL + PRIVATE_KEY)
  const RPC_URL = readEnvVarRobust("RPC_URL");
  let PRIVATE_KEY = readEnvVarRobust("PRIVATE_KEY");

  if (!RPC_URL) throw new Error("No se encontró RPC_URL en .env y hre.ethers no está disponible.");
  if (!PRIVATE_KEY) throw new Error("No se encontró PRIVATE_KEY en .env y hre.ethers no está disponible.");

  PRIVATE_KEY = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;

  const hasV6 = !!ethersPkg.JsonRpcProvider;
  let provider, wallet, formatEther, parseEther;

  if (hasV6) {
    provider = new ethersPkg.JsonRpcProvider(RPC_URL);
    wallet = new ethersPkg.Wallet(PRIVATE_KEY, provider);
    formatEther = ethersPkg.formatEther;
    parseEther = ethersPkg.parseEther;
  } else {
    provider = new ethersPkg.providers.JsonRpcProvider(RPC_URL);
    wallet = new ethersPkg.Wallet(PRIVATE_KEY, provider);
    formatEther = ethersPkg.utils.formatEther;
    parseEther = ethersPkg.utils.parseEther;
  }

  return { mode: "ethers-standalone", ethers: ethersPkg, provider, signer: wallet, formatEther, parseEther };
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

// ---------- ABIs ----------
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
  "function setAutos(address autosAddress)",
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
  if (!cs || !cs.initialized) return "NO_INIT";
  const racesLeft = bnToBigInt(cs.racesLeft);
  const returned = bnToBigInt(cs.returnedAmount);
  const maxR = bnToBigInt(cs.maxReturn);
  if (racesLeft === 0n) return "RETIRADO";
  if (maxR > 0n && returned >= maxR) return "RETIRADO";
  return "ACTIVO";
}

function computeRoiPct(cs) {
  if (!cs || !cs.initialized) return null;
  const returned = bnToBigInt(cs.returnedAmount);
  const maxR = bnToBigInt(cs.maxReturn);
  if (maxR <= 0n) return null;
  // 2 decimales
  return Number((returned * 10000n) / maxR) / 100;
}

function computeRemainWei(cs) {
  if (!cs || !cs.initialized) return null;
  const returned = bnToBigInt(cs.returnedAmount);
  const maxR = bnToBigInt(cs.maxReturn);
  const rem = maxR - returned;
  return rem < 0n ? 0n : rem;
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

  const roiPct = computeRoiPct(carState);
  const remainWei = computeRemainWei(carState);

  return { tokenId, owner, maxRaces, tokenURI, carState, status, cooldownLeft, roiPct, remainWei };
}

async function printHeader(runtime, game, autos, GAME_ADDRESS, AUTOS_ADDRESS) {
  const net = await runtime.provider.getNetwork();
  const adminAddr = await runtime.signer.getAddress();

  const [adminBal, gameBal, gameOwner, gameAutos, locked, autosName, autosSym] = await Promise.all([
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
  console.log(`Autos:          ${AUTOS_ADDRESS} | ${autosName.ok ? autosName.res : "?"} (${autosSym.ok ? autosSym.res : "?"})`);
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
  5) Consultar un auto por tokenId (detalle)
  7) Reporte global (tabla + filtros + ROI%)
  8) Ver balance de cualquier address
  10) Exportar CSV (reporte global)
  11) Economía / Simulador (pool vs deuda potencial + alerta)
  9) setAutos() (solo si autosLocked=false)
  6) Salir
`;
}

// ----------------- REPORTE GLOBAL (con filtros) -----------------
function filterMatches(status, filter) {
  // filter: ALL | ACTIVO | RETIRADO | NO_INIT
  if (!filter || filter === "ALL") return true;
  return status === filter;
}

async function buildGlobalRows(runtime, game, autos) {
  const ts = await autos.totalSupply();
  const total = Number(ts.toString());
  const nowTs = await getLatestTimestamp(runtime.provider);

  const rows = [];

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

    let racesLeft = null;
    let returnedWei = null;
    let maxWei = null;
    let remainWei = null;
    let roiPct = null;
    let cooldownLeftSec = null;

    if (cs && cs.initialized) {
      racesLeft = bnToBigInt(cs.racesLeft);
      returnedWei = bnToBigInt(cs.returnedAmount);
      maxWei = bnToBigInt(cs.maxReturn);
      remainWei = computeRemainWei(cs);
      roiPct = computeRoiPct(cs);

      const last = Number(cs.lastRaceAt.toString());
      cooldownLeftSec = Math.max(0, last + 600 - nowTs); // 10m
    }

    rows.push({
      id,
      owner,
      status,
      racesLeft,
      returnedWei,
      maxWei,
      remainWei,
      roiPct,
      cooldownLeftSec,
    });
  }

  return rows;
}

async function reportGlobal(runtime, game, autos, rl) {
  const filterRaw = (await rl.question("Filtro (ALL/ACTIVO/RETIRADO/NO_INIT) [ALL]: ")).trim().toUpperCase();
  const filter = filterRaw || "ALL";

  if (!["ALL", "ACTIVO", "RETIRADO", "NO_INIT"].includes(filter)) {
    console.log("❌ Filtro inválido. Usá ALL/ACTIVO/RETIRADO/NO_INIT.");
    return;
  }

  const rows = await buildGlobalRows(runtime, game, autos);
  const shown = rows.filter((r) => filterMatches(r.status, filter));

  // columnas (compacto)
  const COL_ID = 4;
  const COL_OWNER = 13;
  const COL_ST = 8;
  const COL_RL = 6;
  const COL_RET = 9;
  const COL_MAX = 9;
  const COL_REM = 9;
  const COL_ROI = 7;
  const COL_CD = 10;

  console.log("\n==================== REPORTE GLOBAL ====================");
  console.log(`Filtro: ${filter} | Mostrando: ${shown.length}/${rows.length}`);
  console.log(
    padRight("ID", COL_ID) + " " +
    padRight("OWNER", COL_OWNER) + " " +
    padRight("STATUS", COL_ST) + " " +
    padLeft("RLEFT", COL_RL) + " " +
    padLeft("RET", COL_RET) + " " +
    padLeft("MAX", COL_MAX) + " " +
    padLeft("REMAIN", COL_REM) + " " +
    padLeft("ROI%", COL_ROI) + " " +
    padLeft("COOLDOWN", COL_CD)
  );
  console.log("-".repeat(COL_ID + COL_OWNER + COL_ST + COL_RL + COL_RET + COL_MAX + COL_REM + COL_ROI + COL_CD + 8));

  // stats
  let countActivo = 0, countRet = 0, countNoInit = 0;
  let sumReturned = 0n;
  let sumMax = 0n;
  let sumRemain = 0n;

  for (const r of shown) {
    if (r.status === "ACTIVO") countActivo++;
    else if (r.status === "RETIRADO") countRet++;
    else countNoInit++;

    if (r.returnedWei != null) sumReturned += r.returnedWei;
    if (r.maxWei != null) sumMax += r.maxWei;
    if (r.remainWei != null) sumRemain += r.remainWei;

    const racesLeft = r.racesLeft != null ? r.racesLeft.toString() : "-";

    const ret = r.returnedWei != null ? Number(runtime.formatEther(r.returnedWei)).toFixed(3) : "-";
    const max = r.maxWei != null ? Number(runtime.formatEther(r.maxWei)).toFixed(3) : "-";
    const rem = r.remainWei != null ? Number(runtime.formatEther(r.remainWei)).toFixed(3) : "-";

    const roi = r.roiPct != null ? `${r.roiPct.toFixed(2)}` : "-";
    const cd = r.cooldownLeftSec == null ? "-" : (r.cooldownLeftSec > 0 ? secondsToHuman(r.cooldownLeftSec) : "READY");

    console.log(
      padRight(r.id, COL_ID) + " " +
      padRight(shortAddr(r.owner), COL_OWNER) + " " +
      padRight(r.status, COL_ST) + " " +
      padLeft(racesLeft, COL_RL) + " " +
      padLeft(ret, COL_RET) + " " +
      padLeft(max, COL_MAX) + " " +
      padLeft(rem, COL_REM) + " " +
      padLeft(roi, COL_ROI) + " " +
      padLeft(cd, COL_CD)
    );
  }

  console.log("--------------------------------------------------------");
  console.log(
    `Resumen (filtro ${filter}): ACTIVO=${countActivo} | RETIRADO=${countRet} | NO_INIT=${countNoInit}`
  );
  console.log(`Suma returned: ${Number(runtime.formatEther(sumReturned)).toFixed(4)} POL`);
  console.log(`Suma maxReturn: ${Number(runtime.formatEther(sumMax)).toFixed(4)} POL`);
  console.log(`Suma remaining: ${Number(runtime.formatEther(sumRemain)).toFixed(4)} POL`);
  console.log("========================================================\n");
}

// ----------------- EXPORT CSV -----------------
function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function exportCSV(runtime, game, autos, rl, GAME_ADDRESS) {
  const filterRaw = (await rl.question("CSV filtro (ALL/ACTIVO/RETIRADO/NO_INIT) [ALL]: ")).trim().toUpperCase();
  const filter = filterRaw || "ALL";
  if (!["ALL", "ACTIVO", "RETIRADO", "NO_INIT"].includes(filter)) {
    console.log("❌ Filtro inválido.");
    return;
  }

  const rows = await buildGlobalRows(runtime, game, autos);
  const shown = rows.filter((r) => filterMatches(r.status, filter));

  const outDir = path.resolve(__dirname, "../reports");
  ensureDir(outDir);

  const file = path.join(outDir, `dashboard_${nowStamp()}_${filter}.csv`);

  const header = [
    "gameAddress",
    "tokenId",
    "owner",
    "status",
    "racesLeft",
    "returnedPOL",
    "maxReturnPOL",
    "remainPOL",
    "roiPct",
    "cooldownLeftSec"
  ];

  const lines = [];
  lines.push(header.join(","));

  for (const r of shown) {
    const returnedPOL = r.returnedWei != null ? runtime.formatEther(r.returnedWei) : "";
    const maxPOL = r.maxWei != null ? runtime.formatEther(r.maxWei) : "";
    const remainPOL = r.remainWei != null ? runtime.formatEther(r.remainWei) : "";
    const roiPct = r.roiPct != null ? r.roiPct.toFixed(2) : "";
    const cd = r.cooldownLeftSec != null ? String(r.cooldownLeftSec) : "";

    const row = [
      GAME_ADDRESS,
      r.id,
      r.owner,
      r.status,
      r.racesLeft != null ? r.racesLeft.toString() : "",
      returnedPOL,
      maxPOL,
      remainPOL,
      roiPct,
      cd
    ].map(csvEscape);

    lines.push(row.join(","));
  }

  fs.writeFileSync(file, lines.join("\n"), "utf8");
  console.log(`\n✅ CSV exportado: ${file}\n`);
}

// ----------------- ECONOMÍA / SIMULADOR -----------------
async function economySimulator(runtime, game, autos, GAME_ADDRESS, rl) {
  const pool = await runtime.provider.getBalance(GAME_ADDRESS);
  const poolBI = bnToBigInt(pool);

  const rows = await buildGlobalRows(runtime, game, autos);

  let debtPotential = 0n;      // suma de (maxReturn - returned) solo de autos inicializados y NO retirados por ROI (o sea activos con remain)
  let debtAllInit = 0n;        // suma de remain de todos los inicializados (incluye retirados también, que debería ser 0 normalmente)
  let countActive = 0;
  let countInit = 0;

  for (const r of rows) {
    if (r.status !== "NO_INIT") countInit++;
    if (r.remainWei != null) {
      debtAllInit += r.remainWei;
      if (r.status === "ACTIVO") {
        debtPotential += r.remainWei;
        countActive++;
      }
    }
  }

  const poolPOL = Number(runtime.formatEther(poolBI));
  const debtPOL = Number(runtime.formatEther(debtPotential));
  const debtAllPOL = Number(runtime.formatEther(debtAllInit));

  const coverage = debtPOL > 0 ? (poolPOL / debtPOL) * 100 : 999;

  console.log("\n==================== ECONOMÍA / SIMULADOR ====================");
  console.log(`Pool (Game balance):          ${poolPOL.toFixed(6)} POL`);
  console.log(`Autos total:                 ${rows.length}`);
  console.log(`Autos inicializados:         ${countInit}`);
  console.log(`Autos activos:               ${countActive}`);
  console.log("--------------------------------------------------------------");
  console.log(`Deuda potencial (ACTIVOS):   ${debtPOL.toFixed(6)} POL   (sum REMAIN de autos ACTIVO)`);
  console.log(`Deuda total (INIT):          ${debtAllPOL.toFixed(6)} POL (sum REMAIN de autos init)`);
  console.log(`Cobertura de pool vs deuda:  ${coverage.toFixed(2)}%`);
  if (debtPOL > 0 && poolPOL < debtPOL) {
    console.log("⚠️  WARNING: si todos los activos completan ROI, la pool NO alcanza.");
  } else {
    console.log("✅ OK: pool alcanza para cubrir la deuda potencial de los autos activos (según remain).");
  }

  // alerta por umbral
  const thRaw = (await rl.question("Umbral de alerta pool (POL) [1.0]: ")).trim();
  const threshold = thRaw ? Number(thRaw) : 1.0;

  if (Number.isFinite(threshold)) {
    if (poolPOL < threshold) console.log(`🚨 ALERTA: pool ${poolPOL.toFixed(6)} < ${threshold} POL`);
    else console.log(`✅ Pool por encima del umbral: ${threshold} POL`);
  }

  console.log("==============================================================\n");
}

// ----------------- MAIN LOOP -----------------
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

          const remaining = rep.remainWei != null ? rep.remainWei : 0n;
          console.log(`remaining ROI:  ${runtime.formatEther(remaining)} POL`);
          if (rep.roiPct !== null) console.log(`avance ROI:     ${rep.roiPct.toFixed(2)}%`);
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
        await reportGlobal(runtime, gameRead, autos, rl);
      }

      else if (choice === "8") {
        const a = (await rl.question("Address a consultar balance: ")).trim();
        if (!isHexAddress(a)) throw new Error("Address inválida.");
        const bal = await runtime.provider.getBalance(a);
        console.log(`\nBalance ${a}: ${fmtPOL(runtime, bal)}\n`);
      }

      else if (choice === "10") {
        await exportCSV(runtime, gameRead, autos, rl, GAME_ADDRESS);
      }

      else if (choice === "11") {
        await economySimulator(runtime, gameRead, autos, GAME_ADDRESS, rl);
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
