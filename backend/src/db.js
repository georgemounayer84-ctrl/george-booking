// ------------------------------------------------------
// Supabase Database Client
// ------------------------------------------------------
const { createClient } = require('@supabase/supabase-js');

// Läs variabler från GitHub secrets
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("FATAL: SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY saknas");
  process.exit(1);
}

// Skapa Supabase-klienten
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

// Exportera som liknar tidigare query-interface
module.exports = {
  supabase
};
