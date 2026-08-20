// ============================================================
// CONFIG
// ============================================================

// Base64("ILOVERAMEN")
const KEEP_PASSWORD_BASE64 = "SUxPVkVSQU1FTg==";
const KEEP_STORAGE_KEY = "obsidianLocalKeepNotes";
const AUTOSAVE_DELAY = 700;

// ============================================================
// DOM
// ============================================================

const markdownView = document.getElementById("markdownView");
const keepView = document.getElementById("keepView");
const markdownActions = document.getElementById("markdownActions");
const keepActions = document.getElementById("keepActions");
const tabs = document.querySelectorAll(".tab");

const documentEl = document.getElementById("document");
const fileName = document.getElementById("fileName");
const saveStatus = document.getElementById("saveStatus");
const openButton = document.getElementById("openButton");
const saveButton = document.getElementById("saveButton");
const newBlockButton = document.getElementById("newBlockButton");
const bottomAdd = document.getElementById("bottomAdd");
const unsupported = document.getElementById("unsupported");

const keepLocked = document.getElementById("keepLocked");
const keepUnlocked = document.getElementById("keepUnlocked");
const unlockForm = document.getElementById("unlockForm");
const keepPassword = document.getElementById("keepPassword");
const unlockMessage = document.getElementById("unlockMessage");
const keepStatus = document.getElementById("keepStatus");
const lockKeepButton = document.getElementById("lockKeepButton");
const copyBackupButton = document.getElementById("copyBackupButton");

const keepTitleInput = document.getElementById("keepTitleInput");
const keepBodyInput = document.getElementById("keepBodyInput");
const keepEditState = document.getElementById("keepEditState");
const saveKeepNoteButton = document.getElementById("saveKeepNoteButton");
const cancelKeepEditButton = document.getElementById("cancelKeepEditButton");
const keepGrid = document.getElementById("keepGrid");

const selectionToolbar = document.getElementById("selectionToolbar");
const selectionRedButton = document.getElementById("selectionRedButton");
const selectionDeleteButton = document.getElementById("selectionDeleteButton");
const selectionCount = document.getElementById("selectionCount");

// ============================================================
// STATE
// ============================================================

let fileHandle = null;
let blocks = [];
let activeIndex = null;
let selectedIndex = 0;

let multiSelected = new Set();
let dragSelecting = false;
let dragAnchorIndex = null;
let dragLastIndex = null;
let justDraggedSelection = false;

let autosaveTimer = null;
let saveInProgress = false;
let saveQueued = false;

let keepUnlockedState = false;
let keepNotes = [];
let editingKeepId = null;

const starterMarkdown = `# Obsidian Local

Keyboard-first Markdown editing:

- **Tab** → move between cells
- **i** → edit selected cell
- **b** → create a new cell
- **Esc** → render active cell
- Type **/check** and press Enter → generate 10 checklist cells

## Checklist behavior

Each checklist item is its own cell.

- [ ] Buy coffee

Press Enter while editing that checklist cell and a new checklist cell appears directly below it.
`;

marked.setOptions({
  gfm: true,
  breaks: false
});

// ============================================================
// VIEW SWITCHING
// ============================================================

function isMarkdownVisible() {
  return !markdownView.classList.contains("hidden");
}

function isKeepVisible() {
  return !keepView.classList.contains("hidden");
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.view;
    const isMarkdown = target === "markdown";

    tabs.forEach(other => {
      other.classList.toggle("active", other === tab);
    });

    markdownView.classList.toggle("hidden", !isMarkdown);
    keepView.classList.toggle("hidden", isMarkdown);
    markdownActions.classList.toggle("hidden", !isMarkdown);
    keepActions.classList.toggle("hidden", isMarkdown);

    if (isMarkdown) {
      ensureValidSelection();
      paintSelection();
    }
  });
});

// ============================================================
// MARKDOWN CELLS
// ============================================================

function setSaveStatus(text, state = "") {
  saveStatus.textContent = text;
  saveStatus.className = `status ${state}`;
}

// IMPORTANT:
// marked.lexer() normally groups consecutive Markdown list items into one token.
// We split task-list tokens further so EVERY checklist item becomes its own app cell.
function parseBlocks(markdown) {
  const tokens = marked.lexer(markdown);
  const parsed = [];

  for (const token of tokens) {
    if (token.type === "space") continue;

    const raw = (token.raw || "").trimEnd();
    if (!raw.trim()) continue;

    if (token.type === "list") {
      const lines = raw.split("\n");
      const taskLines = lines.filter(line =>
        /^\s*-\s+\[[ xX]\]\s*/.test(line)
      );

      // If the whole token is a flat checklist, split every item into its own cell.
      if (
        taskLines.length > 0 &&
        lines.filter(line => line.trim()).every(line =>
          /^\s*-\s+\[[ xX]\]\s*/.test(line)
        )
      ) {
        for (const line of lines) {
          if (line.trim()) {
            parsed.push({ source: line.trimEnd() });
          }
        }
        continue;
      }
    }

    parsed.push({ source: raw });
  }

  return parsed.length ? parsed : [{ source: "" }];
}

function rebuildMarkdown() {
  return blocks
    .map(block => block.source.trimEnd())
    .join("\n\n")
    .trimEnd() + "\n";
}


function unwrapRedSource(source) {
  const trimmed = source.trim();

  const match = trimmed.match(
    /^<span class="red-highlight">([\s\S]*)<\/span>$/
  );

  return match ? match[1] : source;
}

function parseChecklistCell(source) {
  const sourceForCheck = unwrapRedSource(source);
  const match = sourceForCheck.match(/^(\s*)-\s+\[([ xX])\]\s*(.*)$/s);

  if (!match) return null;

  return {
    indentation: match[1],
    checked: match[2].toLowerCase() === "x",
    text: match[3] || ""
  };
}

function isChecklistCell(source) {
  return parseChecklistCell(source) !== null;
}

function renderChecklistCell(cell, block, blockIndex) {
  const parsed = parseChecklistCell(block.source);
  if (!parsed) return;

  cell.classList.add("checklist-cell");

  const row = document.createElement("div");
  row.className = `check-row ${parsed.checked ? "done" : ""}`;

  const marker = document.createElement("span");
  marker.className = "check-marker";
  marker.textContent = parsed.checked ? "- [x]" : "- [ ]";

  const text = document.createElement("div");
  text.className = "check-block-text";

  if (parsed.text.trim()) {
    text.innerHTML = marked.parseInline(parsed.text);
  } else {
    text.innerHTML = '<span class="check-empty">Checklist item</span>';
  }

  const toggle = document.createElement("button");
  toggle.className = `check-toggle ${parsed.checked ? "checked" : ""}`;
  toggle.type = "button";
  toggle.setAttribute(
    "aria-label",
    parsed.checked ? "Mark incomplete" : "Mark complete"
  );
  toggle.title = parsed.checked ? "Mark incomplete" : "Mark complete";
  toggle.textContent = parsed.checked ? "✓" : "";

  toggle.addEventListener("click", event => {
    event.stopPropagation();
    toggleChecklistItem(blockIndex);
  });

  row.appendChild(marker);
  row.appendChild(text);
  row.appendChild(toggle);
  cell.appendChild(row);
}

function toggleChecklistItem(blockIndex) {
  const parsed = parseChecklistCell(blocks[blockIndex].source);
  if (!parsed) return;

  blocks[blockIndex].source =
    `${parsed.indentation}- [${parsed.checked ? " " : "x"}] ${parsed.text}`;

  selectedIndex = blockIndex;
  renderAllBlocks();
  queueAutosave();
}


function isCellRed(block) {
  return /^<span class="red-highlight">[\s\S]*<\/span>$/.test(block.source.trim());
}

function toggleCellRed(index) {
  const source = blocks[index].source.trim();

  if (isCellRed(blocks[index])) {
    blocks[index].source = source
      .replace(/^<span class="red-highlight">/, "")
      .replace(/<\/span>$/, "");
  } else {
    blocks[index].source = `<span class="red-highlight">${source}</span>`;
  }

  selectedIndex = index;
  renderAllBlocks();
  paintSelection();
  queueAutosave();
}

function deleteCells(indices) {
  const unique = [...new Set(indices)]
    .filter(index => index >= 0 && index < blocks.length)
    .sort((a, b) => b - a);

  if (!unique.length) return;

  for (const index of unique) {
    blocks.splice(index, 1);
  }

  if (!blocks.length) {
    blocks = [{ source: "" }];
  }

  activeIndex = null;
  multiSelected.clear();

  selectedIndex = Math.min(
    unique[unique.length - 1],
    blocks.length - 1
  );

  renderAllBlocks();
  queueAutosave();
}

function setMultiSelected(index, force = null) {
  if (force === true) {
    multiSelected.add(index);
  } else if (force === false) {
    multiSelected.delete(index);
  } else if (multiSelected.has(index)) {
    multiSelected.delete(index);
  } else {
    multiSelected.add(index);
  }

  paintSelection();
}

function clearMultiSelection() {
  multiSelected.clear();
  paintSelection();
}

function applyDragSelection(anchorIndex, currentIndex) {
  multiSelected.clear();

  const start = Math.min(anchorIndex, currentIndex);
  const end = Math.max(anchorIndex, currentIndex);

  for (let i = start; i <= end; i++) {
    multiSelected.add(i);
  }

  paintSelection();
}

function makeCellToolbar(index) {
  const tools = document.createElement("div");
  tools.className = "cell-tools";

  const select = document.createElement("button");
  select.className = `cell-tool select-tool ${multiSelected.has(index) ? "active" : ""}`;
  select.type = "button";
  select.title = "Select cell";
  select.setAttribute("aria-label", "Select cell");
  select.textContent = "□";

  select.addEventListener("click", event => {
    event.stopPropagation();
    setMultiSelected(index);
  });

  tools.appendChild(select);
  return tools;
}

function renderAllBlocks() {
  documentEl.innerHTML = "";

  blocks.forEach((block, index) => {
    const cell = document.createElement("section");
    cell.className = "md-cell reading";
    cell.dataset.index = index;
    cell.tabIndex = -1;

    cell.appendChild(makeCellToolbar(index));

    const content = document.createElement("div");
    content.className = "cell-content";

    if (!block.source.trim()) {
      const empty = document.createElement("div");
      empty.className = "empty-block";
      empty.textContent = "Click to write…";
      content.appendChild(empty);
    } else if (isChecklistCell(block.source)) {
      renderChecklistCell(content, block, index);
    } else {
      content.innerHTML = marked.parse(unwrapRedSource(block.source));
    }

    if (isCellRed(block)) {
      content.classList.add("red-highlight");
    }

    cell.appendChild(content);

    cell.addEventListener("click", event => {
      const link = event.target.closest("a");
      const checklistButton = event.target.closest(".check-toggle");
      const toolButton = event.target.closest(".cell-tool");

      if (checklistButton || toolButton) return;

      if (justDraggedSelection) {
        justDraggedSelection = false;
        return;
      }

      if (link && !event.altKey) {
        event.stopPropagation();
        return;
      }

      if (multiSelected.size > 0) {
        clearMultiSelection();
      }

      selectedIndex = index;
      paintSelection();
      enterEditMode(index);
    });

    cell.addEventListener("mousedown", event => {
      if (event.button !== 0) return;
      if (event.target.closest(".cell-tool, .check-toggle, a, textarea, input, button")) return;

      dragSelecting = true;
      dragAnchorIndex = index;
      dragLastIndex = index;
      justDraggedSelection = false;

      document.body.classList.add("cell-drag-selecting");

      multiSelected.clear();
      multiSelected.add(index);
      paintSelection();

      event.preventDefault();
    });

    cell.addEventListener("mouseenter", () => {
      if (!dragSelecting || dragAnchorIndex === null) return;
      if (dragLastIndex === index) return;

      dragLastIndex = index;
      justDraggedSelection = true;
      applyDragSelection(dragAnchorIndex, index);
    });

    documentEl.appendChild(cell);
  });

  ensureValidSelection();
  paintSelection();
}

function ensureValidSelection() {
  if (!blocks.length) {
    selectedIndex = 0;
    return;
  }

  selectedIndex = Math.max(
    0,
    Math.min(selectedIndex, blocks.length - 1)
  );
}

function paintSelection() {
  documentEl.querySelectorAll(".md-cell").forEach((cell, index) => {
    cell.classList.toggle(
      "keyboard-selected",
      activeIndex === null &&
      index === selectedIndex &&
      !multiSelected.has(index)
    );

    cell.classList.toggle(
      "multi-selected",
      multiSelected.has(index)
    );
  });

  const count = multiSelected.size;

  selectionToolbar.classList.toggle("hidden", count === 0);
  selectionCount.textContent = `${count} selected`;
}

function moveSelection(direction) {
  if (!blocks.length) return;

  multiSelected.clear();

  if (activeIndex !== null) {
    commitActiveCell();
  }

  selectedIndex =
    (selectedIndex + direction + blocks.length) % blocks.length;

  paintSelection();

  const cell = documentEl.querySelector(
    `[data-index="${selectedIndex}"]`
  );

  cell?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(textarea.scrollHeight, 54)}px`;
}

function replaceCurrentCellWithChecklistTemplate(index) {
  const checklistCells = Array.from(
    { length: 10 },
    () => ({ source: "- [ ] " })
  );

  blocks.splice(index, 1, ...checklistCells);

  activeIndex = null;
  selectedIndex = index;

  renderAllBlocks();
  queueAutosave();

  requestAnimationFrame(() => {
    documentEl
      .querySelector(`[data-index="${selectedIndex}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function createChecklistCellAfter(index) {
  // Save current text first.
  const textarea = documentEl.querySelector(
    `[data-index="${index}"] .cell-editor`
  );

  if (textarea) {
    const wasRed = isCellRed(blocks[index]);
    const value = textarea.value.trimEnd();

    blocks[index].source = wasRed
      ? `<span class="red-highlight">${value}</span>`
      : value;
  }

  // New checklist cell immediately after current cell.
  blocks.splice(index + 1, 0, { source: "- [ ] " });

  activeIndex = null;
  selectedIndex = index + 1;

  renderAllBlocks();

  // Immediately enter the new checklist cell.
  enterEditMode(index + 1);
  queueAutosave();

  requestAnimationFrame(() => {
    documentEl
      .querySelector(`[data-index="${index + 1}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function enterEditMode(index) {
  if (activeIndex === index) return;

  multiSelected.clear();

  if (activeIndex !== null) {
    commitActiveCell();
  }

  selectedIndex = index;
  activeIndex = index;

  const cell = documentEl.querySelector(`[data-index="${index}"]`);
  if (!cell) return;

  cell.className = "md-cell editing";
  cell.innerHTML = "";

  const textarea = document.createElement("textarea");
  textarea.className = "cell-editor";
  textarea.value = unwrapRedSource(blocks[index].source);
  textarea.spellcheck = true;

  const hint = document.createElement("div");
  hint.className = "cell-hint";
  hint.textContent = "/check + Enter → 10 checklist cells · Esc → render";

  cell.appendChild(textarea);
  cell.appendChild(hint);

  autoResize(textarea);
  textarea.focus();

  const end = textarea.value.length;
  textarea.setSelectionRange(end, end);

  textarea.addEventListener("input", () => {
    blocks[index].source = textarea.value;
    autoResize(textarea);
    queueAutosave();
  });

  textarea.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      const current = textarea.value.trim();

      // /check → replace this one cell with TEN checklist cells.
      if (current === "/check") {
        event.preventDefault();
        replaceCurrentCellWithChecklistTemplate(index);
        return;
      }

      // If THIS cell is a checklist item, Enter always creates a NEW checklist cell.
      if (isChecklistCell(textarea.value.trimEnd())) {
        event.preventDefault();
        createChecklistCellAfter(index);
        return;
      }
    }

    if (event.key === "Escape") {
      event.preventDefault();
      commitActiveCell();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();

      const direction = event.shiftKey ? -1 : 1;

      commitActiveCell();
      moveSelection(direction);
      return;
    }
  });
}

function commitActiveCell() {
  if (activeIndex === null) return;

  const index = activeIndex;

  const textarea = documentEl.querySelector(
    `[data-index="${index}"] .cell-editor`
  );

  if (textarea) {
    const wasRed = isCellRed(blocks[index]);
    const value = textarea.value;

    blocks[index].source = wasRed
      ? `<span class="red-highlight">${value}</span>`
      : value;
  }

  const raw = unwrapRedSource(blocks[index].source).trim();

  activeIndex = null;

  // Empty edited cell disappears automatically on commit.
  if (!raw) {
    blocks.splice(index, 1);

    if (!blocks.length) {
      blocks = [{ source: "" }];
    }

    selectedIndex = Math.min(index, blocks.length - 1);

    renderAllBlocks();
    queueAutosave();
    return;
  }

  // Reparse to preserve general Markdown semantics,
  // while parseBlocks() keeps one checklist item per cell.
  blocks = parseBlocks(rebuildMarkdown());
  selectedIndex = Math.min(index, blocks.length - 1);

  renderAllBlocks();
  queueAutosave();
}

function appendBlock() {
  if (activeIndex !== null) {
    commitActiveCell();
  }

  const insertAt = Math.min(selectedIndex + 1, blocks.length);

  blocks.splice(insertAt, 0, { source: "" });

  selectedIndex = insertAt;

  renderAllBlocks();
  enterEditMode(insertAt);

  requestAnimationFrame(() => {
    documentEl
      .querySelector(`[data-index="${insertAt}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

// ============================================================
// LOCAL .MD FILE OPEN + AUTOSAVE
// ============================================================

async function openMarkdownFile() {
  if (!("showOpenFilePicker" in window)) {
    unsupported.classList.remove("hidden");
    return;
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: "Markdown files",
          accept: {
            "text/markdown": [".md", ".markdown"],
            "text/plain": [".md", ".markdown"]
          }
        }
      ]
    });

    const file = await handle.getFile();
    const text = await file.text();

    fileHandle = handle;
    blocks = parseBlocks(text);
    activeIndex = null;
    selectedIndex = 0;

    fileName.textContent = file.name;
    document.title = `${file.name} — Obsidian Local`;

    saveButton.disabled = false;

    renderAllBlocks();
    setSaveStatus("Saved ✓", "saved");
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error(error);
      setSaveStatus("Open failed", "error");
    }
  }
}

async function saveMarkdownFile() {
  if (!fileHandle) {
    setSaveStatus("Not saved");
    return;
  }

  if (activeIndex !== null) {
    const textarea = documentEl.querySelector(
      `[data-index="${activeIndex}"] .cell-editor`
    );

    if (textarea) {
      const wasRed = isCellRed(blocks[activeIndex]);
      const value = textarea.value;

      blocks[activeIndex].source = wasRed
        ? `<span class="red-highlight">${value}</span>`
        : value;
    }
  }

  if (saveInProgress) {
    saveQueued = true;
    return;
  }

  saveInProgress = true;
  setSaveStatus("Saving…", "saving");

  try {
    const writable = await fileHandle.createWritable();

    await writable.write(rebuildMarkdown());
    await writable.close();

    setSaveStatus("Saved ✓", "saved");
  } catch (error) {
    console.error(error);
    setSaveStatus("Save failed", "error");
  } finally {
    saveInProgress = false;

    if (saveQueued) {
      saveQueued = false;
      await saveMarkdownFile();
    }
  }
}

function queueAutosave() {
  if (!fileHandle) {
    setSaveStatus("Not saved");
    return;
  }

  setSaveStatus("Editing…", "saving");

  clearTimeout(autosaveTimer);

  autosaveTimer = setTimeout(() => {
    saveMarkdownFile();
  }, AUTOSAVE_DELAY);
}

openButton.addEventListener("click", openMarkdownFile);
saveButton.addEventListener("click", saveMarkdownFile);
newBlockButton.addEventListener("click", appendBlock);
bottomAdd.addEventListener("click", appendBlock);

// ============================================================
// KEEP: UTF-8 SAFE BASE64
// ============================================================

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";

  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function base64ToUtf8(base64) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(
    binary,
    char => char.charCodeAt(0)
  );

  return new TextDecoder().decode(bytes);
}

function encodeKeepNotes(notes) {
  return utf8ToBase64(JSON.stringify(notes, null, 2));
}

function decodeKeepNotes(encoded) {
  if (!encoded) return [];

  try {
    const parsed = JSON.parse(base64ToUtf8(encoded));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Could not decode Keep notes:", error);
    return [];
  }
}

function loadKeepNotesFromLocalStorage() {
  return decodeKeepNotes(
    localStorage.getItem(KEEP_STORAGE_KEY)
  );
}

function saveKeepNotesToLocalStorage() {
  localStorage.setItem(
    KEEP_STORAGE_KEY,
    encodeKeepNotes(keepNotes)
  );

  keepStatus.textContent = "Saved locally ✓";
  keepStatus.className = "status saved";
}

// ============================================================
// KEEP LOCK / UNLOCK
// ============================================================

function passwordMatches(input) {
  try {
    return btoa(input) === KEEP_PASSWORD_BASE64;
  } catch {
    return false;
  }
}

function unlockKeep() {
  keepUnlockedState = true;
  keepNotes = loadKeepNotesFromLocalStorage();

  keepLocked.classList.add("hidden");
  keepUnlocked.classList.remove("hidden");

  keepStatus.textContent = "Unlocked";
  keepStatus.className = "status saved";

  lockKeepButton.disabled = false;
  copyBackupButton.disabled = false;

  clearKeepComposer();
  renderKeepNotes();
}

function lockKeep() {
  keepUnlockedState = false;
  keepNotes = [];
  editingKeepId = null;

  keepPassword.value = "";
  unlockMessage.textContent = "";

  keepUnlocked.classList.add("hidden");
  keepLocked.classList.remove("hidden");

  keepStatus.textContent = "Locked";
  keepStatus.className = "status";

  lockKeepButton.disabled = true;
  copyBackupButton.disabled = true;
}

unlockForm.addEventListener("submit", event => {
  event.preventDefault();

  if (!passwordMatches(keepPassword.value)) {
    unlockMessage.textContent = "Incorrect password.";
    keepPassword.select();
    return;
  }

  unlockMessage.textContent = "";
  keepPassword.value = "";
  unlockKeep();
});

lockKeepButton.addEventListener("click", lockKeep);

// ============================================================
// KEEP CRUD
// ============================================================

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clearKeepComposer() {
  editingKeepId = null;
  keepTitleInput.value = "";
  keepBodyInput.value = "";
  keepEditState.textContent = "New note";
  cancelKeepEditButton.classList.add("hidden");
  saveKeepNoteButton.textContent = "Save note";
}

function focusNewKeepNote() {
  if (!keepUnlockedState) return;

  clearKeepComposer();
  keepTitleInput.focus();
}

function renderKeepNotes() {
  keepGrid.innerHTML = "";

  if (!keepNotes.length) {
    const empty = document.createElement("div");
    empty.className = "empty-keep";

    empty.innerHTML = `
      <div style="font-size:42px;margin-bottom:12px">💡</div>
      <strong>No private notes yet</strong>
      <p>Press <b>b</b> to start a new note.</p>
    `;

    keepGrid.appendChild(empty);
    return;
  }

  const sorted = [...keepNotes].sort(
    (a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")
  );

  sorted.forEach(note => {
    const card = document.createElement("article");
    card.className = "keep-note";

    if (note.title) {
      const title = document.createElement("h3");
      title.textContent = note.title;
      card.appendChild(title);
    }

    const body = document.createElement("p");
    body.textContent = note.body || "";
    card.appendChild(body);

    const footer = document.createElement("div");
    footer.className = "keep-note-footer";

    const date = document.createElement("span");
    date.className = "keep-note-date";

    if (note.updatedAt) {
      date.textContent =
        new Date(note.updatedAt).toLocaleString();
    }

    const deleteButton = document.createElement("button");
    deleteButton.className = "keep-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", event => {
      event.stopPropagation();

      keepNotes = keepNotes.filter(
        item => item.id !== note.id
      );

      if (editingKeepId === note.id) {
        clearKeepComposer();
      }

      saveKeepNotesToLocalStorage();
      renderKeepNotes();
    });

    footer.appendChild(date);
    footer.appendChild(deleteButton);
    card.appendChild(footer);

    card.addEventListener("click", () => {
      editingKeepId = note.id;

      keepTitleInput.value = note.title || "";
      keepBodyInput.value = note.body || "";

      keepEditState.textContent = "Editing note";
      cancelKeepEditButton.classList.remove("hidden");
      saveKeepNoteButton.textContent = "Update note";

      keepTitleInput.focus();
    });

    keepGrid.appendChild(card);
  });
}

saveKeepNoteButton.addEventListener("click", () => {
  if (!keepUnlockedState) return;

  const title = keepTitleInput.value.trim();
  const body = keepBodyInput.value.trim();

  if (!title && !body) return;

  const now = new Date().toISOString();

  if (editingKeepId) {
    const note = keepNotes.find(
      item => item.id === editingKeepId
    );

    if (note) {
      note.title = title;
      note.body = body;
      note.updatedAt = now;
    }
  } else {
    keepNotes.push({
      id: makeId(),
      title,
      body,
      createdAt: now,
      updatedAt: now
    });
  }

  saveKeepNotesToLocalStorage();
  clearKeepComposer();
  renderKeepNotes();
});

cancelKeepEditButton.addEventListener(
  "click",
  clearKeepComposer
);

keepBodyInput.addEventListener("keydown", event => {
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key === "Enter"
  ) {
    event.preventDefault();
    saveKeepNoteButton.click();
  }
});

// ============================================================
// KEEP RAW BASE64 BACKUP
// ============================================================

copyBackupButton.addEventListener("click", async () => {
  const encoded =
    localStorage.getItem(KEEP_STORAGE_KEY) || "";

  if (!encoded) {
    keepStatus.textContent = "No notes yet";
    keepStatus.className = "status";
    return;
  }

  try {
    await navigator.clipboard.writeText(encoded);

    keepStatus.textContent = "Base64 copied ✓";
    keepStatus.className = "status saved";
  } catch {
    window.prompt(
      "Copy this Base64 backup:",
      encoded
    );
  }
});



document.addEventListener("mousedown", event => {
  if (activeIndex === null) return;

  const activeCell = documentEl.querySelector(
    `[data-index="${activeIndex}"]`
  );

  if (!activeCell) return;

  const clickedInsideActiveCell = activeCell.contains(event.target);
  const clickedToolbar =
    event.target.closest("#selectionToolbar") ||
    event.target.closest(".cell-tools");

  if (!clickedInsideActiveCell && !clickedToolbar) {
    commitActiveCell();
  }
}, true);

document.addEventListener("mouseup", () => {
  if (!dragSelecting) return;

  dragSelecting = false;
  dragAnchorIndex = null;
  dragLastIndex = null;

  document.body.classList.remove("cell-drag-selecting");
});


selectionDeleteButton.addEventListener("click", event => {
  event.stopPropagation();

  if (multiSelected.size > 0) {
    deleteCells([...multiSelected]);
  }
});

selectionRedButton.addEventListener("click", event => {
  event.stopPropagation();

  if (multiSelected.size === 0) return;

  const indices = [...multiSelected].sort((a, b) => a - b);

  // If ALL selected cells are already red, this removes red from all.
  // Otherwise it applies red to all selected cells.
  const allRed = indices.every(index => isCellRed(blocks[index]));

  indices.forEach(index => {
    const source = unwrapRedSource(blocks[index].source).trim();

    blocks[index].source = allRed
      ? source
      : `<span class="red-highlight">${source}</span>`;
  });

  renderAllBlocks();

  // restore the same selected range after rerender
  multiSelected = new Set(indices);
  paintSelection();
  queueAutosave();
});

// ============================================================
// GLOBAL KEYBOARD SHORTCUTS
// ============================================================

function isTypingTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

document.addEventListener("keydown", event => {
  const typing = isTypingTarget(event.target);

  if (
    isMarkdownVisible() &&
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "s"
  ) {
    event.preventDefault();
    saveMarkdownFile();
    return;
  }

  if (
    isMarkdownVisible() &&
    activeIndex === null &&
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "o"
  ) {
    event.preventDefault();
    openMarkdownFile();
    return;
  }

  if (
    isMarkdownVisible() &&
    !typing &&
    (event.key === "Delete" || event.key === "Backspace") &&
    multiSelected.size > 0
  ) {
    event.preventDefault();
    deleteCells([...multiSelected]);
    return;
  }

  if (typing) return;

  if (isMarkdownVisible()) {
    if (event.key === "Escape" && multiSelected.size > 0) {
      event.preventDefault();
      clearMultiSelection();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      moveSelection(event.shiftKey ? -1 : 1);
      return;
    }

    if (event.key.toLowerCase() === "b") {
      event.preventDefault();
      appendBlock();
      return;
    }

    if (event.key.toLowerCase() === "i") {
      event.preventDefault();
      enterEditMode(selectedIndex);
      return;
    }
  }

  if (
    isKeepVisible() &&
    keepUnlockedState &&
    event.key.toLowerCase() === "b"
  ) {
    event.preventDefault();
    focusNewKeepNote();
  }
});

// ============================================================
// INIT
// ============================================================

if (!("showOpenFilePicker" in window)) {
  unsupported.classList.remove("hidden");
}

blocks = parseBlocks(starterMarkdown);
renderAllBlocks();
lockKeep();
