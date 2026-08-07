import * as vscode from 'vscode';
import { extractFrontMatter, serializeFrontMatter, fieldsToSchema } from './parser';
import type { FrontMatterData } from '../types';

export class SyncManager {
  private disposables: vscode.Disposable[] = [];
  private currentFM: FrontMatterData | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private onUpdateCallback: ((fm: FrontMatterData) => void) | null = null;
  private isApplyingEdit = false;
  private lastSentJson = '';

  constructor() {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(this.onDocumentChange.bind(this)),
      vscode.window.onDidChangeActiveTextEditor(this.onActiveEditorChange.bind(this))
    );
  }

  onUpdate(callback: (fm: FrontMatterData) => void): void {
    this.onUpdateCallback = callback;
  }

  refresh(): void {
    this.onActiveEditorChange(vscode.window.activeTextEditor);
  }

  private async applyEditToDocument(newFields: Record<string, unknown>): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      console.log('[FM] applyEditToDocument: no active editor');
      return;
    }

    const document = editor.document;
    const fm = this.currentFM ?? { fields: {}, exists: false, raw: '', startOffset: 0, endOffset: 0 };
    const oldExists = fm.exists;
    const newFmText = serializeFrontMatter(newFields);

    console.log('[FM] applyEditToDocument:', { fields: Object.keys(newFields), oldExists });

    this.isApplyingEdit = true;

    try {
      const success = await editor.edit(
        (editBuilder) => {
          if (oldExists) {
            const startPos = document.positionAt(fm.startOffset);
            const endPos = document.positionAt(fm.endOffset);
            editBuilder.replace(new vscode.Range(startPos, endPos), newFmText);
          } else {
            editBuilder.insert(new vscode.Position(0, 0), newFmText);
          }
        },
        { undoStopBefore: false, undoStopAfter: false }
      );

      console.log('[FM] editor.edit result:', success);
      if (success) {
        this.parseAndPush(document.getText());
      } else {
        this.isApplyingEdit = false;
        vscode.window.showWarningMessage('YAML Frontmatter: Failed to apply edit');
      }
    } catch (e) {
      console.error('[FM] editor.edit error:', e);
      this.isApplyingEdit = false;
    }
  }

  async applyFieldUpdate(field: string, value: unknown): Promise<void> {
    const fm = this.currentFM ?? { fields: {}, exists: false, raw: '', startOffset: 0, endOffset: 0 };
    const newFields = { ...fm.fields, [field]: value };
    await this.applyEditToDocument(newFields);
  }

  async applyFieldDelete(field: string): Promise<void> {
    const fm = this.currentFM ?? { fields: {}, exists: false, raw: '', startOffset: 0, endOffset: 0 };
    const newFields = { ...fm.fields };
    delete newFields[field];
    await this.applyEditToDocument(newFields);
  }

  async applyFieldAdd(field: string, value: unknown): Promise<void> {
    const fm = this.currentFM ?? { fields: {}, exists: false, raw: '', startOffset: 0, endOffset: 0 };
    const newFields = { ...fm.fields, [field]: value };
    await this.applyEditToDocument(newFields);
  }

  async applyFieldRename(oldField: string, newField: string): Promise<void> {
    const fm = this.currentFM ?? { fields: {}, exists: false, raw: '', startOffset: 0, endOffset: 0 };
    if (oldField === newField || !(oldField in fm.fields)) {
      return;
    }
    if (newField in fm.fields) {
      vscode.window.showWarningMessage(`YAML Frontmatter: field "${newField}" already exists.`);
      return;
    }
    const newFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fm.fields)) {
      if (key === oldField) {
        newFields[newField] = value;
      } else {
        newFields[key] = value;
      }
    }
    await this.applyEditToDocument(newFields);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }

  private onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || event.document !== editor.document) {
      return;
    }

    if (event.document.languageId !== 'markdown') {
      return;
    }

    if (this.isApplyingEdit) {
      this.isApplyingEdit = false;
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.parseAndPush(editor.document.getText());
    }, 300);
  }

  private onActiveEditorChange(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.languageId !== 'markdown') {
      this.currentFM = null;
      this.lastSentJson = '';
      this.pushToWebview({ fields: {}, exists: false, raw: '', startOffset: 0, endOffset: 0 });
      return;
    }

    this.parseAndPush(editor.document.getText());
  }

  private parseAndPush(text: string): void {
    const result = extractFrontMatter(text);

    if ('message' in result) {
      this.currentFM = null;
      if (this.onUpdateCallback) {
        this.onUpdateCallback({ fields: {}, exists: false, raw: '', startOffset: 0, endOffset: 0 });
      }
      return;
    }

    this.currentFM = result;

    const currentJson = JSON.stringify(fieldsToSchema(result.fields));
    if (currentJson === this.lastSentJson) {
      return;
    }
    this.lastSentJson = currentJson;

    this.pushToWebview(result);
  }

  private pushToWebview(fm: FrontMatterData): void {
    if (this.onUpdateCallback) {
      this.onUpdateCallback(fm);
    }
  }
}
