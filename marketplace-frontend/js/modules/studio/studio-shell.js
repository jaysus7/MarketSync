/**
 * MarketSync Design Studio — Master Desktop UI Workspace
 *
 * Canva-style automotive visual design studio workspace rendering top bar, tool rail,
 * asset/inventory panels, freeform Fabric.js artboard viewport, property inspector,
 * and social publishing composer handoff.
 */

window.__studioAdapter = null;
window.__studioActiveTool = 'templates';
window.__studioCurrentDesign = null;
window.__studioCurrentVehicle = null;
window.__studioAppliedTemplateKey = null;
window.__studioAppliedTemplateId = null;
window.__studioWorkspaceTab = 'create';
window.__studioZoomLevel = 0.55;
window.__studioFitObserver = null;

const DESIGN_STUDIO_TABS = [
  ['create', 'Create', 'elements'],
  ['templates', 'Templates', 'templates'],
  ['projects', 'Projects', null],
  ['brand', 'Brand', 'brand'],
  ['media', 'Media', 'media'],
  ['inventory', 'Inventory', 'inventory'],
];

const STUDIO_FREE_PHOTOS = [
  ['showroom', 'Modern dealership showroom', 'photo-1562141961-b5d64a7b61c0'],
  ['luxury car', 'Luxury car', 'photo-1503376780353-7e6692767b70'],
  ['sports car', 'Sports car on the road', 'photo-1549399542-7e3f8b79c341'],
  ['city drive', 'Car in the city', 'photo-1492144534655-ae79c964c9d7'],
  ['road travel', 'Open road', 'photo-1500530855697-b586d89ba3ee'],
  ['electric vehicle', 'Electric vehicle charging', 'photo-1592833159155-c62df1b65634'],
  ['car interior', 'Premium car interior', 'photo-1503736334956-4c8f8e92946d'],
  ['car keys', 'Car keys', 'photo-1525609004556-c46c7d6cf023'],
  ['handshake customer', 'Customer handshake', 'photo-1521791136064-7986c2920216'],
  ['team office', 'Team working together', 'photo-1522071820081-009f0129c71c'],
  ['phone social', 'Phone and social content', 'photo-1516321318423-f06f85e504b3'],
  ['service mechanic', 'Automotive service', 'photo-1487754180451-c456f719a1fc'],
  ['detail clean', 'Vehicle detailing', 'photo-1607860108855-64acf2078ed9'],
  ['mountain suv', 'SUV adventure', 'photo-1533473359331-0135ef1b58bf'],
  ['night city', 'Night city drive', 'photo-1511919884226-fd3cad34687c'],
  ['business owner', 'Business owner', 'photo-1560250097-0b93528c311a']
].map(([keywords, alt, id], index) => ({ id: index + 1, keywords, alt, url: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=82` }));

const STUDIO_SOCIAL_FORMATS = {
  square: { label: 'Instagram / Facebook Square', w: 1080, h: 1080, safe: [6, 6, 6, 6], note: 'Keep important words inside' },
  portrait: { label: 'Instagram Portrait 4:5', w: 1080, h: 1350, safe: [7, 6, 12, 6], note: 'Feed and profile-safe text area', profileCrop: true },
  story: { label: 'Instagram Story / Reel', w: 1080, h: 1920, safe: [14, 15, 20, 6], note: 'Avoid profile name, caption and action buttons' },
  tiktok: { label: 'TikTok Vertical Video', w: 1080, h: 1920, safe: [12, 16, 22, 6], note: 'Avoid caption and right-side controls' },
  landscape: { label: 'Facebook Landscape', w: 1200, h: 630, safe: [6, 6, 8, 6], note: 'Visible across feed placements' },
  linkedin: { label: 'LinkedIn Page Post', w: 1200, h: 627, safe: [6, 6, 8, 6], note: 'LinkedIn 1.91:1 safe content area' },
  x_landscape: { label: 'X Landscape Post', w: 1600, h: 900, safe: [6, 6, 8, 6], note: 'Keep text away from crop edges' },
  youtube: { label: 'YouTube Thumbnail', w: 1280, h: 720, safe: [6, 6, 8, 6], note: 'Keep title and logo inside' },
  pinterest: { label: 'Pinterest Pin 2:3', w: 1000, h: 1500, safe: [7, 7, 10, 7], note: 'Pin-safe content area' },
  facebook_post: { label: 'Facebook Post', w: 1200, h: 630, safe: [6, 6, 8, 6], note: 'Feed-safe content area' },
  facebook_story: { label: 'Facebook Story', w: 1080, h: 1920, safe: [14, 15, 20, 6], note: 'Story controls remain clear' },
  marketplace: { label: 'Marketplace Image', w: 1200, h: 900, safe: [6, 6, 8, 6], note: 'Vehicle and price stay visible in search cards' },
  email_hero: { label: 'Email Hero', w: 1200, h: 600, safe: [7, 7, 9, 7], note: 'Email-safe headline and CTA area' },
  website_banner: { label: 'Website Banner', w: 1920, h: 720, safe: [8, 7, 10, 7], note: 'Responsive website content bounds' },
  display_300x250: { label: 'Display Ad 300×250', w: 300, h: 250, safe: [7, 7, 9, 7], note: 'Compact display-ad safe area' },
  display_728x90: { label: 'Display Ad 728×90', w: 728, h: 90, safe: [8, 4, 8, 4], note: 'Leaderboard safe area' },
  display_160x600: { label: 'Display Ad 160×600', w: 160, h: 600, safe: [4, 8, 5, 8], note: 'Skyscraper safe area' },
  letterhead: { label: 'Letterhead · US Letter', w: 2550, h: 3300, safe: [5, 6, 6, 6], note: 'Print-safe margins', channel: 'print' },
  presentation: { label: 'Presentation Slide · 16:9', w: 1920, h: 1080, safe: [6, 6, 7, 6], note: 'Projector-safe content area', channel: 'presentation' },
  business_card: { label: 'Business Card · 3.5×2 in', w: 1050, h: 600, safe: [7, 7, 7, 7], note: 'Keep details inside the trim-safe area', channel: 'print' },
  postcard: { label: 'Postcard · 6×4 in', w: 1800, h: 1200, safe: [6, 6, 6, 6], note: 'Print-safe margins', channel: 'print' },
  flyer: { label: 'Flyer · US Letter', w: 2550, h: 3300, safe: [5, 5, 5, 5], note: 'Print-safe margins', channel: 'print' },
  brochure: { label: 'Tri-fold Brochure · Letter', w: 3300, h: 2550, safe: [5, 5, 5, 5], note: 'Keep copy clear of folds and trim', channel: 'print' }
};

// Keep blank-canvas creation on the same complete format catalogue as templates,
// resize, previews and exports. scene-model.js intentionally stays lightweight;
// Studio replaces its four-format bootstrap map once the full shell is available.
window.__MS_STUDIO_FORMATS = Object.fromEntries(Object.entries(STUDIO_SOCIAL_FORMATS).map(([key, format]) => [key, {
  name: format.label,
  width: format.w,
  height: format.h,
  channel: format.channel || (key.startsWith('display_') ? 'display' : 'social')
}]));

const STUDIO_FORMAT_GROUPS = [
  { id: 'social', label: 'Social posts', description: 'Feed, story, video cover and channel-specific artwork', keys: ['square','portrait','story','tiktok','facebook_post','facebook_story','linkedin','x_landscape','youtube','pinterest'] },
  { id: 'stationery', label: 'Print & stationery', description: 'Professional pieces prepared at print resolution', keys: ['business_card','letterhead','postcard','flyer','brochure'] },
  { id: 'presentation', label: 'Presentations', description: 'Widescreen decks and customer-facing slides', keys: ['presentation'] },
  { id: 'digital', label: 'Digital marketing', description: 'Marketplace, email, website and display advertising', keys: ['marketplace','email_hero','website_banner','display_300x250','display_728x90','display_160x600','landscape'] }
];

const STUDIO_DESIGN_SETS = [
  { id: 'midnight_luxe', name: 'Midnight Luxe', eyebrow: 'Premium collection', description: 'Deep navy, warm gold and editorial spacing.', background: '#07111F', accent: '#D4A94F', secondary: '#DCE7F7', font: 'Playfair Display' },
  { id: 'electric_current', name: 'Electric Current', eyebrow: 'Modern collection', description: 'Electric blue, cyan highlights and energetic framing.', background: '#102A56', accent: '#2DD4BF', secondary: '#DBEAFE', font: 'Montserrat' },
  { id: 'paper_ledger', name: 'Paper & Ledger', eyebrow: 'Editorial collection', description: 'Warm paper, charcoal type and restrained rules.', background: '#F4EFE6', accent: '#9F1239', secondary: '#27272A', font: 'Libre Baskerville' },
  { id: 'signal_red', name: 'Signal Red', eyebrow: 'Campaign collection', description: 'High-impact red, cream and angled graphic blocks.', background: '#B91C1C', accent: '#FDE68A', secondary: '#FFF7ED', font: 'Archivo Black' }
];

// Small inline SVG previews so each Shapes button shows the actual shape, not just
// its name — mirrors the geometry fabric-adapter.js's addShape() draws on canvas.
const STUDIO_SHAPE_PREVIEW = {
  rect: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><rect x="3" y="6" width="18" height="12" rx="1"/></svg>',
  badge: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><rect x="2" y="7" width="20" height="10" rx="5"/></svg>',
  circle: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>',
  ellipse: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><ellipse cx="12" cy="12" rx="10" ry="6"/></svg>',
  triangle: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><polygon points="12,4 21,20 3,20"/></svg>',
  diamond: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><polygon points="12,3 21,12 12,21 3,12"/></svg>',
  pentagon: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><polygon points="12,3 21,9.5 17.5,20 6.5,20 3,9.5"/></svg>',
  hexagon: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><polygon points="7,3 17,3 22,12 17,21 7,21 2,12"/></svg>',
  star: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><polygon points="12,3 14.7,9.5 21.8,10 16.5,14.6 18.1,21.5 12,17.8 5.9,21.5 7.5,14.6 2.2,10 9.3,9.5"/></svg>',
  line: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="17" y2="12"/><polyline points="12,6 18,12 12,18"/></svg>',
  heart: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><path d="M12 21s-7.5-5-9.5-9.5C1 7 3 4 6.5 4c2 0 3.5 1.2 5.5 3.5C14 5.2 15.5 4 17.5 4 21 4 23 7 21.5 11.5 19.5 16 12 21 12 21z"/></svg>',
  speech: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><path d="M3 4h18v11H9l-3.5 3.5V15H3V4z"/></svg>',
};

// Emoji-based clip art / stickers — no external asset library required, renders
// identically everywhere, and drops onto the canvas as a resizable text object via
// the same addText() path real text uses.
const STUDIO_STICKERS = [
  '🚗', '🚙', '🚚', '🏎️', '🔧', '⭐', '🔥', '💰', '🎉', '📞', '📍', '✅',
  '❌', '💯', '🏆', '👍', '❤️', '⚡', '🛠️', '🔑', '🎁', '📣', '🕒', '🛡️',
];

const STUDIO_STICKER_LIBRARY = Array.from({ length: 120 }, (_, index) => {
  const set = ['🚗','🚙','🚕','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏎️','🏁','🔧','🛠️','⚙️','🔩','🧰','⛽','🔋','🔌','🛞','⭐','🌟','✨','🔥','💥','💯','✅','❌','⚠️','💰','💵','💳','🏆','🥇','🎉','🎊','🎁','📣','📢','📞','📍','🗺️','📅','📝','💬','📸','🎥','▶️','⏱️','🚀','⚡','🌈','☀️','🌙','🌧️','❄️','🌲','⛰️','🌊','🛣️','🏙️','🏠','🏢','🅿️','🟢','🔵','🟣','🟠','🔴','⬛','⬜','🔶','🔷','🔺','🔻','❤️','💙','💚','💛','🖤','🤝','👍','👎','🙌','👏','😎','🤩','🙂','😮','🤔','🧑‍🔧','🧑‍💼','🐶','🐱','🌱','♻️','🔒','🛡️','📊','📈','🎯','🧠','🤖','💡','🔔','🎟️'];
  return { id: `sticker-${index + 1}`, value: set[index % set.length], name: `Sticker ${index + 1}` };
});

// Curated Google Fonts for on-canvas text — loaded on demand (not on every page
// load) the first time the Text tool is opened, via a single stylesheet request.
const STUDIO_GOOGLE_FONTS = [
  'Manrope', 'Inter', 'Poppins', 'Montserrat', 'Oswald', 'Bebas Neue',
  'Playfair Display', 'Anton', 'Archivo Black', 'Roboto Condensed',
  'DM Sans', 'Barlow Condensed', 'Teko', 'Righteous', 'Dancing Script',
  'Satisfy', 'Permanent Marker', 'Lobster', 'Orbitron', 'Chakra Petch',
];

const STUDIO_FONT_CATEGORIES = { all: 'All fonts', sans: 'Sans serif', display: 'Display', serif: 'Serif', mono: 'Monospace', script: 'Script / hand' };
const STUDIO_FONT_CATEGORY_FOR = font => /serif|merriweather|garamond|crimson|lora|baskerville|spectral|prata|zilla|cormorant/i.test(font) ? 'serif' : /script|hand|lobster|satisfy|dancing|marker|ravi|turncoat/i.test(font) ? 'script' : /mono|inconsolata|plex mono/i.test(font) ? 'mono' : /anton|bebas|oswald|archivo black|black|orbitron|teko|righteous|russo|staatliches|unbounded|syne|fjalla/i.test(font) ? 'display' : 'sans';
const STUDIO_FONT_CATALOG = Array.from(new Set([...STUDIO_GOOGLE_FONTS, 'Roboto','Open Sans','Lato','Nunito','Raleway','Merriweather','Source Sans 3','Source Serif 4','Work Sans','Rubik','Outfit','Space Grotesk','Plus Jakarta Sans','Sora','Urbanist','Figtree','Geologica','Albert Sans','Archivo','Barlow','Cabin','Catamaran','Chakra Petch','Chivo','Commissioner','Comfortaa','Cormorant Garamond','Crimson Text','Dancing Script','Dela Gothic One','EB Garamond','Exo 2','Fira Sans','Fjalla One','Fraunces','Gabarito','Heebo','Hind','IBM Plex Sans','IBM Plex Serif','Inconsolata','Josefin Sans','Kanit','Karla','Khand','Libre Baskerville','Libre Franklin','Lobster','Lora','Marcellus','Maven Pro','Michroma','Mitr','Mukta','Noto Sans','Noto Serif','Oleo Script','Onest','Orbitron','Patrick Hand','Permanent Marker','Philosopher','Play','Prata','Public Sans','Quicksand','Rajdhani','Red Hat Display','Rokkitt','Russo One','Saira','Satisfy','Sen','Signika','Skranji','Slabo 27px','Spectral','Staatliches','Syne','Titillium Web','Trispace','Ubuntu','Unbounded','Varela Round','Vollkorn','Walter Turncoat','Yanone Kaffeesatz','Zilla Slab']));
const STUDIO_SHAPE_LIBRARY = ['rect','badge','circle','ellipse','triangle','diamond','pentagon','hexagon','star','line','arrow','heart','speech'].map((base, index) => ({ id: `shape-${index + 1}`, base, name: base.replace(/^./, char => char.toUpperCase()) }));
const STUDIO_ICON_LIBRARY = ['car','truck','bus','bike','motorcycle','fuel','battery-charging','ev-station','gauge','route','navigation','map','map-pin','building-2','warehouse','store','shopping-cart','tag','tags','badge-percent','badge-dollar-sign','receipt','credit-card','wallet','banknote','calculator','calendar','clock','alarm-clock','phone','smartphone','mail','send','message-circle','messages-square','user','users','user-round-check','contact','handshake','heart','star','thumbs-up','award','trophy','shield','shield-check','lock','key-round','check','circle-check','info','circle-help','triangle-alert','x','plus','minus','search','filter','sliders-horizontal','settings','wrench','hammer','screwdriver','drill','tool-case','sparkles','wand-sparkles','lightbulb','rocket','zap','flame','gift','party-popper','megaphone','bell','camera','image','images','video','play','pause','music','mic','upload','download','share-2','link','external-link','globe-2','home','building','briefcase-business','file-text','folder','printer','qr-code','chart-line','chart-pie','chart-no-axes-combined','trending-up','eye','palette','type','shapes','layers-3','layout-template','instagram','facebook','linkedin','youtube'].map((name, index) => ({ id: `icon-${index + 1}`, name, label: name.replace(/-/g, ' ') }));
const STUDIO_ICON_CATEGORIES = {
  all: ['All', 'shapes'],
  automotive: ['Automotive', 'car'],
  social: ['Social', 'heart'],
  offers: ['Offers', 'badge-percent'],
  contact: ['Contact', 'message-circle'],
  business: ['Business', 'briefcase-business'],
  media: ['Media', 'camera'],
  navigation: ['Navigation', 'map-pin'],
  service: ['Service', 'wrench'],
};
const STUDIO_ICON_CATEGORY_NAMES = {
  automotive: new Set(['car','truck','bus','bike','motorcycle','fuel','battery-charging','ev-station','gauge','route','navigation']),
  social: new Set(['heart','star','thumbs-up','award','trophy','gift','party-popper','sparkles','flame','instagram','facebook','linkedin','youtube']),
  offers: new Set(['tag','tags','badge-percent','badge-dollar-sign','receipt','credit-card','wallet','banknote','calculator','shopping-cart']),
  contact: new Set(['phone','smartphone','mail','send','message-circle','messages-square','user','users','user-round-check','contact','handshake']),
  media: new Set(['camera','image','images','video','play','pause','music','mic','upload','download','share-2']),
  navigation: new Set(['route','navigation','map','map-pin','globe-2','home','building','external-link','link']),
  service: new Set(['settings','wrench','hammer','screwdriver','drill','tool-case','shield','shield-check','lock','key-round']),
};
const STUDIO_GIF_LIBRARY = [['Celebration','https://media.giphy.com/media/g9582DNuQppxC/giphy.gif'],['Applause','https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif'],['Rocket','https://media.giphy.com/media/26tOZ6e9jD8ZP7jK8/giphy.gif'],['Sparkles','https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif']];
const STUDIO_GIF_PRESETS = (() => {
  const groups = {
    Automotive: ['car','truck','suv','sedan','electric vehicle','charging','test drive','dealership','sales','service','oil change','car wash','detail','mechanic','wrench','tire','engine','road trip','race car','driving'],
    Reactions: ['yes','no','wow','mind blown','excited','happy','sad','laughing','applause','high five','thumbs up','celebrate','mic drop','nailed it','bravo','thank you','welcome','oops','confused','thinking'],
    Business: ['sale','deal','price drop','new arrival','sold','approved','financing','money','cash','growth','success','meeting','teamwork','work smarter','analytics','chart up','goal','launch','announcement','marketing'],
    Seasonal: ['summer','winter','spring','fall','new year','valentines','st patricks','easter','mothers day','fathers day','canada day','halloween','thanksgiving','black friday','cyber monday','christmas','holiday','snow','sunshine','weekend'],
    Utility: ['loading','check mark','error','warning','notification','arrow','swipe','click here','coming soon','stay tuned','live','breaking news','reminder','question','idea','light bulb','rocket launch','sparkles','fire','confetti']
  };
  return Object.entries(groups).flatMap(([category, terms]) => terms.map((query, index) => ({ id: `gif-preset-${category.toLowerCase()}-${index + 1}`, category, query, label: query.replace(/\b\w/g, char => char.toUpperCase()) }))).slice(0, 120);
})();
const STUDIO_PREMADE_ELEMENTS = [
  ['sale-badge','Sale badge','Offers','badge','SALE EVENT'], ['price-badge','Price badge','Offers','badge','SALE PRICE'], ['payment-card','Payment card','Offers','card','PAYMENT OFFER'], ['apr-badge','Finance offer badge','Offers','badge','FINANCE OFFER'], ['clearance-ribbon','Clearance ribbon','Offers','ribbon','CLEARANCE'], ['new-arrival','New arrival','Offers','badge','JUST ARRIVED'], ['hot-deal','Hot deal','Offers','badge','HOT DEAL'], ['price-drop','Price drop','Offers','badge','PRICE DROP'],
  ['cta-primary','Primary CTA','Buttons','button','SHOP INVENTORY'], ['cta-secondary','Secondary CTA','Buttons','button','BOOK A TEST DRIVE'], ['cta-finance','Finance CTA','Buttons','button','GET PRE-APPROVED'], ['cta-trade','Trade CTA','Buttons','button','VALUE MY TRADE'], ['cta-service','Service CTA','Buttons','button','BOOK SERVICE'], ['cta-contact','Contact CTA','Buttons','button','TALK TO OUR TEAM'],
  ['review-badge','Review badge','Trust','trust','CUSTOMER REVIEWS'], ['guarantee-badge','Dealer commitment badge','Trust','trust','OUR DEALER COMMITMENT'], ['one-owner','One owner badge','Trust','badge','ONE OWNER'], ['certified-badge','Certified badge','Trust','badge','CERTIFIED PRE-OWNED'], ['no-credit','Apply online','Trust','trust','APPLY ONLINE'], ['fast-approval','Pre-approval CTA','Trust','trust','START PRE-APPROVAL'],
  ['trade-callout','Trade-in callout','Automotive','callout','REQUEST A TRADE VALUE'], ['inventory-label','Inventory label','Automotive','badge','IN STOCK'], ['vehicle-specs','Vehicle specs','Automotive','card','YEAR • BODY • DRIVETRAIN'], ['featured-vehicle','Featured vehicle','Automotive','card','FEATURED VEHICLE'], ['electric-label','Electric label','Automotive','badge','ELECTRIC VEHICLE'], ['fuel-saver','Fuel saver','Automotive','badge','FUEL EFFICIENT'],
  ['dealer-header','Dealership header','Brand','header','DEALERSHIP NAME'], ['hours-card','Hours card','Brand','card','VIEW TODAY\'S HOURS'], ['contact-card','Contact card','Brand','card','CALL OUR TEAM'], ['location-card','Location card','Brand','card','VISIT OUR SHOWROOM'], ['social-follow','Social follow','Brand','button','FOLLOW US'], ['newsletter','Newsletter CTA','Brand','button','GET OUR SPECIALS'],
  ['instagram-follow','Instagram follow','Social','social','FOLLOW ON INSTAGRAM'], ['facebook-follow','Facebook follow','Social','social','FOLLOW ON FACEBOOK'], ['youtube-watch','YouTube channel','Social','social','WATCH OUR VIDEOS'], ['review-stars','Five-star review','Trust','rating','5-STAR REVIEWS'],
  ['event-date','Event date card','Graphics','date','SAT • SEPT 12'], ['quote-card','Customer quote','Graphics','quote','“A BETTER WAY TO BUY.”'], ['feature-stat','Feature statistic','Graphics','stat','100+ VEHICLES'], ['arrow-callout','Arrow callout','Graphics','arrow','SHOP THIS WAY'],
  ['disclaimer-apr','APR disclaimer','Legal','legal','O.A.C. • Terms and conditions apply.'], ['disclaimer-price','Price disclaimer','Legal','legal','Plus taxes, licensing and applicable fees.'], ['disclaimer-inventory','Inventory disclaimer','Legal','legal','Vehicle availability subject to change.'], ['disclaimer-trade','Trade disclaimer','Legal','legal','Trade values subject to in-person appraisal.']
].map(([id,name,category,kind,text]) => ({
  id, name, category, kind, text,
  icon: kind === 'social' ? (id.startsWith('instagram') ? '◎' : id.startsWith('facebook') ? 'f' : '▶') : kind === 'rating' ? '★★★★★' : kind === 'date' ? '▣' : kind === 'quote' ? '“' : kind === 'stat' ? '↗' : kind === 'arrow' ? '➜' : category === 'Offers' ? '🏷' : category === 'Buttons' ? '→' : category === 'Trust' ? '✓' : category === 'Automotive' ? '🚗' : category === 'Brand' ? '◆' : 'ⓘ',
  subtext: kind === 'legal' ? 'Editable disclosure copy' : category === 'Offers' ? 'Add approved offer details' : category === 'Buttons' ? 'Editable call to action' : category === 'Trust' ? 'Add verified supporting details' : category === 'Automotive' ? 'Connected inventory content' : 'Dealership information'
}));
const STUDIO_ELEMENT_CATEGORY_META = {
  Offers: ['%', '#fff7ed', '#f97316'], Buttons: ['↗', '#eff6ff', '#2563eb'], Trust: ['✓', '#ecfdf5', '#059669'], Automotive: ['🚗', '#eef2ff', '#4f46e5'],
  Brand: ['◆', '#f5f3ff', '#7c3aed'], Social: ['◎', '#fdf2f8', '#db2777'], Graphics: ['✦', '#ecfeff', '#0891b2'], Legal: ['§', '#f8fafc', '#475569'],
};
const STUDIO_ELEMENT_FEATURED_IDS = ['sale-badge','cta-primary','review-badge','trade-callout','dealer-header','instagram-follow','event-date','quote-card','clearance-ribbon','disclaimer-apr','feature-stat','arrow-callout'];

const STUDIO_VISUAL_ELEMENT_CATEGORIES = {
  All: ['layout-grid', '#EEF2FF', '#4F46E5'],
  Shapes: ['shapes', '#ECFEFF', '#0891B2'],
  Graphics: ['sparkles', '#FFF7ED', '#EA580C'],
  Animations: ['play-circle', '#F5F3FF', '#7C3AED'],
  Icons: ['badge-check', '#EFF6FF', '#2563EB'],
  Frames: ['frame', '#FDF2F8', '#DB2777'],
  Grids: ['grid-2x2', '#F0FDF4', '#16A34A'],
  Charts: ['chart-no-axes-combined', '#FEFCE8', '#CA8A04'],
  Tables: ['table-2', '#F8FAFC', '#475569'],
  Social: ['instagram', '#FAF5FF', '#9333EA']
};

// The visual elements catalog. One row per shape / icon / graphic.
// Colour is deliberately NOT multiplied here — the Color tool in the
// inspector applies any colour to any element, so duplicating 1000
// "same shape in 20 colours" rows was noise, not variety. User note:
// "Shapes should just be one shape and then colours can change with
// colour options".
//
// Every shape is fabric-native and therefore supports freeform
// transform (drag to resize any axis, drag corner to skew, drag
// rotation handle) out of the box — fabric-adapter.js enables all
// handles on every added shape.
const STUDIO_VISUAL_ELEMENTS = (() => {
  return [
  // Shapes — one row each.
  ...[
    ['shape-circle','Circle','circle','#111827'], ['shape-ring','Outline circle','ring','#2563EB'], ['shape-square','Square','rect','#7C3AED'], ['shape-round','Rounded square','rounded','#EC4899'],
    ['shape-triangle','Triangle','triangle','#F97316'], ['shape-diamond','Diamond','diamond','#06B6D4'], ['shape-star','Star','star','#EAB308'], ['shape-heart','Heart','heart','#E11D48'],
    ['shape-hexagon','Hexagon','hexagon','#0F766E'], ['shape-pill','Pill','badge','#4F46E5'], ['shape-line','Line','line','#334155'], ['shape-arrow','Arrow','arrow','#EA580C']
  ].map(([id,name,shape,color]) => ({ id,name,category:'Shapes',kind:'shape',shape,color })),
  // Graphics — recognisable brand marks and campaign motifs. Colour
  // is a default; the Color tool changes it.
  ...[
    ['graphic-sparkles','Sparkles','sparkles','#7C3AED'], ['graphic-sun','Sun burst','sun','#F59E0B'], ['graphic-zap','Lightning','zap','#EAB308'], ['graphic-flame','Flame','flame','#EF4444'],
    ['graphic-megaphone','Megaphone','megaphone','#2563EB'], ['graphic-gift','Gift','gift','#DB2777'], ['graphic-trophy','Trophy','trophy','#D97706'], ['graphic-quote','Quote marks','quote','#0F766E'],
    ['graphic-location','Location','map-pin','#DC2626'], ['graphic-road','Direction','navigation','#0284C7'], ['graphic-check','Approval check','badge-check','#16A34A'], ['graphic-shield','Shield','shield-check','#4F46E5'],
    ['graphic-award','Award','award','#B45309'], ['graphic-crown','Crown','crown','#D97706'], ['graphic-rocket','Rocket','rocket','#DC2626'], ['graphic-heart','Heart','heart','#E11D48'],
    ['graphic-thumb','Thumb up','thumbs-up','#16A34A'], ['graphic-party','Party','party-popper','#F59E0B'], ['graphic-medal','Medal','medal','#CA8A04'], ['graphic-bell','Bell','bell','#2563EB'],
  ].map(([id,name,icon,color]) => ({ id,name,category:'Graphics',kind:'icon',icon,color })),
  ...[
    ['animation-sparkle','Floating sparkle','sparkles','#7C3AED','float'], ['animation-heart','Pulsing heart','heart','#E11D48','pulse'], ['animation-star','Bouncing star','star','#EAB308','bounce'], ['animation-gear','Spinning gear','settings','#2563EB','spin'],
    ['animation-arrow','Bouncing arrow','arrow-right','#EA580C','bounce'], ['animation-bell','Floating bell','bell','#D97706','float'], ['animation-badge','Pulsing badge','badge-check','#16A34A','pulse'], ['animation-flame','Floating flame','flame','#EF4444','float']
  ].map(([id,name,icon,color,animation]) => ({ id,name,category:'Animations',kind:'icon',icon,color,animation })),
  // Icons — one row per icon (~60), automotive / business flavoured.
  // Colour comes from the Color tool — no per-colour duplicates.
  ...[
    ['car','Car'],['car-front','Car front'],['truck','Truck'],['bus','Bus'],['bike','Bike'],['fuel','Fuel'],['gauge','Gauge'],['wrench','Wrench'],['cog','Cog'],['battery','Battery'],['battery-charging','EV charge'],
    ['user','Person'],['user-check','Approved'],['users','Team'],['user-plus','Add customer'],['handshake','Handshake'],['headphones','Support'],['contact','Contact'],['crown','VIP'],['shield','Shield'],
    ['phone','Phone'],['phone-call','Call'],['phone-incoming','Incoming'],['phone-outgoing','Outgoing'],['mail','Email'],['mail-open','Open email'],['send','Send'],['message-circle','Chat'],['message-square','Message'],['bell','Bell'],
    ['tag','Price tag'],['tags','Tags'],['credit-card','Payment'],['wallet','Wallet'],['banknote','Cash'],['coins','Coins'],['percent','Discount'],['shopping-cart','Cart'],['receipt','Receipt'],['trending-up','Trend up'],
    ['map-pin','Location'],['map','Map'],['navigation','Navigation'],['route','Route'],['compass','Compass'],['package','Package'],['warehouse','Warehouse'],['anchor','Anchor'],['plane','Plane'],
    ['calendar','Calendar'],['clock','Clock'],['camera','Camera'],['video','Video'],['building-2','Building'],['globe-2','Website'],['search','Search'],['share-2','Share'],['qr-code','QR'],['key-round','Key'],
  ].map(([icon, name]) => ({ id: `icon-${icon}`, name, category: 'Icons', kind: 'icon', icon, color: '#2563EB' })),
  ...[
    ['frame-classic','Classic frame','classic'], ['frame-round','Rounded frame','round'], ['frame-circle','Circle frame','circle'], ['frame-polaroid','Polaroid frame','polaroid'],
    ['frame-phone','Phone frame','phone'], ['frame-window','Browser frame','window'], ['frame-arch','Arch frame','arch'], ['frame-double','Double frame','double']
  ].map(([id,name,style]) => ({ id,name,category:'Frames',kind:'frame',style,color:'#8B5CF6' })),
  ...[
    ['grid-halves','Two columns','halves'], ['grid-stack','Two rows','stack'], ['grid-feature','Feature grid','feature'], ['grid-thirds','Three columns','thirds'],
    ['grid-collage','Photo collage','collage'], ['grid-mosaic','Mosaic','mosaic'], ['grid-sidebar','Sidebar grid','sidebar'], ['grid-four','Four tiles','four']
  ].map(([id,name,style]) => ({ id,name,category:'Grids',kind:'grid',style,color:'#0EA5E9' })),
  ...[
    ['chart-bars','Bar chart','bars'], ['chart-columns','Column chart','columns'], ['chart-donut','Donut chart','donut'], ['chart-progress','Progress rings','progress'],
    ['chart-line','Line chart','line'], ['chart-kpi','KPI card','kpi']
  ].map(([id,name,style]) => ({ id,name,category:'Charts',kind:'chart',style,color:'#4F46E5' })),
  ...[
    ['table-simple','Simple table','simple'], ['table-header','Header table','header'], ['table-price','Price list','price'], ['table-compare','Comparison','compare'], ['table-schedule','Schedule','schedule'], ['table-specs','Vehicle specs','specs']
  ].map(([id,name,style]) => ({ id,name,category:'Tables',kind:'table',style,color:'#334155' })),
  ...[
    ['social-instagram','Instagram','instagram'], ['social-facebook','Facebook','facebook'], ['social-linkedin','LinkedIn','linkedin'], ['social-youtube','YouTube','youtube'],
    ['social-tiktok','TikTok','tiktok'], ['social-x','X','x-twitter'], ['social-pinterest','Pinterest','pinterest'], ['social-share','Share','share-2']
  ].map(([id,name,icon]) => ({ id,name,category:'Social',kind:'icon',icon,color:'#111827',library:icon === 'share-2' ? 'lucide' : 'fontawesome-brands' }))
  ];
})();

function loadStudioGoogleFonts() {
  if (document.getElementById('studio-google-fonts-link')) return;
  const link = document.createElement('link');
  link.id = 'studio-google-fonts-link';
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${STUDIO_GOOGLE_FONTS.map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;700;900`).join('&')}&display=swap`;
  document.head.appendChild(link);
}

// Applies to the selected text box if one is active, otherwise becomes the
// font new text (AI copy, headings, etc.) is added with next.
function studioPickFont(fontName) {
  window.__studioSelectedFont = `'${fontName}', sans-serif`;
  const picker = document.getElementById('studio-font-picker');
  if (picker && picker.tagName === 'SELECT') picker.value = fontName;
  const active = window.__studioAdapter?.fabricCanvas?.getActiveObject();
  if (active && ['textbox', 'text', 'i-text'].includes(active.type)) {
    window.__studioAdapter.updateSelectedText({ fontFamily: window.__studioSelectedFont });
    if (typeof showToast === 'function') showToast(`${fontName} applied`, 'success');
  } else if (typeof showToast === 'function') {
    showToast(`${fontName} selected — new text will use it`, 'info');
  }
}
window.studioPickFont = studioPickFont;

function studioAddSticker(emoji) {
  if (!window.__studioAdapter) return;
  window.__studioAdapter.addText(emoji, { fontSize: 96, fontWeight: '400' });
}
window.studioAddSticker = studioAddSticker;

function studioCatalogButtons(items, query, render) { const needle = String(query || '').toLowerCase(); return items.filter(item => !needle || `${item.name} ${item.label || ''} ${item.value || ''}`.toLowerCase().includes(needle)).map(render).join('') || '<div class="col-span-4 p-4 text-center text-xs text-slate-500">Nothing matches that search.</div>'; }
window.__studioCatalogLimits = { icons: 28, elements: 24, text: 12, ...(window.__studioCatalogLimits || {}) };
window.__studioCatalogObservers = window.__studioCatalogObservers || {};
function studioCatalogMore(kind, remaining) { return remaining > 0 ? `<button type="button" data-studio-lazy="${kind}" onclick="loadMoreStudioCatalog('${kind}')" class="studio-catalog-more">Loading ${Math.min(12, remaining)} more…</button>` : ''; }
function wireStudioLazyCatalog(kind) {
  const sentinel = document.querySelector(`[data-studio-lazy="${kind}"]`);
  window.__studioCatalogObservers[kind]?.disconnect?.();
  if (!sentinel || typeof IntersectionObserver === 'undefined') return;
  const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); loadMoreStudioCatalog(kind); } }, { root: sentinel.closest('.studio-catalog-scroll'), rootMargin: '120px' });
  window.__studioCatalogObservers[kind] = observer;
  observer.observe(sentinel);
}
function loadMoreStudioCatalog(kind) {
  window.__studioCatalogLimits[kind] = Number(window.__studioCatalogLimits[kind] || 12) + (kind === 'icons' ? 28 : 12);
  if (kind === 'icons') filterStudioIcons(false);
  if (kind === 'elements') filterStudioPremadeElements(false);
  if (kind === 'text') filterStudioTextTemplates(false);
}
window.loadMoreStudioCatalog = loadMoreStudioCatalog;
function renderStudioShapeLibrary(query = '') { return studioCatalogButtons(STUDIO_SHAPE_LIBRARY, query, item => `<button type="button" onclick="studioAddShape('${item.base}')" title="${escS(item.name)}" aria-label="Add ${escS(item.name)}" class="studio-shape-card aspect-square rounded-2xl bg-transparent hover:bg-blue-50 dark:hover:bg-slate-800/70 border border-transparent hover:border-blue-300 dark:hover:border-blue-500/60 text-slate-700 dark:text-slate-200 flex items-center justify-center transition"><span class="studio-shape-art">${STUDIO_SHAPE_PREVIEW[item.base] || '◆'}</span></button>`); }
function filterStudioShapes() { const el = document.getElementById('studio-shape-library'); if (el) el.innerHTML = renderStudioShapeLibrary(document.getElementById('studio-shape-query')?.value); }
function renderStudioStickerLibrary(query = '') { return studioCatalogButtons(STUDIO_STICKER_LIBRARY, query, item => `<button type="button" onclick="studioAddSticker('${item.value}')" title="${escS(item.name)}" class="aspect-square rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/20 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-2xl">${item.value}</button>`); }
function filterStudioStickers() { const el = document.getElementById('studio-sticker-library'); if (el) el.innerHTML = renderStudioStickerLibrary(document.getElementById('studio-sticker-query')?.value); }
function renderStudioFontLibrary(query = '', category = 'all') { const needle = String(query || '').toLowerCase(); const groups = Object.keys(STUDIO_FONT_CATEGORIES).filter(key => key !== 'all' && (category === 'all' || key === category)); return groups.map(key => { const fonts = STUDIO_FONT_CATALOG.filter(font => STUDIO_FONT_CATEGORY_FOR(font) === key && (!needle || font.toLowerCase().includes(needle))); return fonts.length ? `<optgroup label="${escS(STUDIO_FONT_CATEGORIES[key])}">${fonts.map(font => `<option value="${escS(font)}" style="font-family:'${escS(font)}',sans-serif">${escS(font)}</option>`).join('')}</optgroup>` : ''; }).join('') || '<option value="">No fonts match</option>'; }
function filterStudioFonts() { const el = document.getElementById('studio-font-picker'); if (el) el.innerHTML = renderStudioFontLibrary(document.getElementById('studio-font-query')?.value, document.getElementById('studio-font-category')?.value || 'all'); }
function loadStudioIconFont() { if (document.getElementById('studio-fontawesome-link')) return; const link = document.createElement('link'); link.id = 'studio-fontawesome-link'; link.rel = 'stylesheet'; link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css'; document.head.appendChild(link); }
const STUDIO_ICON_SYMBOLS = { car:'🚗', truck:'🚚', 'screwdriver-wrench':'🛠️', gear:'⚙️', wrench:'🔧', calendar:'📅', camera:'📷', 'chart-line':'📈', 'chart-pie':'📊', check:'✓', 'circle-check':'✅', 'circle-info':'ⓘ', clock:'🕒', cloud:'☁️', comment:'💬', 'credit-card':'💳', envelope:'✉️', file:'📄', film:'🎞️', flag:'⚑', folder:'📁', gift:'🎁', globe:'🌐', handshake:'🤝', heart:'❤️', house:'🏠', image:'🖼️', key:'🔑', laptop:'💻', leaf:'🍃', lightbulb:'💡', link:'🔗', 'location-dot':'📍', lock:'🔒', 'magnifying-glass':'🔍', map:'🗺️', message:'💬', 'mobile-screen':'📱', 'paper-plane':'✈️', phone:'☎️', play:'▶️', plus:'＋', print:'🖨️', rocket:'🚀', 'share-nodes':'🔗', shield:'🛡️', shop:'🏪', star:'⭐', tags:'🏷️', 'thumbs-up':'👍', ticket:'🎟️', toolbox:'🧰', trophy:'🏆', user:'👤', users:'👥', video:'🎥', wallet:'👛', 'wand-magic-sparkles':'✨', wifi:'📶', xmark:'×' };
const STUDIO_BRAND_ICON_LIBRARY = ['facebook','instagram','linkedin','tiktok','youtube','x-twitter','whatsapp','telegram','discord','reddit','pinterest','snapchat','threads','twitch','spotify','apple','google','microsoft','amazon','github','gitlab','slack','figma','canva','wordpress','shopify','wix','squarespace','stripe','paypal','square','uber','lyft','airbnb','skype','vimeo','dribbble','behance','medium','tumblr','yelp','tripadvisor','wikipedia-w','stack-overflow','codepen','npm','node','react','vuejs','angular','svelte','html5','css3-alt','js','python','java','php','swift','android','chrome','firefox','safari','edge','opera','internet-explorer','linux','windows','docker','aws','cloudflare','mailchimp','hubspot','salesforce','intercom','hubspot','google-drive','dropbox','onedrive','box','evernote','jira','trello','asana','notion','meetup','sketch','adobe','autoprefixer','bootstrap','tailwind-css','sass','less','npm','git-alt','bitbucket','firstdraft','monday','readme','weixin','line','viber','signal-messenger','kickstarter','patreon','buy-n-large','product-hunt','steam','xbox','playstation','app-store','google-play','goodreads','lastfm','soundcloud','deezer','bandcamp','itunes','reddit-alien','facebook-messenger','google-business','google-pay','apple-pay','cc-visa','cc-mastercard','cc-amex','cc-paypal','cc-stripe','wifi','phone','envelope','globe'].filter((name, index, names) => names.indexOf(name) === index).map((name, index) => ({ id: `brand-icon-${index + 1}`, name, label: name.replace(/-/g, ' ') }));
const STUDIO_ICON_LIBRARIES = { lucide: ['Lucide', 'lucide'], phosphor: ['Phosphor', 'ph'], tabler: ['Tabler', 'tabler'], material: ['Material Symbols', 'material-symbols'], heroicons: ['Heroicons', 'heroicons-outline'], bootstrap: ['Bootstrap Icons', 'bi'], remix: ['Remix Icon', 'ri'], iconoir: ['Iconoir', 'iconoir'], boxicons: ['Boxicons', 'bxs'], iconify: ['Iconify · Lucide set', 'lucide'], fontawesome: ['Font Awesome Free · Solid', 'fa6-solid'], 'fontawesome-brands': ['Font Awesome Free · Brands & Social', 'fa6-brands'] };
const STUDIO_ICON_SLUGS = {
  lucide: { motorcycle:'bike', 'ev-station':'battery-charging', 'screwdriver-wrench':'wrench', gear:'settings', 'circle-info':'info', comment:'message-circle', envelope:'mail', globe:'globe-2', house:'home', 'location-dot':'map-pin', 'magnifying-glass':'search', message:'message-square', 'mobile-screen':'smartphone', 'paper-plane':'send', print:'printer', 'share-nodes':'share-2', shop:'shopping-bag', 'wand-magic-sparkles':'wand-sparkles', xmark:'x' },
  phosphor: { 'screwdriver-wrench':'wrench', gear:'gear', 'circle-info':'info', envelope:'envelope', globe:'globe', house:'house', 'location-dot':'map-pin', 'magnifying-glass':'magnifying-glass', message:'chat', 'mobile-screen':'device-mobile', 'paper-plane':'paper-plane-tilt', print:'printer', 'share-nodes':'share-network', shop:'storefront', xmark:'x' },
  tabler: { 'screwdriver-wrench':'tools', gear:'settings', 'circle-info':'info-circle', envelope:'mail', globe:'world', house:'home', image:'photo', 'location-dot':'map-pin', 'magnifying-glass':'search', message:'message', 'mobile-screen':'device-mobile', 'paper-plane':'send', print:'printer', 'share-nodes':'share', shop:'building-store', xmark:'x' },
  material: { 'screwdriver-wrench':'build', gear:'settings', 'circle-info':'info', envelope:'mail', globe:'public', house:'home', image:'image', 'location-dot':'location_on', 'magnifying-glass':'search', message:'chat_bubble', 'mobile-screen':'smartphone', 'paper-plane':'send', print:'print', 'share-nodes':'share', shop:'storefront', xmark:'close' }
};
function studioIconUrl(name, library = 'lucide', color = '#2563EB') { const [, prefix] = STUDIO_ICON_LIBRARIES[library] || STUDIO_ICON_LIBRARIES.lucide; const slug = STUDIO_ICON_SLUGS[library]?.[name] || name; return `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(slug)}.svg?color=${encodeURIComponent(color)}`; }
function studioIconCategory(item) { return Object.entries(STUDIO_ICON_CATEGORY_NAMES).find(([, names]) => names.has(item.name))?.[0] || 'business'; }
function renderStudioIconCategories() { return Object.entries(STUDIO_ICON_CATEGORIES).map(([key, [label, icon]]) => `<button type="button" onclick="setStudioIconCategory('${key}')" aria-current="${(window.__studioIconCategory || 'all') === key}" class="studio-category-chip"><img src="${studioIconUrl(icon)}" loading="lazy" decoding="async" alt=""><span>${label}</span></button>`).join(''); }
function setStudioIconCategory(category) { window.__studioIconCategory = category; window.__studioCatalogLimits.icons = 28; document.getElementById('studio-icon-categories')?.querySelectorAll('button').forEach(button => button.setAttribute('aria-current', String(button.textContent.trim().toLowerCase() === STUDIO_ICON_CATEGORIES[category]?.[0].toLowerCase()))); filterStudioIcons(false); }
function renderStudioIconLibrary(query = '', library = document.getElementById('studio-icon-library-select')?.value || 'lucide') { const catalog = library === 'fontawesome-brands' ? STUDIO_BRAND_ICON_LIBRARY : STUDIO_ICON_LIBRARY; const needle = String(query || '').toLowerCase(); const category = window.__studioIconCategory || 'all'; const matches = catalog.filter(item => (!needle || `${item.name} ${item.label || ''}`.toLowerCase().includes(needle)) && (category === 'all' || library === 'fontawesome-brands' && category === 'social' || library !== 'fontawesome-brands' && studioIconCategory(item) === category)); const limit = Number(window.__studioCatalogLimits.icons || 28); const cards = matches.slice(0, limit).map(item => { const fallback = STUDIO_ICON_SYMBOLS[item.name] || '✦'; const url = studioIconUrl(item.name, library); return `<button type="button" onclick="studioAddIcon('${item.id}')" title="${escS(item.label)}" aria-label="Add ${escS(item.label)} icon" class="studio-icon-card"><span class="studio-icon-visual"><span aria-hidden="true">${fallback}</span><img src="${url}" alt="" loading="lazy" decoding="async" class="studio-icon-art object-contain" onload="this.previousElementSibling.hidden=true" onerror="this.remove()"></span><small>${escS(item.label)}</small></button>`; }).join(''); return cards + studioCatalogMore('icons', matches.length - limit) || '<div class="col-span-4 p-4 text-center text-xs text-slate-500">Nothing matches that search.</div>'; }
function filterStudioIcons(reset = true) { if (reset) window.__studioCatalogLimits.icons = 28; const el = document.getElementById('studio-icon-library'); if (el) { el.innerHTML = renderStudioIconLibrary(document.getElementById('studio-icon-query')?.value, document.getElementById('studio-icon-library-select')?.value || 'lucide'); setTimeout(() => wireStudioLazyCatalog('icons'), 0); } }
function loadMoreStudioIcons() { loadMoreStudioCatalog('icons'); }
window.loadMoreStudioIcons = loadMoreStudioIcons;
function studioAddIcon(id) { const library = document.getElementById('studio-icon-library-select')?.value || 'lucide'; const catalog = library === 'fontawesome-brands' ? STUDIO_BRAND_ICON_LIBRARY : STUDIO_ICON_LIBRARY; const item = catalog.find(icon => icon.id === id); const adapter = window.__studioAdapter; if (!item || !adapter) return; const url = studioIconUrl(item.name, library); adapter.addImage(url, `Icon: ${item.name}`).then((image) => { if (image) { image.msData = { ...(image.msData || {}), iconName: item.name, iconLibrary: library, mediaType: 'svg-icon' }; adapter.saveHistory(); if (typeof showToast === 'function') showToast(`${item.name} icon added`, 'success'); return; } adapter.addText(STUDIO_ICON_SYMBOLS[item.name] || '✦', { fontSize: 110, fontWeight: '900', name: `Icon: ${item.name}`, iconName: item.name, iconLibrary: library }); if (typeof showToast === 'function') showToast('Icon preview unavailable — added emoji fallback', 'info'); }); }
function addStudioGifFromUrl(url) { const value = String(url || document.getElementById('studio-gif-url')?.value || '').trim(); if (!value) return; window.__studioAdapter?.addImage(value, 'Animated GIF').then((image) => { const active = image || window.__studioAdapter.fabricCanvas?.getActiveObject(); if (active) { active.msData = { ...(active.msData || {}), mediaType: 'gif' }; window.__studioAdapter.saveHistory(); } }); }
function studioGifPresetSearch(query) { const input = document.getElementById('studio-gif-search'); if (input) input.value = query; searchStudioGifs(); }
async function searchStudioGifs() {
  const query = String(document.getElementById('studio-gif-search')?.value || '').trim();
  const provider = document.getElementById('studio-gif-provider')?.value || 'giphy';
  const results = document.getElementById('studio-gif-results');
  if (!results || !query) return;
  results.innerHTML = '<div class="col-span-3 p-3 text-center text-xs text-slate-400">Searching animated assets…</div>';
  try {
    const payload = await apiGetJson(`/marketing/studio/gifs/search?provider=${encodeURIComponent(provider)}&q=${encodeURIComponent(query)}`);
    const items = payload.results || [];
    results.innerHTML = items.map(item => `<button type="button" onclick="addStudioGifFromUrl('${String(item.source_url).replace(/'/g, '&#39;')}')" title="${escS(item.title)}" class="studio-gif-result text-left"><img src="${item.preview_url}" alt="" loading="lazy" class="studio-gif-result-image"><span class="studio-gif-result-title">${escS(item.title)}</span></button>`).join('') || '<div class="col-span-3 p-3 text-center text-xs text-slate-500">No GIFs found. Try another search.</div>';
  } catch (error) {
    const message = String(error?.message || '').replace(/^Error:\s*/i, '') || 'GIF search could not load.';
    results.innerHTML = `<div class="col-span-3 studio-gif-status studio-gif-status-error"><strong>${escS(message)}</strong><br><span>Add the provider key to the staging environment, or paste a GIF URL below.</span></div>`;
  }
}
window.searchStudioGifs = searchStudioGifs; window.studioGifPresetSearch = studioGifPresetSearch;
function studioVisualElementPreview(item) {
  const color = item.color || '#4F46E5';
  if (item.kind === 'icon') return `<img src="${studioIconUrl(item.icon, item.library || 'lucide', color)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`;
  if (item.kind === 'shape') {
    if (item.shape === 'ring') return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="23" fill="none" stroke="${color}" stroke-width="7"/></svg>`;
    return `<span style="color:${color}">${STUDIO_SHAPE_PREVIEW[item.shape] || STUDIO_SHAPE_PREVIEW.rect}</span>`;
  }
  if (item.kind === 'frame') {
    const round = item.style === 'circle' ? 50 : item.style === 'round' || item.style === 'arch' ? 24 : 7;
    const footer = item.style === 'polaroid' ? '<rect x="16" y="48" width="32" height="7" rx="2" fill="#e2e8f0"/>' : '';
    const browser = item.style === 'window' ? '<circle cx="20" cy="17" r="2" fill="#f87171"/><circle cx="27" cy="17" r="2" fill="#fbbf24"/><circle cx="34" cy="17" r="2" fill="#34d399"/>' : '';
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="9" width="44" height="46" rx="${round}" fill="#fff" stroke="${color}" stroke-width="3"/>${item.style === 'double' ? `<rect x="16" y="15" width="32" height="34" rx="5" fill="none" stroke="${color}" stroke-width="2"/>` : ''}${footer}${browser}<circle cx="25" cy="29" r="5" fill="#c4b5fd"/><path d="M14 48 29 34l8 7 8-6 9 10" fill="none" stroke="${color}" stroke-width="3"/></svg>`;
  }
  if (item.kind === 'grid') {
    const layouts = { halves:[[8,10,22,44],[34,10,22,44]], stack:[[8,10,48,20],[8,34,48,20]], feature:[[8,10,30,44],[42,10,14,20],[42,34,14,20]], thirds:[[6,10,16,44],[24,10,16,44],[42,10,16,44]], collage:[[8,10,30,26],[42,10,14,26],[8,40,14,14],[26,40,30,14]], mosaic:[[8,10,20,20],[32,10,24,32],[8,34,20,20],[32,46,24,8]], sidebar:[[8,10,14,44],[26,10,30,20],[26,34,30,20]], four:[[8,10,22,20],[34,10,22,20],[8,34,22,20],[34,34,22,20]] };
    return `<svg viewBox="0 0 64 64" aria-hidden="true">${(layouts[item.style] || layouts.four).map(([x,y,w,h], index) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${index % 2 ? '#c7d2fe' : color}"/>`).join('')}</svg>`;
  }
  if (item.kind === 'chart') {
    if (item.style === 'donut' || item.style === 'progress') return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="20" fill="none" stroke="#e2e8f0" stroke-width="10"/><circle cx="32" cy="32" r="20" fill="none" stroke="${color}" stroke-width="10" stroke-dasharray="78 126" transform="rotate(-90 32 32)"/>${item.style === 'progress' ? '<text x="32" y="36" text-anchor="middle" font-size="10" font-weight="800" fill="#334155">62%</text>' : ''}</svg>`;
    if (item.style === 'line') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 52V12M8 52h48" stroke="#cbd5e1" stroke-width="2"/><path d="m10 45 12-13 10 6 12-20 12 7" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="9" y="34" width="9" height="20" rx="3" fill="#c7d2fe"/><rect x="22" y="22" width="9" height="32" rx="3" fill="${color}"/><rect x="35" y="29" width="9" height="25" rx="3" fill="#818cf8"/><rect x="48" y="12" width="9" height="42" rx="3" fill="#4f46e5"/></svg>`;
  }
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="9" width="52" height="46" rx="5" fill="#fff" stroke="${color}" stroke-width="2.5"/><rect x="6" y="9" width="52" height="12" rx="5" fill="${color}"/><path d="M6 32h52M6 43h52M25 21v34M43 21v34" stroke="#cbd5e1" stroke-width="2"/></svg>`;
}
function renderStudioElementCategories() { return Object.entries(STUDIO_VISUAL_ELEMENT_CATEGORIES).filter(([category]) => category !== 'All').map(([category, [icon, background, color]]) => `<button type="button" onclick="setStudioElementCategory('${category}')" aria-current="${(window.__studioElementCategory || 'All') === category}" class="studio-element-category" style="--category-bg:${background};--category-color:${color}"><span><img src="${studioIconUrl(icon, 'lucide', color)}" alt="" loading="lazy" decoding="async" onerror="this.remove()"></span><b>${category}</b></button>`).join(''); }
function setStudioElementCategory(category) { window.__studioElementCategory = category || 'All'; window.__studioCatalogLimits.elements = 24; document.querySelectorAll('.studio-element-category').forEach(button => button.setAttribute('aria-current', String(button.textContent.trim() === category))); filterStudioPremadeElements(false); }
function renderStudioRecentVisualElements() { const ids = window.__studioRecentVisualElements?.length ? window.__studioRecentVisualElements : ['shape-circle','shape-ring','graphic-sparkles','icon-car','frame-round']; return ids.slice(0, 6).map(id => { const item = STUDIO_VISUAL_ELEMENTS.find(element => element.id === id); return item ? `<button type="button" onclick="studioAddVisualElement('${item.id}')" title="${escS(item.name)}" class="studio-element-recent"><span>${studioVisualElementPreview(item)}</span></button>` : ''; }).join(''); }
function renderStudioPremadeElements(query = '', category = window.__studioElementCategory || 'All') { const needle = String(query || '').toLowerCase(); const matches = STUDIO_VISUAL_ELEMENTS.filter(item => (!needle || `${item.name} ${item.category} ${item.style || ''} ${item.icon || ''}`.toLowerCase().includes(needle)) && (category === 'All' || item.category === category)); const limit = Number(window.__studioCatalogLimits.elements || 24); const cards = matches.slice(0, limit).map(item => `<button type="button" onclick="studioAddVisualElement('${item.id}')" class="studio-element-card" title="Add ${escS(item.name)}"><div class="studio-visual-element-preview" style="--element-color:${item.color || '#4F46E5'}">${studioVisualElementPreview(item)}</div><div class="studio-catalog-card-copy"><b>${escS(item.name)}</b><span>${escS(item.category)}</span></div></button>`).join(''); return cards + studioCatalogMore('elements', matches.length - limit) || '<div class="col-span-3 p-4 text-center text-xs text-slate-500">No elements match.</div>'; }
function filterStudioPremadeElements(reset = true) { if (reset) window.__studioCatalogLimits.elements = 24; const el = document.getElementById('studio-premade-library'); if (el) { const category = window.__studioElementCategory || 'All'; el.innerHTML = renderStudioPremadeElements(document.getElementById('studio-premade-query')?.value, category); const heading = document.getElementById('studio-element-result-heading'); if (heading) heading.textContent = category === 'All' ? 'Recommended for you' : category; const recent = document.getElementById('studio-element-recent'); if (recent) recent.innerHTML = renderStudioRecentVisualElements(); setTimeout(() => wireStudioLazyCatalog('elements'), 0); } }
const STUDIO_TEXT_TEMPLATES = [
  ['bold-title','Bold split title','Titles','MAKE YOUR','MOVE TODAY','#f97316','#475569',-5,'wide','Anton','Dancing Script'],
  ['gradient-title','Road ready stack','Titles','THE ROAD','STARTS HERE','#2563eb','#0f766e',3,'tall','Archivo Black','Satisfy'],
  ['outlined-title','Editorial contrast','Titles','BUILT FOR','WHAT IS NEXT','#111827','#f59e0b',-2,'wide','Playfair Display','Montserrat'],
  ['condensed-title','Angled event','Titles','WEEKEND','SALES EVENT','#e11d48','#2563eb',-7,'banner','Bebas Neue','Permanent Marker'],
  ['thank-you','Thank you script','Social','FROM ALL OF US','THANK YOU!','#0284c7','#334155',-4,'script','Satisfy','Montserrat'],
  ['big-news','Big news','Social','WE HAVE','BIG NEWS','#7c3aed','#ec4899',4,'tall','Righteous','Poppins'],
  ['now-hiring','Now hiring','Social','JOIN OUR TEAM','NOW HIRING','#059669','#1e293b',-3,'wide','Archivo Black','Dancing Script'],
  ['save-date','Save the date','Social','SAVE THE','DATE','#db2777','#7c3aed',5,'compact','Playfair Display','Satisfy'],
  ['sale-price','Price spotlight','Offers','TODAY ONLY','SPECIAL PRICE','#047857','#f59e0b',4,'card','Anton','Montserrat'],
  ['monthly-price','Payment message','Offers','PAYMENT OPTIONS','AVAILABLE','#1d4ed8','#0ea5e9',-3,'banner','Bebas Neue','Dancing Script'],
  ['apr-callout','Finance message','Offers','FLEXIBLE','FINANCING','#b45309','#e11d48',5,'card','Oswald','Playfair Display'],
  ['limited-time','Limited event','Offers','LIMITED TIME','WHILE AVAILABLE','#be123c','#f97316',-5,'wide','Archivo Black','Satisfy'],
  ['eyebrow','Editorial label','Labels','FEATURED','INVENTORY','#172033','#2563eb',-3,'compact','Montserrat','Bebas Neue'],
  ['new-arrival','Arrival lockup','Labels','JUST','ARRIVED','#4338ca','#0ea5e9',5,'compact','Anton','Dancing Script'],
  ['certified','Certified lockup','Labels','CERTIFIED','PRE-OWNED','#0f766e','#1d4ed8',-4,'wide','Roboto Condensed','Playfair Display'],
  ['staff-pick','Staff pick','Labels','OUR TEAM LOVES IT','STAFF PICK','#ea580c','#334155',3,'script','Permanent Marker','Montserrat'],
  ['coffee-break','Coffee break','Playful','TAKE A','COFFEE BREAK','#047857','#854d0e',-2,'script','Lobster','Poppins'],
  ['pixel-dreams','Pixel dreams','Playful','CREATE','PIXEL DREAMS','#a855f7','#06b6d4',0,'pixel','Orbitron','Chakra Petch'],
  ['grand-opening','Grand opening','Playful','YOU ARE INVITED','GRAND OPENING','#dc2626','#f59e0b',-4,'tall','Righteous','Dancing Script'],
  ['hello-summer','Hello summer','Playful','HELLO','SUMMER','#f97316','#06b6d4',6,'script','Satisfy','Bebas Neue'],
  ['info-card','Hours block','Information','TODAY\'S HOURS','VIEW DETAILS','#1e293b','#2563eb',-2,'card','Montserrat','Inter'],
  ['phone-card','Contact block','Information','TALK TO OUR TEAM','CALL OR TEXT','#0f172a','#0284c7',3,'wide','Archivo Black','Satisfy'],
  ['location-card','Location block','Information','VISIT THE SHOWROOM','GET DIRECTIONS','#334155','#7c3aed',-3,'wide','Oswald','Montserrat'],
  ['disclaimer','Legal pairing','Information','OFFER DETAILS','TERMS AND CONDITIONS APPLY','#334155','#64748b',0,'legal','Inter','Inter']
].map(([id,name,category,kicker,headline,primary,accent,angle,layout,font,secondaryFont]) => ({ id,name,category,kicker,headline,primary,accent,angle,layout,font,secondaryFont }));
const STUDIO_TEXT_CATEGORIES = ['All','Titles','Social','Offers','Labels','Playful','Information'];
function renderStudioTextCategories() { return STUDIO_TEXT_CATEGORIES.map(category => `<button type="button" onclick="setStudioTextCategory('${category}')" aria-current="${(window.__studioTextCategory || 'All') === category}" class="studio-category-pill">${category}</button>`).join(''); }
function setStudioTextCategory(category) { window.__studioTextCategory = category; window.__studioCatalogLimits.text = 12; document.querySelectorAll('#studio-text-categories button').forEach(button => button.setAttribute('aria-current', String(button.textContent === category))); filterStudioTextTemplates(false); }
function renderStudioTextTemplates(query = '') { const needle = String(query || '').toLowerCase(); const category = window.__studioTextCategory || 'All'; const matches = STUDIO_TEXT_TEMPLATES.filter(item => (!needle || `${item.name} ${item.category} ${item.kicker} ${item.headline}`.toLowerCase().includes(needle)) && (category === 'All' || item.category === category)); const limit = Number(window.__studioCatalogLimits.text || 12); const cards = matches.slice(0, limit).map(item => `<button type="button" onclick="studioAddTextTemplate('${item.id}')" class="studio-text-template-card"><div class="studio-text-template-preview studio-text-layout-${item.layout}" style="--text-primary:${item.primary};--text-accent:${item.accent};--text-angle:${item.angle}deg;--text-font:'${item.font}',sans-serif;--text-secondary-font:'${item.secondaryFont}',sans-serif"><small>${escS(item.kicker)}</small><strong>${escS(item.headline)}</strong></div><div class="studio-catalog-card-copy"><b>${escS(item.name)}</b><span>${escS(item.category)} · grouped text</span></div></button>`).join(''); return cards + studioCatalogMore('text', matches.length - limit) || '<div class="col-span-2 p-4 text-center text-xs text-slate-500">No text styles match.</div>'; }
function filterStudioTextTemplates(reset = true) { if (reset) window.__studioCatalogLimits.text = 12; const el = document.getElementById('studio-text-template-library'); if (el) { el.innerHTML = renderStudioTextTemplates(document.getElementById('studio-text-template-query')?.value || ''); setTimeout(() => wireStudioLazyCatalog('text'), 0); } }
function studioAddTextTemplate(id) {
  const item = STUDIO_TEXT_TEMPLATES.find(template => template.id === id), adapter = window.__studioAdapter, canvas = adapter?.fabricCanvas;
  if (!item || !adapter || !canvas) return;
  const center = canvas.getCenter(), compact = item.layout === 'compact', legal = item.layout === 'legal', tall = item.layout === 'tall', script = item.layout === 'script', pixel = item.layout === 'pixel';
  const width = legal ? 720 : compact ? 380 : tall ? 520 : 640, height = legal ? 94 : tall ? 270 : compact ? 160 : 210, objects = [];
  const left = center.left - width / 2, top = center.top - height / 2;
  const centered = compact || tall || script || pixel;
  adapter.addText(item.kicker, { x: left, y: top + (legal ? 8 : 16), width, fontSize: legal ? 17 : compact ? 20 : 24, fontWeight: '900', fill: item.accent, fontFamily: `'${item.secondaryFont}', sans-serif`, textAlign: centered ? 'center' : 'left', charSpacing: pixel ? 160 : 80, angle: item.angle * -.35, name: `${item.name} kicker`, textTemplateId: item.id });
  const kicker = canvas.getActiveObject(); if (kicker) objects.push(kicker);
  adapter.addText(item.headline, { x: left, y: top + (legal ? 42 : compact ? 48 : 58), width, fontSize: legal ? 20 : compact ? 48 : tall ? 68 : script ? 64 : pixel ? 50 : 58, fontWeight: legal ? '700' : '900', fill: item.primary, fontFamily: `'${item.font}', sans-serif`, textAlign: centered ? 'center' : 'left', charSpacing: pixel ? 85 : 0, lineHeight: .86, angle: item.angle, name: `${item.name} headline`, textTemplateId: item.id });
  const headline = canvas.getActiveObject();
  if (headline) {
    headline.set({ shadow: new window.fabric.Shadow({ color: 'rgba(15,23,42,.18)', blur: 2, offsetX: 2, offsetY: 3 }) });
    objects.push(headline);
  }
  if (objects.length > 1) { canvas.discardActiveObject(); canvas.setActiveObject(new window.fabric.ActiveSelection(objects, { canvas })); adapter.groupSelected(); }
  if (typeof showToast === 'function') showToast(`${item.name} added — ungroup to edit both text layers`, 'success');
}
window.studioAddTextTemplate = studioAddTextTemplate;

function rememberStudioVisualElement(id) {
  window.__studioRecentVisualElements = [id, ...(window.__studioRecentVisualElements || []).filter(item => item !== id)].slice(0, 6);
}

function studioAddVisualElement(id) {
  const item = STUDIO_VISUAL_ELEMENTS.find(element => element.id === id), adapter = window.__studioAdapter, canvas = adapter?.fabricCanvas;
  if (typeof studioDebugPush === 'function') studioDebugPush(`addElement(${id}) item=${!!item} adapter=${!!adapter} canvas=${!!canvas}`);
  if (!item) { if (typeof showToast === 'function') showToast('That element is no longer in the library.', 'error'); return; }
  // Every previous "elements don't show up" report reached this early
  // return with no visible feedback. Surface the state so the visitor
  // knows to open a design first (from the Home screen) rather than
  // clicking elements against a phantom canvas.
  if (!adapter || !canvas) {
    if (typeof showToast === 'function') showToast('Open or create a design first — then add elements to it.', 'error');
    return;
  }
  rememberStudioVisualElement(id);
  if (item.kind === 'icon') {
    adapter.addImage(studioIconUrl(item.icon, item.library || 'lucide', item.color || '#2563EB'), item.name).then(image => {
      if (image) {
        image.msData = { ...(image.msData || {}), name: item.name, visualElementId: item.id, mediaType: 'svg-icon', iconLibrary:item.library || 'lucide' };
        if (item.animation && typeof adapter.setSelectedAnimation === 'function') adapter.setSelectedAnimation(item.animation);
        adapter.saveHistory();
        if (typeof showToast === 'function') showToast(`${item.name} added`, 'success');
      } else {
        // addImage returns null when the iconify CDN fails or the
        // resulting SVG couldn't be decoded — the historical silent
        // failure the user reported. Fall back to a coloured shape
        // so the tap still puts *something* on the canvas.
        if (typeof showToast === 'function') showToast(`${item.name} icon couldn't load — using a solid shape instead.`, 'info');
        adapter.addShape('rect', item.color || '#2563EB');
        const fallback = canvas.getActiveObject();
        if (fallback) {
          fallback.set({ width: 200, height: 200, rx: 20, ry: 20 });
          fallback.msData = { ...(fallback.msData || {}), name: item.name, visualElementId: item.id, mediaType: 'svg-icon-fallback' };
          fallback.setCoords(); canvas.requestRenderAll(); adapter.saveHistory();
        }
      }
      filterStudioPremadeElements(false);
    }).catch(e => {
      if (typeof showToast === 'function') showToast(`${item.name} failed: ${e && e.message || 'unknown'}`, 'error');
    });
    return;
  }
  if (item.kind === 'shape') {
    const shapeType = item.shape === 'ring' || item.shape === 'rounded' ? (item.shape === 'ring' ? 'circle' : 'rect') : item.shape;
    adapter.addShape(shapeType, item.color);
    const shape = canvas.getActiveObject();
    if (shape) {
      if (item.shape === 'ring') shape.set({ fill: 'rgba(255,255,255,0)', stroke: item.color, strokeWidth: 18 });
      if (item.shape === 'rounded') shape.set({ rx: 54, ry: 54 });
      shape.msData = { ...(shape.msData || {}), name: item.name, visualElementId: item.id };
      shape.setCoords(); canvas.requestRenderAll(); adapter.saveHistory();
    }
    filterStudioPremadeElements(false);
    return;
  }

  const center = canvas.getCenter(), left = center.left - 250, top = center.top - 180, objects = [];
  const addRect = (x, y, width, height, fill, options = {}) => {
    adapter.addShape(options.circle ? 'circle' : 'rect', fill);
    const object = canvas.getActiveObject();
    if (!object) return;
    object.set({ left:left+x, top:top+y, width, height, ...(options.circle ? { radius: Math.min(width, height) / 2 } : { rx:options.radius || 14, ry:options.radius || 14 }), fill, stroke:options.stroke || null, strokeWidth:options.stroke ? (options.strokeWidth || 5) : 0, angle:options.angle || 0 });
    object.msData = { ...(object.msData || {}), name: options.name || item.name, visualElementId: item.id };
    object.setCoords(); objects.push(object);
  };
  const accent = item.color || '#4F46E5';

  if (item.kind === 'frame') {
    const circle = item.style === 'circle';
    addRect(55, 25, 390, 310, 'rgba(255,255,255,0.01)', { circle, radius:item.style === 'round' || item.style === 'arch' ? 70 : 18, stroke:accent, strokeWidth:12, name:`${item.name} border` });
    if (item.style === 'double') addRect(82, 52, 336, 256, 'rgba(255,255,255,0.01)', { radius:12, stroke:accent, strokeWidth:5, name:'Inner border' });
    if (item.style === 'polaroid') addRect(85, 285, 330, 42, '#F8FAFC', { radius:4, name:'Caption area' });
    if (item.style === 'window') { addRect(55, 25, 390, 48, accent, { radius:18, name:'Browser top bar' }); ['#F87171','#FBBF24','#34D399'].forEach((color,index) => addRect(78+index*30,40,16,16,color,{circle:true,name:'Window control'})); }
    if (item.style === 'phone') addRect(205, 39, 90, 12, accent, { radius:6, name:'Phone speaker' });
  } else if (item.kind === 'grid') {
    const layouts = { halves:[[20,35,220,290],[260,35,220,290]], stack:[[20,25,460,145],[20,190,460,145]], feature:[[20,25,290,310],[330,25,150,145],[330,190,150,145]], thirds:[[15,25,150,310],[175,25,150,310],[335,25,150,310]], collage:[[20,25,285,185],[325,25,155,185],[20,230,155,105],[195,230,285,105]], mosaic:[[20,25,190,135],[230,25,250,205],[20,180,190,155],[230,250,250,85]], sidebar:[[20,25,130,310],[170,25,310,145],[170,190,310,145]], four:[[20,25,220,145],[260,25,220,145],[20,190,220,145],[260,190,220,145]] };
    (layouts[item.style] || layouts.four).forEach(([x,y,w,h], index) => addRect(x,y,w,h,index % 2 ? '#C7D2FE' : accent,{radius:18,name:`Grid cell ${index + 1}`}));
  } else if (item.kind === 'chart') {
    if (item.style === 'donut' || item.style === 'progress') { addRect(105,35,290,290,'rgba(255,255,255,0.01)',{circle:true,stroke:'#E2E8F0',strokeWidth:42,name:'Chart track'}); addRect(105,35,290,290,'rgba(255,255,255,0.01)',{circle:true,stroke:accent,strokeWidth:20,name:'Chart value'}); }
    else { [150,245,195,300].forEach((height,index) => addRect(35+index*115,335-height,80,height,index % 2 ? accent : '#A5B4FC',{radius:15,name:`Chart series ${index + 1}`})); }
  } else {
    addRect(20,25,460,310,'#FFFFFF',{radius:18,stroke:'#CBD5E1',strokeWidth:5,name:'Table frame'});
    addRect(20,25,460,62,accent,{radius:18,name:'Table header'});
    [145,205,265].forEach((y,index) => addRect(20,y,460,4,'#CBD5E1',{radius:0,name:`Row divider ${index + 1}`}));
    [175,330].forEach((x,index) => addRect(x,87,4,248,'#E2E8F0',{radius:0,name:`Column divider ${index + 1}`}));
  }
  if (objects.length > 1) { canvas.discardActiveObject(); canvas.setActiveObject(new window.fabric.ActiveSelection(objects, { canvas })); adapter.groupSelected(); }
  else if (objects[0]) canvas.setActiveObject(objects[0]);
  canvas.requestRenderAll(); adapter.saveHistory(); filterStudioPremadeElements(false);
  if (typeof showToast === 'function') showToast(`${item.name} added`, 'success');
}
window.studioAddVisualElement = studioAddVisualElement;

function studioElementLayout(item) {
  const layouts = {
    badge: { shape:'circle', width:210, height:210, fill:'#1D4ED8', radius:105, iconX:75, iconY:30, iconW:60, iconSize:38, titleX:22, titleY:92, titleW:166, titleSize:23, subX:28, subY:128, subW:154, subSize:13, align:'center' },
    ribbon: { shape:'badge', width:630, height:112, fill:'#E11D48', radius:16, angle:-5, iconX:24, iconY:27, iconW:54, iconSize:38, titleX:92, titleY:22, titleW:500, titleSize:32, subX:94, subY:65, subW:480, subSize:14 },
    button: { shape:'badge', width:520, height:108, fill:'#2563EB', radius:54, iconX:438, iconY:25, iconW:48, iconSize:34, titleX:34, titleY:20, titleW:390, titleSize:27, subX:35, subY:59, subW:360, subSize:14 },
    trust: { shape:'rect', width:500, height:148, fill:'#ECFDF5', stroke:'#6EE7B7', radius:24, iconX:26, iconY:37, iconW:64, iconSize:46, iconFill:'#059669', titleX:106, titleY:25, titleW:360, titleSize:25, titleFill:'#064E3B', subX:107, subY:69, subW:340, subSize:15, subFill:'#047857' },
    callout: { shape:'rect', width:650, height:230, fill:'#172554', radius:32, iconX:42, iconY:65, iconW:90, iconSize:68, titleX:150, titleY:48, titleW:450, titleSize:34, subX:152, subY:108, subW:420, subSize:18 },
    card: { shape:'rect', width:560, height:255, fill:'#0F172A', radius:28, iconX:36, iconY:35, iconW:70, iconSize:50, titleX:36, titleY:116, titleW:488, titleSize:31, subX:38, subY:169, subW:460, subSize:17 },
    header: { shape:'rect', width:720, height:156, fill:'#312E81', radius:12, iconX:34, iconY:43, iconW:70, iconSize:52, titleX:124, titleY:27, titleW:550, titleSize:38, subX:126, subY:85, subW:520, subSize:17 },
    legal: { shape:'rect', width:760, height:106, fill:'#F8FAFC', stroke:'#CBD5E1', radius:12, iconX:18, iconY:27, iconW:44, iconSize:26, iconFill:'#475569', titleX:74, titleY:17, titleW:650, titleSize:18, titleFill:'#334155', subX:75, subY:52, subW:640, subSize:14, subFill:'#64748B' },
    social: { shape:'circle', width:220, height:220, fill:'#111827', radius:110, iconX:65, iconY:30, iconW:90, iconSize:68, titleX:25, titleY:105, titleW:170, titleSize:19, subX:31, subY:143, subW:158, subSize:12, align:'center' },
    rating: { shape:'badge', width:540, height:138, fill:'#FFFBEB', stroke:'#F59E0B', radius:24, iconX:25, iconY:24, iconW:180, iconSize:25, iconFill:'#F59E0B', titleX:214, titleY:20, titleW:290, titleSize:27, titleFill:'#78350F', subX:216, subY:64, subW:270, subSize:14, subFill:'#92400E' },
    date: { shape:'rect', width:310, height:310, fill:'#7C3AED', radius:42, iconX:105, iconY:35, iconW:100, iconSize:64, titleX:30, titleY:132, titleW:250, titleSize:30, subX:35, subY:190, subW:240, subSize:16, align:'center' },
    quote: { shape:'rect', width:650, height:250, fill:'#FFF7ED', stroke:'#FDBA74', radius:38, iconX:32, iconY:20, iconW:70, iconSize:72, iconFill:'#F97316', titleX:102, titleY:55, titleW:500, titleSize:32, titleFill:'#7C2D12', subX:106, subY:126, subW:470, subSize:17, subFill:'#9A3412' },
    stat: { shape:'circle', width:320, height:320, fill:'#0E7490', radius:160, iconX:115, iconY:35, iconW:90, iconSize:58, titleX:38, titleY:126, titleW:244, titleSize:36, subX:48, subY:191, subW:224, subSize:16, align:'center' },
    arrow: { shape:'arrow', width:610, height:150, fill:'#EA580C', iconX:450, iconY:41, iconW:90, iconSize:56, titleX:38, titleY:28, titleW:390, titleSize:34, subX:40, subY:83, subW:350, subSize:15 },
  };
  return layouts[item.kind] || layouts.card;
}
function studioAddPremade(id) {
  const item = STUDIO_PREMADE_ELEMENTS.find(element => element.id === id), adapter = window.__studioAdapter, canvas = adapter?.fabricCanvas;
  if (!item || !adapter || !canvas) return;
  const center = canvas.getCenter(), layout = studioElementLayout(item), left = center.left - layout.width / 2, top = center.top - layout.height / 2, angle = layout.angle || 0, objects = [];
  adapter.addShape(layout.shape, layout.fill);
  const shape = canvas.getActiveObject();
  if (shape) { shape.set({ left, top, width:layout.width, height:layout.height, rx:layout.radius || 0, ry:layout.radius || 0, angle, fill:layout.fill, stroke:layout.stroke || null, strokeWidth:layout.stroke ? 3 : 0 }); shape.msData={...(shape.msData||{}),name:`${item.name} background`,premadeId:item.id}; objects.push(shape); }
  const addPart = (text, role, x, y, width, fontSize, fill, weight='900') => { adapter.addText(text,{x:left+x,y:top+y,width,fontSize,fontWeight:weight,fill,angle,textAlign:layout.align||'left',name:`${item.name} ${role}`,premadeId:item.id}); const object=canvas.getActiveObject(); if(object) objects.push(object); };
  addPart(item.icon, 'icon', layout.iconX, layout.iconY, layout.iconW, layout.iconSize, layout.iconFill || '#FFFFFF');
  addPart(item.text, 'title', layout.titleX, layout.titleY, layout.titleW, layout.titleSize, layout.titleFill || '#FFFFFF');
  addPart(item.subtext, 'supporting text', layout.subX, layout.subY, layout.subW, layout.subSize, layout.subFill || '#BFDBFE', '600');
  if(objects.length>1){canvas.discardActiveObject();canvas.setActiveObject(new window.fabric.ActiveSelection(objects,{canvas}));adapter.groupSelected();}
  if(typeof showToast==='function') showToast(`${item.name} added — ungroup to edit all layers`,'success');
}
window.filterStudioShapes = filterStudioShapes; window.filterStudioStickers = filterStudioStickers; window.filterStudioFonts = filterStudioFonts; window.filterStudioIcons = filterStudioIcons; window.studioAddIcon = studioAddIcon; window.addStudioGifFromUrl = addStudioGifFromUrl; window.filterStudioPremadeElements = filterStudioPremadeElements; window.studioAddPremade = studioAddPremade; window.filterStudioTextTemplates = filterStudioTextTemplates; window.setStudioIconCategory = setStudioIconCategory; window.setStudioElementCategory = setStudioElementCategory; window.setStudioTextCategory = setStudioTextCategory;

function escS(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function zoomStudioIn() {
  window.__studioZoomLevel = Math.min(2.5, (window.__studioZoomLevel || 0.55) + 0.15);
  applyStudioZoom();
}

function zoomStudioOut() {
  window.__studioZoomLevel = Math.max(0.2, (window.__studioZoomLevel || 0.55) - 0.15);
  applyStudioZoom();
}

function zoomStudioFit() {
  const mainEl = document.getElementById('studio-canvas-viewport');
  if (!mainEl) return;
  const availW = Math.max(120, mainEl.clientWidth - 32);
  const availH = Math.max(120, mainEl.clientHeight - 32);
  const adapter = window.__studioAdapter;
  const activePage = adapter?.currentScene?.pages?.find(page => page.id === adapter.activePageId);
  const canvasW = activePage?.width || adapter?.currentScene?.width || 1080;
  const canvasH = activePage?.height || adapter?.currentScene?.height || 1080;
  const scaleW = availW / canvasW;
  const scaleH = availH / canvasH;
  window.__studioZoomLevel = Math.max(0.08, Math.min(1.25, Math.min(scaleW, scaleH)));
  applyStudioZoom();
}

function applyStudioZoom() {
  const container = document.getElementById('studio-artboard-container');
  const display = document.getElementById('studio-zoom-display');
  if (container) {
    container.style.transform = `translate(-50%, -50%) scale(${window.__studioZoomLevel || 0.55})`;
  }
  if (display) {
    display.textContent = `${Math.round((window.__studioZoomLevel || 0.55) * 100)}%`;
  }
}

window.openMarketSyncStudio = async function(designId = null, initialOptions = {}) {
  // JS-level chrome hide (cache-proof — never fights an old stylesheet):
  // the Demo mode badge (#demo-mode-badge, appended to body by
  // demo-control-panel.js) and any legacy #ms-mode-switch pill both
  // sit on top of the studio modal and were reported overlapping the
  // design-name input. Force-hide on open, restore on close via
  // closeMarketSyncStudio (see below).
  const badge = document.getElementById('demo-mode-badge');
  if (badge && !badge.dataset.msStudioHidden) {
    badge.dataset.msStudioHidden = '1';
    badge.style.display = 'none';
  }
  const legacyMs = document.getElementById('ms-mode-switch');
  if (legacyMs && !legacyMs.dataset.msStudioHidden) {
    legacyMs.dataset.msStudioHidden = '1';
    legacyMs.style.display = 'none';
  }
  window.__studioCurrentDesign = null;
  window.__studioAppliedTemplateKey = null;
  window.__studioAppliedTemplateId = null;
  window.__studioWorkspaceTab = DESIGN_STUDIO_TABS.some(([id]) => id === initialOptions.tab) ? initialOptions.tab : 'create';
  const initialTool = DESIGN_STUDIO_TABS.find(([id]) => id === window.__studioWorkspaceTab)?.[2];
  if (initialTool) window.__studioActiveTool = initialTool;
  await loadStudioTemplateCatalog().catch(() => null);
  let modal = document.getElementById('ms-studio-master-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ms-studio-master-modal';
    modal.className = 'fixed inset-0 z-[99999] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col overflow-hidden font-sans';
    document.body.appendChild(modal);
  }

  // A blank launch now opens the creative home. Existing projects and explicit
  // size/template launches still go directly to the editor.
  if (!designId && !initialOptions.bypassHome && !initialOptions.formatKey && !initialOptions.templateKey) {
    window.__studioAdapter = null;
    await renderStudioHome(modal);
    return;
  }

  // Load existing design or default blank scene
  let scene = initialOptions.formatKey === 'custom'
    ? { version: 3, format_key: 'custom', width: Number(initialOptions.customWidth) || 1080, height: Number(initialOptions.customHeight) || 1080, background: { color: '#0F172A' }, elements: [] }
    : window.msCreateDefaultScene(initialOptions.formatKey || 'square');
  let designName = 'Untitled Design';

  if (designId) {
    try {
      const res = await apiGetJson(`/marketing/studio/designs/${designId}`).catch(() => null);
      if (res?.design) {
        window.__studioCurrentDesign = res.design;
        window.__studioAppliedTemplateKey = res.design.scene?.metadata?.source_template_key || null;
        window.__studioAppliedTemplateId = res.design.template_id || null;
        scene = window.msStudioDocumentToScene ? window.msStudioDocumentToScene(res.design.scene || scene) : (res.design.scene || scene);
        designName = res.design.name || designName;
      }
    } catch (e) { /* fallback */ }
  }

  window.__studioInitialScene = scene;
  window.__studioTemplateFormat = scene.format_key || initialOptions.formatKey || 'square';
  window.__studioTemplateCategory = 'all';
  modal.innerHTML = renderStudioWorkspaceHtml(designName, scene);
  window.__studioDocument = window.msStudioSceneToDocument ? window.msStudioSceneToDocument(scene, { title: designName }) : scene;
  if (window.__msStudioStore) {
    window.__msStudioStore.hydrate(window.msStudioSceneToDocument ? window.msStudioSceneToDocument(scene, { title: designName }) : scene, window.__studioCurrentDesign?.id || designId);
    window.__msStudioStore.subscribe(studioRenderSaveState);
  }
  // MUST await — the previous fire-and-forget path meant a template
  // click could reach loadStudioTemplate before the fabric canvas was
  // ready. renderScene then silently no-oped and the visitor saw a
  // "Loaded X" toast against an empty canvas.
  await initStudioAdapter(scene);
  window.__studioFitObserver?.disconnect();
  const viewport = document.getElementById('studio-canvas-viewport');
  if (viewport && window.ResizeObserver) {
    window.__studioFitObserver = new ResizeObserver(() => requestAnimationFrame(zoomStudioFit));
    window.__studioFitObserver.observe(viewport);
  }
  setTimeout(zoomStudioFit, 100);
  if (!window.__studioKeydownBound) {
    window.__studioKeydownBound = true;
    document.addEventListener('keydown', studioKeydownHandler);
  }
  // JS-level chrome cleanup for mobile. Cache-proof: forces the fixes
  // whether or not the CSS or the newer JS classes have deployed yet.
  // Runs once per open; harmless on desktop (the query selectors
  // check viewport width).
  studioApplyMobileChrome();
  studioMountDebugPanel();
  studioDebugPush('studio opened · adapter=' + (!!window.__studioAdapter) + ' · fabric=' + (!!window.fabric));
  if (initialOptions.templateKey) await loadStudioTemplate(initialOptions.templateKey);
};

// In-app diagnostics: a floating "i" button on mobile that expands
// to show the studio's real internal state. Cache-proof way to
// diagnose "elements/templates don't add" reports without needing
// browser dev tools.
window.__studioDebugLog = [];
function studioDebugPush(entry) {
  const now = new Date().toISOString().slice(11, 23);
  window.__studioDebugLog.unshift(`${now}  ${entry}`);
  window.__studioDebugLog = window.__studioDebugLog.slice(0, 30);
  const body = document.getElementById('studio-diag-body');
  if (body && body.parentElement && !body.parentElement.hidden) studioDebugRefresh();
}
window.studioDebugPush = studioDebugPush;

function studioDebugRefresh() {
  const body = document.getElementById('studio-diag-body');
  if (!body) return;
  const adapter = window.__studioAdapter;
  const canvas = adapter && adapter.fabricCanvas;
  const state = [
    ['fabric.js', typeof window.fabric === 'function' || (window.fabric && window.fabric.Canvas) ? 'LOADED ✓' : 'not loaded ✗'],
    ['adapter', adapter ? 'ready ✓' : 'null ✗'],
    ['canvas', canvas ? `${canvas.getObjects().length} objects` : 'not mounted ✗'],
    ['canvas el', document.getElementById('studio-main-canvas') ? 'in DOM ✓' : 'missing ✗'],
    ['active page', adapter?.activePageId || 'none'],
    ['zoom', canvas ? `${Math.round((canvas.getZoom() || 1) * 100)}%` : '—'],
    ['viewport', `${window.innerWidth}x${window.innerHeight}`],
  ];
  body.innerHTML = ''
    + '<div style="padding:.5rem 0;border-bottom:1px solid rgba(255,255,255,.1);margin-bottom:.5rem;">'
    + state.map(([k, v]) => `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0"><span style="color:#94a3b8">${k}</span><b style="color:#e2e8f0">${v}</b></div>`).join('')
    + '</div>'
    + '<div style="font-size:10px;color:#94a3b8;margin-bottom:.25rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase">Recent events</div>'
    + '<div style="font-size:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.4;max-height:35vh;overflow-y:auto;color:#cbd5e1">'
    + (window.__studioDebugLog.length ? window.__studioDebugLog.map(l => `<div>${l.replace(/</g,'&lt;')}</div>`).join('') : '<i>No events logged yet — tap Elements or Templates to reproduce.</i>')
    + '</div>';
}

function studioMountDebugPanel() {
  const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  if (!isMobile) return;
  if (document.getElementById('studio-diag-fab')) return;
  const fab = document.createElement('button');
  fab.id = 'studio-diag-fab';
  fab.type = 'button';
  fab.textContent = 'ⓘ';
  fab.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:100000;width:36px;height:36px;border-radius:999px;border:0;background:rgba(15,23,42,.85);color:#fff;font-size:18px;font-weight:900;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.25)';
  const panel = document.createElement('div');
  panel.id = 'studio-diag-panel';
  panel.hidden = true;
  panel.style.cssText = 'position:fixed;bottom:60px;left:12px;right:12px;z-index:100000;background:#0f172a;color:#fff;border-radius:12px;padding:.75rem 1rem;box-shadow:0 12px 32px rgba(0,0,0,.35);max-height:60vh;overflow-y:auto';
  panel.innerHTML = ''
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;">'
    + '<b style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#e2e8f0">Studio diagnostics</b>'
    + '<button type="button" id="studio-diag-close" style="background:none;border:0;color:#94a3b8;font-size:18px;cursor:pointer;line-height:1">×</button>'
    + '</div>'
    // Raw Canvas Mode + Dump — DIAGNOSTIC ONLY, per the render-layer plan.
    // Buttons are real DOM elements wired with addEventListener (not inline
    // onclick strings) so nothing — a strict CSP, a stale onclick handler,
    // or a parent stopPropagation — can neuter the click.
    + '<div id="studio-diag-controls" style="display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem"></div>'
    + '<div id="studio-diag-body"></div>';
  const controls = panel.querySelector('#studio-diag-controls');
  const closeBtn = panel.querySelector('#studio-diag-close');
  if (closeBtn) closeBtn.addEventListener('click', () => { panel.hidden = true; });
  // Raw canvas toggle — button state mirrors window.__studioRawCanvasMode.
  const rawBtn = document.createElement('button');
  rawBtn.type = 'button';
  rawBtn.id = 'studio-diag-raw-toggle';
  rawBtn.style.cssText = 'background:#1e293b;border:1px solid #334155;color:#e2e8f0;font-size:11px;font-weight:900;padding:.35rem .6rem;border-radius:6px;cursor:pointer;pointer-events:auto;touch-action:manipulation';
  rawBtn.textContent = window.__studioRawCanvasMode ? 'Raw canvas mode: ON' : 'Raw canvas mode: OFF';
  rawBtn.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); studioToggleRawCanvasMode(); });
  controls.appendChild(rawBtn);
  const dumpBtn = document.createElement('button');
  dumpBtn.type = 'button';
  dumpBtn.id = 'studio-diag-dump';
  dumpBtn.style.cssText = rawBtn.style.cssText;
  dumpBtn.textContent = 'Dump render state';
  dumpBtn.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); studioDumpRenderState(); });
  controls.appendChild(dumpBtn);
  fab.onclick = () => { panel.hidden = !panel.hidden; if (!panel.hidden) studioDebugRefresh(); };
  document.body.appendChild(fab);
  document.body.appendChild(panel);
  studioDebugPush('diag panel mounted');
}
window.studioMountDebugPanel = studioMountDebugPanel;

// ── Raw Canvas Mode ──────────────────────────────────────────────────────────
// DIAGNOSTIC ONLY. Does not touch template loading, object creation, z-order
// or scene JSON. Purely toggles the presentation layer so we can isolate
// whether the blank canvas comes from (A) responsive fit/scale, (B) Fabric
// DOM layering, or (C) a covering object in the stack.
//
// ON  — disables outer stage scaling, mobile artboard fit, viewport
//       transforms; sets Fabric viewportTransform to identity; renders the
//       artboard at true logical size inside a scrollable container.
// OFF — restores every saved style so the normal fit/zoom behavior resumes.
//       Does not reload the template, recreate the document, or touch
//       unsaved changes.
function studioToggleRawCanvasMode() {
  const on = !window.__studioRawCanvasMode;
  window.__studioRawCanvasMode = on;
  const container = document.getElementById('studio-artboard-container');
  const viewport = document.getElementById('studio-canvas-viewport');
  const fc = window.__studioAdapter?.fabricCanvas;
  if (on) {
    // Freeze the ResizeObserver so it can't re-fit us mid-inspection.
    if (window.__studioFitObserver?.disconnect) {
      try { window.__studioFitObserver.disconnect(); } catch (_) {}
    }
    if (container && !container.__msRawSaved) {
      container.__msRawSaved = {
        transform: container.style.transform, left: container.style.left,
        top: container.style.top, width: container.style.width,
        height: container.style.height, position: container.style.position,
      };
      // True logical size, no outer stage transform, static positioning so
      // the scrollable parent can pan freely.
      container.style.position = 'static';
      container.style.left = '0';
      container.style.top = '0';
      container.style.transform = 'none';
      container.style.width = (fc?.getWidth?.() || 1080) + 'px';
      container.style.height = (fc?.getHeight?.() || 1920) + 'px';
    }
    if (viewport && !viewport.__msRawSaved) {
      viewport.__msRawSaved = { overflow: viewport.style.overflow };
      viewport.style.overflow = 'auto';
    }
    if (fc) {
      try {
        fc.setViewportTransform([1, 0, 0, 1, 0, 0]);
        fc.calcOffset();
        fc.requestRenderAll();
      } catch (_) {}
    }
  } else {
    if (container?.__msRawSaved) {
      Object.assign(container.style, container.__msRawSaved);
      delete container.__msRawSaved;
    }
    if (viewport?.__msRawSaved) {
      viewport.style.overflow = viewport.__msRawSaved.overflow || '';
      delete viewport.__msRawSaved;
    }
    // Rebuild the fit observer + rerun the normal fit path. Template state
    // is untouched — no re-render, no scene reload.
    if (typeof zoomStudioFit === 'function') zoomStudioFit();
    if (fc) {
      try { fc.calcOffset(); fc.requestRenderAll(); } catch (_) {}
    }
  }
  const btn = document.getElementById('studio-diag-raw-toggle');
  if (btn) btn.textContent = on ? 'Raw canvas mode: ON' : 'Raw canvas mode: OFF';
  studioDebugPush(`rawCanvasMode=${on}`);
}
window.studioToggleRawCanvasMode = studioToggleRawCanvasMode;

// Full render-state dump — every field the 8-point spec asks for. Writes
// to the diagnostics feed so a phone screenshot captures the whole picture
// in one turn. Never modifies the scene.
function studioDumpRenderState() {
  const fc = window.__studioAdapter?.fabricCanvas;
  if (!fc) { studioDebugPush('dump: no fabric canvas'); return; }
  const w = fc.getWidth?.() || 0, h = fc.getHeight?.() || 0;
  const vt = (fc.viewportTransform || []).map(n => +Number(n).toFixed(3)).join(',');
  const zoom = typeof fc.getZoom === 'function' ? fc.getZoom() : '?';
  studioDebugPush(`vt=[${vt}] zoom=${zoom} size=${w}x${h} bg=${fc.backgroundColor || '-'}`);
  // Fabric DOM chain: canvas-container / lower / upper — position, size,
  // computed transform, z-index, opacity, visibility.
  const dom = (sel) => {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) { studioDebugPush(`${sel}: MISSING`); return; }
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    studioDebugPush(`${sel} ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)} disp=${s.display} vis=${s.visibility} op=${s.opacity} z=${s.zIndex} tf=${s.transform.slice(0, 24)}`);
  };
  dom('#studio-artboard-container');
  dom('.canvas-container');
  dom('.lower-canvas');
  dom('.upper-canvas');
  // Object stack — full list with bounds and z-order (top of stack last).
  const objs = fc.getObjects() || [];
  studioDebugPush(`objects: ${objs.length} (bottom → top)`);
  objs.forEach((o, i) => {
    const bw = Math.round((o.width || 0) * (o.scaleX || 1));
    const bh = Math.round((o.height || 0) * (o.scaleY || 1));
    const src = typeof o.getSrc === 'function' ? (o.getSrc() || '').slice(-32) : '';
    const fill = (o.fill || '').toString().slice(0, 14);
    studioDebugPush(`obj[${i}] ${o.type} L=${Math.round(o.left)} T=${Math.round(o.top)} W=${bw} H=${bh} sc=${(o.scaleX || 1).toFixed(2)}x${(o.scaleY || 1).toFixed(2)} vis=${o.visible !== false} op=${o.opacity ?? 1} fill=${fill}${src ? ' src=' + src : ''}`);
  });
  // Covering-object detector (Phase 3 in the render-layer plan). Never
  // mutates the scene — reports only.
  const covering = objs.filter(o => o.visible !== false && (o.opacity ?? 1) > 0
    && (o.left || 0) <= 0 && (o.top || 0) <= 0
    && ((o.width || 0) * (o.scaleX || 1)) >= w
    && ((o.height || 0) * (o.scaleY || 1)) >= h);
  if (covering.length) {
    const c = covering[covering.length - 1];
    studioDebugPush(`COVER obj[${objs.indexOf(c)}] ${c.type} fill=${(c.fill || '?').toString().slice(0, 14)} — spans full canvas`);
  }
}
window.studioDumpRenderState = studioDumpRenderState;

function studioApplyMobileChrome() {
  const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  if (!isMobile) return;
  const modal = document.getElementById('ms-studio-master-modal');
  if (!modal) return;

  // 1. Hide desktop-only buttons — breakpoint switcher, "Desktop"
  //    text buttons, and the studio-breakpoint-group wrapper.
  modal.querySelectorAll('[title*="breakpoint"], .studio-breakpoint-group, [data-studio-breakpoint], [data-studio-viewport]')
    .forEach(el => (el.style.display = 'none'));
  modal.querySelectorAll('button').forEach(btn => {
    const t = (btn.textContent || '').trim();
    if (t === 'Desktop' || t === 'Tablet' || t === 'Mobile' || /^Desk/i.test(t) || /^Tab/i.test(t)) btn.style.display = 'none';
  });

  // 1b. Hide the floating selection action pill (duplicate/trash bubble)
  //     — it drifts off-canvas on phones.
  modal.querySelectorAll('.studio-canvas-floating-actions, .studio-selection-floating, [data-studio-selection-actions]')
    .forEach(el => (el.style.display = 'none'));

  // 2. Hide History/Review/AI Design/Export/Publish/Schedule desktop
  //    actions by their onclick signatures (class-based hide can be
  //    fought by a cached stylesheet).
  const desktopSignatures = [
    'openStudioRevisionHistory',
    'openStudioCollaboration',
    'openStudioAiDesign',
    'openStudioExport',
    'publishStudioDesign',
    'openStudioSchedulerWithEntitlementCheck',
  ];
  modal.querySelectorAll('.studio-primary-actions button').forEach(btn => {
    const onclick = btn.getAttribute('onclick') || '';
    if (desktopSignatures.some(sig => onclick.includes(sig))) btn.style.display = 'none';
  });

  // 3. Hide brand logo + STUDIO badge + "Back to Marketing" long text
  //    so the header fits on 390px.
  ['.studio-brand-logo', '.studio-brand-divider', '.studio-title-badge', '.studio-back-long']
    .forEach(sel => modal.querySelectorAll(sel).forEach(el => (el.style.display = 'none')));
  modal.querySelectorAll('.studio-back-short').forEach(el => (el.style.display = 'inline'));

  // 4. Move the inspector panel from a right sidebar to a bottom sheet.
  //    Explicit inline styles beat any stylesheet cache.
  const inspector = document.getElementById('studio-inspector-panel');
  if (inspector) {
    inspector.style.position = 'fixed';
    inspector.style.left = '0';
    inspector.style.right = '0';
    inspector.style.bottom = '0';
    inspector.style.top = 'auto';
    inspector.style.width = '100%';
    inspector.style.maxWidth = '100%';
    inspector.style.height = 'auto';
    inspector.style.maxHeight = '45vh';
    inspector.style.borderLeft = '0';
    inspector.style.borderTop = '1px solid #e2e8f0';
    inspector.style.boxShadow = '0 -8px 24px rgba(15,23,42,.12)';
    inspector.style.zIndex = '20';
    inspector.style.overflowY = 'auto';
    inspector.style.webkitOverflowScrolling = 'touch';
    // Initially collapsed until something is selected.
    if (!inspector.querySelector('.studio-inspector-heading')) {
      inspector.style.transform = 'translateY(100%)';
    }
  }

  // 5. Force the design-name input to ellipsis so UNSAVED stays visible.
  const nameInput = document.getElementById('studio-design-name');
  if (nameInput) {
    nameInput.style.maxWidth = '40vw';
    nameInput.style.minWidth = '0';
    nameInput.style.textOverflow = 'ellipsis';
    nameInput.style.overflow = 'hidden';
    nameInput.style.whiteSpace = 'nowrap';
  }

  // 6. Keep applying: the editor toolbar re-renders after template/tool
  //    swaps, which re-introduces the desktop breakpoint switcher and
  //    floating selection pill. Attach a debounced MutationObserver
  //    once so the chrome stays clean across every re-render.
  if (!modal.__msMobileObs) {
    let pending = false;
    const obs = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        // Only react to structural changes (new nodes). Ignore the
        // attribute writes our own apply pass generates.
        obs.disconnect();
        studioApplyMobileChrome();
        obs.observe(modal, { childList: true, subtree: true });
      }, 150);
    });
    obs.observe(modal, { childList: true, subtree: true });
    modal.__msMobileObs = obs;
  }
}
window.studioApplyMobileChrome = studioApplyMobileChrome;

function renderDesignStudioTabsHtml() {
  return DESIGN_STUDIO_TABS.map(([id, label]) => `<button type="button" role="tab" data-design-studio-tab="${id}" aria-selected="${window.__studioWorkspaceTab === id}" onclick="setDesignStudioTab('${id}')" class="px-3.5 py-2 -mb-px whitespace-nowrap border-b-2 text-xs font-black transition ${window.__studioWorkspaceTab === id ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'}">${label}</button>`).join('');
}

function studioRenderSaveState(state) {
  const el = document.getElementById('studio-save-status');
  if (!el) return;
  const styles = { SAVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', SAVING: 'bg-sky-500/20 text-sky-400 border-sky-500/40', UNSAVED: 'bg-amber-500/20 text-amber-400 border-amber-500/40', 'SAVE FAILED': 'bg-rose-500/20 text-rose-400 border-rose-500/40', PUBLISHED: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' };
  el.textContent = state.status;
  el.className = `px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold border ${styles[state.status] || styles.UNSAVED}`;
}

// Standard editor shortcuts (undo/redo/copy/cut/paste/duplicate/group/delete). Every
// shortcut is disabled while focus is in an input/textarea/contenteditable — including
// Fabric's own hidden textarea for in-canvas text editing — so typing a design name,
// a text object's contents, or a search box is never hijacked.
function studioKeydownHandler(e) {
  const adapter = window.__studioAdapter;
  if (!adapter) return;
  const tag = (document.activeElement?.tagName || '').toLowerCase();
  const editable = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;
  if (editable) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); adapter.deleteSelected(); return; }
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) { e.preventDefault(); const distance = e.shiftKey ? 10 : 1; const delta = { ArrowUp: [0, -distance], ArrowDown: [0, distance], ArrowLeft: [-distance, 0], ArrowRight: [distance, 0] }[e.key]; adapter.nudgeSelected(delta[0], delta[1]); return; }
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === 'z' && e.shiftKey) { e.preventDefault(); adapter.redo(); }
  else if (key === 'z') { e.preventDefault(); adapter.undo(); }
  else if (key === 'y') { e.preventDefault(); adapter.redo(); }
  else if (key === 'd') { e.preventDefault(); adapter.duplicateSelected(); }
  else if (key === 'c') { e.preventDefault(); adapter.copySelected(); }
  else if (key === 'x') { e.preventDefault(); adapter.cutSelected(); }
  else if (key === 'v') { e.preventDefault(); adapter.pasteClipboard(); }
  else if (key === 'g' && e.shiftKey) { e.preventDefault(); adapter.ungroupSelected(); }
  else if (key === 'g') { e.preventDefault(); adapter.groupSelected(); }
}
window.studioKeydownHandler = studioKeydownHandler;

function renderStudioPhotoResults(photos) {
  return photos.map(photo => `<button type="button" onclick="addLibraryImageToCanvas('${photo.url}')" class="relative group overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition" title="${escS(photo.alt)}"><img src="${photo.url}" alt="${escS(photo.alt)}" loading="lazy" class="w-full aspect-square object-cover group-hover:scale-105 transition duration-200"><span class="absolute inset-x-0 bottom-0 px-2 py-1 bg-slate-950/80 text-[9px] text-left text-white truncate">${escS(photo.alt)}</span></button>`).join('');
}

function renderPexelsResults(photos) {
  return photos.map(photo => `<div class="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"><button type="button" onclick="addLibraryImageToCanvas('${escS(photo.source_url)}', '${escS(photo.alt || 'Pexels photo')}')" class="block w-full group"><img src="${escS(photo.preview_url)}" alt="${escS(photo.alt || '')}" loading="lazy" class="w-full aspect-square object-cover group-hover:scale-105 transition duration-200"></button><div class="px-2 py-1.5 text-[9px] truncate"><a href="${escS(photo.author_url || photo.attribution_url || 'https://www.pexels.com')}" target="_blank" rel="noopener" class="text-sky-400 hover:underline">${escS(photo.author || 'Pexels photographer')}</a></div></div>`).join('');
}

function renderStudioVideoResults(videos, uploaded = false) {
  return videos.map(video => `<div class="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"><video src="${escS(video.source_url || video.public_url)}" poster="${escS(video.preview_url || '')}" muted loop playsinline controls preload="metadata" class="w-full aspect-video object-cover bg-black"></video><div class="p-2"><div class="flex items-center justify-between gap-2"><a href="${escS(video.author_url || video.attribution_url || '#')}" target="_blank" rel="noopener" class="min-w-0 truncate text-[9px] text-sky-400 hover:underline">${escS(uploaded ? (video.title || 'Your video') : (video.author || 'Pexels creator'))}</a>${video.duration ? `<span class="text-[9px] text-slate-500 dark:text-slate-400">${Number(video.duration)}s</span>` : ''}</div><button onclick="addLibraryVideoToCanvas('${escS(video.source_url || video.public_url)}', '${escS(video.title || video.alt || 'Video')}')" class="mt-2 w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-[10px] font-black">Add video to canvas</button></div></div>`).join('');
}

function renderStudioWorkspaceHtml(designName, scene) {
  return `
    <!-- Inline styles for the inspector primitives — shipped IN the
         modal HTML so a cached marketsync-theme.css can't leave the
         inspector rendering as run-together text on a viewer's phone.
         Duplicates the rules in marketsync-theme.css intentionally.
         !important beats any older rules that may still be on the
         wire during a rolling deploy. -->
    <style data-studio-inline="1">
      #ms-studio-master-modal .studio-inspector-heading{display:flex!important;align-items:center;justify-content:space-between;gap:.75rem;padding:1rem 1.25rem .75rem;border-bottom:1px solid #e2e8f0}
      #ms-studio-master-modal .studio-inspector-heading>div{display:flex!important;flex-direction:column;gap:.25rem;min-width:0;flex:1 1 auto}
      #ms-studio-master-modal .studio-inspector-heading>div>span{font-size:.625rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748b}
      #ms-studio-master-modal .studio-inspector-heading>div>input{border:0;padding:0;background:transparent;font-size:.9375rem;font-weight:800;color:#0f172a;outline:none;width:100%;min-width:0}
      #ms-studio-master-modal .studio-inspector-heading>button{flex:0 0 auto;width:32px;height:32px;border-radius:999px;border:0;background:#f1f5f9;color:#475569;font-size:18px;font-weight:700;cursor:pointer;line-height:1}
      #ms-studio-master-modal .studio-inspector-tabs{display:flex!important;gap:.25rem;padding:.5rem .75rem 0;border-bottom:1px solid #e2e8f0}
      #ms-studio-master-modal .studio-inspector-tabs>button{flex:1 1 auto;padding:.625rem .5rem;border:0;background:transparent;cursor:pointer;font-size:.75rem;font-weight:800;color:#64748b;border-bottom:2px solid transparent}
      #ms-studio-master-modal .studio-inspector-tabs>button[aria-current="page"]{color:#2563eb;border-bottom-color:#2563eb}
      #ms-studio-master-modal .studio-inspector-body{padding:.75rem 1rem 1.25rem;display:flex!important;flex-direction:column;gap:1rem}
      #ms-studio-master-modal .studio-inspector-section{display:flex!important;flex-direction:column;gap:.625rem}
      #ms-studio-master-modal .studio-inspector-section h4{font-size:.625rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin:0}
      #ms-studio-master-modal .studio-inspector-section label{display:flex!important;flex-direction:column;gap:.25rem;font-size:.6875rem;font-weight:700;color:#475569}
      #ms-studio-master-modal .studio-inspector-section label>input:not([type="color"]):not([type="range"]),#ms-studio-master-modal .studio-control-input{padding:.5rem .625rem;border-radius:.5rem;border:1px solid #cbd5e1;background:#fff;color:#0f172a;font-size:.8125rem;font-weight:600;min-height:36px}
      #ms-studio-master-modal .studio-inspector-section label>input[type="color"]{width:100%;height:40px;padding:0;border-radius:.5rem;border:1px solid #cbd5e1;cursor:pointer}
      #ms-studio-master-modal .studio-inspector-section label>input[type="range"]{width:100%}
      #ms-studio-master-modal .studio-control-grid{display:grid!important;gap:.5rem}
      #ms-studio-master-modal .studio-control-grid-2{grid-template-columns:1fr 1fr}
      #ms-studio-master-modal .studio-control-grid-3{grid-template-columns:1fr 1fr 1fr}
      #ms-studio-master-modal .studio-control-action{padding:.5rem .75rem;border-radius:.5rem;border:1px solid #e2e8f0;background:#f8fafc;color:#0f172a;font-size:.75rem;font-weight:700;cursor:pointer;min-height:36px}
      #ms-studio-master-modal .studio-segmented,#ms-studio-master-modal .studio-align-grid,#ms-studio-master-modal .studio-animation-grid,#ms-studio-master-modal .studio-style-presets{display:grid!important;gap:.375rem}
      #ms-studio-master-modal .studio-segmented{grid-template-columns:1fr 1fr 1fr 1fr}
      #ms-studio-master-modal .studio-align-grid,#ms-studio-master-modal .studio-animation-grid{grid-template-columns:1fr 1fr 1fr}
      #ms-studio-master-modal .studio-style-presets{grid-template-columns:1fr 1fr 1fr 1fr}
      #ms-studio-master-modal .studio-segmented>button,#ms-studio-master-modal .studio-align-grid>button,#ms-studio-master-modal .studio-animation-grid>button,#ms-studio-master-modal .studio-style-presets>button{padding:.5rem .375rem;border-radius:.5rem;border:1px solid #e2e8f0;background:#f8fafc;color:#0f172a;font-size:.6875rem;font-weight:700;cursor:pointer;min-height:44px;display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:.125rem}
      #ms-studio-master-modal .studio-inspector-actions{border-top:1px solid #e2e8f0;padding-top:1rem}
      #ms-studio-master-modal .studio-delete-action{width:100%;padding:.625rem;border-radius:.5rem;border:0;background:#fef2f2;color:#dc2626;font-size:.75rem;font-weight:800;cursor:pointer;margin-top:.5rem;min-height:40px}
      #ms-studio-master-modal .studio-inspector-empty{padding:2rem 1.25rem;text-align:center;color:#64748b;display:flex!important;flex-direction:column;align-items:center;gap:.5rem}
      .dark #ms-studio-master-modal .studio-inspector-heading{border-color:#293c5b}
      .dark #ms-studio-master-modal .studio-inspector-heading>div>input{color:#e7eef8}
      .dark #ms-studio-master-modal .studio-inspector-section label>input:not([type="color"]):not([type="range"]),.dark #ms-studio-master-modal .studio-control-input{background:#0f1e35;border-color:#293c5b;color:#e7eef8}
      .dark #ms-studio-master-modal .studio-control-action,.dark #ms-studio-master-modal .studio-segmented>button,.dark #ms-studio-master-modal .studio-align-grid>button,.dark #ms-studio-master-modal .studio-animation-grid>button,.dark #ms-studio-master-modal .studio-style-presets>button{background:#111d32;border-color:#293c5b;color:#e7eef8}
      .dark #ms-studio-master-modal .studio-inspector-tabs,.dark #ms-studio-master-modal .studio-inspector-actions{border-color:#293c5b}
      /* Mobile-only cleanup that must not wait on marketsync-theme.css */
      @media (max-width:768px){
        #ms-studio-master-modal .studio-breakpoint-group{display:none!important}
        #ms-studio-master-modal .studio-desktop-action{display:none!important}
        #ms-studio-master-modal .studio-title-badge,#ms-studio-master-modal .studio-brand-logo,#ms-studio-master-modal .studio-brand-divider,#ms-studio-master-modal .studio-back-long{display:none!important}
        #ms-studio-master-modal .studio-back-short{display:inline!important}
        #ms-studio-master-modal #studio-design-name{max-width:40vw;min-width:0;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}
        /* Horizontal swipe on the format tiles, design sets, and templates
           grids. Cache-proof duplicate of the .studio-scroll-row rule so a
           stale theme.css can't leave phones with the old 2-column stacked
           layout. */
        .studio-scroll-row{display:flex!important;grid-template-columns:none!important;overflow-x:auto;overflow-y:hidden;gap:.75rem!important;padding-bottom:.5rem;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory;scrollbar-width:none;margin-left:-1rem;margin-right:-1rem;padding-left:1rem;padding-right:1rem}
        .studio-scroll-row::-webkit-scrollbar{display:none}
        .studio-scroll-row>*{flex:0 0 auto;width:62vw;max-width:240px;scroll-snap-align:start}
        .studio-scroll-row>.studio-home-set-card{width:78vw;max-width:320px}
      }
    </style>
    <!-- Header: two stacked layers — identity/branding on top, actions below.
         Split out of one crowded row so the toolbar (zoom, undo/redo, format,
         Save/Schedule/Render) has its own layer instead of fighting the logo/back
         button/name field for space. -->
    <div class="studio-header-stack flex-shrink-0 z-20">
    <header class="studio-identity-bar h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between">
      <div class="studio-identity-main flex items-center gap-3">
        <button onclick="closeMarketSyncStudio()" class="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 text-xs font-bold">
          <span class="studio-back-long">${typeof isDesignStudioOnlyWorkspace === 'function' && isDesignStudioOnlyWorkspace() ? '← Settings' : '← Back to Marketing'}</span><span class="studio-back-short">← Back</span>
        </button>
        <div class="studio-brand-divider h-5 w-px bg-slate-100 dark:bg-slate-800"></div>
        <img src="/assets/brand/marketsync-logo-primary.png" alt="MarketSync" class="studio-brand-logo h-8 w-auto dark:hidden">
        <img src="/assets/brand/marketsync-logo-white.png" alt="MarketSync" class="studio-brand-logo h-8 w-auto hidden dark:block">
        <span class="studio-title-badge px-2 py-0.5 rounded-lg text-[11px] font-black bg-indigo-600 text-white dark:bg-indigo-600/20 dark:text-indigo-300 border border-indigo-600 dark:border-indigo-500/40 tracking-wide uppercase">Studio</span>
        <input type="text" id="studio-design-name" value="${escS(designName)}" onchange="saveStudioDesignName(this.value)" class="bg-transparent text-sm font-black text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800 px-2 py-1 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-700 transition">
        <span id="studio-save-status" class="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-600 text-white dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-600 dark:border-emerald-500/40">SAVED</span>
      </div>
    </header>

    <nav role="tablist" aria-label="Design Studio" class="h-11 px-4 flex items-end gap-1 overflow-x-auto bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      ${renderDesignStudioTabsHtml()}
    </nav>

    <!-- Toolbar layer -->
    <div class="studio-command-bar h-14 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between gap-3">
      <!-- Left tool cluster scrolls on its own so it can never push the primary
           actions (Save/Schedule/Publish) off the right edge — the exact reason
           Schedule + Render weren't visible on laptop widths. -->
      <div class="studio-command-scroll flex items-center gap-2 min-w-0 overflow-x-auto">
        <!-- Zoom Controls -->
        <div class="studio-zoom-controls flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-300 dark:border-slate-700">
          <button onclick="zoomStudioOut()" title="Zoom Out" class="px-2.5 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-black text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">-</button>
          <span id="studio-zoom-display" class="px-2 text-xs font-mono font-bold text-indigo-600 dark:text-sky-400">55%</span>
          <button onclick="zoomStudioIn()" title="Zoom In" class="px-2.5 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-black text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">+</button>
          <button onclick="zoomStudioFit()" title="Fit to Screen" class="px-2.5 py-1 ml-1 rounded-lg bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 text-[11px] font-bold text-slate-900 dark:text-white transition">Fit</button>
        </div>
        <button id="studio-guides-toggle" onclick="toggleStudioGuides()" class="px-3 py-1.5 rounded-xl bg-indigo-600 text-white dark:bg-blue-600/20 dark:border dark:border-blue-500/40 dark:text-blue-300 text-xs font-bold">Guides on</button>
        <button id="studio-grid-toggle" onclick="toggleStudioGrid()" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">Grid off</button>

        <div class="h-5 w-px bg-slate-200 dark:bg-slate-800"></div>

        <button onclick="if(window.__studioAdapter) window.__studioAdapter.undo()" title="Undo (Ctrl+Z)" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6-6m-6 6l6 6"/></svg>Undo</button>
        <button onclick="if(window.__studioAdapter) window.__studioAdapter.redo()" title="Redo (Ctrl+Shift+Z)" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 10H11a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6"/></svg>Redo</button>
        <div class="h-5 w-px bg-slate-200 dark:bg-slate-800"></div>

        <button onclick="if(window.__studioAdapter) window.__studioAdapter.duplicateSelected()" title="Duplicate (Ctrl+D)" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>Duplicate</button>
        <button onclick="if(window.__studioAdapter) window.__studioAdapter.groupSelected()" title="Group (Ctrl+G)" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4h7v7H4V4zm9 9h7v7h-7v-7zM4 20a1 1 0 001-1v-2M4 17v-1a1 1 0 011-1M20 4a1 1 0 00-1 1v2M20 7v1a1 1 0 01-1 1"/></svg>Group</button>
        <button onclick="if(window.__studioAdapter) window.__studioAdapter.ungroupSelected()" title="Ungroup (Ctrl+Shift+G)" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4h6v6H4V4zm10 10h6v6h-6v-6zM4 14h6v6H4v-6zm10-10h6v6h-6V4z"/></svg>Ungroup</button>
        <div class="h-5 w-px bg-slate-200 dark:bg-slate-800"></div>

        <select id="studio-format-picker" onchange="changeStudioFormat(this.value)" class="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700">
          ${Object.entries(STUDIO_SOCIAL_FORMATS).map(([key, format]) => `<option value="${key}" ${scene.format_key === key ? 'selected' : ''}>${format.label} (${format.w}×${format.h})</option>`).join('')}
        </select>
        <button type="button" onclick="openStudioMagicResize()" class="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black whitespace-nowrap">✦ Magic Resize</button>
        <div class="studio-breakpoint-group hidden md:flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-0.5" title="Preview breakpoint-specific layout overrides">
          <button type="button" onclick="setStudioBreakpoint('desktop')" data-studio-breakpoint="desktop" class="studio-breakpoint px-2 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-black">Desktop</button>
          <button type="button" onclick="setStudioBreakpoint('tablet')" data-studio-breakpoint="tablet" class="studio-breakpoint px-2 py-1 rounded-lg text-slate-500 dark:text-slate-300 text-[10px] font-bold">Tablet</button>
          <button type="button" onclick="setStudioBreakpoint('mobile')" data-studio-breakpoint="mobile" class="studio-breakpoint px-2 py-1 rounded-lg text-slate-500 dark:text-slate-300 text-[10px] font-bold">Mobile</button>
        </div>
      </div>

      <div class="studio-primary-actions flex items-center gap-2 flex-shrink-0">
        <button onclick="toggleStudioToolPanel()" class="studio-mobile-panel-button px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">Tools</button>
        <button onclick="toggleStudioInspectorPanel()" class="studio-mobile-panel-button px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">Inspector</button>
        <button onclick="saveStudioDesign()" class="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold transition flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>Save
        </button>
        <button onclick="openStudioRevisionHistory()" class="studio-desktop-action px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold transition">History</button>
        <button onclick="openStudioCollaboration()" class="studio-desktop-action px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold transition">Review</button>
        <button onclick="openStudioAiDesign()" class="studio-desktop-action px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black transition">✦ AI Design</button>
        <button onclick="openStudioExport()" class="studio-desktop-action px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold transition">Export</button>
        <button onclick="publishStudioDesign()" class="studio-desktop-action px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg transition">Publish</button>
        <button onclick="if(typeof openStudioSchedulerWithEntitlementCheck === 'function') openStudioSchedulerWithEntitlementCheck()" class="studio-desktop-action px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold transition flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Schedule
        </button>
        <button onclick="renderStudioDesignAndPublish()" class="studio-desktop-action px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg transition flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.684A1.85 1.85 0 014.28 11.5c0-.853.585-1.572 1.4-1.782m0 0A3.001 3.001 0 0111 8.5h6.25a2.25 2.25 0 012.25 2.25v2.25a2.25 2.25 0 01-2.25 2.25H11a3 3 0 01-5.564-1.566z"/></svg>Render &amp; Publish to Social
        </button>
      </div>
    </div>
    </div>

    <!-- Main Workspace Body -->
    <div class="studio-workspace-body flex-1 flex overflow-hidden relative">
      <button type="button" class="studio-mobile-scrim" onclick="closeStudioMobilePanels()" aria-label="Close Studio panel"></button>
      <!-- Left Tool Rail -->
      <nav data-studio-region="rail" class="w-16 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col items-center py-3 gap-3 flex-shrink-0 z-10">
        <button onclick="setStudioTool('templates')" id="tool-btn-templates" data-studio-tool="templates" aria-current="${window.__studioActiveTool === 'templates' ? 'page' : 'false'}" class="studio-tool-rail-button">
          <svg class="studio-tool-icon w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>Templates
        </button>
        <button onclick="setDesignStudioTab('projects')" id="tool-btn-projects" data-studio-tool="projects" aria-current="false" class="studio-tool-rail-button"><span class="studio-tool-icon text-base mb-0.5">▣</span>Projects</button>
        <button onclick="setStudioTool('elements')" id="tool-btn-elements" data-studio-tool="elements" aria-current="false" class="studio-tool-rail-button"><span class="studio-tool-icon text-base mb-0.5">✦</span>Elements</button>
        <button onclick="setStudioTool('inventory')" id="tool-btn-inventory" data-studio-tool="inventory" aria-current="false" class="studio-tool-rail-button">
          <svg class="studio-tool-icon w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 17a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM4 9h16l-1.5 5H5.5L4 9z"/></svg>Inventory
        </button>
        <button onclick="setStudioTool('photos')" id="tool-btn-photos" data-studio-tool="photos" aria-current="false" class="studio-tool-rail-button">
          <svg class="studio-tool-icon w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Photos
        </button>
        <button onclick="setStudioTool('videos')" id="tool-btn-videos" data-studio-tool="videos" aria-current="false" class="studio-tool-rail-button"><span class="studio-tool-icon text-base">▶</span>Videos</button>
        <button onclick="setStudioTool('record')" id="tool-btn-record" data-studio-tool="record" aria-current="false" class="studio-tool-rail-button"><span class="studio-tool-icon text-base">●</span>Record</button>
        <button onclick="setStudioTool('uploads')" id="tool-btn-uploads" data-studio-tool="uploads" aria-current="false" class="studio-tool-rail-button"><span class="studio-tool-icon text-base">↑</span>Uploads</button>
        <button onclick="setStudioTool('media')" id="tool-btn-media" data-studio-tool="media" aria-current="false" class="studio-tool-rail-button"><span class="studio-tool-icon text-base mb-0.5">▧</span>Media</button>
        <button onclick="setStudioTool('shapes')" id="tool-btn-shapes" data-studio-tool="shapes" aria-current="false" class="studio-tool-rail-button">
          <svg class="studio-tool-icon w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"/></svg>Shapes
        </button>
        <button onclick="setStudioTool('icons')" id="tool-btn-icons" data-studio-tool="icons" aria-current="false" class="studio-tool-rail-button"><span class="studio-tool-icon text-base mb-0.5">✦</span>Icons</button>
        <button onclick="setStudioTool('stickers')" id="tool-btn-stickers" data-studio-tool="stickers" aria-current="false" class="studio-tool-rail-button">
          <svg class="studio-tool-icon w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3z"/></svg>Stickers
        </button>
        <button onclick="setStudioTool('text')" id="tool-btn-text" data-studio-tool="text" aria-current="false" class="studio-tool-rail-button">
          <span class="studio-tool-icon text-base font-black">Aa</span>Text
        </button>
        <button onclick="setStudioTool('brand')" id="tool-btn-brand" data-studio-tool="brand" aria-current="false" class="studio-tool-rail-button">
          <svg class="studio-tool-icon w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h10M7 12h10m-7 5h7"/></svg>Brand
        </button>
        <button onclick="setStudioTool('layers')" id="tool-btn-layers" data-studio-tool="layers" aria-current="false" class="studio-tool-rail-button"><span class="studio-tool-icon text-base mb-0.5">≡</span>Layers</button>
      </nav>

      <!-- Left Tool Panel Drawer -->
      <aside data-studio-region="drawer" class="w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col flex-shrink-0 z-10 overflow-y-auto transition-all duration-200" id="studio-tool-panel">
        <div class="flex items-center justify-between p-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <span class="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Tool Drawer</span>
          <button type="button" onclick="toggleStudioToolPanel()" class="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Collapse Tool Panel">&lt;</button>
        </div>
        ${renderStudioToolPanelContent(window.__studioActiveTool)}
      </aside>

      <!-- Center Artboard Viewport Canvas -->
      <main data-studio-region="canvas" id="studio-canvas-viewport" class="flex-1 min-w-0 bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
        <div id="studio-page-stack" aria-label="Pages" class="studio-page-stack"></div>
        <div class="studio-page-stage-label"><span id="studio-active-page-label">Page 1</span><span class="studio-page-stage-actions"><button type="button" onclick="duplicateStudioPage(window.__studioAdapter?.activePageId)" title="Duplicate page">⧉</button><button type="button" onclick="deleteStudioPage(window.__studioAdapter?.activePageId)" title="Delete page">⌫</button></span></div>
        <div id="studio-artboard-container" class="absolute left-1/2 top-1/2 shadow-2xl rounded-2xl overflow-hidden border-4 border-blue-500/70 bg-white dark:bg-slate-900 ring-4 ring-blue-500/20 transition-transform duration-200 origin-center" style="width:${scene.width}px; height:${scene.height}px; transform:translate(-50%, -50%) scale(0.55);">
          <canvas id="studio-main-canvas"></canvas>
          ${renderStudioSafeGuides(scene.format_key || 'square')}
        </div>
      </main>

      <!-- Right Property Inspector & Layer Controls -->
      <aside data-studio-region="inspector" class="w-60 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col flex-shrink-0 p-3 z-10 overflow-y-auto transition-all duration-200" id="studio-inspector-panel">
        <div class="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200 dark:border-slate-800">
          <span class="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Inspector</span>
          <button type="button" onclick="toggleStudioInspectorPanel()" class="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Collapse Inspector">&gt;</button>
        </div>
        ${renderStudioProfessionalInspectorHtml(null)}
      </aside>
    </div>
    <footer data-studio-region="footer" class="studio-page-footer h-16 flex-shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-3 flex items-center gap-2 overflow-x-auto z-30">
      <span class="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Pages</span>
      <select onchange="setStudioPage(this.value)" class="max-w-28 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold">${(scene.pages || [{ id: 'page-1', name: 'Page 1' }]).map((page, index) => `<option value="${escS(page.id || `page-${index + 1}`)}">${escS(page.name || `Page ${index + 1}`)}</option>`).join('')}</select>
      <button onclick="addStudioPage()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-xs font-black">+ Page</button>
      <div class="studio-footer-text-control h-7 w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>
      <span class="studio-footer-text-control text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">Text</span>
      <button onclick="studioAddText('heading')" class="studio-footer-text-control whitespace-nowrap px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black">+ Heading</button>
      <button onclick="studioAddText('subheading')" class="studio-footer-text-control whitespace-nowrap px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold">+ Subheading</button>
      <button onclick="studioAddText('body')" class="studio-footer-text-control whitespace-nowrap px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium">+ Body text</button>
      <div class="studio-footer-text-control h-7 w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>
      <label class="studio-footer-text-control text-[11px] text-slate-500 dark:text-slate-400 font-bold">Size</label>
      <select onchange="studioSetTextStyle('fontSize', Number(this.value))" class="studio-footer-text-control bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs"><option>18</option><option>24</option><option selected>36</option><option>48</option><option>64</option><option>88</option></select>
      <button onclick="studioSetTextStyle('fontWeight', '900')" class="studio-footer-text-control w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-black">B</button>
      <label class="studio-footer-text-control flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold">Colour <input type="color" value="#ffffff" onchange="studioSetTextStyle('fill', this.value)" class="w-6 h-6 rounded cursor-pointer bg-transparent"></label>
      <span id="studio-text-hint" class="studio-footer-text-control ml-auto whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">Select text to format it</span>
    </footer>
  `;
}

// Every 'vehicle-image' element below carries a real fallback `src` (a free library
// photo) so a template shows a fully styled example the moment it loads — before that,
// with no src and no bound vehicle, fabric-adapter.js's render condition
// `(el.src || currentVehicle?.primary_photo_url)` was false and the whole photo slot
// rendered as nothing, a blank hole in the layout. Binding a real vehicle
// (bindVehicleToStudio()) doesn't touch this src — it layers a new image + badge +
// text on top instead — so the fallback photo stays as a backdrop unless the user
// deletes it, same as any other placeholder asset.
const STUDIO_TEMPLATES_CATALOG = {
  tmpl_spotlight_square: {
    template_key: 'tmpl_spotlight_square',
    name: 'Vehicle Spotlight (Square)',
    desc: '1080×1080 • Bound Inventory Template',
    format_key: 'square',
    width: 1080,
    height: 1080,
    scene: {
      version: 1,
      format_key: 'square',
      width: 1080,
      height: 1080,
      background: { color: '#0F172A' },
      elements: [
        { id: 'el-bg-photo', type: 'vehicle-image', src: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=82', x: 0, y: 0, width: 1080, height: 720, fit: 'cover', opacity: 1, z: 1, name: 'Vehicle Photo' },
        { id: 'el-grad-overlay', type: 'shape', shapeType: 'rect', x: 0, y: 580, width: 1080, height: 500, fill: '#0F172A', opacity: 0.95, z: 2, name: 'Bottom Panel' },
        { id: 'el-badge', type: 'shape', shapeType: 'rect', x: 50, y: 50, width: 220, height: 50, fill: '#4F46E5', rx: 12, opacity: 1, z: 3, name: 'Badge Pill' },
        { id: 'el-badge-txt', type: 'text', x: 75, y: 65, text: 'JUST ARRIVED', fontSize: 18, fontWeight: '800', fill: '#FFFFFF', z: 4, name: 'Badge Text' },
        { id: 'el-title', type: 'text', x: 50, y: 630, text: '{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}', fontSize: 44, fontWeight: '900', fill: '#F8FAFC', z: 5, name: 'Vehicle Name' },
        { id: 'el-trim', type: 'text', x: 50, y: 695, text: '{{vehicle.trim}} • Stock #{{vehicle.stock_number}}', fontSize: 24, fontWeight: '600', fill: '#94A3B8', z: 6, name: 'Trim & Stock' },
        { id: 'el-price-bg', type: 'shape', shapeType: 'rect', x: 50, y: 760, width: 340, height: 70, fill: '#10B981', rx: 16, opacity: 1, z: 7, name: 'Price Badge' },
        { id: 'el-price-txt', type: 'text', x: 80, y: 780, text: '{{vehicle.price}}', fontSize: 32, fontWeight: '900', fill: '#FFFFFF', z: 8, name: 'Price Text' },
        { id: 'el-cta-btn', type: 'shape', shapeType: 'rect', x: 50, y: 900, width: 980, height: 90, fill: '#2563EB', rx: 20, opacity: 1, z: 9, name: 'CTA Button' },
        { id: 'el-cta-txt', type: 'text', x: 380, y: 930, text: 'SCHEDULE TEST DRIVE', fontSize: 24, fontWeight: '800', fill: '#FFFFFF', z: 10, name: 'CTA Text' }
      ]
    }
  },
  tmpl_pricedrop_story: {
    template_key: 'tmpl_pricedrop_story',
    name: 'Price Drop Banner (Story)',
    desc: '1080×1920 • Special Reductions',
    format_key: 'story',
    width: 1080,
    height: 1920,
    scene: {
      version: 1,
      format_key: 'story',
      width: 1080,
      height: 1920,
      background: { color: '#18181B' },
      elements: [
        { id: 'el-photo', type: 'vehicle-image', src: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=88', x: 0, y: 0, width: 1080, height: 1410, fit: 'cover', opacity: 1, z: 1, name: 'Vehicle Photo' },
        { id: 'el-photo-overlay', type: 'shape', shapeType: 'rect', x: 0, y: 0, width: 1080, height: 1410, fill: '#07111F', opacity: 0.34, z: 2, name: 'Photo Contrast Overlay' },
        { id: 'el-top-banner', type: 'shape', shapeType: 'badge', x: 70, y: 82, width: 330, height: 68, fill: '#EF4444', opacity: 1, rx: 34, z: 3, name: 'Price Reduction Banner' },
        { id: 'el-top-txt', type: 'text', x: 104, y: 102, width: 270, text: 'PRICE REDUCED', fontSize: 30, fontWeight: '900', fill: '#FFFFFF', z: 4, name: 'Banner Text' },
        { id: 'el-headline', type: 'text', x: 70, y: 250, width: 820, text: 'YOUR NEXT ADVENTURE STARTS HERE', fontSize: 72, fontWeight: '900', fill: '#FFFFFF', z: 4, name: 'Campaign Headline' },
        { id: 'el-subhead', type: 'text', x: 74, y: 470, width: 680, text: 'Drive away in a better vehicle for less.', fontSize: 30, fontWeight: '600', fill: '#E2E8F0', z: 4, name: 'Campaign Subheadline' },
        { id: 'el-card', type: 'shape', shapeType: 'rect', x: 50, y: 1225, width: 980, height: 635, fill: '#0B1220', rx: 34, opacity: 0.97, z: 5, name: 'Vehicle Information Card' },
        { id: 'el-card-label', type: 'text', x: 100, y: 1290, width: 500, text: 'FEATURED VEHICLE', fontSize: 24, fontWeight: '900', fill: '#67E8F9', z: 6, name: 'Vehicle Label' },
        { id: 'el-ymmt', type: 'text', x: 100, y: 1340, width: 850, text: '{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}', fontSize: 54, fontWeight: '900', fill: '#FFFFFF', z: 6, name: 'Vehicle Title' },
        { id: 'el-miles', type: 'text', x: 100, y: 1425, width: 700, text: '{{vehicle.mileage}} miles • Available now', fontSize: 28, fontWeight: '600', fill: '#CBD5E1', z: 6, name: 'Mileage' },
        { id: 'el-price-label', type: 'text', x: 100, y: 1500, width: 250, text: 'NOW ONLY', fontSize: 23, fontWeight: '900', fill: '#94A3B8', z: 6, name: 'Price Label' },
        { id: 'el-price', type: 'text', x: 100, y: 1530, width: 650, text: '{{vehicle.price}}', fontSize: 68, fontWeight: '900', fill: '#34D399', z: 6, name: 'Special Price' },
        { id: 'el-cta', type: 'shape', shapeType: 'badge', x: 100, y: 1660, width: 470, height: 88, fill: '#2563EB', opacity: 1, rx: 24, z: 6, name: 'Campaign CTA' },
        { id: 'el-cta-txt', type: 'text', x: 145, y: 1685, width: 380, text: 'BOOK A TEST DRIVE  →', fontSize: 25, fontWeight: '900', fill: '#FFFFFF', z: 7, name: 'CTA Text' },
        { id: 'el-store', type: 'text', x: 100, y: 1790, width: 850, text: '{{dealership.name}} • {{dealership.phone}}', fontSize: 22, fontWeight: '700', fill: '#CBD5E1', z: 7, name: 'Store Contact' }
      ]
    }
  },
  tmpl_weekend_landscape: {
    template_key: 'tmpl_weekend_landscape',
    name: 'Weekend Sales Event (Landscape)',
    desc: '1200×628 • Facebook & LinkedIn Ad',
    format_key: 'landscape',
    width: 1200,
    height: 628,
    scene: {
      version: 1,
      format_key: 'landscape',
      width: 1200,
      height: 628,
      background: { color: '#0B0F19' },
      elements: [
        { id: 'el-photo', type: 'vehicle-image', src: 'https://images.unsplash.com/photo-1562141961-b5d64a7b61c0?auto=format&fit=crop&w=1600&q=82', x: 0, y: 0, width: 620, height: 628, fit: 'cover', opacity: 1, z: 1, name: 'Vehicle Photo' },
        { id: 'el-card', type: 'shape', shapeType: 'rect', x: 600, y: 0, width: 600, height: 628, fill: '#1E293B', opacity: 1, z: 2, name: 'Right Copy Panel' },
        { id: 'el-badge', type: 'text', x: 650, y: 60, text: 'WEEKEND SPECIAL', fontSize: 20, fontWeight: '800', fill: '#F59E0B', z: 3, name: 'Badge' },
        { id: 'el-title', type: 'text', x: 650, y: 110, text: '{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}', fontSize: 36, fontWeight: '900', fill: '#FFFFFF', z: 4, name: 'Vehicle Name' },
        { id: 'el-offer', type: 'text', x: 650, y: 220, text: 'ASK ABOUT CURRENT APPROVED OFFERS', fontSize: 22, fontWeight: '700', fill: '#94A3B8', z: 5, name: 'Offer Text', approval_required: true },
        { id: 'el-price', type: 'text', x: 650, y: 300, text: 'PRICE: {{vehicle.price}}', fontSize: 38, fontWeight: '900', fill: '#10B981', z: 6, name: 'Price Text' },
        { id: 'el-cta-btn', type: 'shape', shapeType: 'rect', x: 650, y: 440, width: 480, height: 75, fill: '#2563EB', rx: 16, opacity: 1, z: 7, name: 'CTA Button' },
        { id: 'el-cta-txt', type: 'text', x: 790, y: 465, text: 'CLAIM THIS OFFER', fontSize: 22, fontWeight: '800', fill: '#FFFFFF', z: 8, name: 'CTA Text' }
      ]
    }
  },
  tmpl_cpo_portrait: {
    template_key: 'tmpl_cpo_portrait',
    name: 'Certified Pre-Owned (Portrait)',
    desc: '1080×1350 • Instagram Post',
    format_key: 'portrait',
    width: 1080,
    height: 1350,
    scene: {
      version: 1,
      format_key: 'portrait',
      width: 1080,
      height: 1350,
      background: { color: '#0F172A' },
      elements: [
        { id: 'el-top-pill', type: 'shape', shapeType: 'rect', x: 50, y: 40, width: 340, height: 50, fill: '#D97706', rx: 12, opacity: 1, z: 1, name: 'CPO Pill' },
        { id: 'el-top-txt', type: 'text', x: 80, y: 55, text: 'CERTIFIED PRE-OWNED', fontSize: 18, fontWeight: '800', fill: '#FFFFFF', z: 2, name: 'CPO Text' },
        { id: 'el-photo', type: 'vehicle-image', src: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=82', x: 0, y: 120, width: 1080, height: 780, fit: 'cover', opacity: 1, z: 3, name: 'Vehicle Photo' },
        { id: 'el-card', type: 'shape', shapeType: 'rect', x: 40, y: 920, width: 1000, height: 380, fill: '#1E293B', rx: 24, opacity: 0.95, z: 4, name: 'Bottom Details Card' },
        { id: 'el-ymmt', type: 'text', x: 80, y: 970, text: '{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}', fontSize: 42, fontWeight: '900', fill: '#FFFFFF', z: 5, name: 'Title' },
        { id: 'el-insp', type: 'text', x: 80, y: 1040, text: 'CERTIFICATION DETAILS AVAILABLE', fontSize: 22, fontWeight: '600', fill: '#94A3B8', z: 6, name: 'Inspection', approval_required: true },
        { id: 'el-price', type: 'text', x: 80, y: 1120, text: '{{vehicle.sale_price|Contact dealer for details}}', binding: { template: '{{vehicle.sale_price|Contact dealer for details}}' }, fontSize: 28, fontWeight: '800', fill: '#34D399', z: 7, name: 'Price & Warranty' },
        { id: 'el-phone', type: 'text', x: 80, y: 1210, text: 'Call Us Today: {{dealership.phone}}', fontSize: 22, fontWeight: '700', fill: '#38BDF8', z: 8, name: 'Phone' }
      ]
    }
  },
  tmpl_trade_square: {
    template_key: 'tmpl_trade_square',
    name: 'Trade-In Valuation Bonus (Square)',
    desc: '1080×1080 • Top Market Appraisal',
    format_key: 'square',
    width: 1080,
    height: 1080,
    scene: {
      version: 1,
      format_key: 'square',
      width: 1080,
      height: 1080,
      background: { color: '#064E3B' },
      elements: [
        { id: 'el-hdr', type: 'text', x: 60, y: 80, text: 'TOP MARKET TRADE VALUE', fontSize: 44, fontWeight: '900', fill: '#FFFFFF', z: 1, name: 'Header' },
        { id: 'el-sub', type: 'text', x: 60, y: 150, text: 'We Need Used Inventory — Request Your Trade Appraisal', fontSize: 26, fontWeight: '700', fill: '#A7F3D0', z: 2, name: 'Subtitle' },
        { id: 'el-photo', type: 'vehicle-image', src: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1600&q=82', x: 60, y: 220, width: 960, height: 560, fit: 'cover', opacity: 1, z: 3, name: 'Vehicle Photo' },
        { id: 'el-btn', type: 'shape', shapeType: 'rect', x: 60, y: 840, width: 960, height: 160, fill: '#10B981', rx: 24, opacity: 1, z: 4, name: 'CTA Card' },
        { id: 'el-btn-txt', type: 'text', x: 180, y: 900, text: 'VALUE YOUR TRADE IN 60 SECONDS', fontSize: 32, fontWeight: '900', fill: '#FFFFFF', z: 5, name: 'CTA Text' }
      ]
    }
  },
  tmpl_ev_story: {
    template_key: 'tmpl_ev_story',
    name: 'Electric & Hybrid Showcase (Story)',
    desc: '1080×1920 • EV & Clean Energy Ads',
    format_key: 'story',
    width: 1080,
    height: 1920,
    scene: {
      version: 1,
      format_key: 'story',
      width: 1080,
      height: 1920,
      background: { color: '#0284C7' },
      elements: [
        { id: 'el-badge', type: 'shape', shapeType: 'rect', x: 60, y: 60, width: 360, height: 60, fill: '#06B6D4', rx: 16, opacity: 1, z: 1, name: 'EV Badge' },
        { id: 'el-badge-txt', type: 'text', x: 90, y: 78, text: 'NEXT-GEN ELECTRIC', fontSize: 22, fontWeight: '900', fill: '#FFFFFF', z: 2, name: 'EV Text' },
        { id: 'el-photo', type: 'vehicle-image', src: 'https://images.unsplash.com/photo-1592833159155-c62df1b65634?auto=format&fit=crop&w=1600&q=82', x: 0, y: 160, width: 1080, height: 1100, fit: 'cover', opacity: 1, z: 3, name: 'Vehicle Photo' },
        { id: 'el-card', type: 'shape', shapeType: 'rect', x: 50, y: 1300, width: 980, height: 520, fill: '#0F172A', rx: 32, opacity: 0.95, z: 4, name: 'Card' },
        { id: 'el-title', type: 'text', x: 100, y: 1360, text: '{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}', fontSize: 44, fontWeight: '900', fill: '#FFFFFF', z: 5, name: 'Title' },
        { id: 'el-rebate', type: 'text', x: 100, y: 1430, text: 'ASK ABOUT CURRENT EV PROGRAM ELIGIBILITY', fontSize: 24, fontWeight: '700', fill: '#38BDF8', z: 6, name: 'Rebate', approval_required: true },
        { id: 'el-price', type: 'text', x: 100, y: 1510, text: 'NET PRICE: {{vehicle.price}}', fontSize: 40, fontWeight: '900', fill: '#34D399', z: 7, name: 'Price' },
        { id: 'el-btn', type: 'shape', shapeType: 'rect', x: 100, y: 1620, width: 880, height: 100, fill: '#06B6D4', rx: 20, opacity: 1, z: 8, name: 'Button' },
        { id: 'el-btn-txt', type: 'text', x: 340, y: 1655, text: 'EXPLORE EV OFFERS', fontSize: 26, fontWeight: '800', fill: '#FFFFFF', z: 9, name: 'Button Text' }
      ]
    }
  }
};

const STUDIO_FORMAT_PURPOSES = {
  square:['Instagram New Arrival Post','NEW ARRIVAL','Introduce a connected vehicle with room for verified details.'],
  portrait:['Instagram Inventory Spotlight','VEHICLE SPOTLIGHT','A portrait feed composition built around a full-height vehicle image.'],
  story:['Instagram Story Event','THIS WEEKEND','Story-safe campaign content with clear top and bottom control zones.'],
  tiktok:['TikTok Walkaround Cover','VEHICLE WALKAROUND','A vertical cover for short-form inventory video.'],
  landscape:['Facebook Weekend Event','WEEKEND EVENT','A wide event post with a strong offer area and action.'],
  facebook_post:['Facebook Trade-In Post','VALUE YOUR TRADE','A feed post for an appraisal campaign.'],
  facebook_story:['Facebook Story New Arrival','JUST ARRIVED','Vertical arrival creative with story-safe spacing.'],
  linkedin:['LinkedIn Team Spotlight','MEET THE TEAM','Professional dealership and employee storytelling.'],
  x_landscape:['X Dealership Update','DEALERSHIP UPDATE','Fast, concise announcement creative for X.'],
  youtube:['YouTube Vehicle Review Thumbnail','FULL REVIEW','High-contrast thumbnail typography and image framing.'],
  pinterest:['Pinterest Vehicle Buying Guide','BUYING GUIDE','A tall, saveable guide cover with room for a topic and brand.'],
  marketplace:['Marketplace Vehicle Listing','AVAILABLE NOW','Listing-first vehicle composition for marketplace browsing.'],
  email_hero:['Email Inventory Campaign Hero','EXPLORE INVENTORY','Email-safe headline, image and call-to-action hierarchy.'],
  website_banner:['Website Promotion Banner','CURRENT HIGHLIGHT','Responsive banner copy with a wide photographic zone.'],
  display_300x250:['Display Ad · Inventory','SHOP INVENTORY','Compact rectangle campaign creative.'],
  display_728x90:['Leaderboard Ad · Event','VIEW THE EVENT','Single-line wide banner with compact action.'],
  display_160x600:['Skyscraper Ad · Vehicle','FEATURED VEHICLE','Tall display composition for inventory promotion.'],
  letterhead:['Dealership Letterhead','DEALERSHIP NAME','Print-ready correspondence header and contact footer.'],
  presentation:['Dealership Presentation Cover','DEALERSHIP PRESENTATION','A widescreen title slide for internal or customer presentations.'],
  business_card:['Sales Team Business Card','YOUR NAME','Role, dealership and contact information layout.'],
  postcard:['Sales Event Postcard','YOU ARE INVITED','A print postcard front with a campaign message and action.'],
  flyer:['Dealership Event Flyer','UPCOMING EVENT','Letter-size print layout with headline, details and contact area.'],
  brochure:['Dealership Tri-fold Brochure','EXPLORE OUR DEALERSHIP','Three-panel print composition with services and contact details.']
};

Object.entries(STUDIO_SOCIAL_FORMATS).forEach(([formatKey, format], index) => {
  const print = format.channel === 'print' || ['letterhead','business_card','postcard','flyer','brochure'].includes(formatKey);
  const purpose = STUDIO_FORMAT_PURPOSES[formatKey] || [`${format.label} Campaign`,'CAMPAIGN','Editable campaign layout.'];
  const key = `social_ready_${formatKey}`;
  const setIndex = index % STUDIO_DESIGN_SETS.length;
  const set = STUDIO_DESIGN_SETS[setIndex];
  const scene = studioDesignSetScene(formatKey, format, set, setIndex, purpose);
  STUDIO_TEMPLATES_CATALOG[key] = {
    template_key: key, name: purpose[0], category: print ? 'Print & stationery' : formatKey === 'presentation' ? 'Presentations' : formatKey.startsWith('display_') ? 'Display advertising' : 'Social media',
    desc: `${format.w}×${format.h} • ${purpose[2]}`, format_key: formatKey,
    width: format.w, height: format.h,
    preview: `linear-gradient(135deg,${set.background},${set.accent})`,
    scene
  };
});

function studioDesignSetScene(formatKey, format, set, setIndex, purpose) {
  const w = format.w, h = format.h, baseId = `set-${set.id}-${formatKey}`;
  const isLight = set.id === 'paper_ledger';
  const ink = isLight ? '#18181B' : '#FFFFFF', muted = isLight ? '#52525B' : set.secondary;
  const formatIndex = Math.max(0, Object.keys(STUDIO_SOCIAL_FORMATS).indexOf(formatKey));
  const photo = STUDIO_FREE_PHOTOS[(setIndex * 4 + formatIndex) % STUDIO_FREE_PHOTOS.length].url;
  let z = 0;
  const shape = (name, x, y, width, height, fill, options = {}) => ({ id:`${baseId}-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${++z}`, type:'shape', shapeType:options.shapeType || 'rect', name, x, y, width, height, fill, rx:options.rx || 0, opacity:options.opacity ?? 1, angle:options.angle || 0, z });
  const text = (name, value, x, y, width, height, fontSize, fill, options = {}) => ({ id:`${baseId}-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${++z}`, type:'text', name, text:value, x, y, width, height, fontFamily:options.fontFamily || set.font, fontSize, fontWeight:options.fontWeight || '700', fill, lineHeight:options.lineHeight || 1.08, charSpacing:options.charSpacing || 0, textAlign:options.textAlign || 'left', z });
  const image = (name, x, y, width, height, source = photo, options = {}) => ({ id:`${baseId}-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${++z}`, type:'vehicle-image', name, src:source, x, y, width, height, fit:options.fit || 'cover', opacity:options.opacity ?? 1, z });
  const page = (suffix, name, objects, background = set.background) => ({ id:`${baseId}-${suffix}`, name, format_key:formatKey, width:w, height:h, background:{ color:background }, objects:JSON.parse(JSON.stringify(objects)), duration_ms:5000, transition:'none' });
  let elements = [], pages = [];

  if (formatKey === 'business_card') {
    elements = [
      shape('Paper',0,0,w,h,'#FFFFFF'), shape('Brand panel',0,0,340,h,set.background), shape('Accent edge',325,0,15,h,set.accent),
      shape('Logo mark',70,70,92,92,set.accent,{ shapeType:setIndex % 2 ? 'circle' : 'rect', rx:18 }), text('Logo initial','M',92,85,50,58,46,'#FFFFFF',{ fontWeight:'900', textAlign:'center' }),
      text('Dealership','MARKETSYNC\nMOTORS',65,205,225,100,34,'#FFFFFF',{ fontWeight:'900', lineHeight:.9, charSpacing:35 }),
      text('Salesperson name','{{salesperson.name|JORDAN LEE}}',405,92,560,76,56,'#0F172A',{ fontWeight:'900' }), text('Role','SALES & LEASING CONSULTANT',408,174,520,42,23,set.accent,{ fontWeight:'900', charSpacing:45 }),
      shape('Name rule',408,238,180,6,set.accent), text('Contact details','{{salesperson.phone|555 555 5555}}\n{{salesperson.email|jordan@dealership.ca}}\n{{dealership.website|marketsync.ca}}',408,278,550,172,25,'#475569',{ fontFamily:'Manrope', fontWeight:'600', lineHeight:1.45 }),
      text('Address','123 Dealership Road · Toronto, ON',408,500,550,38,18,'#94A3B8',{ fontFamily:'Manrope', fontWeight:'600' })
    ];
    const back = [
      shape('Back paper',0,0,w,h,set.background), shape('Back accent',0,500,w,100,set.accent), shape('Back logo',420,120,210,210,set.accent,{ shapeType:setIndex % 2 ? 'circle' : 'rect', rx:36 }),
      text('Back initial','M',470,158,110,110,92,'#FFFFFF',{ fontWeight:'900', textAlign:'center' }), text('Back dealership','MARKETSYNC MOTORS',225,365,600,65,42,'#FFFFFF',{ fontWeight:'900', textAlign:'center', charSpacing:40 }),
      text('Back website','MARKETSYNC.CA',300,447,450,38,20,muted,{ fontFamily:'Manrope', fontWeight:'800', textAlign:'center', charSpacing:80 })
    ];
    pages = [page('front','Front',elements,'#FFFFFF'), page('back','Back',back,set.background)];
  } else if (formatKey === 'letterhead') {
    elements = [
      shape('Paper',0,0,w,h,'#FFFFFF'), shape('Top brand band',0,0,w,290,set.background), shape('Top accent',0,290,w,22,set.accent), shape('Logo mark',150,68,130,130,set.accent,{ rx:24 }),
      text('Logo initial','M',184,88,64,76,62,'#FFFFFF',{ fontWeight:'900', textAlign:'center' }), text('Dealership name','{{dealership.name|MARKETSYNC MOTORS}}',340,70,1050,100,82,'#FFFFFF',{ fontWeight:'900' }),
      text('Header contact','123 Dealership Road · Toronto, ON\n{{dealership.phone|555 555 5555}} · {{dealership.website|marketsync.ca}}',1540,74,820,110,38,'#E2E8F0',{ fontFamily:'Manrope', fontWeight:'600', textAlign:'right', lineHeight:1.35 }),
      text('Date','SEPTEMBER 3, 2026',190,475,650,62,42,set.accent,{ fontFamily:'Manrope', fontWeight:'900', charSpacing:60 }), text('Recipient','CUSTOMER NAME\nCompany or address\nToronto, Ontario',190,630,860,220,48,'#475569',{ fontFamily:'Manrope', fontWeight:'600', lineHeight:1.4 }),
      text('Letter subject','A CLEAR, PROFESSIONAL LETTER TITLE',190,980,2050,110,82,'#0F172A',{ fontWeight:'900' }), shape('Subject rule',190,1120,420,12,set.accent),
      text('Letter copy','Thank you for choosing our dealership. Use this editable letterhead for customer correspondence, purchase documentation, service communication and dealership announcements.',190,1220,2050,330,50,'#475569',{ fontFamily:'Manrope', fontWeight:'500', lineHeight:1.5 }),
      shape('Body line 1',190,1660,1950,10,'#E2E8F0',{ rx:5 }), shape('Body line 2',190,1775,2100,10,'#E2E8F0',{ rx:5 }), shape('Body line 3',190,1890,1800,10,'#E2E8F0',{ rx:5 }), shape('Body line 4',190,2005,2050,10,'#E2E8F0',{ rx:5 }),
      text('Signoff','Sincerely,\n\nYOUR NAME\nSales & Leasing Consultant',190,2300,900,330,46,'#334155',{ fontFamily:'Manrope', fontWeight:'600', lineHeight:1.35 }),
      shape('Footer rule',190,2980,2170,8,set.accent), text('Footer','MARKETSYNC MOTORS  ·  SALES  ·  SERVICE  ·  PARTS',190,3040,2170,62,38,'#64748B',{ fontFamily:'Manrope', fontWeight:'800', textAlign:'center', charSpacing:55 })
    ];
    pages = [page('front','Letterhead',elements,'#FFFFFF')];
  } else if (formatKey === 'presentation') {
    elements = [
      shape('Background',0,0,w,h,set.background), image('Cover photo',900,0,1020,h), shape('Photo overlay',900,0,1020,h,set.background,{ opacity:.18 }), shape('Accent bar',0,0,32,h,set.accent),
      text('Collection','MARKETSYNC MOTORS · 2026',115,112,650,48,26,set.accent,{ fontFamily:'Manrope', fontWeight:'900', charSpacing:75 }), text('Headline',purpose[1],115,255,700,250,94,ink,{ fontWeight:'900', lineHeight:.9 }),
      shape('Title rule',115,548,230,10,set.accent), text('Supporting copy','A polished, editable presentation for dealership updates, customer proposals and performance reviews.',115,610,650,175,32,muted,{ fontFamily:'Manrope', fontWeight:'500', lineHeight:1.35 }),
      text('Footer','{{dealership.website|marketsync.ca}}  ·  CONFIDENTIAL',115,952,690,38,20,muted,{ fontFamily:'Manrope', fontWeight:'800', charSpacing:55 })
    ];
    const content = [
      shape('Content background',0,0,w,h,'#F8FAFC'), shape('Content rail',0,0,36,h,set.accent), text('Content eyebrow','PERFORMANCE OVERVIEW',110,82,700,42,24,set.accent,{ fontFamily:'Manrope', fontWeight:'900', charSpacing:70 }), text('Content title','A CLEAR STORY,\nBEAUTIFULLY PRESENTED',110,150,1050,180,70,'#0F172A',{ fontWeight:'900', lineHeight:.95 }),
      text('Content intro','Add your key ideas, performance highlights and next steps. Every card and text layer remains editable.',110,365,1040,95,28,'#64748B',{ fontFamily:'Manrope', fontWeight:'500', lineHeight:1.35 }),
      ...[0,1,2].flatMap(index => [shape(`Metric card ${index + 1}`,110 + index*570,550,510,330,index === 1 ? set.background : '#FFFFFF',{ rx:26 }), text(`Metric value ${index + 1}`,['28%','142','4.9★'][index],150 + index*570,600,430,100,70,index === 1 ? '#FFFFFF' : '#0F172A',{ fontFamily:'Manrope', fontWeight:'900' }), text(`Metric label ${index + 1}`,['YEAR-OVER-YEAR GROWTH','VEHICLES DELIVERED','CUSTOMER RATING'][index],150 + index*570,725,420,80,23,index === 1 ? muted : '#64748B',{ fontFamily:'Manrope', fontWeight:'800', charSpacing:35 })])
    ];
    const closing = [shape('Closing background',0,0,w,h,set.background), shape('Closing accent',1450,-80,560,1240,set.accent,{ angle:8 }), text('Closing headline','THANK YOU',140,300,1100,190,120,'#FFFFFF',{ fontWeight:'900' }), shape('Closing rule',145,535,300,12,set.accent), text('Closing contact','{{dealership.name|MARKETSYNC MOTORS}}\n{{dealership.phone|555 555 5555}} · {{dealership.website|marketsync.ca}}',145,615,1000,130,32,muted,{ fontFamily:'Manrope', fontWeight:'600', lineHeight:1.4 })];
    pages = [page('front','Title slide',elements), page('content','Content slide',content,'#F8FAFC'), page('closing','Closing slide',closing)];
  } else if (formatKey === 'postcard') {
    elements = [
      shape('Background',0,0,w,h,set.background), image('Event photo',790,0,1010,h), shape('Photo shade',790,0,1010,h,'#000000',{ opacity:.14 }), shape('Accent slash',710,-80,160,1400,set.accent,{ angle:6 }),
      text('Event label','EXCLUSIVE SALES EVENT',100,105,570,45,27,set.accent,{ fontFamily:'Manrope', fontWeight:'900', charSpacing:65 }), text('Headline',purpose[1],100,250,590,250,105,'#FFFFFF',{ fontWeight:'900', lineHeight:.9 }), text('Event details','SATURDAY · SEPTEMBER 12\n9:00 AM — 6:00 PM',105,575,560,110,38,muted,{ fontFamily:'Manrope', fontWeight:'800', lineHeight:1.35 }),
      shape('Event CTA',100,820,480,105,set.accent,{ rx:24 }), text('Event CTA text','SAVE YOUR SPOT →',145,850,390,48,30,'#FFFFFF',{ fontFamily:'Manrope', fontWeight:'900', textAlign:'center' }), text('Event dealer','{{dealership.name|MARKETSYNC MOTORS}} · {{dealership.phone|555 555 5555}}',100,1055,590,50,23,muted,{ fontFamily:'Manrope', fontWeight:'700' })
    ];
    const back = [shape('Back paper',0,0,w,h,'#FFFFFF'), shape('Back accent',0,0,54,h,set.accent), text('Back headline','A BETTER WAY TO\nFIND YOUR NEXT VEHICLE.',115,130,700,170,64,'#0F172A',{ fontWeight:'900', lineHeight:.95 }), text('Back copy','Bring this card to the dealership and ask about current inventory, trade appraisal options and available financing.',115,365,650,165,30,'#64748B',{ fontFamily:'Manrope', fontWeight:'500', lineHeight:1.4 }), shape('Mail divider',900,110,5,940,'#E2E8F0'), shape('Stamp box',1510,110,180,150,'#F8FAFC',{ rx:12 }), text('Stamp','STAMP',1540,168,120,35,20,'#94A3B8',{ fontFamily:'Manrope', fontWeight:'800', textAlign:'center' }), ...[0,1,2,3].map(index => shape(`Address line ${index+1}`,1050,455+index*100,560,7,'#CBD5E1',{ rx:4 })), text('Back footer','{{dealership.name|MARKETSYNC MOTORS}} · {{dealership.website|marketsync.ca}}',115,1030,650,42,23,set.accent,{ fontFamily:'Manrope', fontWeight:'800' })];
    pages = [page('front','Front',elements), page('back','Mailing side',back,'#FFFFFF')];
  } else if (formatKey === 'flyer') {
    elements = [
      shape('Background',0,0,w,h,set.background), image('Hero photo',0,0,w,1540), shape('Hero shade',0,0,w,1540,'#07111F',{ opacity:.32 }), shape('Accent ribbon',0,1390,w,190,set.accent,{ angle:-2 }),
      text('Event label','DEALERSHIP EVENT · ONE DAY ONLY',175,150,1600,70,48,'#FFFFFF',{ fontFamily:'Manrope', fontWeight:'900', charSpacing:65 }), text('Headline',purpose[1],175,1660,2160,420,210,'#FFFFFF',{ fontWeight:'900', lineHeight:.88 }),
      text('Event copy','Explore featured inventory, appraisal opportunities and a better dealership experience.',185,2170,1850,200,74,muted,{ fontFamily:'Manrope', fontWeight:'500', lineHeight:1.35 }),
      shape('Date card',180,2520,970,330,isLight ? '#FFFFFF' : '#FFFFFF',{ rx:28 }), text('Date title','SATURDAY',245,2580,790,75,52,set.accent,{ fontFamily:'Manrope', fontWeight:'900', charSpacing:55 }), text('Date details','SEPTEMBER 12 · 9 AM—6 PM',245,2680,790,65,43,'#0F172A',{ fontFamily:'Manrope', fontWeight:'800' }),
      shape('Location card',1210,2520,1160,330,set.accent,{ rx:28 }), text('Location title','VISIT THE SHOWROOM',1280,2580,1000,78,52,'#FFFFFF',{ fontFamily:'Manrope', fontWeight:'900' }), text('Location details','123 DEALERSHIP ROAD\n{{dealership.phone|555 555 5555}}',1280,2680,1000,110,39,'#FFFFFF',{ fontFamily:'Manrope', fontWeight:'600', lineHeight:1.3 }),
      text('Flyer footer','{{dealership.name|MARKETSYNC MOTORS}}  ·  {{dealership.website|marketsync.ca}}',180,3120,2190,70,42,muted,{ fontFamily:'Manrope', fontWeight:'800', textAlign:'center', charSpacing:38 })
    ];
    pages = [page('front','Flyer',elements)];
  } else if (formatKey === 'brochure') {
    const third = Math.round(w / 3);
    elements = [
      shape('Brochure paper',0,0,w,h,'#FFFFFF'), image('Left panel photo',0,0,third,h), shape('Left shade',0,0,third,h,set.background,{ opacity:.48 }), shape('Centre panel',third,0,third,h,set.background), image('Right panel photo',third*2,0,w-third*2,h,photo,{ opacity:.9 }),
      shape('Fold one',third-3,0,6,h,'#CBD5E1'), shape('Fold two',third*2-3,0,6,h,'#CBD5E1'), text('Left label','WELCOME TO',95,140,third-190,70,42,set.accent,{ fontFamily:'Manrope', fontWeight:'900', charSpacing:80 }), text('Left title','A BETTER\nDEALERSHIP\nEXPERIENCE',95,300,third-190,430,116,'#FFFFFF',{ fontWeight:'900', lineHeight:.86 }),
      text('Centre label','WHY CHOOSE US',third+95,160,third-190,60,40,set.accent,{ fontFamily:'Manrope', fontWeight:'900', charSpacing:65 }), text('Centre title','SALES. SERVICE.\nEVERYTHING\nCONNECTED.',third+95,320,third-190,360,100,'#FFFFFF',{ fontWeight:'900', lineHeight:.9 }), text('Centre copy','Connected inventory\nTransparent trade appraisals\nCustomer-first service\nSimple financing options',third+95,850,third-190,410,52,muted,{ fontFamily:'Manrope', fontWeight:'600', lineHeight:1.55 }),
      shape('Centre CTA',third+95,1900,third-190,150,set.accent,{ rx:24 }), text('Centre CTA text','VISIT MARKETSYNC.CA',third+145,1948,third-290,55,38,'#FFFFFF',{ fontFamily:'Manrope', fontWeight:'900', textAlign:'center' }),
      shape('Right contact panel',third*2+75,1600,third-150,700,'#FFFFFF',{ rx:28, opacity:.94 }), text('Right title','COME SEE US',third*2+140,1690,third-280,90,58,'#0F172A',{ fontWeight:'900' }), text('Right contact','{{dealership.name|MARKETSYNC MOTORS}}\n123 Dealership Road\n{{dealership.phone|555 555 5555}}\n{{dealership.website|marketsync.ca}}',third*2+140,1840,third-280,330,40,'#475569',{ fontFamily:'Manrope', fontWeight:'600', lineHeight:1.45 })
    ];
    const back = elements.map(element => ({ ...element, id:`${element.id}-back` }));
    back.forEach(element => { if (element.name === 'Left title') element.text = 'OUR\nSTORY'; if (element.name === 'Centre title') element.text = 'YOUR NEXT\nVEHICLE\nSTARTS HERE.'; });
    pages = [page('front','Outside',elements,'#FFFFFF'), page('back','Inside',back,'#FFFFFF')];
  } else if (formatKey === 'display_728x90') {
    elements = [shape('Banner background',0,0,w,h,set.background), shape('Banner accent',0,0,16,h,set.accent), text('Banner dealer','MARKETSYNC MOTORS',34,18,180,24,13,set.accent,{ fontFamily:'Manrope', fontWeight:'900', charSpacing:35 }), text('Banner headline',purpose[1],230,17,300,42,24,'#FFFFFF',{ fontWeight:'900' }), shape('Banner CTA',565,14,145,62,set.accent,{ rx:12 }), text('Banner CTA text','VIEW EVENT →',578,34,120,22,13,'#FFFFFF',{ fontFamily:'Manrope', fontWeight:'900', textAlign:'center' })];
    pages = [page('front','Banner',elements)];
  } else if (formatKey === 'display_160x600') {
    elements = [shape('Skyscraper background',0,0,w,h,set.background), image('Skyscraper photo',0,0,w,250), shape('Skyscraper shade',0,0,w,250,'#07111F',{ opacity:.18 }), text('Skyscraper label','FEATURED',14,278,132,22,13,set.accent,{ fontFamily:'Manrope', fontWeight:'900', charSpacing:45 }), text('Skyscraper title','VEHICLE\nOF THE\nWEEK',14,318,132,112,28,'#FFFFFF',{ fontWeight:'900', lineHeight:.86 }), text('Skyscraper copy','Shop connected inventory today.',14,452,132,50,13,muted,{ fontFamily:'Manrope', fontWeight:'600', lineHeight:1.25 }), shape('Skyscraper CTA',14,520,132,54,set.accent,{ rx:12 }), text('Skyscraper CTA text','VIEW NOW',25,538,110,20,13,'#FFFFFF',{ fontFamily:'Manrope', fontWeight:'900', textAlign:'center' })];
    pages = [page('front','Skyscraper',elements)];
  } else if (formatKey === 'display_300x250') {
    elements = [shape('Ad background',0,0,w,h,set.background), image('Ad photo',0,0,w,112), shape('Ad shade',0,0,w,112,'#07111F',{ opacity:.15 }), text('Ad label','MARKETSYNC MOTORS',18,126,180,18,11,set.accent,{ fontFamily:'Manrope', fontWeight:'900', charSpacing:35 }), text('Ad headline',purpose[1],18,151,180,45,24,'#FFFFFF',{ fontWeight:'900' }), shape('Ad CTA',205,145,78,68,set.accent,{ rx:12 }), text('Ad CTA text','SHOP\nNOW',217,158,54,38,12,'#FFFFFF',{ fontFamily:'Manrope', fontWeight:'900', textAlign:'center', lineHeight:1 })];
    pages = [page('front','Display ad',elements)];
  } else {
    // Each design set gets a DISTINCT composition — not just a colour
    // swap. Screenshot regression: every card in a collection was
    // rendering the same layout with different palette, which read as
    // "super generic". Four layouts, one per set:
    //   0 Midnight Luxe   — editorial full-bleed photo, small type
    //                        top-left, oversized numeric mark
    //   1 Electric Current — bold: huge angled colour block, giant
    //                        display type running across it, photo
    //                        pushed to a corner tile
    //   2 Paper & Ledger  — classic centered typography, minimal
    //                        rules, small hairline photo strip
    //   3 Signal Red      — high impact: diagonal accent slash,
    //                        condensed display type, photo at 60%
    //                        with a corner cut
    const portrait = h > w * 1.15;
    const pad = Math.max(24, Math.round(Math.min(w,h) * .065));
    const variant = setIndex % 4;
    if (portrait) {
      if (variant === 0) {
        // Editorial full-bleed
        elements = [
          shape('Background',0,0,w,h,set.background),
          image('Full bleed',0,0,w,h),
          shape('Bottom scrim',0,Math.round(h*.62),w,Math.round(h*.38),set.background,{ opacity:.82 }),
          shape('Accent rule',pad,Math.round(h*.68),Math.round(w*.16),Math.max(6,Math.round(h*.008)),set.accent),
          text('Collection',purpose[1].split(' ')[0]+' EDITION',pad,Math.round(h*.7),Math.round(w*.7),Math.round(h*.04),Math.round(w*.022),set.accent,{fontFamily:'Manrope',fontWeight:'900',charSpacing:80}),
          text('Headline',purpose[1],pad,Math.round(h*.75),w-pad*2,Math.round(h*.14),Math.round(w*.09),'#FFFFFF',{fontWeight:'900',lineHeight:.88}),
          text('Sub',purpose[2],pad,Math.round(h*.9),w-pad*2,Math.round(h*.06),Math.round(w*.028),muted,{fontFamily:'Manrope',fontWeight:'500',lineHeight:1.3}),
        ];
      } else if (variant === 1) {
        // Bold angled colour block
        elements = [
          shape('Background',0,0,w,h,'#FFFFFF'),
          shape('Angled block',-Math.round(w*.1),0,Math.round(w*1.2),Math.round(h*.55),set.background,{angle:-6}),
          image('Corner photo',Math.round(w*.55),Math.round(h*.44),Math.round(w*.4),Math.round(h*.4),photo,{fit:'cover'}),
          text('Eyebrow','NEW · '+purpose[1].split(' ')[0],pad,Math.round(h*.08),Math.round(w*.55),Math.round(h*.05),Math.round(w*.028),set.accent,{fontFamily:'Manrope',fontWeight:'900',charSpacing:70}),
          text('Big headline',purpose[1],pad,Math.round(h*.15),Math.round(w*.9),Math.round(h*.35),Math.round(w*.13),'#FFFFFF',{fontWeight:'900',lineHeight:.85}),
          text('Sub',purpose[2],pad,Math.round(h*.86),w-pad*2,Math.round(h*.08),Math.round(w*.028),'#0F172A',{fontFamily:'Manrope',fontWeight:'500',lineHeight:1.3}),
          shape('CTA',pad,h-pad-Math.round(h*.06),Math.round(w*.45),Math.round(h*.06),set.accent,{rx:8}),
          text('CTA txt','EXPLORE →',pad+12,h-pad-Math.round(h*.045),Math.round(w*.42),Math.round(h*.04),Math.round(w*.02),'#FFFFFF',{fontFamily:'Manrope',fontWeight:'900',textAlign:'center'}),
        ];
      } else if (variant === 2) {
        // Classic centered
        elements = [
          shape('Background',0,0,w,h,set.background),
          shape('Top rule',Math.round(w*.35),Math.round(h*.14),Math.round(w*.3),Math.max(4,Math.round(h*.005)),set.accent),
          text('Collection','THE '+purpose[1].split(' ')[0]+' COLLECTION',pad,Math.round(h*.17),w-pad*2,Math.round(h*.04),Math.round(w*.022),set.accent,{fontFamily:'Manrope',fontWeight:'900',charSpacing:100,textAlign:'center'}),
          text('Serif headline',purpose[1],pad,Math.round(h*.24),w-pad*2,Math.round(h*.28),Math.round(w*.095),ink,{fontFamily:set.font,fontWeight:'900',lineHeight:.95,textAlign:'center'}),
          image('Centered photo',Math.round(w*.15),Math.round(h*.55),Math.round(w*.7),Math.round(h*.28),photo,{fit:'cover'}),
          shape('Bottom rule',Math.round(w*.4),Math.round(h*.87),Math.round(w*.2),Math.max(3,Math.round(h*.004)),set.accent),
          text('Sub',purpose[2],pad,Math.round(h*.9),w-pad*2,Math.round(h*.06),Math.round(w*.024),muted,{fontFamily:'Manrope',fontWeight:'500',lineHeight:1.35,textAlign:'center'}),
        ];
      } else {
        // High-impact diagonal
        elements = [
          shape('Background',0,0,w,h,'#FFFFFF'),
          image('Photo 60',0,0,w,Math.round(h*.62)),
          shape('Photo shade',0,0,w,Math.round(h*.62),'#000000',{opacity:.24}),
          shape('Diagonal slash',-Math.round(w*.05),Math.round(h*.55),Math.round(w*1.2),Math.round(h*.14),set.background,{angle:-4}),
          text('Slash text',purpose[1].split(' ')[0].toUpperCase(),pad,Math.round(h*.58),w-pad*2,Math.round(h*.07),Math.round(w*.055),'#FFFFFF',{fontFamily:'Manrope',fontWeight:'900',charSpacing:60}),
          text('Big display',purpose[1],pad,Math.round(h*.72),w-pad*2,Math.round(h*.18),Math.round(w*.115),ink,{fontFamily:'Manrope',fontWeight:'900',lineHeight:.85}),
          shape('CTA',pad,h-pad-Math.round(h*.06),Math.round(w*.5),Math.round(h*.06),set.accent,{rx:0}),
          text('CTA txt','SEE INVENTORY',pad+12,h-pad-Math.round(h*.045),Math.round(w*.47),Math.round(h*.04),Math.round(w*.022),'#0F172A',{fontFamily:'Manrope',fontWeight:'900',textAlign:'center',charSpacing:60}),
        ];
      }
    } else {
      // Landscape variants (same four styles, wider composition)
      if (variant === 0) {
        // Editorial: photo left 60%, text right
        elements = [
          shape('Background',0,0,w,h,set.background),
          image('Left photo',0,0,Math.round(w*.6),h),
          shape('Right panel',Math.round(w*.6),0,Math.round(w*.4),h,set.background),
          text('Eyebrow',purpose[1].split(' ')[0]+' EDITION',Math.round(w*.6)+pad,Math.round(h*.14),Math.round(w*.34),Math.round(h*.06),Math.round(w*.017),set.accent,{fontFamily:'Manrope',fontWeight:'900',charSpacing:80}),
          text('Headline',purpose[1],Math.round(w*.6)+pad,Math.round(h*.24),Math.round(w*.36),Math.round(h*.4),Math.round(w*.055),'#FFFFFF',{fontWeight:'900',lineHeight:.88}),
          shape('Rule',Math.round(w*.6)+pad,Math.round(h*.7),Math.round(w*.08),Math.max(3,Math.round(h*.008)),set.accent),
          text('Sub',purpose[2],Math.round(w*.6)+pad,Math.round(h*.76),Math.round(w*.36),Math.round(h*.15),Math.round(w*.019),muted,{fontFamily:'Manrope',fontWeight:'500',lineHeight:1.35}),
        ];
      } else if (variant === 1) {
        // Bold: full colour block with photo tile
        elements = [
          shape('Background',0,0,w,h,set.background),
          shape('Angled darker',0,0,Math.round(w*.65),h,'#000000',{opacity:.18,angle:-4}),
          image('Corner tile',Math.round(w*.68),Math.round(h*.1),Math.round(w*.27),Math.round(h*.8),photo,{fit:'cover'}),
          text('Eyebrow','NEW · '+purpose[1].split(' ')[0],pad,Math.round(h*.14),Math.round(w*.55),Math.round(h*.07),Math.round(w*.018),set.accent,{fontFamily:'Manrope',fontWeight:'900',charSpacing:70}),
          text('Big',purpose[1],pad,Math.round(h*.24),Math.round(w*.55),Math.round(h*.55),Math.round(w*.075),'#FFFFFF',{fontWeight:'900',lineHeight:.88}),
          shape('CTA',pad,h-pad-Math.round(h*.11),Math.round(w*.22),Math.round(h*.11),set.accent,{rx:8}),
          text('CTA txt','EXPLORE →',pad+12,h-pad-Math.round(h*.075),Math.round(w*.2),Math.round(h*.06),Math.round(w*.021),'#FFFFFF',{fontFamily:'Manrope',fontWeight:'900',textAlign:'center'}),
        ];
      } else if (variant === 2) {
        // Classic centered
        elements = [
          shape('Background',0,0,w,h,set.background),
          shape('Rule top',Math.round(w*.42),Math.round(h*.16),Math.round(w*.16),Math.max(3,Math.round(h*.006)),set.accent),
          text('Collection','THE '+purpose[1].split(' ')[0]+' COLLECTION',pad,Math.round(h*.21),w-pad*2,Math.round(h*.06),Math.round(w*.014),set.accent,{fontFamily:'Manrope',fontWeight:'900',charSpacing:100,textAlign:'center'}),
          text('Serif',purpose[1],pad,Math.round(h*.3),w-pad*2,Math.round(h*.28),Math.round(w*.055),ink,{fontFamily:set.font,fontWeight:'900',lineHeight:.95,textAlign:'center'}),
          image('Photo strip',Math.round(w*.2),Math.round(h*.62),Math.round(w*.6),Math.round(h*.2),photo,{fit:'cover'}),
          text('Sub',purpose[2],pad,Math.round(h*.86),w-pad*2,Math.round(h*.08),Math.round(w*.014),muted,{fontFamily:'Manrope',fontWeight:'500',lineHeight:1.35,textAlign:'center'}),
        ];
      } else {
        // High-impact diagonal
        elements = [
          shape('Background',0,0,w,h,'#FFFFFF'),
          image('Photo bleed',0,0,Math.round(w*.62),h),
          shape('Diagonal slash',Math.round(w*.5),-Math.round(h*.05),Math.round(w*.6),Math.round(h*1.2),set.background,{angle:8}),
          text('Slash big',purpose[1].split(' ')[0].toUpperCase(),Math.round(w*.62),Math.round(h*.32),Math.round(w*.36),Math.round(h*.15),Math.round(w*.06),'#FFFFFF',{fontFamily:'Manrope',fontWeight:'900',charSpacing:60}),
          text('Sub big',purpose[1],Math.round(w*.62),Math.round(h*.52),Math.round(w*.36),Math.round(h*.3),Math.round(w*.038),'#FFFFFF',{fontWeight:'900',lineHeight:.9}),
          shape('CTA',Math.round(w*.62),h-pad-Math.round(h*.1),Math.round(w*.28),Math.round(h*.1),set.accent,{rx:0}),
          text('CTA txt','SEE INVENTORY',Math.round(w*.62)+12,h-pad-Math.round(h*.07),Math.round(w*.26),Math.round(h*.06),Math.round(w*.018),'#0F172A',{fontFamily:'Manrope',fontWeight:'900',textAlign:'center',charSpacing:60}),
        ];
      }
    }
    pages = [page('front','Page 1',elements)];
  }

  return { version:4, format_key:formatKey, width:w, height:h, background:{ color:elements[0]?.fill || set.background }, elements, pages, metadata:{ design_set:set.id, editable:true, format_specific:true } };
}

// Four coordinated collections across every supported output size. This produces
// a useful starting library (92 editable templates) while keeping each collection
// visually consistent across social, stationery, presentations and digital ads.
Object.entries(STUDIO_SOCIAL_FORMATS).forEach(([formatKey, format]) => {
  const purpose = STUDIO_FORMAT_PURPOSES[formatKey];
  STUDIO_DESIGN_SETS.forEach((set, setIndex) => {
    const key = `design_set_${set.id}_${formatKey}`;
    const group = STUDIO_FORMAT_GROUPS.find(item => item.keys.includes(formatKey));
    const scene = studioDesignSetScene(formatKey, format, set, setIndex, purpose);
    STUDIO_TEMPLATES_CATALOG[key] = {
      template_key: key,
      name: `${purpose[0]} · ${set.name}`,
      category: group?.label || 'Design templates',
      design_set: set.id,
      desc: `${format.w}×${format.h} · ${set.description}`,
      format_key: formatKey,
      width: format.w,
      height: format.h,
      scene
    };
  });
});

// The professional template catalogue is generated as editable scene JSON by the
// shared document schema. It extends this existing picker instead of introducing
// another template system or flattened artwork format.
(window.msDesignStudioAutomotiveTemplates || []).forEach(template => {
  STUDIO_TEMPLATES_CATALOG[template.template_key] = {
    ...template,
    desc: `${template.category} · fully editable`,
    width: template.scene.width,
    height: template.scene.height
  };
});

async function loadStudioTemplateCatalog(force = false) {
  if (window.__studioTemplateCatalogLoaded && !force) return STUDIO_TEMPLATES_CATALOG;
  const response = await apiGetJson('/marketing/studio/templates');
  (response?.templates || []).forEach((template, index) => {
    const key = String(template.template_key || template.id || '').trim();
    if (!key || !template.scene || typeof template.scene !== 'object') return;
    const scene = JSON.parse(JSON.stringify(template.scene));
    (scene.elements || []).forEach(element => {
      if (element.type === 'vehicle-image' && !element.src) element.src = STUDIO_FREE_PHOTOS[index % STUDIO_FREE_PHOTOS.length].url;
    });
    scene.format_key = scene.format_key || template.format_key || 'square';
    // Dealership templates intentionally override a global template with the same
    // key. Otherwise keep the richer in-bundle scene rather than replacing it with
    // a lower-fidelity fallback copy returned by the API.
    if (!STUDIO_TEMPLATES_CATALOG[key] || template.dealership_id) {
      STUDIO_TEMPLATES_CATALOG[key] = {
        ...template,
        scene,
        template_key: key,
        template_id: template.id || null,
        desc: template.description || `${template.category || 'Design'} · fully editable`,
        width: Number(template.width || template.scene.width) || 1080,
        height: Number(template.height || template.scene.height) || 1080,
      };
    }
  });
  window.__studioTemplateCatalogLoaded = true;
  return STUDIO_TEMPLATES_CATALOG;
}
window.loadStudioTemplateCatalog = loadStudioTemplateCatalog;

function renderStudioSafeGuides(formatKey) {
  const format = STUDIO_SOCIAL_FORMATS[formatKey] || STUDIO_SOCIAL_FORMATS.square;
  const [top, right, bottom, left] = format.safe;
  const profileGuide = format.profileCrop ? `<div style="position:absolute;left:8%;right:8%;top:10%;aspect-ratio:1/1;border:2px dotted rgba(147,197,253,.9);border-radius:18px"><span style="position:absolute;right:8px;bottom:8px;background:rgba(15,23,42,.82);color:#bfdbfe;padding:5px 9px;border-radius:8px;font:700 18px/1 Arial">Profile preview</span></div>` : '';
  return `<div id="studio-safe-guides" class="absolute inset-0 pointer-events-none z-20"><div style="position:absolute;top:${top}%;right:${right}%;bottom:${bottom}%;left:${left}%;border:3px dashed rgba(96,165,250,.95);border-radius:18px;box-shadow:0 0 0 9999px rgba(15,23,42,.08)"><span style="position:absolute;left:10px;top:10px;background:rgba(15,23,42,.86);color:#dbeafe;padding:6px 10px;border-radius:8px;font:800 18px/1 Arial;letter-spacing:.04em">SAFE AREA · ${format.note}</span></div>${profileGuide}</div>`;
}

// Template cards are miniature renderings of the actual scene. A gradient plus a
// title made every template look like a placeholder; the picker needs to expose the
// real composition, photography, typography, and CTA hierarchy before insertion.
function templatePreviewGradient(tmpl) {
  const bg = tmpl.scene?.background?.color || '#0f172a';
  const fills = (tmpl.scene?.elements || [])
    .filter(e => e.type === 'shape' && e.fill && e.opacity !== 0 && e.fill !== bg);
  const accent = fills[0]?.fill || '#2563eb';
  const accent2 = fills.slice().reverse().find(e => e.fill !== accent)?.fill || accent;
  return `linear-gradient(135deg, ${bg}, ${accent} 58%, ${accent2})`;
}

function templatePreviewMarkup(tmpl) {
  const scene = tmpl.scene || {};
  const width = Number(scene.width || tmpl.width || 1080);
  const height = Number(scene.height || tmpl.height || 1080);
  // If a scene defines its first PAGE (multi-page templates like
  // business_card, letterhead, brochure) with distinct objects, use
  // that page's objects for the thumbnail — previously we always fell
  // through to scene.elements which for those cases was the FRONT
  // page's element set but rendered without the page background, so
  // every design_set template looked identical.
  const firstPage = Array.isArray(scene.pages) && scene.pages[0];
  const rawElements = firstPage && Array.isArray(firstPage.objects) && firstPage.objects.length
    ? firstPage.objects
    : (scene.elements || []);
  const elements = rawElements.slice().sort((a, b) => Number(a.z || 0) - Number(b.z || 0));
  const bgColor = firstPage?.background?.color || scene.background?.color || '#0f172a';
  const previewSamples = {
    'vehicle.year':'2026', 'vehicle.make':'Honda', 'vehicle.model':'CR-V', 'vehicle.trim':'Touring', 'vehicle.stock_number':'A1042', 'vehicle.price':'$38,995', 'vehicle.mileage':'24,800', 'vehicle.sale_price':'$36,995',
    'dealership.name':'MARKETSYNC MOTORS', 'dealership.phone':'(416) 555-0148', 'dealership.website':'marketsync.ca',
    'salesperson.name':'JORDAN LEE', 'salesperson.phone':'(416) 555-0198', 'salesperson.email':'jordan@marketsync.ca'
  };
  const previewText = value => String(value || '').replace(/\{\{\s*([^}|]+)(?:\|([^}]+))?\s*\}\}/g, (_, key, fallback) => previewSamples[String(key).trim()] || String(fallback || 'Your details').trim()).trim();
  // Palette hashed from the template key so every template shows a
  // distinct photo-placeholder gradient — no more identical maroon
  // bars across an entire design set.
  const key = String(tmpl.template_key || tmpl.id || '');
  let seed = 0; for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
  const palettes = [
    ['#1E293B','#334155'], ['#0F172A','#1E40AF'], ['#134E4A','#0E7490'],
    ['#7C2D12','#B91C1C'], ['#78350F','#B45309'], ['#4C1D95','#7C3AED'],
    ['#065F46','#059669'], ['#831843','#BE185D'], ['#374151','#111827'],
    ['#0C4A6E','#0284C7'], ['#3F0F52','#7E22CE'], ['#7C2D12','#EA580C'],
  ];
  const [phA, phB] = palettes[seed % palettes.length];
  const nodes = elements.map(element => {
    const left = `${(Number(element.x || 0) / width) * 100}%`;
    const top = `${(Number(element.y || 0) / height) * 100}%`;
    const w = `${(Number(element.width || width) / width) * 100}%`;
    const h = `${(Number(element.height || height) / height) * 100}%`;
    const transform = Number(element.angle || element.rotation || 0) ? `transform:rotate(${Number(element.angle || element.rotation)}deg);transform-origin:center;` : '';
    const base = `position:absolute;left:${left};top:${top};width:${w};height:${h};opacity:${element.opacity == null ? 1 : element.opacity};${transform}`;
    if (element.type === 'vehicle-image' || element.type === 'image') {
      const placeholder = `background:linear-gradient(135deg,${phA},${phB});`;
      if (!element.src) return `<div style="${base}${placeholder}"></div>`;
      // Wrap the img in a placeholder-backed div. If the img is still
      // loading (slow cellular = template preview grid = lots of imgs
      // racing), the gradient shows through so the layout composition
      // is visible immediately. When the img loads it covers the
      // gradient; when it fails, onerror hides the img and the
      // gradient stays. Either way the tile has real structure, not
      // a blank strip.
      return `<div style="${base}${placeholder}"><img src="${escS(element.src)}" alt="" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${element.fit === 'contain' ? 'contain' : 'cover'};" onerror="this.style.display='none'"></div>`;
    }
    if (element.type === 'shape') { const background = element.gradient?.colors?.length > 1 ? `linear-gradient(135deg,${element.gradient.colors.join(',')})` : (element.fill || '#2563eb'); const radius = element.shapeType === 'circle' ? 50 : Math.min(50, Number(element.rx || 0) / Math.max(1, Number(element.width || width)) * 100); return `<div style="${base}background:${escS(background)};border-radius:${radius}%;"></div>`; }
    if (element.type === 'text') { const fontSize = Number(element.fontSize || 24); const previewPx = Math.max(4, Math.min(30, fontSize * .18)); const previewCqw = Math.max(.6, fontSize / width * 100); return `<div style="${base}color:${escS(element.fill || '#fff')};font-size:${previewPx}px;font-size:${previewCqw}cqw;font-weight:${escS(element.fontWeight || '700')};font-family:'${escS(element.fontFamily || 'Manrope')}',Manrope,Arial,sans-serif;line-height:${Number(element.lineHeight || 1.05)};letter-spacing:${Number(element.charSpacing || 0) / 1000}em;text-align:${escS(element.textAlign || 'left')};white-space:pre-line;overflow:hidden;">${escS(previewText(element.text))}</div>`; }
    return '';
  }).join('');
  return `<div class="studio-template-preview" style="aspect-ratio:${width}/${height};background:${escS(bgColor)};">${nodes}</div>`;
}

function previewStudioTemplate(templateKey) {
  const template = STUDIO_TEMPLATES_CATALOG[templateKey];
  if (!template) return;
  const encodedKey = encodeURIComponent(templateKey);
  const format = STUDIO_SOCIAL_FORMATS[template.format_key];
  openStudioSheet(`Preview · ${template.name}`, `<div class="grid md:grid-cols-[minmax(0,1fr)_240px] gap-5"><div class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950">${templatePreviewMarkup(template)}</div><div class="space-y-4"><div><div class="text-[10px] uppercase tracking-wider font-black text-indigo-600">Editable template</div><h3 class="mt-1 text-lg font-black">${escS(template.name)}</h3><p class="mt-2 text-sm text-slate-500 dark:text-slate-400">${escS(template.desc || template.category || 'Design Studio template')}</p></div><div class="rounded-xl bg-slate-100 dark:bg-slate-950 p-3 text-xs text-slate-600 dark:text-slate-300"><div class="font-black">${Number(template.width || template.scene?.width) || 1080} × ${Number(template.height || template.scene?.height) || 1080}</div><div class="mt-1">${escS(format?.label || template.format_key || 'Custom format')}</div><div class="mt-1">All scene elements remain editable after use.</div></div><button type="button" onclick="applyStudioTemplate(decodeURIComponent('${encodedKey}'))" class="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 text-sm font-black">Use this template</button><button type="button" onclick="document.getElementById('studio-action-sheet')?.remove()" class="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-bold">Cancel</button></div></div>`);
}
window.previewStudioTemplate = previewStudioTemplate;

async function applyStudioTemplate(templateKey) {
  document.getElementById('studio-action-sheet')?.remove();
  await loadStudioTemplate(templateKey);
}
window.applyStudioTemplate = applyStudioTemplate;

function studioHomeTemplateCards(limit = 36) {
  const query = String(window.__studioHomeTemplateQuery || '').trim().toLowerCase();
  const setFilter = window.__studioHomeDesignSet || 'all';
  const formatFilter = window.__studioHomeFormat || 'all';
  const templates = Object.values(STUDIO_TEMPLATES_CATALOG).filter(template => {
    const searchable = `${template.name || ''} ${template.desc || ''} ${template.category || ''} ${template.design_set || ''}`.toLowerCase();
    return (!query || searchable.includes(query)) && (setFilter === 'all' || template.design_set === setFilter) && (formatFilter === 'all' || template.format_key === formatFilter);
  });
  const cards = templates.slice(0, limit).map(template => {
    const key = encodeURIComponent(template.template_key);
    const format = STUDIO_SOCIAL_FORMATS[template.format_key];
    return `<button type="button" onclick="startStudioTemplate(decodeURIComponent('${key}'))" class="studio-home-template-card group min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-xl dark:border-white/10 dark:bg-slate-900"><div class="relative flex min-h-40 items-center justify-center overflow-hidden bg-slate-100 p-3 dark:bg-slate-950">${templatePreviewMarkup(template)}<span class="absolute left-2 top-2 rounded-lg bg-slate-950/80 px-2 py-1 text-[9px] font-black text-white">${Number(template.width || template.scene?.width)} × ${Number(template.height || template.scene?.height)}</span>${template.scene?.pages?.length > 1 ? `<span class="absolute right-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-[9px] font-black text-slate-800">${template.scene.pages.length} pages</span>` : ''}</div><div class="p-3"><div class="truncate text-sm font-black text-slate-950 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-300">${escS(template.name)}</div><div class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">${escS(format?.label || template.category || 'Editable design')}</div></div></button>`;
  }).join('');
  if (cards) return cards;
  return '<div class="col-span-full rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700"><h3 class="font-black text-slate-900 dark:text-white">No matching templates</h3><p class="mt-1 text-sm text-slate-500">Try another search, collection or output size.</p><button type="button" onclick="studioResetHomeTemplateFilters()" class="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white">Show all templates</button></div>';
}

function renderStudioHomeTemplateGrid() {
  const host = document.getElementById('studio-home-template-grid');
  if (host) host.innerHTML = studioHomeTemplateCards();
  document.querySelectorAll('[data-studio-home-set]').forEach(button => button.setAttribute('aria-pressed', String((window.__studioHomeDesignSet || 'all') === button.dataset.studioHomeSet)));
  document.querySelectorAll('[data-studio-home-format]').forEach(button => button.setAttribute('aria-pressed', String((window.__studioHomeFormat || 'all') === button.dataset.studioHomeFormat)));
}

function renderStudioHomeFormatShortcuts() {
  // Mobile UX: the previous 2-column grid stacked ~50 format tiles
  // vertically, forcing endless scrolling on phones. The
  // studio-scroll-row class flips this to a horizontal swipe row on
  // ≤768px viewports (see marketsync-theme.css) so each category
  // (Digital marketing, Social, etc.) fits in one thumb-swipe.
  return STUDIO_FORMAT_GROUPS.map(group => `<section class="space-y-2"><div><h3 class="text-sm font-black text-slate-950 dark:text-white">${escS(group.label)}</h3><p class="text-xs text-slate-500 dark:text-slate-400">${escS(group.description)}</p></div><div class="studio-scroll-row grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">${group.keys.map(key => { const format = STUDIO_SOCIAL_FORMATS[key]; return `<button type="button" onclick="startStudioBlankDesign('${key}')" class="studio-scroll-row-item group rounded-2xl border border-slate-200/80 bg-white/80 p-3 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-md dark:border-white/10 dark:bg-slate-900/75"><span class="mb-3 flex h-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white shadow-sm"><span class="block rounded border border-white/70" style="width:${Math.max(12, Math.min(34, 34 * format.w / Math.max(format.w, format.h)))}px;height:${Math.max(12, Math.min(34, 34 * format.h / Math.max(format.w, format.h)))}px"></span></span><b class="block text-xs leading-tight text-slate-900 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-300">${escS(format.label)}</b><span class="mt-1 block text-[10px] text-slate-500">${format.w} × ${format.h}</span></button>`; }).join('')}</div></section>`).join('');
}

function renderStudioHomeDesignSets() {
  return STUDIO_DESIGN_SETS.map(set => {
    const template = STUDIO_TEMPLATES_CATALOG[`design_set_${set.id}_business_card`] || STUDIO_TEMPLATES_CATALOG[`design_set_${set.id}_square`];
    return `<button type="button" data-studio-home-set="${set.id}" aria-pressed="false" onclick="studioFilterHomeDesignSet('${set.id}')" class="studio-home-set-card group overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-xl dark:border-white/10 dark:bg-slate-900"><div class="relative h-48 overflow-hidden p-4" style="background:linear-gradient(135deg,${set.background},${set.accent})"><div class="absolute -right-10 -top-12 h-40 w-40 rotate-12 rounded-[36px] bg-white/15"></div><div class="relative mx-auto max-w-[82%] overflow-hidden rounded-xl border border-white/20 shadow-2xl">${templatePreviewMarkup(template)}</div></div><div class="p-4"><div class="text-[10px] font-black uppercase tracking-[.16em] text-indigo-600 dark:text-indigo-300">${escS(set.eyebrow)}</div><h3 class="mt-1 text-lg font-black text-slate-950 dark:text-white">${escS(set.name)}</h3><p class="mt-1 text-xs text-slate-500 dark:text-slate-400">${escS(set.description)}</p><div class="mt-3 text-xs font-black text-indigo-700 dark:text-indigo-300">${Object.keys(STUDIO_SOCIAL_FORMATS).length} matching sizes →</div></div></button>`;
  }).join('');
}

function renderStudioHomeHtml() {
  window.__studioHomeDesignSet = window.__studioHomeDesignSet || 'all';
  window.__studioHomeFormat = window.__studioHomeFormat || 'all';
  return `<!-- Inline cache-proof swipe rules for the studio home. Previously
       these lived only in marketsync-theme.css (cache risk) and in the
       EDITOR workspace inline block (never reached the HOME page). That
       left mobile users on the studio home still seeing a stacked
       2-column grid, exactly what the screenshot showed. Ship the
       .studio-scroll-row rules INSIDE the home HTML so a stale CSS
       cache can't hide them. -->
    <style data-studio-home-inline="1">
      @media (max-width:768px){
        .studio-scroll-row{display:flex!important;grid-template-columns:none!important;overflow-x:auto;overflow-y:hidden;gap:.75rem!important;padding-bottom:.5rem;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory;scrollbar-width:none;margin-left:-1rem;margin-right:-1rem;padding-left:1rem;padding-right:1rem}
        .studio-scroll-row::-webkit-scrollbar{display:none}
        .studio-scroll-row>*{flex:0 0 auto;width:62vw;max-width:240px;scroll-snap-align:start}
        .studio-scroll-row>.studio-home-set-card{width:78vw;max-width:320px}
        .studio-scroll-row>.studio-home-template-card{width:52vw;max-width:220px}
        /* Home hero shrinks on phones — the 3xl → 5xl heading and
           the search input still fit without shoving the format
           shortcuts down 3 screens. */
        #ms-studio-master-modal .studio-home-hero{padding:1.25rem 1rem!important}
        #ms-studio-master-modal .studio-home-hero h1{font-size:1.5rem!important;line-height:1.1!important}
        #ms-studio-master-modal .studio-home-hero p{font-size:.8125rem!important}
        #ms-studio-master-modal .studio-home main.studio-home > div{padding:1rem!important;gap:1.5rem!important}
      }
    </style><header class="flex h-16 flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90 sm:px-6"><div class="flex min-w-0 items-center gap-3"><button type="button" onclick="closeMarketSyncStudio()" class="rounded-xl px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">← Marketing</button><div class="h-7 w-px bg-slate-200 dark:bg-white/10"></div><div class="min-w-0"><div class="truncate text-lg font-black text-slate-950 dark:text-white">Design Studio</div><div class="hidden text-xs text-slate-500 sm:block">Projects, templates and complete campaign sets</div></div></div><button type="button" onclick="openStudioSizePicker('new')" class="whitespace-nowrap rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500">+ Create design</button></header><main class="studio-home flex-1 overflow-y-auto bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white"><div class="mx-auto max-w-[1560px] space-y-10 px-4 py-6 sm:px-6 lg:px-8"><section class="studio-home-hero relative overflow-hidden rounded-[32px] px-5 py-10 shadow-2xl sm:px-10 sm:py-14"><div class="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/15 blur-3xl"></div><div class="relative max-w-3xl"><div class="studio-home-hero-eyebrow text-xs font-black uppercase tracking-[.2em]">MarketSync creative home</div><h1 class="mt-3 text-3xl font-black tracking-tight sm:text-5xl">What will you design today?</h1><p class="studio-home-hero-copy mt-3 max-w-2xl text-sm sm:text-base">Start with an exact output size, explore coordinated design sets, or reopen a saved project. Every template stays fully editable.</p><label class="mt-6 flex max-w-2xl items-center gap-3 rounded-2xl bg-white px-4 py-3 text-slate-900 shadow-xl"><svg class="h-5 w-5 flex-none text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" oninput="studioFilterHomeTemplates(this.value)" placeholder="Search business cards, Instagram posts, letterhead…" class="min-w-0 flex-1 border-0 bg-transparent text-base outline-none placeholder:text-slate-400"></label></div></section><section class="space-y-5"><div class="flex items-end justify-between gap-3"><div><div class="text-xs font-black uppercase tracking-[.16em] text-indigo-600 dark:text-indigo-300">Choose a format</div><h2 class="mt-1 text-2xl font-black">Create at the right size</h2></div><button type="button" onclick="openStudioSizePicker('new')" class="text-sm font-black text-indigo-700 dark:text-indigo-300">View every size →</button></div>${renderStudioHomeFormatShortcuts()}</section><section class="space-y-4"><div><div class="text-xs font-black uppercase tracking-[.16em] text-indigo-600 dark:text-indigo-300">Coordinated collections</div><h2 class="mt-1 text-2xl font-black">Design sets</h2><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Carry one polished look across social posts, stationery, presentations and ads.</p></div><div class="studio-scroll-row grid gap-4 sm:grid-cols-2 xl:grid-cols-4">${renderStudioHomeDesignSets()}</div></section><section class="space-y-4" id="studio-home-templates"><div class="flex flex-wrap items-end justify-between gap-3"><div><div class="text-xs font-black uppercase tracking-[.16em] text-indigo-600 dark:text-indigo-300">Editable starting points</div><h2 class="mt-1 text-2xl font-black">Templates for you</h2></div><button type="button" onclick="studioResetHomeTemplateFilters()" class="rounded-xl border border-slate-300 px-3 py-2 text-xs font-black dark:border-slate-700">Clear filters</button></div><div class="flex gap-2 overflow-x-auto pb-1"><button type="button" data-studio-home-format="all" onclick="studioFilterHomeFormat('all')" class="whitespace-nowrap rounded-full border border-slate-300 px-3 py-2 text-xs font-black dark:border-slate-700">All sizes</button>${STUDIO_FORMAT_GROUPS.flatMap(group => group.keys).map(key => `<button type="button" data-studio-home-format="${key}" onclick="studioFilterHomeFormat('${key}')" class="whitespace-nowrap rounded-full border border-slate-300 px-3 py-2 text-xs font-black dark:border-slate-700">${escS(STUDIO_SOCIAL_FORMATS[key].label)}</button>`).join('')}</div><div id="studio-home-template-grid" class="studio-scroll-row grid items-start grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">${studioHomeTemplateCards()}</div></section><section class="space-y-4"><div class="flex flex-wrap items-end justify-between gap-3"><div><div class="text-xs font-black uppercase tracking-[.16em] text-indigo-600 dark:text-indigo-300">Your work</div><h2 class="mt-1 text-2xl font-black">Projects & folders</h2></div><div class="flex gap-2"><button type="button" onclick="createStudioHomeFolder()" class="rounded-xl border border-slate-300 px-3 py-2 text-xs font-black dark:border-slate-700">+ New folder</button><button type="button" onclick="openStudioSizePicker('new')" class="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white">+ New design</button></div></div><div id="studio-home-folders" class="flex gap-2 overflow-x-auto pb-1"><div class="text-sm text-slate-500">Loading folders…</div></div><div id="studio-home-projects" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"><div class="col-span-full py-8 text-center text-sm text-slate-500">Loading projects…</div></div></section></div></main>`;
}

async function loadStudioHomeProjects() {
  try {
    const [designResponse, folderResponse] = await Promise.all([apiGetJson('/marketing/studio/designs'), apiGetJson('/marketing/studio/folders')]);
    window.__studioHomeDesigns = designResponse?.designs || [];
    window.__studioHomeFolders = folderResponse?.folders || [];
  } catch (error) {
    window.__studioHomeDesigns = [];
    window.__studioHomeFolders = [];
    const host = document.getElementById('studio-home-projects');
    if (host) host.innerHTML = `<div class="col-span-full rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">${escS(error.message || 'Projects could not load.')}</div>`;
  }
  renderStudioHomeProjects();
}

function renderStudioHomeProjects() {
  const folderHost = document.getElementById('studio-home-folders');
  const projectHost = document.getElementById('studio-home-projects');
  if (!folderHost || !projectHost) return;
  const folders = window.__studioHomeFolders || [];
  const designs = window.__studioHomeDesigns || [];
  const activeFolder = window.__studioHomeFolder || 'all';
  const folderButton = (id, label, count) => `<button type="button" onclick="studioSetHomeFolder('${id}')" aria-pressed="${activeFolder === id}" class="flex min-w-40 items-center justify-between gap-3 whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-black shadow-sm aria-pressed:border-indigo-500 aria-pressed:bg-indigo-50 aria-pressed:text-indigo-800 dark:border-white/10 dark:bg-slate-900 dark:aria-pressed:bg-indigo-500/15 dark:aria-pressed:text-indigo-200"><span>${escS(label)}</span><span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-white/10 dark:text-slate-300">${count}</span></button>`;
  folderHost.innerHTML = folderButton('all', 'All projects', designs.length) + folderButton('unfiled', 'Unfiled', designs.filter(item => !item.folder_id).length) + folders.map(folder => folderButton(folder.id, folder.name, designs.filter(item => item.folder_id === folder.id).length)).join('');
  const visible = designs.filter(design => activeFolder === 'all' || (activeFolder === 'unfiled' ? !design.folder_id : design.folder_id === activeFolder));
  projectHost.innerHTML = visible.length ? visible.map(design => `<button type="button" onclick="openMarketSyncStudio('${escS(design.id)}', { bypassHome: true })" class="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-lg dark:border-white/10 dark:bg-slate-900"><div class="overflow-hidden bg-slate-100 dark:bg-slate-950">${studioProjectPreviewMarkup(design)}</div><div class="p-3"><div class="truncate text-sm font-black text-slate-950 dark:text-white">${escS(design.name || 'Untitled Design')}</div><div class="mt-1 text-xs text-slate-500">${Number(design.width) || 1080} × ${Number(design.height) || 1080} · ${escS(design.status || 'draft')}</div></div></button>`).join('') : '<div class="col-span-full rounded-3xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700"><h3 class="font-black text-slate-900 dark:text-white">No projects in this folder</h3><p class="mt-1 text-sm text-slate-500">Choose a size or template to create the first one.</p><button type="button" onclick="openStudioSizePicker(\'new\')" class="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white">Create design</button></div>';
}

async function renderStudioHome(modal) {
  window.__studioHomeFolder = 'all';
  modal.innerHTML = renderStudioHomeHtml();
  renderStudioHomeTemplateGrid();
  await loadStudioHomeProjects();
}

function openStudioSizePicker(mode = 'new') {
  const groups = STUDIO_FORMAT_GROUPS.map(group => `<section class="space-y-2"><div><h3 class="font-black">${escS(group.label)}</h3><p class="text-xs text-slate-500 dark:text-slate-400">${escS(group.description)}</p></div><div class="studio-scroll-row grid gap-2 sm:grid-cols-2 lg:grid-cols-3">${group.keys.map(key => { const format = STUDIO_SOCIAL_FORMATS[key]; return `<button type="button" onclick="studioChooseFormat('${key}','${mode}')" class="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left hover:border-indigo-500 hover:bg-indigo-50 dark:border-slate-700 dark:hover:bg-indigo-500/10"><span class="flex h-12 w-14 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500"><span class="block rounded-sm border border-white/80" style="width:${Math.max(10, Math.min(28, 28 * format.w / Math.max(format.w, format.h)))}px;height:${Math.max(10, Math.min(28, 28 * format.h / Math.max(format.w, format.h)))}px"></span></span><span class="min-w-0"><b class="block text-sm leading-tight">${escS(format.label)}</b><span class="mt-1 block text-xs text-slate-500">${format.w} × ${format.h}</span></span></button>`; }).join('')}</div></section>`).join('');
  const custom = mode === 'new' ? `<section class="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><h3 class="font-black">Custom size</h3><form onsubmit="event.preventDefault();startStudioCustomDesign()" class="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2"><label class="text-xs font-bold text-slate-500">Width (px)<input id="studio-custom-width" type="number" min="100" max="8000" value="1080" class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"></label><span class="pb-2 font-black text-slate-400">×</span><label class="text-xs font-bold text-slate-500">Height (px)<input id="studio-custom-height" type="number" min="100" max="8000" value="1080" class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"></label><button class="col-span-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white dark:bg-white dark:text-slate-950">Create custom design</button></form></section>` : '';
  openStudioSheet(mode === 'resize' ? 'Change design size' : 'Choose a design size', `<div class="space-y-6"><p class="text-sm text-slate-600 dark:text-slate-300">${mode === 'resize' ? 'The current design will be reflowed to the selected dimensions. The Templates panel will then show only exact matches.' : 'Choose the final output first. The editor and its template library will open at these exact dimensions.'}</p>${groups}${custom}</div>`);
}

async function studioChooseFormat(formatKey, mode = 'new') {
  document.getElementById('studio-action-sheet')?.remove();
  if (mode === 'resize') { await changeStudioFormat(formatKey); setStudioTool('templates'); return; }
  await startStudioBlankDesign(formatKey);
}

async function startStudioBlankDesign(formatKey) {
  document.getElementById('studio-action-sheet')?.remove();
  return window.openMarketSyncStudio(null, { formatKey, bypassHome: true, tab: 'templates' });
}

async function startStudioCustomDesign() {
  const width = Math.max(100, Math.min(8000, Number(document.getElementById('studio-custom-width')?.value) || 1080));
  const height = Math.max(100, Math.min(8000, Number(document.getElementById('studio-custom-height')?.value) || 1080));
  document.getElementById('studio-action-sheet')?.remove();
  return window.openMarketSyncStudio(null, { formatKey: 'custom', customWidth: width, customHeight: height, bypassHome: true, tab: 'templates' });
}

async function startStudioTemplate(templateKey) {
  const template = STUDIO_TEMPLATES_CATALOG[templateKey];
  if (!template) return;
  return window.openMarketSyncStudio(null, { formatKey: template.format_key, templateKey, bypassHome: true, tab: 'templates' });
}

function studioFilterHomeTemplates(value) { window.__studioHomeTemplateQuery = value || ''; renderStudioHomeTemplateGrid(); document.getElementById('studio-home-templates')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function studioFilterHomeDesignSet(value) { window.__studioHomeDesignSet = window.__studioHomeDesignSet === value ? 'all' : value; renderStudioHomeTemplateGrid(); document.getElementById('studio-home-templates')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function studioFilterHomeFormat(value) { window.__studioHomeFormat = value || 'all'; renderStudioHomeTemplateGrid(); }
function studioResetHomeTemplateFilters() { window.__studioHomeTemplateQuery = ''; window.__studioHomeDesignSet = 'all'; window.__studioHomeFormat = 'all'; const search = document.querySelector('.studio-home input[type="search"]'); if (search) search.value = ''; renderStudioHomeTemplateGrid(); }
function studioSetHomeFolder(folderId) { window.__studioHomeFolder = folderId || 'all'; renderStudioHomeProjects(); }
async function createStudioHomeFolder() { const name = window.prompt('New folder name')?.trim(); if (!name) return; try { const response = await apiSendJson('/marketing/studio/folders', 'POST', { name, color: '#4F46E5' }); window.__studioHomeFolders = [...(window.__studioHomeFolders || []), response.folder]; window.__studioHomeFolder = response.folder.id; renderStudioHomeProjects(); if (typeof showToast === 'function') showToast(`${response.folder.name} folder created`, 'success'); } catch (error) { if (typeof showToast === 'function') showToast(error.message || 'Folder could not be created.', 'error'); } }

Object.assign(window, { openStudioSizePicker, studioChooseFormat, startStudioBlankDesign, startStudioCustomDesign, startStudioTemplate, studioFilterHomeTemplates, studioFilterHomeDesignSet, studioFilterHomeFormat, studioResetHomeTemplateFilters, studioSetHomeFolder, createStudioHomeFolder });

function studioTemplateSize(template) {
  return { width: Number(template?.scene?.width || template?.width) || 1080, height: Number(template?.scene?.height || template?.height) || 1080 };
}

function studioActiveCanvasSize() {
  const adapter = window.__studioAdapter;
  const activePage = adapter?.currentScene?.pages?.find(page => page.id === adapter.activePageId);
  const scene = activePage || adapter?.currentScene || window.__studioInitialScene || {};
  return { width: Number(scene.width) || 1080, height: Number(scene.height) || 1080, formatKey: scene.format_key || adapter?.currentScene?.format_key || 'square' };
}

function studioTemplateFitsCanvas(template, canvas = studioActiveCanvasSize()) {
  const size = studioTemplateSize(template);
  return size.width === canvas.width && size.height === canvas.height;
}

function renderStudioTemplateCards(_filter = window.__studioTemplateFormat || 'canvas', category = window.__studioTemplateCategory || 'all', limit = window.__studioTemplateLimit || 24) {
  const canvas = studioActiveCanvasSize();
  const matches = Object.values(STUDIO_TEMPLATES_CATALOG).filter(t => studioTemplateFitsCanvas(t, canvas) && (category === 'all' || t.category === category));
  const cards = matches.slice(0, limit).map(t => {
    const format = STUDIO_SOCIAL_FORMATS[t.format_key];
    const encodedKey = encodeURIComponent(t.template_key);
    return `<button onclick="previewStudioTemplate(decodeURIComponent('${encodedKey}'))" class="studio-template-card w-full text-left rounded-2xl overflow-hidden bg-white border border-slate-200 hover:border-blue-500 hover:shadow-lg transition group"><div class="relative overflow-hidden bg-slate-950">${templatePreviewMarkup(t)}<span class="absolute left-2 top-2 px-2 py-1 rounded-lg bg-slate-950/80 text-[9px] font-black text-blue-100">${format ? `${format.w}×${format.h}` : 'READY'}</span></div><div class="p-3"><div class="text-xs font-black text-slate-900 group-hover:text-blue-600">${escS(t.name)}</div><div class="mt-1 text-[10px] text-slate-500">${escS(t.desc)}</div><div class="mt-2 text-[10px] font-black text-indigo-600">Preview template →</div></div></button>`;
  }).join('');
  const empty = `<div class="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center"><div class="text-sm font-black text-slate-900 dark:text-white">No templates at ${canvas.width} × ${canvas.height}</div><p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose a different design size to see its matching templates.</p><button type="button" onclick="openStudioSizePicker('resize')" class="mt-3 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white">Change design size</button></div>`;
  return (cards || empty) + (matches.length > limit ? `<button type="button" onclick="loadMoreStudioTemplates()" class="w-full py-3 rounded-2xl border border-slate-300 dark:border-slate-700 text-xs font-black">Show more templates (${matches.length - limit})</button>` : '');
}

function renderStudioToolPanelContent(tool) {
  if (tool === 'media') {
    return `<div class="p-4 space-y-3"><div><h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Media library</h3><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Reusable dealership images and videos. Select an asset to place it on the artboard.</p></div><label class="block px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-center text-xs font-black text-white cursor-pointer">+ Upload image<input type="file" accept="image/*" class="hidden" onchange="uploadStudioImage(this)"></label><input id="studio-media-query" oninput="filterStudioMediaLibrary(this.value)" placeholder="Search your media…" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"><div id="studio-media-library" class="grid grid-cols-2 gap-2"><div class="col-span-2 p-5 text-center text-xs text-slate-500">Loading media…</div></div></div>`;
  }
  if (tool === 'layers') {
    const objects = window.__studioAdapter?.fabricCanvas?.getObjects?.() || [];
    const renderLayer = (object, path, depth = 0) => {
      const label = object.msData?.name || object.text || `${object.type || 'Object'}`;
      const children = object.type === 'group' ? object.getObjects().map((child, index) => renderLayer(child, `${path}.${index}`, depth + 1)).join('') : '';
      return `<button type="button" onclick="selectStudioLayerPath('${path}')" class="w-full flex items-center gap-2 px-2 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600/30 border border-slate-300 dark:border-slate-700 text-left text-xs font-bold text-slate-900 dark:text-white" style="padding-left:${8 + depth * 14}px"><span class="text-[10px] text-sky-400">${object.type === 'group' ? '◇' : object.type === 'textbox' ? 'T' : object.type === 'image' ? '▧' : '○'}</span><span class="truncate">${escS(label)}</span></button>${children}`;
    };
    const rows = objects.slice().reverse().map((object, reversedIndex) => {
      const index = objects.length - reversedIndex - 1;
      return renderLayer(object, String(index));
    }).join('');
    const structures = window.__studioAdapter?.currentScene?.components || [];
    return `<div class="p-4 space-y-3"><div><h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Layers</h3><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Select and reorder the current page. Groups and component children remain part of the document model.</p></div><div class="grid grid-cols-2 gap-2"><button type="button" onclick="addStudioStructure('component')" class="px-2 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[10px] font-black text-white">+ Component</button><button type="button" onclick="addStudioStructure('repeater')" class="px-2 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-[10px] font-black text-white">+ Repeater</button></div><div class="space-y-1.5 max-h-[55vh] overflow-y-auto">${rows || '<p class="text-xs text-slate-500">No layers yet.</p>'}</div>${structures.length ? `<div class="pt-2 border-t border-slate-800"><div class="text-[10px] font-black uppercase text-sky-400 mb-1">Structured elements</div>${structures.map((item, index) => `<button type="button" onclick="editStudioStructure(${index})" class="w-full flex items-center justify-between text-left text-xs text-slate-300 py-1 hover:text-white"><span>${item.type === 'repeater' ? '↻' : '◇'} ${escS(item.name)}</span><span class="text-[10px] text-sky-400">Edit</span></button>`).join('')}</div>` : ''}</div>`;
  }
  if (tool === 'templates') {
    const canvas = studioActiveCanvasSize();
    const canvasFormat = STUDIO_SOCIAL_FORMATS[canvas.formatKey];
    return `
      <div class="p-4 space-y-3">
        <div><h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Templates for this design</h3><p class="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Only templates that exactly fit the active canvas are shown.</p></div>
        <button type="button" onclick="openStudioSizePicker('resize')" class="w-full flex items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-left text-xs text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100"><span><b class="block">${escS(canvasFormat?.label || 'Custom design')}</b><span>${canvas.width} × ${canvas.height}</span></span><span class="font-black">Change →</span></button>
        <select onchange="filterStudioTemplateCategory(this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"><option value="all">All categories</option>${[...new Set(Object.values(STUDIO_TEMPLATES_CATALOG).map(template => template.category).filter(Boolean))].map(category => `<option value="${escS(category)}">${escS(category)}</option>`).join('')}</select>
        <div id="studio-template-cards" class="space-y-3">${renderStudioTemplateCards()}</div>
        <div class="pt-3 mt-1 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <h4 class="text-[11px] font-black uppercase tracking-wider text-sky-400">✦ Generate a template</h4>
          <p class="text-[10px] text-slate-500 dark:text-slate-400 -mt-1">Replaces everything currently on the canvas.</p>
          <textarea id="studio-ai-template-prompt" rows="3" placeholder="Example: Bold red price-drop banner with room for a headline and a call-to-action button" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white resize-none"></textarea>
          <button onclick="generateStudioAiTemplate()" id="studio-ai-template-generate" class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black">✦ Generate template</button>
        </div>
      </div>
    `;
  } else if (tool === 'elements') {
    return `<div class="p-4 space-y-4"><div><h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Elements</h3><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Visual building blocks for the canvas. Add one, then resize, recolour, rotate or combine it with anything else.</p></div><label class="studio-element-search"><span>＋</span><input id="studio-premade-query" oninput="filterStudioPremadeElements()" placeholder="Search shapes, graphics, frames…"><span>⌕</span></label><div><div class="studio-catalog-heading"><b>Recently used</b><span>Tap to add</span></div><div id="studio-element-recent" class="studio-element-recent-row">${renderStudioRecentVisualElements()}</div></div><div><div class="studio-catalog-heading"><b>Browse categories</b><button type="button" onclick="setStudioElementCategory('All')">See all</button></div><div class="studio-element-categories">${renderStudioElementCategories()}</div></div><div><div class="studio-catalog-heading"><b id="studio-element-result-heading">${window.__studioElementCategory && window.__studioElementCategory !== 'All' ? escS(window.__studioElementCategory) : 'Recommended for you'}</b><span>${STUDIO_VISUAL_ELEMENTS.length} editable assets</span></div><div id="studio-premade-library" class="studio-catalog-scroll studio-element-library">${renderStudioPremadeElements()}</div></div></div>`;
  } else if (tool === 'inventory') {
    return `
      <div class="p-4 space-y-3">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Create from vehicle</h3>
        <p class="text-[11px] text-slate-500 dark:text-slate-400 -mt-1">Pick a vehicle — its photo and details fill an automotive template, ready to edit and schedule.</p>
        <input type="text" placeholder="Search stock #, VIN, year make model..." oninput="searchStudioInventory(this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white">
        <div class="space-y-2" id="studio-inventory-list">
          <div class="p-3 text-xs text-slate-500">Loading connected inventory…</div>
        </div>
      </div>
    `;
  } else if (tool === 'photos') {
    return `
      <div class="p-4 space-y-3">
        <div><h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Pexels Photos</h3><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Search the free Pexels library and add a photo directly.</p></div>
        <form onsubmit="event.preventDefault(); searchStudioLibrary(document.getElementById('studio-photo-query').value)" class="flex gap-2"><input id="studio-photo-query" type="search" value="car dealership" placeholder="Search photos..." class="min-w-0 flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"><button class="px-3 rounded-xl bg-blue-600 text-xs font-black">Search</button></form>
        <div class="grid grid-cols-2 gap-2 pt-2" id="studio-photo-results"><div class="col-span-2 p-5 text-center text-xs text-slate-500 dark:text-slate-400">Loading Pexels photos…</div></div>
        <a href="https://www.pexels.com" target="_blank" rel="noopener" class="block text-center text-[10px] font-bold text-sky-400 hover:underline">Photos provided by Pexels</a>
        <div class="pt-3 mt-1 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <h4 class="text-[11px] font-black uppercase tracking-wider text-sky-400">✦ Generate an image</h4>
          <textarea id="studio-ai-image-prompt" rows="3" placeholder="Example: A clean studio shot of a silver SUV on a white background" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white resize-none"></textarea>
          <button onclick="generateStudioAiImage()" id="studio-ai-image-generate" class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black">✦ Generate image</button>
          <div id="studio-ai-image-result" class="hidden"></div>
        </div>
      </div>
    `;
  } else if (tool === 'videos') {
    return `<div class="p-4 space-y-3"><div><h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Pexels Videos</h3><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Search free video clips and place them on the canvas.</p></div><form onsubmit="event.preventDefault(); searchStudioVideos(document.getElementById('studio-video-query').value)" class="flex gap-2"><input id="studio-video-query" type="search" value="car dealership" placeholder="Search videos..." class="min-w-0 flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"><button class="px-3 rounded-xl bg-blue-600 text-xs font-black">Search</button></form><div class="space-y-3" id="studio-video-results"><div class="p-5 text-center text-xs text-slate-500 dark:text-slate-400">Loading Pexels videos…</div></div><a href="https://www.pexels.com/videos/" target="_blank" rel="noopener" class="block text-center text-[10px] font-bold text-sky-400 hover:underline">Videos provided by Pexels</a></div>`;
  } else if (tool === 'uploads') {
    return `<div class="studio-uploads-panel p-4 space-y-4"><div><div class="flex items-center gap-2"><span class="studio-panel-icon">↑</span><h3 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Uploads</h3></div><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Bring your own photos and videos into the Studio. They stay available in your Media library.</p></div><div class="studio-upload-dropzone"><div class="studio-upload-dropzone-icon">↑</div><div class="text-sm font-black text-slate-900 dark:text-white">Upload media</div><div class="mt-1 text-[10px] text-slate-500 dark:text-slate-400">PNG, JPG, WebP, GIF, MP4 · up to 200 MB</div><div class="grid grid-cols-2 gap-2 mt-4"><label class="studio-upload-action studio-upload-action-primary"><span>Photo</span><input type="file" accept="image/*" class="hidden" onchange="uploadStudioImage(this)"></label><label class="studio-upload-action"><span>Video</span><input type="file" accept="video/*" class="hidden" onchange="uploadStudioVideo(this)"></label></div></div><div id="studio-upload-status" class="hidden text-xs text-center text-sky-500 dark:text-sky-300"></div><button type="button" onclick="setStudioTool('media')" class="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-black text-slate-800 dark:text-white hover:border-blue-500 transition">Open Media library →</button><div class="pt-2 border-t border-slate-200 dark:border-slate-700"><div class="flex items-center justify-between mb-2"><span class="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Recent video uploads</span></div><div id="studio-uploaded-videos" class="space-y-3"><div class="p-5 text-center text-xs text-slate-500 dark:text-slate-400">Loading your videos…</div></div></div></div>`;
  } else if (tool === 'record') {
    return `
      <div class="p-4 space-y-3">
        <div>
          <h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Teleprompter Record</h3>
          <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Write the script, then record with a see-through teleprompter. Marketing can use this for ads, reels, and lot updates.</p>
        </div>
        <textarea id="studio-tp-script" rows="7" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white" placeholder="Type the words you want on camera…"></textarea>
        <button type="button" onclick="openStudioTeleprompterRecorder(document.getElementById('studio-tp-script')?.value)" class="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black">Open camera + teleprompter</button>
      </div>`;
  } else if (tool === 'shapes') {
    return `
      <div class="p-4 space-y-3">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Shapes &amp; Badges</h3>
        <div class="studio-shape-colour-row"><label for="studio-shape-colour">Shape colour</label><input id="studio-shape-colour" type="color" value="${escS(window.__studioShapeColor || '#2563EB')}" oninput="setStudioShapeColour(this.value)"><input id="studio-shape-colour-hex" value="${escS(window.__studioShapeColor || '#2563EB')}" onchange="setStudioShapeColour(this.value)" aria-label="Shape colour hex"></div>
        <input id="studio-shape-query" oninput="filterStudioShapes()" placeholder="Search shapes..." class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
        <div id="studio-shape-library" class="grid grid-cols-3 gap-2 max-h-[52vh] overflow-y-auto">${renderStudioShapeLibrary()}</div>
        <div class="border-t border-slate-200 dark:border-slate-800 pt-3"><h4 class="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Draw</h4><div class="grid grid-cols-2 gap-2"><button onclick="studioDrawingMode('pen')" class="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black">Pen</button><button onclick="studioDrawingMode('pencil')" class="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-black">Pencil</button></div><button onclick="studioSelectMode()" class="mt-2 w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold">Select &amp; move objects</button></div>
      </div>
    `;
  } else if (tool === 'stickers') {
    return `
      <div class="p-4 space-y-3">
        <div><h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Stickers &amp; Clip Art</h3><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Click to drop a sticker on the canvas — drag to resize once placed.</p></div>
        <input id="studio-sticker-query" oninput="filterStudioStickers()" placeholder="Search 120 stickers..." class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
        <div id="studio-sticker-library" class="grid grid-cols-4 gap-2 max-h-[42vh] overflow-y-auto">${renderStudioStickerLibrary()}</div>
        <div class="studio-gif-panel"><div class="studio-gif-heading"><h4>GIF library</h4><span>Powered by GIPHY</span></div><div class="studio-gif-search-row"><input id="studio-gif-search" value="car dealership" onkeydown="if(event.key==='Enter') searchStudioGifs()" placeholder="Search GIPHY…"><select id="studio-gif-provider" aria-label="GIF provider"><option value="giphy">GIPHY</option><option value="tenor">Tenor</option></select><button type="button" onclick="searchStudioGifs()">Search</button></div><div class="studio-gif-quick-label">Quick searches</div><div class="studio-gif-filters">${STUDIO_GIF_PRESETS.map(item => `<button type="button" onclick="studioGifPresetSearch('${item.query.replace(/'/g, "\\'")}')" class="studio-gif-filter">${escS(item.label)}</button>`).join('')}</div><div id="studio-gif-results" class="studio-gif-results"><div class="col-span-3 p-3 text-center text-xs text-slate-400">Loading GIPHY results…</div></div><div class="studio-gif-paste"><input id="studio-gif-url" placeholder="Paste a GIF URL"><button type="button" onclick="addStudioGifFromUrl()">Add GIF</button></div></div>
      </div>
    `;
  } else if (tool === 'icons') {
    return `<div class="p-4 space-y-4"><div><h3 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Icons</h3><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Searchable SVG icons for automotive, social, offers, contact, navigation and more. The catalog loads progressively as you scroll.</p></div><input id="studio-icon-query" oninput="filterStudioIcons()" placeholder="Search icons…" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 text-white placeholder:text-slate-500 border border-white/10 text-xs"><div id="studio-icon-categories" class="studio-icon-categories">${renderStudioIconCategories()}</div><div class="flex items-center justify-between gap-2"><div class="studio-catalog-heading"><b>Recommended</b><span>Tap to add</span></div><select id="studio-icon-library-select" onchange="filterStudioIcons()" class="w-36 px-2 py-1.5 rounded-lg bg-slate-900 text-white border border-white/10 text-[10px]">${Object.entries(STUDIO_ICON_LIBRARIES).map(([key,[label]]) => `<option value="${key}">${label}</option>`).join('')}</select></div><div id="studio-icon-library" class="studio-catalog-scroll studio-icon-library">${renderStudioIconLibrary()}</div></div>`;
  } else if (tool === 'text') {
    return `
      <div class="p-4 space-y-4">
        <div><h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Text</h3><p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Add plain text or choose a designed combination with multiple editable text layers.</p></div>
        <input id="studio-text-template-query" oninput="filterStudioTextTemplates()" placeholder="Search fonts and combinations…" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white">
        <button type="button" onclick="studioAddText('body')" class="studio-add-text-button"><span>T</span>Add a text box</button>
        <details class="studio-magic-write"><summary>✦ Magic Write</summary><div class="space-y-2"><textarea id="studio-ai-prompt" rows="3" placeholder="Write a short summer sales headline for our SUV event" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white resize-none"></textarea><button onclick="generateStudioAiCopy()" id="studio-ai-generate" class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black">✦ Generate content</button><div id="studio-ai-result" class="hidden p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap"></div></div></details>
        <div id="studio-text-categories" class="studio-category-pills">${renderStudioTextCategories()}</div>
        <div><div class="studio-catalog-heading"><b>Text combinations</b><span>Two editable layers</span></div><div id="studio-text-template-library" class="studio-catalog-scroll studio-text-template-library">${renderStudioTextTemplates()}</div></div>
        <div class="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <h4 class="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Fonts</h4>
          <p class="text-[10px] text-slate-500 dark:text-slate-400 -mt-1">Pick a font — applies to selected text, or the next text you add.</p>
          <div class="flex gap-2"><input id="studio-font-query" oninput="filterStudioFonts()" placeholder="Search 100+ Google fonts..." class="min-w-0 flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"><select id="studio-font-category" onchange="filterStudioFonts()" class="w-28 px-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">${Object.entries(STUDIO_FONT_CATEGORIES).map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select></div>
          <select id="studio-font-picker" onchange="studioPickFont(this.value)" class="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white">${renderStudioFontLibrary()}</select>
        </div>
      </div>
    `;
  } else if (tool === 'brand') {
    const kit = window.__studioBrandKit || {}, storeName = kit.dealership_name || window.__dealerConfig?.store_name || 'Dealership';
    const colors = [kit.primary_color, kit.secondary_color, kit.accent_color].filter(Boolean);
    const logos = [kit.logo_url, kit.alternate_logo_url, kit.light_logo_url, kit.dark_logo_url, kit.logo_mark_url].filter(Boolean);
    return `
      <div class="p-4 space-y-3">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Dealership Brand Kit</h3>
        <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 space-y-2">
          <div class="text-xs font-bold text-slate-900 dark:text-white">${escS(storeName)}</div>
          <div class="grid grid-cols-3 gap-2">${colors.map(color => `<button type="button" onclick="studioApplyBrandColor('${escS(color)}')" title="Apply ${escS(color)}" class="h-10 rounded-xl border border-white/30" style="background:${escS(color)}"></button>`).join('') || '<span class="col-span-3 text-[10px] text-slate-500">No approved colours saved.</span>'}</div>
          <div class="grid grid-cols-2 gap-2">${logos.map((url, index) => `<button type="button" onclick="window.__studioAdapter?.addImage('${escS(url)}','Dealership logo')" class="p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700"><img src="${escS(url)}" alt="Approved logo ${index + 1}" class="w-full h-12 object-contain"></button>`).join('') || '<span class="col-span-2 text-[10px] text-slate-500">No approved logo saved.</span>'}</div>
          <div class="grid grid-cols-2 gap-2 text-[10px]"><button type="button" onclick="studioApplyBrandFont('heading')" class="p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700">Heading · ${escS(kit.heading_font || 'Not set')}</button><button type="button" onclick="studioApplyBrandFont('body')" class="p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700">Body · ${escS(kit.body_font || 'Not set')}</button></div>
          <button type="button" onclick="openStudioBrandKitManager()" class="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">Manage Brand Kit</button>
        </div>
      </div>
    `;
  }
  return '';
}

function selectStudioLayer(index) {
  const canvas = window.__studioAdapter?.fabricCanvas;
  const object = canvas?.getObjects?.()[index];
  if (!canvas || !object) return;
  canvas.discardActiveObject(); canvas.setActiveObject(object); canvas.requestRenderAll();
  window.__studioAdapter?.onSelectionChange([object]);
}
window.selectStudioLayer = selectStudioLayer;
function selectStudioLayerPath(path) {
  const canvas = window.__studioAdapter?.fabricCanvas; if (!canvas) return;
  const parts = String(path).split('.').map(Number); let object = canvas.getObjects()[parts.shift()];
  for (const part of parts) object = object?.type === 'group' ? object.getObjects()[part] : null;
  if (!object) return;
  canvas.discardActiveObject(); canvas.setActiveObject(object); canvas.requestRenderAll(); window.__studioAdapter?.onSelectionChange([object]);
}
window.selectStudioLayerPath = selectStudioLayerPath;

function addStudioStructure(type) {
  const adapter = window.__studioAdapter;
  if (!adapter?.currentScene || !window.msStudioSceneToDocument) return;
  const document = window.msStudioSceneToDocument(adapter.exportScene());
  const item = type === 'repeater'
    ? window.msStudioCreateRepeater('Inventory repeater', 'inventory', { type: 'vehicle-card', fields: ['year', 'make', 'model', 'price'] })
    : window.msStudioCreateComponent('Reusable component', []);
  document.components = [...(document.components || []), item];
  adapter.currentScene = window.msStudioDocumentToScene(document);
  adapter.renderScene(adapter.currentScene);
  window.__msStudioStore?.update(document);
  if (window.msStudioScheduleAutosave) window.msStudioScheduleAutosave(adapter.currentScene);
  setStudioTool('layers');
  if (typeof showToast === 'function') showToast(`${type === 'repeater' ? 'Repeater' : 'Component'} added`, 'success');
}
window.addStudioStructure = addStudioStructure;

function editStudioStructure(index) {
  const item = window.__studioAdapter?.currentScene?.components?.[index]; if (!item || typeof crmOverlay !== 'function') return;
  const fields = ['year', 'make', 'model', 'trim', 'price', 'mileage', 'stock_number', 'primary_photo_url'];
  crmOverlay(`<form onsubmit="event.preventDefault(); saveStudioStructure(${index})" class="p-5 space-y-4 max-w-md"><div><h3 class="text-lg font-black text-white">${item.type === 'repeater' ? 'Repeater mapping' : 'Component settings'}</h3><p class="text-xs text-slate-400 mt-1">Configure the reusable definition used by this design.</p></div><label class="block text-xs font-bold text-slate-300">Name<input id="studio-structure-name" value="${escS(item.name || '')}" class="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></label>${item.type === 'repeater' ? `<label class="block text-xs font-bold text-slate-300">Collection<select id="studio-structure-collection" class="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"><option value="inventory" ${item.collection === 'inventory' ? 'selected' : ''}>Inventory</option><option value="customers" ${item.collection === 'customers' ? 'selected' : ''}>Customers</option><option value="services" ${item.collection === 'services' ? 'selected' : ''}>Service offers</option></select></label><div><div class="text-xs font-bold text-slate-300 mb-2">Mapped fields</div><div class="grid grid-cols-2 gap-2">${fields.map(field => `<label class="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" value="${field}" ${item.template?.fields?.includes(field) ? 'checked' : ''}>${field}</label>`).join('')}</div></div>` : ''}<div class="flex justify-end gap-2"><button type="submit" class="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-black text-white">Save mapping</button></div></form>`);
}
window.editStudioStructure = editStudioStructure;
function saveStudioStructure(index) {
  const item = window.__studioAdapter?.currentScene?.components?.[index]; if (!item) return;
  item.name = document.getElementById('studio-structure-name')?.value || item.name;
  if (item.type === 'repeater') {
    item.collection = document.getElementById('studio-structure-collection')?.value || item.collection;
    item.template = { ...(item.template || {}), fields: [...document.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value) };
  }
  window.__msStudioStore?.update(window.msStudioSceneToDocument(window.__studioAdapter.exportScene()));
  if (typeof showToast === 'function') showToast('Structured element updated', 'success');
}
window.saveStudioStructure = saveStudioStructure;

function renderStudioInspectorHtml(selected) {
  const object = Array.isArray(selected) ? selected[0] : selected;
  const isText = ['textbox', 'text', 'i-text'].includes(object?.type);
  const color = typeof object?.fill === 'string' && object.fill.startsWith('#') ? object.fill : (typeof object?.stroke === 'string' && object.stroke.startsWith('#') ? object.stroke : '#2563eb');
  const opacity = Math.round((object?.opacity ?? 1) * 100);
  return `
    <h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3">Property Inspector</h3>
    <div class="space-y-3">
      <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
        <label class="text-[10px] font-bold text-slate-500">Layer name<input value="${escS(object?.msData?.name || '')}" placeholder="Untitled layer" onchange="renameStudioLayer(this.value)" class="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"></label>
        <div class="grid grid-cols-2 gap-2"><label class="text-[10px] font-bold text-slate-500">X<input type="number" value="${Math.round(object?.left || 0)}" onchange="studioSetObjectGeometry('left', this.value)" class="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"></label><label class="text-[10px] font-bold text-slate-500">Y<input type="number" value="${Math.round(object?.top || 0)}" onchange="studioSetObjectGeometry('top', this.value)" class="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"></label><label class="text-[10px] font-bold text-slate-500">Width<input type="number" value="${Math.round(object?.getScaledWidth?.() || object?.width || 0)}" onchange="studioSetObjectGeometry('width', this.value)" class="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"></label><label class="text-[10px] font-bold text-slate-500">Height<input type="number" value="${Math.round(object?.getScaledHeight?.() || object?.height || 0)}" onchange="studioSetObjectGeometry('height', this.value)" class="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"></label></div>
        <div><label class="text-[11px] font-bold text-slate-500 dark:text-slate-400">Colour</label><input type="color" value="${color}" onchange="studioSetObjectStyle('color', this.value)" class="mt-1 w-full h-9 rounded-lg bg-transparent cursor-pointer"></div>
        <div><div class="flex justify-between"><label class="text-[11px] font-bold text-slate-500 dark:text-slate-400">Transparency</label><span id="studio-opacity-value" class="text-[11px] text-sky-400">${100-opacity}%</span></div><input type="range" min="0" max="100" value="${opacity}" oninput="document.getElementById('studio-opacity-value').textContent=(100-Number(this.value))+'%'" onchange="studioSetObjectStyle('opacity', Number(this.value)/100)" class="w-full accent-blue-500"></div>
        <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400">Animation<select onchange="studioSetAnimation(this.value)" class="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"><option value="none">None</option><option value="float">Float</option><option value="pulse">Pulse</option><option value="spin">Spin</option><option value="bounce">Bounce</option><option value="fade">Fade</option></select></label>
      </div>
      ${isText ? `<div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2"><div class="text-[10px] font-black uppercase text-slate-500">Typography</div><label class="block text-[10px] text-slate-500">Font family<input value="${escS(object?.fontFamily || 'Manrope')}" onchange="studioSetTextStyle('fontFamily', this.value)" class="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"></label><div class="grid grid-cols-3 gap-2"><label class="text-[10px] text-slate-500">Size<input type="number" min="6" value="${Math.round(object?.fontSize || 36)}" onchange="studioSetTextStyle('fontSize', Number(this.value))" class="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"></label><label class="text-[10px] text-slate-500">Line height<input type="number" min="0.5" max="3" step="0.05" value="${Number(object?.lineHeight || 1.08).toFixed(2)}" onchange="studioSetTextStyle('lineHeight', Number(this.value))" class="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"></label><label class="text-[10px] text-slate-500">Spacing<input type="number" min="-200" max="800" value="${Math.round(object?.charSpacing || 0)}" onchange="studioSetTextStyle('charSpacing', Number(this.value))" class="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"></label></div><div class="grid grid-cols-3 gap-1">${['left','center','right'].map(value => `<button type="button" onclick="studioSetTextStyle('textAlign','${value}')" class="py-1.5 rounded-lg ${object?.textAlign === value ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'} text-[10px] font-bold">${value[0].toUpperCase() + value.slice(1)}</button>`).join('')}</div><div class="grid grid-cols-2 gap-2"><button type="button" onclick="studioTransformText('uppercase')" class="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">UPPERCASE</button><button type="button" onclick="studioTransformText('lowercase')" class="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">lowercase</button></div></div>` : ''}
      <button onclick="studioToggleNodes()" class="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black">Edit vector nodes</button>
      <div class="grid grid-cols-2 gap-2"><button onclick="window.__studioAdapter?.toggleSelectedLock()" class="py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black">${object?.lockMovementX ? 'Unlock' : 'Lock'}</button><button onclick="window.__studioAdapter?.toggleSelectedVisibility()" class="py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black">Hide</button></div>
      <div class="grid grid-cols-3 gap-1"><button onclick="window.__studioAdapter?.alignSelected('left')" class="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">Left</button><button onclick="window.__studioAdapter?.alignSelected('center')" class="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">Center</button><button onclick="window.__studioAdapter?.alignSelected('right')" class="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">Right</button><button onclick="window.__studioAdapter?.alignSelected('top')" class="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">Top</button><button onclick="window.__studioAdapter?.alignSelected('middle')" class="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">Middle</button><button onclick="window.__studioAdapter?.alignSelected('bottom')" class="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">Bottom</button></div>
      ${object?.type === 'image' ? `<div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2"><div class="text-[10px] font-black uppercase text-slate-500">Image adjustments</div>${[['brightness','Brightness'],['contrast','Contrast'],['saturation','Saturation'],['blur','Blur']].map(([key,label]) => `<label class="block text-[10px] text-slate-500">${label}<input type="range" min="${key === 'blur' ? 0 : -1}" max="1" step="0.05" value="${object?.msData?.adjustments?.[key] || 0}" oninput="window.__studioAdapter?.adjustSelectedImage({${key}:Number(this.value)})" class="w-full"></label>`).join('')}<div class="grid grid-cols-2 gap-2"><button onclick="window.__studioAdapter?.updateSelected({flipX:!window.__studioAdapter.fabricCanvas.getActiveObject().flipX})" class="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">Flip horizontal</button><button onclick="window.__studioAdapter?.updateSelected({flipY:!window.__studioAdapter.fabricCanvas.getActiveObject().flipY})" class="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">Flip vertical</button></div></div>` : ''}
      <div class="space-y-1">
        <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400">Layer Order:</label>
        <div class="flex gap-2">
          <button onclick="if(window.__studioAdapter) window.__studioAdapter.bringForward()" class="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold">Bring Forward</button>
          <button onclick="if(window.__studioAdapter) window.__studioAdapter.sendBackwards()" class="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold">Send Back</button>
        </div>
      </div>
      <button onclick="if(window.__studioAdapter) window.__studioAdapter.deleteSelected()" class="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition flex items-center justify-center gap-1.5">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>Delete Object
      </button>
    </div>
  `;
}

function renderStudioProfessionalInspectorHtml(selected) {
  const object = Array.isArray(selected) ? selected[0] : selected;
  if (!object) return `<div class="studio-inspector-empty"><span class="studio-inspector-empty-icon">◇</span><strong>Select an element</strong><p>Move, resize and rotate directly on the canvas. Style, position and motion controls will appear here.</p></div>`;
  const isText = ['textbox', 'text', 'i-text'].includes(object.type);
  const isImage = object.type === 'image';
  const tab = window.__studioInspectorTab || 'style';
  const opacity = Math.round((object.opacity ?? 1) * 100);
  const color = typeof object.fill === 'string' && object.fill.startsWith('#') ? object.fill : '#2563eb';
  const stroke = typeof object.stroke === 'string' && object.stroke.startsWith('#') ? object.stroke : '#0f172a';
  const animation = object.msData?.animation || {};
  const input = 'studio-control-input';
  const action = 'studio-control-action';
  const tabButton = (key, label) => `<button type="button" onclick="setStudioInspectorTab('${key}')" aria-current="${tab === key ? 'page' : 'false'}">${label}</button>`;
  const stylePanel = `
    <section class="studio-inspector-section"><h4>Appearance</h4>
      <div class="studio-control-grid studio-control-grid-2"><label>Fill<input type="color" value="${color}" onchange="studioSetObjectStyle('color',this.value)"></label><label>Stroke<input type="color" value="${stroke}" onchange="studioSetObjectStyle('stroke',this.value)"></label></div>
      <label>Stroke width<input class="${input}" type="number" min="0" max="40" value="${Number(object.strokeWidth || 0)}" onchange="studioSetObjectStyle('strokeWidth',Math.max(0,Number(this.value)))"></label>
      ${object.type === 'rect' ? `<label>Corner radius<input class="${input}" type="range" min="0" max="160" value="${Number(object.rx || 0)}" oninput="studioSetObjectStyle('rx',Number(this.value));studioSetObjectStyle('ry',Number(this.value))"></label>` : ''}
      <label><span class="studio-control-label-row"><span>Opacity</span><output id="studio-opacity-value">${opacity}%</output></span><input type="range" min="0" max="100" value="${opacity}" oninput="document.getElementById('studio-opacity-value').value=this.value+'%'" onchange="studioSetObjectStyle('opacity',Number(this.value)/100)"></label>
    </section>
    <section class="studio-inspector-section"><h4>Depth &amp; effects</h4><div class="studio-style-presets">${[['none','None'],['soft','Soft'],['lift','Lift'],['glow','Glow']].map(([key,label]) => `<button class="${action}" onclick="window.__studioAdapter?.setSelectedShadow('${key}')">${label}</button>`).join('')}</div></section>
    ${isText ? `<section class="studio-inspector-section"><h4>Typography</h4><label>Font<input class="${input}" value="${escS(object.fontFamily || 'Manrope')}" onchange="studioSetTextStyle('fontFamily',this.value)"></label><div class="studio-control-grid studio-control-grid-3"><label>Size<input class="${input}" type="number" min="6" value="${Math.round(object.fontSize || 36)}" onchange="studioSetTextStyle('fontSize',Number(this.value))"></label><label>Line<input class="${input}" type="number" min=".5" max="3" step=".05" value="${Number(object.lineHeight || 1.08).toFixed(2)}" onchange="studioSetTextStyle('lineHeight',Number(this.value))"></label><label>Spacing<input class="${input}" type="number" min="-200" max="800" value="${Math.round(object.charSpacing || 0)}" onchange="studioSetTextStyle('charSpacing',Number(this.value))"></label></div><div class="studio-segmented">${['left','center','right','justify'].map(value => `<button aria-current="${object.textAlign === value ? 'page' : 'false'}" onclick="studioSetTextStyle('textAlign','${value}')">${value}</button>`).join('')}</div><div class="studio-control-grid studio-control-grid-2"><button class="${action}" onclick="studioTransformText('uppercase')">UPPERCASE</button><button class="${action}" onclick="studioTransformText('lowercase')">lowercase</button></div></section>` : ''}
    ${isImage ? `<section class="studio-inspector-section"><h4>Image adjustments</h4>${[['brightness','Brightness'],['contrast','Contrast'],['saturation','Saturation'],['blur','Blur']].map(([key,label]) => `<label>${label}<input type="range" min="${key === 'blur' ? 0 : -1}" max="1" step=".05" value="${object.msData?.adjustments?.[key] || 0}" oninput="window.__studioAdapter?.adjustSelectedImage({${key}:Number(this.value)})"></label>`).join('')}</section>` : ''}`;
  const positionPanel = `
    <section class="studio-inspector-section"><h4>Transform</h4><div class="studio-control-grid studio-control-grid-2"><label>X<input class="${input}" type="number" value="${Math.round(object.left || 0)}" onchange="studioSetObjectGeometry('left',this.value)"></label><label>Y<input class="${input}" type="number" value="${Math.round(object.top || 0)}" onchange="studioSetObjectGeometry('top',this.value)"></label><label>Width<input class="${input}" type="number" min="1" value="${Math.round(object.getScaledWidth?.() || object.width || 0)}" onchange="studioSetObjectGeometry('width',this.value)"></label><label>Height<input class="${input}" type="number" min="1" value="${Math.round(object.getScaledHeight?.() || object.height || 0)}" onchange="studioSetObjectGeometry('height',this.value)"></label></div><label>Rotation<input class="${input}" type="number" min="-360" max="360" value="${Math.round(object.angle || 0)}" onchange="studioSetObjectGeometry('rotation',this.value)"></label><div class="studio-control-grid studio-control-grid-2"><button class="${action}" onclick="studioFlipSelected('x')">↔ Flip horizontal</button><button class="${action}" onclick="studioFlipSelected('y')">↕ Flip vertical</button></div></section>
    <section class="studio-inspector-section"><h4>Align to page</h4><div class="studio-align-grid">${[['left','Left'],['center','Center'],['right','Right'],['top','Top'],['middle','Middle'],['bottom','Bottom']].map(([key,label]) => `<button onclick="window.__studioAdapter?.alignSelected('${key}')">${label}</button>`).join('')}</div><div class="studio-control-grid studio-control-grid-2"><button class="${action}" onclick="window.__studioAdapter?.distributeSelected('horizontal')">Distribute ↔</button><button class="${action}" onclick="window.__studioAdapter?.distributeSelected('vertical')">Distribute ↕</button></div></section>
    <section class="studio-inspector-section"><h4>Layer order</h4><div class="studio-control-grid studio-control-grid-2"><button class="${action}" onclick="window.__studioAdapter?.bringToFront()">To front</button><button class="${action}" onclick="window.__studioAdapter?.bringForward()">Forward</button><button class="${action}" onclick="window.__studioAdapter?.sendBackwards()">Backward</button><button class="${action}" onclick="window.__studioAdapter?.sendToBack()">To back</button></div></section>`;
  const animatePanel = `<section class="studio-inspector-section"><h4>Element animation</h4><p class="studio-control-help">Motion remains editable and is included in animated exports.</p><div class="studio-animation-grid">${[['none','—','None'],['float','↟','Float'],['pulse','◉','Pulse'],['spin','↻','Spin'],['bounce','↥','Bounce'],['fade','◐','Fade']].map(([key,icon,label]) => `<button aria-current="${(animation.type || 'none') === key ? 'page' : 'false'}" onclick="studioSetAnimation('${key}')"><span>${icon}</span>${label}</button>`).join('')}</div><label>Duration <span class="studio-control-unit">ms</span><input class="${input}" type="number" min="300" max="12000" step="100" value="${Number(animation.duration || 1600)}" onchange="studioSetAnimationDuration(this.value)"></label></section>`;
  return `<div class="studio-inspector-heading"><div><span>${escS(object.msData?.type || object.type || 'Element')}</span><input value="${escS(object.msData?.name || '')}" placeholder="Untitled element" onchange="renameStudioLayer(this.value)"></div><button title="Close selection" onclick="window.__studioAdapter?.fabricCanvas?.discardActiveObject();window.__studioAdapter?.fabricCanvas?.requestRenderAll();window.__studioAdapter?.onSelectionChange([])">×</button></div><div class="studio-inspector-tabs">${tabButton('style','Style')}${tabButton('position','Position')}${tabButton('animate','Animate')}</div><div class="studio-inspector-body">${tab === 'position' ? positionPanel : tab === 'animate' ? animatePanel : stylePanel}<section class="studio-inspector-section studio-inspector-actions"><div class="studio-control-grid studio-control-grid-2"><button class="${action}" onclick="window.__studioAdapter?.toggleSelectedLock()">${object.lockMovementX ? 'Unlock' : 'Lock'}</button><button class="${action}" onclick="window.__studioAdapter?.toggleSelectedVisibility()">Hide</button></div><button class="studio-delete-action" onclick="window.__studioAdapter?.deleteSelected()">Delete element</button></section></div>`;
}

function setStudioInspectorTab(tab) {
  window.__studioInspectorTab = ['style','position','animate'].includes(tab) ? tab : 'style';
  const panel = document.getElementById('studio-inspector-panel');
  const active = window.__studioAdapter?.fabricCanvas?.getActiveObject();
  if (panel) panel.innerHTML = renderStudioProfessionalInspectorHtml(active ? [active] : []);
}
window.setStudioInspectorTab = setStudioInspectorTab;
function studioFlipSelected(axis) {
  const active = window.__studioAdapter?.fabricCanvas?.getActiveObject();
  if (!active) return;
  window.__studioAdapter.updateSelected(axis === 'y' ? { flipY: !active.flipY } : { flipX: !active.flipX });
}
window.studioFlipSelected = studioFlipSelected;
function studioSetAnimationDuration(value) {
  const active = window.__studioAdapter?.fabricCanvas?.getActiveObject();
  if (!active) return;
  window.__studioAdapter.setSelectedAnimation(active.msData?.animation?.type || 'float', Math.max(300, Number(value) || 1600));
}
window.studioSetAnimationDuration = studioSetAnimationDuration;

async function initStudioAdapter(scene) {
  const canvasEl = document.getElementById('studio-main-canvas');
  if (!canvasEl) return;
  window.__studioAdapter = new StudioFabricAdapter(canvasEl, {
    onSelection: (selected) => {
      const panel = document.getElementById('studio-inspector-panel');
      if (panel) panel.innerHTML = renderStudioProfessionalInspectorHtml(selected);
      const hint = document.getElementById('studio-text-hint');
      const active = Array.isArray(selected) ? selected[0] : selected;
      if (hint) hint.textContent = active && ['textbox', 'text', 'i-text'].includes(active.type) ? 'Text selected — use the controls' : 'Select text to format it';
    },
    onStateChange: () => {
      const status = document.getElementById('studio-save-status');
      if (status) { status.textContent = 'UNSAVED'; status.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/40'; }
      if (window.msStudioScheduleAutosave) window.msStudioScheduleAutosave(window.__studioAdapter.exportScene());
    }
  });

  await window.__studioAdapter.init(scene, window.__studioCurrentVehicle);
  syncStudioPageUi();
  wireStudioContextMenu(window.__studioAdapter);
}

// Right-click or press-and-hold on the artboard. Both gestures open the same action
// surface and call the adapter's canonical edit/history methods, so touch does not
// grow a second implementation of delete, arrange, undo, etc.
const STUDIO_LONG_PRESS_MS = 560;
const STUDIO_LONG_PRESS_MOVE_PX = 12;

function selectStudioContextTarget(canvas, event) {
  const target = canvas.findTarget(event, false);
  if (target && !canvas.getActiveObjects().includes(target)) {
    canvas.discardActiveObject();
    canvas.setActiveObject(target);
    canvas.requestRenderAll();
  } else if (!target) {
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }
  return target;
}

function wireStudioContextMenu(adapter) {
  const canvas = adapter?.fabricCanvas;
  if (!canvas?.upperCanvasEl) return;
  const surface = canvas.upperCanvasEl;
  surface.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const target = selectStudioContextTarget(canvas, e);
    showStudioContextMenu(e.clientX, e.clientY, !!target);
  });

  let press = null;
  let pressTimer = null;
  let suppressClickUntil = 0;
  const clearPress = () => {
    if (pressTimer) window.clearTimeout(pressTimer);
    pressTimer = null;
    press = null;
  };
  surface.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || e.button !== 0) return;
    clearPress();
    press = { x: e.clientX, y: e.clientY, event: e };
    pressTimer = window.setTimeout(() => {
      if (!press) return;
      const target = selectStudioContextTarget(canvas, press.event);
      suppressClickUntil = Date.now() + 700;
      showStudioContextMenu(press.x, press.y, !!target);
      if (navigator.vibrate) navigator.vibrate(12);
      pressTimer = null;
    }, STUDIO_LONG_PRESS_MS);
  }, { passive: true });
  surface.addEventListener('pointermove', (e) => {
    if (!press) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > STUDIO_LONG_PRESS_MOVE_PX) clearPress();
  }, { passive: true });
  surface.addEventListener('pointerup', clearPress, { passive: true });
  surface.addEventListener('pointercancel', clearPress, { passive: true });
  // Mobile browsers synthesize a click after a long press. Consume only that one
  // click or it immediately closes the action sheet that the hold just opened.
  surface.addEventListener('click', (e) => {
    if (Date.now() >= suppressClickUntil) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
}

function closeStudioContextMenu() {
  document.getElementById('studio-context-menu')?.remove();
  document.removeEventListener('keydown', studioContextMenuEscape);
}
window.closeStudioContextMenu = closeStudioContextMenu;
function studioContextMenuEscape(e) { if (e.key === 'Escape') closeStudioContextMenu(); }

function showStudioContextMenu(x, y, hasTarget) {
  closeStudioContextMenu();
  const adapter = window.__studioAdapter;
  const active = adapter?.fabricCanvas?.getActiveObject();
  const isSelection = active?.type === 'activeSelection';
  const isGroup = active?.type === 'group';
  const canUndo = (adapter?.undoStack?.length || 0) > 1;
  const canRedo = (adapter?.redoStack?.length || 0) > 0;
  const item = (label, method, opts = {}) => `<button type="button" role="menuitem" onclick="studioCtxAction('${method}')" ${opts.disabled ? 'disabled' : ''} class="studio-context-menu-item w-full text-left px-3 flex items-center justify-between gap-4 transition ${opts.disabled ? 'opacity-40 cursor-default' : 'hover:bg-slate-100 dark:hover:bg-slate-800'} ${opts.danger && !opts.disabled ? 'text-rose-500 dark:text-rose-400' : ''}"><span>${label}</span>${opts.shortcut ? `<span class="text-[10px] text-slate-500 dark:text-slate-400 font-mono">${opts.shortcut}</span>` : ''}</button>`;
  const divider = '<div class="my-1 border-t border-slate-200 dark:border-slate-800"></div>';
  const menu = document.createElement('div');
  menu.id = 'studio-context-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', hasTarget ? 'Selected element actions' : 'Canvas actions');
  menu.className = 'fixed z-[100000] min-w-[230px] py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl text-xs font-bold text-slate-700 dark:text-slate-200';
  menu.innerHTML = [
    `<div class="studio-context-menu-heading"><span>${hasTarget ? 'Element actions' : 'Canvas actions'}</span><button type="button" onclick="closeStudioContextMenu()" aria-label="Close actions">&times;</button></div>`,
    item('Undo', 'undo', { disabled: !canUndo, shortcut: 'Ctrl+Z' }),
    item('Redo', 'redo', { disabled: !canRedo, shortcut: 'Ctrl+Shift+Z' }),
    divider,
    item('Transform / position…', 'openTransformControls', { disabled: !hasTarget }),
    item('Delete', 'deleteSelected', { disabled: !hasTarget, danger: true }),
    divider,
    item('Copy', 'copySelected', { disabled: !hasTarget, shortcut: 'Ctrl+C' }),
    item('Cut', 'cutSelected', { disabled: !hasTarget, shortcut: 'Ctrl+X' }),
    item('Paste', 'pasteClipboard', { disabled: !adapter?._clipboard, shortcut: 'Ctrl+V' }),
    item('Duplicate', 'duplicateSelected', { disabled: !hasTarget, shortcut: 'Ctrl+D' }),
    divider,
    item('Bring to Front', 'bringToFront', { disabled: !hasTarget }),
    item('Bring Forward', 'bringForward', { disabled: !hasTarget }),
    item('Send Backward', 'sendBackwards', { disabled: !hasTarget }),
    item('Send to Back', 'sendToBack', { disabled: !hasTarget }),
    divider,
    item('Group', 'groupSelected', { disabled: !isSelection, shortcut: 'Ctrl+G' }),
    item('Ungroup', 'ungroupSelected', { disabled: !isGroup, shortcut: 'Ctrl+Shift+G' }),
  ].join('');
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
  setTimeout(() => {
    document.addEventListener('click', closeStudioContextMenu, { once: true });
    document.addEventListener('keydown', studioContextMenuEscape);
  }, 0);
}
window.showStudioContextMenu = showStudioContextMenu;

function openStudioTransformControls() {
  const adapter = window.__studioAdapter;
  const active = adapter?.fabricCanvas?.getActiveObject();
  if (!active) return;
  active.set({ hasControls: true, hasBorders: true });
  active.setCoords();
  adapter.fabricCanvas.setActiveObject(active);
  adapter.fabricCanvas.requestRenderAll();
  window.__studioInspectorTab = 'position';
  const panel = document.getElementById('studio-inspector-panel');
  if (panel) {
    panel.innerHTML = renderStudioProfessionalInspectorHtml([active]);
    panel.classList.remove('hidden');
  }
  if (studioIsMobile()) openStudioMobilePanel('inspector');
}
window.openStudioTransformControls = openStudioTransformControls;

function studioCtxAction(method) {
  closeStudioContextMenu();
  if (method === 'openTransformControls') return openStudioTransformControls();
  const adapter = window.__studioAdapter;
  if (adapter && typeof adapter[method] === 'function') adapter[method]();
}
window.studioCtxAction = studioCtxAction;

function setStudioTool(tool) {
  window.__studioActiveTool = tool;
  if (tool === 'templates') window.__studioWorkspaceTab = 'templates';
  else if (tool === 'brand') window.__studioWorkspaceTab = 'brand';
  else if (tool === 'inventory') window.__studioWorkspaceTab = 'inventory';
  else if (['media', 'photos', 'videos', 'uploads', 'record'].includes(tool)) window.__studioWorkspaceTab = 'media';
  else window.__studioWorkspaceTab = 'create';
  const studioTabs = document.querySelector('[role="tablist"][aria-label="Design Studio"]');
  if (studioTabs) studioTabs.innerHTML = renderDesignStudioTabsHtml();
  document.querySelectorAll('[data-studio-tool]').forEach(button => {
    button.setAttribute('aria-current', button.dataset.studioTool === tool ? 'page' : 'false');
  });
  const panel = document.getElementById('studio-tool-panel');
  if (panel) panel.innerHTML = renderStudioToolPanelContent(tool);
  if (['icons', 'elements', 'text'].includes(tool)) setTimeout(() => wireStudioLazyCatalog(tool), 0);
  if (studioIsMobile()) openStudioMobilePanel('tool');
  if (tool === 'photos') setTimeout(() => searchStudioLibrary('car dealership'), 0);
  if (tool === 'videos') setTimeout(() => searchStudioVideos('car dealership'), 0);
  if (tool === 'inventory') setTimeout(() => searchStudioInventory(''), 0);
  if (tool === 'uploads') setTimeout(loadStudioUploadedVideos, 0);
  if (tool === 'media') setTimeout(loadStudioMediaLibrary, 0);
  if (tool === 'text') setTimeout(loadStudioGoogleFonts, 0);
  if (tool === 'stickers') setTimeout(searchStudioGifs, 0);
  if (tool === 'brand') setTimeout(loadStudioBrandKit, 0);
}

function setDesignStudioTab(tab) {
  const definition = DESIGN_STUDIO_TABS.find(([id]) => id === tab);
  if (!definition) return;
  window.__studioWorkspaceTab = tab;
  const studioTabs = document.querySelector('[role="tablist"][aria-label="Design Studio"]');
  if (studioTabs) studioTabs.innerHTML = renderDesignStudioTabsHtml();
  if (tab === 'projects') {
    document.querySelectorAll('[data-studio-tool]').forEach(button => button.setAttribute('aria-current', button.dataset.studioTool === 'projects' ? 'page' : 'false'));
    closeStudioMobilePanels();
    openStudioProjectLibrary();
    return;
  }
  document.getElementById('studio-action-sheet')?.remove();
  setStudioTool(definition[2] || 'elements');
}
window.setDesignStudioTab = setDesignStudioTab;

function studioProjectPreviewMarkup(design) {
  const source = design?.scene || {};
  const scene = window.msStudioDocumentToScene ? window.msStudioDocumentToScene(source) : (Array.isArray(source.pages) ? source.pages[0] : source);
  return templatePreviewMarkup({ scene: scene || {} });
}

async function openStudioProjectLibrary() {
  const sheet = openStudioSheet('Projects', '<div id="studio-project-library" class="py-10 text-center text-sm text-slate-500">Loading tenant projects…</div>');
  const target = sheet.querySelector('#studio-project-library');
  try {
    const response = await apiGetJson('/marketing/studio/designs');
    const designs = response?.designs || [];
    target.innerHTML = designs.length ? `<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${designs.map(design => { const encodedId = encodeURIComponent(design.id); return `<button type="button" onclick="openStudioProject(decodeURIComponent('${encodedId}'))" class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-left hover:border-indigo-500 hover:shadow-lg transition"><div class="bg-slate-100 dark:bg-slate-950 overflow-hidden">${studioProjectPreviewMarkup(design)}</div><div class="p-3"><div class="font-black truncate">${escS(design.name || 'Untitled Design')}</div><div class="mt-1 text-xs text-slate-500">${Number(design.width) || 1080} × ${Number(design.height) || 1080} · ${escS(design.status || 'draft')}</div><div class="mt-2 text-xs font-black text-indigo-600">Open and edit →</div></div></button>`; }).join('')}</div>` : '<div class="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 py-12 text-center"><h3 class="font-black">No saved projects yet</h3><p class="mt-1 text-sm text-slate-500">Start on Create or Templates, then save the design.</p><button type="button" onclick="setDesignStudioTab(\'create\')" class="mt-4 rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-black">Create a design</button></div>';
  } catch (error) {
    target.innerHTML = `<div class="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 text-sm font-bold text-rose-600">${escS(error.message || 'Projects could not load.')}</div>`;
  }
}
window.openStudioProjectLibrary = openStudioProjectLibrary;

function openStudioProject(designId) {
  document.getElementById('studio-action-sheet')?.remove();
  window.openMarketSyncStudio(designId, { tab: 'create' });
}
window.openStudioProject = openStudioProject;

async function loadStudioBrandKit(force = false) {
  if (!force && window.__studioBrandKit) return window.__studioBrandKit;
  try { window.__studioBrandKit = (await apiGetJson('/marketing/studio/brand-kit'))?.brand_kit || {}; }
  catch (_) { window.__studioBrandKit = {}; }
  if (window.__studioActiveTool === 'brand') { const panel = document.getElementById('studio-tool-panel'); if (panel) panel.innerHTML = renderStudioToolPanelContent('brand'); }
  return window.__studioBrandKit;
}
window.loadStudioBrandKit = loadStudioBrandKit;
function studioApplyBrandColor(color) { const active = window.__studioAdapter?.fabricCanvas?.getActiveObject(); if (!active) { if (typeof showToast === 'function') showToast('Select an element first.', 'info'); return; } window.__studioAdapter.updateSelected({ fill: color }); }
window.studioApplyBrandColor = studioApplyBrandColor;
function studioApplyBrandFont(kind) { const font = window.__studioBrandKit?.[kind === 'heading' ? 'heading_font' : 'body_font']; if (font) window.__studioAdapter?.updateSelectedText({ fontFamily: font }); }
window.studioApplyBrandFont = studioApplyBrandFont;
async function openStudioBrandKitManager() {
  const kit = await loadStudioBrandKit();
  openStudioSheet('Dealership Brand Kit', `<form onsubmit="event.preventDefault();saveStudioBrandKit()" class="grid sm:grid-cols-2 gap-4">${[['primary_color','Primary colour','color'],['secondary_color','Secondary colour','color'],['accent_color','Accent colour','color'],['heading_font','Heading font','text'],['body_font','Body font','text'],['phone','Dealer phone','text'],['website','Website','url'],['logo_url','Primary logo URL','url'],['alternate_logo_url','Alternate logo URL','url'],['light_logo_url','Light logo URL','url'],['dark_logo_url','Dark logo URL','url'],['logo_mark_url','Logo mark URL','url']].map(([key,label,type]) => `<label class="text-sm font-bold">${label}<input id="studio-brand-${key}" type="${type}" value="${escS(kit[key] || (type === 'color' ? '#2563eb' : ''))}" class="mt-1 w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700"></label>`).join('')}<label class="sm:col-span-2 text-sm font-bold">Legal disclaimer templates<textarea id="studio-brand-legal_disclaimers" rows="4" class="mt-1 w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700">${escS(Array.isArray(kit.legal_disclaimers) ? kit.legal_disclaimers.join('\n') : kit.legal_disclaimers || '')}</textarea></label><button class="sm:col-span-2 py-3 rounded-2xl bg-indigo-600 text-white font-black">Save managed Brand Kit</button></form>`);
}
window.openStudioBrandKitManager = openStudioBrandKitManager;
async function saveStudioBrandKit() {
  const keys = ['primary_color','secondary_color','accent_color','heading_font','body_font','phone','website','logo_url','alternate_logo_url','light_logo_url','dark_logo_url','logo_mark_url'];
  const payload = Object.fromEntries(keys.map(key => [key, document.getElementById(`studio-brand-${key}`)?.value || '']));
  payload.legal_disclaimers = (document.getElementById('studio-brand-legal_disclaimers')?.value || '').split('\n').map(value => value.trim()).filter(Boolean);
  try { window.__studioBrandKit = (await apiSendJson('/marketing/studio/brand-kit', 'PUT', payload))?.brand_kit || payload; document.getElementById('studio-action-sheet')?.remove(); setStudioTool('brand'); if (typeof showToast === 'function') showToast('Brand Kit saved.', 'success'); }
  catch (error) { if (typeof showToast === 'function') showToast(error.message || 'Brand Kit could not be saved.', 'error'); }
}
window.saveStudioBrandKit = saveStudioBrandKit;

let __studioMediaAssets = [];
async function loadStudioMediaLibrary() {
  const target = document.getElementById('studio-media-library'); if (!target) return;
  try {
    const data = await apiGetJson('/marketing/assets');
    __studioMediaAssets = data?.assets || [];
    filterStudioMediaLibrary(document.getElementById('studio-media-query')?.value || '');
  } catch (_) { target.innerHTML = '<div class="col-span-2 p-4 text-center text-xs text-rose-400">Media library unavailable.</div>'; }
}
function filterStudioMediaLibrary(query = '') {
  const target = document.getElementById('studio-media-library'); if (!target) return;
  const q = String(query).toLowerCase();
  const assets = __studioMediaAssets.filter(asset => `${asset.title || ''} ${asset.alt_text || ''}`.toLowerCase().includes(q));
  target.innerHTML = assets.length ? assets.map(asset => {
    const src = asset.public_url || asset.url; const isVideo = asset.kind === 'video';
    return `<div class="overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"><button type="button" onclick="addLibrary${isVideo ? 'Video' : 'Image'}ToCanvas('${escS(src)}','${escS(asset.title || 'Media asset')}')" class="relative block w-full text-left hover:border-indigo-500"><${isVideo ? 'video' : 'img'} src="${escS(src)}" ${isVideo ? 'muted preload="metadata"' : `alt="${escS(asset.alt_text || asset.title || '')}"`} class="w-full aspect-square object-cover"></${isVideo ? 'video' : 'img'}><span class="block px-2 py-1 text-[9px] truncate text-slate-700 dark:text-slate-200">${escS(asset.title || 'Untitled')}</span></button><button type="button" onclick="archiveStudioMedia('${escS(asset.id)}')" class="w-full px-2 py-1 text-[9px] font-bold text-slate-500 hover:text-rose-400">Archive</button></div>`;
  }).join('') : '<div class="col-span-2 p-4 text-center text-xs text-slate-500">No matching media.</div>';
}
window.loadStudioMediaLibrary = loadStudioMediaLibrary;
window.filterStudioMediaLibrary = filterStudioMediaLibrary;
async function uploadStudioImage(input) {
  const file = input.files?.[0]; if (!file) return;
  try { const form = new FormData(); form.append('file', file); form.append('title', file.name); const response = await fetch(`${API}/marketing/assets`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Upload failed'); await loadStudioMediaLibrary(); if (typeof showToast === 'function') showToast('Image added to Media library', 'success'); } catch (error) { if (typeof showToast === 'function') showToast(error.message, 'error'); }
}
window.uploadStudioImage = uploadStudioImage;
async function archiveStudioMedia(assetId) {
  if (!assetId || !confirm('Archive this media asset?')) return;
  try { const response = await fetch(`${API}/marketing/assets/${encodeURIComponent(assetId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Archive failed'); await loadStudioMediaLibrary(); if (typeof showToast === 'function') showToast('Media archived', 'success'); } catch (error) { if (typeof showToast === 'function') showToast(error.message, 'error'); }
}
window.archiveStudioMedia = archiveStudioMedia;

function studioSetObjectGeometry(property, value) {
  const object = window.__studioAdapter?.fabricCanvas?.getActiveObject(); const number = Number(value);
  if (!object || !Number.isFinite(number) || ((property === 'width' || property === 'height') && number < 0)) return;
  if (property === 'width') object.scaleToWidth(Math.max(1, number));
  else if (property === 'height') object.scaleToHeight(Math.max(1, number));
  else object.set(property === 'rotation' ? 'angle' : property, number);
  const breakpoint = window.__studioAdapter?.activeBreakpoint || 'desktop';
  if (breakpoint !== 'desktop') {
    object.msData = object.msData || {};
    object.msData.responsive = object.msData.responsive || {};
    object.msData.responsive[breakpoint] = { ...(object.msData.responsive[breakpoint] || {}), [property]: number };
  }
  object.setCoords(); window.__studioAdapter?.fabricCanvas?.requestRenderAll(); window.__studioAdapter?.saveHistory();
}
window.studioSetObjectGeometry = studioSetObjectGeometry;
function renameStudioLayer(name) {
  const object = window.__studioAdapter?.fabricCanvas?.getActiveObject(); if (!object) return;
  object.msData = { ...(object.msData || {}), name: String(name || 'Untitled layer').slice(0, 120) };
  window.__studioAdapter.saveHistory(); window.__studioAdapter.onSelectionChange([object]);
}
window.renameStudioLayer = renameStudioLayer;

function setStudioPage(pageId) { window.__studioAdapter?.setPage(pageId); setTimeout(syncStudioPageUi, 0); }
window.setStudioPage = setStudioPage;
function renderStudioPageStack(scene = window.__studioAdapter?.currentScene) {
  const stack = document.getElementById('studio-page-stack');
  if (!stack) return;
  const pages = scene?.pages || [];
  const activeId = window.__studioAdapter?.activePageId || pages[0]?.id;
  stack.innerHTML = pages.map((page, index) => `<div class="studio-page-stack-item ${page.id === activeId ? 'is-active' : ''}"><button type="button" onclick="setStudioPage('${escS(page.id)}')" class="studio-page-card" title="Open ${escS(page.name || `Page ${index + 1}`)}"><span class="studio-page-card-canvas" style="background:${escS(page.background?.color || '#0F172A')}"><span>${(page.objects || []).length || 0} objects</span></span><span class="studio-page-card-label">${index + 1}. ${escS(page.name || `Page ${index + 1}`)}</span></button><div class="studio-page-card-actions"><button type="button" onclick="duplicateStudioPage('${escS(page.id)}')" title="Duplicate page">＋</button><button type="button" onclick="deleteStudioPage('${escS(page.id)}')" title="Delete page">×</button></div></div>`).join('') || '<div class="p-3 text-xs text-slate-500">No pages yet.</div>';
}
window.renderStudioPageStack = renderStudioPageStack;
function syncStudioPageUi() {
  renderStudioPageStack();
  const select = document.querySelector('#ms-studio-master-modal footer select');
  const pages = window.__studioAdapter?.currentScene?.pages || [];
  const active = pages.find(page => page.id === window.__studioAdapter?.activePageId) || pages[0];
  const label = document.getElementById('studio-active-page-label');
  if (label) label.textContent = active?.name || 'Page 1';
  if (select) { select.innerHTML = pages.map((page, index) => `<option value="${escS(page.id)}">${escS(page.name || `Page ${index + 1}`)}</option>`).join(''); select.value = window.__studioAdapter?.activePageId || pages[0]?.id || ''; }
}
function duplicateStudioPage(pageId) {
  const adapter = window.__studioAdapter; const current = adapter?.currentScene; const source = current?.pages?.find(page => page.id === pageId); if (!adapter || !current || !source || !window.msStudioSceneToDocument) return;
  const doc = window.msStudioSceneToDocument(adapter.exportScene()); const copy = JSON.parse(JSON.stringify(source)); copy.id = `page_${Date.now()}`; copy.name = `${source.name || 'Page'} copy`; doc.pages.splice(doc.pages.findIndex(page => page.id === source.id) + 1, 0, copy); adapter.currentScene = window.msStudioDocumentToScene(doc); adapter.activePageId = copy.id; window.__studioDocument = doc; window.__msStudioStore?.update(doc); adapter.renderScene(adapter.currentScene); syncStudioPageUi(); if (typeof showToast === 'function') showToast('Page duplicated', 'success');
}
function deleteStudioPage(pageId) {
  const adapter = window.__studioAdapter; const current = adapter?.currentScene; if (!adapter || !current?.pages || current.pages.length <= 1) { if (typeof showToast === 'function') showToast('Keep at least one page', 'info'); return; }
  const doc = window.msStudioSceneToDocument(adapter.exportScene()); const index = doc.pages.findIndex(page => page.id === pageId); if (index < 0) return; doc.pages.splice(index, 1); const next = doc.pages[Math.max(0, index - 1)]; adapter.currentScene = window.msStudioDocumentToScene(doc); adapter.activePageId = next.id; window.__studioDocument = doc; window.__msStudioStore?.update(doc); adapter.renderScene(adapter.currentScene); syncStudioPageUi(); if (typeof showToast === 'function') showToast('Page deleted', 'success');
}
window.duplicateStudioPage = duplicateStudioPage; window.deleteStudioPage = deleteStudioPage;
function addStudioPage() {
  const adapter = window.__studioAdapter; if (!adapter?.currentScene || !window.msStudioAddPage) return;
  const doc = window.msStudioAddPage(window.msStudioSceneToDocument(adapter.exportScene()));
  adapter.currentScene = window.msStudioDocumentToScene(doc); adapter.activePageId = doc.pages[doc.pages.length - 1].id;
  adapter.renderScene(adapter.currentScene); window.__studioDocument = doc; window.__msStudioStore?.update(doc);
  syncStudioPageUi();
  if (typeof showToast === 'function') showToast('New page added', 'success');
}
window.addStudioPage = addStudioPage;

// The dealership photo for a vehicle, across the field names inventory returns.
function studioVehiclePhoto(v) {
  if (!v) return null;
  return v.primary_photo_url || v.photo_url || v.image_url
    || (Array.isArray(v.photos) && v.photos.length ? (v.photos[0]?.url || v.photos[0]) : null) || null;
}

async function loadStudioTemplate(tmplKey) {
  const tmpl = STUDIO_TEMPLATES_CATALOG[tmplKey] || STUDIO_TEMPLATES_CATALOG.tmpl_spotlight_square;
  const scene = JSON.parse(JSON.stringify(tmpl.scene));
  window.__studioAppliedTemplateKey = tmpl.template_key || tmplKey;
  window.__studioAppliedTemplateId = tmpl.template_id || tmpl.id || null;

  // If a vehicle is selected (e.g. via "Create from vehicle"), populate the template
  // with its real photo and details instead of the template's stock placeholder photo.
  const veh = window.__studioCurrentVehicle;
  if (veh) {
    if (window.__studioAdapter) window.__studioAdapter.currentVehicle = veh;  // resolves {{vehicle.*}}
    const photo = studioVehiclePhoto(veh);
    if (photo && Array.isArray(scene.elements)) {
      scene.elements.forEach(el => { if (el.type === 'vehicle-image') el.src = photo; });
    }
  }
  const boundScene = window.msDesignStudioSchema?.refreshBindings
    ? window.msDesignStudioSchema.refreshBindings(scene, studioDesignContext(veh))
    : scene;

  // Wait up to 12s for the fabric adapter + canvas to become ready.
  // The previous 3s cap was firing an alarming "canvas not ready" toast
  // on cellular where fabric.js takes 5-8s to parse. The wait costs
  // nothing when the canvas is already up (returns on first tick).
  const waitForAdapter = async () => {
    for (let i = 0; i < 120; i++) {
      if (window.__studioAdapter && window.__studioAdapter.fabricCanvas) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  };
  const ready = await waitForAdapter();
  if (typeof studioDebugPush === 'function') studioDebugPush(`loadTemplate(${tmplKey}) ready=${ready}`);
  if (!ready) {
    // Silent no-op instead of toast — the previous alarming error
    // showed up over the studio home when a background template
    // preload hadn't finished. If a template really can't render
    // we'll surface it when the visitor explicitly re-taps.
    return;
  }
  try {
    await window.__studioAdapter.renderScene(boundScene);
  } catch (e) {
    if (typeof showToast === 'function') showToast(`Couldn't load ${tmpl.name}: ${e && e.message || 'render failed'}`, 'error');
    return;
  }
  const documentScene = window.msStudioSceneToDocument ? window.msStudioSceneToDocument(boundScene) : boundScene;
  documentScene.metadata = { ...(documentScene.metadata || {}), source_template_key: window.__studioAppliedTemplateKey };
  window.__studioDocument = documentScene;
  window.__msStudioStore?.update(documentScene);
  window.msStudioScheduleAutosave?.(boundScene);
  const container = document.getElementById('studio-artboard-container');
  if (container) { container.style.width = `${boundScene.width}px`; container.style.height = `${boundScene.height}px`; }
  const picker = document.getElementById('studio-format-picker');
  if (picker && STUDIO_SOCIAL_FORMATS[boundScene.format_key]) picker.value = boundScene.format_key;
  window.__studioInitialScene = boundScene;
  window.__studioTemplateFormat = boundScene.format_key || 'square';
  updateStudioSafeGuides(boundScene.format_key || 'square');
  if (window.__studioActiveTool === 'templates') {
    const panel = document.getElementById('studio-tool-panel');
    if (panel) panel.innerHTML = renderStudioToolPanelContent('templates');
  }
  zoomStudioFit();
  // Belt + braces: the fabric canvas sometimes reports objects but
  // paints nothing until a second renderAll after layout settles
  // (image loads race the initial renderAll; canvas wrapper sizing
  // races the CSS transform). Force two more renders + a zoom
  // re-fit so a fresh template is guaranteed to paint.
  const forceRepaint = () => {
    try {
      const fc = window.__studioAdapter?.fabricCanvas;
      if (fc) {
        fc.calcOffset && fc.calcOffset();
        fc.renderAll();
      }
      zoomStudioFit();
      if (typeof studioDebugPush === 'function') {
        const fc2 = window.__studioAdapter?.fabricCanvas;
        const objs = fc2?.getObjects() || [];
        studioDebugPush(`repaint objs=${objs.length} size=${fc2?.getWidth?.()}x${fc2?.getHeight?.()} zoom=${Math.round((window.__studioZoomLevel || 0) * 100)}%`);
        const o0 = objs[0];
        if (o0) studioDebugPush(`obj[0] t=${o0.type} L=${Math.round(o0.left)} T=${Math.round(o0.top)} W=${Math.round(o0.width * (o0.scaleX || 1))} H=${Math.round(o0.height * (o0.scaleY || 1))} vis=${o0.visible !== false} op=${o0.opacity}`);
        // Sniff the actual canvas element dimensions vs container.
        const cvs = document.getElementById('studio-main-canvas');
        const wrap = cvs?.parentElement;
        const cont = document.getElementById('studio-artboard-container');
        if (cvs) studioDebugPush(`cvs attr=${cvs.width}x${cvs.height} css=${cvs.style.width || '?'}x${cvs.style.height || '?'} wrap=${wrap?.offsetWidth}x${wrap?.offsetHeight} cont=${cont?.offsetWidth}x${cont?.offsetHeight}`);
      }
    } catch (_) { /* swallow */ }
  };
  setTimeout(forceRepaint, 120);
  setTimeout(forceRepaint, 700);
  if (typeof showToast === 'function') showToast(`Loaded ${tmpl.name}`, 'success');
}

// "Create from vehicle" quick-start: pick a vehicle from dealership inventory, pull its
// photo + details, drop them into an automotive template, and hand off to editing (and
// then the social scheduler). Reuses loadStudioTemplate — no separate editor. Defaults to
// the square vehicle spotlight when no template is specified.
async function createFromVehicle(vehicleId, tmplKey) {
  const inv = await loadStudioInventory();
  const v = inv.find(x => String(x.id) === String(vehicleId));
  if (!v) { if (typeof showToast === 'function') showToast('That vehicle is no longer available in connected inventory.', 'error'); return; }
  window.__studioCurrentVehicle = v;
  if (window.__studioAdapter) window.__studioAdapter.currentVehicle = v;
  if (typeof setStudioTool === 'function') setStudioTool('templates');   // show the template rail
  await loadStudioTemplate(tmplKey || 'tmpl_spotlight_square');          // populates with the vehicle
  const ymm = `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim();
  if (typeof showToast === 'function') showToast(`Created a design from ${ymm || 'the vehicle'} — edit it, then schedule.`, 'success');
}
window.createFromVehicle = createFromVehicle;

async function loadStudioInventory(force = false) {
  if (!force && Array.isArray(window.__studioInventoryCache)) return window.__studioInventoryCache;
  try {
    const data = await apiGetJson('/inventory');
    window.__studioInventoryCache = Array.isArray(data) ? data : (data?.vehicles || data?.inventory || []);
  } catch (_) { window.__studioInventoryCache = []; }
  return window.__studioInventoryCache;
}

function studioDesignContext(vehicle) {
  const dealer = window.__dealerConfig || {};
  return { vehicle, dealership: { ...dealer, name: dealer.store_name || dealer.name || '', logo_url: dealer.logo_url || dealer.logo || '', legal_disclaimer: dealer.legal_disclaimer || '' }, salesperson: window.__currentUserProfile || {}, cta: 'Shop now' };
}

async function searchStudioInventory(query) {
  const listEl = document.getElementById('studio-inventory-list');
  if (!listEl) return;
  const q = (query || '').toLowerCase().trim();
  const inv = (await loadStudioInventory()).filter(v => !q || `${v.year} ${v.make} ${v.model} ${v.trim || ''} ${v.stock_number || v.stocknumber || ''} ${v.vin || ''}`.toLowerCase().includes(q));

  listEl.innerHTML = inv.map(v => `
    <button onclick="createFromVehicle('${v.id}')" class="w-full text-left p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs font-black text-indigo-400">VEH</div>
      <div class="min-w-0 flex-1">
        <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${escS(`${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || 'Vehicle')}</div>
        <div class="text-[11px] text-emerald-400 font-bold">${v.sale_price || v.price || v.msrp ? `$${Number(v.sale_price || v.price || v.msrp).toLocaleString()}` : 'Price not supplied'} • STK #${escS(v.stock_number || v.stocknumber || '—')}</div>
      </div>
    </button>
  `).join('') || `<div class="text-xs text-slate-500 dark:text-slate-400 italic p-3">No matching inventory.</div>`;
}

async function bindVehicleToStudio(vehicleId) {
  const inv = await loadStudioInventory();
  const v = inv.find(x => String(x.id) === String(vehicleId));
  if (!v) { if (typeof showToast === 'function') showToast('Vehicle not found in connected inventory.', 'error'); return; }
  window.__studioCurrentVehicle = v;
  if (window.__studioAdapter) {
    window.__studioAdapter.currentVehicle = v;
    const refreshed = window.msDesignStudioSchema?.refreshBindings(window.__studioAdapter.exportScene(), studioDesignContext(v));
    if (refreshed) await window.__studioAdapter.renderScene(refreshed);
  }
  if (typeof showToast === 'function') showToast(`Refreshed this design from the canonical ${v.year || ''} ${v.make || ''} ${v.model || ''} inventory record.`, 'success');
}

// Search state — a fresh search resets to page 1 and replaces results; "Load More"
// keeps the query/page and appends the next page instead.
let __studioPhotoQuery = '', __studioPhotoPage = 1, __studioPhotoHasMore = false;
let __studioVideoQuery = '', __studioVideoPage = 1, __studioVideoHasMore = false;

function loadMoreButton(onclick, label) {
  return `<button type="button" onclick="${onclick}" id="studio-load-more-btn" class="col-span-2 w-full mt-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-black text-slate-900 dark:text-white transition">${label}</button>`;
}

async function searchStudioLibrary(query) {
  const target = document.getElementById('studio-photo-results');
  if (!target) return;
  __studioPhotoQuery = String(query || '').trim().toLowerCase();
  __studioPhotoPage = 1;
  target.innerHTML = '<div class="col-span-2 p-5 text-center text-xs text-slate-500 dark:text-slate-400">Searching Pexels…</div>';
  try {
    const data = await apiGetJson(`/marketing/studio/library/search?q=${encodeURIComponent(__studioPhotoQuery || 'car dealership')}&page=1`);
    const results = data?.results || [];
    __studioPhotoHasMore = results.length > 0 && results.length < (data?.total_results || 0);
    target.innerHTML = results.length ? renderPexelsResults(results) : '<div class="col-span-2 p-4 text-center text-xs text-slate-500 dark:text-slate-400">No matching Pexels photos.</div>';
    if (__studioPhotoHasMore) target.insertAdjacentHTML('beforeend', loadMoreButton('loadMoreStudioPhotos()', 'Load more photos'));
  } catch (error) {
    __studioPhotoHasMore = false;
    const fallback = STUDIO_FREE_PHOTOS.filter(photo => !__studioPhotoQuery || `${photo.keywords} ${photo.alt}`.toLowerCase().includes(__studioPhotoQuery));
    target.innerHTML = fallback.length ? renderStudioPhotoResults(fallback) : '<div class="col-span-2 p-4 text-center text-xs text-rose-400">Photo search is temporarily unavailable.</div>';
  }
}

async function loadMoreStudioPhotos() {
  const target = document.getElementById('studio-photo-results');
  const btn = document.getElementById('studio-load-more-btn');
  if (!target || !__studioPhotoHasMore) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
  try {
    const nextPage = __studioPhotoPage + 1;
    const data = await apiGetJson(`/marketing/studio/library/search?q=${encodeURIComponent(__studioPhotoQuery || 'car dealership')}&page=${nextPage}`);
    const results = data?.results || [];
    __studioPhotoPage = nextPage;
    btn?.remove();
    if (results.length) target.insertAdjacentHTML('beforeend', renderPexelsResults(results));
    __studioPhotoHasMore = results.length > 0;
    if (__studioPhotoHasMore) target.insertAdjacentHTML('beforeend', loadMoreButton('loadMoreStudioPhotos()', 'Load more photos'));
  } catch (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Load more photos'; }
  }
}
window.loadMoreStudioPhotos = loadMoreStudioPhotos;

async function searchStudioVideos(query) {
  const target = document.getElementById('studio-video-results');
  if (!target) return;
  __studioVideoQuery = String(query || '').trim();
  __studioVideoPage = 1;
  target.innerHTML = '<div class="p-5 text-center text-xs text-slate-500 dark:text-slate-400">Searching Pexels videos…</div>';
  try {
    const data = await apiGetJson(`/marketing/studio/library/search?type=video&q=${encodeURIComponent(__studioVideoQuery || 'car dealership')}&page=1`);
    const results = data?.results || [];
    __studioVideoHasMore = results.length > 0 && results.length < (data?.total_results || 0);
    target.innerHTML = results.length ? renderStudioVideoResults(results) : '<div class="p-4 text-center text-xs text-slate-500 dark:text-slate-400">No matching videos.</div>';
    if (__studioVideoHasMore) target.insertAdjacentHTML('beforeend', loadMoreButton('loadMoreStudioVideos()', 'Load more videos'));
  } catch (error) {
    __studioVideoHasMore = false;
    target.innerHTML = `<div class="p-4 text-center text-xs text-rose-400">${escS(error.message || 'Video search is unavailable.')}</div>`;
  }
}

async function loadMoreStudioVideos() {
  const target = document.getElementById('studio-video-results');
  const btn = document.getElementById('studio-load-more-btn');
  if (!target || !__studioVideoHasMore) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
  try {
    const nextPage = __studioVideoPage + 1;
    const data = await apiGetJson(`/marketing/studio/library/search?type=video&q=${encodeURIComponent(__studioVideoQuery || 'car dealership')}&page=${nextPage}`);
    const results = data?.results || [];
    __studioVideoPage = nextPage;
    btn?.remove();
    if (results.length) target.insertAdjacentHTML('beforeend', renderStudioVideoResults(results));
    __studioVideoHasMore = results.length > 0;
    if (__studioVideoHasMore) target.insertAdjacentHTML('beforeend', loadMoreButton('loadMoreStudioVideos()', 'Load more videos'));
  } catch (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Load more videos'; }
  }
}
window.loadMoreStudioVideos = loadMoreStudioVideos;

async function loadStudioUploadedVideos() {
  const target = document.getElementById('studio-uploaded-videos');
  if (!target) return;
  try {
    const data = await apiGetJson('/marketing/assets');
    const videos = (data?.assets || []).filter(asset => asset.kind === 'video');
    target.innerHTML = videos.length ? renderStudioVideoResults(videos, true) : '<div class="p-4 text-center text-xs text-slate-500 dark:text-slate-400">No uploaded videos yet.</div>';
  } catch (error) {
    target.innerHTML = '<div class="p-4 text-center text-xs text-rose-400">Your uploads could not be loaded.</div>';
  }
}

async function uploadStudioVideo(input) {
  const file = input.files?.[0];
  if (!file) return;
  const status = document.getElementById('studio-upload-status');
  if (status) { status.classList.remove('hidden'); status.textContent = `Uploading ${file.name}…`; }
  try {
    const form = new FormData(); form.append('file', file); form.append('title', file.name);
    const response = await fetch(`${API}/marketing/assets/video`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Video upload failed');
    if (status) status.textContent = 'Upload complete';
    await loadStudioUploadedVideos();
    if (typeof showToast === 'function') showToast('Video added to your Studio uploads', 'success');
  } catch (error) {
    if (status) { status.textContent = error.message || 'Upload failed'; status.className = 'text-xs text-center text-rose-400'; }
  } finally { input.value = ''; }
}

function addLibraryVideoToCanvas(url, name = 'Video') {
  window.__studioAdapter?.stopDrawingMode();
  window.__studioAdapter?.addVideo(url, name).then(() => {
    if (typeof showToast === 'function') showToast('Video added to the canvas', 'success');
  }).catch(error => { if (typeof showToast === 'function') showToast(error.message || 'Video could not be added', 'error'); });
}

function studioAddShape(shapeType) {
  window.__studioAdapter?.stopDrawingMode();
  window.__studioAdapter?.addShape(shapeType, window.__studioShapeColor || '#2563EB');
}

function setStudioShapeColour(value) {
  const colour = /^#[0-9a-f]{6}$/i.test(String(value || '').trim()) ? String(value).toUpperCase() : null;
  if (!colour) { if (typeof showToast === 'function') showToast('Enter a six-digit hex colour.', 'error'); return; }
  window.__studioShapeColor = colour;
  const picker = document.getElementById('studio-shape-colour'); if (picker) picker.value = colour;
  const hex = document.getElementById('studio-shape-colour-hex'); if (hex) hex.value = colour;
  const active = window.__studioAdapter?.fabricCanvas?.getActiveObject();
  if (active && active.msData?.type === 'shape') studioSetObjectStyle('color', colour);
}
window.setStudioShapeColour = setStudioShapeColour;

function studioDrawingMode(tool) {
  window.__studioAdapter?.setDrawingMode(tool, { color: window.__studioShapeColor || '#2563EB' });
  if (typeof showToast === 'function') showToast(`${tool === 'pen' ? 'Pen' : 'Pencil'} active — draw directly on the canvas`, 'info');
}

function studioSelectMode() {
  window.__studioAdapter?.stopDrawingMode();
  if (typeof showToast === 'function') showToast('Select mode — objects can be moved, resized, and rotated', 'info');
}

function studioSetObjectStyle(property, value) {
  const active = window.__studioAdapter?.fabricCanvas?.getActiveObject();
  if (!active) { if (typeof showToast === 'function') showToast('Select an object first', 'info'); return; }
  if (property === 'color') {
    const usesStroke = active.type === 'path' && (!active.fill || active.fill === '');
    window.__studioAdapter.updateSelected(usesStroke ? { stroke: value } : { fill: value });
  } else window.__studioAdapter.updateSelected({ [property]: value });
}
function studioSetAnimation(value) { if (!window.__studioAdapter?.setSelectedAnimation(value) && typeof showToast === 'function') showToast('Select an object first', 'info'); }
window.studioSetAnimation = studioSetAnimation;

function studioToggleNodes() {
  const editing = window.__studioAdapter?.toggleNodeEditing();
  if (editing == null) { if (typeof showToast === 'function') showToast('Select a vector shape such as a star, polygon, diamond, or speech bubble first', 'info'); return; }
  if (typeof showToast === 'function') showToast(editing ? 'Node editing on — drag the blue points' : 'Node editing off', 'info');
}

function studioAddText(kind) {
  if (!window.__studioAdapter) return;
  const options = kind === 'heading' ? { fontSize: 64, fontWeight: '900' }
    : kind === 'subheading' ? { fontSize: 36, fontWeight: '700' }
      : { fontSize: 24, fontWeight: '500' };
  options.fontFamily = window.__studioSelectedFont;
  const copy = kind === 'heading' ? 'ADD A HEADING' : kind === 'subheading' ? 'Add a subheading' : 'Add body text';
  window.__studioAdapter.addText(copy, options);
}

function studioSetTextStyle(property, value) {
  if (!window.__studioAdapter?.updateSelectedText({ [property]: value })) {
    if (typeof showToast === 'function') showToast('Select a text box first', 'info');
  }
}
function studioTransformText(mode) {
  const object = window.__studioAdapter?.fabricCanvas?.getActiveObject();
  if (!object || !['textbox', 'text', 'i-text'].includes(object.type)) return;
  const text = String(object.text || '');
  window.__studioAdapter.updateSelectedText({ text: mode === 'lowercase' ? text.toLowerCase() : text.toUpperCase() });
}
window.studioTransformText = studioTransformText;

async function generateStudioAiCopy() {
  const prompt = document.getElementById('studio-ai-prompt')?.value?.trim();
  if (!prompt) { if (typeof showToast === 'function') showToast('Describe the content you want first', 'info'); return; }
  const btn = document.getElementById('studio-ai-generate');
  const result = document.getElementById('studio-ai-result');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
  try {
    const response = await apiSendJson('/ai/studio-copy', 'POST', { prompt });
    const copy = String(response?.copy || '').trim();
    if (!copy) throw new Error('No content returned');
    if (result) {
      result.classList.remove('hidden');
      result.innerHTML = `${escS(copy)}<button type="button" onclick="studioAddGeneratedCopy()" class="mt-3 w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold">Add to canvas</button>`;
      result.dataset.copy = copy;
    }
  } catch (error) {
    if (typeof showToast === 'function') showToast(error.message || 'AI content could not be generated', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Generate content'; }
  }
}

// The backend returns a clear 503 if no image-gen provider key is configured
// for this server, surfaced here rather than pretending it worked.
async function generateStudioAiImage() {
  const prompt = document.getElementById('studio-ai-image-prompt')?.value?.trim();
  if (!prompt) { if (typeof showToast === 'function') showToast('Describe the image you want first', 'info'); return; }
  const btn = document.getElementById('studio-ai-image-generate');
  const result = document.getElementById('studio-ai-image-result');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
  try {
    const response = await apiSendJson('/ai/studio-image', 'POST', { prompt });
    const url = response?.url;
    if (!url) throw new Error('No image returned');
    if (result) {
      result.classList.remove('hidden');
      result.innerHTML = `<img src="${escS(url)}" alt="${escS(prompt)}" class="w-full rounded-xl border border-slate-200 dark:border-slate-800 mb-2"><button type="button" onclick="addLibraryImageToCanvas('${escS(url)}', 'AI image')" class="w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold">Add to canvas</button>`;
    }
  } catch (error) {
    if (typeof showToast === 'function') showToast(error.message || 'AI image could not be generated', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Generate image'; }
  }
}
window.generateStudioAiImage = generateStudioAiImage;

// Replaces the whole scene with an AI-generated layout — same load path as
// picking a template from the library (renderScene), just with a
// server-generated scene instead of one from STUDIO_TEMPLATES_CATALOG.
async function generateStudioAiTemplate() {
  const prompt = document.getElementById('studio-ai-template-prompt')?.value?.trim();
  if (!prompt) { if (typeof showToast === 'function') showToast('Describe the template you want first', 'info'); return; }
  const btn = document.getElementById('studio-ai-template-generate');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
  try {
    const current = window.__studioAdapter?.currentScene;
    const formatKey = document.getElementById('studio-format-picker')?.value || current?.format_key || 'square';
    const size = STUDIO_SOCIAL_FORMATS[formatKey] || { w: current?.width || 1080, h: current?.height || 1080 };
    const response = await apiSendJson('/ai/studio-template', 'POST', { prompt, format_key: formatKey, width: size.w, height: size.h });
    const scene = response?.scene;
    if (!scene) throw new Error('No template returned');
    if (window.__studioAdapter) await window.__studioAdapter.renderScene(scene);
    const container = document.getElementById('studio-artboard-container');
    if (container) { container.style.width = `${scene.width}px`; container.style.height = `${scene.height}px`; }
    updateStudioSafeGuides(scene.format_key || formatKey);
    zoomStudioFit();
    if (typeof showToast === 'function') showToast(`Loaded ${response.name || 'AI template'}`, 'success');
  } catch (error) {
    if (typeof showToast === 'function') showToast(error.message || 'AI template could not be generated', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Generate template'; }
  }
}
window.generateStudioAiTemplate = generateStudioAiTemplate;

function studioAddGeneratedCopy() {
  const copy = document.getElementById('studio-ai-result')?.dataset?.copy;
  if (copy && window.__studioAdapter) window.__studioAdapter.addText(copy, { fontSize: 36, fontWeight: '800', width: 700, fontFamily: window.__studioSelectedFont });
}

function addLibraryImageToCanvas(url, name = 'Photo Asset') {
  if (window.__studioAdapter) {
    window.__studioAdapter.addImage(url, name);
    if (typeof showToast === 'function') showToast('Added image to artboard', 'success');
  }
}

function openStudioSheet(title, body) {
  document.getElementById('studio-action-sheet')?.remove();
  const sheet = document.createElement('div');
  sheet.id = 'studio-action-sheet';
  sheet.className = 'fixed inset-0 z-[100001] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4';
  sheet.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="studio-sheet-title" class="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-[28px] bg-white dark:bg-slate-900 border border-white/40 dark:border-white/10 shadow-2xl text-slate-900 dark:text-white"><header class="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800"><h2 id="studio-sheet-title" class="text-xl font-black">${escS(title)}</h2><button type="button" onclick="document.getElementById('studio-action-sheet')?.remove()" class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-xl">×</button></header><div class="p-6">${body}</div></section>`;
  sheet.addEventListener('click', event => { if (event.target === sheet) sheet.remove(); });
  document.body.appendChild(sheet); return sheet;
}

function openStudioMagicResize() {
  const current = window.__studioAdapter?.exportScene(); if (!current) return;
  const formats = window.msDesignStudioFormats || Object.fromEntries(Object.entries(STUDIO_SOCIAL_FORMATS).map(([key, value]) => [key, { label:value.label, width:value.w, height:value.h }]));
  openStudioSheet('Magic Resize · Create variations', `<p class="text-sm text-slate-600 dark:text-slate-300 mb-4">MarketSync will create editable pages and reflow vehicle imagery, headlines, offers, CTA buttons, logos, and disclaimers. Your current page stays unchanged.</p><form onsubmit="event.preventDefault();generateStudioVariations()"><div class="grid sm:grid-cols-2 gap-3">${Object.entries(formats).map(([key, format]) => `<label class="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-violet-500"><input type="checkbox" name="studio-variation" value="${key}" ${key === current.format_key ? '' : 'checked'}><span><b class="block text-sm">${escS(format.label)}</b><span class="text-xs text-slate-500">${format.width}×${format.height}</span></span></label>`).join('')}</div><button class="mt-5 w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-black">Create editable variations</button></form>`);
}
window.openStudioMagicResize = openStudioMagicResize;

async function generateStudioVariations() {
  const adapter = window.__studioAdapter, schema = window.msDesignStudioSchema;
  if (!adapter || !schema || typeof window.msStudioSceneToDocument !== 'function' || typeof window.msStudioDocumentToScene !== 'function') { if (typeof showToast === 'function') showToast('Magic Resize did not finish loading. Refresh the Studio and try again.', 'error'); return; }
  const selected = [...document.querySelectorAll('input[name="studio-variation"]:checked')].map(input => input.value);
  if (!selected.length) { if (typeof showToast === 'function') showToast('Choose at least one output size.', 'info'); return; }
  try {
    const source = adapter.exportScene(), doc = window.msStudioSceneToDocument(source);
    const variations = schema.createVariations({ ...source, id: adapter.activePageId || source.id }, selected);
    if (!variations.length) throw new Error('No compatible output formats were selected.');
    doc.pages.push(...variations); doc.version = 3; doc.metadata = { ...(doc.metadata || {}), variation_set_updated_at: new Date().toISOString() };
    window.__studioDocument = doc; adapter.currentScene = window.msStudioDocumentToScene(doc); adapter.activePageId = variations[0].id;
    await adapter.renderScene(adapter.currentScene); window.__msStudioStore?.update(doc); window.msStudioScheduleAutosave?.(adapter.currentScene); syncStudioPageUi();
    document.getElementById('studio-action-sheet')?.remove(); zoomStudioFit();
    if (typeof showToast === 'function') showToast(`${variations.length} editable variations created.`, 'success');
  } catch (error) { if (typeof showToast === 'function') showToast(error?.message || 'Magic Resize could not create variations.', 'error'); }
}
window.generateStudioVariations = generateStudioVariations;

async function openStudioAiDesign() {
  const inventory = await loadStudioInventory();
  const options = inventory.map(vehicle => `<option value="${escS(vehicle.id)}">${escS(`${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.trim || ''}`.trim())} · ${escS(vehicle.stock_number || vehicle.stocknumber || 'No stock #')}</option>`).join('');
  openStudioSheet('AI Design · Editable dealership creative', `<p class="text-sm text-slate-600 dark:text-slate-300">Describe the campaign. AI creates layout structures with protected placeholders; MarketSync then fills them locally from your connected inventory and Brand Kit.</p><form onsubmit="event.preventDefault();generateStudioAiDesignOptions()" class="mt-5 space-y-4"><label class="block text-sm font-bold">Campaign request<textarea id="studio-ai-design-prompt" rows="3" required placeholder="Create a weekend sale for a 2027 GMC Sierra AT4" class="mt-2 w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700"></textarea></label><label class="block text-sm font-bold">Connected vehicle<select id="studio-ai-design-vehicle" ${inventory.length ? '' : 'disabled'} class="mt-2 w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700"><option value="">No vehicle selected</option>${options}</select></label>${inventory.length ? '' : '<p class="text-sm text-amber-600">No available inventory records are connected. The layout can still be generated, but MarketSync will not invent vehicle facts.</p>'}<button id="studio-ai-design-submit" class="w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-black">Generate three editable options</button><div id="studio-ai-design-results" class="grid sm:grid-cols-3 gap-3"></div></form>`);
}
window.openStudioAiDesign = openStudioAiDesign;

async function generateStudioAiDesignOptions() {
  const prompt = document.getElementById('studio-ai-design-prompt')?.value?.trim(); if (!prompt) return;
  const button = document.getElementById('studio-ai-design-submit'), results = document.getElementById('studio-ai-design-results');
  const vehicleId = document.getElementById('studio-ai-design-vehicle')?.value;
  const vehicle = (await loadStudioInventory()).find(item => String(item.id) === String(vehicleId)) || null;
  const current = window.__studioAdapter?.exportScene(), formatKey = current?.format_key || 'square', size = STUDIO_SOCIAL_FORMATS[formatKey] || { w: 1080, h: 1080 };
  if (button) { button.disabled = true; button.textContent = 'Creating editable layouts…'; }
  try {
    const styles = ['minimal premium editorial', 'bold automotive retail', 'clean high-contrast modern'];
    const responses = await Promise.all(styles.map(style => apiSendJson('/ai/studio-template', 'POST', { prompt: `${prompt}. Visual direction: ${style}. Use factual placeholders for every vehicle, dealership, price, payment, incentive, rate, and legal claim.`, format_key: formatKey, width: size.w, height: size.h })));
    window.__studioAiDesignOptions = responses.map((response, index) => ({ name: response.name || `Option ${index + 1}`, scene: window.msDesignStudioSchema?.refreshBindings(response.scene, studioDesignContext(vehicle)) || response.scene }));
    if (results) results.innerHTML = window.__studioAiDesignOptions.map((option, index) => `<button type="button" onclick="applyStudioAiDesign(${index})" class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-violet-500 text-left"><span class="block text-[10px] uppercase font-black text-violet-500">Editable option ${index + 1}</span><b class="block mt-1">${escS(option.name)}</b><span class="block mt-2 text-xs text-slate-500">${option.scene.elements?.length || 0} editable layers</span></button>`).join('');
  } catch (error) { if (typeof showToast === 'function') showToast(error.message || 'AI designs could not be generated', 'error'); }
  finally { if (button) { button.disabled = false; button.textContent = 'Generate three editable options'; } }
}
window.generateStudioAiDesignOptions = generateStudioAiDesignOptions;

async function applyStudioAiDesign(index) {
  const option = window.__studioAiDesignOptions?.[index]; if (!option?.scene || !window.__studioAdapter) return;
  await window.__studioAdapter.renderScene(option.scene); window.__studioDocument = window.msStudioSceneToDocument(option.scene, { title: option.name });
  window.__msStudioStore?.update(window.__studioDocument); window.msStudioScheduleAutosave?.(option.scene); document.getElementById('studio-action-sheet')?.remove(); zoomStudioFit();
  if (typeof showToast === 'function') showToast(`${option.name} is ready to edit.`, 'success');
}
window.applyStudioAiDesign = applyStudioAiDesign;

function openStudioExport() {
  openStudioSheet('Export design', `<p class="text-sm text-slate-600 dark:text-slate-300 mb-4">Export the active page at its full dimensions. Transparent PNG removes the page background only.</p><div class="grid sm:grid-cols-2 gap-3"><button onclick="exportStudioFile('png')" class="p-4 rounded-2xl bg-indigo-600 text-white font-black">PNG · full quality</button><button onclick="exportStudioFile('jpeg')" class="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 font-black">JPG · optimized</button><button onclick="exportStudioFile('transparent')" class="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 font-black">Transparent PNG</button><button onclick="renderStudioDesignAndPublish()" class="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 font-black">Render for MarketSync handoff</button></div>`);
}
window.openStudioExport = openStudioExport;

function exportStudioFile(format = 'png') {
  const canvas = window.__studioAdapter?.fabricCanvas; if (!canvas) return;
  const transparent = format === 'transparent', previous = canvas.backgroundColor;
  if (transparent) canvas.setBackgroundColor('rgba(0,0,0,0)', canvas.renderAll.bind(canvas));
  const mimeFormat = format === 'jpeg' ? 'jpeg' : 'png';
  const url = canvas.toDataURL({ format: mimeFormat, quality: format === 'jpeg' ? .92 : 1, multiplier: 1 });
  if (transparent) canvas.setBackgroundColor(previous, canvas.renderAll.bind(canvas));
  const link = document.createElement('a'); link.href = url; link.download = `${(document.getElementById('studio-design-name')?.value || 'marketsync-design').replace(/[^a-z0-9_-]+/gi, '-')}.${mimeFormat === 'jpeg' ? 'jpg' : 'png'}`; link.click();
}
window.exportStudioFile = exportStudioFile;

async function openStudioCollaboration() {
  const design = window.__studioCurrentDesign;
  if (!design?.id) { if (typeof showToast === 'function') showToast('Save the design before starting review.', 'info'); return; }
  let collaboration = { comments: [], approvals: [] };
  try { collaboration = await apiGetJson(`/marketing/studio/designs/${design.id}/collaboration`); } catch (_) {}
  openStudioSheet('Comments & approvals', `<div class="grid md:grid-cols-2 gap-6"><section><h3 class="font-black">Comments</h3><div class="mt-3 space-y-2 max-h-72 overflow-y-auto">${(collaboration.comments || []).map(comment => `<article class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950"><p class="text-sm">${escS(comment.body)}</p><time class="text-[10px] text-slate-500">${escS(new Date(comment.created_at).toLocaleString())}</time></article>`).join('') || '<p class="text-sm text-slate-500">No comments yet.</p>'}</div><form onsubmit="event.preventDefault();addStudioComment()" class="mt-3"><textarea id="studio-comment-body" rows="3" required placeholder="Leave feedback or @mention a teammate…" class="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700"></textarea><button class="mt-2 w-full py-2 rounded-xl bg-slate-800 dark:bg-slate-700 text-white font-bold">Add comment</button></form></section><section><h3 class="font-black">Approval workflow</h3><div class="mt-3 space-y-2">${(collaboration.approvals || []).map(approval => `<article class="p-3 rounded-2xl border border-slate-200 dark:border-slate-700"><b class="text-sm capitalize">${escS(String(approval.status).replace('_',' '))}</b><p class="text-xs text-slate-500">Revision ${approval.revision_number || 'current'} · ${escS(approval.note || '')}</p>${approval.status === 'requested' ? `<div class="grid grid-cols-3 gap-1 mt-2"><button onclick="decideStudioApproval('${approval.id}','approved')" class="py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black">Approve</button><button onclick="decideStudioApproval('${approval.id}','revision_requested')" class="py-1 rounded-lg bg-amber-500 text-white text-[10px] font-black">Revise</button><button onclick="decideStudioApproval('${approval.id}','rejected')" class="py-1 rounded-lg bg-rose-600 text-white text-[10px] font-black">Reject</button></div>` : ''}</article>`).join('') || '<p class="text-sm text-slate-500">No approval request yet.</p>'}</div><form onsubmit="event.preventDefault();requestStudioApproval()" class="mt-3"><textarea id="studio-approval-note" rows="2" placeholder="Note for the reviewer" class="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700"></textarea><button class="mt-2 w-full py-2 rounded-xl bg-indigo-600 text-white font-black">Request approval</button></form></section></div>`);
}
window.openStudioCollaboration = openStudioCollaboration;
async function addStudioComment() { const body = document.getElementById('studio-comment-body')?.value?.trim(); if (!body) return; await apiSendJson(`/marketing/studio/designs/${window.__studioCurrentDesign.id}/comments`, 'POST', { body }); openStudioCollaboration(); }
window.addStudioComment = addStudioComment;
async function requestStudioApproval() { const note = document.getElementById('studio-approval-note')?.value?.trim(); await saveStudioDesign(); await apiSendJson(`/marketing/studio/designs/${window.__studioCurrentDesign.id}/approval-requests`, 'POST', { note }); openStudioCollaboration(); }
window.requestStudioApproval = requestStudioApproval;
async function decideStudioApproval(id, status) { await apiSendJson(`/marketing/studio/designs/${window.__studioCurrentDesign.id}/approvals/${id}/decision`, 'POST', { status }); openStudioCollaboration(); }
window.decideStudioApproval = decideStudioApproval;

async function changeStudioFormat(formatKey) {
  const sz = STUDIO_SOCIAL_FORMATS[formatKey] || STUDIO_SOCIAL_FORMATS.square;
  const container = document.getElementById('studio-artboard-container');
  if (container) {
    container.style.width = `${sz.w}px`;
    container.style.height = `${sz.h}px`;
  }
  if (window.__studioAdapter) {
    const current = window.__studioAdapter.exportScene();
    const reflowed = window.msDesignStudioSchema?.reflowScene(current, formatKey);
    if (reflowed) {
      // The persisted model is page-based. Keep the active page and top-level
      // compatibility scene in sync so resize is not discarded by normalization.
      if (Array.isArray(reflowed.pages) && reflowed.pages.length) {
        const activeId = window.__studioAdapter.activePageId || reflowed.pages[0].id;
        reflowed.pages = reflowed.pages.map(page => page.id === activeId ? { ...page, format_key: formatKey, width: sz.w, height: sz.h, background: reflowed.background, objects: JSON.parse(JSON.stringify(reflowed.elements || [])) } : page);
      }
      await window.__studioAdapter.renderScene(reflowed);
      window.__studioDocument = window.msStudioSceneToDocument?.(reflowed) || reflowed;
      window.__msStudioStore?.update(window.__studioDocument);
    } else window.__studioAdapter.resizeCanvas(sz.w, sz.h);
  }
  window.__studioInitialScene = window.__studioAdapter?.exportScene?.() || { format_key: formatKey, width: sz.w, height: sz.h };
  window.__studioTemplateFormat = formatKey;
  updateStudioSafeGuides(formatKey);
  if (window.__studioActiveTool === 'templates') {
    const panel = document.getElementById('studio-tool-panel');
    if (panel) panel.innerHTML = renderStudioToolPanelContent('templates');
  }
  zoomStudioFit();
  if (typeof showToast === 'function') showToast(`Format set to ${formatKey.toUpperCase()}`, 'info');
}

function setStudioBreakpoint(breakpoint) {
  window.__studioAdapter?.setBreakpoint(breakpoint);
  document.querySelectorAll('[data-studio-breakpoint]').forEach(button => {
    const active = button.dataset.studioBreakpoint === breakpoint;
    button.classList.toggle('bg-indigo-600', active);
    button.classList.toggle('text-white', active);
    button.classList.toggle('font-black', active);
    button.classList.toggle('font-bold', !active);
  });
}
window.setStudioBreakpoint = setStudioBreakpoint;

function filterStudioTemplates(formatKey) {
  // Kept for the public panel API; cards remain constrained to the real canvas
  // dimensions even if an older integration passes a different format key.
  window.__studioTemplateFormat = formatKey || studioActiveCanvasSize().formatKey; window.__studioTemplateLimit = 24;
  const cards = document.getElementById('studio-template-cards');
  if (cards) cards.innerHTML = renderStudioTemplateCards(formatKey);
}
function filterStudioTemplateCategory(category) { window.__studioTemplateCategory = category; window.__studioTemplateLimit = 24; const cards = document.getElementById('studio-template-cards'); if (cards) cards.innerHTML = renderStudioTemplateCards(); }
function loadMoreStudioTemplates() { window.__studioTemplateLimit = (window.__studioTemplateLimit || 24) + 24; const cards = document.getElementById('studio-template-cards'); if (cards) cards.innerHTML = renderStudioTemplateCards(); }
window.filterStudioTemplateCategory = filterStudioTemplateCategory; window.loadMoreStudioTemplates = loadMoreStudioTemplates;

function updateStudioSafeGuides(formatKey) {
  const old = document.getElementById('studio-safe-guides');
  if (old) old.outerHTML = renderStudioSafeGuides(formatKey);
}

function toggleStudioGuides() {
  const guides = document.getElementById('studio-safe-guides');
  const button = document.getElementById('studio-guides-toggle');
  if (!guides) return;
  guides.classList.toggle('hidden');
  if (button) button.textContent = guides.classList.contains('hidden') ? 'Guides off' : 'Guides on';
}

function toggleStudioGrid() {
  const board = document.getElementById('studio-artboard-container');
  const button = document.getElementById('studio-grid-toggle');
  if (!board) return;
  board.classList.toggle('ms-studio-grid-on');
  if (button) button.textContent = board.classList.contains('ms-studio-grid-on') ? 'Grid on' : 'Grid off';
}
window.toggleStudioGrid = toggleStudioGrid;

// Renaming a design that already exists persists straight away, so the title in
// the header and the title in My Designs never disagree. A design that has not
// been saved yet has nothing to rename — the name it carries is picked up by the
// next save, which is where it becomes real.
async function saveStudioDesignName(name) {
  const clean = String(name || '').trim() || 'Untitled Design';
  const input = document.getElementById('studio-design-name');
  if (input && input.value !== clean) input.value = clean;
  const design = window.__studioCurrentDesign;
  if (!design?.id) return;
  if (design.name === clean) return;
  try {
    await apiSendJson(`/marketing/studio/designs/${design.id}`, 'PUT', { name: clean });
    design.name = clean;
    if (typeof showToast === 'function') showToast('Design renamed', 'success');
  } catch (e) {
    if (typeof showToast === 'function') showToast('Rename failed: ' + e.message, 'error');
  }
}
window.saveStudioDesignName = saveStudioDesignName;

async function saveStudioDesign() {
  if (!window.__studioAdapter) return;
  const scene = window.__studioAdapter.exportScene();
  const name = document.getElementById('studio-design-name')?.value || 'Untitled Design';

  const persistedScene = window.msStudioSceneToDocument ? window.msStudioSceneToDocument(scene, { title: name }) : scene;
  persistedScene.metadata = { ...(persistedScene.metadata || {}), source_template_key: window.__studioAppliedTemplateKey || persistedScene.metadata?.source_template_key || null };
  const templateId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(window.__studioAppliedTemplateId || '')) ? window.__studioAppliedTemplateId : null;
  const payload = {
    name,
    format_key: scene.format_key || 'square',
    width: scene.width,
    height: scene.height,
    scene: persistedScene,
    template_id: templateId,
    change_summary: 'Saved Studio draft',
    vehicle_id: window.__studioCurrentVehicle?.id || null
  };

  try {
    if (window.__studioCurrentDesign?.id) {
      const res = await apiSendJson(`/marketing/studio/designs/${window.__studioCurrentDesign.id}`, 'PUT', payload);
      if (res?.design) window.__studioCurrentDesign = res.design;
    } else {
      const res = await apiSendJson('/marketing/studio/designs', 'POST', payload);
      if (res?.design) window.__studioCurrentDesign = res.design;
    }
    if (window.__msStudioStore) window.__msStudioStore.saved(persistedScene, window.__studioCurrentDesign?.id);
    const status = document.getElementById('studio-save-status');
    if (status) { status.textContent = 'SAVED'; status.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'; }
    if (typeof showToast === 'function') showToast('Design saved', 'success');
    return true;
  } catch (e) {
    if (typeof showToast === 'function') showToast('Save failed: ' + e.message, 'error');
    return false;
  }
}

async function publishStudioDesign() {
  if (!await saveStudioDesign()) return;
  const id = window.__studioCurrentDesign?.id;
  if (!id) return;
  try {
    const res = await apiSendJson(`/marketing/studio/designs/${id}/status`, 'POST', { status: 'published' });
    if (res?.design) window.__studioCurrentDesign = res.design;
    window.__msStudioStore?.setStatus('PUBLISHED', false);
    if (typeof showToast === 'function') showToast('Design published', 'success');
  } catch (e) { if (typeof showToast === 'function') showToast('Publish failed: ' + e.message, 'error'); }
}
window.publishStudioDesign = publishStudioDesign;

async function openStudioRevisionHistory() {
  const id = window.__studioCurrentDesign?.id;
  if (!id) { if (typeof showToast === 'function') showToast('Save the design once to create history', 'info'); return; }
  try {
    const res = await apiGetJson(`/marketing/studio/designs/${id}/revisions`);
    const revisions = res?.revisions || [];
    const rows = revisions.length ? revisions.map(rev => `<div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-700"><div class="min-w-0"><div class="text-sm font-bold text-white">Revision ${rev.revision_number}</div><div class="text-[11px] text-slate-400 truncate">${escS(rev.change_summary || 'Saved draft')} · ${new Date(rev.created_at).toLocaleString()}</div></div><button type="button" onclick="restoreStudioRevision('${rev.id}')" class="shrink-0 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-indigo-600 text-xs font-bold text-white">Restore</button></div>`).join('') : '<p class="text-sm text-slate-400">No saved revisions yet.</p>';
    if (typeof crmOverlay === 'function') crmOverlay(`<div class="p-5 space-y-4 max-w-xl"><div class="flex items-center justify-between"><h3 class="text-lg font-black text-white">Design history</h3><span class="text-xs text-slate-400">${revisions.length} checkpoints</span></div><p class="text-xs text-slate-400">Restoring creates a new draft revision, so published work remains protected.</p><div class="space-y-2 max-h-[55vh] overflow-y-auto">${rows}</div></div>`);
  } catch (e) { if (typeof showToast === 'function') showToast('History unavailable: ' + e.message, 'error'); }
}
window.openStudioRevisionHistory = openStudioRevisionHistory;

async function restoreStudioRevision(revisionId) {
  const id = window.__studioCurrentDesign?.id;
  if (!id) return;
  try {
    const res = await apiSendJson(`/marketing/studio/designs/${id}/revisions/${revisionId}/restore`, 'POST', {});
    if (res?.design) {
      window.__studioCurrentDesign = res.design;
      const scene = window.msStudioDocumentToScene ? window.msStudioDocumentToScene(res.design.scene) : res.design.scene;
      await window.__studioAdapter?.renderScene(scene);
      window.__msStudioStore?.saved(res.design.scene, res.design.id);
      document.getElementById('studio-design-name').value = res.design.name || document.getElementById('studio-design-name').value;
    }
    document.querySelector('[data-crm-overlay-close]')?.click();
    if (typeof showToast === 'function') showToast('Revision restored as a draft', 'success');
  } catch (e) { if (typeof showToast === 'function') showToast('Restore failed: ' + e.message, 'error'); }
}
window.restoreStudioRevision = restoreStudioRevision;

function hasSocialSchedulerEntitlement() {
  const access = (typeof window !== 'undefined' && window.__access) ? window.__access : {};
  if (access.isPlatformStaff) return true;
  const feats = access.features || [];
  const prods = access.products || [];
  return feats.includes('social.scheduler') || feats.includes('os.marketing') ||
    prods.includes('marketsync_social') || prods.includes('social-scheduler') ||
    prods.includes('complete-marketing-suite') || prods.includes('sales-marketing-suite') ||
    prods.includes('service-marketing-suite') || prods.includes('marketsync-digital') ||
    prods.includes('dealer-os-core') || prods.includes('dealer-os-pro') || prods.includes('dealer-os-complete');
}
window.hasSocialSchedulerEntitlement = hasSocialSchedulerEntitlement;

function showSocialSchedulerUpgradeModal() {
  if (typeof crmOverlay === 'function') {
    crmOverlay(`
      <div class="p-6 space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5"/></svg>
          </div>
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white">Social publishing is not enabled</h3>
            <p class="text-xs text-slate-500">Review this account's subscription to schedule and distribute designs.</p>
          </div>
        </div>
        <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Your design remains saved and editable. Direct publishing and scheduling become available when Social Scheduler or an eligible MarketSync suite is active for this account.
        </p>
        <div class="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <a href="upgrade.html" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md transition">View Upgrade Options</a>
          <button onclick="this.closest('.fixed').remove();" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">Dismiss</button>
        </div>
      </div>
    `, 'max-w-md');
  } else {
    alert('Social Scheduler is required to schedule posts. Please upgrade in subscription settings.');
  }
}
window.showSocialSchedulerUpgradeModal = showSocialSchedulerUpgradeModal;

function openStudioSchedulerWithEntitlementCheck() {
  if (!hasSocialSchedulerEntitlement()) {
    showSocialSchedulerUpgradeModal();
    return;
  }
  // Schedule is its own destination, not a view nested inside Design Studio —
  // close Studio (if it's the one open) and hand off to the real, standalone,
  // entitlement-gated Social Scheduler page.
  if (document.getElementById('ms-studio-master-modal') && typeof closeMarketSyncStudio === 'function') {
    closeMarketSyncStudio();
  }
  if (typeof switchPage === 'function') switchPage('social-scheduler');
}
window.openStudioSchedulerWithEntitlementCheck = openStudioSchedulerWithEntitlementCheck;

async function renderStudioDesignAndPublish() {
  if (!window.__studioAdapter) return;

  if (!hasSocialSchedulerEntitlement()) {
    showSocialSchedulerUpgradeModal();
    return;
  }

  await saveStudioDesign();
  const scene = window.__studioAdapter.exportScene();

  try {
    const res = await apiSendJson('/marketing/studio/render', 'POST', {
      name: document.getElementById('studio-design-name')?.value || 'Studio Creative',
      scene
    });

    if (res?.asset?.public_url) {
      // studioSchedulerCompose() closes Design Studio and hands off to the real,
      // standalone, entitlement-gated Social Scheduler page
      // (data-page-content="social-scheduler"), pre-selecting this rendered asset
      // for the new post — mktCompose() below is only a fallback for the case
      // where studio-scheduler.js somehow isn't loaded, since it mounts into the
      // full DealerOS Marketing engine page that a Design-Studio-only account
      // never renders.
      if (typeof window.studioSchedulerCompose === 'function') {
        const designId = window.__studioCurrentDesign?.id;
        let editableAssetUrl = res.asset.public_url;
        if (designId) {
          try {
            const linkedAsset = new URL(editableAssetUrl, window.location.origin);
            linkedAsset.searchParams.set('studio_design', designId);
            editableAssetUrl = linkedAsset.toString();
          } catch {}
        }
        window.studioSchedulerCompose(editableAssetUrl);
      } else if (typeof window.mktCompose === 'function') {
        closeMarketSyncStudio();
        window.mktCompose({ assetUrl: res.asset.public_url });
      }
      if (typeof showToast === 'function') showToast('Design rendered — choose where to post it.', 'success');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Render error: ' + e.message, 'error');
  }
}

function closeMarketSyncStudio() {
  // Restore any DealerOS chrome we hid on open (Demo badge, legacy
  // mode-switch pill). Keyed off dataset flags we set in
  // openMarketSyncStudio so we don't clobber intentional user hides.
  const badge = document.getElementById('demo-mode-badge');
  if (badge && badge.dataset.msStudioHidden) { badge.style.display = ''; delete badge.dataset.msStudioHidden; }
  const legacyMs = document.getElementById('ms-mode-switch');
  if (legacyMs && legacyMs.dataset.msStudioHidden) { legacyMs.style.display = ''; delete legacyMs.dataset.msStudioHidden; }
  window.__studioFitObserver?.disconnect();
  window.__studioFitObserver = null;
  document.getElementById('ms-studio-master-modal')?.remove();
  closeStudioContextMenu();
  if (window.__studioKeydownBound) {
    window.__studioKeydownBound = false;
    document.removeEventListener('keydown', studioKeydownHandler);
  }
  if (typeof switchDept === 'function' && typeof currentDept !== 'undefined' && currentDept === 'marketing') {
    if (typeof engineTab === 'function') engineTab('marketing-overview', 'overview');
    else switchDept('marketing', 'overview');
  }
}

function studioIsMobile() {
  return Boolean(window.matchMedia?.('(max-width: 768px)').matches);
}

function closeStudioMobilePanels() {
  document.getElementById('studio-tool-panel')?.classList.remove('ms-studio-mobile-open');
  document.getElementById('studio-inspector-panel')?.classList.remove('ms-studio-mobile-open');
  document.getElementById('ms-studio-master-modal')?.classList.remove('studio-mobile-drawer-open');
}

function openStudioMobilePanel(kind) {
  if (!studioIsMobile()) return;
  const toolPanel = document.getElementById('studio-tool-panel');
  const inspectorPanel = document.getElementById('studio-inspector-panel');
  const target = kind === 'inspector' ? inspectorPanel : toolPanel;
  const other = kind === 'inspector' ? toolPanel : inspectorPanel;
  other?.classList.remove('ms-studio-mobile-open');
  target?.classList.add('ms-studio-mobile-open');
  document.getElementById('ms-studio-master-modal')?.classList.add('studio-mobile-drawer-open');
}

function toggleStudioToolPanel() {
  const panel = document.getElementById('studio-tool-panel');
  if (!panel) return;
  if (studioIsMobile()) {
    if (panel.classList.contains('ms-studio-mobile-open')) closeStudioMobilePanels();
    else openStudioMobilePanel('tool');
  } else panel.classList.toggle('hidden');
  setTimeout(zoomStudioFit, 50);
}
function toggleStudioInspectorPanel() {
  const panel = document.getElementById('studio-inspector-panel');
  if (!panel) return;
  if (studioIsMobile()) {
    if (panel.classList.contains('ms-studio-mobile-open')) closeStudioMobilePanels();
    else openStudioMobilePanel('inspector');
  } else panel.classList.toggle('hidden');
  setTimeout(zoomStudioFit, 50);
}

window.closeStudioMobilePanels = closeStudioMobilePanels;
window.toggleStudioToolPanel = toggleStudioToolPanel;
window.toggleStudioInspectorPanel = toggleStudioInspectorPanel;
window.openMarketSyncStudio = openMarketSyncStudio;
window.setStudioTool = setStudioTool;
window.loadStudioTemplate = loadStudioTemplate;
window.searchStudioInventory = searchStudioInventory;
window.bindVehicleToStudio = bindVehicleToStudio;
window.searchStudioLibrary = searchStudioLibrary;
window.addLibraryImageToCanvas = addLibraryImageToCanvas;
window.changeStudioFormat = changeStudioFormat;
window.filterStudioTemplates = filterStudioTemplates;
window.toggleStudioGuides = toggleStudioGuides;
window.saveStudioDesign = saveStudioDesign;
window.renderStudioDesignAndPublish = renderStudioDesignAndPublish;
window.closeMarketSyncStudio = closeMarketSyncStudio;
window.zoomStudioIn = zoomStudioIn;
window.zoomStudioOut = zoomStudioOut;
window.zoomStudioFit = zoomStudioFit;
window.applyStudioZoom = applyStudioZoom;
window.studioAddShape = studioAddShape;
window.studioDrawingMode = studioDrawingMode;
window.studioSelectMode = studioSelectMode;
window.studioSetObjectStyle = studioSetObjectStyle;
window.studioToggleNodes = studioToggleNodes;
window.searchStudioVideos = searchStudioVideos;
window.loadStudioUploadedVideos = loadStudioUploadedVideos;
window.uploadStudioVideo = uploadStudioVideo;
window.addLibraryVideoToCanvas = addLibraryVideoToCanvas;
window.studioAddText = studioAddText;
window.studioSetTextStyle = studioSetTextStyle;
window.generateStudioAiCopy = generateStudioAiCopy;
window.studioAddGeneratedCopy = studioAddGeneratedCopy;
