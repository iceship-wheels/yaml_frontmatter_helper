import React from 'react';
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
}

const FieldRow: React.FC<Props> = ({ field, onUpdate, onDelete }) => {
  return (
    <div style={styles.row}>
      <span style={styles.key} title={field.key}>
        {field.key}
      </span>
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
