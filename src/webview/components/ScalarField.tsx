import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { YamlNode } from '../bridge';

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '4px',
    gap: '6px',
  },
  key: {
    minWidth: '80px',
    padding: '2px 4px',
    fontWeight: 600,
    fontSize: '12px',
    color: 'var(--vscode-symbolIcon-variableForeground)',
    lineHeight: '22px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  editor: {
    flex: 1,
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
  },
  rowHover: {} as React.CSSProperties,
};

interface Props {
  node: YamlNode;
  path: string;
  readOnly: boolean;
  onUpdate: (path: string, value: unknown) => void;
  onDelete: (path: string) => void;
}

const ScalarField: React.FC<Props> = ({ node, path, readOnly, onUpdate, onDelete }) => {
  const strValue = node.value === null || node.value === undefined ? '' : String(node.value);
  const isMultiLine = strValue.includes('\n');
  const [localValue, setLocalValue] = useState(strValue);
  const [hover, setHover] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(String(node.value === null || node.value === undefined ? '' : node.value));
  }, [node.value]);

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

  return (
    <div
      style={{ ...styles.row }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={styles.key} title={node.key}>
        {node.key}
      </span>
      <div style={styles.editor}>
        {isMultiLine ? (
          <textarea
            style={styles.textarea}
            value={localValue}
            onChange={handleChange}
            rows={Math.min(strValue.split('\n').length + 1, 8)}
            readOnly={readOnly}
          />
        ) : (
          <input
            type="text"
            style={styles.input}
            value={localValue}
            onChange={handleChange}
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
