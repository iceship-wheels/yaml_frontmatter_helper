import { useEffect, useCallback } from 'react';
import type { MessageToWebview, MessageFromWebview } from '../bridge';

type Listener = (msg: MessageToWebview) => void;

let listeners: Listener[] = [];
let _vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;

function getVSCodeAPI() {
  if (!_vscodeApi) {
    _vscodeApi = acquireVsCodeApi();
  }
  return _vscodeApi;
}

function handleMessage(event: MessageEvent<MessageToWebview>): void {
  for (const listener of listeners) {
    listener(event.data);
  }
}

window.addEventListener('message', handleMessage);

export function useVSCodeAPI() {
  const postMessage = useCallback((msg: MessageFromWebview) => {
    getVSCodeAPI().postMessage(msg);
  }, []);

  const onMessage = useCallback((listener: Listener) => {
    useEffect(() => {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    }, [listener]);
  }, []);

  return { postMessage, onMessage };
}

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};
