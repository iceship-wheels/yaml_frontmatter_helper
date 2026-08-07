import React, { useState } from 'react';
import type { FieldSchema } from '../bridge';

type FieldType = FieldSchema['type'];

interface TypeOption {
  label: string;
  type: FieldType;
  defaultValue: unknown;
}

const TYPE_OPTIONS: TypeOption[] = [
  { label: 'Text', type: 'string', defaultValue: '' },
  { label: 'Number', type: 'number', defaultValue: '' },
  { label: 'Boolean', type: 'boolean', defaultValue: false },
  { label: 'Date', type: 'date', defaultValue: '' },
  { label: 'List', type: 'array', defaultValue: [] },
  { label: 'Empty (null)', type: 'null', defaultValue: null },
];

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid var(--vscode-sideBarSectionHeader-border)',
  },
  addBtn: {
    width: '100%',
    padding: '10px 0',
    fontSize: '20px',
    fontWeight: 600,
    lineHeight: '20px',
    color: 'var(--vscode-button-secondaryForeground)',
    backgroundColor: 'var(--vscode-button-secondaryBackground)',
    border: '1px solid var(--vscode-button-secondaryBackground)',
    borderRadius: '3px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'background-color 0.15s',
  },
  select: {
    width: '100%',
    padding: '8px 6px',
    fontSize: '13px',
    fontFamily: 'var(--vscode-font-family)',
    color: 'var(--vscode-input-foreground)',
    backgroundColor: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '2px',
    outline: 'none',
  },
};

interface Props {
  existingKeys: string[];
  onAdd: (field: string, value: unknown, type: FieldType) => void;
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

const AddField: React.FC<Props> = ({ existingKeys, onAdd }) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__cancel__') {
      setOpen(false);
      return;
    }
    const type = value as FieldType;
    const option = TYPE_OPTIONS.find((o) => o.type === type);
    if (!option) {
      setOpen(false);
      return;
    }
    const key = generateUniqueKey(existingKeys);
    onAdd(key, option.defaultValue, option.type);
    setOpen(false);
  };

  return (
    <div style={styles.container}>
      {!open ? (
        <button
          style={styles.addBtn}
          onClick={() => setOpen(true)}
          title="Add a field"
        >
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
          {TYPE_OPTIONS.map((o) => (
            <option key={o.type} value={o.type}>
              {o.label}
            </option>
          ))}
          <option value="__cancel__">Cancel</option>
        </select>
      )}
    </div>
  );
};

export default AddField;
