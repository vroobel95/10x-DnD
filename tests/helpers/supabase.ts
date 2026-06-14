import { vi } from "vitest";

export interface QueryResult {
  data: unknown;
  error: unknown;
}

function makeTableBuilder(result: QueryResult): any {
  const builder: any = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    neq: vi.fn(),
    then: <T>(
      resolve: ((value: QueryResult) => T | PromiseLike<T>) | null | undefined,
      reject?: ((reason: unknown) => T | PromiseLike<T>) | null,
    ): Promise<T> => Promise.resolve(result).then(resolve, reject ?? undefined),
  };

  // Each intermediate method returns the builder so calls can be chained.
  // The builder is also thenable, so `await chain` and `await chain.single()`
  // both resolve to the configured { data, error } for that table.
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.single.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.neq.mockReturnValue(builder);

  return builder;
}

export function makeSupabaseMock(tableResults: Record<string, QueryResult | QueryResult[]>): any {
  const callCounts: Record<string, number> = {};
  return {
    from: vi.fn().mockImplementation((table: string) => {
      const entry = tableResults[table] as QueryResult | QueryResult[] | undefined;
      if (Array.isArray(entry)) {
        const idx = callCounts[table] ?? 0;
        callCounts[table] = idx + 1;
        return makeTableBuilder(entry[idx] ?? entry[entry.length - 1]);
      }
      return makeTableBuilder(entry ?? { data: null, error: null });
    }),
  };
}
