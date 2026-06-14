sessionStorage.setItem("lanDrop.yaojiOpen", "true");
const storageKey = "yaoji.encrypted.v3";
const oldStorageKey = "yaoji.encrypted.v2";
const sessionPasswordKey = "yaoji.session.password";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const hasWebCrypto = Boolean(globalThis.crypto?.subtle);

let masterKey = null;
let vault = { records: [] };
let selectedId = null;
let toastTimer = null;
let clipboardClearTimer = null;
let sharedPayload = null;
let localFallbackPayload = null;

const $ = (id) => document.getElementById(id);

const authView = $("authView");
const appView = $("appView");
const masterPassword = $("masterPassword");
const keepUnlocked = $("keepUnlocked");
const unlockButton = $("unlockButton");
const authHint = $("authHint");
const masterPasswordLabel = $("masterPasswordLabel");
const resetVaultButton = $("resetVaultButton");
const recordForm = $("recordForm");
const recordList = $("recordList");
const searchInput = $("searchInput");
const filterInput = $("filterInput");

function bytesToBase64(bytes) {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let index = 0; index < view.length; index += 0x8000) {
    binary += String.fromCharCode(...view.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function uid() {
  return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

async function deriveKey(password, salt) {
  if (!hasWebCrypto) return { mode: "server", password };
  const baseKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptVault(data, key, existingSaltBase64) {
  if (key?.mode === "server") {
    const response = await fetch("/api/yaoji/encrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: key.password, salt: existingSaltBase64, data }),
    });
    if (!response.ok) throw new Error("server encrypt failed");
    return (await response.json()).vault;
  }

  const salt = existingSaltBase64 ? base64ToBytes(existingSaltBase64) : crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(data)));
  return {
    version: 1,
    kdf: "PBKDF2-SHA256",
    iterations: 250000,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(ciphertext),
    updatedAt: new Date().toISOString(),
  };
}

async function decryptVault(payload, password) {
  if (!hasWebCrypto) {
    const response = await fetch("/api/yaoji/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, vault: payload }),
    });
    if (!response.ok) throw new Error("server decrypt failed");
    return { key: { mode: "server", password }, data: normalizeVault((await response.json()).data) };
  }

  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const key = await deriveKey(password, salt);
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, base64ToBytes(payload.data));
  return { key, data: normalizeVault(JSON.parse(decoder.decode(clear))) };
}

function normalizeVault(data) {
  return {
    records: (data.records || []).map((record) => ({
      id: record.id || uid(),
      title: record.title || "未命名",
      type: record.type || (record.account ? "账号" : "密钥"),
      account: record.account || "",
      secret: record.secret || "",
      notes: record.notes || "",
      tags: Array.isArray(record.tags) ? record.tags : [],
      expires: record.expires || "",
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt || new Date().toISOString(),
    })),
  };
}

function readPayload() {
  if (sharedPayload) return sharedPayload;
  if (localFallbackPayload) return localFallbackPayload;
  const raw = localStorage.getItem(storageKey) || localStorage.getItem(oldStorageKey);
  localFallbackPayload = raw ? JSON.parse(raw) : null;
  return localFallbackPayload;
}

async function loadSharedPayload() {
  try {
    const raw = localStorage.getItem(storageKey) || localStorage.getItem(oldStorageKey);
    localFallbackPayload = raw ? JSON.parse(raw) : null;
    const response = await fetch("/api/yaoji/vault");
    if (!response.ok) return;
    const data = await response.json();
    sharedPayload = data.vault || null;
  } catch {
    sharedPayload = null;
  }
}

async function persistPayload(payload) {
  sharedPayload = payload;
  localFallbackPayload = payload;
  localStorage.setItem(storageKey, JSON.stringify(payload));
  await fetch("/api/yaoji/vault", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vault: payload }),
  });
}

async function saveVault() {
  const existing = readPayload();
  const payload = await encryptVault(vault, masterKey, existing?.salt || null);
  await persistPayload(payload);
  renderRecords();
}

function showToast(message) {
  clearTimeout(toastTimer);
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 2200);
}

async function safeCopyToClipboard(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const input = document.createElement("textarea");
      input.value = value;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    // Set 30-second clipboard clear timer
    clearTimeout(clipboardClearTimer);
    clipboardClearTimer = setTimeout(async () => {
      try {
        const current = await navigator.clipboard.readText();
        if (current === value) {
          await navigator.clipboard.writeText(" ");
        }
      } catch {}
    }, 30000);
  } catch {
    showToast("复制失败，请手动选中复制");
  }
}

async function copyText(value, successMessage) {
  await safeCopyToClipboard(value);
  showToast(successMessage);
}

function mask(value) {
  const compact = String(value || "").replace(/\s+/g, " ");
  if (compact.length <= 10) return "••••••••••";
  return `${compact.slice(0, 4)}••••••••••${compact.slice(-4)}`;
}

function expiresStatus(expires) {
  if (!expires) return "";
  const now = new Date();
  const target = new Date(expires);
  if (target <= now) return "expired";
  const diff = target - now;
  if (diff < 7 * 24 * 60 * 60 * 1000) return "soon";
  return "";
}

function generatePassword() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*_-+=";
  const length = 24;
  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function filteredRecords() {
  const query = searchInput.value.trim().toLowerCase();
  const type = filterInput.value;
  return vault.records
    .filter((record) => (type === "all" ? true : record.type === type))
    .filter((record) => {
      if (!query) return true;
      return [record.title, record.account, record.secret, record.notes, ...(record.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function renderRecords() {
  const records = filteredRecords();
  $("summaryText").textContent = `${vault.records.length} 条记录，当前显示 ${records.length} 条`;
  recordList.innerHTML = "";

  if (!records.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = vault.records.length ? "没有匹配的记录。" : "还没有记录，先在左侧保存一条。";
    recordList.append(empty);
    return;
  }

  for (const record of records) {
    const card = document.createElement("article");
    card.className = "record-card";
    const status = expiresStatus(record.expires);
    card.innerHTML = `
      <div class="record-main">
        <div>
          <div class="record-title"></div>
          <div class="record-meta"></div>
          <div class="record-tags"></div>
        </div>
        <span class="pill ${status ? (status === "expired" ? "expired" : "soon") : ""}"></span>
      </div>
      <div class="secret-preview"></div>
      <div class="notes-preview"></div>
      <div class="card-actions">
        <button type="button" class="ghost" data-action="copy-secret">复制内容</button>
        <button type="button" class="ghost" data-action="copy-account">复制账号</button>
        <button type="button" class="ghost" data-action="edit">编辑</button>
      </div>
    `;
    card.querySelector(".record-title").textContent = record.title;
    card.querySelector(".pill").textContent = record.type;
    const meta = card.querySelector(".record-meta");
    meta.textContent = new Date(record.updatedAt).toLocaleString();
    if (record.expires) {
      const exp = document.createElement("span");
      exp.className = "account-chip " + (status || "");
      exp.textContent = "到期: " + new Date(record.expires).toLocaleDateString();
      meta.append(exp);
    }
    if (record.account) {
      const account = document.createElement("span");
      account.className = "account-chip";
      account.textContent = record.account;
      meta.append(account);
    }
    const tagsEl = card.querySelector(".record-tags");
    if (record.tags && record.tags.length) {
      for (const tag of record.tags) {
        const chip = document.createElement("span");
        chip.className = "tag-chip";
        chip.textContent = tag;
        tagsEl.append(chip);
      }
    }
    card.querySelector(".secret-preview").textContent = mask(record.secret);
    card.querySelector(".notes-preview").textContent = record.notes || "";
    card.querySelector('[data-action="copy-secret"]').addEventListener("click", () => copyText(record.secret, "内容已复制"));
    card.querySelector('[data-action="copy-account"]').addEventListener("click", () => {
      if (!record.account) return showToast("这条记录没有账号");
      copyText(record.account, "账号已复制");
    });
    card.querySelector('[data-action="edit"]').addEventListener("click", () => editRecord(record.id));
    recordList.append(card);
  }
}

function resetForm() {
  selectedId = null;
  $("formTitle").textContent = "新记录";
  $("newButton").classList.add("hidden");
  $("deleteButton").classList.add("hidden");
  recordForm.reset();
  $("typeInput").value = "账号";
}

function editRecord(id) {
  const record = vault.records.find((item) => item.id === id);
  if (!record) return;
  selectedId = id;
  $("formTitle").textContent = "编辑记录";
  $("newButton").classList.remove("hidden");
  $("deleteButton").classList.remove("hidden");
  $("titleInput").value = record.title;
  $("typeInput").value = record.type || "账号";
  $("accountInput").value = record.account || "";
  $("secretInput").value = record.secret;
  $("notesInput").value = record.notes || "";
  $("tagsInput").value = (record.tags || []).join(", ");
  $("expiresInput").value = record.expires || "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function collectForm() {
  const now = new Date().toISOString();
  const existing = vault.records.find((record) => record.id === selectedId);
  const tagsRaw = $("tagsInput").value;
  return {
    id: selectedId || uid(),
    title: $("titleInput").value.trim(),
    type: $("typeInput").value,
    account: $("accountInput").value.trim(),
    secret: $("secretInput").value,
    tags: tagsRaw
      .split(/[,，、\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8),
    expires: $("expiresInput").value || "",
    notes: $("notesInput").value.trim(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function refreshAuthState(message) {
  const hasVault = Boolean(readPayload());
  resetVaultButton.classList.toggle("hidden", !hasVault);
  masterPasswordLabel.textContent = hasVault ? "输入主密码解锁" : "创建钥记主密码";
  masterPassword.placeholder = hasVault ? "输入创建时设置的主密码" : "设置至少 8 位主密码";
  unlockButton.textContent = hasVault ? "打开钥记" : "创建钥记";
  authHint.textContent =
    message ||
    (hasVault
      ? "这台设备已有加密库。输错主密码只会提示失败，不会覆盖原来的钥记内容。"
      : "还没有加密库。输入一个至少 8 位主密码即可创建；请记牢，忘记后无法找回。");
  if (!hasWebCrypto) {
    authHint.textContent += " 当前手机浏览器不支持本地加密，将通过你的电脑服务辅助加密。";
  }
}

async function unlock(password, options = {}) {
  unlockButton.disabled = true;
  const payload = readPayload();
  unlockButton.textContent = payload ? "正在打开..." : "正在创建...";
  try {
    if (payload) {
      let unlocked;
      try {
        unlocked = await decryptVault(payload, password);
      } catch (error) {
        if (!sharedPayload || !localFallbackPayload || localFallbackPayload === sharedPayload) throw error;
        unlocked = await decryptVault(localFallbackPayload, password);
        await persistPayload(localFallbackPayload);
        showToast("已用本机缓存恢复钥记");
      }
      masterKey = unlocked.key;
      vault = unlocked.data;
    } else {
      const salt = hasWebCrypto ? crypto.getRandomValues(new Uint8Array(16)) : null;
      masterKey = await deriveKey(password, salt);
      vault = { records: [] };
      await persistPayload(await encryptVault(vault, masterKey, salt ? bytesToBase64(salt) : null));
    }
    if (keepUnlocked.checked) {
      sessionStorage.setItem(sessionPasswordKey, password);
    } else {
      sessionStorage.removeItem(sessionPasswordKey);
    }
    masterPassword.value = "";
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    renderRecords();
  } catch {
    sessionStorage.removeItem(sessionPasswordKey);
    refreshAuthState(readPayload() ? "主密码不正确，原来的钥记内容仍然保留。" : "创建失败，请重试。");
    showToast(readPayload() ? "主密码不正确" : "创建失败");
  } finally {
    unlockButton.disabled = false;
    unlockButton.textContent = readPayload() ? "打开钥记" : "创建钥记";
  }
}

function submitPassword() {
  const password = masterPassword.value;
  if (!password) return showToast("请输入主密码");
  if (password.length < 8) return showToast("主密码至少 8 位");
  unlock(password);
}

$("authForm").addEventListener("submit", (event) => {
  event.preventDefault();
  submitPassword();
});

unlockButton.addEventListener("click", submitPassword);

masterPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    submitPassword();
  }
});

$("togglePassword").addEventListener("click", () => {
  masterPassword.type = masterPassword.type === "password" ? "text" : "password";
});

$("generatePassword").addEventListener("click", () => {
  $("secretInput").value = generatePassword();
});

recordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const record = collectForm();
  if (!record.title || !record.secret) return showToast("名称和内容都要填");
  if (selectedId) {
    vault.records = vault.records.map((item) => (item.id === selectedId ? record : item));
  } else {
    vault.records.push(record);
  }
  await saveVault();
  resetForm();
  showToast("已保存");
});

$("deleteButton").addEventListener("click", async () => {
  if (!selectedId) return;
  const record = vault.records.find((item) => item.id === selectedId);
  if (!confirm(`删除「${record.title}」？`)) return;
  vault.records = vault.records.filter((item) => item.id !== selectedId);
  await saveVault();
  resetForm();
  showToast("已删除");
});

$("newButton").addEventListener("click", resetForm);
searchInput.addEventListener("input", renderRecords);
filterInput.addEventListener("change", renderRecords);

resetVaultButton.addEventListener("click", () => {
  if (!confirm("清空这台设备里的钥记数据？如果没有导出备份，清空后无法恢复。")) return;
  localStorage.removeItem(storageKey);
  localStorage.removeItem(oldStorageKey);
  sessionStorage.removeItem(sessionPasswordKey);
  sharedPayload = null;
  localFallbackPayload = null;
  fetch("/api/yaoji/vault", { method: "DELETE" }).catch(() => {});
  masterKey = null;
  vault = { records: [] };
  masterPassword.value = "";
  refreshAuthState("已清空本机库。现在可以重新创建。");
  showToast("已清空");
});

$("lockButton").addEventListener("click", () => {
  sessionStorage.removeItem(sessionPasswordKey);
  masterKey = null;
  vault = { records: [] };
  resetForm();
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
});

$("exportButton").addEventListener("click", () => {
  const payload = readPayload();
  if (!payload) return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `yaoji-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("已导出加密备份");
});

$("importInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!imported.salt || !imported.iv || !imported.data) throw new Error("invalid");
    await persistPayload(imported);
    $("lockButton").click();
    refreshAuthState("已导入加密备份，请用备份对应的主密码打开。");
    showToast("导入完成");
  } catch {
    showToast("导入失败，文件格式不对");
  } finally {
    event.target.value = "";
  }
});

async function init() {
  await loadSharedPayload();

  refreshAuthState();
  const savedPassword = sessionStorage.getItem(sessionPasswordKey);
  if (savedPassword && readPayload()) {
    unlock(savedPassword);
  }
}

init();
