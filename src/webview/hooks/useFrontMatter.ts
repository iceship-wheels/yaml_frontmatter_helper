import { useState, useCallback } from 'react';
import { useVSCodeAPI } from './useVSCodeAPI';
import type { FieldSchema, ValueType, YamlNode, YamlNodeType } from '../bridge';

export function useFrontMatter() {
  const [fields, setFields] = useState<FieldSchema[]>([]);
  const [rawFields, setRawFields] = useState<Record<string, unknown>>({});
  const [exists, setExists] = useState(false);
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
    fields, rawFields, exists,
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

export function fieldsToTree(
  fields: Record<string, unknown>,
  depth = 0
): YamlNode[] {
  return Object.entries(fields).map(([key, value]) => {
    const type = inferYamlNodeType(value);
    const isScalar = type === 'scalar';
    let children: YamlNode[] = [];

    if (Array.isArray(value)) {
      children = value.map((v, i) => {
        const childType = inferYamlNodeType(v);
        const childIsScalar = childType === 'scalar';
        return {
          key: String(i),
          type: childType,
          value: v,
          children:
            !Array.isArray(v) && v !== null && typeof v === 'object'
              ? fieldsToTree(v as Record<string, unknown>, depth + 1)
              : [],
          meta: { depth: depth + 1 },
        };
      });
    } else if (!isScalar) {
      children = fieldsToTree(value as Record<string, unknown>, depth + 1);
    }

    return {
      key,
      type,
      value,
      children,
      meta: { depth },
    };
  });
}

export function maxDepth(obj: unknown): number {
  if (!obj || typeof obj !== 'object') return 0;
  if (Array.isArray(obj)) {
    return 1 + Math.max(0, ...obj.map((v) => maxDepth(v)));
  }
  return 1 + Math.max(0, ...Object.values(obj).map((v) => maxDepth(v)));
}
