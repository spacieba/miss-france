'use strict';

const pg = require('postgres');
const postgres = pg.default || pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL manquant : URL de connexion Supabase (Transaction pooler, port 6543).');
}

// Connexion au pooler Supabase (mode transaction) : pas de requêtes préparées.
// Les bigint (ids, COUNT) sont convertis en Number : on reste très loin de 2^53.
const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require',
  max: process.env.VERCEL ? 1 : 5,
  idle_timeout: 20,
  connect_timeout: 10,
  types: {
    bigint: { to: 20, from: [20], serialize: x => String(x), parse: x => Number(x) }
  }
});

module.exports = sql;
