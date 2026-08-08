import React from 'react';
import type { YamlNode, YamlNodeType } from '../bridge';
import ScalarField from './ScalarField';
import AccordionSection from './AccordionSection';
import AddNodeButton from './AddNodeButton';
import { fieldsToTree, maxDepth } from '../hooks/useFrontMatter';

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '4px 0',
  },
  warning: {
    padding: '8px',
    marginBottom: '8px',
    backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
    border: '1px solid var(--vscode-inputValidation-warningBorder)',
    color: 'var(--vscode-inputValidation-warningForeground)',
    fontSize: '12px',
    borderRadius: '3px',
  },
};

interface Props {
  rawFields: Record<string, unknown>;
  onUpdate: (path: string, value: unknown) => void;
  onAdd: (path: string, key: string, nodeType: YamlNodeType) => void;
  onDelete: (path: string) => void;
  onRename: (path: string, newKey: string) => void;
}

const YamlTreeView: React.FC<Props> = ({
  rawFields,
  onUpdate,
  onAdd,
  onDelete,
  onRename,
}) => {
  const depth = maxDepth(rawFields);
  const readOnly = depth > 3;
  const nodes = fieldsToTree(rawFields);

  const existingKeys = nodes.map((n) => n.key);

  return (
    <div style={styles.container}>
      {readOnly && (
        <div style={styles.warning}>
          This document has content deeper than 3 levels. Nested content beyond depth 3 is displayed read-only.
        </div>
      )}

      {nodes.map((node) =>
        node.type === 'scalar' ? (
          <ScalarField
            key={node.key}
            node={node}
            path={node.key}
            readOnly={readOnly}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ) : (
          <AccordionSection
            key={node.key}
            node={node}
            path={node.key}
            depth={0}
            readOnly={readOnly}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onAdd={onAdd}
            onRename={onRename}
          />
        )
      )}

      <AddNodeButton
        path=""
        existingKeys={existingKeys}
        depth={0}
        readOnly={readOnly}
        onAdd={onAdd}
      />
    </div>
  );
};

export default YamlTreeView;
