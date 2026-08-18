import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const studioShell = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')
const aiRoute = readFileSync(new URL('../../marketplace-backend/routes/submodules/ai-design-studio.js', import.meta.url), 'utf8')
const aiJs = readFileSync(new URL('../../marketplace-backend/routes/ai.js', import.meta.url), 'utf8')

test('Design Studio AI is no longer paywalled — the AI Boost lock screen and its gating function are gone', () => {
  assert.doesNotMatch(studioShell, /studioHasPaidAi/, 'the entitlement gate must be fully removed, not just bypassed')
  assert.doesNotMatch(studioShell, /AI Content is locked/)
  assert.doesNotMatch(studioShell, /View AI Boost/)
  assert.doesNotMatch(studioShell, /AI 🔒/, 'the sidebar tab must not show a lock icon any more')
})

test('the AI panel has three independent prompt sections — images, text, and templates', () => {
  const panel = studioShell.match(/\} else if \(tool === 'ai'\) \{[\s\S]*?\n {2}\} else if \(tool === 'brand'\)/)?.[0] || ''
  assert.ok(panel, 'the ai tool panel must exist')
  assert.match(panel, /id="studio-ai-image-prompt"/)
  assert.match(panel, /onclick="generateStudioAiImage\(\)"/)
  assert.match(panel, /id="studio-ai-prompt"/)
  assert.match(panel, /onclick="generateStudioAiCopy\(\)"/)
  assert.match(panel, /id="studio-ai-template-prompt"/)
  assert.match(panel, /onclick="generateStudioAiTemplate\(\)"/)
})

test('each section calls its own dedicated, ungated backend endpoint', () => {
  const imageFn = studioShell.match(/async function generateStudioAiImage\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(imageFn, 'generateStudioAiImage must exist')
  assert.match(imageFn, /apiSendJson\('\/ai\/studio-image', 'POST', \{ prompt \}\)/)
  assert.match(imageFn, /addLibraryImageToCanvas\(/, 'a generated image must be addable to the canvas the same way library photos are')

  const copyFn = studioShell.match(/async function generateStudioAiCopy\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(copyFn, 'generateStudioAiCopy must exist')
  assert.match(copyFn, /apiSendJson\('\/ai\/studio-copy', 'POST', \{ prompt \}\)/)
  assert.doesNotMatch(copyFn, /\/ai\/assistant/, 'must not reuse the paid AI Assistant endpoint any more')

  const templateFn = studioShell.match(/async function generateStudioAiTemplate\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(templateFn, 'generateStudioAiTemplate must exist')
  assert.match(templateFn, /apiSendJson\('\/ai\/studio-template', 'POST', \{ prompt, format_key: formatKey, width: size\.w, height: size\.h \}\)/)
  assert.match(templateFn, /__studioAdapter\.renderScene\(scene\)/, 'a generated template must load onto the canvas the same way the template library does')
})

test('the new Design Studio AI routes are registered and are NOT gated on ai_boost_active/inv_intel_active', () => {
  assert.match(aiJs, /registerAiDesignStudioRoutes\(app\)/)

  assert.match(aiRoute, /app\.post\('\/ai\/studio-copy', requireAuth, requireMfa,/)
  assert.match(aiRoute, /app\.post\('\/ai\/studio-template', requireAuth, requireMfa,/)
  assert.match(aiRoute, /app\.post\('\/ai\/studio-image', requireAuth, requireMfa,/)
  assert.doesNotMatch(aiRoute, /dealer\??\.\w*ai_boost_active/, 'Design Studio AI must not check the paid entitlement the AI Assistant checks')
  assert.doesNotMatch(aiRoute, /dealer\??\.\w*inv_intel_active/)

  // Rate-limited instead of paywalled — cost protection, not a monetization gate.
  assert.match(aiRoute, /rateLimit\('studio-ai-copy', \d+, 60 \* 60 \* 1000, \{ dealership: true \}\)/)
  assert.match(aiRoute, /rateLimit\('studio-ai-template', \d+, 60 \* 60 \* 1000, \{ dealership: true \}\)/)
})

test('template generation constrains the AI to a fixed tool schema and clamps the result to the canvas bounds server-side', () => {
  assert.match(aiRoute, /tool_choice: \{ type: 'tool', name: 'return_design_template' \}/, 'structured tool-use output, not free-form JSON parsing')
  assert.match(aiRoute, /const clamp = \(n, min, max\)/)
  assert.match(aiRoute, /clamp\(el\.x, 0, width - w\)/)
  assert.match(aiRoute, /clamp\(el\.y, 0, height - h\)/)
  // Placeholders, never invented real dealer/vehicle data.
  assert.match(aiRoute, /\{\{vehicle\.year\}\}, \{\{vehicle\.make\}\}/)
  assert.match(aiRoute, /never invent a specific price, phone number, or vehicle/)
})

test('image generation is honest about not being wired to a provider yet — a clear 503, not a fake success', () => {
  const imgRoute = aiRoute.match(/app\.post\('\/ai\/studio-image'[\s\S]*?\n {2}\}\)/)?.[0] || ''
  assert.ok(imgRoute, 'the /ai/studio-image route must exist')
  assert.match(imgRoute, /res\.status\(503\)\.json\(\{ error: 'AI image generation is not configured yet for this server\.' \}\)/)
})
