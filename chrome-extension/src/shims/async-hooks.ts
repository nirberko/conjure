// Shim for node:async_hooks in Chrome extension service worker
// LangGraph uses AsyncLocalStorage for tracing — not required for core functionality
export class AsyncLocalStorage<T = unknown> {
  private _value: T | undefined;

  getStore(): T | undefined {
    return this._value;
  }

  run<R>(store: T, callback: () => R): R {
    const prev = this._value;
    this._value = store;
    try {
      return callback();
    } finally {
      this._value = prev;
    }
  }

  enterWith(store: T): void {
    this._value = store;
  }

  disable(): void {
    this._value = undefined;
  }
}
