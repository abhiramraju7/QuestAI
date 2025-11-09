// Minimal JSX shim to satisfy TypeScript without @types/react present.
// This allows the project to typecheck in environments where node_modules
// aren't installed (CI/sandboxes), while real React types will override it when available.
declare namespace JSX {
  interface IntrinsicElements {
    [elem: string]: any;
  }
  interface Element {}
}


