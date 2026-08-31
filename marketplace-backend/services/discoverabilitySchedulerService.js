/**
 * Discoverability Scheduler Service
 *
 * Manages periodic audit jobs and recommendation generation.
 * Runs on a configurable schedule to keep discovery data fresh.
 */

import { supabaseAdmin } from '../shared.js'
import { runComprehensiveDiscoverabilityAudit } from './discoverabilityMonitoringService.js'

const SCHEDULER_STATE = {
  jobs: new Map(), // dealership_id -> { intervalId, config }
  defaultConfig: {
    enabled: true,
    frequencyHours: 24,
    autoApplySmallFixes: false,
    maxConcurrentAudits: 2,
    auditTimeoutMs: 600000 // 10 minutes
  }
}

/**
 * Start periodic audit for a dealership
 */
export function startPeriodicAudit(dealershipId, config = {}) {
  const finalConfig = { ...SCHEDULER_STATE.defaultConfig, ...config }

  if (SCHEDULER_STATE.jobs.has(dealershipId)) {
    console.warn(`[discoverability/scheduler] Audit already running for ${dealershipId}`)
    return false
  }

  const frequencyMs = finalConfig.frequencyHours * 3600000
  const intervalId = setInterval(async () => {
    try {
      await executeAuditJob(dealershipId, finalConfig)
    } catch (err) {
      console.error(`[discoverability/scheduler] Job failed for ${dealershipId}:`, err.message)
    }
  }, frequencyMs)

  // Store the job
  SCHEDULER_STATE.jobs.set(dealershipId, { intervalId, config: finalConfig })

  // Run first audit immediately (skip in test mode)
  if (process.env.NODE_ENV !== 'test') {
    executeAuditJob(dealershipId, finalConfig).catch(err => {
      console.error(`[discoverability/scheduler] Initial job failed for ${dealershipId}:`, err.message)
    })
  }

  console.log(`[discoverability/scheduler] Started periodic audit for ${dealershipId} (${finalConfig.frequencyHours}h)`)
  return true
}

/**
 * Stop periodic audit for a dealership
 */
export function stopPeriodicAudit(dealershipId) {
  const job = SCHEDULER_STATE.jobs.get(dealershipId)
  if (!job) {
    console.warn(`[discoverability/scheduler] No job found for ${dealershipId}`)
    return false
  }

  clearInterval(job.intervalId)
  SCHEDULER_STATE.jobs.delete(dealershipId)
  console.log(`[discoverability/scheduler] Stopped periodic audit for ${dealershipId}`)
  return true
}

/**
 * Execute a single audit job
 */
async function executeAuditJob(dealershipId, config) {
  const jobId = `audit-${dealershipId}-${Date.now()}`

  try {
    // Run comprehensive audit
    const audit = await Promise.race([
      runComprehensiveDiscoverabilityAudit(dealershipId),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Audit timeout')), config.auditTimeoutMs)
      )
    ])

    if (!audit?.recommendations) {
      console.log(`[discoverability/scheduler] No recommendations for ${dealershipId}`)
      return { success: false, reason: 'No recommendations' }
    }

    // Persist recommendations
    for (const rec of audit.recommendations) {
      try {
        await supabaseAdmin
          .from('discoverability_recommendations')
          .upsert({
            id: rec.id,
            dealership_id: dealershipId,
            ...rec
          }, { onConflict: 'id' })
      } catch (err) {
        console.warn(`[discoverability/scheduler] Failed to persist recommendation:`, err.message)
      }
    }

    // Update audit metadata
    await recordAuditExecution(dealershipId, {
      jobId,
      recommendationCount: audit.recommendations.length,
      timestamp: new Date().toISOString(),
      success: true
    }).catch(err => console.warn('[discoverability/scheduler] Failed to record audit:', err.message))

    console.log(`[discoverability/scheduler] Audit completed for ${dealershipId}: ${audit.recommendations.length} recommendations`)
    return { success: true, count: audit.recommendations.length }
  } catch (err) {
    console.error(`[discoverability/scheduler] Audit failed for ${dealershipId}:`, err.message)

    // Record failure
    await recordAuditExecution(dealershipId, {
      jobId,
      timestamp: new Date().toISOString(),
      success: false,
      error: err.message
    }).catch(() => {})

    throw err
  }
}

/**
 * Record audit execution metadata
 */
async function recordAuditExecution(dealershipId, metadata) {
  // Store in a metadata/audit log table or as JSON in dealership_settings
  try {
    const { data: settings, error: selectErr } = await supabaseAdmin
      .from('dealership_settings')
      .select('discoverability_audit_log')
      .eq('dealership_id', dealershipId)
      .single()

    if (selectErr && selectErr.code !== 'PGRST116') throw selectErr

    const log = settings?.discoverability_audit_log || []
    log.push(metadata)
    // Keep last 100 entries
    const trimmed = log.slice(-100)

    await supabaseAdmin
      .from('dealership_settings')
      .upsert({
        dealership_id: dealershipId,
        discoverability_audit_log: trimmed
      }, { onConflict: 'dealership_id' })
  } catch (err) {
    // Graceful failure — don't break the job if logging fails
    console.warn('[discoverability/scheduler] Failed to record execution:', err.message)
  }
}

/**
 * Get current scheduler state
 */
export function getSchedulerState() {
  return {
    activeJobs: SCHEDULER_STATE.jobs.size,
    jobs: Array.from(SCHEDULER_STATE.jobs.entries()).map(([id, job]) => ({
      dealershipId: id,
      config: job.config,
      running: true
    }))
  }
}

/**
 * Initialize scheduler for all dealerships that have opted in
 */
export async function initializeScheduler() {
  try {
    // Fetch all dealerships with discoverability enabled and autopilot settings
    const { data: settings, error } = await supabaseAdmin
      .from('discoverability_autopilot_settings')
      .select('dealership_id, mode, max_automatic_fixes_per_day, cooldown_seconds')

    if (error) {
      console.warn('[discoverability/scheduler] Failed to fetch settings:', error.message)
      return
    }

    if (!settings?.length) {
      console.log('[discoverability/scheduler] No dealerships with autopilot settings')
      return
    }

    let started = 0
    for (const setting of settings) {
      const config = {
        enabled: setting.mode !== 'monitor',
        frequencyHours: 24,
        autoApplySmallFixes: setting.mode === 'auto_fix'
      }

      if (startPeriodicAudit(setting.dealership_id, config)) {
        started++
      }
    }

    console.log(`[discoverability/scheduler] Initialized ${started} audit jobs`)
  } catch (err) {
    console.error('[discoverability/scheduler] Initialization failed:', err.message)
  }
}

/**
 * Graceful shutdown — stop all jobs
 */
export function shutdownScheduler() {
  const count = SCHEDULER_STATE.jobs.size
  for (const dealershipId of SCHEDULER_STATE.jobs.keys()) {
    stopPeriodicAudit(dealershipId)
  }
  if (count > 0) {
    console.log(`[discoverability/scheduler] Shutdown: stopped ${count} audit jobs`)
  }
}

/**
 * Clear all scheduled jobs (for testing)
 */
export function clearAllJobs() {
  const count = SCHEDULER_STATE.jobs.size
  for (const dealershipId of Array.from(SCHEDULER_STATE.jobs.keys())) {
    stopPeriodicAudit(dealershipId)
  }
  return count
}
