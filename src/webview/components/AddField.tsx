import React, { useState } from 'react';

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '12px',
    borderTop: '1px solid var(--vscode-sideBarSectionHeader-border)',
    paddingTop: '8px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--vscode-descriptionForeground)',
    marginBottom: '4px',
  },
  row: {
    display: 'flex',
    gap: '4px',
  },
  keyInput: {
    width: '100px',
    padding: '2px 4px',
    fontSize: '12px',
    fontFamily: 'var(--vscode-font-family)',
    color: 'var(--vscode-input-foreground)',
    backgroundColor: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '2px',
    outline: 'none',
  },
  valueInput: {
    flex: 1,
    padding: '2px 4px',
    fontSize: '12px',
    fontFamily: 'var(--vscode-font-family)',
    color: 'var(--vscode-input-foreground)',
    backgroundColor: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '2px',
    outline: 'none',
  },
  addBtn: {
    padding: '2px 8px',
    fontSize: '12px',
    fontFamily: 'var(--vscode-font-family)',
    color: 'var(--vscode-button-foreground)',
    backgroundColor: 'var(--vscode-button-background)',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
  },
};

interface Props {
  onAdd: (field: string, value: unknown) => void;
}

const AddField: React.FC<Props> = ({ onAdd }) => {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');

  const handleAdd = () => {
    if (!key.trim()) return;
    onAdd(key.trim(), value.trim() || '');
    setKey('');
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.label}>Add Field</div>
      <div style={styles.row}>
        <input
          type="text"
          style={styles.keyInput}
          placeholder="key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <input
          type="text"
          style={styles.valueInput}
          placeholder="value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button style={styles.addBtn} onClick={handleAdd}>
          +
        </button>
      </div>
    </div>
  );
};

export default AddField;
