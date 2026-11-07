declare module 'express' {
  export interface Application {
    set(setting: string, value: unknown): this;
    request: object;
  }
  export default function express(): Application;
  export function json(options?: { limit?: string }): unknown;
  export function urlencoded(options?: {
    extended?: boolean;
    limit?: string;
  }): unknown;
}
