export type MessageToWebview =
  | { type: 'updateFM'; fields: Record<string, unknown>; exists: boolean }
  | { type: 'searchResults'; query: string; tree: SearchTreeNode[] }
  | { type: 'error'; message: string };

export type MessageFromWebview =
  | { type: 'updateFM'; field: string; value: unknown }
  | { type: 'addField'; field: string; value: unknown }
  | { type: 'deleteField'; field: string }
  | { type: 'renameField'; oldField: string; newField: string }
  | { type: 'search'; query: string; scope: 'current' | 'all' }
  | { type: 'openFile'; filePath: string }
  | { type: 'ready' };

export interface SearchTreeNode {
  name: string;
  type: 'directory' | 'file';
  children?: SearchTreeNode[];
  filePath?: string;
  matches?: Array<{ field: string; value: unknown }>;
}

export type ValueType = 'string' | 'number' | 'boolean' | 'array' | 'date' | 'null';

export interface FieldSchema {
  key: string;
  value: unknown;
  type: ValueType;
}
