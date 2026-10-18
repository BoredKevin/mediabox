// Global polyfills for non-secure contexts (e.g. LAN HTTP on Smart TVs) and legacy browsers

if (typeof window !== 'undefined') {
  const polyfillUUID = function (): `${string}-${string}-${string}-${string}-${string}` {
    if (typeof window.crypto !== 'undefined' && typeof window.crypto.getRandomValues === 'function') {
      try {
        return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) =>
          (
            c ^
            (window.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
          ).toString(16)
        ) as `${string}-${string}-${string}-${string}-${string}`;
      } catch {
        // fallback to Math.random
      }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }) as `${string}-${string}-${string}-${string}-${string}`;
  };

  try {
    if (typeof Crypto !== 'undefined' && Crypto.prototype && !Crypto.prototype.randomUUID) {
      Object.defineProperty(Crypto.prototype, 'randomUUID', {
        value: polyfillUUID,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
  } catch (e) {}

  try {
    if (!window.crypto) {
      Object.defineProperty(window, 'crypto', {
        value: {},
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    if (window.crypto && !window.crypto.randomUUID) {
      Object.defineProperty(window.crypto, 'randomUUID', {
        value: polyfillUUID,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
  } catch (e) {
    try {
      (window.crypto as any).randomUUID = polyfillUUID;
    } catch (e2) {}
  }
}

export {};
