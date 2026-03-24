import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

function safePathFromUrl(urlPath) {
  const cleanPath = decodeURIComponent((urlPath || "/").split("?")[0]);
  const candidate = cleanPath === "/" ? "/PISTA/runner.html" : cleanPath;
  const resolved = path.resolve(projectRoot, "." + candidate);
  return resolved.startsWith(projectRoot) ? resolved : null;
}

const server = http.createServer((req, res) => {
  const resolved = safePathFromUrl(req.url);
  if (!resolved) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  let filePath = resolved;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypes[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`MicroRacers test server running on http://${host}:${port}`);
  console.log(`Track URL: http://${host}:${port}/PISTA/runner.html?track=test_s_circuit&limit=35`);
  console.log(`Game URL:  http://${host}:${port}/game.html`);
});
