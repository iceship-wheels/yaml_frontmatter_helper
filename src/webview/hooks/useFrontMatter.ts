import { useState, useCallback } from 'react';
import { useVSCodeAPI } from './useVSCodeAPI';
import type { FieldSchema } from '../bridge';

export function useFrontMatter() {
  const [fields, setFields] = useState<FieldSchema[]>([]);
  const [exists, setExists] = useState(false);
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
    (field: string, value: unknown) => {
      setFields((prev) => [
        ...prev,
        { key: field, value, type: inferType(value) },
      ]);
      setExists(true);
      postMessage({ type: 'addField', field, value });
    },
    [postMessage]
  );

  return { fields, exists, updateField, deleteField, addField };
}

function inferType(value: unknown): FieldSchema['type'] {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    return 'string';
  }
  return 'string';
}
