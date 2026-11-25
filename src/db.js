'use strict';

const pg = require('postgres');
const postgres = pg.default || pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL manquant : URL de connexion Supabase (Transaction pooler, port 6543).');
}

// Connexion au pooler Supabase (mode transaction) : pas de requêtes préparées.
// Les bigint (ids, COUNT) sont convertis en Number : on reste très loin de 2^53.
const create = () => postgres(process.env.DATABASE_URL, {
  prepare: false,
  ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require',
  max: process.env.VERCEL ? 1 : 5,
  idle_timeout: 20,
  connect_timeout: 10,
  types: {
    bigint: { to: 20, from: [20], serialize: x => String(x), parse: x => Number(x) }
  }
});

let current = create();

// Sur Vercel, l'instance est gelée entre deux requêtes. Une connexion restée ouverte pendant le gel
// se bloque souvent au réveil (réponses de 5 à 15 s, voire « Task timed out »). `recycle()` abandonne
// donc l'ancien client et repart d'une connexion neuve ; src/app.js l'appelle après une pause.
function recycle() {
  const old = current;
  current = create();
  old.end({ timeout: 0 }).catch(() => {});
}

// Le reste du code garde un seul `sql` : il renvoie toujours vers le client en cours.
const sql = new Proxy(function () {}, {
  apply: (_target, _this, args) => current(...args),
  get: (_target, prop) => {
    if (prop === 'recycle') return recycle;
    const value = current[prop];
    return typeof value === 'function' ? value.bind(current) : value;
  }
});

module.exports = sql;
