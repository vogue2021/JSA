/**
 * Vitest 测试环境 Setup
 * 配置 jsdom 环境和全局 mock
 */
import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] ?? null,
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.location（防止 mailto 跳转报错）
delete window.location;
window.location = { href: '', assign: vi.fn(), reload: vi.fn() };

// 全局清理
afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
