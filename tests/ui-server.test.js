import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import { spawn } from "node:child_process";

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("local dashboard validates requests and persists settings", async (t) => {
  const port = await unusedPort();
  const dataHome = await fs.mkdtemp(path.join(os.tmpdir(), "bingo-ui-"));
  const child = spawn(process.execPath, ["ui-server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, BINGO_UI_PORT: String(port), BINGO_DATA_HOME: dataHome, BINGO_NO_OPEN: "1" },
    stdio: "ignore"
  });
  t.after(async () => {
    child.kill("SIGTERM");
    await fs.rm(dataHome, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${port}`;
  let response;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      response = await fetch(`${base}/api/status`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.ok(response, "dashboard server should start");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).running, false);

  response = await fetch(`${base}/api/latest-output`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).output, null);

  response = await fetch(`${base}/api/settings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ printer: "Test Printer" })
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).printer, "Test Printer");

  response = await fetch(`${base}/api/settings`);
  assert.equal((await response.json()).printer, "Test Printer");

  const hostGuardStatus = await new Promise((resolve, reject) => {
    const request = http.request({
      hostname: "127.0.0.1",
      port,
      path: "/api/status",
      headers: { host: `attacker.invalid:${port}` }
    }, (res) => {
      res.resume();
      res.once("end", () => resolve(res.statusCode));
    });
    request.once("error", reject);
    request.end();
  });
  assert.equal(hostGuardStatus, 403);

  response = await fetch(`${base}/api/status`, { headers: { origin: "https://attacker.invalid" } });
  assert.equal(response.status, 403);
});
