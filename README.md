# Obsidian Local

Static GitHub Pages Markdown editor + local-only Keep-style private notes.

## What goes where

### Obsidian tab

- Opens a local `.md` file
- Renders Markdown as one continuous reading view
- Click a Markdown block to edit only that block
- Autosaves directly back to the selected `.md` file
- Checklist mode automatically continues `- [ ]` when Enter is pressed

### Keep tab

- Never sends notes to GitHub
- Never uses an API
- Never uses a cookie or token
- Stores one Base64 string in browser `localStorage`
- Requires the configured password before the UI reveals notes
- Password check is `btoa(input) === configured Base64`
- "Copy Base64" gives you the exact stored payload for manual recovery

Current password:

```text
ILOVERAMEN
```

Its configured Base64 form is:

```text
SUxPVkVSQU1FTg==
```

## Keep localStorage key

```text
obsidianLocalKeepNotes
```

The value is Base64-encoded UTF-8 JSON.

You can inspect it in browser DevTools:

```text
Application
→ Local Storage
→ your GitHub Pages origin
→ obsidianLocalKeepNotes
```

Or run:

```js
localStorage.getItem("obsidianLocalKeepNotes")
```

## Important

Base64 is encoding, not cryptographic encryption.

Anyone who has access to the browser's stored value can decode it. This project intentionally uses Base64 because the desired design prioritizes simple manual recovery.

## Persistence

`localStorage` normally survives:

- refreshes
- closing/reopening the browser
- computer restarts

It can still disappear if browser/site data is cleared, the browser profile is deleted, or storage is otherwise reset.

Use **Copy Base64** periodically if the notes matter.

## Deploy to GitHub Pages

Put these files in your Pages repository root:

```text
index.html
style.css
script.js
README.md
```

For a user GitHub Pages site, name the repo:

```text
YOUR_USERNAME.github.io
```

Then:

```text
Repository
→ Settings
→ Pages
→ Deploy from a branch
→ main
→ / (root)
```

No build step is required.
