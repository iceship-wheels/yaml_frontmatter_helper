import * as vscode from 'vscode';
import { extractFrontMatter } from './parser';
import type { SearchTreeNode } from '../types';

interface CacheEntry {
  fields: Record<string, unknown>;
  exists: boolean;
}

export class Searcher {
  private cache = new Map<string, CacheEntry>();
  private fileWatcher: vscode.FileSystemWatcher | null = null;

  constructor() {
    this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.md');
    this.fileWatcher.onDidChange((uri) => this.cache.delete(uri.fsPath));
    this.fileWatcher.onDidDelete((uri) => this.cache.delete(uri.fsPath));
    this.fileWatcher.onDidCreate((uri) => this.cache.delete(uri.fsPath));
  }

  async search(query: string): Promise<SearchTreeNode[]> {
    if (!query.trim() || !vscode.workspace.workspaceFolders) {
      return [];
    }

    const files = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
    const lowerQuery = query.toLowerCase();
    const results: Array<{ filePath: string; matches: Array<{ field: string; value: unknown }> }> = [];

    for (const file of files) {
      const entry = await this.getOrRead(file);
      if (!entry.exists) {
        continue;
      }

      const matches = this.collectMatches(entry.fields, lowerQuery);

      if (matches.length > 0) {
        results.push({ filePath: file.fsPath, matches });
      }
    }

    return this.buildTree(results);
  }

  dispose(): void {
    this.fileWatcher?.dispose();
    this.cache.clear();
  }

  private async getOrRead(uri: vscode.Uri): Promise<CacheEntry> {
    const cached = this.cache.get(uri.fsPath);
    if (cached) {
      return cached;
    }

    try {
      const content = await vscode.workspace.fs.readFile(uri);
      const text = new TextDecoder().decode(content);
      const result = extractFrontMatter(text);

      let entry: CacheEntry;
      if ('message' in result) {
        entry = { fields: {}, exists: false };
      } else {
        entry = { fields: result.fields, exists: result.exists };
      }

      this.cache.set(uri.fsPath, entry);
      return entry;
    } catch {
      const entry: CacheEntry = { fields: {}, exists: false };
      this.cache.set(uri.fsPath, entry);
      return entry;
    }
  }

  private collectMatches(
    fields: Record<string, unknown>,
    query: string
  ): Array<{ field: string; value: unknown }> {
    const results: Array<{ field: string; value: unknown }> = [];
    const stack: Array<{ prefix: string; obj: unknown }> = [
      { prefix: '', obj: fields },
    ];
    while (stack.length > 0) {
      const { prefix, obj } = stack.pop()!;
      if (typeof obj !== 'object' || obj === null) {
        if (String(obj).toLowerCase().includes(query)) {
          results.push({ field: prefix, value: obj });
        }
        continue;
      }
      if (Array.isArray(obj)) {
        obj.forEach((item, i) =>
          stack.push({ prefix: `${prefix}[${i}]`, obj: item })
        );
      } else {
        for (const [key, val] of Object.entries(
          obj as Record<string, unknown>
        )) {
          stack.push({
            prefix: prefix ? `${prefix}.${key}` : key,
            obj: val,
          });
        }
      }
    }
    return results;
  }

  private buildTree(
    results: Array<{ filePath: string; matches: Array<{ field: string; value: unknown }> }>
  ): SearchTreeNode[] {
    results.sort((a, b) => a.filePath.localeCompare(b.filePath));

    const root: SearchTreeNode[] = [];

    for (const result of results) {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
      let relativePath = result.filePath;

      if (workspaceRoot && result.filePath.startsWith(workspaceRoot)) {
        relativePath = result.filePath.slice(workspaceRoot.length).replace(/^[/\\]/, '');
      }

      const parts = relativePath.split(/[/\\]/);
      let currentLevel = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;

        if (isFile) {
          currentLevel.push({
            name: part,
            type: 'file',
            filePath: result.filePath,
            matches: result.matches,
          });
        } else {
          let dirNode = currentLevel.find(
            (n) => n.type === 'directory' && n.name === part
          ) as SearchTreeNode | undefined;

          if (!dirNode) {
            dirNode = { name: part, type: 'directory', children: [] };
            currentLevel.push(dirNode);
          }

          currentLevel = dirNode.children!;
        }
      }
    }

    return root;
  }
}
