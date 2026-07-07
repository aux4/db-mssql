import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'main.js',
  output: {
    file: 'package/lib/aux4-db-mssql.js',
    format: 'es',
    banner: '#!/usr/bin/env node',
    inlineDynamicImports: true
  },
  plugins: [
    nodeResolve({
      preferBuiltins: true,
      browser: false
    }),
    commonjs(),
    json()
  ],
  external: [
    'fs',
    'path',
    'crypto',
    'util',
    'stream',
    'url',
    'events',
    'buffer',
    'process',
    'os',
    'child_process',
    'zlib',
    'tls',
    'net',
    'http',
    'https',
    'querystring',
    'dns',
    'assert',
    'string_decoder',
    'timers',
    'constants'
  ]
};
