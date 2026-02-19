declare module 'pg' {
  export interface QueryResult<T = unknown> {
    rows: T[];
  }

  export interface PoolClient {
    query<T = unknown>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
    release(): void;
  }

  export interface PoolConfig {
    connectionString?: string;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    connect(): Promise<PoolClient>;
    query<T = unknown>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
    end(): Promise<void>;
  }
}
