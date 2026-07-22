import React, { useState } from 'react';
import type { SearchTreeNode } from '../bridge';

const styles: Record<string, React.CSSProperties> = {
  tree: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  treeItem: {
    cursor: 'pointer',
    padding: '2px 0',
    userSelect: 'none',
  },
  dirRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    padding: '2px 8px',
    fontSize: '12px',
    color: 'var(--vscode-sideBarTitle-foreground)',
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px 2px 24px',
    fontSize: '12px',
  },
  matchTag: {
    display: 'inline-block',
    padding: '0 4px',
    fontSize: '10px',
    backgroundColor: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)',
    borderRadius: '2px',
    marginRight: '3px',
  },
  fileIcon: {
    fontSize: '10px',
  },
  arrow: {
    display: 'inline-block',
    width: '12px',
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground)',
  },
};

interface Props {
  nodes: SearchTreeNode[];
  onOpenFile: (filePath: string) => void;
}

const SearchTree: React.FC<Props> = ({ nodes, onOpenFile }) => {
  return (
    <ul style={styles.tree}>
      {nodes.map((node) => (
        <TreeNode
          key={node.type === 'directory' ? node.name : node.filePath ?? node.name}
          node={node}
          depth={0}
          onOpenFile={onOpenFile}
        />
      ))}
    </ul>
  );
};

const TreeNode: React.FC<{
  node: SearchTreeNode;
  depth: number;
  onOpenFile: (filePath: string) => void;
}> = ({ node, depth, onOpenFile }) => {
  const [collapsed, setCollapsed] = useState(depth >= 2);

  if (node.type === 'file') {
    return (
      <li style={styles.treeItem}>
        <div
          style={{ ...styles.fileRow, paddingLeft: 8 + depth * 12 }}
          onClick={() => node.filePath && onOpenFile(node.filePath)}
          title={node.filePath}
        >
          <span style={styles.fileIcon}>&#128196;</span>
          <span>{node.name}</span>
          {node.matches?.map((m, i) => (
            <span key={i} style={styles.matchTag}>
              {m.field}
            </span>
          ))}
        </div>
      </li>
    );
  }

  return (
    <li style={styles.treeItem}>
      <div
        style={{ ...styles.dirRow, paddingLeft: 8 + depth * 12 }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span style={styles.arrow}>{collapsed ? '\u25B6' : '\u25BC'}</span>
        <span>&#128193;</span>
        <span>{node.name}/</span>
      </div>
      {!collapsed && node.children && (
        <ul style={styles.tree}>
          {node.children.map((child) => (
            <TreeNode
              key={child.type === 'directory' ? child.name : child.filePath ?? child.name}
              node={child}
              depth={depth + 1}
              onOpenFile={onOpenFile}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default SearchTree;
