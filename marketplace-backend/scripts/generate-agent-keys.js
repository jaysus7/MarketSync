process.env.NODE_ENV = process.env.NODE_ENV || 'test'

import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { generateAgentKey, hashApiKey } from '../services/hq-agent-hub.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const AGENTS = ['chatgpt', 'claude', 'gemini', 'grok']

async function main() {
  console.log('===============================================================')
  console.log(' MarketSync HQ — Autonomous Agent Staging Credential Generator')
  console.log('===============================================================\n')

  const credentials = []
  const sqlInserts = []

  for (const agentId of AGENTS) {
    const { apiKey, hash, prefix } = generateAgentKey(agentId, `${agentId.toUpperCase()} Staging Key`)
    credentials.push({
      agentId,
      apiKey,
      hash,
      prefix,
      scopes: ['tasks:claim', 'tasks:write', 'evidence:write', 'approvals:request']
    })

    sqlInserts.push(`
INSERT INTO public.hq_agent_credentials (agent_id, name, api_key_hash, key_prefix, scopes, is_active)
VALUES ('${agentId}', '${agentId.toUpperCase()} Staging Key', '${hash}', '${prefix}', '{"tasks:claim", "tasks:write", "evidence:write", "approvals:request"}'::text[], true)
ON CONFLICT (api_key_hash) DO NOTHING;`)
  }

  // If Supabase service role key is configured, insert directly into staging database
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_URL.includes('dummy')) {
    console.log(`[Supabase] Connecting to ${SUPABASE_URL} to persist hashed credentials...`)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    for (const cred of credentials) {
      const { error } = await supabase
        .from('hq_agent_credentials')
        .insert({
          agent_id: cred.agentId,
          name: `${cred.agentId.toUpperCase()} Staging Key`,
          api_key_hash: cred.hash,
          key_prefix: cred.prefix,
          scopes: cred.scopes,
          is_active: true
        })

      if (error) {
        console.error(`  [FAIL] Could not insert credential for ${cred.agentId}:`, error.message)
      } else {
        console.log(`  [OK] Persisted hashed credential for ${cred.agentId} (${cred.prefix}...)`)
      }
    }
  } else {
    console.log('[Notice] Direct Supabase connection not set in current shell environment.')
    console.log('Run the following SQL snippet in the Supabase SQL Editor if you are applying manually:\n')
    console.log(sqlInserts.join('\n'))
  }

  console.log('\n---------------------------------------------------------------')
  console.log(' ONE-TIME AGENT CREDENTIALS (Configure in AI App Environments):')
  console.log('---------------------------------------------------------------')
  for (const cred of credentials) {
    console.log(`\nAgent: [${cred.agentId.toUpperCase()}]`)
    console.log(`Bearer Token: ${cred.apiKey}`)
    console.log(`MCP Header:   Authorization: Bearer ${cred.apiKey}`)
  }
  console.log('\n===============================================================')
  console.log(' NOTE: Stored ONLY as SHA-256 hashes in hq_agent_credentials.')
  console.log(' Do not commit plaintext keys to Git or repository documentation.')
  console.log('===============================================================\n')
}

main().catch(err => {
  console.error('Error generating agent keys:', err)
  process.exit(1)
})
