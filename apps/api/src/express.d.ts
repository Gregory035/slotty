declare module 'express' {
  export function json(options?: { limit?: string }): unknown;
  export function urlencoded(options?: {
    extended?: boolean;
    limit?: string;
  }): unknown;
}
