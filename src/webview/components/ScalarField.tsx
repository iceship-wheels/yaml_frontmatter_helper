import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { YamlNode } from '../bridge';

const CHEVRON_SLOT = 16; // px — fixed slot, matches AccordionSection header spacer

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
    padding: '2px 4px',
    borderRadius: '3px',
    minHeight: '26px',
  },
  // Empty spacer on the left — same width as AccordionSection's chevron spacer
  chevronSpacer: {
    width: CHEVRON_SLOT,
    minWidth: CHEVRON_SLOT,
    flexShrink: 0,
  },
  key: {
    minWidth: '80px',
    padding: '2px 0',
    fontWeight: 600,
    fontSize: '12px',
    color: 'var(--vscode-symbolIcon-variableForeground)',
    lineHeight: '22px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    cursor: 'pointer',
    border: '1px solid transparent',
    borderRadius: '2px',
  },
  keyInput: {
    minWidth: '80px',
    padding: '2px 4px',
    fontWeight: 600,
    fontSize: '12px',
    color: 'var(--vscode-input-foreground)',
    backgroundColor: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '2px',
    outline: 'none',
    lineHeight: '22px',
    fontFamily: 'var(--vscode-font-family)',
    flexShrink: 0,
  },
  editor: {
    flex: 1,
    minWidth: 0,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '2px 4px',
    fontSize: '12px',
    fontFamily: 'var(--vscode-font-family)',
    color: 'var(--vscode-input-foreground)',
    backgroundColor: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '2px',
    outline: 'none',
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '2px 4px',
    fontSize: '12px',
    fontFamily: 'var(--vscode-editor-font-family, var(--vscode-font-family))',
    color: 'var(--vscode-input-foreground)',
    backgroundColor: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '2px',
    outline: 'none',
    resize: 'vertical' as const,
    rows: 3,
  },
  deleteBtn: {
    border: 'none',
    background: 'none',
    color: 'var(--vscode-errorForeground)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 4px',
    lineHeight: '22px',
    opacity: 0,
    transition: 'opacity 0.1s',
    flexShrink: 0,
  },
};

interface Props {
  node: YamlNode;
  path: string;
  readOnly: boolean;
  /** When true, the key label is hidden. Used inside SequenceItem where #N serves as the label. */
  hideKey?: boolean;
  onUpdate: (path: string, value: unknown) => void;
  onDelete: (path: string) => void;
  /** Callback to rename this field's key. If omitted, key editing is disabled. */
  onRename?: (path: string, newKey: string) => void;
}

const ScalarField: React.FC<Props> = ({ node, path, readOnly, hideKey, onUpdate, onDelete, onRename }) => {
  const strValue = node.value === null || node.value === undefined ? '' : String(node.value);
  const isMultiLine = strValue.includes('\n');
  const [localValue, setLocalValue] = useState(strValue);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [keyValue, setKeyValue] = useState(node.key);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(String(node.value === null || node.value === undefined ? '' : node.value));
  }, [node.value]);

  useEffect(() => {
    setKeyValue(node.key);
  }, [node.key]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdate(path, newValue);
      }, 100);
    },
    [path, onUpdate]
  );

  const handleKeySubmit = () => {
    const trimmed = keyValue.trim();
    if (trimmed && trimmed !== node.key && onRename) {
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

  const rowBg = hover
    ? 'var(--vscode-list-hoverBackground)'
    : 'transparent';

  const keyColor = focused
    ? 'var(--vscode-input-foreground)'
    : 'var(--vscode-symbolIcon-variableForeground)';

  return (
    <div
      style={{ ...styles.row, background: rowBg }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Empty spacer — same width as parent's chevron slot */}
      <div style={styles.chevronSpacer} />

      {!hideKey && (
        editingKey ? (
          <input
            style={styles.keyInput}
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            onBlur={handleKeySubmit}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <span
            style={{ ...styles.key, color: keyColor }}
            title={node.key}
            onClick={() => {
              if (!readOnly && onRename) setEditingKey(true);
            }}
          >
            {node.key}
          </span>
        )
      )}
      <div style={styles.editor}>
        {isMultiLine ? (
          <textarea
            style={styles.textarea}
            value={localValue}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            rows={Math.min(strValue.split('\n').length + 1, 8)}
            readOnly={readOnly}
          />
        ) : (
          <input
            type="text"
            style={styles.input}
            value={localValue}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            readOnly={readOnly}
          />
        )}
      </div>
      {!readOnly && (
        <button
          style={{ ...styles.deleteBtn, opacity: hover ? 1 : 0 }}
          onClick={() => onDelete(path)}
          title={`Delete ${node.key}`}
        >
          ×
        </button>
      )}
    </div>
  );
};

export default ScalarField;
