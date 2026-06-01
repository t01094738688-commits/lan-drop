const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const childProcess = require("child_process");
const qrcode = require("qrcode");
const packageInfo = require("./package.json");

const PORT = Number(process.env.PORT || 47321);
const APP_VERSION = packageInfo.version || "0.1.0";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DEFAULT_INBOX_DIR = path.join(os.homedir(), "Documents", "闪传本子");
const INBOX_DIR = process.env.LAN_DROP_INBOX || DEFAULT_INBOX_DIR;
const DATA_DIR = process.env.LAN_DROP_DATA || path.join(INBOX_DIR, ".lan-drop-data");
const YAOJI_VAULT_FILE = path.join(DATA_DIR, "yaoji-vault.json");
const ACCESS_CODE_FILE = path.join(DATA_DIR, "access-code.txt");
const ITEMS_FILE = path.join(DATA_DIR, "items.json");
const DEVICES_FILE = path.join(DATA_DIR, "devices.json");
const NOTES_DIR = path.join(DATA_DIR, "notes");
const MAX_BODY_BYTES = 200 * 1024 * 1024;
const MAX_ITEMS = 1000;
const SESSION_COOKIE = "lan_drop_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const RELEASES_API_URL = "https://api.github.com/repos/t01094738688-commits/lan-drop/releases";

fs.mkdirSync(INBOX_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(NOTES_DIR, { recursive: true });

const legacyInboxDir = path.join(ROOT, "inbox");
if (path.resolve(INBOX_DIR) !== path.resolve(legacyInboxDir) && fs.existsSync(legacyInboxDir)) {
  for (const entry of fs.readdirSync(legacyInboxDir, { withFileTypes: true })) {
    const from = path.join(legacyInboxDir, entry.name);
    const to = path.join(INBOX_DIR, entry.name);
    if (entry.name === ".lan-drop-data" && entry.isDirectory()) {
      for (const dataEntry of fs.readdirSync(from, { withFileTypes: true })) {
        const dataFrom = path.join(from, dataEntry.name);
        const dataTo = path.join(to, dataEntry.name);
        if (!fs.existsSync(dataTo)) {
          fs.cpSync(dataFrom, dataTo, { recursive: true, errorOnExist: false });
        }
      }
      continue;
    }
    if (!fs.existsSync(to)) {
      fs.cpSync(from, to, { recursive: true, errorOnExist: false });
    }
  }
}

const legacyYaojiVaultFile = path.join(INBOX_DIR, ".yaoji-vault.json");
if (fs.existsSync(legacyYaojiVaultFile) && !fs.existsSync(YAOJI_VAULT_FILE)) {
  fs.renameSync(legacyYaojiVaultFile, YAOJI_VAULT_FILE);
}

function loadAccessCode() {
  if (process.env.LAN_DROP_ACCESS_CODE && /^\d{4}$/.test(process.env.LAN_DROP_ACCESS_CODE)) {
    return process.env.LAN_DROP_ACCESS_CODE;
  }
  if (fs.existsSync(ACCESS_CODE_FILE)) {
    const saved = fs.readFileSync(ACCESS_CODE_FILE, "utf8").trim();
    if (/^\d{4}$/.test(saved)) return saved;
  }
  const code = generateAccessCode();
  fs.writeFileSync(ACCESS_CODE_FILE, code, "utf8");
  return code;
}

function generateAccessCode() {
  return String(crypto.randomInt(0, 10000)).padStart(4, "0");
}

let ACCESS_CODE = loadAccessCode();

const clients = new Set();
const items = [];
const sessions = new Map();
const devices = new Map();
const unlockAttempts = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8"
};

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "Accept": "application/vnd.github+json",
          "User-Agent": `LAN-Drop/${APP_VERSION}`
        },
        timeout: 25000
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`GitHub returned ${response.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(text));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("timeout", () => request.destroy(new Error("Request timed out")));
    request.on("error", reject);
  });
}

function parseVersion(value = "") {
  const match = String(value).match(/v?(\d+)\.(\d+)\.(\d+)(?:[-.]beta\.?(\d+))?/i);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    beta: match[4] ? Number(match[4]) : Infinity
  };
}

function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return 0;
  for (const key of ["major", "minor", "patch", "beta"]) {
    if (left[key] > right[key]) return 1;
    if (left[key] < right[key]) return -1;
  }
  return 0;
}

function normalizeRelease(release) {
  const assets = (release.assets || []).map((asset) => ({
    name: asset.name,
    size: asset.size,
    browserDownloadUrl: asset.browser_download_url
  }));
  const windowsAsset =
    assets.find((asset) => /win.*x64.*\.exe$/i.test(asset.name)) ||
    assets.find((asset) => /\.exe$/i.test(asset.name));
  const macAsset =
    assets.find((asset) => /mac.*arm64.*\.dmg$/i.test(asset.name)) ||
    assets.find((asset) => /mac.*\.dmg$/i.test(asset.name));
  const recommendedAsset = process.platform === "darwin" ? macAsset : windowsAsset;
  return {
    currentVersion: APP_VERSION,
    platform: process.platform,
    updateAvailable: compareVersions(release.tag_name || release.name, APP_VERSION) > 0,
    tagName: release.tag_name,
    name: release.name || release.tag_name,
    prerelease: Boolean(release.prerelease),
    htmlUrl: release.html_url,
    publishedAt: release.published_at,
    assets,
    windowsAsset,
    macAsset,
    recommendedAsset
  };
}

async function latestReleaseInfo() {
  const releases = await requestJson(RELEASES_API_URL);
  const release = (Array.isArray(releases) ? releases : []).find(
    (entry) => !entry.draft && Array.isArray(entry.assets) && entry.assets.length > 0
  );
  if (!release) {
    return {
      currentVersion: APP_VERSION,
      platform: process.platform,
      updateAvailable: false,
      assets: []
    };
  }
  return normalizeRelease(release);
}

function isLocalRequest(req) {
  const remote = req.socket.remoteAddress || "";
  return remote === "::1" || remote === "127.0.0.1" || remote.endsWith(":127.0.0.1");
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)])
  );
}

function getSessionToken(req) {
  return parseCookies(req.headers.cookie || "")[SESSION_COOKIE];
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return (forwarded || req.socket.remoteAddress || "unknown").replace(/^::ffff:/, "");
}

function describeBrowser(userAgent = "") {
  const ua = String(userAgent);
  const browser =
    ua.includes("Edg/") ? "Edge" :
    ua.includes("OPR/") ? "Opera" :
    ua.includes("Firefox/") ? "Firefox" :
    ua.includes("Chrome/") && !ua.includes("Chromium") ? "Chrome" :
    ua.includes("Safari/") ? "Safari" :
    "浏览器";
  const system =
    ua.includes("iPhone") ? "iPhone" :
    ua.includes("iPad") ? "iPad" :
    ua.includes("Android") ? "Android" :
    ua.includes("Mac OS X") ? "macOS" :
    ua.includes("Windows") ? "Windows" :
    ua.includes("Linux") ? "Linux" :
    "未知设备";
  return { browser, system };
}

function deviceNameFromRequest(req) {
  const { browser, system } = describeBrowser(req.headers["user-agent"] || "");
  return `${system} ${browser}`;
}

function loadDevices() {
  if (!fs.existsSync(DEVICES_FILE)) return;
  try {
    const saved = JSON.parse(fs.readFileSync(DEVICES_FILE, "utf8"));
    for (const device of Array.isArray(saved.devices) ? saved.devices : []) {
      if (device.id) devices.set(device.id, device);
    }
  } catch {}
}

function saveDevices() {
  const list = [...devices.values()]
    .sort((a, b) => String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || "")))
    .slice(0, 100);
  fs.writeFileSync(DEVICES_FILE, JSON.stringify({ devices: list }, null, 2), "utf8");
}

function touchDevice(req, token, existingId) {
  const now = new Date().toISOString();
  const id = existingId || crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);
  const previous = devices.get(id) || {};
  devices.set(id, {
    ...previous,
    id,
    name: previous.name || deviceNameFromRequest(req),
    ip: clientIp(req),
    userAgent: String(req.headers["user-agent"] || ""),
    firstSeenAt: previous.firstSeenAt || now,
    lastSeenAt: now,
    revokedAt: null
  });
  saveDevices();
  return id;
}

function hasValidSession(req) {
  const token = getSessionToken(req);
  const session = token ? sessions.get(token) : null;
  if (!session) return false;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  session.deviceId = touchDevice(req, token, session.deviceId);
  sessions.set(token, session);
  return true;
}

function createSession(req, res) {
  const token = crypto.randomBytes(24).toString("base64url");
  const deviceId = touchDevice(req, token);
  sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS, deviceId });
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`
  );
}

function accessCodeMatches(value) {
  const expected = Buffer.from(ACCESS_CODE);
  const actual = Buffer.from(String(value || ""));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function unlockKey(req) {
  return req.socket.remoteAddress || "unknown";
}

function isUnlockAllowed(req) {
  const now = Date.now();
  const attempt = unlockAttempts.get(unlockKey(req));
  if (!attempt || attempt.blockedUntil <= now) return true;
  return false;
}

function recordUnlockAttempt(req, ok) {
  const key = unlockKey(req);
  if (ok) {
    unlockAttempts.delete(key);
    return;
  }

  const now = Date.now();
  const previous = unlockAttempts.get(key);
  const count = previous && previous.blockedUntil <= now ? previous.count + 1 : 1;
  unlockAttempts.set(key, {
    count,
    blockedUntil: count >= 5 ? now + 60 * 1000 : 0
  });
}

function hasAccess(req, parsedUrl) {
  if (isLocalRequest(req)) return true;
  return hasValidSession(req) || req.headers["x-lan-drop-code"] === ACCESS_CODE;
}

function requireAccess(req, res, parsedUrl) {
  if (hasAccess(req, parsedUrl)) return true;
  json(res, 401, { error: "Access code required." });
  return false;
}

function safeFileName(name) {
  const base = path.basename(String(name || "file").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_"));
  return base.slice(0, 120) || "file";
}

function isInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function stamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
}

function addItem(item) {
  items.unshift(item);
  items.splice(MAX_ITEMS);
  saveItems();
  broadcast({ type: "added", item });
}

function broadcast(payload) {
  const event = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) client.write(event);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function readBodyBuffer(req) {
  return readRequestToBuffer(req, MAX_BODY_BYTES);
}

function readRequestToBuffer(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function receiveFile(req, destination) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    let stream;
    try {
      stream = fs.createWriteStream(destination, { flags: "wx" });
    } catch (err) {
      return reject(new Error('Cannot create temp file: ' + err.message));
    }

    function fail(error) {
      if (settled) return;
      settled = true;
      try { stream.destroy(); } catch {}
      fs.rm(destination, { force: true }, () => reject(error));
    }

    const timeout = setTimeout(() => {
      req.destroy();
      fail(new Error("UPLOAD_TIMEOUT"));
    }, 120_000);

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        fail(new Error("TOO_LARGE"));
        return;
      }
      if (!stream.write(chunk)) req.pause();
    });
    stream.on("drain", () => req.resume());
    req.on("end", () => {
      if (settled) return;
      stream.end(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        try {
          const stat = fs.statSync(destination);
          if (stat.size !== size) {
            fs.rm(destination, { force: true }, () => reject(new Error('File size mismatch after write')));
            return;
          }
        } catch (err) {
          fs.rm(destination, { force: true }, () => reject(err));
          return;
        }
        resolve(size);
      });
    });
    req.on("error", fail);
    stream.on("error", fail);
  });
}

function refreshAccessCode() {
  if (process.env.LAN_DROP_ACCESS_CODE) return ACCESS_CODE;
  ACCESS_CODE = generateAccessCode();
  fs.writeFileSync(ACCESS_CODE_FILE, ACCESS_CODE, "utf8");
  sessions.clear();
  unlockAttempts.clear();
  return ACCESS_CODE;
}

function listDevices() {
  const activeDeviceIds = new Set(
    [...sessions.values()]
      .filter((session) => session.expiresAt > Date.now())
      .map((session) => session.deviceId)
      .filter(Boolean)
  );
  return [...devices.values()]
    .map((device) => ({
      id: device.id,
      name: device.name,
      ip: device.ip,
      firstSeenAt: device.firstSeenAt,
      lastSeenAt: device.lastSeenAt,
      revokedAt: device.revokedAt || null,
      active: activeDeviceIds.has(device.id)
    }))
    .sort((a, b) => String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || "")));
}

function revokeDevice(deviceId) {
  let revoked = false;
  for (const [token, session] of sessions.entries()) {
    if (session.deviceId === deviceId) {
      sessions.delete(token);
      revoked = true;
    }
  }
  const device = devices.get(deviceId);
  if (device) {
    device.revokedAt = new Date().toISOString();
    devices.set(deviceId, device);
    saveDevices();
    revoked = true;
  }
  return revoked;
}

function decodeHeader(value, fallback) {
  try {
    return decodeURIComponent(String(value || fallback || ""));
  } catch {
    return String(value || fallback || "");
  }
}

function localAddresses() {
  return localAddressDetails().map((entry) => entry.address);
}

function localAddressDetails() {
  const nets = os.networkInterfaces();
  const result = [];
  for (const [name, entries] of Object.entries(nets)) {
    for (const net of entries || []) {
      if (net.family === "IPv4" && !net.internal && isUsableLanAddress(net.address, name)) {
        result.push({
          address: net.address,
          name,
          score: addressScore(net.address, name)
        });
      }
    }
  }
  return result.sort((a, b) => b.score - a.score);
}

function isUsableLanAddress(address, adapterName = "") {
  const name = adapterName.toLowerCase();
  if (address.startsWith("127.") || address.startsWith("169.254.")) return false;
  // 198.18.0.0/15 is reserved for benchmarking and often appears on virtual adapters.
  if (address.startsWith("198.18.") || address.startsWith("198.19.")) return false;
  if (/(virtual|vmware|virtualbox|hyper-v|vethernet|docker|wsl|loopback|tailscale|zerotier|clash|vpn)/i.test(name)) {
    return false;
  }
  return true;
}

function addressScore(address, adapterName = "") {
  const name = adapterName.toLowerCase();
  let score = 0;
  if (address.startsWith("192.168.")) score += 40;
  if (address.startsWith("10.")) score += 30;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) score += 30;
  if (/(wi-fi|wifi|wlan|wireless|鏃犵嚎)/i.test(name)) score += 30;
    if (/(ethernet|以太网)/i.test(name)) score += 15;
  if (!address.endsWith(".1")) score += 10;
  if (address.endsWith(".1")) score -= 20;
  return score;
}

function serveFile(req, res) {
  const rawPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const publicPath = rawPath === "/" || rawPath.endsWith("/") ? `${rawPath}index.html` : rawPath;
  const filePath = path.join(PUBLIC_DIR, publicPath);
  const resolved = path.resolve(filePath);
  if (!isInside(PUBLIC_DIR, resolved)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(resolved)] || "application/octet-stream" });
    res.end(data);
  });
}

function serveDownload(req, res) {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  const name = safeFileName(decodeURIComponent(pathname.replace("/files/", "")));
  const filePath = path.join(INBOX_DIR, name);
  const resolved = path.resolve(filePath);
  if (!isInside(INBOX_DIR, resolved) || !fs.existsSync(resolved)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": mimeTypes[path.extname(resolved)] || "application/octet-stream",
    "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`
  });
  fs.createReadStream(resolved).pipe(res);
}

function itemFileExists(item) {
  if (!item?.filename) return false;
  const resolved = path.resolve(path.join(INBOX_DIR, safeFileName(item.filename)));
  return isInside(INBOX_DIR, resolved) && fs.existsSync(resolved);
}

function saveItems() {
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    items
  };
  fs.writeFileSync(ITEMS_FILE, JSON.stringify(payload, null, 2), "utf8");
}

function loadSavedItems() {
  if (!fs.existsSync(ITEMS_FILE)) return [];
  try {
    const payload = JSON.parse(fs.readFileSync(ITEMS_FILE, "utf8"));
    return (payload.items || [])
      .filter((item) => item?.id && item?.filename && itemFileExists(item))
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function loadExistingItems() {
  return fs
    .readdirSync(INBOX_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => {
      const filename = entry.name;
      const filePath = path.join(INBOX_DIR, filename);
      const stat = fs.statSync(filePath);
      const ext = path.extname(filename).toLowerCase();
      const mime = mimeTypes[ext] || "application/octet-stream";
      const base = {
        id: filename,
        createdAt: stat.mtime.toISOString(),
        filename,
        url: `/files/${encodeURIComponent(filename)}`
      };

      if (ext === ".txt") {
        return {
          ...base,
          type: "text",
          text: fs.readFileSync(filePath, "utf8")
        };
      }

      return {
        ...base,
        type: "file",
        name: filename.replace(/^\d{8}-\d{6}-[a-f0-9]{8}-?/i, "") || filename,
        mime,
        size: stat.size
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, MAX_ITEMS);
}

function mergeItems(savedItems, scannedItems) {
  const byFilename = new Map();
  for (const item of scannedItems) byFilename.set(item.filename, item);
  for (const item of savedItems) byFilename.set(item.filename, item);
  return [...byFilename.values()]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, MAX_ITEMS);
}

function deleteItem(id) {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const [item] = items.splice(index, 1);
  const resolved = path.resolve(path.join(INBOX_DIR, safeFileName(item.filename)));
  if (isInside(INBOX_DIR, resolved) && fs.existsSync(resolved)) {
    fs.unlinkSync(resolved);
  }
  saveItems();
  broadcast({ type: "deleted", id });
  return item;
}

function copyImageToClipboard(filePath) {
  return new Promise((resolve, reject) => {
    const pathBase64 = Buffer.from(filePath, "utf8").toString("base64");
    const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$path = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("${pathBase64}"))
$image = [System.Drawing.Image]::FromFile($path)
try {
  [System.Windows.Forms.Clipboard]::SetImage($image)
} finally {
  $image.Dispose()
}
`;
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const child = childProcess.spawn("powershell.exe", ["-NoProfile", "-STA", "-EncodedCommand", encoded], {
      windowsHide: true
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `PowerShell exited with ${code}`));
    });
  });
}

function copyFileToClipboard(filePath) {
  return new Promise((resolve, reject) => {
    const pathBase64 = Buffer.from(filePath, "utf8").toString("base64");
    const script = `
Add-Type -AssemblyName System.Windows.Forms
$path = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("${pathBase64}"))
$files = New-Object System.Collections.Specialized.StringCollection
[void]$files.Add($path)
$data = New-Object System.Windows.Forms.DataObject
$data.SetFileDropList($files)
[System.Windows.Forms.Clipboard]::SetDataObject($data, $true)
`;
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const child = childProcess.spawn("powershell.exe", ["-NoProfile", "-STA", "-EncodedCommand", encoded], {
      windowsHide: true
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `PowerShell exited with ${code}`));
    });
  });
}

function readSystemClipboardText() {
  return new Promise((resolve, reject) => {
    if (process.platform !== "win32") {
      reject(new Error("System clipboard read is only implemented on Windows."));
      return;
    }
    const script = `
[Console]::OutputEncoding = [Text.Encoding]::UTF8
try {
  $text = Get-Clipboard -Raw -Format Text -ErrorAction Stop
  [Console]::Write($text)
} catch {
  [Console]::Write("")
}
`;
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const child = childProcess.spawn("powershell.exe", ["-NoProfile", "-STA", "-EncodedCommand", encoded], {
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `PowerShell exited with ${code}`));
    });
  });
}

function openFileWithDefaultApp(filePath) {
  return new Promise((resolve, reject) => {
    const pathBase64 = Buffer.from(filePath, "utf8").toString("base64");
    const script = `
$path = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("${pathBase64}"))
Start-Process -LiteralPath $path
`;
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const child = childProcess.spawn("powershell.exe", ["-NoProfile", "-EncodedCommand", encoded], {
      windowsHide: true
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `PowerShell exited with ${code}`));
    });
  });
}

function encryptYaojiVault(payload) {
  const password = String(payload.password || "");
  if (password.length < 8) throw new Error("Password is too short.");
  const salt = payload.salt ? Buffer.from(String(payload.salt), "base64") : crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password, salt, 250000, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const clear = Buffer.from(JSON.stringify(payload.data || { records: [] }), "utf8");
  const encrypted = Buffer.concat([cipher.update(clear), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    kdf: "PBKDF2-SHA256",
    iterations: 250000,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    data: Buffer.concat([encrypted, tag]).toString("base64"),
    updatedAt: new Date().toISOString()
  };
}

function decryptYaojiVault(payload) {
  const password = String(payload.password || "");
  if (password.length < 8) throw new Error("Password is too short.");
  const vault = payload.vault || {};
  const salt = Buffer.from(String(vault.salt || ""), "base64");
  const iv = Buffer.from(String(vault.iv || ""), "base64");
  const encryptedWithTag = Buffer.from(String(vault.data || ""), "base64");
  const encrypted = encryptedWithTag.subarray(0, -16);
  const tag = encryptedWithTag.subarray(-16);
  const key = crypto.pbkdf2Sync(password, salt, 250000, 32, "sha256");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const clear = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(clear.toString("utf8"));
}

function readSharedYaojiVault() {
  if (!fs.existsSync(YAOJI_VAULT_FILE)) return null;
  return JSON.parse(fs.readFileSync(YAOJI_VAULT_FILE, "utf8"));
}

function writeSharedYaojiVault(vault) {
  fs.writeFileSync(YAOJI_VAULT_FILE, JSON.stringify(vault, null, 2), "utf8");
}

loadDevices();
items.push(...mergeItems(loadSavedItems(), loadExistingItems()));
saveItems();

function createServer() {
  return http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const route = parsedUrl.pathname;

    if (req.method === "GET" && route === "/api/info") {
      const requestPort = Number(req.headers.host?.split(":").pop()) || PORT;
      const addresses = localAddressDetails();
      const urls = addresses.map((entry) => `http://${entry.address}:${requestPort}`);
      json(res, 200, {
        port: requestPort,
        version: APP_VERSION,
        inbox: INBOX_DIR,
        accessRequired: !isLocalRequest(req),
        accessCode: isLocalRequest(req) ? ACCESS_CODE : null,
        urls,
        addresses: addresses.map((entry) => ({
          address: entry.address,
          name: entry.name,
          url: `http://${entry.address}:${requestPort}`,
          recommended: entry === addresses[0]
        }))
      });
      return;
    }

    if (req.method === "GET" && route === "/api/update/latest") {
      if (!isLocalRequest(req)) {
        json(res, 403, { error: "Updates can only be checked from this computer." });
        return;
      }
      try {
        json(res, 200, await latestReleaseInfo());
      } catch (error) {
        json(res, 502, {
          error: "Unable to check updates.",
          detail: error.message,
          currentVersion: APP_VERSION,
          releasesUrl: "https://github.com/t01094738688-commits/lan-drop/releases"
        });
      }
      return;
    }

    if (req.method === "GET" && route === "/api/access/status") {
      json(res, 200, {
        ok: hasAccess(req, parsedUrl),
        isLocal: isLocalRequest(req),
        code: isLocalRequest(req) ? ACCESS_CODE : null
      });
      return;
    }

    if (req.method === "POST" && route === "/api/access/unlock") {
      if (!isUnlockAllowed(req)) {
        json(res, 429, { error: "Too many attempts. Try again in one minute." });
        return;
      }
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");
      if (accessCodeMatches(payload.code)) {
        recordUnlockAttempt(req, true);
        createSession(req, res);
        json(res, 200, { ok: true });
      } else {
        recordUnlockAttempt(req, false);
        json(res, 403, { error: "Invalid access code." });
      }
      return;
    }

    if (req.method === "POST" && route === "/api/access/refresh") {
      if (!isLocalRequest(req)) {
        json(res, 403, { error: "Access code can only be refreshed from this computer." });
        return;
      }
      json(res, 200, { ok: true, accessCode: refreshAccessCode() });
      return;
    }

    if (req.method === "GET" && route === "/api/devices") {
      if (!isLocalRequest(req)) {
        json(res, 403, { error: "Devices can only be managed from this computer." });
        return;
      }
      json(res, 200, { devices: listDevices() });
      return;
    }

    if (req.method === "DELETE" && route.startsWith("/api/devices/")) {
      if (!isLocalRequest(req)) {
        json(res, 403, { error: "Devices can only be managed from this computer." });
        return;
      }
      const id = decodeURIComponent(route.replace("/api/devices/", ""));
      if (!revokeDevice(id)) {
        json(res, 404, { error: "Device not found." });
        return;
      }
      json(res, 200, { ok: true, devices: listDevices() });
      return;
    }

    if (req.method === "GET" && route === "/api/items") {
      if (!requireAccess(req, res, parsedUrl)) return;
      json(res, 200, { items });
      return;
    }

    if (req.method === "DELETE" && route.startsWith("/api/items/")) {
      if (!requireAccess(req, res, parsedUrl)) return;
      const id = decodeURIComponent(route.replace("/api/items/", ""));
      const deleted = deleteItem(id);
      if (!deleted) {
        json(res, 404, { error: "Item not found." });
        return;
      }
      json(res, 200, { ok: true, item: deleted });
      return;
    }

    if (req.method === "GET" && route === "/api/qr") {
      if (!requireAccess(req, res, parsedUrl)) return;
      const text = parsedUrl.searchParams.get("text") || "";
      if (!text) {
        json(res, 400, { error: "Missing text." });
        return;
      }
      const svg = await qrcode.toString(text, {
        type: "svg",
        margin: 1,
        color: {
          dark: "#172026",
          light: "#ffffff"
        }
      });
      res.writeHead(200, {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Length": Buffer.byteLength(svg)
      });
      res.end(svg);
      return;
    }

    if (req.method === "GET" && route === "/api/events") {
      if (!requireAccess(req, res, parsedUrl)) return;
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      });
      res.write("retry: 1000\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    if (req.method === "GET" && route === "/api/clipboard/text") {
      if (!isLocalRequest(req)) {
        json(res, 403, { error: "Clipboard can only be read from this computer." });
        return;
      }
      try {
        json(res, 200, { text: await readSystemClipboardText() });
      } catch (error) {
        json(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === "GET" && route.startsWith("/files/")) {
      if (!requireAccess(req, res, parsedUrl)) return;
      serveDownload(req, res);
      return;
    }

    if (req.method === "POST" && route === "/api/open-file") {
      if (!isLocalRequest(req)) {
        json(res, 403, { error: "Files can only be opened from this computer." });
        return;
      }
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const filename = safeFileName(payload.filename);
      const filePath = path.join(INBOX_DIR, filename);
      const resolved = path.resolve(filePath);

      if (!isInside(INBOX_DIR, resolved) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        json(res, 404, { error: "File not found." });
        return;
      }

      await openFileWithDefaultApp(resolved);
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && route === "/api/items") {
      if (!requireAccess(req, res, parsedUrl)) return;
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      if (payload.type === "text") {
        const text = String(payload.text || "");
        if (!text.trim()) {
          json(res, 400, { error: "Text is empty." });
          return;
        }
        const filename = `${stamp()}-${id.slice(0, 8)}.txt`;
        fs.writeFileSync(path.join(INBOX_DIR, filename), text, "utf8");
        const item = {
          id,
          type: "text",
          createdAt,
          text,
          source: payload.source === "clipboard" ? "clipboard" : "manual",
          filename,
          url: `/files/${encodeURIComponent(filename)}`
        };
        addItem(item);
        json(res, 201, { item });
        return;
      }

      if (payload.type === "file") {
        const match = String(payload.dataUrl || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/);
        if (!match || match[2] !== ";base64") {
          json(res, 400, { error: "Expected a base64 data URL." });
          return;
        }
        const originalName = safeFileName(payload.name || "upload");
        const filename = `${stamp()}-${id.slice(0, 8)}-${originalName}`;
        const buffer = Buffer.from(match[3], "base64");
        fs.writeFileSync(path.join(INBOX_DIR, filename), buffer);
        const item = {
          id,
          type: "file",
          createdAt,
          name: originalName,
          mime: match[1] || "application/octet-stream",
          filename,
          url: `/files/${encodeURIComponent(filename)}`,
          size: buffer.length
        };
        addItem(item);
        json(res, 201, { item });
        return;
      }

      json(res, 400, { error: "Unknown item type." });
      return;
    }

    if (req.method === "POST" && route === "/api/upload") {
      if (!requireAccess(req, res, parsedUrl)) return;
      const originalName = safeFileName(decodeHeader(req.headers["x-file-name"], "upload"));
      const mime = String(req.headers["content-type"] || "application/octet-stream");
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const filename = `${stamp()}-${id.slice(0, 8)}-${originalName}`;
      const tempPath = path.join(INBOX_DIR, `.${filename}.${crypto.randomBytes(6).toString("hex")}.tmp`);
      const finalPath = path.join(INBOX_DIR, filename);
      const size = await receiveFile(req, tempPath);

      if (!size) {
        fs.rmSync(tempPath, { force: true });
        json(res, 400, { error: "File is empty." });
        return;
      }

      fs.renameSync(tempPath, finalPath);
      const item = {
        id,
        type: "file",
        createdAt,
        name: originalName,
        mime,
        filename,
        url: `/files/${encodeURIComponent(filename)}`,
        size
      };
      addItem(item);
      json(res, 201, { item });
      return;
    }

    if (req.method === "POST" && route === "/api/copy-image") {
      if (!requireAccess(req, res, parsedUrl)) return;
      if (process.platform !== "win32") {
        json(res, 400, { error: "System clipboard copy is only implemented on Windows." });
        return;
      }

      const body = await readBody(req);
      const payload = JSON.parse(body);
      const filename = safeFileName(payload.filename);
      const filePath = path.join(INBOX_DIR, filename);
      const resolved = path.resolve(filePath);
      const type = mimeTypes[path.extname(resolved).toLowerCase()] || "";

      if (!isInside(INBOX_DIR, resolved) || !fs.existsSync(resolved) || !type.startsWith("image/")) {
        json(res, 404, { error: "Image not found." });
        return;
      }

      await copyImageToClipboard(resolved);
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && route === "/api/copy-file") {
      if (!requireAccess(req, res, parsedUrl)) return;
      if (process.platform !== "win32") {
        json(res, 400, { error: "System clipboard copy is only implemented on Windows." });
        return;
      }

      const body = await readBody(req);
      const payload = JSON.parse(body);
      const filename = safeFileName(payload.filename);
      const filePath = path.join(INBOX_DIR, filename);
      const resolved = path.resolve(filePath);

      if (!isInside(INBOX_DIR, resolved) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        json(res, 404, { error: "File not found." });
        return;
      }

      await copyFileToClipboard(resolved);
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && route === "/api/yaoji/encrypt") {
      if (!requireAccess(req, res, parsedUrl)) return;
      const body = await readBody(req);
      json(res, 200, { vault: encryptYaojiVault(JSON.parse(body)) });
      return;
    }

    if (req.method === "POST" && route === "/api/yaoji/decrypt") {
      if (!requireAccess(req, res, parsedUrl)) return;
      const body = await readBody(req);
      json(res, 200, { data: decryptYaojiVault(JSON.parse(body)) });
      return;
    }

    if (req.method === "GET" && route === "/api/yaoji/vault") {
      if (!requireAccess(req, res, parsedUrl)) return;
      json(res, 200, { vault: readSharedYaojiVault() });
      return;
    }

    if (req.method === "PUT" && route === "/api/yaoji/vault") {
      if (!requireAccess(req, res, parsedUrl)) return;
      const body = await readBody(req);
      const payload = JSON.parse(body);
      if (!payload.vault || !payload.vault.salt || !payload.vault.iv || !payload.vault.data) {
        json(res, 400, { error: "Invalid vault." });
        return;
      }
      writeSharedYaojiVault(payload.vault);
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "DELETE" && route === "/api/yaoji/vault") {
      if (!requireAccess(req, res, parsedUrl)) return;
      if (fs.existsSync(YAOJI_VAULT_FILE)) fs.unlinkSync(YAOJI_VAULT_FILE);
      json(res, 200, { ok: true });
      return;
    }
    if (req.method === "GET" && route === "/api/notes/page") {
      if (!requireAccess(req, res, parsedUrl)) return;
      const notesPath = path.join(NOTES_DIR, "page.json");
      if (!fs.existsSync(notesPath)) {
        json(res, 200, { page: { text: "", images: [], updatedAt: new Date().toISOString() } });
        return;
      }
      try {
        json(res, 200, { page: JSON.parse(fs.readFileSync(notesPath, "utf8")) });
      } catch {
        json(res, 200, { page: { text: "", images: [], updatedAt: new Date().toISOString() } });
      }
      return;
    }

    if (req.method === "PUT" && route === "/api/notes/page") {
      if (!requireAccess(req, res, parsedUrl)) return;
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const page = payload.page || {};
      const isLegacyPage = typeof page.text === "string" && Array.isArray(page.images);
      const isNotesPage = Array.isArray(page.notes) && Array.isArray(page.categories);
      if (!isLegacyPage && !isNotesPage) {
        json(res, 400, { error: "Invalid page data." });
        return;
      }
      const notesPath = path.join(NOTES_DIR, "page.json");
      fs.writeFileSync(notesPath, JSON.stringify({ ...page, updatedAt: new Date().toISOString() }), "utf8");
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && route === "/api/notes/upload-image") {
      if (!requireAccess(req, res, parsedUrl)) return;
      const id = crypto.randomUUID();
      const ext = path.extname(String(req.headers["content-type"]?.split("/").pop() || "")) || ".png";
      const imageFilename = `note-${id}${ext}`;
      const imagePath = path.join(NOTES_DIR, imageFilename);
      const size = await receiveFile(req, imagePath);
      if (!size) {
        fs.rmSync(imagePath, { force: true });
        json(res, 400, { error: "Image is empty." });
        return;
      }
      json(res, 201, { filename: imageFilename, url: `/notes-files/${imageFilename}` });
      return;
    }

    if (req.method === "GET" && route.startsWith("/notes-files/")) {
      if (!requireAccess(req, res, parsedUrl)) return;
      const name = safeFileName(decodeURIComponent(route.replace("/notes-files/", "")));
      const notesPath = path.join(NOTES_DIR, name);
      const resolved = path.resolve(notesPath);
      if (!isInside(NOTES_DIR, resolved) || !fs.existsSync(resolved)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": mimeTypes[path.extname(resolved)] || "application/octet-stream" });
      fs.createReadStream(resolved).pipe(res);
      return;
    }


    if (req.method === "GET") {
      serveFile(req, res);
      return;
    }

    res.writeHead(405);
    res.end("Method not allowed");
  } catch (error) {
    if (error.message === "TOO_LARGE") {
      json(res, 413, { error: "The upload is too large. Keep one item under 200 MB." });
      return;
    }
    json(res, 500, { error: error.message || "Server error." });
  }
  });
}

function startServer(options = {}) {
  const port = options.port === undefined ? PORT : Number(options.port);
  const host = options.host || "0.0.0.0";
  const server = createServer();
  server.listen(port, host, () => {
  const actualPort = server.address().port;
  const urls = localAddresses().map((address) => `http://${address}:${actualPort}`);
  console.log("LAN Drop is running.");
  console.log(`Computer: http://localhost:${actualPort}`);
  console.log(`Inbox: ${INBOX_DIR}`);
  console.log(`Access code: ${ACCESS_CODE}`);
  for (const url of urls) console.log(`Phone: ${url}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  INBOX_DIR,
  localAddresses,
  startServer
};

