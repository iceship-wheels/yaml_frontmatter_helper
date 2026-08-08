import { useState, useCallback } from 'react';
import { useVSCodeAPI } from './useVSCodeAPI';
import type { FieldSchema, ValueType } from '../bridge';

export function useFrontMatter() {
  const [fields, setFields] = useState<FieldSchema[]>([]);
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
      setExists(msg.exists);
      // Clear newlyAddedKey after host sync confirms the field exists
      setNewlyAddedKey(null);
    }
  });

  const updateField = useCallback(
    (field: string, value: unknown) => {
      console.log('[WEBVIEW] updateField:', field, value);
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

  const clearNewlyAddedKey = useCallback(() => {
    setNewlyAddedKey(null);
  }, []);

  return { fields, exists, updateField, deleteField, addField, renameField, newlyAddedKey, clearNewlyAddedKey };
}

function inferType(value: unknown): FieldSchema['type'] {
  if (Array.isArray(value)) return 'array';
  return 'string';
}
