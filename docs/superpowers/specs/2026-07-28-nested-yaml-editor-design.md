# Nested YAML Front Matter Editor — Design Spec

**Date**: 2026-07-28
**Status**: Design Approved

---

## 1. Overview

Extend the sidebar YAML editor from flat key-value pairs to a **tree-based nested editor** supporting YAML's full logical structure: scalars, mappings (key-value objects), and sequences (ordered lists), with nesting up to **3 levels deep**.

### Decisions Summary

| Decision | Choice |
|----------|--------|
| UI pattern | Accordion sections (mappings/sequences) + inline scalars |
| Nesting limit | 3 levels max; deeper content displayed read-only |
| Editing workflow | Hybrid — inline "+" add, hover × delete, drag-to-reorder |
| YAML features in scope | Basic scalars (string/number/boolean/date/null), multi-line strings (`\|`/`>`), flow style syntax (`{}`/`[]`) |
| YAML features out of scope | Anchors/aliases, tags, comments |
| String multi-line detection | Smart — auto-detect content, show textarea if multi-line, input if single-line |
| Accordion structure | Scalars inline at parent level; only mappings/sequences become accordion sections |
| Flow style display | Show "flow" badge, preserved on re-serialization |

---

## 2. Data Model

### 2.1 Internal Tree Representation

A new `YamlNode` type replaces the flat `FieldSchema[]` for the nested editor:

```typescript
// src/types.ts — additions

export type YamlNodeType = 'mapping' | 'sequence' | 'scalar';

export interface YamlNode {
  key: string;
  type: YamlNodeType;
  value: unknown;         // scalar value (for scalar type), undefined for mapping/sequence
  children: YamlNode[];   // for mapping: key-value pairs; for sequence: items
  meta?: {
    flowStyle?: boolean;  // source used flow-style {} or []
    multiLine?: boolean;  // source used | or > for scalar
    depth: number;        // nesting depth (0 = root level)
    readOnly?: boolean;   // exceeds depth limit, display only
  };
}
```

### 2.2 Serialization Format

Flatten a nested YAML tree into a `Record<string, unknown>` keyed by dot/bracket path for interop with existing `SyncManager`:

```typescript
{
  "title": "My Post",           // simple scalar
  "metadata.author": "John",    // nested mapping field
  "metadata.tags[0]": "tutorial", // nested sequence
  "metadata.tags[1]": "js"
}
```

This allows the existing `FrontMatterData.fields` record to represent nested content using path-strings as keys, while the webview renders the tree structure from the same data. (See §5 for details on serialization.)

### 2.3 Type Inference

```typescript
function inferYamlNodeType(value: unknown): YamlNodeType {
  if (value === null || value === undefined) return 'scalar';
  if (typeof value === 'boolean') return 'scalar';
  if (typeof value === 'number') return 'scalar';
  if (typeof value === 'string') return 'scalar';
  if (Array.isArray(value)) return 'sequence';
  if (typeof value === 'object') return 'mapping';
  return 'scalar';
}
```

### 2.4 Depth Enforcement

```typescript
function computeDepth(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value)) {
    return 1 + Math.max(0, ...value.map(v => computeDepth(v)));
  }
  // Plain object
  return 1 + Math.max(0, ...Object.values(value).map(v => computeDepth(v)));
}
```

Documents exceeding depth 3 are flagged `readOnly` at the root level. The host sends a warning state; the webview renders tree content as non-editable.

---

## 3. Message Protocol

### 3.1 Host → Webview

```typescript
export type MessageToWebview =
  | { type: 'updateFM'; fields: Record<string, unknown>; exists: boolean; readOnly?: boolean }
  | { type: 'searchResults'; query: string; tree: SearchTreeNode[] }
  | { type: 'error'; message: string };
```

### 3.2 Webview → Host

```typescript
// Path-based operations
export type MessageFromWebview =
  | { type: 'ready' }
  // Existing flat operations kept for backward compat:
  | { type: 'updateFM'; field: string; value: unknown }
  | { type: 'addField'; field: string; value: unknown }
  | { type: 'deleteField'; field: string }
  | { type: 'renameField'; oldField: string; newField: string }
  // New path-based operations:
  | { type: 'nestedUpdate'; path: string; value: unknown }
  | { type: 'nestedAdd'; path: string; key: string; nodeType: YamlNodeType }
  | { type: 'nestedDelete'; path: string }
  | { type: 'nestedRename'; path: string; newKey: string }
  | { type: 'nestedMove'; path: string; toIndex: number }
  // Search and navigation (unchanged):
  | { type: 'search'; query: string; scope: 'current' | 'all' }
  | { type: 'openFile'; filePath: string };
```

When a `nestedAdd` arrives at the host:
- `path=""` or `path="."` → add at root level
- `path="metadata"` → add child inside the `metadata` mapping
- `path="tags"` → add item to the `tags` sequence

The host maps `nodeType` to a sensible default value, applies the edit to the document, and sends an `updateFM` back confirming the change.

---

## 4. Host-Side Changes

### 4.1 `src/core/parser.ts` — Enhancements

Add two new exports:

```typescript
// Convert flat Record to tree YamlNode[]
function recordToTree(fields: Record<string, unknown>): YamlNode[] {
  // Parse dot/bracket keys into nested structure
  // e.g., "metadata.tags[0]" → mapping{metadata → sequence{tags → scalars}}
}

// Convert tree back to flat Record
function treeToRecord(nodes: YamlNode[]): Record<string, unknown> {
  // Flatten tree into dot/bracket keys for the SyncManager
}
```

Keep existing `extractFrontMatter`, `serializeFrontMatter`, `inferFieldType`, `fieldsToSchema` for backward compat.

### 4.2 `src/core/sync.ts` — Path-Based Mutations

New methods on `SyncManager`:

```typescript
// Navigate a dot/bracket path into the current document fields
// "metadata.tags" → doc.fields["metadata"]["tags"]
private resolvePath(path: string, fields: Record<string, unknown>): unknown

// Mutate via path
async applyNestedUpdate(path: string, value: unknown): Promise<void>
async applyNestedAdd(path: string, key: string, nodeType: YamlNodeType): Promise<void>
async applyNestedDelete(path: string): Promise<void>
async applyNestedRename(path: string, newKey: string): Promise<void>
async applyNestedMove(path: string, toIndex: number): Promise<void>
```

Implementation approach: work with plain JS objects (not YAML AST directly). The `yaml` library's `parseDocument` + `doc.toJSON()` gives us a plain JS object tree. We mutate it via lodash-style path helpers, then re-serialize with `new YAML.Document()`.

**Why not YAML AST manipulation?**
- The `yaml` library AST has complex node types (`YAMLMap`, `YAMLSeq`, `Scalar`)
- For depth ≤ 3, JS object mutation + re-serialization is simpler and less error-prone
- The `yaml` library preserves reasonable formatting on re-serialize
- Future: if we need comment/preservation, we can migrate to AST operations

### 4.3 `src/providers/FrontMatterViewProvider.ts`

Add depth-check after each host-side mutation:

```typescript
const depth = computeDepth(this.currentFM.fields);
const readOnly = depth > 3;
this.postMessage({ type: 'updateFM', fields: fm.fields, exists: fm.exists, readOnly });
```

Handle new message types:

```typescript
case 'nestedUpdate':
  await this.syncManager.applyNestedUpdate(msg.path, msg.value);
  break;
case 'nestedAdd':
  await this.syncManager.applyNestedAdd(msg.path, msg.key, msg.nodeType);
  break;
// etc.
```

---

## 5. Serialization Strategy

The key insight enabling incremental migration: **flatten nested YAML into dot/bracket path keys** for the `Record<string, unknown>` that flows across the host-webview boundary.

### 5.1 Flatten (tree → record)

```yaml
# Original YAML
title: My Post
metadata:
  author: John
  tags:
    - tutorial
    - js
```

→

```json
{
  "title": "My Post",
  "metadata": {
    "author": "John",
    "tags": ["tutorial", "js"]
  }
}
```

The `Record<string, unknown>` already supports nested objects/arrays natively in JavaScript — JSON serialization preserves them. The webview receives the full structure and renders it as a tree.

**No dot/bracket flattening needed.** The existing `Record<string, unknown>` is sufficient because:
- The host sends the full `fields` object, which naturally includes nested maps and arrays
- The webview recursively renders them without needing path-flattened keys
- The `updateFM` message already handles this (it's a `JSON.parse`/`JSON.stringify` cycle)

Path flattening is only needed **for the serialized text in the editor** (the `---` block in the document). The `yaml` library already serializes nested structures correctly.

### 5.2 Mutation with Path Strings

When the webview sends `{ type: 'nestedUpdate', path: 'metadata.author', value: 'Jane' }`, the host does:

```typescript
const ref = _.set(fields, 'metadata.author', 'Jane');  // lodash-style path mutation
await this.applyEditToDocument(fields);
```

Using a minimal lodash-style `set`/`get`/`unset` utility (or `yaml`'s `setIn` on the document).

---

## 6. Webview Components

### 6.1 Component Tree

```
App.tsx
  └── YamlTreeView (NEW — replaces flat field list for nested content)
        ├── ScalarField (for each top-level scalar key)
        │     └── FieldEditor (existing, types unchanged)
        ├── AccordionSection (for each top-level mapping/sequence)
        │     ├── SectionHeader (chevron, key name, type badge, child count, flow badge)
        │     ├── SectionContent (when expanded)
        │     │     ├── ScalarField (text/textarea/checkbox per type)
        │     │     ├── AccordionSection (recursive, depth 1–2)
        │     │     └── SequenceItem (items in a sequence)
        │     │           └── ScalarField or AccordionSection (recursive)
        │     └── SectionFooter ("+ Add" button)
        └── AddNodeButton (the wide "+" bar at the bottom)
```

### 6.2 New Components

**`YamlTreeView.tsx`**
- Props: `nodes: YamlNode[]`, mutation callbacks
- Renders scalars inline → `ScalarField`
- Renders mappings/sequences → `AccordionSection`
- Sorts: scalars first (preserving original order), then others

**`AccordionSection.tsx`**
- State: `expanded: boolean`
- Header shows: ▼/▶, key name, type badge (`{}`/`[]`), count badge, flow badge
- Content renders children recursively (depth ≤ 2 inside accordion = total 3 max)
- Footer has dashed "+ Add" button
- For mappings: "+ Add" shows type dropdown (same pattern as the wide bar)
- For sequences: "+ Add" adds a new item (type: scalar)

**`ScalarField.tsx`**
- Replaces `FieldRow` for scalar values (no key-editing needed here — key is always visible)
- Auto-detect multi-line: `value.includes('\n')` → textarea, else → input
- Shows type badge for non-string types (Boolean, Number, Date)
- × delete button on hover (using CSS `:hover` + `opacity`)
- On change: debounce 100ms, send path-based update

**`SequenceItem.tsx`**
- Drag handle (⠿), content slot, × delete button on hover
- For scalar items: inline editor
- For nested items: recursive AccordionSection
- Dashed "+ Add" button at bottom

### 6.3 Editing Patterns (Hybrid)

| Action | UI Pattern |
|--------|-----------|
| Add scalar to mapping | Dashed "+" button in accordion footer → type dropdown → adds with empty value, enters key edit mode |
| Add item to sequence | Dashed "+" button in sequence footer → auto-adds new item with empty value |
| Delete field | × button appears on row hover (CSS opacity transition) |
| Rename mapping key | Click key name, inline edit (same as current FieldRow) |
| Reorder sequence | Drag handle (⠿) — v1: use up/down buttons instead for simplicity |
| Reorder top-level fields | Drag handle on accordion header — out of scope for v1, ordered by field insertion order |

### 6.4 Multi-Line String Editing

Smart detection in `ScalarField.tsx`:

```typescript
// On render: check content
const isMultiLine = typeof value === 'string' && value.includes('\n');

// Render: conditional
if (isMultiLine) {
  <textarea ... />
} else {
  <input type="text" ... />
}

// User can toggle: a small resize icon in the textarea lets them expand/shrink
```

Switch from input to textarea is automatic — no toggle button needed. If the user types a newline in the input (pastes multi-line text), it auto-switches to textarea.

---

## 7. Depth Handling

### 7.1 At Parse Time (Host)

When `extractFrontMatter` runs, after getting the document AST, compute `maxDepth`:

```typescript
function maxDepth(obj: unknown, depth = 0): number {
  if (!obj || typeof obj !== 'object') return depth;
  if (Array.isArray(obj)) {
    return depth + (obj.length > 0
      ? Math.max(...obj.map(item => maxDepth(item, depth + 1)))
      : depth + 1);
  }
  return depth + (Object.keys(obj).length > 0
    ? Math.max(...Object.values(obj).map(v => maxDepth(v, depth + 1)))
    : depth + 1);
}
```

If `maxDepth > 3`, set `readOnly: true` on the `updateFM` message.

### 7.2 In the Webview

`YamlTreeView` checks `readOnly` state:
- If `readOnly`: hide all "+" buttons, × buttons, edit controls
- Show a warning banner: "This document has nesting deeper than 3 levels and is displayed read-only"
- Content still rendered at full depth so the user can see the structure

### 7.3 Preventing Excess Depth

When adding a field inside an accordion at depth 2 (which would create a child at depth 3):
- The "+" dropdown only offers scalar types (string/number/boolean/date/null)
- Mapping and sequence options are disabled with a tooltip "Max nesting depth (3) reached"

---

## 8. Search Integration

Extend `Searcher.search()` to index nested values:

```typescript
// Current: match against flat fields Record<string, unknown>
// New: recursivly traverse the fields tree, match any scalar value

function matchesQuery(fields: Record<string, unknown>, query: string): Array<{ field: string; value: unknown }> {
  const results: Array<{ field: string; value: unknown }> = [];
  const stack: Array<{ prefix: string; obj: unknown }> = [{ prefix: '', obj: fields }];

  while (stack.length > 0) {
    const { prefix, obj } = stack.pop()!;

    if (typeof obj !== 'object' || obj === null) {
      if (String(obj).toLowerCase().includes(query.toLowerCase())) {
        results.push({ field: prefix, value: obj });
      }
      continue;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, i) => {
        stack.push({ prefix: `${prefix}[${i}]`, obj: item });
      });
    } else {
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        stack.push({ prefix: prefix ? `${prefix}.${key}` : key, obj: value });
      }
    }
  }

  return results;
}
```

The search results tree (`SearchTreeNode`) already supports hierarchical structure (directory/file trees with match lists). Nested values just produce more entries in the match list with dot-notation field names.

---

## 9. Migration Plan

### Phase 1: Data Model + Parser
- Add `YamlNode` types to `src/types.ts` and `src/webview/bridge.ts`
- Add `recordToTree` / `treeToRecord` / `inferYamlNodeType` / `maxDepth` to `src/core/parser.ts`
- Add path utilities (`getIn`, `setIn`, `unsetIn`, `renameIn`) to `src/core/path.ts` (new file)
- Keep all existing exports for backward compat

### Phase 2: Host-Side Path Operations
- Add new methods to `SyncManager` (`applyNestedUpdate`, `applyNestedAdd`, ...)
- Add new message handlers in `FrontMatterViewProvider`
- Add depth check and readOnly flag

### Phase 3: Webview Tree Components
- Create `YamlTreeView`, `AccordionSection`, `ScalarField`, `SequenceItem`, `AddNodeButton`
- Wire them into `useFrontMatter` hook (new state for tree + path-based callbacks)
- Conditionally render YamlTreeView in `App.tsx` (detect nested content)
- Keep existing flat UI for backward compat

### Phase 4: Search + Polish
- Extend `Searcher` for nested values
- Add drag reorder (or up/down buttons as simpler alternative)
- Add read-only warning banner
- Polish accordion interactions (keyboard nav, focus management)

---

## 10. Files Changed / Created

| File | Change |
|------|--------|
| `src/types.ts` | Add `YamlNode`, `YamlNodeType`, path-based message types |
| `src/webview/bridge.ts` | Sync webview types with new host types |
| `src/core/parser.ts` | Add `recordToTree`, `treeToRecord`, `inferYamlNodeType`, `maxDepth` |
| `src/core/path.ts` | **NEW** — path utilities `getIn`, `setIn`, `unsetIn`, `renameIn` |
| `src/core/sync.ts` | Add `applyNestedUpdate`, `applyNestedAdd`, `applyNestedDelete`, ... |
| `src/core/searcher.ts` | Recursive value search |
| `src/providers/FrontMatterViewProvider.ts` | New message handlers, depth check |
| `src/webview/hooks/useFrontMatter.ts` | Tree state + path-based callbacks |
| `src/webview/App.tsx` | Conditional tree vs flat rendering |
| `src/webview/components/YamlTreeView.tsx` | **NEW** |
| `src/webview/components/AccordionSection.tsx` | **NEW** |
| `src/webview/components/ScalarField.tsx` | **NEW** |
| `src/webview/components/SequenceItem.tsx` | **NEW** |
| `src/webview/components/AddNodeButton.tsx` | **NEW** |

---

## 11. Verification

1. **Build**: `npm run compile && npm run build:webview`
2. **Open flat front matter** (e.g., `title: "Hello"`, `draft: false`):
   - Verify it renders as inline scalars with no accordion sections
   - Verify "+" bar at bottom still works
3. **Open nested front matter** (e.g., `metadata: { author: "John", tags: [a, b] }`):
   - Verify `metadata` is an accordion section with ▼/▶ toggle
   - Expand it — verify nested `author` (scalar) and `tags` (sequence) are visible
4. **Add a mapping**: click "+" at bottom, select "Mapping" type
   - Verify accordion section appears with empty content
   - Click "+" inside to add a scalar child
5. **Add a sequence**: add a sequence-type field
   - Verify it renders with "+ Add item" button
   - Adding items should create scalar entries
6. **Multi-line auto-detect**: edit a string field → paste text with newlines
   - Verify it auto-switches to textarea
7. **Depth limit**: create a doc with depth > 3 (manual edit in text editor)
   - Verify sidebar shows read-only warning banner
   - Verify edit controls are hidden
8. **Search**: search for a value at depth 2
   - Verify it appears in search results
9. **Regression**: flat documents should work exactly as before
