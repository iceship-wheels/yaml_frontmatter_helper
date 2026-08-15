import React, { useState } from 'react';
import type { YamlNode } from '../bridge';
import ScalarField from './ScalarField';
import AccordionSection from './AccordionSection';

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
    padding: '3px 6px',
    minHeight: '28px',
    borderRadius: '3px',
  },
  index: {
    minWidth: '28px',
    padding: '2px 4px',
    fontSize: '11px',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    color: 'var(--vscode-descriptionForeground)',
    lineHeight: '22px',
    textAlign: 'right' as const,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
};

interface Props {
  node: YamlNode;
  path: string;
  index: number;
  sequenceValue: unknown[];
  readOnly: boolean;
  maxDepth: number;
  onUpdate: (path: string, value: unknown) => void;
  onDelete: (path: string) => void;
  onAdd: (path: string, key: string, nodeType: YamlNode['type']) => void;
  onRename: (path: string, newKey: string) => void;
}

const SequenceItem: React.FC<Props> = ({
  node,
  path,
  index,
  sequenceValue,
  readOnly,
  maxDepth,
  onUpdate,
  onDelete,
  onAdd,
  onRename,
}) => {
  const [hover, setHover] = useState(false);

  const isScalar = node.type === 'scalar';

  // Delete a sequence item: filter it from the raw array, send the new array via nestedUpdate
  const handleDelete = () => {
    const filtered = sequenceValue.filter((_, i) => i !== index);
    onUpdate(path, filtered);
  };

  // For updating a scalar item within a sequence, send the whole array with the item replaced
  const handleScalarUpdate = (_childPath: string, value: unknown) => {
    const updated = sequenceValue.map((v, i) => (i === index ? value : v));
    onUpdate(path, updated);
  };

  // Alternating row background for visual separation
  const rowBg = index % 2 === 1
    ? 'var(--vscode-sideBar-background, rgba(128,128,128,0.04))'
    : 'transparent';

  return (
    <div
      style={{
        ...styles.row,
        background: hover
          ? 'var(--vscode-list-hoverBackground)'
          : rowBg,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={styles.index}>#{index}</span>
      <div style={styles.content}>
        {isScalar ? (
          <ScalarField
            node={node}
            path={path}
            readOnly={readOnly}
            hideKey
            onUpdate={handleScalarUpdate}
            onDelete={handleDelete}
          />
        ) : (
          <AccordionSection
            node={{ ...node, key: '' }}
            path={path}
            depth={node.meta.depth}
            maxDepth={maxDepth}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onAdd={onAdd}
            onRename={onRename}
          />
        )}
      </div>
    </div>
  );
};

export default SequenceItem;
