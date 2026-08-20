# Obsidian Local — Strict Render/Edit Edition

## Cell state model

A Markdown cell has exactly two content states:

```text
Render mode
Edit mode
```

Default is **Render mode**.

There is no separate "selected view". Selection is only a visual outline overlay on rendered cells.

## Click outside

When a cell is being edited:

```text
click anywhere outside that cell
→ commit its Markdown
→ return it to Render mode
```

If the edited cell is empty:

```text
click outside
→ cell is deleted automatically
```

`Esc` does the same commit/render behavior.

## Selection controls

Every cell now has only ONE per-cell button:

```text
[□]
```

That button selects/unselects the cell.

You can also drag across cells to multi-select a contiguous range.

## Floating selection toolbar

Whenever one or more cells are selected, a floating toolbar appears on the LEFT side:

```text
[A]
[🗑]
```

- `A` → toggle red highlight for all selected cells
- `🗑` → delete all selected cells

Pressing `Delete` / `Backspace` still deletes the current selected set.

## Existing shortcuts

### Obsidian

- `b` → new cell
- `i` → edit selected cell
- `Tab` → next cell
- `Shift + Tab` → previous cell
- `Esc` → render active cell / clear multi-selection
- `Delete` / `Backspace` → delete selected cells
- `/check` + Enter → 10 separate checklist cells
- Enter inside checklist cell → new checklist cell below
- `Ctrl/Cmd + S` → save
- `Ctrl/Cmd + O` → open file

### Keep

- `b` → new Keep note
- `Ctrl/Cmd + Enter` → save Keep note

Keep remains localStorage + Base64 only.
