import { describe, expect, it } from "vitest";
import { assertDisposableDatabaseUrl } from "./editorial-database-safety";

describe("editorial acceptance database URL safety", () => {
  it.each([
    "postgresql://user:password@127.0.0.1:5432/editorial_acceptance",
    "postgres://user:password@localhost/editorial_acceptance",
    "postgresql://user:password@[::1]:5432/editorial_acceptance",
    "mysql://user:password@127.0.0.1:3306/editorial_acceptance",
  ])("accepts an isolated loopback database URL: %s", (url) => {
    expect(() => assertDisposableDatabaseUrl(url)).not.toThrow();
  });

  it.each([
    [undefined, "is required"],
    ["https://127.0.0.1/editorial_acceptance", "only PostgreSQL or MySQL"],
    ["postgresql://user:password@production.example/editorial_acceptance", "non-loopback"],
    ["postgresql://user:password@127.0.0.1/editorial", "ending in _acceptance"],
    ["postgresql://user:password@127.0.0.1/_acceptance", "one safe database name"],
    ["postgresql://user:password@127.0.0.1/folder/editorial_acceptance", "one safe database name"],
    ["postgresql://user:password@127.0.0.1/folder%2Feditorial_acceptance", "one safe database name"],
    ["postgresql://user:password@127.0.0.1/editorial_acceptance?host=production.example", "query parameters"],
    ["postgresql://user:password@127.0.0.1/editorial_acceptance?host=%2Fvar%2Frun%2Fpostgresql", "query parameters"],
    ["mysql://user:password@127.0.0.1/editorial_acceptance?socketPath=%2Ftmp%2Fmysql.sock", "query parameters"],
    ["postgresql://user:password@127.0.0.1/editorial_acceptance#production", "fragments"],
  ])("rejects unsafe acceptance configuration %#", (url, message) => {
    expect(() => assertDisposableDatabaseUrl(url)).toThrow(message);
  });
});
