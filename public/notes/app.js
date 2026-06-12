const storageKey = "lan-drop.notes.page.v2";
const oldPageKey = "lan-drop.notes.page.v1";
const oldListKey = "lan-drop.notes.v1";

const defaultCategories = [
  { id: "life", name: "生活", builtIn: true },
  { id: "study", name: "学习", builtIn: true },
  { id: "work", name: "工作", builtIn: true },
  { id: "idea", name: "灵感", builtIn: true },
  { id: "todo", name: "待办", builtIn: true },
  { id: "other", name: "其他", builtIn: true }
];

const $ = (id) => document.getElementById(id);
const appWorkspace = document.querySelector(".app-workspace");

const dayTitle = $("dayTitle");
const datePicker = $("datePicker");
const prevDay = $("prevDay");
const nextDay = $("nextDay");
const todayButton = $("todayButton");
const searchInput = $("searchInput");
const categoryFilter = $("categoryFilter");
const manageCategories = $("manageCategories");
const noteCategory = $("noteCategory");
const saveState = $("saveState");
const noteText = $("noteText");
const imageInput = $("imageInput");
const draftImages = $("draftImages");
const clearDraft = $("clearDraft");
const saveNote = $("saveNote");
const listSummary = $("listSummary");
const sendHint = $("sendHint");
const notesList = $("notesList");
const noteDialog = $("noteDialog");
const dialogContent = $("dialogContent");
const dialogCopyText = $("dialogCopyText");
const dialogShare = $("dialogShare");
const dialogClose = $("dialogClose");
const categoryDialog = $("categoryDialog");
const categoryList = $("categoryList");
const newCategoryName = $("newCategoryName");
const addCategory = $("addCategory");

let page = createEmptyPage();
let selectedDate = todayKey();
let editingId = null;
let activeNoteId = null;
let saveTimer = null;
let booted = false;

function resetWorkspaceScroll() {
  if (appWorkspace) appWorkspace.scrollTo({ top: 0, left: 0, behavior: "auto" });
  else window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function createEmptyPage() {
  return {
    version: 2,
    categories: [...defaultCategories],
    notes: [],
    draft: {
      text: "",
      categoryId: "life",
      images: []
    },
    updatedAt: new Date().toISOString()
  };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function todayKey() {
  return dateKey(new Date());
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function sameDate(iso, key) {
  return dateKey(new Date(iso)) === key;
}

function timeLabel(iso) {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dateLabel(key) {
  const date = dateFromKey(key);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(date);
}

function categoryById(id) {
  return page.categories.find((category) => category.id === id) || page.categories[0] || defaultCategories[0];
}

function imageUrl(filename) {
  return filename ? `/notes-files/${filename}` : "";
}

function normalizeImage(image) {
  return {
    id: image.id || createId(),
    filename: image.filename || "",
    name: image.name || image.filename || "图片",
    src: image.src || imageUrl(image.filename)
  };
}

function normalizePage(raw) {
  const normalized = createEmptyPage();
  if (!raw || typeof raw !== "object") return normalized;

  if (Array.isArray(raw.notes)) {
    normalized.categories = mergeCategories(raw.categories);
    normalized.notes = raw.notes.map((note) => ({
      id: note.id || createId(),
      text: String(note.text || ""),
      categoryId: note.categoryId || "other",
      images: (note.images || []).map(normalizeImage),
      createdAt: note.createdAt || raw.updatedAt || new Date().toISOString(),
      updatedAt: note.updatedAt || note.createdAt || raw.updatedAt || new Date().toISOString()
    }));
    normalized.draft = {
      text: raw.draft?.text || "",
      categoryId: raw.draft?.categoryId || normalized.categories[0]?.id || "life",
      images: (raw.draft?.images || []).map(normalizeImage)
    };
    normalized.updatedAt = raw.updatedAt || new Date().toISOString();
    return normalized;
  }

  if (typeof raw.text === "string" || Array.isArray(raw.images)) {
    const hasContent = raw.text?.trim() || raw.images?.length;
    if (hasContent) {
      normalized.notes.push({
        id: createId(),
        text: raw.text || "",
        categoryId: "other",
        images: (raw.images || []).map(normalizeImage),
        createdAt: raw.updatedAt || new Date().toISOString(),
        updatedAt: raw.updatedAt || new Date().toISOString()
      });
    }
  }
  return normalized;
}

function mergeCategories(categories = []) {
  const byId = new Map(defaultCategories.map((category) => [category.id, { ...category }]));
  for (const category of categories) {
    if (!category?.id || !category?.name) continue;
    byId.set(category.id, {
      id: category.id,
      name: category.name,
      builtIn: Boolean(defaultCategories.find((item) => item.id === category.id)?.builtIn || category.builtIn)
    });
  }
  return [...byId.values()];
}

async function loadNotesFromServer() {
  try {
    const response = await fetch("/api/notes/page");
    if (!response.ok) throw new Error("server error");
    const data = await response.json();
    return data.page || null;
  } catch {
    return null;
  }
}

async function saveNotesToServer(pageData) {
  await fetch("/api/notes/page", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page: pageData })
  });
}

function saveLocal() {
  localStorage.setItem(storageKey, JSON.stringify(page));
}

function showSaved(text = "已保存") {
  saveState.textContent = text;
}

function scheduleSave(reason = "保存中...") {
  page.updatedAt = new Date().toISOString();
  saveLocal();
  if (!booted) return;
  showSaved(reason);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await saveNotesToServer(page);
      showSaved("已保存");
    } catch {
      showSaved("离线保存");
    }
  }, 350);
}

async function uploadImageToServer(file) {
  const response = await fetch("/api/notes/upload-image", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "image/png",
      "X-File-Name": encodeURIComponent(file.name || "image")
    },
    body: file
  });
  if (!response.ok) throw new Error("upload failed");
  return response.json();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function autoResizeTextarea() {
  noteText.style.height = "auto";
  noteText.style.height = `${Math.min(noteText.scrollHeight, 260)}px`;
}

function syncDraftFromInputs() {
  page.draft.text = noteText.value;
  page.draft.categoryId = noteCategory.value;
}

function renderDate() {
  datePicker.value = selectedDate;
  dayTitle.textContent = dateLabel(selectedDate);
}

function renderCategoryOptions() {
  const selectedDraft = page.draft.categoryId;
  const selectedFilter = categoryFilter.value || "all";
  noteCategory.innerHTML = "";
  categoryFilter.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "全部分类";
  categoryFilter.append(allOption);

  for (const category of page.categories) {
    const draftOption = document.createElement("option");
    draftOption.value = category.id;
    draftOption.textContent = category.name;
    noteCategory.append(draftOption);

    const filterOption = document.createElement("option");
    filterOption.value = category.id;
    filterOption.textContent = category.name;
    categoryFilter.append(filterOption);
  }
  noteCategory.value = page.categories.some((category) => category.id === selectedDraft) ? selectedDraft : page.categories[0].id;
  categoryFilter.value = selectedFilter === "all" || page.categories.some((category) => category.id === selectedFilter) ? selectedFilter : "all";
}

function renderDraftImages() {
  draftImages.innerHTML = "";
  for (const image of page.draft.images) {
    const item = document.createElement("div");
    item.className = "draft-image";
    const img = document.createElement("img");
    img.src = image.src || imageUrl(image.filename);
    img.alt = image.name || "随记图片";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "image-remove";
    remove.textContent = "×";
    remove.title = "删除图片";
    remove.addEventListener("click", () => {
      page.draft.images = page.draft.images.filter((entry) => entry.id !== image.id);
      renderDraftImages();
      scheduleSave();
    });
    item.append(img, remove);
    draftImages.append(item);
  }
}

function noteMatches(note) {
  if (!sameDate(note.createdAt, selectedDate)) return false;
  if (categoryFilter.value !== "all" && note.categoryId !== categoryFilter.value) return false;
  const query = searchInput.value.trim().toLowerCase();
  if (!query) return true;
  const category = categoryById(note.categoryId).name;
  return [note.text, category, ...note.images.map((img) => img.name || img.filename)]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function noteShareText(note) {
  const category = categoryById(note.categoryId).name;
  const lines = [`[随记] ${dateLabel(dateKey(new Date(note.createdAt)))} ${timeLabel(note.createdAt)}`, `分类：${category}`];
  if (note.text.trim()) lines.push("", note.text.trim());
  if (note.images.length) {
    lines.push("", "图片：");
    for (const image of note.images) {
      const url = new URL(image.src || imageUrl(image.filename), location.origin).href;
      lines.push(url);
    }
  }
  return lines.join("\n");
}

function renderNotes() {
  notesList.innerHTML = "";
  const visible = page.notes
    .filter(noteMatches)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  listSummary.textContent = `${visible.length} 条随记`;
  sendHint.textContent = visible.some((note) => note.text.trim() && note.images.length) ? "文字和图片可一起同步到互传" : "";

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "这一天还没有随记。";
    notesList.append(empty);
    return;
  }

  for (const note of visible) {
    const card = document.createElement("article");
    card.className = "note-card";
    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      openNote(note.id);
    });

    const meta = document.createElement("div");
    meta.className = "note-meta";
    const time = document.createElement("strong");
    time.textContent = timeLabel(note.createdAt);
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = categoryById(note.categoryId).name;
    const sendType = document.createElement("span");
    sendType.className = "send-type";
    sendType.textContent = note.text.trim() && note.images.length ? "同步：文字 + 图片" : note.images.length ? "同步：图片" : "同步：文字";
    meta.append(time, tag, sendType);

    const text = document.createElement("p");
    text.className = "note-text";
    text.textContent = note.text.trim() || "无文字内容";

    const thumbs = document.createElement("div");
    thumbs.className = "thumbs";
    for (const image of note.images.slice(0, 4)) {
      const img = document.createElement("img");
      img.src = image.src || imageUrl(image.filename);
      img.alt = image.name || "随记图片";
      thumbs.append(img);
    }
    if (note.images.length > 4) {
      const more = document.createElement("span");
      more.className = "more-images";
      more.textContent = `+${note.images.length - 4}`;
      thumbs.append(more);
    }

    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.append(
      actionButton("复制", () => copyNoteText(note)),
      actionButton("同步到互传", () => shareNote(note)),
      actionButton("编辑", () => editNote(note)),
      actionButton("删除", () => deleteNote(note.id), "danger")
    );

    card.append(meta, text);
    if (note.images.length) card.append(thumbs);
    card.append(actions);
    notesList.append(card);
  }
}

function actionButton(label, onClick, className = "ghost") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function renderCategoriesDialog() {
  categoryList.innerHTML = "";
  for (const category of page.categories) {
    const row = document.createElement("div");
    row.className = "category-row";
    const name = document.createElement("span");
    name.textContent = category.name;
    const actions = document.createElement("div");
    if (!category.builtIn) {
      actions.append(
        actionButton("编辑", () => renameCategory(category.id)),
        actionButton("删除", () => removeCategory(category.id), "danger")
      );
    } else {
      const fixed = document.createElement("em");
      fixed.textContent = "默认";
      actions.append(fixed);
    }
    row.append(name, actions);
    categoryList.append(row);
  }
}

function renderAll() {
  renderDate();
  renderCategoryOptions();
  noteText.value = page.draft.text;
  noteCategory.value = page.draft.categoryId;
  autoResizeTextarea();
  renderDraftImages();
  renderNotes();
}

function createdAtForSelectedDate(existingCreatedAt) {
  if (existingCreatedAt && sameDate(existingCreatedAt, selectedDate)) return existingCreatedAt;
  const now = new Date();
  const [year, month, day] = selectedDate.split("-").map(Number);
  return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString();
}

function saveCurrentNote() {
  syncDraftFromInputs();
  const text = page.draft.text.trim();
  const images = page.draft.images;
  if (!text && !images.length) {
    showSaved("还没有内容");
    return;
  }

  if (editingId) {
    page.notes = page.notes.map((note) => note.id === editingId ? {
      ...note,
      text: page.draft.text,
      categoryId: page.draft.categoryId,
      images: [...images],
      updatedAt: new Date().toISOString()
    } : note);
  } else {
    page.notes.push({
      id: createId(),
      text: page.draft.text,
      categoryId: page.draft.categoryId,
      images: [...images],
      createdAt: createdAtForSelectedDate(),
      updatedAt: new Date().toISOString()
    });
  }

  editingId = null;
  page.draft = { text: "", categoryId: page.draft.categoryId, images: [] };
  renderAll();
  scheduleSave("已保存");
}

function clearCurrentDraft() {
  if (!page.draft.text.trim() && !page.draft.images.length) return;
  if (!confirm("清空当前草稿？")) return;
  editingId = null;
  page.draft = { text: "", categoryId: page.draft.categoryId, images: [] };
  renderAll();
  scheduleSave();
}

function editNote(note) {
  editingId = note.id;
  selectedDate = dateKey(new Date(note.createdAt));
  page.draft = {
    text: note.text,
    categoryId: note.categoryId,
    images: note.images.map((image) => ({ ...image }))
  };
  renderAll();
  noteText.focus();
}

function deleteNote(id) {
  if (!confirm("删除这条随记？")) return;
  page.notes = page.notes.filter((note) => note.id !== id);
  if (editingId === id) editingId = null;
  renderNotes();
  scheduleSave();
}

async function copyNoteText(note) {
  const text = noteShareText(note);
  try {
    await navigator.clipboard.writeText(text);
    showSaved("已复制");
  } catch {
    showSaved("复制失败");
  }
}

async function shareNote(note) {
  const text = noteShareText(note);
  try {
    await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "text", text })
    });
    showSaved(note.images.length ? "已同步到互传：文字 + 图片链接" : "已同步到互传");
  } catch {
    await copyNoteText(note);
  }
}

function openNote(id) {
  const note = page.notes.find((item) => item.id === id);
  if (!note) return;
  activeNoteId = id;
  dialogContent.innerHTML = "";

  const meta = document.createElement("div");
  meta.className = "note-meta";
  const time = document.createElement("strong");
  time.textContent = `${dateLabel(dateKey(new Date(note.createdAt)))} ${timeLabel(note.createdAt)}`;
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = categoryById(note.categoryId).name;
  meta.append(time, tag);

  const text = document.createElement("p");
  text.className = "dialog-text";
  text.textContent = note.text || "无文字内容";

  const images = document.createElement("div");
  images.className = "dialog-images";
  for (const image of note.images) {
    const img = document.createElement("img");
    img.src = image.src || imageUrl(image.filename);
    img.alt = image.name || "随记图片";
    images.append(img);
  }

  dialogContent.append(meta, text);
  if (note.images.length) dialogContent.append(images);
  noteDialog.showModal();
}

function activeNote() {
  return page.notes.find((note) => note.id === activeNoteId);
}

function renameCategory(id) {
  const category = categoryById(id);
  const name = prompt("分类名称", category.name)?.trim();
  if (!name) return;
  category.name = name.slice(0, 16);
  renderCategoryOptions();
  renderCategoriesDialog();
  renderNotes();
  scheduleSave();
}

function removeCategory(id) {
  const category = categoryById(id);
  if (!category || category.builtIn) return;
  if (!confirm(`删除分类「${category.name}」？该分类下的随记会移到“其他”。`)) return;
  page.categories = page.categories.filter((item) => item.id !== id);
  for (const note of page.notes) {
    if (note.categoryId === id) note.categoryId = "other";
  }
  if (page.draft.categoryId === id) page.draft.categoryId = "other";
  renderCategoryOptions();
  renderCategoriesDialog();
  renderNotes();
  scheduleSave();
}

async function init() {
  const serverPage = await loadNotesFromServer();
  const localPage = localStorage.getItem(storageKey) || localStorage.getItem(oldPageKey);
  let source = serverPage;
  if (!source && localPage) source = JSON.parse(localPage);
  if (!source) {
    const oldList = JSON.parse(localStorage.getItem(oldListKey) || "[]");
    if (Array.isArray(oldList) && oldList.length) {
      source = {
        notes: oldList.map((note) => ({
          id: createId(),
          text: note.text || "",
          categoryId: "other",
          images: (note.images || []).map((src) => ({ id: createId(), src })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }))
      };
    }
  }
  page = normalizePage(source);
  selectedDate = todayKey();
  booted = true;
  renderAll();
  resetWorkspaceScroll();
  scheduleSave();
}

noteText.addEventListener("input", () => {
  syncDraftFromInputs();
  autoResizeTextarea();
  scheduleSave();
});

noteCategory.addEventListener("change", () => {
  syncDraftFromInputs();
  scheduleSave();
});

imageInput.addEventListener("change", async () => {
  for (const file of imageInput.files) {
    try {
      const result = await uploadImageToServer(file);
      page.draft.images.push({ id: createId(), filename: result.filename, src: imageUrl(result.filename), name: file.name });
    } catch {
      page.draft.images.push({ id: createId(), src: await fileToDataUrl(file), name: file.name });
    }
  }
  imageInput.value = "";
  renderDraftImages();
  scheduleSave();
});

saveNote.addEventListener("click", saveCurrentNote);
clearDraft.addEventListener("click", clearCurrentDraft);
searchInput.addEventListener("input", renderNotes);
categoryFilter.addEventListener("change", renderNotes);

datePicker.addEventListener("change", () => {
  selectedDate = datePicker.value || todayKey();
  renderDate();
  renderNotes();
});

prevDay.addEventListener("click", () => {
  const date = dateFromKey(selectedDate);
  date.setDate(date.getDate() - 1);
  selectedDate = dateKey(date);
  renderDate();
  renderNotes();
});

nextDay.addEventListener("click", () => {
  const date = dateFromKey(selectedDate);
  date.setDate(date.getDate() + 1);
  selectedDate = dateKey(date);
  renderDate();
  renderNotes();
});

todayButton.addEventListener("click", () => {
  selectedDate = todayKey();
  renderDate();
  renderNotes();
});

manageCategories.addEventListener("click", () => {
  renderCategoriesDialog();
  categoryDialog.showModal();
});

$("closeCategoryDialog").addEventListener("click", () => categoryDialog.close());

addCategory.addEventListener("click", () => {
  const name = newCategoryName.value.trim();
  if (!name) return;
  const category = { id: `custom-${createId()}`, name: name.slice(0, 16), builtIn: false };
  page.categories.push(category);
  page.draft.categoryId = category.id;
  newCategoryName.value = "";
  renderCategoryOptions();
  renderCategoriesDialog();
  scheduleSave();
});

dialogCopyText.addEventListener("click", () => {
  const note = activeNote();
  if (note) copyNoteText(note);
});

dialogShare.addEventListener("click", () => {
  const note = activeNote();
  if (note) shareNote(note);
});

dialogClose.addEventListener("click", () => noteDialog.close());
noteDialog.addEventListener("click", (event) => {
  if (event.target === noteDialog) noteDialog.close();
});
categoryDialog.addEventListener("click", (event) => {
  if (event.target === categoryDialog) categoryDialog.close();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (noteDialog.open) noteDialog.close();
    if (categoryDialog.open) categoryDialog.close();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveCurrentNote();
  }
});

init();
