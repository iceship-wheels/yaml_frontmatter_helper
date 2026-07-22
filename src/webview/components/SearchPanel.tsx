import React, { useState, useCallback, useRef, useEffect } from 'react';
import SearchTree from './SearchTree';
import type { MessageToWebview, MessageFromWebview, SearchTreeNode } from '../bridge';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  searchBar: {
    padding: '8px',
    borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)',
    flexShrink: 0,
  },
  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '4px 6px',
    fontSize: '12px',
    fontFamily: 'var(--vscode-font-family)',
    color: 'var(--vscode-input-foreground)',
    backgroundColor: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '2px',
    outline: 'none',
  },
  results: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  count: {
    padding: '4px 8px',
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground)',
    flexShrink: 0,
  },
  empty: {
    padding: '16px',
    textAlign: 'center',
    color: 'var(--vscode-descriptionForeground)',
    fontSize: '12px',
  },
};

interface Props {
  postMessage: (msg: MessageFromWebview) => void;
  onMessage: (listener: (msg: MessageToWebview) => void) => void;
}

const SearchPanel: React.FC<Props> = ({ postMessage, onMessage }) => {
  const [query, setQuery] = useState('');
  const [tree, setTree] = useState<SearchTreeNode[]>([]);
  const [lastQuery, setLastQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  onMessage((msg) => {
    if (msg.type === 'searchResults') {
      setTree(msg.tree);
      setLastQuery(msg.query);
    }
  });

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        if (val.trim()) {
          postMessage({ type: 'search', query: val, scope: 'all' });
        } else {
          setTree([]);
          setLastQuery('');
        }
      }, 500);
    },
    [postMessage]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const totalFiles = countFiles(tree);

  return (
    <div style={styles.container}>
      <div style={styles.searchBar}>
        <input
          type="text"
          style={styles.searchInput}
          value={query}
          onChange={handleInputChange}
          placeholder="Search front matter..."
        />
      </div>

      {tree.length === 0 && query.trim() ? (
        <div style={styles.empty}>No results found</div>
      ) : tree.length === 0 && !query.trim() ? (
        <div style={styles.empty}>Type to search front matter across all Markdown files</div>
      ) : (
        <>
          <div style={styles.count}>
            Search "{lastQuery}" ({totalFiles} files)
          </div>
          <div style={styles.results}>
            <SearchTree
              nodes={tree}
              onOpenFile={(filePath) => postMessage({ type: 'openFile', filePath })}
            />
          </div>
        </>
      )}
    </div>
  );
};

function countFiles(nodes: SearchTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'file') {
      count++;
    } else if (node.children) {
      count += countFiles(node.children);
    }
  }
  return count;
}

export default SearchPanel;
