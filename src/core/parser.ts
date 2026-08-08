import * as YAML from 'yaml';
import type { FrontMatterData, FrontMatterError, FieldSchema } from '../types';

const FM_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

export function extractFrontMatter(text: string): FrontMatterData | FrontMatterError {
  const match = text.match(FM_REGEX);

  if (!match) {
    return { fields: {}, exists: false, raw: '', startOffset: 0, endOffset: 0 };
  }

  const raw = match[1];
  const startOffset = match.index!;
  const endOffset = startOffset + match[0].length;

  try {
    const doc = YAML.parseDocument(raw);
    const fields = doc.toJSON() as Record<string, unknown> ?? {};
    return { fields, exists: true, raw, startOffset, endOffset };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { message };
  }
}

export function serializeFrontMatter(fields: Record<string, unknown>): string {
  if (Object.keys(fields).length === 0) {
    return '';
  }
  const doc = new YAML.Document(fields);
  return `---\n${doc.toString().trimEnd()}\n---`;
}

export function replaceFrontMatter(
  text: string,
  newFields: Record<string, unknown>,
  fm: FrontMatterData
): string {
  const serialized = serializeFrontMatter(newFields);

  if (!fm.exists) {
    return serialized + text;
  }

  return (
    text.slice(0, fm.startOffset) +
    serialized +
    text.slice(fm.endOffset)
  );
}

export function inferFieldType(value: unknown): FieldSchema['type'] {
  if (Array.isArray(value)) {
    return 'array';
  }
  return 'string';
}

export function fieldsToSchema(fields: Record<string, unknown>): FieldSchema[] {
  return Object.entries(fields).map(([key, value]) => ({
    key,
    value,
    type: inferFieldType(value),
  }));
}
