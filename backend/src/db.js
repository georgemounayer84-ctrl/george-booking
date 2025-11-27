const { Pool } = require('pg');
const dbUrl = process.env.DATABASE_URL;

if(!dbUrl) {
  console.error("FATAL: DATABASE_URL saknas i miljövariabler");
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect()
};
