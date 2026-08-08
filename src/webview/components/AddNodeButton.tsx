import React, { useState } from 'react';
import type { YamlNodeType } from '../bridge';

interface TypeOption {
  label: string;
  nodeType: YamlNodeType;
}

interface Props {
  path: string;
  existingKeys: string[];
  depth: number;
  readOnly: boolean;
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
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px dashed var(--vscode-sideBarSectionHeader-border)',
  },
  addBtn: {
    width: '100%',
    padding: '6px 0',
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: '18px',
    color: 'var(--vscode-button-secondaryForeground)',
    backgroundColor: 'var(--vscode-button-secondaryBackground)',
    border: '1px solid var(--vscode-button-secondaryBackground)',
    borderRadius: '3px',
    cursor: 'pointer',
    textAlign: 'center' as const,
  },
  select: {
    width: '100%',
    padding: '6px',
    fontSize: '12px',
    fontFamily: 'var(--vscode-font-family)',
    color: 'var(--vscode-input-foreground)',
    backgroundColor: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '2px',
    outline: 'none',
  },
};

const AddNodeButton: React.FC<Props> = ({ path, existingKeys, depth, readOnly, onAdd }) => {
  const [open, setOpen] = useState(false);

  if (readOnly) return null;

  const options: TypeOption[] =
    depth <= 1
      ? [
          { label: 'Text', nodeType: 'scalar' },
          { label: 'List', nodeType: 'sequence' },
          { label: 'Object', nodeType: 'mapping' },
        ]
      : [
          { label: 'Text', nodeType: 'scalar' },
          { label: 'List', nodeType: 'sequence' },
        ];

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__cancel__') {
      setOpen(false);
      return;
    }
    const option = options.find((o) => o.nodeType === value);
    if (!option) {
      setOpen(false);
      return;
    }
    const key = generateUniqueKey(existingKeys);
    onAdd(path, key, option.nodeType);
    setOpen(false);
  };

  return (
    <div style={styles.container}>
      {!open ? (
        <button style={styles.addBtn} onClick={() => setOpen(true)} title="Add a field">
          +
        </button>
      ) : (
        <select
          style={styles.select}
          value=""
          onChange={handleSelect}
          onBlur={() => setOpen(false)}
          autoFocus
        >
          <option value="" disabled>
            Select field type…
          </option>
          {options.map((o) => (
            <option key={o.nodeType} value={o.nodeType}>
              {o.label}
            </option>
          ))}
          <option value="__cancel__">Cancel</option>
        </select>
      )}
    </div>
  );
};

export default AddNodeButton;
