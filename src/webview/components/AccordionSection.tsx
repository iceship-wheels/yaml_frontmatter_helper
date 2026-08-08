import React, { useState } from 'react';
import type { YamlNode, YamlNodeType } from '../bridge';
import ScalarField from './ScalarField';
import SequenceItem from './SequenceItem';
import AddNodeButton from './AddNodeButton';

const styles: Record<string, React.CSSProperties> = {
  section: {
    marginBottom: '4px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 2px',
    cursor: 'pointer',
    borderRadius: '3px',
    userSelect: 'none' as const,
  },
  chevron: {
    fontSize: '10px',
    width: '12px',
    textAlign: 'center' as const,
    color: 'var(--vscode-descriptionForeground)',
  },
  key: {
    fontWeight: 600,
    fontSize: '12px',
    color: 'var(--vscode-symbolIcon-variableForeground)',
  },
  badge: {
    fontSize: '10px',
    padding: '0 4px',
    borderRadius: '3px',
    backgroundColor: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)',
    lineHeight: '16px',
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
    marginLeft: 'auto',
  },
  content: {
    paddingLeft: '12px',
    borderLeft: '1px solid var(--vscode-sideBarSectionHeader-border)',
  },
  footer: {
    marginLeft: '12px',
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
  readOnly,
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
  const badge = isMapping ? `{${childCount}}` : `[${childCount}]`;

  const childReadOnly = readOnly || depth >= 2;

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

  // For sequence add, we auto-generate an index-based key
  const handleSequenceAdd = () => {
    const nextIndex = node.children.length;
    onAdd(path, String(nextIndex), 'scalar');
  };

  return (
    <div style={styles.section}>
      <div
        style={styles.header}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHeaderHover(true)}
        onMouseLeave={() => setHeaderHover(false)}
      >
        <span style={styles.chevron}>{expanded ? '▼' : '▶'}</span>
        {editingKey ? (
          <input
            style={{
              ...styles.key,
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
            style={styles.key}
            onClick={(e) => {
              e.stopPropagation();
              if (!readOnly) setEditingKey(true);
            }}
          >
            {node.key}
          </span>
        )}
        <span style={styles.badge}>{badge}</span>
        {!readOnly && (
          <button
            style={{ ...styles.deleteBtn, opacity: headerHover ? 1 : 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(path);
            }}
            title={`Delete ${node.key}`}
          >
            ×
          </button>
        )}
      </div>

      {expanded && (
        <>
          <div style={styles.content}>
            {isMapping &&
              node.children.map((child) =>
                child.type === 'scalar' ? (
                  <ScalarField
                    key={child.key}
                    node={child}
                    path={path ? `${path}.${child.key}` : child.key}
                    readOnly={readOnly}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                ) : (
                  <AccordionSection
                    key={child.key}
                    node={child}
                    path={path ? `${path}.${child.key}` : child.key}
                    depth={depth + 1}
                    readOnly={childReadOnly}
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
                  readOnly={readOnly}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onAdd={onAdd}
                  onRename={onRename}
                />
              ))}
          </div>

          <div style={styles.footer}>
            {isMapping ? (
              <AddNodeButton
                path={path}
                existingKeys={existingKeys}
                depth={depth + 1}
                readOnly={childReadOnly}
                onAdd={onAdd}
              />
            ) : (
              !readOnly && (
                <div
                  style={{
                    marginTop: '6px',
                    paddingTop: '6px',
                    borderTop: '1px dashed var(--vscode-sideBarSectionHeader-border)',
                  }}
                >
                  <button
                    style={{
                      width: '100%',
                      padding: '4px 0',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--vscode-button-secondaryForeground)',
                      backgroundColor: 'var(--vscode-button-secondaryBackground)',
                      border: '1px solid var(--vscode-button-secondaryBackground)',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      textAlign: 'center' as const,
                    }}
                    onClick={handleSequenceAdd}
                    title="Add item"
                  >
                    +
                  </button>
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AccordionSection;
