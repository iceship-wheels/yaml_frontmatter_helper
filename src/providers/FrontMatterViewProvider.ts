import * as vscode from 'vscode';
import { SyncManager } from '../core/sync';
import { Searcher } from '../core/searcher';
import type { FrontMatterData, MessageFromWebview } from '../types';

export class FrontMatterViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'yaml-frontmatter-helper.sidebar';
  private _view: vscode.WebviewView | null = null;
  private syncManager: SyncManager;
  private searcher: Searcher;
  private currentFM: FrontMatterData = { fields: {}, exists: false, raw: '', startOffset: 0, endOffset: 0 };

  constructor(private readonly extensionUri: vscode.Uri) {
    this.syncManager = new SyncManager();
    this.searcher = new Searcher();

    this.syncManager.onUpdate((fm) => {
      this.currentFM = fm;
      this.postMessage({ type: 'updateFM', fields: fm.fields, exists: fm.exists });
    });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'out', 'webview')],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(this.onMessage.bind(this));

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.syncManager.refresh();
      }
    });
  }

  dispose(): void {
    this.syncManager.dispose();
    this.searcher.dispose();
  }

  private async onMessage(msg: MessageFromWebview): Promise<void> {
    console.log('[HOST] onMessage received:', msg);
    switch (msg.type) {
      case 'ready':
        this.syncManager.refresh();
        break;

      case 'updateFM':
        await this.syncManager.applyFieldUpdate(msg.field, msg.value);
        break;

      case 'addField':
        await this.syncManager.applyFieldAdd(msg.field, msg.value);
        break;

      case 'deleteField':
        await this.syncManager.applyFieldDelete(msg.field);
        break;

      case 'renameField':
        await this.syncManager.applyFieldRename(msg.oldField, msg.newField);
        break;

      case 'nestedUpdate':
        await this.syncManager.applyNestedUpdate(msg.path, msg.value);
        break;

      case 'nestedAdd':
        await this.syncManager.applyNestedAdd(msg.path, msg.key, msg.nodeType);
        break;

      case 'nestedDelete':
        await this.syncManager.applyNestedDelete(msg.path);
        break;

      case 'nestedRename':
        await this.syncManager.applyNestedRename(msg.path, msg.newKey);
        break;

      case 'search':
        this.handleSearch(msg.query);
        break;

      case 'openFile':
        this.handleOpenFile(msg.filePath);
        break;
    }
  }

  private async handleSearch(query: string): Promise<void> {
    const tree = await this.searcher.search(query);
    this.postMessage({ type: 'searchResults', query, tree });
  }

  private async handleOpenFile(filePath: string): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
  }

  private postMessage(message: unknown): void {
    this._view?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const bundleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'webview', 'bundle.js')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YAML Frontmatter</title>
</head>
<body>
  <div id="root"></div>
  <script src="${bundleUri}"></script>
</body>
</html>`;
  }
}
