import { useState, useCallback } from 'react';
import { useVSCodeAPI } from './useVSCodeAPI';
import type { FieldSchema, ValueType, YamlNode, YamlNodeType } from '../bridge';

export function useFrontMatter() {
  const [fields, setFields] = useState<FieldSchema[]>([]);
  const [rawFields, setRawFields] = useState<Record<string, unknown>>({});
  const [exists, setExists] = useState(false);
  const [maxDepth, setMaxDepth] = useState(4);
  const [newlyAddedKey, setNewlyAddedKey] = useState<string | null>(null);
  const { postMessage, onMessage } = useVSCodeAPI();

  onMessage((msg) => {
    if (msg.type === 'updateFM') {
      const schemas: FieldSchema[] = Object.entries(msg.fields).map(([key, value]) => ({
        key,
        value,
        type: inferType(value),
      }));
      setFields(schemas);
      setRawFields(msg.fields);
      setExists(msg.exists);
      setMaxDepth(msg.maxDepth);
      setNewlyAddedKey(null);
    }
  });

  const updateField = useCallback(
    (field: string, value: unknown) => {
      setFields((prev) =>
        prev.map((f) =>
          f.key === field ? { ...f, value, type: inferType(value) } : f
        )
      );
      postMessage({ type: 'updateFM', field, value });
    },
    [postMessage]
  );

  const deleteField = useCallback(
    (field: string) => {
      setFields((prev) => prev.filter((f) => f.key !== field));
      postMessage({ type: 'deleteField', field });
    },
    [postMessage]
  );

  const addField = useCallback(
    (field: string, value: unknown, type?: ValueType) => {
      const fieldType = type ?? inferType(value);
      setFields((prev) => [
        ...prev,
        { key: field, value, type: fieldType },
      ]);
      setExists(true);
      setNewlyAddedKey(field);
      postMessage({ type: 'addField', field, value });
    },
    [postMessage]
  );

  const renameField = useCallback(
    (oldField: string, newField: string) => {
      const trimmed = newField.trim();
      if (!trimmed || oldField === trimmed) return;
      setFields((prev) =>
        prev.map((f) => (f.key === oldField ? { ...f, key: trimmed } : f))
      );
      postMessage({ type: 'renameField', oldField, newField: trimmed });
    },
    [postMessage]
  );

  const nestedUpdate = useCallback(
    (path: string, value: unknown) => {
      postMessage({ type: 'nestedUpdate', path, value });
    },
    [postMessage]
  );

  const nestedAdd = useCallback(
    (path: string, key: string, nodeType: YamlNodeType) => {
      postMessage({ type: 'nestedAdd', path, key, nodeType });
    },
    [postMessage]
  );

  const nestedDelete = useCallback(
    (path: string) => {
      postMessage({ type: 'nestedDelete', path });
    },
    [postMessage]
  );

  const nestedRename = useCallback(
    (path: string, newKey: string) => {
      const trimmed = newKey.trim();
      if (!trimmed) return;
      postMessage({ type: 'nestedRename', path, newKey: trimmed });
    },
    [postMessage]
  );

  const clearNewlyAddedKey = useCallback(() => {
    setNewlyAddedKey(null);
  }, []);

  return {
    fields, rawFields, exists, maxDepth,
    updateField, deleteField, addField, renameField,
    nestedUpdate, nestedAdd, nestedDelete, nestedRename,
    newlyAddedKey, clearNewlyAddedKey,
  };
}

function inferType(value: unknown): FieldSchema['type'] {
  if (Array.isArray(value)) return 'array';
  return 'string';
}

export type { YamlNode, YamlNodeType } from '../bridge';

export function inferYamlNodeType(value: unknown): YamlNodeType {
  if (Array.isArray(value)) return 'sequence';
  if (value !== null && typeof value === 'object') return 'mapping';
  return 'scalar';
}

function nodeAt(key: string, value: unknown, maxDepth: number, depth: number): YamlNode {
  const type = inferYamlNodeType(value);
  const isScalar = type === 'scalar';
  const isHidden = !isScalar && depth >= maxDepth;
  const isReadOnly = isScalar && depth >= maxDepth;

  let children: YamlNode[] = [];
  if (!isHidden) {
    if (Array.isArray(value)) {
      children = value.map((v, i) => nodeAt(String(i), v, maxDepth, depth + 1));
    } else if (!isScalar) {
      children = Object.entries(value as Record<string, unknown>).map(([k, v]) =>
        nodeAt(k, v, maxDepth, depth + 1)
      );
    }
  }

  return {
    key,
    type,
    value,
    children,
    meta: {
      depth,
      ...(isHidden ? { hidden: true } : {}),
      ...(isReadOnly ? { readOnly: true } : {}),
    },
  };
}

export function fieldsToTree(
  fields: Record<string, unknown>,
  maxDepth: number,
  depth = 0
): YamlNode[] {
  return Object.entries(fields).map(([key, value]) => nodeAt(key, value, maxDepth, depth));
}
