import '@testing-library/jest-dom';
import { webcrypto } from 'crypto';

// Polyfill window.crypto for jsdom environment in Vitest
if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = webcrypto;
}
if (!window.crypto) {
  // @ts-ignore
  window.crypto = webcrypto;
}

// Polyfill TextEncoder / TextDecoder if absent
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}
