import { supabaseAdmin } from './shared.js';
async function inspect() {
  const { data, error } = await supabaseAdmin.from('market_cache').select('*').limit(1);
  console.log("Error:", error);
  console.log("Data:", data);
}
inspect().then(() => process.exit(0));
