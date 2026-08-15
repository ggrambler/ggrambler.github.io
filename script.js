// ============================================================
// CONFIG
// ============================================================

// Base64("ILOVERAMEN")
const KEEP_PASSWORD_BASE64 = "SUxPVkVSQU1FTg==";

// Everything in Keep is stored ONLY in this browser key.
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

// ============================================================
// APP STATE
// ============================================================

let fileHandle = null;
let blocks = [];
let activeIndex = null;

let autosaveTimer = null;
let saveInProgress = false;
let saveQueued = false;

let keepUnlockedState = false;
let keepNotes = [];
let editingKeepId = null;

const starterMarkdown = `# Obsidian Local

Click any block to edit it. Click away to return to reading mode.

## Checklist mode

Start a checklist:

- [ ] Buy coffee
- [ ] Learn JavaScript

When your cursor is on a checklist line, pressing **Enter** automatically creates another \`- [ ]\` item.

> Your Markdown file stays on your computer and autosaves directly to that file.
`;

marked.setOptions({
  gfm: true,
  breaks: false
});

// ============================================================
// VIEW SWITCHING
// ============================================================

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
  });
});

// ============================================================
// MARKDOWN CELLS
// ============================================================

function setSaveStatus(text, state = "") {
  saveStatus.textContent = text;
  saveStatus.className = `status ${state}`;
}

function parseBlocks(markdown) {
  const tokens = marked.lexer(markdown);

  const parsed = tokens
    .filter(token => token.type !== "space")
    .map(token => ({
      source: (token.raw || "").trimEnd()
    }))
    .filter(block => block.source.trim().length > 0);

  return parsed.length ? parsed : [{ source: "" }];
}

function rebuildMarkdown() {
  return (
    blocks
      .map(block => block.source.trimEnd())
      .join("\n\n")
      .trimEnd() + "\n"
  );
}

function renderAllBlocks() {
  documentEl.innerHTML = "";

  blocks.forEach((block, index) => {
    const cell = document.createElement("section");
    cell.className = "md-cell reading";
    cell.dataset.index = index;

    if (block.source.trim()) {
      cell.innerHTML = marked.parse(block.source);
    } else {
      const empty = document.createElement("div");
      empty.className = "empty-block";
      empty.textContent = "Click to write…";
      cell.appendChild(empty);
    }

    cell.addEventListener("click", event => {
      const link = event.target.closest("a");

      // Normal click follows rendered links.
      // Alt+click edits the cell containing a link.
      if (link && !event.altKey) {
        event.stopPropagation();
        return;
      }

      enterEditMode(index);
    });

    documentEl.appendChild(cell);
  });
}

function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(textarea.scrollHeight, 54)}px`;
}

function getCurrentLine(textarea) {
  const cursor = textarea.selectionStart;
  const beforeCursor = textarea.value.slice(0, cursor);

  const lineStart = beforeCursor.lastIndexOf("\n") + 1;
  const currentLine = beforeCursor.slice(lineStart);

  return { cursor, lineStart, currentLine };
}

function handleChecklistEnter(event, textarea) {
  if (event.key !== "Enter") return false;

  const { currentLine } = getCurrentLine(textarea);

  // Examples matched:
  // - [ ] item
  // - [x] done
  //   - [ ] nested item
  const match = currentLine.match(/^(\s*)-\s+\[[ xX]\]\s*(.*)$/);

  if (!match) return false;

  event.preventDefault();

  const indentation = match[1];
  const content = match[2];

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  // If current checklist item is empty, Enter exits checklist mode.
  if (content.trim() === "") {
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);

    const lineStart = before.lastIndexOf("\n") + 1;

    textarea.value =
      before.slice(0, lineStart) +
      "\n" +
      after;

    textarea.selectionStart = textarea.selectionEnd = lineStart + 1;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    return true;
  }

  const insert = `\n${indentation}- [ ] `;

  textarea.setRangeText(insert, start, end, "end");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));

  return true;
}

function enterEditMode(index) {
  if (activeIndex === index) return;

  if (activeIndex !== null) {
    commitActiveCell();
  }

  activeIndex = index;

  const cell = documentEl.querySelector(`[data-index="${index}"]`);
  if (!cell) return;

  cell.className = "md-cell editing";
  cell.innerHTML = "";

  const textarea = document.createElement("textarea");
  textarea.className = "cell-editor";
  textarea.value = blocks[index].source;
  textarea.spellcheck = true;

  const hint = document.createElement("div");
  hint.className = "cell-hint";
  hint.textContent = "Checklist Enter → new task · Ctrl+Enter → render";

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
    if (handleChecklistEnter(event, textarea)) {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      commitActiveCell();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      commitActiveCell();
    }
  });

  textarea.addEventListener("blur", () => {
    setTimeout(() => {
      if (activeIndex === index && document.activeElement !== textarea) {
        commitActiveCell();
      }
    }, 0);
  });
}

function commitActiveCell() {
  if (activeIndex === null) return;

  const index = activeIndex;

  const textarea = documentEl.querySelector(
    `[data-index="${index}"] .cell-editor`
  );

  if (textarea) {
    blocks[index].source = textarea.value;
  }

  activeIndex = null;

  // Re-lex the entire document so new headings, lists, paragraphs,
  // code blocks, etc. automatically become their own cells.
  blocks = parseBlocks(rebuildMarkdown());

  renderAllBlocks();
  queueAutosave();
}

function appendBlock() {
  if (activeIndex !== null) {
    commitActiveCell();
  }

  blocks.push({ source: "" });
  renderAllBlocks();

  const index = blocks.length - 1;
  enterEditMode(index);

  requestAnimationFrame(() => {
    documentEl
      .querySelector(`[data-index="${index}"]`)
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
      blocks[activeIndex].source = textarea.value;
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

// btoa() by itself is unreliable for arbitrary Unicode.
// These helpers keep Hindi, emoji, symbols, etc. readable after decoding.

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
    const json = base64ToUtf8(encoded);
    const parsed = JSON.parse(json);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Could not decode Keep notes:", error);
    return [];
  }
}

function loadKeepNotesFromLocalStorage() {
  const encoded = localStorage.getItem(KEEP_STORAGE_KEY);
  return decodeKeepNotes(encoded);
}

function saveKeepNotesToLocalStorage() {
  const encoded = encodeKeepNotes(keepNotes);

  localStorage.setItem(KEEP_STORAGE_KEY, encoded);

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

  // Drop the readable data from our JS state.
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
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

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

function renderKeepNotes() {
  keepGrid.innerHTML = "";

  if (!keepNotes.length) {
    const empty = document.createElement("div");
    empty.className = "empty-keep";
    empty.innerHTML = `
      <div style="font-size:42px;margin-bottom:12px">💡</div>
      <strong>No private notes yet</strong>
      <p>Create one above. It will be Base64-encoded and stored only in localStorage.</p>
    `;

    keepGrid.appendChild(empty);
    return;
  }

  // Latest updated notes first.
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
      date.textContent = new Date(note.updatedAt).toLocaleString();
    }

    const deleteButton = document.createElement("button");
    deleteButton.className = "keep-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", event => {
      event.stopPropagation();

      keepNotes = keepNotes.filter(item => item.id !== note.id);

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
    const note = keepNotes.find(item => item.id === editingKeepId);

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

cancelKeepEditButton.addEventListener("click", clearKeepComposer);

// Ctrl+Enter saves a Keep note.
keepBodyInput.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    saveKeepNoteButton.click();
  }
});

// ============================================================
// KEEP RAW BASE64 BACKUP
// ============================================================

copyBackupButton.addEventListener("click", async () => {
  const encoded = localStorage.getItem(KEEP_STORAGE_KEY) || "";

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
    // Fallback for clipboard restrictions.
    window.prompt(
      "Copy this Base64 backup:",
      encoded
    );
  }
});

// ============================================================
// GLOBAL SHORTCUTS / INIT
// ============================================================

document.addEventListener("keydown", event => {
  const markdownVisible = !markdownView.classList.contains("hidden");

  if (
    markdownVisible &&
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "s"
  ) {
    event.preventDefault();
    saveMarkdownFile();
  }

  if (
    markdownVisible &&
    activeIndex === null &&
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "o"
  ) {
    event.preventDefault();
    openMarkdownFile();
  }
});

if (!("showOpenFilePicker" in window)) {
  unsupported.classList.remove("hidden");
}

blocks = parseBlocks(starterMarkdown);
renderAllBlocks();
lockKeep();
