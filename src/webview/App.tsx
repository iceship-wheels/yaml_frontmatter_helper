import React, { useState, useEffect } from 'react';
import FieldRow from './components/FieldRow';
import AddField from './components/AddField';
import SearchPanel from './components/SearchPanel';
import { useFrontMatter } from './hooks/useFrontMatter';
import { useVSCodeAPI } from './hooks/useVSCodeAPI';

type Tab = 'edit' | 'search';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    padding: '0',
    fontFamily: 'var(--vscode-font-family)',
    fontSize: 'var(--vscode-font-size)',
    color: 'var(--vscode-foreground)',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)',
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    padding: '6px 0',
    textAlign: 'center',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    color: 'var(--vscode-foreground)',
    fontFamily: 'inherit',
    fontSize: 'inherit',
  },
  tabActive: {
    borderBottom: '2px solid var(--vscode-focusBorder)',
    fontWeight: 600,
  },
  form: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
  },
  empty: {
    padding: '16px',
    textAlign: 'center',
    color: 'var(--vscode-descriptionForeground)',
  },
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('edit');
  const { fields, exists, updateField, deleteField, addField, renameField, newlyAddedKey } = useFrontMatter();
  const { postMessage, onMessage } = useVSCodeAPI();

  useEffect(() => {
    postMessage({ type: 'ready' });
  }, []);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
  };

  return (
    <div style={styles.container}>
      <div style={styles.tabBar}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'edit' ? styles.tabActive : {}) }}
          onClick={() => handleTabClick('edit')}
        >
          Edit
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'search' ? styles.tabActive : {}) }}
          onClick={() => handleTabClick('search')}
        >
          Search
        </button>
      </div>

      {activeTab === 'edit' ? (
        <div style={styles.form}>
          {!exists && fields.length === 0 ? (
            <div style={styles.empty}>
              No front matter found in this file. Add a field below.
            </div>
          ) : (
            fields.map((f) => (
              <FieldRow
                key={f.key}
                field={f}
                onUpdate={updateField}
                onDelete={deleteField}
                onRename={renameField}
                autoEditKey={f.key === newlyAddedKey}
              />
            ))
          )}
          <AddField existingKeys={fields.map((f) => f.key)} onAdd={addField} />
        </div>
      ) : (
        <SearchPanel postMessage={postMessage} onMessage={onMessage} />
      )}
    </div>
  );
};

export default App;
