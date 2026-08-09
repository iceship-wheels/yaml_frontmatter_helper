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
  hiddenNotice: {
    padding: '6px 8px',
    marginBottom: '8px',
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground)',
    fontStyle: 'italic',
  },
};

interface Props {
  rawFields: Record<string, unknown>;
  onUpdate: (path: string, value: unknown) => void;
  onAdd: (path: string, key: string, nodeType: YamlNodeType) => void;
  onDelete: (path: string) => void;
  onRename: (path: string, newKey: string) => void;
}

// Filter out nodes at or beyond maxDepth so they are not rendered at all
function filterByDepth(nodes: YamlNode[], maxDepth: number): YamlNode[] {
  return nodes
    .filter((n) => n.meta.depth < maxDepth)
    .map((n) => ({
      ...n,
      children: n.children.length > 0 ? filterByDepth(n.children, maxDepth) : n.children,
    }));
}

const YamlTreeView: React.FC<Props> = ({
  rawFields,
  onUpdate,
  onAdd,
  onDelete,
  onRename,
}) => {
  const totalDepth = maxDepth(rawFields);
  const MAX_VISIBLE = 3; // show depth 0, 1, 2; hide 3+

  const nodes = fieldsToTree(rawFields);
  const visibleNodes = totalDepth > MAX_VISIBLE ? filterByDepth(nodes, MAX_VISIBLE) : nodes;
  const hasHiddenContent = totalDepth > MAX_VISIBLE;

  const existingKeys = nodes.map((n) => n.key);

  return (
    <div style={styles.container}>
      {hasHiddenContent && (
        <div style={styles.hiddenNotice}>
          Content beyond 3 levels deep is hidden from this view.
        </div>
      )}

      {visibleNodes.map((node) =>
        node.type === 'scalar' ? (
          <ScalarField
            key={node.key}
            node={node}
            path={node.key}
            readOnly={false}
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
            readOnly={false}
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
        readOnly={false}
        onAdd={onAdd}
      />
    </div>
  );
};

export default YamlTreeView;
