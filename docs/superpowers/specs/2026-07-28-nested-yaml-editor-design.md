# Nested YAML Front Matter Editor — Design Spec

**Date**: 2026-08-08
**Status**: Design Approved (Revised from 2026-07-28)

---

## 1. Overview

Extend the sidebar YAML editor from flat key-value pairs to a **tree-based nested editor** supporting YAML's logical structure: scalars, mappings (key-value objects), and sequences (ordered lists), with nesting up to **3 levels deep**.

### Decisions Summary

| Decision | Choice |
|----------|--------|
| UI pattern | Accordion sections (mappings/sequences) + inline scalars |
| Nesting limit | 3 levels max; deeper content displayed read-only |
| Editing workflow | Inline "+" add, hover × delete; **no drag reorder** |
| YAML features in scope | Scalars, mappings (`{}`), sequences (`[]`), multi-line strings |
| YAML features out of scope | Anchors/aliases, tags, comments, flow-style badge, drag reorder |
| Scalar value representation | `unknown` — preserve YAML library native types at rest, display as text |
| String multi-line detection | Auto-detect `\n` → textarea; single-line → input |
| Accordion structure | Scalars inline at parent level; only mappings/sequences become accordion sections |
| Data flow | Host sends `Record<string, unknown>` (unchanged); Webview builds tree from it |

---

## 2. Data Model

### 2.1 Structural Types

Used **only on the Webview side** for recursive rendering. The Host side keeps the existing `Record<string, unknown>`.

```typescript
// src/types.ts — additions

export type YamlNodeType = 'mapping' | 'sequence' | 'scalar';

export interface YamlNode {
  key: string;
  type: YamlNodeType;
  value: unknown;         // scalar value; undefined for mapping/sequence
  children: YamlNode[];   // mapping: key-value pairs; sequence: ordered items
  meta: {
    depth: number;
    readOnly?: boolean;   // depth > 3
  };
}
```

### 2.2 Webview Tree Construction

The webview receives `Record<string, unknown>` from `updateFM`. It recursively walks the object to build `YamlNode[]`:

```typescript
function inferYamlNodeType(value: unknown): YamlNodeType {
  if (Array.isArray(value)) return 'sequence';
  if (value !== null && typeof value === 'object') return 'mapping';
  return 'scalar';
}

function fieldsToTree(fields: Record<string, unknown>, depth: number): YamlNode[] {
  return Object.entries(fields).map(([key, value]) => {
    const type = inferYamlNodeType(value);
    const isScalar = type === 'scalar';

    let children: YamlNode[] = [];
    if (Array.isArray(value)) {
      children = value.map((v, i) => ({
        key: String(i),
        type: inferYamlNodeType(v),
        value: (typeof v !== 'object' || v === null) ? v : undefined,
        children: (v !== null && typeof v === 'object' && !Array.isArray(v))
          ? fieldsToTree(v as Record<string, unknown>, depth + 1)
          : [],
        meta: { depth: depth + 1 },
      }));
    } else if (value !== null && typeof value === 'object') {
      children = fieldsToTree(value as Record<string, unknown>, depth + 1);
    }

    return {
      key,
      type,
      value: isScalar ? value : undefined,
      children,
      meta: { depth },
    };
  });
}
```

### 2.3 Depth Enforcement

```typescript
function maxDepth(obj: unknown): number {
  if (!obj || typeof obj !== 'object') return 0;
  if (Array.isArray(obj)) {
    return 1 + Math.max(0, ...obj.map(v => maxDepth(v)));
  }
  return 1 + Math.max(0, ...Object.values(obj).map(v => maxDepth(v)));
}
```

Computed on the Webview side from the received `fields` object. If `maxDepth > 3`: all nodes at depth > 3 get `meta.readOnly = true`. Edit controls (add/delete/rename) are hidden for those nodes.

### 2.4 Scalar Values

Scalar values use `unknown` — the YAML library's native JS types (`string`, `number`, `boolean`, `null`) pass through unchanged. The UI renders them as `String(value)` for editing. On re-serialization the YAML library handles type-appropriate formatting (e.g. `draft: true` stays a boolean, not `"true"`).

This eliminates `ValueType`-based type inference. The existing `ValueType = 'string' | 'array'` from the current simplified type system is only used by the flat UI's `FieldEditor` (text input vs tag editor); the nested UI uses structural types instead.

---

## 3. Message Protocol

### 3.1 Host → Webview (unchanged)

```typescript
export type MessageToWebview =
  | { type: 'updateFM'; fields: Record<string, unknown>; exists: boolean }
  | { type: 'searchResults'; query: string; tree: SearchTreeNode[] }
  | { type: 'error'; message: string };
```

No `readOnly` flag on `updateFM` — the webview computes depth from `fields` directly.

### 3.2 Webview → Host

Existing flat operations kept for backward compatibility + 4 new path-based operations:

```typescript
export type MessageFromWebview =
  | { type: 'ready' }
  // Existing flat operations (unchanged):
  | { type: 'updateFM'; field: string; value: unknown }
  | { type: 'addField'; field: string; value: unknown }
  | { type: 'deleteField'; field: string }
  | { type: 'renameField'; oldField: string; newField: string }
  // New path-based operations:
  | { type: 'nestedUpdate'; path: string; value: unknown }
  | { type: 'nestedAdd'; path: string; key: string; nodeType: YamlNodeType }
  | { type: 'nestedDelete'; path: string }
  | { type: 'nestedRename'; path: string; newKey: string }
  // Search and navigation (unchanged):
  | { type: 'search'; query: string; scope: 'current' | 'all' }
  | { type: 'openFile'; filePath: string };
```

**Path semantics**: `.`-delimited key path into the `fields` object. Examples:
- `""` or `"."` → root level
- `"metadata"` → `fields.metadata`
- `"metadata.author"` → `fields.metadata.author`

**`nestedAdd`**: `nodeType` determines default value — `'scalar' → ''`, `'sequence' → []`, `'mapping' → {}`.

**`nestedDelete`**: removes the key at `path` from a mapping or top-level `fields`. For sequence items (arrays), the webview instead uses `nestedUpdate` with the filtered array (remove the item client-side, send the whole array). This avoids needing index-based delete semantics.

**No `nestedMove`** — drag reorder is out of scope for this iteration.

---

## 4. Host-Side Changes

### 4.1 `src/core/path.ts` — NEW

Minimal path utilities operating on plain JS objects:

```typescript
function getIn(obj: Record<string, unknown>, path: string): unknown
function setIn(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown>
function unsetIn(obj: Record<string, unknown>, path: string): Record<string, unknown>
```

Only `.`-separated key paths. No `[index]` syntax — sequence item manipulation is done directly on arrays after `getIn` returns them.

### 4.2 `src/core/parser.ts` — No Changes

`extractFrontMatter`, `serializeFrontMatter`, `inferFieldType`, `fieldsToSchema` all remain as-is. `Record<string, unknown>` already supports nested structures through `yaml.parseDocument().toJSON()`.

### 4.3 `src/core/sync.ts` — 4 New Methods

```typescript
async applyNestedUpdate(path: string, value: unknown): Promise<void>
async applyNestedAdd(path: string, key: string, nodeType: YamlNodeType): Promise<void>
async applyNestedDelete(path: string): Promise<void>
async applyNestedRename(path: string, newKey: string): Promise<void>
```

Implementation: use `getIn`/`setIn`/`unsetIn` on the current `fields` object → `applyEditToDocument` to re-serialize. Works with plain JS objects; no YAML AST manipulation.

### 4.4 `src/providers/FrontMatterViewProvider.ts`

Add 4 new cases to the `onMessage` switch:

```typescript
case 'nestedUpdate':
  await this.syncManager.applyNestedUpdate(msg.path, msg.value);
  break;
case 'nestedAdd':
  await this.syncManager.applyNestedAdd(msg.path, msg.key, msg.nodeType);
  break;
case 'nestedDelete':
  await this.syncManager.applyNestedDelete(msg.path);
  break;
case 'nestedRename':
  await this.syncManager.applyNestedRename(msg.path, msg.newKey);
  break;
```

### 4.5 `src/core/searcher.ts` — Recursive Traversal

Extend the match logic to recurse into nested objects/arrays. Produce `.`-delimited field names for matches at depth (e.g. `metadata.author`).

---

## 5. Webview Components

### 5.1 Component Tree

```
App.tsx
  ├── Flat field list (existing FieldRow[] + AddField) — for flat documents
  └── YamlTreeView (NEW) — for nested documents
        ├── ScalarField (inline text editor)
        ├── AccordionSection (for each mapping/sequence)
        │     ├── SectionHeader (chevron ▼/▶, key, type badge {}, count)
        │     ├── SectionContent (when expanded)
        │     │     ├── ScalarField (recursive at depth 1–2)
        │     │     ├── AccordionSection (recursive, depth 1–2)
        │     │     └── SequenceItem
        │     │           └── ScalarField or AccordionSection (recursive)
        │     └── SectionFooter (dashed "+ Add" button)
        └── AddNodeButton (wide "+" bar at bottom, with type dropdown)
```

### 5.2 Rendering Decision

`App.tsx` checks whether the document has any nested content by examining the actual values in the fields record (not `FieldSchema.type`):

```typescript
const hasNested = Object.values(receivedFields).some(
  v => v !== null && typeof v === 'object'
);
// flat: render existing FieldRow[] + AddField
// nested: render YamlTreeView
```

Flat documents with no mappings/sequences keep the existing `FieldRow` + `AddField` UI.

### 5.3 New Components

**`YamlTreeView.tsx`**
- Props: `fields: FieldSchema[]`, `path: string` (parent path, `""` at root), callbacks
- Recursively renders: scalars → `ScalarField`, mappings → `AccordionSection`, sequences → `AccordionSection`
- Computes depth per node, passes `readOnly` to children

**`AccordionSection.tsx`**
- State: `expanded: boolean` (default true at depth 0–1)
- Header: ▼/▶ chevron, key name, type badge (`{}` for mapping, `[]` for sequence), child count
- **No flow-style badge** (out of scope)
- Content: renders children recursively
- Footer: dashed "+ Add" button
  - For mappings: shows type dropdown (Text / Tags / Object / List)
  - For sequences: adds a new scalar item with auto-generated name
- At depth 2, the "+" only offers Text and Tags (prevents exceeding depth 3)

**`ScalarField.tsx`**
- Inline editor replacing `FieldRow` for scalar values
- Auto-detect multi-line: `String(value).includes('\n')` → `<textarea>`, else → `<input type="text">`
- On change: debounce 100ms, send `nestedUpdate` with full path
- × delete button on hover (CSS opacity transition)
- Key displayed as a non-editable label alongside the input

**`SequenceItem.tsx`**
- Content slot (scalar editor or recursive `AccordionSection`)
- × delete button on hover

**`AddNodeButton.tsx`**
- Wide "+" button → click opens type dropdown
- Options: Text (scalar), Tags (sequence of strings), Object (mapping), List (sequence)
- On select: generates unique key, sends `nestedAdd` with `path=""` and selected `nodeType`

### 5.4 Editing Patterns

| Action | UI Pattern |
|--------|-----------|
| Add scalar to mapping | Dashed "+" in accordion footer → type dropdown → inline key + value |
| Add item to sequence | Dashed "+" in sequence footer → auto-adds empty scalar |
| Delete field | × button on hover (CSS opacity) |
| Rename mapping key | Click key name, inline edit (same as existing `FieldRow`) |
| Depth limit guard | "+" only offers scalar types at depth 2; readOnly nodes hide all controls |

---

## 6. Depth Handling

### 6.1 Computation

Done entirely on the Webview side from the received `fields`. No extra Host round-trip.

### 6.2 At Depth ≤ 3

Normal editing — all controls available. Scalar/sequence/mapping addition allowed at depth 0–1; only scalar at depth 2.

### 6.3 At Depth > 3

Nodes at depth > 3 are marked `readOnly`:
- No "+" buttons
- No × delete buttons
- No inline key rename
- Warning banner: "Some content exceeds 3 levels of nesting and is displayed read-only"

---

## 7. Search Integration

`Searcher.search()` recurses into nested values using a stack traversal. Match results include `.`-delimited field names for nested content (e.g. `metadata.author` → match shown under that field path). The `SearchTreeNode` structure is unchanged.

---

## 8. Migration Plan

### Phase 1: Types + Path Utilities
- Add `YamlNode`, `YamlNodeType` to `src/types.ts` and `src/webview/bridge.ts`
- Add path-based message types to bridge
- Create `src/core/path.ts` with `getIn`, `setIn`, `unsetIn`

### Phase 2: Host-Side Path Operations
- Add `applyNestedUpdate`, `applyNestedAdd`, `applyNestedDelete`, `applyNestedRename` to `SyncManager`
- Add corresponding message handlers in `FrontMatterViewProvider`
- Extend `Searcher` for recursive value traversal

### Phase 3: Webview Tree Components
- Create `YamlTreeView`, `AccordionSection`, `ScalarField`, `SequenceItem`, `AddNodeButton`
- Add `fieldsToTree` conversion in `useFrontMatter`
- Conditional rendering in `App.tsx` (flat vs tree based on content)
- Keep existing flat UI fully intact

### Phase 4: Polish
- Read-only warning banner for depth > 3
- Accordion keyboard navigation and focus management

---

## 9. Files Changed / Created

| File | Change |
|------|--------|
| `src/types.ts` | Add `YamlNode`, `YamlNodeType`, path-based message types |
| `src/webview/bridge.ts` | Sync webview types with host |
| `src/core/path.ts` | **NEW** — `getIn`, `setIn`, `unsetIn` |
| `src/core/parser.ts` | No changes needed |
| `src/core/sync.ts` | Add 4 nested mutation methods |
| `src/core/searcher.ts` | Recursive value search |
| `src/providers/FrontMatterViewProvider.ts` | 4 new message handlers |
| `src/webview/hooks/useFrontMatter.ts` | Tree state, path-based callbacks, `fieldsToTree` |
| `src/webview/App.tsx` | Conditional tree vs flat rendering |
| `src/webview/components/YamlTreeView.tsx` | **NEW** |
| `src/webview/components/AccordionSection.tsx` | **NEW** |
| `src/webview/components/ScalarField.tsx` | **NEW** |
| `src/webview/components/SequenceItem.tsx` | **NEW** |
| `src/webview/components/AddNodeButton.tsx` | **NEW** |

---

## 10. Verification

1. **Build**: `npm run compile && npm run build:webview`
2. **Flat front matter** (`title: "Hello"`, `draft: false`):
   - Renders as inline scalars with the existing flat UI
   - "+" bar still works exactly as before
3. **Nested front matter** (`metadata: { author: "John", tags: [a, b] }`):
   - `metadata` becomes an accordion section
   - Expanded → `author` (scalar) and `tags` (sequence) visible
4. **Add a mapping**: click "+" at root → select "Object" → accordion appears → add scalar child inside
5. **Add a sequence**: add a List → renders with "+ Add item" → items are scalar entries
6. **Multi-line auto-detect**: paste text with `\n` → textarea, single-line → input
7. **Depth limit**: open a doc at depth 3 → add button only offers scalar; depth 4 → read-only
8. **Search**: search for a nested value → appears with `.`-delimited path in results
9. **Regression**: flat documents unchanged
