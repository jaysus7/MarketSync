import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const studioShell = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')
const fabricAdapter = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/fabric-adapter.js', import.meta.url), 'utf8')
const aiRoute = readFileSync(new URL('../../marketplace-backend/routes/submodules/ai-design-studio.js', import.meta.url), 'utf8')
const aiJs = readFileSync(new URL('../../marketplace-backend/routes/ai.js', import.meta.url), 'utf8')
const renderYaml = readFileSync(new URL('../../render.yaml', import.meta.url), 'utf8')

test('Design Studio AI is no longer paywalled — the AI Boost lock screen and its gating function are gone', () => {
  assert.doesNotMatch(studioShell, /studioHasPaidAi/, 'the entitlement gate must be fully removed, not just bypassed')
  assert.doesNotMatch(studioShell, /AI Content is locked/)
  assert.doesNotMatch(studioShell, /View AI Boost/)
  assert.doesNotMatch(studioShell, /AI 🔒/, 'the sidebar tab must not show a lock icon any more')
})

test('the standalone AI tab is gone — generation is folded into Text, Photos and Templates', () => {
  assert.doesNotMatch(studioShell, /tool-btn-ai\b/, 'the AI sidebar button must be removed')
  assert.doesNotMatch(studioShell, /setStudioTool\('ai'\)/)
  assert.doesNotMatch(studioShell, /tool === 'ai'/, 'the standalone ai tool panel branch must be removed')
  assert.match(studioShell, /setStudioTool\('text'\)/, 'a Text tab must exist in its place')
  assert.match(studioShell, /id="tool-btn-text"/)
})

test('the Text tab has the copy prompt and a Google Fonts picker', () => {
  const panel = studioShell.match(/\} else if \(tool === 'text'\) \{[\s\S]*?\n {2}\} else if \(tool === 'brand'\)/)?.[0] || ''
  assert.ok(panel, 'the text tool panel must exist')
  assert.match(panel, /id="studio-ai-prompt"/)
  assert.match(panel, /onclick="generateStudioAiCopy\(\)"/)
  assert.match(panel, /id="studio-font-picker"/)
  assert.match(panel, /studioPickFont\(/)
})

test('the Photos tab has the image generation prompt alongside the Pexels search', () => {
  const panel = studioShell.match(/\} else if \(tool === 'photos'\) \{[\s\S]*?\n {2}\} else if \(tool === 'videos'\)/)?.[0] || ''
  assert.ok(panel, 'the photos tool panel must exist')
  assert.match(panel, /id="studio-photo-query"/, 'Pexels search must still be present')
  assert.match(panel, /id="studio-ai-image-prompt"/)
  assert.match(panel, /onclick="generateStudioAiImage\(\)"/)
})

test('the Templates tab has the template generation prompt alongside the template library', () => {
  const panel = studioShell.match(/if \(tool === 'templates'\) \{[\s\S]*?\n {2}\} else if \(tool === 'inventory'\)/)?.[0] || ''
  assert.ok(panel, 'the templates tool panel must exist')
  assert.match(panel, /id="studio-template-cards"/, 'the template library must still be present')
  assert.match(panel, /id="studio-ai-template-prompt"/)
  assert.match(panel, /onclick="generateStudioAiTemplate\(\)"/)
})

test('a curated list of Google Fonts is loaded on demand and can be applied to text', () => {
  assert.match(studioShell, /const STUDIO_GOOGLE_FONTS = \[/)
  assert.match(studioShell, /function loadStudioGoogleFonts\(\)/)
  assert.match(studioShell, /fonts\.googleapis\.com\/css2/)
  assert.match(studioShell, /function studioPickFont\(fontName\)/)
  assert.match(studioShell, /updateSelectedText\(\{ fontFamily: window\.__studioSelectedFont \}\)/)
  assert.match(studioShell, /if \(tool === 'text'\) setTimeout\(loadStudioGoogleFonts, 0\)/, 'fonts must load lazily, not on every page load')
  assert.match(fabricAdapter, /fontFamily: options\.fontFamily \|\| 'Manrope, sans-serif'/, 'addText must respect a chosen font, not hardcode Manrope')
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
  assert.match(aiRoute, /rateLimit\('studio-ai-image', \d+, 60 \* 60 \* 1000, \{ dealership: true \}\)/)
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

test('image generation calls OpenAI when a key is configured, and is honest with a 503 when it is not', () => {
  const imgRoute = aiRoute.match(/app\.post\('\/ai\/studio-image'[\s\S]*?\n {2}\}\)/)?.[0] || ''
  assert.ok(imgRoute, 'the /ai/studio-image route must exist')
  assert.match(imgRoute, /process\.env\.OPENAI_API_KEY/)
  assert.match(imgRoute, /res\.status\(503\)\.json\(\{ error: 'AI image generation is not configured yet for this server\.' \}\)/)
  assert.match(imgRoute, /api\.openai\.com\/v1\/images\/generations/)
})

test('OPENAI_API_KEY is declared as a configurable secret alongside ANTHROPIC_API_KEY in the Render blueprint', () => {
  assert.match(renderYaml, /- key: OPENAI_API_KEY\n\s*sync: false/)
})
