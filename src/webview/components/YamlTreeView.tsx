import React from 'react';
import type { YamlNode, YamlNodeType } from '../bridge';
import ScalarField from './ScalarField';
import AccordionSection from './AccordionSection';
import AddNodeButton from './AddNodeButton';
import { fieldsToTree } from '../hooks/useFrontMatter';

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '4px 0',
  },
};

interface Props {
  rawFields: Record<string, unknown>;
  maxDepth: number;
  onUpdate: (path: string, value: unknown) => void;
  onAdd: (path: string, key: string, nodeType: YamlNodeType) => void;
  onDelete: (path: string) => void;
  onRename: (path: string, newKey: string) => void;
}

const YamlTreeView: React.FC<Props> = ({
  rawFields,
  maxDepth,
  onUpdate,
  onAdd,
  onDelete,
  onRename,
}) => {
  // fieldsToTree marks containers at depth >= maxDepth as `hidden` and scalars as `readOnly`.
  const nodes = fieldsToTree(rawFields, maxDepth);
  const existingKeys = nodes.map((n) => n.key);

  return (
    <div style={styles.container}>
      {nodes.map((node) =>
        node.type === 'scalar' ? (
          <ScalarField
            key={node.key}
            node={node}
            path={node.key}
            readOnly={!!node.meta.readOnly}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onRename={onRename}
          />
        ) : (
          <AccordionSection
            key={node.key}
            node={node}
            path={node.key}
            depth={0}
            maxDepth={maxDepth}
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
        maxDepth={maxDepth}
        onAdd={onAdd}
      />
    </div>
  );
};

export default YamlTreeView;
