# YAML Frontmatter Helper — Design Spec

**Date**: 2026-07-22  
**Status**: Approved

---

## 1. Overview

A VSCode extension that provides a sidebar panel for viewing and editing YAML front matter in Markdown files. Emphasis on **real-time bidirectional sync** between the text editor and the sidebar UI, so that users editing front matter in either place see changes reflected immediately in the other.

| Dimension | Decision |
|-----------|----------|
| Primary scenario | Current file first, cross-file search secondary |
| Value types | Scalar (string, number, boolean) + simple lists/arrays |
| Sidebar editing | Form-based for simple fields; complex edits go to the file editor |
| Sidebar search | Embedded search panel with tree-view results by directory |
| UI stack | Webview + React + Vite + `@vscode/webview-ui-toolkit` |
| YAML library | `yaml` npm package (parseDocument for comment preservation) |

---

## 2. Project Structure

```
yaml-frontmatter-helper/
├── package.json
├── tsconfig.json
├── vite.webview.config.ts
├── src/
│   ├── extension.ts                    # activate / deactivate
│   ├── providers/
│   │   └── FrontMatterViewProvider.ts  # WebviewViewProvider impl
│   ├── core/
│   │   ├── parser.ts                   # YAML front matter parse / serialize
│   │   ├── sync.ts                     # Bidirectional sync with dirty guard
│   │   └── searcher.ts                 # Cross-file front matter search
│   ├── types.ts                        # Shared type definitions
│   └── webview/
│       ├── index.tsx                   # React entry
│       ├── App.tsx                     # Root: form tab + search tab
│       ├── components/
│       │   ├── FieldEditor.tsx         # Value-type-aware form control
│       │   ├── SearchPanel.tsx         # Cross-file search panel
│       │   ├── SearchTree.tsx          # Search results as tree by directory
│       │   └── FieldRow.tsx            # Single field row (label + control)
│       ├── hooks/
│       │   ├── useFrontMatter.ts       # Front matter state + sync
│       │   └── useVSCodeAPI.ts         # postMessage wrapper
│       └── bridge.ts                   # Message type contracts
```

---

## 3. Real-Time Sync Data Flow

```
Text Editor                    Webview Sidebar
(Markdown file)                (React form)
      │                              │
      │ ① User edits FM in editor    │ ③ User edits form field
      │    onDidChangeTextDocument    │    postMessage({type:'update'})
      ▼                              │
┌──────────────────────────────────────────────┐
│              Extension Host                   │
│  ┌──────────┐   ┌──────────┐                 │
│  │ Parser   │◄──│  Sync    │──► ViewProvider │
│  │ parseYAML│   │ Manager  │    postMessage  │
│  └──────────┘   │          │                 │
│                 │ · debounce (300ms)          │
│                 │ · dirty guard (editId)      │
│                 │ · diff before push          │
│                 └──────────┘                 │
│  ┌──────────┐  ④ Sidebar edit → editor.edit() │
│  │ Searcher │     modify FM region in doc     │
│  └──────────┘                                 │
└──────────────────────────────────────────────┘
```

### 3.1 Loop Prevention

1. Sidebar sends edit request → host calls `TextEditor.edit()` → records `pendingEditId`.
2. `onDidChangeTextDocument` fires → detected as own edit → skip push to webview.
3. User edits directly in editor → `onDidChangeTextDocument` fires → no matching `pendingEditId` → parse → push to webview.

### 3.2 Debounce

Editor changes debounced at 300ms to avoid excessive YAML parsing during rapid typing.

### 3.3 Diff Gate

After parsing, compare result with last-sent front matter object (shallow equal). Only push to webview if content actually changed.

---

## 4. YAML Parsing & Serialization

### 4.1 Parse Flow

```
.md file content
    │
    ▼
Regex extract /^---\n([\s\S]*?)\n---/
    │  (captures YAML block between --- delimiters)
    ▼
yaml.parseDocument(yamlString)
    │  (preserves comments via CST nodes)
    ▼
→ FrontMatterData { fields: Record<string, any>, exists: boolean }
```

- File has no front matter → return `{ fields: {}, exists: false }`.
- Parse error → return error object; sidebar displays error banner, file content untouched.

### 4.2 Serialize Flow

```
FrontMatterData (modified)
    │
    ▼
yaml.stringify(fields, { lineWidth: 0 })
    │  (no line wrapping to preserve readability)
    ▼
Wrap with ---\n...\n--- delimiters
    │
    ▼
Replace front matter region in document text
    │  (if !exists: prepend; if exists: replace region)
```

### 4.3 Value Type Handling

| YAML type | JS type | Form control |
|-----------|---------|-------------|
| string | `string` | TextField |
| number | `number` | TextField (number) |
| boolean | `boolean` | Checkbox / Toggle |
| date (ISO string) | `string` | TextField (date hint) |
| array (inline or block) | `string[]` | TagInput |
| null | `null` | TextField (empty) |

### 4.4 Comment Preservation

Use `yaml.parseDocument()` instead of `yaml.parse()` to retain comment nodes in the CST. When serializing back, call `doc.toString()` which preserves all formatting including comments.

---

## 5. Cross-File Search

### 5.1 UI Layout

```
┌──────────────────────────┐
│ 🔍 Search front matter...│  ← keyword input, live filter
│ [Current file / All files]│  ← scope toggle
├──────────────────────────┤
│ ✏️ Edit  │  📋 Results   │  ← Tab bar
├──────────────────────────┤
│ title:  [Hello World   ] │  ← Current file form (Edit tab)
│ tags:   [tag1][tag2][+] │
│ draft:  [○] [●]         │
│ date:   [2024-01-01   ] │
├──────────────────────────┤
│ Search "tag:react"  (5)  │  ← Results tab
│ ▼ src/                   │
│   ├─ index.md            │
│   │  tags: [react,ts]    │
│   ├─ guide.md            │
│   │  tags: [react]       │
│ ▼ blog/                  │
│   ├─ post1.md            │
│   │  tags: [react,css]   │
│   └─ post2.md            │
│ ▶ docs/                  │  ← collapsed directory
└──────────────────────────┘
```

### 5.2 Search Logic

- `vscode.workspace.findFiles('**/*.md')` to enumerate all Markdown files.
- Read each file, extract front matter via parser.
- Match: field name fuzzy match + value substring match.
- Build a prefix tree (Trie) grouped by directory segments (`/` split).
- Top-level directories expanded by default; rest collapsed.

### 5.3 Performance

- Cache search results keyed by file path.
- On `onDidChangeTextDocument`, invalidate only the changed file's cache entry.
- Debounce search input at 500ms.
- If results > 50, collapse subdirectories after the first 2 top-level dirs.

### 5.4 Navigation

Clicking a file node calls `vscode.window.showTextDocument(uri)` to open the file and switch the active editor context.

---

## 6. Communication Protocol (Host ↔ Webview)

All messages are JSON objects with a `type` discriminant.

### Host → Webview

| type | payload | description |
|------|---------|-------------|
| `updateFM` | `{ fields: Record<string, any>, exists: boolean }` | Push parsed front matter to webview |
| `searchResults` | `{ query: string, tree: SearchTreeNode[] }` | Push search results |
| `error` | `{ message: string }` | Display error banner in webview |

### Webview → Host

| type | payload | description |
|------|---------|-------------|
| `updateFM` | `{ field: string, value: any }` | User edited a single field in the form |
| `addField` | `{ field: string, value: any }` | User added a new field |
| `deleteField` | `{ field: string }` | User removed a field |
| `search` | `{ query: string, scope: 'current' \| 'all' }` | User initiated a search |
| `openFile` | `{ filePath: string }` | User clicked a search result file |
| `ready` | `{}` | Webview initialized, ready to receive data |

---

## 7. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Extension host | TypeScript | Native VSCode API |
| YAML | `yaml` (npm) | Full CST support, comment preservation |
| Webview UI | React 18 | Mature ecosystem, form libraries available |
| Toolkit | `@vscode/webview-ui-toolkit` | Native VSCode look & feel |
| Build (webview) | Vite | Fast HMR for dev, single-bundle output |
| Build (extension) | `tsc` or esbuild via `vsce` | Standard VSCode extension packaging |
| State management | React useState / useReducer | Sufficient for scope; no external state lib needed |

### Dependencies

```json
{
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@vscode/vsce": "latest",
    "@vscode/webview-ui-toolkit": "latest",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@vitejs/plugin-react": "latest",
    "typescript": "^5",
    "vite": "^5"
  },
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "yaml": "^2"
  }
}
```

---

## 8. Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid YAML in front matter | Sidebar shows error banner with parse error message; file content untouched |
| No front matter in file | Sidebar shows empty form with "Add field" prompt; `exists: false` |
| File deleted while sidebar is open | Sidebar clears form, shows "No active Markdown editor" placeholder |
| Search reads a file with bad YAML | Skip that file in results, log warning |
| Webview disconnected/crashed | Host cleans up listeners; re-initializes on next activation |
| Very large file (>1MB) | Skip front matter parsing; show "File too large" notice |

---

## 9. Activation Events

```json
"activationEvents": [
  "onLanguage:markdown",
  "onView:yaml-frontmatter-helper.sidebar"
]
```

The extension activates when a Markdown file is opened or when the sidebar view is first made visible.

---

## 10. Testing Strategy

- **Unit tests** (vitest): `parser.ts` — parse valid/invalid/missing front matter, serialize with comments, list handling
- **Unit tests** (vitest): `sync.ts` — dirty guard logic, debounce, diff detection
- **Unit tests** (vitest): `searcher.ts` — trie construction, tree grouping, cache invalidation
- **Integration tests**: Mock `vscode` API for `ViewProvider` message round-trip
- **Manual testing**: Install `.vsix` in VSCode, test with real Markdown files
