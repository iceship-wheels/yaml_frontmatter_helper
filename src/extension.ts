import * as vscode from 'vscode';
import { FrontMatterViewProvider } from './providers/FrontMatterViewProvider';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new FrontMatterViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      FrontMatterViewProvider.viewType,
      provider
    )
  );

  context.subscriptions.push({
    dispose: () => provider.dispose(),
  });
}

export function deactivate(): void {
  // cleanup handled by subscriptions
}
