import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import ws from 'ws'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { renderAndCaptureInventory, genericMapVehicle, harvestVehicleUrls,
         inferUrlTemplate, renderUrlTemplate, fetchUrlsViaBrowser, fetchViaBrowser } from './puppeteerRenderer.js'
import { validatePassword, rateLimit, securityHeaders, corsOriginCheck, getClientIp,
         generateRecoveryCodes, hashRecoveryCode } from './security.js'
import { maybeAlertSuspiciousLogin } from './securityAlerts.js'
import { runDripCampaign, verifyUnsubToken } from './drip.js'
import {
  beginPasskeyRegistration, finishPasskeyRegistration,
  beginPasskeyLogin, finishPasskeyLogin,
  listUserPasskeys, deletePasskey
} from './passkeys.js'
import { randomBytes, createHash } from 'crypto'
import { Resend } from 'resend'
import * as dnsLib from 'dns'
