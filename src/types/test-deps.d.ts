declare module "@playwright/test" {
  export type Page = unknown;
  export const devices: Record<string, Record<string, unknown>>;
  export const expect: unknown;
  export const test: unknown;
  export function defineConfig(config: unknown): unknown;
}

declare module "vitest" {
  export const afterEach: (fn: () => void | Promise<void>) => void;
  export const beforeEach: (fn: () => void | Promise<void>) => void;
  export const describe: (name: string, fn: () => void) => void;
  export const expect: {
    (value: unknown): {
      toBe: (expected: unknown) => void;
      toEqual: (expected: unknown) => void;
      toThrow: (expected?: unknown) => void;
      toContain: (expected: unknown) => void;
      toMatch: (expected: unknown) => void;
      toBeTruthy: () => void;
      toBeFalsy: () => void;
      toHaveBeenCalled: () => void;
      toHaveBeenCalledWith: (...args: unknown[]) => void;
    };
  };
  export const it: (name: string, fn: () => void | Promise<void>) => void;
  export const vi: {
    fn: (...args: unknown[]) => unknown;
    mock: (...args: unknown[]) => void;
    stubEnv: (name: string, value: string | undefined) => void;
    unstubAllEnvs: () => void;
    clearAllMocks: () => void;
    restoreAllMocks: () => void;
    useRealTimers: () => void;
  };
}

declare module "vitest/config" {
  export function defineConfig(config: unknown): unknown;
}

declare module "@testing-library/jest-dom/vitest" {}

declare module "@vitejs/plugin-react" {
  export default function react(config?: unknown): unknown;
}

declare module "vite-tsconfig-paths" {
  export default function tsconfigPaths(config?: unknown): unknown;
}
