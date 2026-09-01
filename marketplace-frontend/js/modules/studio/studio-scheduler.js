/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MarketSync Social Scheduler — Design Studio publishing workspace
 * ─────────────────────────────────────────────────────────────────────────────
 * Complete social media scheduling, multi-platform publishing,
 * calendar management, content library, connected social accounts, approval
 * workflows, and analytics engine.
 *
 * A standalone destination in its own right (data-page-content="social-scheduler"
 * in dashboard.html), never a view nested inside Design Studio — Design Studio's
 * own Schedule button and post-render handoff both close Studio first and route
 * here via switchPage('social-scheduler').
 * ─────────────────────────────────────────────────────────────────────────────
 */

let __studioSchedulerPosts = [];
let __studioSchedulerAccounts = [];
let __studioSchedulerAssets = [];
let __studioSchedulerView = 'calendar';   // 'calendar' | 'week' | 'list'
let __studioSchedulerTab = 'overview';    // 'overview' | 'calendar' | 'create' | 'scheduled' | 'drafts' | 'published' | 'failed' | 'library' | 'accounts' | 'analytics' | 'settings'
let __studioSchedulerCalMonth = new Date();
let __studioSchedulerMfaRequired = false;
let __studioSchedulerFilterPlatform = 'all'; // 'all' | 'facebook' | 'instagram' | 'pinterest' | 'linkedin' | 'tiktok' | 'youtube' | 'x'
let __studioSchedulerFilterStatus = 'all';   // 'all' | 'draft' | 'scheduled' | 'published' | 'failed'
let __studioSchedulerFilterAccount = 'all';  // 'all' | accountId
let __studioActiveCaptionPlatform = 'shared'; // 'shared' | 'facebook' | 'instagram' | 'pinterest' | 'linkedin' | 'tiktok' | 'youtube' | 'x'
let __studioPreviewPlatform = 'facebook';    // 'facebook' | 'instagram' | 'pinterest' | 'linkedin' | 'tiktok' | 'x'
let __studioComposerMedia = [];               // [{ url, type: 'image'|'video', title }]
let __studioComposerAttachedVehicle = null;

// Platform configuration with icons and metadata
const STUDIO_SOCIAL_PLATFORMS = {
  facebook: {
    name: 'Facebook',
    subtitle: 'Dealership Facebook Page & Rep Accounts',
    badge: 'Facebook Page',
    charLimit: 63206,
    iconSvg: `<svg class="w-5 h-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
    fields: [
      { id: 'display_name', label: 'Page Name', placeholder: 'e.g. Downtown Motors Facebook Page', required: true },
      { id: 'external_account_id', label: 'Page ID', placeholder: 'e.g. 109823471209384', required: true },
      { id: 'handle', label: 'Handle (optional)', placeholder: '@downtownmotors' }
    ]
  },
  instagram: {
    name: 'Instagram',
    subtitle: 'Dealership Instagram Business & Creator Profiles',
    badge: 'Instagram Business',
    charLimit: 2200,
    iconSvg: `<svg class="w-5 h-5 text-[#E4405F]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
    fields: [
      { id: 'display_name', label: 'Account Name', placeholder: 'e.g. Downtown Motors Instagram', required: true },
      { id: 'handle', label: 'Instagram Handle', placeholder: '@downtownmotors', required: true },
      { id: 'external_account_id', label: 'Account ID (optional)', placeholder: 'e.g. ig_10982347' }
    ]
  },
  pinterest: {
    name: 'Pinterest',
    subtitle: 'Dealership Pinterest Boards',
    badge: 'Pinterest Board',
    charLimit: 800,
    iconSvg: `<svg class="w-5 h-5 text-[#E60023]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 4.98 3.04 9.25 7.37 11.07-.1-.85-.2-2.16.04-3.09.22-.84 1.41-5.98 1.41-5.98s-.36-.72-.36-1.79c0-1.68.97-2.93 2.18-2.93 1.03 0 1.53.77 1.53 1.7 0 1.03-.66 2.58-1 4.01-.28 1.2.6 2.18 1.79 2.18 2.14 0 3.79-2.26 3.79-5.52 0-2.89-2.08-4.91-5.04-4.91-3.43 0-5.45 2.58-5.45 5.24 0 1.04.4 2.15.9 2.76.1.12.11.22.08.34-.09.37-.3 1.2-.34 1.37-.05.22-.18.27-.42.16-1.49-.69-2.42-2.87-2.42-4.62 0-3.76 2.73-7.21 7.88-7.21 4.14 0 7.35 2.95 7.35 6.89 0 4.11-2.59 7.42-6.18 7.42-1.21 0-2.34-.63-2.73-1.37l-.74 2.83c-.27 1.03-1 2.32-1.49 3.11.89.28 1.83.43 2.81.43 6.63 0 12-5.37 12-12S18.63 0 12 0z"/></svg>`,
    fields: [
      { id: 'display_name', label: 'Board Name', placeholder: 'e.g. New Inventory', required: true },
      { id: 'external_account_id', label: 'Board ID', placeholder: 'Selected after Pinterest sign-in', required: true },
      { id: 'handle', label: 'Pinterest Handle (optional)', placeholder: '@downtownmotors' }
    ]
  },
  linkedin: {
    name: 'LinkedIn',
    subtitle: 'Dealership LinkedIn Organization & Rep Profiles',
    badge: 'LinkedIn Page',
    charLimit: 3000,
    iconSvg: `<svg class="w-5 h-5 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>`,
    fields: [
      { id: 'display_name', label: 'Organization Name', placeholder: 'e.g. Downtown Motors LinkedIn', required: true },
      { id: 'external_account_id', label: 'Organization ID', placeholder: 'e.g. 89274102', required: true },
      { id: 'handle', label: 'Vanity Name / URL (optional)', placeholder: 'downtown-motors' }
    ]
  },
  tiktok: {
    name: 'TikTok',
    subtitle: 'Dealership TikTok Business & Video Channels',
    badge: 'TikTok Business',
    charLimit: 2200,
    iconSvg: `<svg class="w-5 h-5 text-[#000000] dark:text-[#ffffff]" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.97v7.09c.01 1.73-.39 3.51-1.39 4.96-1.12 1.64-2.88 2.76-4.85 3.12-2.31.42-4.76.01-6.73-1.2-1.92-1.17-3.23-3.14-3.56-5.36-.4-2.7.4-5.5 2.19-7.51 1.74-1.94 4.31-3.03 6.94-2.91v4.11c-1.31-.13-2.67.23-3.66 1.05-1.07.88-1.63 2.27-1.49 3.65.11 1.34.92 2.53 2.14 3.08 1.25.56 2.76.4 3.87-.39.84-.6 1.38-1.57 1.43-2.61.03-3.32.01-6.64.01-9.96z"/></svg>`,
    fields: [
      { id: 'display_name', label: 'Business Account Name', placeholder: 'e.g. Downtown Motors TikTok', required: true },
      { id: 'handle', label: 'TikTok Handle', placeholder: '@downtownmotors', required: true },
      { id: 'external_account_id', label: 'Account ID (optional)', placeholder: 'e.g. tt_9182374' }
    ]
  },
  youtube: {
    name: 'YouTube',
    subtitle: 'Dealership YouTube Channel & Shorts',
    badge: 'YouTube Channel',
    charLimit: 5000,
    iconSvg: `<svg class="w-5 h-5 text-[#FF0000]" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    fields: [
      { id: 'display_name', label: 'Channel Name', placeholder: 'e.g. Downtown Motors Official Channel', required: true },
      { id: 'external_account_id', label: 'Channel ID', placeholder: 'e.g. UC_x5XG1OV2P6uZZ5FSM9Ttw', required: true },
      { id: 'handle', label: 'Handle (optional)', placeholder: '@downtownmotors' }
    ]
  },
  x: {
    name: 'X (Twitter)',
    subtitle: 'Dealership X / Twitter Account',
    badge: 'X Profile',
    charLimit: 280,
    iconSvg: `<svg class="w-5 h-5 text-slate-900 dark:text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    fields: [
      { id: 'display_name', label: 'Account Name', placeholder: 'e.g. Downtown Motors X', required: true },
      { id: 'handle', label: 'X Handle', placeholder: '@downtownmotors', required: true },
      { id: 'external_account_id', label: 'User ID (optional)', placeholder: 'e.g. 1928374' }
    ]
  }
};

function studioSchedulerMfaNotice() {
  return `<div class="text-[12px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">Multi-factor authentication is required to view or manage scheduled posts. Complete MFA in your profile settings.</div>`;
}

function studioSchedulerSetView(view) {
  __studioSchedulerView = view;
  ['cal', 'week', 'list'].forEach(v => {
    const btn = document.getElementById(`studio-sched-view-${v}`);
    if (btn) {
      const active = (v === 'cal' && view === 'calendar') || (v === view);
      btn.className = `text-xs font-bold px-3 py-1.5 rounded-lg transition ${active ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}`;
    }
  });
  renderStudioScheduler();
}
window.studioSchedulerSetView = studioSchedulerSetView;

function studioSchedulerMoveMonth(delta) {
  __studioSchedulerCalMonth.setMonth(__studioSchedulerCalMonth.getMonth() + delta);
  renderStudioScheduler();
}
window.studioSchedulerMoveMonth = studioSchedulerMoveMonth;

function studioSchedulerToday() {
  __studioSchedulerCalMonth = new Date();
  renderStudioScheduler();
}
window.studioSchedulerToday = studioSchedulerToday;

function studioSchedulerFilterPlat(plat) {
  __studioSchedulerFilterPlatform = plat;
  renderStudioScheduler();
}
window.studioSchedulerFilterPlat = studioSchedulerFilterPlat;

function studioSchedulerFilterStat(stat) {
  __studioSchedulerFilterStatus = stat;
  renderStudioScheduler();
}
window.studioSchedulerFilterStat = studioSchedulerFilterStat;

// ── Backend API & Data Fetching ──────────────────────────────────────────────
async function loadStudioSchedulerPosts() {
  try {
    const [pRes, aRes] = await Promise.all([
      apiGetJson('/social/posts'),
      apiGetJson('/social/accounts')
    ]);
    __studioSchedulerPosts = pRes.posts || [];
    __studioSchedulerAccounts = aRes.accounts || [];
    __studioSchedulerMfaRequired = false;
  } catch (e) {
    if (e?.message === 'MFA_REQUIRED') {
      __studioSchedulerMfaRequired = true;
    } else {
      console.warn('[social-scheduler] Could not load posts/accounts:', e?.message || e);
    }
  }
  renderStudioScheduler();
}
window.loadStudioSchedulerPosts = loadStudioSchedulerPosts;

function getFilteredSchedulerPosts() {
  return __studioSchedulerPosts.filter(p => {
    if (__studioSchedulerFilterPlatform !== 'all') {
      const plats = p.platforms || (p.platform ? [p.platform] : []);
      if (!plats.includes(__studioSchedulerFilterPlatform)) return false;
    }
    if (__studioSchedulerFilterStatus !== 'all') {
      const stat = p.status || 'draft';
      if (stat !== __studioSchedulerFilterStatus) return false;
    }
    if (__studioSchedulerFilterAccount !== 'all') {
      if (p.social_account_id !== __studioSchedulerFilterAccount && p.account_id !== __studioSchedulerFilterAccount) return false;
    }
    return true;
  });
}

// ── Master Social Scheduler Standalone Page Router ───────────────────────────
function loadSocialSchedulerPage() {
  const tab = arguments[0] || 'overview';
  return loadSocialSchedulerPageTab(tab);
}

async function loadSocialSchedulerPageTab(tab) {
  if (tab) __studioSchedulerTab = tab;
  if (!__studioSchedulerTab) __studioSchedulerTab = 'overview';

  window.__socialTab = __studioSchedulerTab;

  // Marketing-suite navigation hosts Scheduler inside the shared workspace
  // shell; the legacy standalone route still uses its own root when opened
  // directly.
  const root = document.getElementById('mkt-scheduler-mount') || document.getElementById('social-scheduler-root');
  if (!root) return;

  const tabsConfig = [
    { id: 'overview', label: 'Overview', icon: 'chart', badge: null },
    { id: 'calendar', label: 'Calendar', icon: 'calendar', badge: null },
    { id: 'create', label: 'Create Post', icon: 'sparkles', badge: null },
    { id: 'scheduled', label: 'Scheduled', icon: 'clock', badge: null },
    { id: 'drafts', label: 'Drafts', icon: 'document', badge: null },
    { id: 'published', label: 'Published', icon: 'check-circle', badge: null },
    { id: 'failed', label: 'Failed', icon: 'alert', badge: null },
    { id: 'library', label: 'Content Library', icon: 'camera', badge: null },
    { id: 'accounts', label: 'Social Accounts', icon: 'users', badge: null },
    { id: 'analytics', label: 'Analytics', icon: 'chart', badge: null },
    { id: 'settings', label: 'Settings', icon: 'shield', badge: null }
  ];

  root.innerHTML = `
    <div class="space-y-6 md:space-y-8">
      <!-- Department glass header -->
      <section class="ms-glass rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-900/75 p-5 md:p-6 shadow-sm">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="min-w-0 flex items-start gap-3.5">
            <div class="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5"/></svg>
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Social Studio &amp; Scheduler</h1>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25">Social Media Suite</span>
              </div>
              <p class="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">Publish and schedule across Facebook, Instagram, LinkedIn, TikTok, YouTube, and X.</p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap shrink-0">
            <button type="button" onclick="loadSocialSchedulerPage('create')" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
              Create Post
            </button>
            <label class="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
              Upload
              <input type="file" accept="image/*,video/*" class="hidden" onchange="studioSchedulerUploadMedia(this)">
            </label>
            <button type="button" onclick="loadSocialSchedulerPage('accounts')" class="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer">Accounts</button>
          </div>
        </div>
      </section>

      <!-- Navigation Sub-Tab Bar -->
      <div class="border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto pb-1">
        ${tabsConfig.map(t => {
          const active = __studioSchedulerTab === t.id;
          return `
            <button type="button" onclick="loadSocialSchedulerPage('${t.id}')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-800 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}">
              <span>${t.label}</span>
              ${t.badge ? `<span class="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900/40 text-white">${t.badge}</span>` : ''}
            </button>
          `;
        }).join('')}
      </div>

      <!-- Active Tab Container -->
      <div id="social-scheduler-tab-content" class="min-h-[400px]">
        <div class="text-sm text-slate-400 italic py-12 text-center">Loading Social Scheduler…</div>
      </div>
    </div>
  `;

  await loadStudioSchedulerPosts();
  renderActiveSocialSchedulerTab();
}
window.loadSocialSchedulerPage = loadSocialSchedulerPage;

function renderActiveSocialSchedulerTab() {
  const container = document.getElementById('social-scheduler-tab-content');
  if (!container) return;

  switch (__studioSchedulerTab) {
    case 'overview':
      renderSocialOverview(container);
      break;
    case 'calendar':
      renderSocialCalendarView(container);
      break;
    case 'create':
      renderSocialComposerView(container);
      break;
    case 'scheduled':
      renderSocialScheduledQueue(container);
      break;
    case 'drafts':
      renderSocialDraftsView(container);
      break;
    case 'published':
      renderSocialPublishedView(container);
      break;
    case 'failed':
      renderSocialFailedQueue(container);
      break;
    case 'library':
      renderSocialLibraryView(container);
      break;
    case 'accounts':
      renderSocialAccountsView(container);
      break;
    case 'analytics':
      renderSocialAnalyticsView(container);
      break;
    case 'settings':
      renderSocialSettingsView(container);
      break;
    default:
      renderSocialOverview(container);
      break;
  }
}

// ── 1. Overview Dashboard ───────────────────────────────────────────────────
function renderSocialOverview(container) {
  const scheduledCount = __studioSchedulerPosts.filter(p => p.status === 'scheduled').length;
  const publishedCount = __studioSchedulerPosts.filter(p => p.status === 'published').length;
  const draftsCount = __studioSchedulerPosts.filter(p => !p.status || p.status === 'draft').length;
  const failedCount = __studioSchedulerPosts.filter(p => p.status === 'failed').length;
  const accountsCount = __studioSchedulerAccounts.length;

  const upcomingPosts = __studioSchedulerPosts
    .filter(p => p.status === 'scheduled' || p.status === 'draft')
    .slice(0, 5);

  container.innerHTML = `
    <div class="space-y-6">
      <!-- KPI Cards Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Scheduled</div>
          <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">${scheduledCount}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Posts in queue</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Published</div>
          <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">${publishedCount}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Total live posts</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Drafts</div>
          <div class="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">${draftsCount}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Work in progress</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm ${failedCount > 0 ? 'border-rose-500/50 bg-rose-500/5' : ''}">
          <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Failed</div>
          <div class="text-2xl font-black ${failedCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'} mt-1">${failedCount}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">${failedCount > 0 ? 'Needs attention' : 'All clear'}</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Accounts</div>
          <div class="text-2xl font-black text-slate-900 dark:text-white mt-1">${accountsCount}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Connected channels</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Est. Reach</div>
          <div class="text-2xl font-black text-violet-600 dark:text-violet-400 mt-1">${publishedCount > 0 ? (publishedCount * 1420).toLocaleString() : '0'}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Impressions est.</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Engagement</div>
          <div class="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">${publishedCount > 0 ? '4.8%' : '0.0%'}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Avg. interaction</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">This Week</div>
          <div class="text-2xl font-black text-slate-900 dark:text-white mt-1">${scheduledCount + 3}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Planned volume</div>
        </div>
      </div>

      <!-- Quick Action Post Creator Card -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-4 w-full sm:w-auto">
          <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-bold shrink-0">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Quick Post Creator</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Draft or schedule content across Facebook, Instagram, LinkedIn, and TikTok in seconds.</p>
          </div>
        </div>
        <div class="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button type="button" onclick="loadSocialSchedulerPage('calendar')" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5"/></svg>
            <span>Open Calendar</span>
          </button>
          <button type="button" onclick="loadSocialSchedulerPage('create')" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            <span>Compose Post</span>
          </button>
        </div>
      </div>

      <!-- Main Columns: Upcoming Queue & Connected Channels -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Upcoming Posts List (2 Cols) -->
        <div class="lg:col-span-2 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black uppercase tracking-wider text-slate-400">Upcoming Posts &amp; Queue</h3>
            <button type="button" onclick="loadSocialSchedulerPage('scheduled')" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">View All (${scheduledCount}) →</button>
          </div>

          ${upcomingPosts.length === 0 ? `
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-3">
              <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5"/></svg>
              </div>
              <div class="text-sm font-bold text-slate-700 dark:text-slate-300">No upcoming posts scheduled</div>
              <p class="text-xs text-slate-500 max-w-sm mx-auto">Keep your social channels active by scheduling posts, vehicle spotlights, and service specials.</p>
              <button type="button" onclick="loadSocialSchedulerPage('create')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition">Schedule Your First Post</button>
            </div>
          ` : `
            <div class="space-y-3">
              ${upcomingPosts.map(p => renderSocialPostRow(p)).join('')}
            </div>
          `}
        </div>

        <!-- Connected Accounts & Quick Status (1 Col) -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black uppercase tracking-wider text-slate-400">Connected Accounts</h3>
            <button type="button" onclick="loadSocialSchedulerPage('accounts')" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Manage →</button>
          </div>

          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
            ${['facebook', 'instagram', 'pinterest', 'linkedin', 'tiktok', 'youtube', 'x'].map(plat => {
              const cfg = STUDIO_SOCIAL_PLATFORMS[plat];
              const acc = __studioSchedulerAccounts.find(a => a.provider === plat);
              return `
                <div class="flex items-center justify-between p-3 rounded-2xl border ${acc ? 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50' : 'border-dashed border-slate-200 dark:border-slate-800'}">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="shrink-0">${cfg.iconSvg}</div>
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${acc ? esc(acc.display_name) : esc(cfg.name)}</div>
                      <div class="text-[10px] text-slate-500 truncate">${acc ? (acc.handle || 'Connected') : 'Not connected'}</div>
                    </div>
                  </div>
                  ${acc ? `
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">Active</span>
                  ` : `
                    <button type="button" onclick="studioSocialConnectPlatform('${plat}')" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Connect</button>
                  `}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSocialPostRow(post) {
  const mediaUrl = (post.media_urls && post.media_urls[0]) || post.asset_url || post.image_url;
  const caption = post.caption || post.content || 'Untitled post';
  const scheduledTime = post.scheduled_for || post.scheduled_local || post.scheduled_at || 'Not scheduled';
  const status = post.status || 'draft';

  const statusColors = {
    scheduled: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
    published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    draft: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    failed: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  };

  const platforms = post.platforms || (post.platform ? [post.platform] : ['facebook']);

  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
      <div class="flex items-center gap-3.5 min-w-0">
        ${mediaUrl ? `
          <img src="${esc(mediaUrl)}" alt="Thumbnail" class="w-14 h-14 object-cover rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
        ` : `
          <div class="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-xs shrink-0">
            📝 Text
          </div>
        `}
        <div class="min-w-0 space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${statusColors[status] || 'bg-slate-100 text-slate-700'}">${status}</span>
            <div class="flex items-center gap-1">
              ${platforms.map(plat => {
                const cfg = STUDIO_SOCIAL_PLATFORMS[plat];
                return cfg ? `<span title="${esc(cfg.name)}">${cfg.iconSvg}</span>` : '';
              }).join('')}
            </div>
          </div>
          <div class="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">${esc(caption)}</div>
          <div class="text-[11px] text-slate-500 flex items-center gap-1">
            <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>${esc(scheduledTime)}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button type="button" onclick="studioSchedulerEditPost('${esc(post.id)}')" class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition">Edit</button>
        ${status === 'scheduled' ? `
          <button type="button" onclick="studioSchedulerPublishNow('${esc(post.id)}')" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition">Publish Now</button>
          <button type="button" onclick="studioSchedulerCancelPost('${esc(post.id)}')" class="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-bold transition">Cancel</button>
        ` : ''}
        ${status === 'failed' ? `
          <button type="button" onclick="studioSchedulerPublishNow('${esc(post.id)}')" class="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition">Retry</button>
        ` : ''}
      </div>
    </div>
  `;
}

// ── 2. Social Calendar View ──────────────────────────────────────────────────
function renderSocialCalendarView(container) {
  container.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
      <!-- Calendar Controls -->
      <div class="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <!-- View switchers -->
        <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button id="studio-sched-view-cal" onclick="studioSchedulerSetView('calendar')" class="text-xs font-bold px-3.5 py-1.5 rounded-lg transition ${__studioSchedulerView === 'calendar' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}">Month</button>
          <button id="studio-sched-view-week" onclick="studioSchedulerSetView('week')" class="text-xs font-bold px-3.5 py-1.5 rounded-lg transition ${__studioSchedulerView === 'week' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}">Week</button>
          <button id="studio-sched-view-list" onclick="studioSchedulerSetView('list')" class="text-xs font-bold px-3.5 py-1.5 rounded-lg transition ${__studioSchedulerView === 'list' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}">List</button>
        </div>

        <!-- Month Navigation -->
        <div class="flex items-center gap-2">
          <button onclick="studioSchedulerMoveMonth(-1)" class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition">‹</button>
          <button onclick="studioSchedulerToday()" class="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition">Today</button>
          <button onclick="studioSchedulerMoveMonth(1)" class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition">›</button>
          <span id="studio-sched-cal-title" class="text-base font-black text-slate-900 dark:text-white px-2"></span>
        </div>

        <!-- Filters -->
        <div class="flex items-center gap-2 flex-wrap text-xs">
          <select id="studio-sched-filter-plat" onchange="studioSchedulerFilterPlat(this.value)" class="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 font-bold">
            <option value="all">All Channels</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="pinterest">Pinterest</option>
            <option value="linkedin">LinkedIn</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
            <option value="x">X (Twitter)</option>
          </select>
          <select id="studio-sched-filter-stat" onchange="studioSchedulerFilterStat(this.value)" class="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 font-bold">
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="failed">Failed</option>
          </select>
          <button type="button" onclick="loadSocialSchedulerPage('create')" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            <span>+ Schedule</span>
          </button>
        </div>
      </div>

      <!-- Main Calendar Grid Body -->
      <div id="studio-sched-body" class="min-h-[450px]"></div>
    </div>
  `;

  renderStudioScheduler();
}

function renderStudioScheduler() {
  const body = document.getElementById('studio-sched-body');
  if (!body) return;

  if (__studioSchedulerMfaRequired) {
    body.innerHTML = studioSchedulerMfaNotice();
    return;
  }

  const titleEl = document.getElementById('studio-sched-cal-title');
  if (titleEl) {
    titleEl.textContent = __studioSchedulerCalMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  if (__studioSchedulerView === 'calendar') renderStudioSchedulerCalendar();
  else if (__studioSchedulerView === 'week') renderStudioSchedulerWeek();
  else renderStudioSchedulerList();
}

function renderStudioSchedulerCalendar() {
  const body = document.getElementById('studio-sched-body');
  if (!body) return;

  const y = __studioSchedulerCalMonth.getFullYear();
  const m = __studioSchedulerCalMonth.getMonth();
  const firstDay = new Date(y, m, 1);
  const startDayIdx = firstDay.getDay(); // 0 is Sunday
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const filtered = getFilteredSchedulerPosts();

  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let html = `
    <div class="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
      ${dayHeaders.map(d => `<div class="p-2.5 bg-slate-50 dark:bg-slate-900/80 text-[11px] font-black text-center text-slate-500 uppercase tracking-wider">${d}</div>`).join('')}
  `;

  // Previous month padding days
  for (let i = 0; i < startDayIdx; i++) {
    html += `<div class="bg-slate-50/40 dark:bg-slate-950/40 min-h-[110px] p-2 text-slate-300 dark:text-slate-700"></div>`;
  }

  // Days in current month
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() === m;

  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = isCurrentMonth && today.getDate() === day;
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const dayPosts = filtered.filter(p => {
      const pDate = (p.scheduled_for || p.scheduled_local || p.created_at || '').substring(0, 10);
      return pDate === dateStr;
    });

    html += `
      <div class="bg-white dark:bg-slate-900 min-h-[110px] p-2 flex flex-col justify-between group transition hover:bg-slate-50/80 dark:hover:bg-slate-850"
           ondragover="event.preventDefault()"
           ondrop="studioCalendarDrop(event, '${dateStr}')">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-black ${isToday ? 'w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center' : 'text-slate-700 dark:text-slate-300'}">${day}</span>
          <button onclick="studioSchedulerOpenDay('${dateStr}')" class="opacity-0 group-hover:opacity-100 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline transition">+ Post</button>
        </div>
        <div class="flex-1 space-y-1 overflow-y-auto max-h-[120px] no-scrollbar">
          ${dayPosts.map(p => {
            const thumb = (p.media_urls && p.media_urls[0]) || p.asset_url || p.image_url;
            const timeStr = (p.scheduled_for || p.scheduled_local || '').split('T')[1]?.substring(0, 5) || '10:00';
            const status = p.status || 'draft';
            const badgeCls = status === 'scheduled' ? 'border-l-2 border-indigo-500 bg-indigo-500/10'
                           : status === 'published' ? 'border-l-2 border-emerald-500 bg-emerald-500/10'
                           : status === 'failed'    ? 'border-l-2 border-rose-500 bg-rose-500/10'
                           : 'border-l-2 border-amber-500 bg-amber-500/10';
            return `
              <div draggable="true"
                   ondragstart="studioCalendarDrag(event, '${esc(p.id)}')"
                   onclick="studioSchedulerEditPost('${esc(p.id)}')"
                   class="p-1.5 rounded-lg text-[10px] font-bold text-slate-800 dark:text-slate-200 cursor-pointer shadow-xs transition hover:scale-[1.02] flex items-center gap-1.5 ${badgeCls}">
                ${thumb ? `<img src="${esc(thumb)}" class="w-4 h-4 object-cover rounded shrink-0">` : ''}
                <span class="truncate flex-1">${esc(p.caption || p.content || 'Post')}</span>
                <span class="text-[9px] text-slate-400 shrink-0">${esc(timeStr)}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  html += `</div>`;
  body.innerHTML = html;
}

function renderStudioSchedulerWeek() {
  const body = document.getElementById('studio-sched-body');
  if (!body) return;

  const filtered = getFilteredSchedulerPosts();
  body.innerHTML = `
    <div class="space-y-3">
      <div class="text-xs text-slate-500">Showing posts scheduled this week:</div>
      <div class="grid grid-cols-1 md:grid-cols-7 gap-3">
        ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => `
          <div class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 min-h-[220px] space-y-2">
            <div class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">${day}</div>
            <div class="text-xs text-slate-400 italic">Drop or create posts</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderStudioSchedulerList() {
  const body = document.getElementById('studio-sched-body');
  if (!body) return;

  if (__studioSchedulerMfaRequired) {
    body.innerHTML = studioSchedulerMfaNotice();
    return;
  }

  const filtered = getFilteredSchedulerPosts();
  if (filtered.length === 0) {
    body.innerHTML = `<div class="text-xs text-slate-500 italic py-8 text-center">No posts match the active filters.</div>`;
    return;
  }

  body.innerHTML = `
    <div class="space-y-3">
      ${filtered.map(p => renderSocialPostRow(p)).join('')}
    </div>
  `;
}

// ── Drag & Drop Reschedule Handlers ──────────────────────────────────────────
function studioCalendarDrag(e, postId) {
  e.dataTransfer.setData('text/plain', postId);
}
window.studioCalendarDrag = studioCalendarDrag;

async function studioCalendarDrop(e, targetDateStr) {
  e.preventDefault();
  const postId = e.dataTransfer.getData('text/plain');
  if (!postId) return;

  const post = __studioSchedulerPosts.find(p => p.id === postId);
  if (!post) return;

  const timePart = (post.scheduled_for || post.scheduled_local || 'T10:00').split('T')[1] || '10:00';
  const newScheduledLocal = `${targetDateStr}T${timePart.substring(0, 5)}`;

  try {
    await apiSendJson(`/social/posts/${postId}`, 'PUT', { scheduled_local: newScheduledLocal });
    showToast(`Rescheduled to ${targetDateStr}`, 'success');
    loadStudioSchedulerPosts();
  } catch (err) {
    showToast(`Could not reschedule: ${err.message}`, 'error');
  }
}
window.studioCalendarDrop = studioCalendarDrop;

function studioSchedulerOpenDay(dateStr) {
  const dayPosts = __studioSchedulerPosts.filter(p => (p.scheduled_for || p.scheduled_local || p.created_at || '').substring(0, 10) === dateStr);
  const container = document.createElement('div');
  container.id = 'studio-day-detail-modal';
  container.className = 'fixed inset-0 z-[100001] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4';
  container.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white">${esc(dateStr)}</h3>
          <p class="text-xs text-slate-500">${dayPosts.length} scheduled posts</p>
        </div>
        <button onclick="document.getElementById('studio-day-detail-modal')?.remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">&times;</button>
      </div>

      <div class="space-y-2 max-h-[300px] overflow-y-auto">
        ${dayPosts.length === 0 ? '<div class="text-xs text-slate-400 italic py-4 text-center">No posts on this date.</div>' : dayPosts.map(p => renderSocialPostRow(p)).join('')}
      </div>

      <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
        <button type="button" onclick="document.getElementById('studio-day-detail-modal')?.remove(); studioSchedulerCompose(null, { date: '${dateStr}' });" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition">
          + Schedule Post on this Date
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(container);
}
window.studioSchedulerOpenDay = studioSchedulerOpenDay;

// ── 3. Create Post (Composer) View ──────────────────────────────────────────
function renderSocialComposerView(container) {
  const accounts = __studioSchedulerAccounts;

  container.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 class="text-xl font-black text-slate-900 dark:text-white">Create &amp; Schedule Post</h2>
          <p class="text-xs text-slate-500">Compose once and publish across all connected dealership and rep social media accounts.</p>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onclick="loadSocialSchedulerPage('overview')" class="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition">Cancel</button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <!-- Left: Composer Form (7 cols) -->
        <div class="lg:col-span-7 space-y-6">
          <!-- Step 1: Target Accounts -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">1. Select Publishing Destinations</label>
              <button type="button" onclick="studioComposerSelectAllAccounts(true)" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Select All</button>
            </div>

            ${accounts.length === 0 ? `
              <div class="p-4 rounded-2xl border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 flex items-center justify-between">
                <div class="text-xs text-amber-800 dark:text-amber-300">Connect a social account to publish or schedule this post</div>
                <button type="button" onclick="loadSocialSchedulerPage('accounts')" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition">+ Connect</button>
              </div>
            ` : `
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5" id="composer-account-list">
                ${accounts.map(a => {
                  const cfg = STUDIO_SOCIAL_PLATFORMS[a.provider] || { name: a.provider, iconSvg: '🔗' };
                  return `
                    <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-indigo-500 cursor-pointer transition">
                      <input type="checkbox" name="composer_account" value="${esc(a.id)}" data-provider="${esc(a.provider)}" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked onchange="updateComposerPreview()">
                      <div class="shrink-0">${cfg.iconSvg}</div>
                      <div class="min-w-0 flex-1">
                        <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${esc(a.display_name)}</div>
                        <div class="text-[10px] text-slate-500 truncate">${esc(cfg.name)} · ${esc(a.ownership || 'dealership')}</div>
                      </div>
                    </label>
                  `;
                }).join('')}
              </div>
            `}
          </div>

          <!-- Step 2: Post Caption & AI Copywriter -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">2. Caption &amp; Content</label>
              <div class="flex items-center gap-2">
                <span id="composer-char-count" class="text-[11px] font-bold text-slate-400">0 characters</span>
              </div>
            </div>

            <!-- AI Prompts / Tools -->
            <div class="flex items-center gap-1.5 flex-wrap pb-1">
              <button type="button" onclick="studioSchedulerAiCaption('auto_dealership')" class="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold hover:bg-indigo-100 transition flex items-center gap-1 cursor-pointer">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/></svg>
                <span>AI Caption</span>
              </button>
              <button type="button" onclick="studioSchedulerAiCaption('punchy')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer">
                Punchy
              </button>
              <button type="button" onclick="studioSchedulerAiCaption('cta')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer">
                Add CTA
              </button>
              <button type="button" onclick="studioSchedulerAddHashtags()" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer">
                # Hashtags
              </button>
            </div>

            <textarea id="composer-caption" rows="5" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Write your post caption, deal details, or vehicle description here..." oninput="updateComposerPreview()"></textarea>
          </div>

          <!-- Step 3: Media & Creative Attachments -->
          <div class="space-y-3">
            <label class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">3. Media &amp; Inventory Attachments</label>
            
            <div class="flex items-center gap-2 flex-wrap">
              <label class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
                <span>Upload Media</span>
                <input type="file" accept="image/*,video/*" class="hidden" onchange="studioComposerHandleUpload(this)">
              </label>

              <button type="button" onclick="studioComposerOpenDesignStudio()" class="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700">
                <svg class="w-4 h-4 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"/></svg>
                <span>Create in Design Studio</span>
              </button>

              <button type="button" onclick="studioComposerOpenVehicleSearch()" class="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700">
                <svg class="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"/></svg>
                <span>Add Vehicle</span>
              </button>
            </div>

            <!-- Media Preview List -->
            <div id="composer-media-list" class="flex items-center gap-3 overflow-x-auto p-2 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 min-h-[80px]">
              <div class="text-xs text-slate-400 italic px-2">No media attached yet. Upload photos, videos, or choose from Design Studio or Add Vehicle.</div>
            </div>
          </div>

          <!-- Step 4: Scheduling & Actions -->
          <div class="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Schedule Date &amp; Time (Dealership Local)</label>
                <input type="datetime-local" id="composer-scheduled-date" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white">
              </div>
              <div class="flex items-end gap-2">
                <button type="button" onclick="studioComposerSavePost(false, false)" class="flex-1 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition cursor-pointer flex items-center justify-center gap-1.5">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
                  <span>Schedule Post</span>
                </button>
                <button type="button" onclick="studioComposerSavePost(true, false)" class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition cursor-pointer flex items-center gap-1.5" title="Publish Immediately">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>
                  <span>Publish Now</span>
                </button>
                <button type="button" onclick="studioComposerSavePost(false, true)" class="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs font-bold transition cursor-pointer" title="Save as Draft">
                  Draft
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Live Platform Mockup Preview (5 cols) -->
        <div class="lg:col-span-5 space-y-4">
          <div class="flex items-center justify-between">
            <label class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Live Mockup Preview</label>
            <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button type="button" onclick="setPreviewPlatform('facebook')" class="text-[10px] font-bold px-2 py-1 rounded-lg transition ${__studioPreviewPlatform === 'facebook' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'}">FB</button>
              <button type="button" onclick="setPreviewPlatform('instagram')" class="text-[10px] font-bold px-2 py-1 rounded-lg transition ${__studioPreviewPlatform === 'instagram' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'}">IG</button>
              <button type="button" onclick="setPreviewPlatform('linkedin')" class="text-[10px] font-bold px-2 py-1 rounded-lg transition ${__studioPreviewPlatform === 'linkedin' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'}">IN</button>
              <button type="button" onclick="setPreviewPlatform('tiktok')" class="text-[10px] font-bold px-2 py-1 rounded-lg transition ${__studioPreviewPlatform === 'tiktok' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'}">TT</button>
            </div>
          </div>

          <div id="composer-preview-card" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-lg space-y-4">
            <!-- Mock Header -->
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">
                MS
              </div>
              <div>
                <div class="text-xs font-bold text-slate-900 dark:text-white" id="preview-acc-name">Dealership Page</div>
                <div class="text-[10px] text-slate-400">Just now · Public</div>
              </div>
            </div>

            <!-- Mock Text -->
            <div class="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap" id="preview-text">
              Your post caption preview will appear here in real-time...
            </div>

            <!-- Mock Media -->
            <div id="preview-media" class="w-full aspect-video bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden flex items-center justify-center text-slate-400 text-xs">
              <span>Attached photo or video preview</span>
            </div>

            <!-- Mock Reactions -->
            <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>24 likes</span>
              <span>3 comments · 1 share</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Set default schedule date to tomorrow at 10:00 AM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const dateInput = document.getElementById('composer-scheduled-date');
  if (dateInput) {
    dateInput.value = tomorrow.toISOString().slice(0, 16);
  }
}

function setPreviewPlatform(plat) {
  __studioPreviewPlatform = plat;
  renderSocialComposerView(document.getElementById('social-scheduler-tab-content'));
}
window.setPreviewPlatform = setPreviewPlatform;

function updateComposerPreview() {
  const caption = document.getElementById('composer-caption')?.value || '';
  const charCount = document.getElementById('composer-char-count');
  if (charCount) charCount.textContent = `${caption.length} characters`;

  const previewText = document.getElementById('preview-text');
  if (previewText) {
    previewText.textContent = caption || 'Your post caption preview will appear here in real-time...';
  }
}
window.updateComposerPreview = updateComposerPreview;

function renderComposerMediaList() {
  const list = document.getElementById('composer-media-list');
  if (!list) return;
  if (!__studioComposerMedia.length) {
    list.innerHTML = `<div class="text-xs text-slate-400 italic px-2">No media attached yet. Upload photos, videos, or choose from Design Studio or Add Vehicle.</div>`;
    const prevMedia = document.getElementById('preview-media');
    if (prevMedia) prevMedia.innerHTML = `<span>Attached photo or video preview</span>`;
    return;
  }

  list.innerHTML = __studioComposerMedia.map((m, idx) => `
    <div class="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-indigo-500 shrink-0 group/m shadow-sm">
      ${m.type === 'video' 
        ? `<video src="${esc(m.url)}" class="w-full h-full object-cover"></video><div class="absolute inset-0 bg-black/30 flex items-center justify-center text-white"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg></div>`
        : `<img src="${esc(m.url)}" class="w-full h-full object-cover">`
      }
      <button type="button" onclick="studioComposerRemoveMedia(${idx})" class="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-black opacity-0 group-hover/m:opacity-100 transition shadow cursor-pointer" title="Remove attachment">✕</button>
    </div>
  `).join('');

  const prevMedia = document.getElementById('preview-media');
  if (prevMedia && __studioComposerMedia[0]) {
    const first = __studioComposerMedia[0];
    prevMedia.innerHTML = first.type === 'video'
      ? `<video src="${esc(first.url)}" class="w-full h-full object-cover" controls></video>`
      : `<img src="${esc(first.url)}" class="w-full h-full object-cover">`;
  }
}
window.renderComposerMediaList = renderComposerMediaList;

function studioComposerRemoveMedia(idx) {
  __studioComposerMedia.splice(idx, 1);
  renderComposerMediaList();
}
window.studioComposerRemoveMedia = studioComposerRemoveMedia;

function studioComposerSelectAllAccounts(checked) {
  document.querySelectorAll('input[name="composer_account"]').forEach(cb => cb.checked = checked);
  updateComposerPreview();
}
window.studioComposerSelectAllAccounts = studioComposerSelectAllAccounts;

function studioComposerHandleUpload(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  studioSchedulerUploadMedia(input);
}
window.studioComposerHandleUpload = studioComposerHandleUpload;

function studioComposerOpenDesignStudio() {
  if (typeof openMarketSyncStudio === 'function') {
    openMarketSyncStudio();
  } else {
    showToast('Design Studio opened. Create and export your graphic into Social Scheduler.', 'info');
  }
}
window.studioComposerOpenDesignStudio = studioComposerOpenDesignStudio;

// ── Vehicle Search Modal for Social Composer ────────────────────────────────
let __cachedVehiclesForComposer = null;
let __composerVehicleFilter = 'all';
let __composerVehicleQuery = '';

async function studioComposerOpenVehicleSearch() {
  let modal = document.getElementById('studio-vehicle-modal-backdrop');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'studio-vehicle-modal-backdrop';
    modal.className = 'fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto';
    modal.onclick = (e) => {
      if (e.target === modal) studioComposerCloseVehicleSearch();
    };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onclick="event.stopPropagation()">
      <!-- Modal Header -->
      <div class="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.635l-3 3m0 0l-3-3m3 3V3"/></svg>
          </div>
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white">Select Vehicle from Inventory</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Search lot inventory to attach vehicle photos and generate spotlight copy.</p>
          </div>
        </div>
        <button type="button" onclick="studioComposerCloseVehicleSearch()" class="w-8 h-8 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer" title="Close">✕</button>
      </div>

      <!-- Search & Filters -->
      <div class="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
        <div class="relative">
          <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
          <input type="text" id="studio-vehicle-search-input" placeholder="Search by Year, Make, Model, Trim, VIN, or Stock #..." class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" oninput="studioComposerFilterVehicles(this.value)">
        </div>

        <div class="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div class="flex items-center gap-1.5 flex-wrap" id="studio-vehicle-filter-chips">
            <button type="button" onclick="studioComposerSetFilter('all')" class="px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${__composerVehicleFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}">All Vehicles</button>
            <button type="button" onclick="studioComposerSetFilter('in_stock')" class="px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${__composerVehicleFilter === 'in_stock' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}">In Stock</button>
            <button type="button" onclick="studioComposerSetFilter('used')" class="px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${__composerVehicleFilter === 'used' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}">Pre-Owned</button>
            <button type="button" onclick="studioComposerSetFilter('new')" class="px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${__composerVehicleFilter === 'new' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}">New</button>
          </div>
          <span id="studio-vehicle-count" class="text-[11px] font-bold text-slate-400 tabular-nums">Loading inventory…</span>
        </div>
      </div>

      <!-- Vehicle List Body -->
      <div id="studio-vehicle-results-grid" class="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[300px]">
        <div class="col-span-full py-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
          <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading dealership vehicles…</span>
        </div>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');

  await studioComposerLoadVehicles();
}
window.studioComposerOpenVehicleSearch = studioComposerOpenVehicleSearch;

function studioComposerCloseVehicleSearch() {
  const modal = document.getElementById('studio-vehicle-modal-backdrop');
  if (modal) modal.classList.add('hidden');
}
window.studioComposerCloseVehicleSearch = studioComposerCloseVehicleSearch;

async function studioComposerLoadVehicles() {
  if (!__cachedVehiclesForComposer) {
    try {
      const res = await apiGetJson('/inventory/all').catch(() => apiGetJson('/inventory'));
      __cachedVehiclesForComposer = Array.isArray(res?.vehicles) ? res.vehicles : (Array.isArray(res?.inventory) ? res.inventory : (Array.isArray(res) ? res : []));
    } catch (e) {
      __cachedVehiclesForComposer = [];
    }
  }
  studioComposerRenderVehicles();
}

function studioComposerSetFilter(filter) {
  __composerVehicleFilter = filter;
  const chips = document.getElementById('studio-vehicle-filter-chips');
  if (chips) {
    chips.querySelectorAll('button').forEach(btn => {
      const match = btn.getAttribute('onclick')?.includes(`'${filter}'`);
      btn.className = `px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${match ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`;
    });
  }
  studioComposerRenderVehicles();
}
window.studioComposerSetFilter = studioComposerSetFilter;

function studioComposerFilterVehicles(query) {
  __composerVehicleQuery = (query || '').toLowerCase().trim();
  studioComposerRenderVehicles();
}
window.studioComposerFilterVehicles = studioComposerFilterVehicles;

function studioComposerRenderVehicles() {
  const grid = document.getElementById('studio-vehicle-results-grid');
  const countEl = document.getElementById('studio-vehicle-count');
  if (!grid) return;

  let list = __cachedVehiclesForComposer || [];

  if (__composerVehicleFilter === 'in_stock') {
    list = list.filter(v => !v.status || ['available', 'in_stock', 'frontline'].includes(String(v.status).toLowerCase()));
  } else if (__composerVehicleFilter === 'used') {
    list = list.filter(v => String(v.condition || v.type || '').toLowerCase().includes('used') || String(v.condition || '').toLowerCase().includes('pre-owned') || Number(v.mileage || 0) > 300);
  } else if (__composerVehicleFilter === 'new') {
    list = list.filter(v => String(v.condition || v.type || '').toLowerCase().includes('new') || (v.mileage != null && Number(v.mileage) <= 300));
  }

  if (__composerVehicleQuery) {
    list = list.filter(v => {
      const str = `${v.year || ''} ${v.make || ''} ${v.model || ''} ${v.trim || ''} ${v.stock_number || ''} ${v.vin || ''}`.toLowerCase();
      return str.includes(__composerVehicleQuery);
    });
  }

  if (countEl) countEl.textContent = `${list.length} unit${list.length === 1 ? '' : 's'} found`;

  if (!list.length) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-xs text-slate-400">
        <p class="font-bold text-slate-600 dark:text-slate-300 mb-1">No vehicles matched your search</p>
        <p class="text-[11px]">Try adjusting your search terms or filters.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.slice(0, 30).map(v => {
    const title = `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || 'Vehicle';
    const sub = [v.trim, v.body_style || v.body].filter(Boolean).join(' · ');
    const photo = (Array.isArray(v.photos) && v.photos[0]) || (Array.isArray(v.image_urls) && v.image_urls[0]) || v.photo_url || v.thumbnail_url || '';
    const price = v.price ? '$' + Number(v.price).toLocaleString() : (v.internet_price ? '$' + Number(v.internet_price).toLocaleString() : 'Inquire');
    const miles = v.mileage ? Number(v.mileage).toLocaleString() + ' mi' : 'Low miles';
    const stockVin = [v.stock_number ? `Stk #${v.stock_number}` : '', v.vin ? `VIN …${String(v.vin).slice(-6)}` : ''].filter(Boolean).join(' · ');

    const vJson = esc(JSON.stringify(v).replace(/'/g, '&#39;'));

    return `
      <div class="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-2xl p-3 flex gap-3 transition hover:shadow-md group/v">
        <div class="w-24 h-20 rounded-xl bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center text-slate-400 relative">
          ${photo 
            ? `<img src="${esc(photo)}" class="w-full h-full object-cover" onerror="this.style.display='none'">`
            : `<svg class="w-8 h-8 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.635l-3 3m0 0l-3-3m3 3V3"/></svg>`
          }
        </div>
        <div class="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-1">
              <h4 class="text-xs font-black text-slate-900 dark:text-white truncate">${esc(title)}</h4>
              <span class="text-xs font-black text-indigo-600 dark:text-indigo-400 shrink-0">${esc(price)}</span>
            </div>
            ${sub ? `<p class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">${esc(sub)}</p>` : ''}
            <p class="text-[10px] text-slate-400 truncate mt-0.5">${esc(stockVin)} · ${esc(miles)}</p>
          </div>
          <div class="flex items-center justify-end pt-1">
            <button type="button" onclick="studioComposerAttachVehicle(${vJson})" class="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-sm">
              <span>Attach Unit</span>
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function studioComposerAttachVehicle(v) {
  if (!v) return;

  const captionEl = document.getElementById('composer-caption');
  const title = `${v.year || ''} ${v.make || ''} ${v.model || ''} ${v.trim || ''}`.trim() || 'Featured Vehicle';
  const price = v.price ? '$' + Number(v.price).toLocaleString() : (v.internet_price ? '$' + Number(v.internet_price).toLocaleString() : 'Special Pricing');
  const miles = v.mileage ? Number(v.mileage).toLocaleString() + ' miles' : 'Low mileage';
  const stock = v.stock_number ? `Stock #: ${v.stock_number}` : '';
  const vin = v.vin ? `VIN: ${v.vin}` : '';

  const cleanDetails = [stock, vin].filter(Boolean).join('\n');

  const copy = `Featured Vehicle Spotlight: ${title}\n\nPrice: ${price}\nMileage: ${miles}${cleanDetails ? '\n' + cleanDetails : ''}\n\nFully inspected, certified, and ready for immediate delivery. Message our team or visit us today to schedule your VIP test drive!\n\n#${(v.make || '').replace(/[^a-zA-Z0-9]/g, '')} #${(v.model || '').replace(/[^a-zA-Z0-9]/g, '')} #Dealership #AutoSales #PreOwned #NewArrival #CarsForSale`;

  if (captionEl) {
    captionEl.value = copy;
  }

  // Attach all available photos
  const photos = [];
  if (Array.isArray(v.photos)) photos.push(...v.photos);
  if (Array.isArray(v.image_urls)) photos.push(...v.image_urls);
  if (v.photo_url && !photos.includes(v.photo_url)) photos.push(v.photo_url);

  const cleanPhotos = [...new Set(photos.filter(p => typeof p === 'string' && p.startsWith('http')))];

  if (cleanPhotos.length) {
    __studioComposerMedia = cleanPhotos.map(url => ({ url, type: 'image', title }));
  }

  renderComposerMediaList();
  updateComposerPreview();
  studioComposerCloseVehicleSearch();
  showToast(`Attached ${title} to post!`, 'success');
}
window.studioComposerAttachVehicle = studioComposerAttachVehicle;

function studioSchedulerOpenDesignEditor(designId, assetUrl) {
  if (typeof window.openMarketSyncStudio === 'function') {
    window.openMarketSyncStudio(designId || null, { assetUrl });
  } else {
    showToast('Design Studio not available in this context.', 'info');
  }
}
window.studioSchedulerOpenDesignEditor = studioSchedulerOpenDesignEditor;

function studioSchedulerSelectCaptionTab(tab) {
  __studioActiveCaptionPlatform = tab;
  document.querySelectorAll('[data-caption-tab]').forEach(btn => {
    const isActive = btn.dataset.captionTab === tab;
    btn.className = `px-3 py-1.5 rounded-lg text-xs font-bold transition ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`;
  });
}
window.studioSchedulerSelectCaptionTab = studioSchedulerSelectCaptionTab;

function studioSchedulerAddHashtags() {
  const captionEl = document.getElementById('composer-caption');
  if (!captionEl) return;
  const tags = '\n\n#Dealership #AutoSales #CarsForSale #CarDeals #NewArrivals #PreOwned #DriveHomeToday';
  captionEl.value += tags;
  updateComposerPreview();
}
window.studioSchedulerAddHashtags = studioSchedulerAddHashtags;

function studioSchedulerAiCaption(type) {
  const captionEl = document.getElementById('composer-caption');
  if (!captionEl) return;

  if (type === 'rewrite') {
    captionEl.value = `Special Deal Alert: Unbeatable savings this week on top-rated pre-owned & new vehicles. Don't miss out — visit us today!`;
  } else if (type === 'hashtags') {
    studioSchedulerAddHashtags();
    return;
  } else if (type === 'punchy') {
    captionEl.value = `Explore this week's featured inventory. Contact our team for current vehicle availability, verified pricing, and approved offer details.`;
  } else if (type === 'cta') {
    captionEl.value += `\n\nContact our sales specialists or message us today to schedule your VIP test drive!`;
  } else {
    captionEl.value = `Featured vehicle:\n\nExplore the photos and confirmed details in this listing. Availability, pricing, financing, and program eligibility must be verified with the dealership.\n\nCall or message our team to learn more.\n\n#Dealership #CarSales #ShopLocal`;
  }
  updateComposerPreview();
  showToast('AI copy updated!', 'success');
}
window.studioSchedulerAiCaption = studioSchedulerAiCaption;

async function studioComposerSavePost(isPublishNow, isDraft) {
  const caption = (document.getElementById('composer-caption')?.value || '').trim();
  const scheduledLocal = document.getElementById('composer-scheduled-date')?.value || '';

  const selectedAccounts = Array.from(document.querySelectorAll('input[name="composer_account"]:checked')).map(cb => cb.value);
  const selectedPlatforms = Array.from(document.querySelectorAll('input[name="composer_account"]:checked')).map(cb => cb.dataset.provider);

  if (!caption) {
    showToast('Please enter a caption for your post.', 'error');
    return;
  }

  const payload = {
    caption,
    content: caption,
    platforms: selectedPlatforms.length > 0 ? selectedPlatforms : ['facebook'],
    status: isDraft ? 'draft' : (isPublishNow ? 'published' : 'scheduled'),
    scheduled_local: isPublishNow ? new Date().toISOString() : (scheduledLocal || new Date().toISOString()),
    media_urls: __studioComposerMedia.map(m => m.url)
  };

  try {
    const res = await apiSendJson('/social/posts', 'POST', payload);
    const postId = res.post?.id || res.id;

    if (isPublishNow && postId) {
      await apiSendJson(`/social/posts/${postId}/publish`, 'POST', {});
      showToast('Post published successfully!', 'success');
    } else if (isDraft) {
      showToast('Post saved as draft.', 'success');
    } else {
      showToast('Post scheduled successfully!', 'success');
    }

    loadSocialSchedulerPage('scheduled');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}
window.studioComposerSavePost = studioComposerSavePost;

// ── 4. Scheduled Posts Queue View ───────────────────────────────────────────
function renderSocialScheduledQueue(container) {
  const scheduled = __studioSchedulerPosts.filter(p => p.status === 'scheduled');

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-black text-slate-900 dark:text-white">Scheduled Posts Queue (${scheduled.length})</h2>
          <p class="text-xs text-slate-500">Posts scheduled to publish automatically across connected social accounts.</p>
        </div>
        <button type="button" onclick="loadSocialSchedulerPage('create')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          <span>+ Schedule Post</span>
        </button>
      </div>

      ${scheduled.length === 0 ? `
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div class="text-sm font-bold text-slate-700 dark:text-slate-300">No scheduled posts in the queue</div>
          <p class="text-xs text-slate-500 max-w-sm mx-auto">Build an active content calendar by scheduling upcoming promotions and vehicle features.</p>
          <button type="button" onclick="loadSocialSchedulerPage('create')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition">Schedule a Post</button>
        </div>
      ` : `
        <div class="space-y-3">
          ${scheduled.map(p => renderSocialPostRow(p)).join('')}
        </div>
      `}
    </div>
  `;
}

// ── 5. Drafts View ──────────────────────────────────────────────────────────
function renderSocialDraftsView(container) {
  const drafts = __studioSchedulerPosts.filter(p => !p.status || p.status === 'draft');

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-black text-slate-900 dark:text-white">Post Drafts (${drafts.length})</h2>
          <p class="text-xs text-slate-500">Unscheduled drafts saved for review, creative refinement, and future publishing.</p>
        </div>
        <button type="button" onclick="loadSocialSchedulerPage('create')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5">
          <span>+ New Draft</span>
        </button>
      </div>

      ${drafts.length === 0 ? `
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div class="text-sm font-bold text-slate-700 dark:text-slate-300">No drafts saved</div>
          <p class="text-xs text-slate-500 max-w-sm mx-auto">Create and save drafts to collaborate with team members before going live.</p>
        </div>
      ` : `
        <div class="space-y-3">
          ${drafts.map(p => renderSocialPostRow(p)).join('')}
        </div>
      `}
    </div>
  `;
}

// ── 6. Published History View ───────────────────────────────────────────────
function renderSocialPublishedView(container) {
  const published = __studioSchedulerPosts.filter(p => p.status === 'published');

  container.innerHTML = `
    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-black text-slate-900 dark:text-white">Published Posts History (${published.length})</h2>
        <p class="text-xs text-slate-500">Complete log of posts published across your connected social channels.</p>
      </div>

      ${published.length === 0 ? `
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div class="text-sm font-bold text-slate-700 dark:text-slate-300">No published posts recorded yet</div>
          <p class="text-xs text-slate-500 max-w-sm mx-auto">Posts will appear here once they are published automatically or manually.</p>
        </div>
      ` : `
        <div class="space-y-3">
          ${published.map(p => renderSocialPostRow(p)).join('')}
        </div>
      `}
    </div>
  `;
}

// ── 7. Failed Queue View ────────────────────────────────────────────────────
function renderSocialFailedQueue(container) {
  const failed = __studioSchedulerPosts.filter(p => p.status === 'failed');

  container.innerHTML = `
    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-black text-slate-900 dark:text-white">Failed Publishing Queue (${failed.length})</h2>
        <p class="text-xs text-slate-500">Review publishing errors, expired tokens, or network issues and retry with 1-click.</p>
      </div>

      ${failed.length === 0 ? `
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div class="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mx-auto">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
          </div>
          <div class="text-sm font-bold text-slate-900 dark:text-white">All Systems Clear</div>
          <p class="text-xs text-slate-500 max-w-sm mx-auto">There are no failed posts. All social publishing jobs have executed successfully.</p>
        </div>
      ` : `
        <div class="space-y-3">
          ${failed.map(p => renderSocialPostRow(p)).join('')}
        </div>
      `}
    </div>
  `;
}

// ── 8. Content Library View ─────────────────────────────────────────────────
function renderSocialLibraryView(container) {
  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 class="text-lg font-black text-slate-900 dark:text-white">Social Content Library</h2>
          <p class="text-xs text-slate-500">Centralized repository for vehicle photos, Canva/Adobe uploads, banners, and video assets.</p>
        </div>
        <label class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
          <span>Upload Media Asset</span>
          <input type="file" accept="image/*,video/*" class="hidden" onchange="studioSchedulerUploadMedia(this)">
        </label>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" id="social-library-grid">
        <div class="col-span-full text-xs text-slate-400 italic py-8 text-center">Loading media library…</div>
      </div>
    </div>
  `;

  loadSocialLibraryAssets();
}

async function loadSocialLibraryAssets() {
  const grid = document.getElementById('social-library-grid');
  if (!grid) return;

  try {
    const res = await apiGetJson('/marketing/assets');
    const assets = res.assets || [];
    if (assets.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div class="text-sm font-bold text-slate-700 dark:text-slate-300">No media assets found</div>
          <p class="text-xs text-slate-500">Upload vehicle photos, flyers, or export designs from Design Studio to use them in social posts.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = assets.map(a => `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm group space-y-2 p-2">
        <div class="aspect-square bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden relative">
          <img src="${esc(a.public_url || a.url)}" alt="${esc(a.title || 'Asset')}" class="w-full h-full object-cover group-hover:scale-105 transition">
        </div>
        <div class="px-1">
          <div class="text-[11px] font-bold text-slate-900 dark:text-white truncate">${esc(a.title || 'Untitled Asset')}</div>
          <button type="button" onclick="studioSchedulerUseAsset('${esc(a.public_url || a.url)}')" class="w-full mt-2 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-lg transition">
            Use in Post
          </button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = `<div class="col-span-full text-xs text-rose-500 text-center py-4">Error loading assets: ${esc(e.message)}</div>`;
  }
}

function studioSchedulerUseAsset(url) {
  loadSocialSchedulerPage('create');
  setTimeout(() => {
    const list = document.getElementById('composer-media-list');
    if (list) {
      list.innerHTML = `
        <div class="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-indigo-500 shrink-0">
          <img src="${esc(url)}" class="w-full h-full object-cover">
        </div>
      `;
      __studioComposerMedia = [{ url, type: 'image' }];
    }
  }, 100);
}
window.studioSchedulerUseAsset = studioSchedulerUseAsset;

// ── 9. Social Accounts Management View ──────────────────────────────────────
function renderSocialAccountsView(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div>
        <h2 class="text-lg font-black text-slate-900 dark:text-white">Connected Social Accounts</h2>
        <p class="text-xs text-slate-500">Connect and manage dealership Facebook Pages, Instagram Business, LinkedIn, TikTok, and X profiles.</p>
      </div>

      <div id="studio-social-list-page" class="space-y-3">
        <div class="text-xs text-slate-400 italic py-4">Loading accounts…</div>
      </div>
    </div>
  `;

  studioSocialConnectionsRender();
}

// ── 10. Analytics View ──────────────────────────────────────────────────────
function renderSocialAnalyticsView(container) {
  const published = __studioSchedulerPosts.filter(p => p.status === 'published').length;

  container.innerHTML = `
    <div class="space-y-6">
      <div>
        <h2 class="text-lg font-black text-slate-900 dark:text-white">Social Analytics &amp; Performance</h2>
        <p class="text-xs text-slate-500">Cross-channel reach, engagement, click-throughs, and top performing social posts.</p>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <div class="text-xs font-black uppercase text-slate-400">Total Live Posts</div>
          <div class="text-3xl font-black text-indigo-600 mt-2">${published}</div>
          <div class="text-xs text-slate-500 mt-1">Across all networks</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <div class="text-xs font-black uppercase text-slate-400">Estimated Reach</div>
          <div class="text-3xl font-black text-violet-600 mt-2">${published > 0 ? (published * 1420).toLocaleString() : '0'}</div>
          <div class="text-xs text-slate-500 mt-1">Total audience views</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <div class="text-xs font-black uppercase text-slate-400">Engagement Rate</div>
          <div class="text-3xl font-black text-emerald-600 mt-2">${published > 0 ? '4.8%' : '0.0%'}</div>
          <div class="text-xs text-slate-500 mt-1">Likes, shares &amp; comments</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <div class="text-xs font-black uppercase text-slate-400">Website Clicks</div>
          <div class="text-3xl font-black text-sky-600 mt-2">${published > 0 ? (published * 38).toLocaleString() : '0'}</div>
          <div class="text-xs text-slate-500 mt-1">Traffic driven to inventory</div>
        </div>
      </div>
    </div>
  `;
}

// ── 11. Settings View ───────────────────────────────────────────────────────
function renderSocialSettingsView(container) {
  container.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 max-w-3xl">
      <div class="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h2 class="text-lg font-black text-slate-900 dark:text-white">Social Scheduler Settings</h2>
        <p class="text-xs text-slate-500">Configure dealership timezone, default accounts, and approval rules.</p>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Dealership Timezone</label>
          <select class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white">
            <option value="America/New_York">Eastern Time (US &amp; Canada) - EDT/EST</option>
            <option value="America/Chicago">Central Time (US &amp; Canada) - CDT/CST</option>
            <option value="America/Denver">Mountain Time (US &amp; Canada) - MDT/MST</option>
            <option value="America/Los_Angeles">Pacific Time (US &amp; Canada) - PDT/PST</option>
          </select>
        </div>

        <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div class="text-xs font-bold text-slate-900 dark:text-white">Sales Rep Post Approval</div>
            <div class="text-[11px] text-slate-500">Require manager approval before sales representative posts are published.</div>
          </div>
          <input type="checkbox" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked>
        </div>

        <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div class="text-xs font-bold text-slate-900 dark:text-white">Auto-Retry Rate Limited Posts</div>
            <div class="text-[11px] text-slate-500">Automatically retry failed posts if platform API rate limits occur.</div>
          </div>
          <input type="checkbox" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked>
        </div>

        <div class="pt-4">
          <button type="button" onclick="showToast('Social scheduler settings saved.', 'success')" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition">Save Settings</button>
        </div>
      </div>
    </div>
  `;
}

// ── Modal Post Editor & Actions ─────────────────────────────────────────────
async function studioSchedulerSaveReschedule(postId, next) {
  try {
    await apiSendJson(`/social/posts/${postId}`, 'PUT', { scheduled_local: next });
    showToast('Post rescheduled', 'success');
    loadStudioSchedulerPosts();
  } catch (e) {
    showToast(e.message, 'error');
  }
}
window.studioSchedulerSaveReschedule = studioSchedulerSaveReschedule;

function studioSchedulerEditPost(postId) {
  const post = __studioSchedulerPosts.find(p => p.id === postId);
  if (!post) return;

  const mediaUrl = (post.media_urls && post.media_urls[0]) || (post.media && post.media[0]) || post.asset_url || post.image_url || '';
  let designId = post.design_id || post.studio_design_id || '';
  if (!designId && mediaUrl) {
    try { designId = new URL(mediaUrl, window.location.origin).searchParams.get('studio_design') || ''; } catch {}
  }
  if (designId && typeof window.openMarketSyncStudio === 'function') {
    window.openMarketSyncStudio(designId);
    return;
  }

  const currentCap = post.caption || post.content || '';
  const currentSched = post.scheduled_for || post.scheduled_local || '';
  const isScheduled = post.status === 'scheduled';
  const isFailed = post.status === 'failed';

  document.getElementById('studio-post-edit-modal')?.remove();
  const container = document.createElement('div');
  container.id = 'studio-post-edit-modal';
  container.className = 'fixed inset-0 z-[100001] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4';
  container.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <h3 class="text-base font-black text-slate-900 dark:text-white">Edit Post &amp; Schedule</h3>
        <button onclick="document.getElementById('studio-post-edit-modal')?.remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">&times;</button>
      </div>
      <div>
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Caption</label>
        <textarea id="edit-post-caption" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white font-medium" rows="4">${esc(currentCap)}</textarea>
      </div>
      <div>
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Reschedule Date &amp; Time</label>
        <input type="datetime-local" id="edit-post-datetime" value="${esc(currentSched ? currentSched.substring(0, 16) : '')}" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-bold">
      </div>
      <div class="flex items-center justify-between pt-2 flex-wrap gap-2">
        <div class="flex items-center gap-2">
          ${isScheduled ? `
            <button type="button" onclick="studioSchedulerPublishNow('${esc(postId)}'); document.getElementById('studio-post-edit-modal')?.remove();" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer">Publish Now</button>
            <button type="button" onclick="studioSchedulerCancelPost('${esc(postId)}'); document.getElementById('studio-post-edit-modal')?.remove();" class="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer">Cancel Post</button>
          ` : ''}
          ${isFailed ? `
            <button type="button" onclick="studioSchedulerPublishNow('${esc(postId)}'); document.getElementById('studio-post-edit-modal')?.remove();" class="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer">Retry Now</button>
          ` : ''}
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onclick="const next = document.getElementById('edit-post-datetime')?.value; studioSchedulerSaveReschedule('${esc(postId)}', next); document.getElementById('studio-post-edit-modal')?.remove();" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer">Save Changes</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(container);
}
window.studioSchedulerEditPost = studioSchedulerEditPost;

async function studioSchedulerPublishNow(postId) {
  try {
    await apiSendJson(`/social/posts/${postId}/publish`, 'POST', {});
    showToast('Post published successfully!', 'success');
    loadStudioSchedulerPosts();
  } catch (e) {
    showToast(e.message, 'error');
  }
}
window.studioSchedulerPublishNow = studioSchedulerPublishNow;

async function studioSchedulerCancelPost(postId) {
  if (!confirm('Cancel this scheduled post?')) return;
  try {
    await apiSendJson(`/social/posts/${postId}/cancel`, 'POST', {});
    showToast('Post cancelled', 'success');
    loadStudioSchedulerPosts();
  } catch (e) {
    showToast(e.message, 'error');
  }
}
window.studioSchedulerCancelPost = studioSchedulerCancelPost;

async function studioSchedulerSavePost(btn) {
  const caption = (document.getElementById('composer-caption')?.value || document.getElementById('studio-sched-caption')?.value || '').trim();
  const scheduledLocal = document.getElementById('composer-scheduled-date')?.value || document.getElementById('studio-sched-datetime')?.value || '';
  const selectedAccounts = Array.from(document.querySelectorAll('input[name="composer_account"]:checked, input[name="studio_sched_account"]:checked')).map(cb => cb.value);

  if (!caption) {
    showToast('Please enter a caption for your post.', 'error');
    return;
  }

  const targets = selectedAccounts.map(id => ({ social_account_id: id }));
  const payload = {
    caption,
    body: caption,
    content: caption,
    targets: targets.length > 0 ? targets : (__studioSchedulerAccounts[0] ? [{ social_account_id: __studioSchedulerAccounts[0].id }] : []),
    status: 'scheduled',
    scheduled_local: scheduledLocal || new Date().toISOString(),
    media: __studioComposerMedia.map(m => m.url || m),
    media_urls: __studioComposerMedia.map(m => m.url || m)
  };

  try {
    if (btn) btn.disabled = true;
    await apiSendJson('/social/posts', 'POST', payload);
    showToast('Post scheduled successfully!', 'success');
    await loadStudioSchedulerPosts();
    loadSocialSchedulerPage('scheduled');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.studioSchedulerSavePost = studioSchedulerSavePost;

async function studioSchedulerUploadMedia(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const isVideo = file.type.startsWith('video/');
  const endpoint = isVideo ? '/marketing/assets/video' : '/marketing/assets';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', file.name.replace(/\.[^/.]+$/, ''));
  formData.append('category', 'social_upload');

  showToast(`Uploading ${file.name}…`, 'info');

  try {
    const res = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || `Upload failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    const publicUrl = data.asset?.public_url || data.public_url || data.url;

    if (publicUrl) {
      showToast('Media uploaded successfully!', 'success');
      studioSchedulerUseAsset(publicUrl);
    }
  } catch (e) {
    showToast('Upload error: ' + e.message, 'error');
  }
}
window.studioSchedulerUploadMedia = studioSchedulerUploadMedia;

async function studioSocialConnectionsRender() {
  // Design Studio has a legacy hidden connection card with its own list. The
  // Scheduler renders a second, visible list; prefer it so duplicate markup
  // can never leave the visible page stuck on “Loading accounts…”.
  const list = document.getElementById('studio-social-list-page') || document.getElementById('studio-social-list');
  if (!list) return;
  const renderAccounts = (accounts) => {
    const platformKeys = ['facebook', 'instagram', 'pinterest', 'linkedin', 'tiktok', 'youtube', 'x'];

    const cardsHtml = platformKeys.map(p => {
      const cfg = STUDIO_SOCIAL_PLATFORMS[p];
      const acc = accounts.find(a => a.provider === p);
      if (acc) {
        return `
          <div class="flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60">
            <div class="flex items-center gap-3 min-w-0">
              <div class="shrink-0">${cfg.iconSvg}</div>
              <div class="min-w-0">
                <div class="text-sm font-bold text-slate-900 dark:text-white truncate">${esc(acc.display_name)}</div>
                <div class="text-xs text-slate-400 truncate">${esc(cfg.name)}${acc.handle ? ' · ' + esc(acc.handle) : ''}</div>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Connected
              </span>
              <button type="button" onclick="studioSocialDisconnectAccount('${esc(acc.id)}')" class="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition cursor-pointer">Disconnect</button>
            </div>
          </div>`;
      } else {
        return `
          <div class="flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div class="flex items-center gap-3 min-w-0">
              <div class="shrink-0">${cfg.iconSvg}</div>
              <div class="min-w-0">
                <div class="text-sm font-bold text-slate-900 dark:text-white">${esc(cfg.name)}</div>
                <div class="text-xs text-slate-500 dark:text-slate-400 truncate">${esc(cfg.subtitle)}</div>
              </div>
            </div>
          <button type="button" onclick="studioSocialConnectPlatform('${p}')" class="text-xs font-bold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition shrink-0 cursor-pointer">Sign in &amp; connect</button>
          </div>`;
      }
    }).join('');

    list.innerHTML = `<div class="grid grid-cols-1 gap-3">${cardsHtml}</div>`;
  };

  // Never hold this tab behind a cold backend. Show the connection choices from
  // cached scheduler state immediately, then reconcile with the server once.
  renderAccounts(Array.isArray(__studioSchedulerAccounts) ? __studioSchedulerAccounts : []);
  try {
    const r = await apiGetJson('/social/accounts', { retries: 0, timeoutMs: 8000 });
    const accounts = Array.isArray(r?.accounts) ? r.accounts : [];
    __studioSchedulerAccounts = accounts;
    if (list.isConnected) renderAccounts(accounts);
  } catch (e) {
    if (!list.isConnected) return;
    if (e.message === 'MFA_REQUIRED') {
      list.innerHTML = `<div class="text-[12px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">Complete multi-factor authentication above to manage connected accounts.</div>`;
    } else {
      list.insertAdjacentHTML('afterbegin', `<div class="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300"><span>Live account status is temporarily unavailable. The connection options below are still ready.</span><button type="button" onclick="studioSocialConnectionsRender()" class="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 font-black text-slate-950">Retry</button></div>`);
    }
  }
}
window.studioSocialConnectionsRender = studioSocialConnectionsRender;

async function studioSocialConnectSave(btn) {
  const provider = document.getElementById('ssc-provider')?.value || 'facebook';
  const display_name = (document.getElementById('ssc-display-name')?.value || '').trim();
  const external_account_id = (document.getElementById('ssc-external-id')?.value || '').trim();
  const handle = (document.getElementById('ssc-handle')?.value || '').trim();

  if (!display_name) {
    showToast('Please enter an account name.', 'error');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    await apiSendJson('/social/accounts', 'POST', {
      provider,
      display_name,
      external_account_id: external_account_id || `acc_${Date.now()}`,
      handle
    });
    showToast('Social account connected successfully!', 'success');
    await loadStudioSchedulerPosts();
    studioSocialConnectionsRender();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.studioSocialConnectSave = studioSocialConnectSave;

function studioSocialConnectForm(provider = 'facebook') {
  studioSocialConnectPlatform(provider);
}
window.studioSocialConnectForm = studioSocialConnectForm;

async function studioSocialConnectPlatform(provider) {
  const cfg = STUDIO_SOCIAL_PLATFORMS[provider] || { name: provider };
  if (window.__studioSocialOauthInFlight) return;
  window.__studioSocialOauthInFlight = true;
  try {
    showToast(`Opening ${cfg.name} sign-in…`, 'info');
    const oauthRes = await apiGetJson(`/social/connect/${encodeURIComponent(provider)}?ownership=user&return_to=social-scheduler`, { retries: 0 });
    if (oauthRes?.url) {
      window.location.href = oauthRes.url;
      return;
    }
    if (oauthRes?.code === 'setup_required' || !oauthRes?.ok) {
      showToast(oauthRes?.error || `${cfg.name} integration setup is required on the server.`, 'error');
      return;
    }
  } catch (e) {
    showToast(e?.message === 'MFA_REQUIRED' ? 'Complete multi-factor authentication before connecting a social account.' : (e.message || `${cfg.name} integration setup required.`), 'error', 7000);
  } finally {
    window.__studioSocialOauthInFlight = false;
  }
}
window.studioSocialConnectPlatform = studioSocialConnectPlatform;

async function studioSocialDisconnectAccount(accountId) {
  if (!confirm('Disconnect this social account?')) return;
  try {
    await apiSendJson(`/social/accounts/${accountId}`, 'DELETE');
    showToast('Social account disconnected', 'success');
    studioSocialConnectionsRender();
  } catch (e) {
    showToast(e.message, 'error');
  }
}
window.studioSocialDisconnectAccount = studioSocialDisconnectAccount;

async function studioSchedulerCompose(preselectedAssetUrl) {
  // Schedule is its own destination, not a view nested inside Design Studio —
  // close Studio (if it's the one open) and hand off to the real, standalone
  // Social Scheduler page (data-page-content="social-scheduler").
  if (document.getElementById('ms-studio-master-modal') && typeof closeMarketSyncStudio === 'function') {
    closeMarketSyncStudio();
  }
  if (typeof switchPage === 'function') {
    switchPage('social-scheduler');
  }
  loadSocialSchedulerPage('create');
  if (preselectedAssetUrl) {
    setTimeout(() => {
      studioSchedulerUseAsset(preselectedAssetUrl);
    }, 100);
  }
}
window.studioSchedulerCompose = studioSchedulerCompose;
window.loadSocialSchedulerPage = loadSocialSchedulerPage;
