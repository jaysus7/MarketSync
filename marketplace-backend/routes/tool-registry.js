/**
 * Agent Tool Registry (kernel contract §5).
 *
 * Every capability an agent may invoke — the in-house AI runtime today, an external
 * MCP client tomorrow — is registered here as an MCP-shaped tool:
 *   { name, description, input_schema, handler, surface, audit }
 *
 * Handlers call the OWNING engine's read/write APIs (which emit events); the registry
 * itself NEVER touches the DB. This is the agent-facing twin of the Action Executor
 * registry: executors run deterministic workflow steps, tools run agent-chosen actions
 * — same { name, …, handler } shape, one pattern.
 *
 * `surface` scopes a tool to the agent(s) allowed to call it (e.g. 'sales_chat'), so a
 * public chatbot can never invoke an internal/privileged tool even if the model emits
 * its name. callTool enforces the surface, never throws, and — for tools flagged
 * `audit` — writes a timeline-only note so the invocation is traceable.
 *
 * Adding an agent capability is now: registerTool() from the owning engine + expose it
 * on a surface. No bespoke dispatch, no per-engine tool plumbing.
 */
import { emitEvent } from './events.js'

const TOOLS = new Map()
const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v])

// registerTool({ name, description, input_schema, handler, surface?, audit? })
export function registerTool(def) {
  if (!def?.name || typeof def.handler !== 'function') throw new Error('registerTool: name + handler required')
  if (!def.input_schema) def.input_schema = { type: 'object', properties: {} }
  def.surfaces = asArray(def.surface || def.surfaces || 'default')
  TOOLS.set(def.name, def)
  return def
}

export function getTool(name) { return TOOLS.get(name) || null }
export function listTools() { return [...TOOLS.values()] }

// MCP-shaped definitions for a given surface — exactly what the model (or an MCP
// server) is shown. A tool the surface can't see can't be called.
export function toolDefs(surface = 'default') {
  return listTools()
    .filter(t => t.surfaces.includes(surface))
    .map(({ name, description, input_schema }) => ({ name, description, input_schema }))
}

// Dispatch one tool call. Enforces the surface, runs the handler, optionally audits.
// Never throws — returns the handler result or an { error } object the agent can read.
export async function callTool(name, args = {}, ctx = {}, { surface = 'default' } = {}) {
  const tool = TOOLS.get(name)
  if (!tool) return { error: 'unknown tool: ' + name }
  if (!tool.surfaces.includes(surface)) return { error: `tool '${name}' not available on this surface` }
  let out
  try { out = await tool.handler(args, ctx) }
  catch (e) { return { error: String(e?.message || e).slice(0, 300) } }
  if (tool.audit && ctx.dealershipId) {
    try {
      const entityId = ctx.entityId || ctx.contactRef?.id || ctx.conversation?.id || null
      const entityType = ctx.entityType || (ctx.contactRef?.id ? 'customer' : 'conversation')
      emitEvent({
        dealershipId: ctx.dealershipId, eventName: 'agent.tool_called', entityType, entityId,
        summary: `AI tool: ${name}`, department: 'AI',
        payload: { engine: true, tool: name, surface },   // engine=true → timeline-only, never re-triggers a workflow
      })
    } catch { /* audit is best-effort — never break the tool call */ }
  }
  return out
}
