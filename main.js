import mssql from 'mssql';

const AUX4_PARAMS = ['host', 'port', 'database', 'user', 'password', 'encrypt', 'action', 'sql', 'inputStream', 'tx', 'ignore', 'aux4HomeDir', 'configDir', 'packageDir', 'query', 'file'];

function validateArgs() {
  const args = process.argv.slice(2);
  if (args.length < 6) {
    console.error("Usage: aux4-db-mssql <host> <port> <database> <user> <password> <encrypt>");
    process.exit(1);
  }
  return {
    server: args[0],
    port: parseInt(args[1]),
    database: args[2],
    user: args[3],
    password: args[4],
    options: {
      encrypt: args[5] === 'true',
      trustServerCertificate: true
    }
  };
}

function createErrorOutput(item, query, error) {
  return {
    item: item || null,
    query: query || 'unknown',
    error: error
  };
}

function filterAux4Params(params) {
  const filtered = { ...params };
  AUX4_PARAMS.forEach(param => delete filtered[param]);
  return filtered;
}

function outputError(errorOutput, isArray = true) {
  const output = isArray ? [errorOutput] : errorOutput;
  console.error(JSON.stringify(output));
}

function exitOnError(shouldIgnore) {
  if (!shouldIgnore) {
    process.exit(1);
  }
}

function parseInput(trimmedInput) {
  try {
    const parsed = JSON.parse(trimmedInput);
    validateRequest(parsed);
    return { type: 'single', data: parsed };
  } catch (singleJsonError) {
    const lines = trimmedInput.split("\n").filter(line => line.trim());
    if (lines.length > 1) {
      try {
        const items = lines.map(line => {
          const parsed = JSON.parse(line.trim());
          validateRequest(parsed);
          return parsed;
        });
        return { type: 'ndjson', data: items };
      } catch (ndjsonError) {
        throw singleJsonError;
      }
    }
    throw singleJsonError;
  }
}

function validateRequest(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('Request must be an object');
  }
  if (!request.action) {
    throw new Error('Request must have an action property');
  }
  if (!request.sql) {
    throw new Error('Request must have an sql property');
  }
}

function readStdinData() {
  return new Promise((resolve, reject) => {
    let inputData = "";
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", chunk => {
      inputData += chunk;
    });

    process.stdin.on("end", () => resolve(inputData));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const connectionConfig = validateArgs();

  try {
    const inputData = await readStdinData();
    const trimmedInput = inputData.trim();

    if (!trimmedInput) {
      process.exit(4);
    }

    const parsedInput = parseInput(trimmedInput);

    if (parsedInput.type === 'single') {
      await processRequest(connectionConfig, parsedInput.data);
    } else {
      for (const item of parsedInput.data) {
        if (item.action && item.sql) {
          try {
            await processRequest(connectionConfig, item);
          } catch (error) {
            const errorOutput = createErrorOutput(item, item.sql, error.message);
            outputError(errorOutput, false);
          }
        }
      }
    }
  } catch (error) {
    const errorOutput = createErrorOutput(
      inputData ? inputData.trim() : null,
      'unknown',
      `Error parsing JSON input: ${error.message}`
    );
    outputError(errorOutput, false);
    process.exit(1);
  }
}

main();

async function processRequest(connectionConfig, request) {
  let pool;

  try {
    pool = await mssql.connect(connectionConfig);
  } catch (error) {
    const errorOutput = createErrorOutput(request, request?.sql, error.message);
    outputError(errorOutput, false);
    process.exit(1);
  }

  try {
    switch (request.action) {
      case "execute":
        await executeQuery(pool, request);
        break;
      case "executeBatch":
        await executeBatch(pool, request);
        break;
      case "stream":
        await streamQuery(pool, request);
        break;
      case "streamBatch":
        await streamBatch(pool, request);
        break;
      default:
        const errorOutput = createErrorOutput(request, request?.sql, `Unknown action: ${request.action}`);
        outputError(errorOutput, false);
        process.exit(1);
    }
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

function convertParameterSyntax(sql) {
  return sql.replace(/:(\w+)/g, (match, paramName) => {
    return `@${paramName}`;
  });
}

function bindParameters(request, sql, params) {
  const bound = {};
  sql.replace(/:(\w+)/g, (match, paramName) => {
    if (!bound[paramName]) {
      bound[paramName] = true;
      request.input(paramName, params[paramName] !== undefined ? params[paramName] : null);
    }
    return match;
  });
}

async function executeQuery(pool, request) {
  const convertedSql = convertParameterSyntax(request.sql);
  const params = request.params || {};
  const sqlParams = filterAux4Params(params);

  try {
    const poolRequest = pool.request();
    bindParameters(poolRequest, request.sql, params);
    const result = await poolRequest.query(convertedSql);
    console.log(JSON.stringify(result.recordset || []));
  } catch (error) {
    const errorOutput = createErrorOutput(sqlParams, request.sql, error.message);
    outputError(errorOutput);
    exitOnError(request.ignore);
  }
}

async function executeBatch(pool, request) {
  if (request.tx) {
    await executeBatchWithTransaction(pool, request);
  } else {
    await executeBatchWithoutTransaction(pool, request);
  }
}

async function processItemInBatch(pool, convertedSql, originalSql, item, request, errors, transaction) {
  try {
    const poolRequest = transaction ? new mssql.Request(transaction) : pool.request();
    bindParameters(poolRequest, originalSql, item);
    const result = await poolRequest.query(convertedSql);
    return { success: true, rows: result.recordset || [] };
  } catch (error) {
    const cleanItem = filterAux4Params(item);
    const errorOutput = createErrorOutput(cleanItem, request.sql, error.message);
    errors.push(errorOutput);
    return { success: false, error };
  }
}

function outputBatchResults(results, hasAnyResults, itemCount) {
  if (!hasAnyResults) {
    console.log(JSON.stringify({ success: true, count: itemCount }));
  } else {
    console.log(JSON.stringify(results));
  }
}

function handleBatchErrors(errors, request, fallbackError = null) {
  if (errors.length > 0) {
    console.error(JSON.stringify(errors));
  } else if (fallbackError) {
    const errorOutput = createErrorOutput(null, request.sql, fallbackError.message);
    outputError(errorOutput);
  }
  exitOnError(request.ignore);
}

async function executeBatchWithTransaction(pool, request) {
  const convertedSql = convertParameterSyntax(request.sql);
  const errors = [];
  const transaction = new mssql.Transaction(pool);

  try {
    await transaction.begin();

    const results = [];
    let hasAnyResults = false;

    for (const item of request.items) {
      const result = await processItemInBatch(pool, convertedSql, request.sql, item, request, errors, transaction);
      if (result.success) {
        results.push(...result.rows);
        if (result.rows.length > 0) {
          hasAnyResults = true;
        }
      } else {
        await transaction.rollback();
        throw result.error;
      }
    }

    await transaction.commit();
    outputBatchResults(results, hasAnyResults, request.items.length);
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // Ignore rollback errors
    }
    handleBatchErrors(errors, request, error);
  }
}

async function executeBatchWithoutTransaction(pool, request) {
  const convertedSql = convertParameterSyntax(request.sql);
  const results = [];
  const errors = [];
  let hasAnyResults = false;

  for (const item of request.items) {
    const result = await processItemInBatch(pool, convertedSql, request.sql, item, request, errors);
    if (result.success) {
      if (request.ignore && result.rows.length > 0) {
        // When ignoring errors, output successful results immediately
        console.log(JSON.stringify(result.rows));
        hasAnyResults = true;
      } else {
        results.push(...result.rows);
        if (result.rows.length > 0) {
          hasAnyResults = true;
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error(JSON.stringify(errors));
    exitOnError(request.ignore);
  }

  // Output collected results when not using ignore mode OR when using ignore mode but no errors occurred
  if (!request.ignore || (request.ignore && errors.length === 0)) {
    if (!hasAnyResults && errors.length === 0) {
      outputBatchResults([], false, request.items.length);
    } else if (hasAnyResults) {
      outputBatchResults(results, true, request.items.length);
    }
  }
}

function streamRows(rows) {
  rows.forEach(row => {
    console.log(JSON.stringify(row));
  });
}

async function streamQuery(pool, request) {
  const convertedSql = convertParameterSyntax(request.sql);
  const params = request.params || {};
  const sqlParams = filterAux4Params(params);

  try {
    const poolRequest = pool.request();
    bindParameters(poolRequest, request.sql, params);
    const result = await poolRequest.query(convertedSql);
    streamRows(result.recordset || []);
  } catch (error) {
    const errorOutput = createErrorOutput(sqlParams, request.sql, error.message);
    outputError(errorOutput, false);
    exitOnError(request.ignore);
  }
}

async function processStreamItem(pool, convertedSql, originalSql, item, request, transaction) {
  try {
    const poolRequest = transaction ? new mssql.Request(transaction) : pool.request();
    bindParameters(poolRequest, originalSql, item);
    const result = await poolRequest.query(convertedSql);
    streamRows(result.recordset || []);
    return { success: true };
  } catch (error) {
    const cleanItem = filterAux4Params(item);
    const errorOutput = createErrorOutput(cleanItem, request.sql, error.message);
    outputError(errorOutput, false);
    return { success: false, error };
  }
}

async function streamBatch(pool, request) {
  const convertedSql = convertParameterSyntax(request.sql);

  try {
    if (request.tx) {
      const transaction = new mssql.Transaction(pool);
      await transaction.begin();

      for (const item of request.items) {
        const result = await processStreamItem(pool, convertedSql, request.sql, item, request, transaction);
        if (!result.success && !request.ignore) {
          await transaction.rollback();
          throw result.error;
        }
      }

      await transaction.commit();
    } else {
      for (const item of request.items) {
        await processStreamItem(pool, convertedSql, request.sql, item, request);
      }
    }
  } catch (error) {
    try {
      // Transaction rollback already handled above
    } catch (rollbackError) {
      // Ignore rollback errors
    }
    const errorOutput = createErrorOutput(null, request.sql, error.message);
    outputError(errorOutput, false);
    exitOnError(request.ignore);
  }
}
