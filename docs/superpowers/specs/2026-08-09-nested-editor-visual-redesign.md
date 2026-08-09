# Nested YAML Editor — Visual Redesign Spec

**Date:** 2026-08-09
**Status:** Draft

## Overview

全面重新设计嵌套 YAML 编辑面板的视觉呈现。功能逻辑、数据模型、消息协议全部保持不变，仅修改 webview 组件层的 DOM 结构和 CSS 样式。

## Problems Solved

1. **层次不清** — 当前仅用 `paddingLeft: 12px` + 1px `borderLeft` 表达嵌套关系，不同深度内容在视觉上混合在一起
2. **Add 按钮归属模糊** — `AddNodeButton` 仅用 `marginLeft` 缩进跟随，没有视觉线索标明它在哪一层添加字段
3. **SequenceItem 双重删除** — 系列元素中的子对象出现两个 `×` 删除按钮

## Visual System

### Depth Encoding via Left Border + Container Background

每层 mapping/sequence 包裹在视觉容器中，用左侧色带 + 背景色编码深度：

| Depth | Border Color | Background | Notes |
|-------|-------------|------------|-------|
| root (0) | none | transparent | 不包裹容器，扁平布局，增大字段间距 |
| 1 | Blue (`--vscode-textLink-foreground`) 3px solid | Blue tint (4%) | |
| 2 | Green (`--vscode-charts-green`) 3px solid | Green tint (4%) | |
| 3+ | Purple (`--vscode-charts-purple`) 3px solid | Purple tint (4%) | read-only if `maxDepth > 3` |

> 背景色回退方案：如果 `color-mix()` 在 webview 不支持，使用硬编码 `rgba` + 主题检测。

### Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--fm-radius` | `var(--vscode-panel-border-radius, 4px)` | Container rounding |
| `--fm-gap-xs` | `2px` | Icon spacing |
| `--fm-gap-sm` | `4px` | Inline element gap |
| `--fm-gap-md` | `6px` | Component gap |
| `--fm-gap-lg` | `8px` | Container padding, root field gap |
| `--fm-indent` | `16px` | Per-level indent |
| `--fm-header-h` | `26px` | Header bar height |
| `--fm-border-w` | `3px` | Depth indicator width |

### Typography

| Role | Spec | Element |
|------|------|---------|
| Header key | `12px / 600` | Accordion header key name |
| Badge | `10px / 400` | `{3}` `[5]` type badge |
| Scalar key | `12px / 600` | Field label |
| Scalar value | `12px / 400` | Input text |
| Add button | `12px / 400` | "+ Add field" label |
| Chevron | `10px` | ▼ ▶ toggle arrow |
| Sequence index | `11px / 400 / monospace` | `#0` `#1` numbering |

## Component Changes

### AccordionSection

When `depth >= 1`, the entire section is wrapped in a visual container:

```
╔══ Container (border-radius: 4px, overflow: hidden) ═══════════╗
║  border-left: 3px solid <depth-color>                         ║
║  background: <depth-bg-tint>                                  ║
║                                                               ║
║  ┌── Header ─────────────────────────────────────────────┐    ║
║  │  padding: 2px 6px; min-height: 26px                     │    ║
║  │  bg: <depth-bg-tint + 2% alpha overlay>                │    ║
║  │  border-bottom (expanded): 1px sidebar-border           │    ║
║  │                                                         │    ║
║  │  [▼] [key name] [{3}]                [×]               │    ║
║  │   chev   key^       badge         delete btn             │    ║
║  │        click→rename               hover visible          │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                               ║
║  ┌── Content (expanded only) ─────────────────────────────┐    ║
║  │  padding: 6px 6px 6px 16px                              │    ║
║  │  display: flex; flex-direction: column; gap: 4px       │    ║
║  │                                                         │    ║
║  │  [scalar rows / nested containers / sequence items]    │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                               ║
║  ┌── Footer (expanded only) ──────────────────────────────┐    ║
║  │  padding: 0 6px 6px 16px                                │    ║
║  │  [+ Add field]                                          │    ║
║  └────────────────────────────────────────────────────────┘    ║
╚═══════════════════════════════════════════════════════════════╝
```

- Container itself has NO padding — header/content/footer each set their own
- Left border spans header → content → footer seamlessly
- Header bg: add `rgba(255,255,255,0.06)` overlay in light, `rgba(255,255,255,0.04)` in dark
- Collapsed: header bottom border hidden, container bottom-radius visible
- Expanded: header bottom border visible, footer carries bottom rounding
- Header gets `cursor: pointer` for toggle
- Depth 0 (root level): NO container wrap, sections spaced vertically with `10px`

### AddNodeButton

From: single `+` character button
To: labeled button with inline type chooser

```
Collapsed state:
┌──────────────────────────────────────┐
│  + Add field                      ▼  │
└──────────────────────────────────────┘

Expanded state:
┌──────────────────────────────────────┐
│  [Text] [List] [Object]  [Cancel]    │
└──────────────────────────────────────┘
```

Styles:
- Height: `28px`
- Border: `1px dashed var(--vscode-sideBarSectionHeader-border)`, radius `4px`
- Background: transparent → hover `var(--vscode-toolbar-hoverBackground)`
- Text: `12px / 400`, color `var(--vscode-descriptionForeground)`
- Hover: dashed → solid border
- Expanded: replaces select dropdown with horizontal pill button group
  - `Text` → add scalar
  - `List` → add sequence
  - `Object` → add mapping (hidden when `depth > 1`)
- Positioning: within footer, left-aligned, covered by container's left border

### SequenceItem

Bug fix + visual refresh:

- **Remove outer delete button** (line ~105-113 in current code) — deletion handled by child's internal button
- Index label `#0` → monospace, `min-width: 28px`, right-aligned, `color: var(--vscode-descriptionForeground)`
- Row: `padding: 3px 6px; min-height: 28px; border-radius: 3px`
- Alternating row bg: even index → transparent; odd index → `depth-bg-tint + 2%`
- Sequence Add button: labeled `+ Add item`, adds empty scalar directly (no type selector)

### ScalarField

Subtle refinements, no structural change:

- Row gap: `6px` → `8px`
- Row hover: `background: var(--vscode-list-hoverBackground)`, also shows delete button
- Input focus: label color shifts to `var(--vscode-input-foreground)`
- Delete button: `×` character, hover visible (unchanged behavior)
- Inside sequence: index `#N` replaces key label, rest identical

## Root Level (depth 0) Special Cases

- No container wrapping
- `AccordionSection` vertical gap: `10px`
- `ScalarField` row gap: `8px`
- Root `AddNodeButton` at bottom with border-top separator

## Implementation Notes

### Files Modified

| File | Changes |
|------|---------|
| `src/webview/components/AccordionSection.tsx` | Container wrapper, header redesign, content/footer restructure |
| `src/webview/components/AddNodeButton.tsx` | Labeled button, horizontal pill type chooser |
| `src/webview/components/SequenceItem.tsx` | Remove outer `×`, monospace index, alternating rows |
| `src/webview/components/ScalarField.tsx` | Hover bg, spacing tweaks |

### Files NOT Modified

| File | Reason |
|------|--------|
| `src/webview/App.tsx` | No structural changes |
| `src/webview/hooks/useFrontMatter.ts` | Data model unchanged |
| `src/webview/bridge.ts` | Message protocol unchanged |
| `src/types.ts` | Types unchanged |
| `src/core/*` | Extension host unchanged |
| `docs/superpowers/specs/2026-07-28-nested-yaml-editor-design.md` | Original spec unchanged — this is an addendum |

### Styling Approach

- All styles continue to use inline `React.CSSProperties` objects (matching current codebase convention)
- All colors use VS Code CSS custom properties where possible
- Depth-specific colors are computed in component render, not in a centralized theme file
- No external CSS files or dependencies added

### Backward Compatibility

- No message protocol changes
- No data model changes
- Flat front matter (no nested) still renders via existing `FieldRow` + `AddField` code path, which is untouched
