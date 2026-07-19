# aux4/db-mssql

MSSQL (Microsoft SQL Server) database tools for the aux4 ecosystem.

This package provides a Microsoft SQL Server driver for [aux4/db](https://hub.aux4.io/r/public/packages/aux4/db). It runs queries, binds named parameters, streams result rows as NDJSON, and supports batch input and transactions.

## Installation

```bash
aux4 aux4 pkger install aux4/db-mssql
```

This installs the `aux4 db mssql` commands. The shared [aux4/db](https://hub.aux4.io/r/public/packages/aux4/db) package is installed automatically as a dependency.

## Usage

### Execute a query

```bash
aux4 db mssql execute --host localhost --port 1433 --database master --user sa --password "******" --query "SELECT * FROM users WHERE id = :id" --id 1
```

The result set is printed as a JSON array. Statements that do not return rows (INSERT, UPDATE, DELETE without an `OUTPUT` clause) print an empty array.

### Named parameters

Parameters are referenced in SQL with `:name` and supplied as `--name value` flags:

```bash
aux4 db mssql execute --host localhost --user sa --password "******" --database test --query "INSERT INTO users (name, age) VALUES (:name, :age)" --name Peter --age 55
```

### Stream results as NDJSON

`stream` prints one JSON object per row, which is convenient for piping into other commands:

```bash
aux4 db mssql stream --host localhost --user sa --password "******" --database test --query "SELECT * FROM users ORDER BY id"
```

### Batch input from stdin

With `--inputStream`, a JSON array or NDJSON stream read from stdin runs the query once per record. Flags still apply and override fields from each record:

```bash
cat users.json | aux4 db mssql execute --host localhost --user sa --password "******" --database test --query "INSERT INTO users (name, age) VALUES (:name, :age)" --inputStream
```

Pipe one command's stream into another to process rows record by record:

```bash
aux4 db mssql stream --host localhost --user sa --password "******" --database test --query "SELECT id, name FROM users" \
  | aux4 db mssql stream --host localhost --user sa --password "******" --database test --query "INSERT INTO audit (user_id, user_name) VALUES (:id, :name)" --inputStream
```

### Options

- `--host` — Database host (default: `localhost`).
- `--port` — Database port (default: `1433`).
- `--database` — Database name (default: `master`).
- `--user` — Database user (default: `sa`).
- `--password` — Database password.
- `--encrypt` — Encrypt the connection; set to `true` for Azure SQL (default: `false`).
- `--query` — SQL query to execute.
- `--file` — Read the SQL query from a file instead.
- `--inputStream` — Read JSON records from stdin and run the query once per record.
- `--tx` — Run a batch within a single transaction.
- `--ignore` — Continue past errors and report them on stderr instead of stopping.

## Schema Introspection

The introspection commands let you explore a database's structure — ideal for AI agents and scripts that need to discover tables and columns before querying. They reuse the same connection flags as `execute` (`--host`, `--port`, `--database`, `--user`, `--password`, `--encrypt`).

**Two-level namespace.** SQL Server has both a database and a schema level, so introspection output namespaces every table with both `database` and `schema`. `--database` selects the connected database (queries run against its `sys`/`INFORMATION_SCHEMA` catalog); an optional `--schema` flag narrows `describe` and `list tables` to a single schema. When `--schema` is omitted it defaults to the connection's current schema via `SCHEMA_NAME()` (usually `dbo`). The `--schema` value is bound as an injection-safe named parameter — `WHERE ... = COALESCE(NULLIF(:schema,''), SCHEMA_NAME())`.

### aux4 db mssql describe

Return the columns of a table as a canonical JSON array, one object per column, in definition order.

```bash
aux4 db mssql describe \
  [--host <hostname>] \
  [--port <port>] \
  [--database <dbname>] \
  [--user <username>] \
  [--password <password>] \
  [--encrypt <true|false>] \
  [--schema <schema>] \
  --table <table_name>
```

Options:

- `--host <hostname>`     Database host (default: `localhost`)
- `--port <port>`         Database port (default: `1433`)
- `--database <dbname>`   Database name (default: `master`)
- `--user <username>`     Database user (default: `sa`)
- `--password <password>` Database password
- `--encrypt <bool>`      Encrypt the connection (default: `false`)
- `--schema <schema>`     Schema to inspect (default: the connection's current schema, `SCHEMA_NAME()`)
- `--table <table_name>`  Name of the table to describe (bound safely as a named parameter)

Example:

```bash
aux4 db mssql describe \
  --host localhost --port 1433 --database mydb --user sa --password "******" \
  --table product
```

```json
[
  {"name":"id","type":"int","nullable":false,"key":"PRI","extra":"identity","comment":"Unique product identifier"},
  {"name":"name","type":"nvarchar","nullable":false,"comment":"Product display name"},
  {"name":"price","type":"decimal","nullable":true,"default":"('0.00')","comment":"Unit price in USD"}
]
```

Only keys that carry a value are returned — `null` and empty (`""`) fields are omitted, so a plain column is just `{"name", "type", "nullable"}`. `nullable` is always present. `default` is returned exactly as SQL Server stores the constraint definition (parenthesized, e.g. `('0.00')`).

### aux4 db mssql desc

Alias of `describe` — accepts the exact same flags and produces the exact same output.

```bash
aux4 db mssql desc \
  --host localhost --port 1433 --database mydb --user sa --password "******" \
  --table product
```

### aux4 db mssql list tables

List the base tables visible in the target schema. Each row carries the table `name`, the `database` and `schema` it lives in (so an agent can fully qualify it), and the table `comment` when one is set.

```bash
aux4 db mssql list tables \
  [--host <hostname>] \
  [--port <port>] \
  [--database <dbname>] \
  [--user <username>] \
  [--password <password>] \
  [--encrypt <true|false>] \
  [--schema <schema>]
```

Example:

```bash
aux4 db mssql list tables \
  --host localhost --port 1433 --database mydb --user sa --password "******"
```

```json
[
  {"name":"product","database":"mydb","schema":"dbo","comment":"Catalog of products for sale"}
]
```

As with `describe`, empty/`null` fields are omitted — a table with no comment is just `{"name", "database", "schema"}`.

### aux4 db mssql list databases

List the databases on the server — the starting point for an agent that needs to discover a database before drilling into its tables.

```bash
aux4 db mssql list databases \
  --host localhost --port 1433 --user sa --password "******"
```

```json
[
  {"name":"master"},
  {"name":"model"},
  {"name":"msdb"},
  {"name":"mydb"},
  {"name":"tempdb"}
]
```

The server's system databases (`master`, `model`, `msdb`, `tempdb`) are included; filter them client-side if you only want application databases.

### aux4 db mssql list schemas

List the schemas defined in the connected database — the level between database and table on SQL Server.

```bash
aux4 db mssql list schemas \
  --host localhost --port 1433 --database mydb --user sa --password "******"
```

```json
[
  {"name":"dbo"},
  {"name":"guest"},
  {"name":"sys"}
]
```

### Canonical Output Schema

Introspection output uses a **fixed, dialect-independent** set of keys so that tooling works identically across every `aux4/db-*` adapter. A key is present only when it carries a value — `null` and empty (`""`) fields are omitted rather than emitted, keeping the output compact.

`describe` — one object per column. When present, keys appear in this order:

| Key | Type | Presence |
|-----|------|----------|
| `name` | string | always |
| `type` | string | always |
| `nullable` | boolean | always — `true` if the column accepts `NULL`, else `false` |
| `default` | string | only when the column has a default constraint |
| `key` | string | only when set — `PRI` for a primary-key column |
| `extra` | string | only when set — `identity` for an `IDENTITY` column |
| `comment` | string | only when the column has an `MS_Description` extended property |

`list tables` — one object per table:

| Key | Type | Presence |
|-----|------|----------|
| `name` | string | always |
| `database` | string | always — the database the table lives in |
| `schema` | string | always — the schema (namespace) the table lives in |
| `comment` | string | only when the table has an `MS_Description` extended property |

**Notes:**
- `nullable` is a real JSON boolean (`true`/`false`) — never the string `"YES"`/`"NO"` and never the number `1`/`0`.
- `comment` carries the semantic description of the column or table (SQL Server's `MS_Description` extended property), which is especially useful for AI agents exploring an unfamiliar schema.
- `name`, `type`, and `nullable` are guaranteed on every `describe` row; everything else is present only when it has a value. This same schema is shared verbatim by the other `aux4/db-*` adapters (namespace naming follows each dialect: MySQL uses `database`; Postgres/MSSQL add `schema`; Oracle uses `schema`).

### Using aux4/config

Connection settings can come from a `config.yaml` instead of repeating flags:

```yaml
config:
  dev:
    host: localhost
    port: 1433
    user: sa
    password: "******"
    database: master
```

```bash
aux4 db mssql execute --configFile config.yaml --config dev --query "SELECT * FROM users WHERE id = :id" --id 1
```

## License

This package is licensed under the [Apache License 2.0](./LICENSE).
