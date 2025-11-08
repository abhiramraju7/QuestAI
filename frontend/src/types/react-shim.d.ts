// Minimal React/JSX shims for editor/typecheck environments without @types/react installed.
// These prevent "JSX.IntrinsicElements" and "react/jsx-runtime" missing module errors.

declare module "react" {
  export type CSSProperties = any;
  export function useState<T = any>(initial?: T): [T, (v: T | ((prev: T) => T)) => void];
  export function useMemo<T = any>(factory: () => T, deps: any[]): T;
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useRef<T = any>(initial?: T | null): { current: T | null };
  const ReactDefault: any;
  export default ReactDefault;
}

declare module "react/jsx-runtime" {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module "react-dom" {
  const ReactDOM: any;
  export default ReactDOM;
}

declare module "react-dom/client" {
  export function createRoot(container: Element | DocumentFragment): {
    render: (node: any) => void;
  };
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export {};


