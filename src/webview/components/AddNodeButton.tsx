import React, { useState, useEffect, useRef } from 'react';
import type { YamlNodeType } from '../bridge';

interface TypeOption {
  label: string;
  nodeType: YamlNodeType;
}

interface Props {
  path: string;
  existingKeys: string[];
  depth: number;
  maxDepth: number;
  onAdd: (path: string, key: string, nodeType: YamlNodeType) => void;
}

function generateUniqueKey(existingKeys: string[]): string {
  const base = 'field';
  let i = 1;
  let key = base;
  while (existingKeys.includes(key)) {
    i++;
    key = `${base}${i}`;
  }
  return key;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '6px',
  },
  addBtn: {
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
  },
  pillRow: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    height: '28px',
  },
  pill: {
    padding: '2px 10px',
    fontSize: '11px',
    fontFamily: 'var(--vscode-font-family)',
    fontWeight: 500,
    color: 'var(--vscode-button-secondaryForeground)',
    backgroundColor: 'var(--vscode-button-secondaryBackground)',
    border: '1px solid var(--vscode-button-secondaryBackground)',
    borderRadius: '12px',
    cursor: 'pointer',
    lineHeight: '18px',
  },
  cancelPill: {
    padding: '2px 10px',
    fontSize: '11px',
    fontFamily: 'var(--vscode-font-family)',
    fontWeight: 400,
    color: 'var(--vscode-descriptionForeground)',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: '12px',
    cursor: 'pointer',
    lineHeight: '18px',
  },
  chevron: {
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground)',
    opacity: 0.7,
  },
};

const AddNodeButton: React.FC<Props> = ({ path, existingKeys, depth, maxDepth, onAdd }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  if (depth >= maxDepth) return null;

  // At `depth < maxDepth - 1` a new child can still become a container.
  // At `depth === maxDepth - 1` children may only be scalars or sequences of scalars.
  const options: TypeOption[] =
    depth < maxDepth - 1
      ? [
          { label: 'Text', nodeType: 'scalar' },
          { label: 'List', nodeType: 'sequence' },
          { label: 'Object', nodeType: 'mapping' },
        ]
      : [
          { label: 'Text', nodeType: 'scalar' },
          { label: 'List', nodeType: 'sequence' },
        ];

  // Close pill row on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Use mousedown (before click) to catch outside clicks
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (nodeType: YamlNodeType) => {
    const key = generateUniqueKey(existingKeys);
    onAdd(path, key, nodeType);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, nodeType: YamlNodeType) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(nodeType);
    }
  };

  return (
    <div style={styles.container} ref={containerRef}>
      {!open ? (
        <button
          style={styles.addBtn}
          onClick={() => setOpen(true)}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderStyle = 'solid';
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderStyle = 'dashed';
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
          title="Add a field"
        >
          <span>+ Add field</span>
          <span style={styles.chevron}>▼</span>
        </button>
      ) : (
        <div style={styles.pillRow}>
          {options.map((o) => (
            <button
              key={o.nodeType}
              style={styles.pill}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelect(o.nodeType);
              }}
              onKeyDown={(e) => handleKeyDown(e, o.nodeType)}
              autoFocus={o === options[0]}
            >
              {o.label}
            </button>
          ))}
          <button
            style={styles.cancelPill}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default AddNodeButton;
