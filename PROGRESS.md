# YAML Frontmatter Helper — v0.1.0 Progress

## Overview

A VSCode extension that provides a sidebar panel for viewing, editing, and searching YAML front matter in Markdown files with real-time bidirectional sync between the text editor and the sidebar UI.

## Current Status

All planned features for v0.1.0 are implemented and verified.

## Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Parse YAML front matter from .md | Done | Scalar + list types, comment preservation via `yaml.parseDocument` |
| Sidebar form editing | Done | TextField, Checkbox, TagInput auto-selected by value type |
| Add / delete fields | Done | Optimistic local update + host-side document write |
| Real-time editor→sidebar sync | Done | `onDidChangeTextDocument` with 300ms debounce + diff gate |
| Real-time sidebar→editor sync | Done | `editor.edit()` targeting front matter range only, editId dirty guard |
| Cross-file search | Done | `findFiles('**/*.md')` + trie-based directory tree with collapse |
| Search result click → open file | Done | `vscode.window.showTextDocument(uri)` |

## Architecture

```
Extension Host (TS)                  Webview (React 18 + Vite)
┌─────────────────────┐              ┌──────────────────────┐
│ parser.ts           │              │ App.tsx               │
│  extractFrontMatter │              │  ├─ Edit Tab          │
│  serializeFrontMat. │              │  │  ├─ FieldRow       │
│  fieldsToSchema     │              │  │  └─ FieldEditor    │
│                     │              │  ├─ Search Tab        │
│ sync.ts             │◄─postMessage►│  │  ├─ SearchPanel    │
│  onDocChange+debounce│             │  │  └─ SearchTree     │
│  applyEditToDocument │              │  └─ AddField          │
│                     │              │                       │
│ searcher.ts         │              │ hooks/                │
│  search+buildTree   │              │  ├─ useVSCodeAPI      │
│  +cache invalidation│              │  └─ useFrontMatter    │
│                     │              │                       │
│ ViewProvider.ts     │              │ bridge.ts             │
│  WebviewViewProvider│              │  message type defs    │
└─────────────────────┘              └──────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | TypeScript, VSCode API |
| YAML | `yaml` npm (v2) |
| Webview UI | React 18, inline CSS with VSCode CSS variables |
| Build (webview) | Vite 5 |
| Build (ext) | tsc |
| Package | vsce |

## Known Issues Fixed

1. `acquireVsCodeApi()` called twice → upgraded to module-level singleton
2. Extra blank lines after front matter → removed trailing `\n` in `serializeFrontMatter`
3. Webview form input reset on edit → added optimistic local state update
