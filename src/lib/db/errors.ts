export class QueryError extends Error {
  constructor() {
    super("QUERY_FAILED")
    this.name = "QueryError"
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
