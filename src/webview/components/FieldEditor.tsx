import React, { useState, useCallback } from 'react';
import type { FieldSchema } from '../bridge';

const styles: Record<string, React.CSSProperties> = {
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
  checkbox: {
    margin: 0,
    cursor: 'pointer',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  tagContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '3px',
    alignItems: 'center',
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    padding: '1px 5px',
    fontSize: '11px',
    backgroundColor: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)',
    borderRadius: '3px',
  },
  tagRemove: {
    border: 'none',
    background: 'none',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '10px',
    padding: '0 2px',
    lineHeight: 1,
  },
  tagInput: {
    border: 'none',
    background: 'none',
    color: 'var(--vscode-input-foreground)',
    fontSize: '11px',
    fontFamily: 'inherit',
    outline: 'none',
    minWidth: '40px',
    flex: 1,
  },
};

interface Props {
  field: FieldSchema;
  onChange: (value: unknown) => void;
}

const FieldEditor: React.FC<Props> = ({ field, onChange }) => {
  if (field.type === 'boolean') {
    return (
      <label style={styles.checkboxLabel}>
        <input
          type="checkbox"
          style={styles.checkbox}
          checked={!!field.value}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{field.value ? 'true' : 'false'}</span>
      </label>
    );
  }

  if (field.type === 'array') {
    return <TagEditor value={field.value as string[]} onChange={onChange} />;
  }

  const strValue = field.value === null || field.value === undefined
    ? ''
    : String(field.value);

  return (
    <input
      type="text"
      style={styles.input}
      value={strValue}
      onChange={(e) => {
        const raw = e.target.value;
        if (field.type === 'number') {
          const num = Number(raw);
          onChange(isNaN(num) ? raw : num);
        } else {
          onChange(raw);
        }
      }}
    />
  );
};

const TagEditor: React.FC<{
  value: string[];
  onChange: (value: string[]) => void;
}> = ({ value, onChange }) => {
  const [inputValue, setInputValue] = useState('');

  const tags = Array.isArray(value) ? value : [];

  const removeTag = useCallback(
    (idx: number) => {
      const next = tags.filter((_, i) => i !== idx);
      onChange(next);
    },
    [tags, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && inputValue.trim()) {
        onChange([...tags, inputValue.trim()]);
        setInputValue('');
        e.preventDefault();
      } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
        removeTag(tags.length - 1);
      }
    },
    [inputValue, tags, onChange, removeTag]
  );

  return (
    <div style={styles.tagContainer}>
      {tags.map((tag, i) => (
        <span key={i} style={styles.tag}>
          {tag}
          <button
            style={styles.tagRemove}
            onClick={() => removeTag(i)}
          >
            x
          </button>
        </span>
      ))}
      <input
        style={styles.tagInput}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? 'Add tag...' : ''}
      />
    </div>
  );
};

export default FieldEditor;
