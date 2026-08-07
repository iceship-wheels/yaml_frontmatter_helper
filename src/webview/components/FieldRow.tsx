import React, { useState, useEffect } from 'react';
import FieldEditor from './FieldEditor';
import type { FieldSchema } from '../bridge';

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '6px',
    gap: '6px',
  },
  key: {
    minWidth: '80px',
    padding: '2px 4px',
    fontWeight: 600,
    fontSize: '12px',
    color: 'var(--vscode-symbolIcon-variableForeground)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: '22px',
    border: '1px solid transparent',
    borderRadius: '2px',
  },
  keyInput: {
    minWidth: '80px',
    width: '100px',
    padding: '2px 4px',
    fontWeight: 600,
    fontSize: '12px',
    color: 'var(--vscode-symbolIcon-variableForeground)',
    backgroundColor: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '2px',
    outline: 'none',
    lineHeight: '22px',
    fontFamily: 'var(--vscode-font-family)',
  },
  editor: {
    flex: 1,
  },
  deleteBtn: {
    border: 'none',
    background: 'none',
    color: 'var(--vscode-errorForeground)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 4px',
    lineHeight: '22px',
  },
};

interface Props {
  field: FieldSchema;
  onUpdate: (field: string, value: unknown) => void;
  onDelete: (field: string) => void;
  onRename?: (oldField: string, newField: string) => void;
  autoEditKey?: boolean;
}

const FieldRow: React.FC<Props> = ({ field, onUpdate, onDelete, onRename, autoEditKey }) => {
  const [editingKey, setEditingKey] = useState(false);
  const [keyValue, setKeyValue] = useState(field.key);

  useEffect(() => {
    setKeyValue(field.key);
  }, [field.key]);

  // Auto-start key editing for newly-added fields
  useEffect(() => {
    if (autoEditKey) {
      setEditingKey(true);
    }
  }, [autoEditKey]);

  const commitRename = () => {
    const trimmed = keyValue.trim();
    if (trimmed && trimmed !== field.key && onRename) {
      onRename(field.key, trimmed);
    } else {
      setKeyValue(field.key);
    }
    setEditingKey(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitRename();
    } else if (e.key === 'Escape') {
      setKeyValue(field.key);
      setEditingKey(false);
    }
  };

  return (
    <div style={styles.row}>
      {editingKey ? (
        <input
          style={styles.keyInput}
          value={keyValue}
          onChange={(e) => setKeyValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      ) : (
        <span
          style={styles.key}
          title={field.key}
          onClick={() => setEditingKey(true)}
        >
          {field.key}
        </span>
      )}
      <div style={styles.editor}>
        <FieldEditor
          field={field}
          onChange={(value) => onUpdate(field.key, value)}
        />
      </div>
      <button
        style={styles.deleteBtn}
        onClick={() => onDelete(field.key)}
        title={`Delete ${field.key}`}
      >
        x
      </button>
    </div>
  );
};

export default FieldRow;
