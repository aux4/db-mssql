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
