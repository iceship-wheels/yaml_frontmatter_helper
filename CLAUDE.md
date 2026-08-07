# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository is a VS Code extension called **YAML Frontmatter Helper**. It contributes a sidebar webview panel for viewing and editing YAML front matter in Markdown files, with real-time bidirectional sync between the editor and the sidebar, plus a cross-file search tab.

## Common Commands

Build everything (required before packaging or running the extension):

```bash
npm run compile          # Compile extension host TypeScript (src → out)
npm run build:webview    # Bundle webview React app (src/webview → out/webview)
```

Develop with watchers:

```bash
npm run watch            # Watch and recompile extension host
npm run dev:webview      # Watch and rebuild webview bundle
```

Package the extension into a `.vsix`:

```bash
npm run package          # Runs vsce package
```

Run and debug the extension:

- Open the project in VS Code.
- Press `F5` (or run **Run Extension** from the Run menu). This opens the Extension Development Host where the sidebar view will be available.
- The extension activates when a Markdown file is opened or when the **YAML Frontmatter** sidebar view is shown.

There are currently no test or lint scripts configured.

## Project Architecture

The extension has two runtime parts that communicate over VS Code's `postMessage` API:

1. **Extension host** — standard Node/VS Code context in `src/extension.ts`.
2. **Webview** — a React app bundled with Vite, loaded into a `WebviewView`.

### Host-side Flow

- `src/extension.ts` registers `FrontMatterViewProvider` for the view type `yaml-frontmatter-helper.sidebar`.
- `src/providers/FrontMatterViewProvider.ts` creates the webview, wires message handlers, and coordinates parsing, sync, and search.
- `src/core/parser.ts` extracts YAML front matter from Markdown text, serializes it back, and infers field types.
- `src/core/sync.ts` (`SyncManager`) keeps the active Markdown file in sync with the webview. It debounces editor changes (300 ms) and prevents feedback loops when the sidebar edits the document.
- `src/core/searcher.ts` (`Searcher`) scans all Markdown files in the workspace for front matter matching a keyword and returns results grouped in a directory tree.

### Webview Flow

- `src/webview/index.tsx` is the React entry point.
- `src/webview/App.tsx` renders the tab bar (Edit / Search) and dispatches to the panel components.
- `src/webview/hooks/useFrontMatter.ts` manages front matter state and sends edit/add/delete messages to the host.
- `src/webview/hooks/useVSCodeAPI.ts` wraps `acquireVsCodeApi()` and global message listeners.
- `src/webview/bridge.ts` and `src/types.ts` define the message protocol between host and webview.

### Message Protocol

Host → webview:

- `updateFM` — push parsed front matter fields and `exists` flag.
- `searchResults` — push search result tree.
- `error` — display an error banner.

Webview → host:

- `ready` — webview is initialized and ready.
- `updateFM` — update a single field value.
- `addField` / `deleteField` — add or remove a field.
- `search` — run a cross-file search.
- `openFile` — open a file from the search results.

### Build Notes

- `tsconfig.json` compiles `src/**/*.ts` to `out/` as CommonJS for the extension host and excludes `src/webview/**/*`.
- `vite.webview.config.ts` builds `src/webview/index.html` into `out/webview/bundle.js` in IIFE format.
- The provider injects the final `bundle.js` path into the webview HTML via `webview.asWebviewUri`.
- `vscode:prepublish` runs both `compile` and `build:webview`, so `vsce package` always produces a complete bundle.
