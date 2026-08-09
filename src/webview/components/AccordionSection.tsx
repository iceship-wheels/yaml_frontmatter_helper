import React, { useState } from 'react';
import type { YamlNode, YamlNodeType } from '../bridge';
import ScalarField from './ScalarField';
import SequenceItem from './SequenceItem';
import AddNodeButton from './AddNodeButton';

// Depth-color mapping: each depth gets a distinct left border + tinted background.
// depth 0 (first level of nesting) = blue, depth 1 = green, depth 2 = yellow
const DEPTH_COLORS: Record<number, { borderVar: string; bgVar: string }> = {
  0: { borderVar: 'var(--vscode-textLink-foreground)', bgVar: 'var(--vscode-textLink-foreground)' },
  1: { borderVar: 'var(--vscode-charts-green)', bgVar: 'var(--vscode-charts-green)' },
  2: { borderVar: 'var(--vscode-charts-yellow)', bgVar: 'var(--vscode-charts-yellow)' },
};

// Type label: "Node" for mapping only; sequence gets nothing
function typeLabel(nodeType: YamlNodeType): string {
  if (nodeType === 'mapping') return 'Node';
  return '';
}

const CHEVRON_WIDTH = 16; // px — fixed slot, shared with ScalarField

function depthAwareStyles(depth: number): Record<string, React.CSSProperties> {
  const c = DEPTH_COLORS[depth] ?? DEPTH_COLORS[2];

  const borderColor = c.borderVar;
  const bgTint = `color-mix(in srgb, ${c.bgVar} 4%, transparent)`;
  const headerBgTint = `color-mix(in srgb, ${c.bgVar} 8%, transparent)`;

  return {
    container: {
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: '4px',
      overflow: 'hidden',
      marginBottom: '6px',
      background: bgTint,
    },
    header: {
      display: 'flex',
      alignItems: 'center' as const,
      gap: '4px',
      padding: '2px 6px',
      minHeight: '26px',
      cursor: 'pointer' as const,
      userSelect: 'none' as const,
      boxSizing: 'border-box' as const,
      background: headerBgTint,
    },
    headerExpanded: {
      borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)',
    },
  };
}

const baseStyles: Record<string, React.CSSProperties> = {
  // Empty spacer on the left — same width as ScalarField's chevron slot for alignment
  chevronSpacer: {
    width: CHEVRON_WIDTH,
    minWidth: CHEVRON_WIDTH,
    flexShrink: 0,
  },
  key: {
    fontWeight: 600,
    fontSize: '12px',
    color: 'var(--vscode-symbolIcon-variableForeground)',
    flexShrink: 0,
  },
  typeLabel: {
    fontSize: '10px',
    fontWeight: 500,
    color: '#ffffff',
    background: 'var(--vscode-badge-background)',
    borderRadius: '3px',
    padding: '0 4px',
    lineHeight: '16px',
    flexShrink: 0,
  },
  badge: {
    fontSize: '10px',
    padding: '0 4px',
    borderRadius: '3px',
    backgroundColor: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)',
    lineHeight: '16px',
    flexShrink: 0,
  },
  deleteBtn: {
    border: 'none',
    background: 'none',
    color: 'var(--vscode-errorForeground)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '0 4px',
    lineHeight: '22px',
    opacity: 0,
    transition: 'opacity 0.1s',
    flexShrink: 0,
  },
  // Chevron on the right side
  chevron: {
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground)',
    flexShrink: 0,
    marginLeft: 'auto',
  },
  content: {
    padding: '6px 6px 6px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  footer: {
    padding: '0 6px 6px 16px',
  },
};

interface Props {
  node: YamlNode;
  path: string;
  depth: number;
  readOnly: boolean;
  onUpdate: (path: string, value: unknown) => void;
  onDelete: (path: string) => void;
  onAdd: (path: string, key: string, nodeType: YamlNodeType) => void;
  onRename: (path: string, newKey: string) => void;
}

const AccordionSection: React.FC<Props> = ({
  node,
  path,
  depth,
  readOnly: _readOnly,
  onUpdate,
  onDelete,
  onAdd,
  onRename,
}) => {
  const defaultExpanded = depth <= 1;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [headerHover, setHeaderHover] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [keyValue, setKeyValue] = useState(node.key);

  const isMapping = node.type === 'mapping';
  const isSequence = node.type === 'sequence';
  const childCount = node.children.length;

  const handleKeySubmit = () => {
    const trimmed = keyValue.trim();
    if (trimmed && trimmed !== node.key) {
      onRename(path, trimmed);
    } else {
      setKeyValue(node.key);
    }
    setEditingKey(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleKeySubmit();
    } else if (e.key === 'Escape') {
      setKeyValue(node.key);
      setEditingKey(false);
    }
  };

  const existingKeys = node.children.map((c) => c.key);

  const handleSequenceAdd = () => {
    const nextIndex = node.children.length;
    onAdd(path, String(nextIndex), 'scalar');
  };

  const depthStyles = depthAwareStyles(depth);

  const renderHeader = () => (
    <div
      style={{
        ...depthStyles.header,
        ...(expanded ? depthStyles.headerExpanded : {}),
      }}
      onClick={() => setExpanded(!expanded)}
      onMouseEnter={() => setHeaderHover(true)}
      onMouseLeave={() => setHeaderHover(false)}
    >
      {/* Empty spacer for alignment with child rows */}
      <div style={baseStyles.chevronSpacer} />

      {editingKey ? (
        <input
          style={{
            ...baseStyles.key,
            backgroundColor: 'var(--vscode-input-background)',
            border: '1px solid var(--vscode-input-border)',
            borderRadius: '2px',
            outline: 'none',
            fontSize: '12px',
            padding: '0 4px',
            width: '120px',
          }}
          value={keyValue}
          onChange={(e) => setKeyValue(e.target.value)}
          onBlur={handleKeySubmit}
          onKeyDown={handleKeyDown}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          style={baseStyles.key}
          onClick={(e) => {
            e.stopPropagation();
            setEditingKey(true);
          }}
        >
          {node.key}
        </span>
      )}

      {/* Type label: "Node" or "List" */}
      <span style={baseStyles.typeLabel}>{typeLabel(node.type)}</span>
      {/* Badge: child count */}
      <span style={baseStyles.badge}>{childCount}</span>

      {/* Chevron on the right side */}
      <span style={baseStyles.chevron}>{expanded ? '▼' : '▶'}</span>

      <button
        style={{ ...baseStyles.deleteBtn, opacity: headerHover ? 1 : 0 }}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(path);
        }}
        title={`Delete ${node.key}`}
      >
        ×
      </button>
    </div>
  );

  const renderContent = () => (
    <div style={baseStyles.content}>
      {isMapping &&
        node.children.map((child) =>
          child.type === 'scalar' ? (
            <ScalarField
              key={child.key}
              node={child}
              path={path ? `${path}.${child.key}` : child.key}
              readOnly={false}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onRename={onRename}
            />
          ) : (
            <AccordionSection
              key={child.key}
              node={child}
              path={path ? `${path}.${child.key}` : child.key}
              depth={depth + 1}
              readOnly={false}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAdd={onAdd}
              onRename={onRename}
            />
          )
        )}

      {isSequence &&
        node.children.map((child, i) => (
          <SequenceItem
            key={`${child.key}-${i}`}
            node={child}
            path={path}
            index={i}
            sequenceValue={node.value as unknown[]}
            readOnly={false}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onAdd={onAdd}
            onRename={onRename}
          />
        ))}
    </div>
  );

  const renderFooter = () => (
    <div style={baseStyles.footer}>
      {isMapping ? (
        <AddNodeButton
          path={path}
          existingKeys={existingKeys}
          depth={depth + 1}
          readOnly={false}
          onAdd={onAdd}
        />
      ) : (
        <div
          style={{
            marginTop: '6px',
            paddingTop: '6px',
            borderTop: '1px dashed var(--vscode-sideBarSectionHeader-border)',
          }}
        >
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              height: '28px',
              padding: '0 8px',
              fontSize: '12px',
              fontFamily: 'var(--vscode-font-family)',
              fontWeight: 400,
              color: 'var(--vscode-descriptionForeground)',
              backgroundColor: 'transparent',
              border: '1px dashed var(--vscode-sideBarSectionHeader-border)',
              borderRadius: '4px',
              cursor: 'pointer',
              boxSizing: 'border-box',
              textAlign: 'left' as const,
            }}
            onClick={handleSequenceAdd}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderStyle = 'solid';
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderStyle = 'dashed';
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
            title="Add item"
          >
            <span>+ Add item</span>
            <span style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', opacity: 0.7 }}>+</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={depthStyles.container}>
      {renderHeader()}
      {expanded && (
        <>
          {renderContent()}
          {renderFooter()}
        </>
      )}
    </div>
  );
};

export default AccordionSection;
