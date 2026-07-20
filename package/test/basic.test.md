# Basic Database Operations

```beforeAll
aux4 db mssql execute --host localhost --port 1433 --user sa --password MyStr0ng_Pass1 --database master --query "IF DB_ID('test') IS NULL CREATE DATABASE test"
```

```beforeAll
aux4 db mssql execute --host localhost --port 1433 --user sa --password MyStr0ng_Pass1 --database test --query "DROP TABLE IF EXISTS users"
```

```beforeAll
aux4 db mssql execute --host localhost --port 1433 --user sa --password MyStr0ng_Pass1 --database test --query "CREATE TABLE users (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255), age INT, email NVARCHAR(255))"
```

```afterAll
aux4 db mssql execute --host localhost --port 1433 --user sa --password MyStr0ng_Pass1 --database test --query "DROP TABLE IF EXISTS users"
```

## Insert single record

```execute
aux4 db mssql execute --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "INSERT INTO users (name, age, email) VALUES ('John', 28, 'john@example.com')"
```

```expect
[]
```

## Verify inserted record

```execute
aux4 db mssql execute --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "SELECT * FROM users WHERE id = 1"
```

```expect
[{"id":1,"name":"John","age":28,"email":"john@example.com"}]
```

## Insert using parameters

```execute
aux4 db mssql execute --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "INSERT INTO users (name, age, email) VALUES (:name, :age, :email)" --name Peter --age 55 --email peter@nothere.com
```

```expect
[]
```

## Verify parameter insert

```execute
aux4 db mssql execute --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "SELECT * FROM users WHERE id = 2"
```

```expect
[{"id":2,"name":"Peter","age":55,"email":"peter@nothere.com"}]
```

## Insert using JSON file

```file:users.json
[
  {
    "name": "Alice",
    "age": 30,
    "email": "alice@person.com"
  },
  {
    "name": "Bob",
    "age": 25,
    "email": "bob@person.com"
  }
]
```

### Batch insert from stdin

```execute
cat users.json | aux4 db mssql execute --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "INSERT INTO users (name, age, email) VALUES (:name, :age, :email)" --inputStream
```

```expect
{"success":true,"count":2}
```

### Verify batch insert

```execute
aux4 db mssql execute --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "SELECT * FROM users WHERE id IN (3, 4) ORDER BY id"
```

```expect
[{"id":3,"name":"Alice","age":30,"email":"alice@person.com"},{"id":4,"name":"Bob","age":25,"email":"bob@person.com"}]
```

### Overriding one of the parameters

```execute
cat users.json | aux4 db mssql execute --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "INSERT INTO users (name, age, email) VALUES (:name, :age, :email)" --email noemail@example.com --inputStream
```

```expect
{"success":true,"count":2}
```

### Verify overridden parameters

```execute
aux4 db mssql execute --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "SELECT * FROM users WHERE id IN (5, 6) ORDER BY id"
```

```expect
[{"id":5,"name":"Alice","age":30,"email":"noemail@example.com"},{"id":6,"name":"Bob","age":25,"email":"noemail@example.com"}]
```

## Stream mode

### Query all users as stream

```execute
aux4 db mssql stream --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "SELECT * FROM users ORDER BY id"
```

```expect
{"id":1,"name":"John","age":28,"email":"john@example.com"}
{"id":2,"name":"Peter","age":55,"email":"peter@nothere.com"}
{"id":3,"name":"Alice","age":30,"email":"alice@person.com"}
{"id":4,"name":"Bob","age":25,"email":"bob@person.com"}
{"id":5,"name":"Alice","age":30,"email":"noemail@example.com"}
{"id":6,"name":"Bob","age":25,"email":"noemail@example.com"}
```

### Stream with parameters

```execute
aux4 db mssql stream --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "SELECT name, email FROM users WHERE age >= :minAge ORDER BY name, id" --minAge 30
```

```expect
{"name":"Alice","email":"alice@person.com"}
{"name":"Alice","email":"noemail@example.com"}
{"name":"Peter","email":"peter@nothere.com"}
```

## Stream piping

```beforeAll
aux4 db mssql execute --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "DROP TABLE IF EXISTS user_audit"
```

```beforeAll
aux4 db mssql execute --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "CREATE TABLE user_audit (audit_id INT IDENTITY(1,1) PRIMARY KEY, user_id INT, user_name NVARCHAR(255), user_email NVARCHAR(255))"
```

```afterAll
aux4 db mssql execute --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "DROP TABLE IF EXISTS user_audit"
```

### Stream users and insert into audit table

```execute
aux4 db mssql stream --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "SELECT id, name, email FROM users WHERE age >= 25 ORDER BY id" | aux4 db mssql stream --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "INSERT INTO user_audit (user_id, user_name, user_email) VALUES (:id, :name, :email)" --inputStream
```

```expect

```

### Verify audit records count

```execute
aux4 db mssql execute --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "SELECT COUNT(*) AS audit_count FROM user_audit"
```

```expect
[{"audit_count":6}]
```

## Transaction Tests

```file:tx_users.json
[
  {
    "name": "Tx1",
    "age": 35,
    "email": "tx1@example.com"
  },
  {
    "name": "Tx2",
    "age": 42,
    "email": "tx2@example.com"
  }
]
```

### Batch insert within a transaction

```execute
cat tx_users.json | aux4 db mssql execute --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "INSERT INTO users (name, age, email) VALUES (:name, :age, :email)" --inputStream --tx
```

```expect
{"success":true,"count":2}
```

### Verify transaction insert

```execute
aux4 db mssql execute --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "SELECT * FROM users WHERE id IN (7, 8) ORDER BY id"
```

```expect
[{"id":7,"name":"Tx1","age":35,"email":"tx1@example.com"},{"id":8,"name":"Tx2","age":42,"email":"tx2@example.com"}]
```

## Error Handling Tests

### Execute with an invalid query

```execute
aux4 db mssql execute --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "SELECT * FROM nonexistent_table"
```

```error
[{"item":{},"query":"SELECT * FROM nonexistent_table","error":"Invalid object name 'nonexistent_table'."}]
```

### Stream with an invalid query

```execute
aux4 db mssql stream --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "SELECT invalid_column FROM users"
```

```error
{"item":{},"query":"SELECT invalid_column FROM users","error":"Invalid column name 'invalid_column'."}
```

## Ignore Errors Tests

### Execute with --ignore continues without failing

```execute
aux4 db mssql execute --host localhost --port 1433 --database test --user sa --password MyStr0ng_Pass1 --query "SELECT * FROM nonexistent_table" --ignore
```

```expect

```

```error
[{"item":{},"query":"SELECT * FROM nonexistent_table","error":"Invalid object name 'nonexistent_table'."}]
```

# Schema Introspection

```beforeAll
aux4 db mssql execute --host localhost --port 1433 --user sa --password MyStr0ng_Pass1 --database master --query "IF DB_ID('introspect_test') IS NULL CREATE DATABASE introspect_test"
```

```beforeAll
aux4 db mssql execute --host localhost --port 1433 --user sa --password MyStr0ng_Pass1 --database introspect_test --query "DROP TABLE IF EXISTS product"
```

```beforeAll
aux4 db mssql execute --host localhost --port 1433 --user sa --password MyStr0ng_Pass1 --database introspect_test --query "DROP TABLE IF EXISTS tag"
```

```beforeAll
aux4 db mssql execute --host localhost --port 1433 --user sa --password MyStr0ng_Pass1 --database introspect_test --query "CREATE TABLE product (id INT IDENTITY(1,1) NOT NULL PRIMARY KEY, name NVARCHAR(100) NOT NULL, price DECIMAL(10,2) NULL DEFAULT '0.00', sku NVARCHAR(50) NULL)"
```

```beforeAll
aux4 db mssql execute --host localhost --port 1433 --user sa --password MyStr0ng_Pass1 --database introspect_test --query "CREATE TABLE tag (id INT NOT NULL PRIMARY KEY)"
```

```beforeAll
aux4 db mssql execute --host localhost --port 1433 --user sa --password MyStr0ng_Pass1 --database introspect_test --query "EXEC sp_addextendedproperty @name=N'MS_Description', @value=N'Unique product identifier', @level0type=N'SCHEMA', @level0name=N'dbo', @level1type=N'TABLE', @level1name=N'product', @level2type=N'COLUMN', @level2name=N'id'"
```

```beforeAll
aux4 db mssql execute --host localhost --port 1433 --user sa --password MyStr0ng_Pass1 --database introspect_test --query "EXEC sp_addextendedproperty @name=N'MS_Description', @value=N'Product display name', @level0type=N'SCHEMA', @level0name=N'dbo', @level1type=N'TABLE', @level1name=N'product', @level2type=N'COLUMN', @level2name=N'name'"
```

```beforeAll
aux4 db mssql execute --host localhost --port 1433 --user sa --password MyStr0ng_Pass1 --database introspect_test --query "EXEC sp_addextendedproperty @name=N'MS_Description', @value=N'Unit price in USD', @level0type=N'SCHEMA', @level0name=N'dbo', @level1type=N'TABLE', @level1name=N'product', @level2type=N'COLUMN', @level2name=N'price'"
```

```beforeAll
aux4 db mssql execute --host localhost --port 1433 --user sa --password MyStr0ng_Pass1 --database introspect_test --query "EXEC sp_addextendedproperty @name=N'MS_Description', @value=N'Catalog of products for sale', @level0type=N'SCHEMA', @level0name=N'dbo', @level1type=N'TABLE', @level1name=N'product'"
```

```afterAll
aux4 db mssql execute --host localhost --port 1433 --user sa --password MyStr0ng_Pass1 --database master --query "IF DB_ID('introspect_test') IS NOT NULL BEGIN ALTER DATABASE introspect_test SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE introspect_test; END"
```

## Describe a table

### should return canonical column metadata, dropping null and empty fields

```execute
aux4 db mssql describe --host localhost --port 1433 --database introspect_test --user sa --password MyStr0ng_Pass1 --table product
```

```expect:json
[
  {
    "name": "id",
    "type": "int",
    "nullable": false,
    "key": "PRI",
    "extra": "identity",
    "comment": "Unique product identifier"
  },
  {
    "name": "name",
    "type": "nvarchar",
    "nullable": false,
    "comment": "Product display name"
  },
  {
    "name": "price",
    "type": "decimal",
    "nullable": true,
    "default": "('0.00')",
    "comment": "Unit price in USD"
  },
  {
    "name": "sku",
    "type": "nvarchar",
    "nullable": true
  }
]
```

### should keep only present keys per row (null/empty dropped, in definition order)

```execute
aux4 db mssql describe --host localhost --port 1433 --database introspect_test --user sa --password MyStr0ng_Pass1 --table product | jq -c 'map(keys_unsorted)'
```

```expect
[["name","type","nullable","key","extra","comment"],["name","type","nullable","comment"],["name","type","nullable","default","comment"],["name","type","nullable"]]
```

### should reduce a plain column to just name, type, nullable

```execute
aux4 db mssql describe --host localhost --port 1433 --database introspect_test --user sa --password MyStr0ng_Pass1 --table product | jq -c '.[3]'
```

```expect
{"name":"sku","type":"nvarchar","nullable":true}
```

### should never emit a null or empty-string value

```execute
aux4 db mssql describe --host localhost --port 1433 --database introspect_test --user sa --password MyStr0ng_Pass1 --table product | jq -c '[.[] | to_entries[] | .value] | map(select(. == null or . == "")) | length'
```

```expect
0
```

### should emit nullable as a real JSON boolean (not "YES"/"NO", not 1/0)

```execute
aux4 db mssql describe --host localhost --port 1433 --database introspect_test --user sa --password MyStr0ng_Pass1 --table product | jq -c 'map(.nullable | type)'
```

```expect
["boolean","boolean","boolean","boolean"]
```

## Describe a table with an explicit schema

### should accept the --schema flag and return the same columns

```execute
aux4 db mssql describe --host localhost --port 1433 --database introspect_test --user sa --password MyStr0ng_Pass1 --schema dbo --table product | jq -c 'map(.name)'
```

```expect
["id","name","price","sku"]
```

### should return no rows for a non-existent schema (proves :schema binds)

```execute
aux4 db mssql describe --host localhost --port 1433 --database introspect_test --user sa --password MyStr0ng_Pass1 --schema nope --table product
```

```expect
[]
```

## List tables

### should list base tables qualified by database and schema, with comments when present

```execute
aux4 db mssql list tables --host localhost --port 1433 --database introspect_test --user sa --password MyStr0ng_Pass1
```

```expect:json
[
  {
    "name": "product",
    "database": "introspect_test",
    "schema": "dbo",
    "comment": "Catalog of products for sale"
  },
  {
    "name": "tag",
    "database": "introspect_test",
    "schema": "dbo"
  }
]
```

### should keep only present keys per row (empty comment dropped)

```execute
aux4 db mssql list tables --host localhost --port 1433 --database introspect_test --user sa --password MyStr0ng_Pass1 | jq -c 'map(keys_unsorted)'
```

```expect
[["name","database","schema","comment"],["name","database","schema"]]
```

### should never emit a null or empty-string value

```execute
aux4 db mssql list tables --host localhost --port 1433 --database introspect_test --user sa --password MyStr0ng_Pass1 | jq -c '[.[] | to_entries[] | .value] | map(select(. == null or . == "")) | length'
```

```expect
0
```

### should filter by an explicit --schema

```execute
aux4 db mssql list tables --host localhost --port 1433 --database introspect_test --user sa --password MyStr0ng_Pass1 --schema dbo | jq -c 'map(.name)'
```

```expect
["product","tag"]
```

## List databases

### should include a user database in the server listing

```execute
aux4 db mssql list databases --host localhost --port 1433 --user sa --password MyStr0ng_Pass1 | jq -c 'map(.name) | index("introspect_test") != null'
```

```expect
true
```

### should return one canonical {name} object per database

```execute
aux4 db mssql list databases --host localhost --port 1433 --user sa --password MyStr0ng_Pass1 | jq -c '[.[] | keys] | unique'
```

```expect
[["name"]]
```

## List schemas

### should include the dbo schema in the current database

```execute
aux4 db mssql list schemas --host localhost --port 1433 --database introspect_test --user sa --password MyStr0ng_Pass1 | jq -c 'map(.name) | index("dbo") != null'
```

```expect
true
```

### should return one canonical {name} object per schema

```execute
aux4 db mssql list schemas --host localhost --port 1433 --database introspect_test --user sa --password MyStr0ng_Pass1 | jq -c '[.[] | keys] | unique'
```

```expect
[["name"]]
```
