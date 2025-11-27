const fs = require('fs');
const path = require('path');
const db = require('./db');

async function migrate(){
  const sql = fs.readFileSync(path.join(__dirname,'../migrations.sql')).toString();
  try {
    await db.query(sql);
    console.log('Migrationer körda');
    process.exit(0);
  } catch(e){
    console.error('Migration error', e);
    process.exit(1);
  }
}

migrate();
