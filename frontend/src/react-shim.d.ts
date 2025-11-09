// Minimal React module shim for environments without installed @types/react.
// In full dev/prod, real typings from @types/react will override these.
declare namespace React {
  type CSSProperties = any;
  type FormEvent<T = any> = any;
  type ChangeEvent<T = any> = any;
  type KeyboardEvent<T = any> = any;
}

declare module "react" {
  export type CSSProperties = React.CSSProperties;
  export type FormEvent<T = any> = React.FormEvent<T>;
  export type ChangeEvent<T = any> = React.ChangeEvent<T>;
  export type KeyboardEvent<T = any> = React.KeyboardEvent<T>;
  export function useState<T = any>(
    initial?: T | (() => T)
  ): [T, (v: T | ((prev: T) => T)) => void];
  export function useEffect(effect: (...args: any[]) => any, deps?: any[]): void;
  export function useMemo<T = any>(factory: () => T, deps?: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(cb: T, deps?: any[]): T;
  export function useRef<T = any>(initial?: T | null): { current: T | null };
  const React: any;
  export default React;
}

declare module "react/jsx-runtime" {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}


