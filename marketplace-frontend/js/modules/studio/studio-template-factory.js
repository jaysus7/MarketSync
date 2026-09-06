/* MarketSync Design Studio — template factory.
 *
 * Why this file exists
 * --------------------
 * The Studio used to ship a couple of dozen hand-written scenes whose element
 * positions were typed in by hand. Two things went wrong with that:
 *
 *   1. Nothing was measured. A headline was given a font size and an x/y and
 *      whatever happened, happened — so long words ran off the artboard, a
 *      photo panel and a text block could be written at overlapping
 *      coordinates, and the result looked like a layout accident rather than a
 *      design. (The "VEHI" screenshot: a 72px headline in a box that could not
 *      hold it, with a photo painted straight through it.)
 *   2. It does not scale. A dealership wants a wall of starting points, not six.
 *
 * So layouts are COMPUTED here instead of typed. Every template is derived from
 * a deterministic tuple (archetype × palette × type system × campaign theme),
 * laid out on a real grid inside the format's platform-safe rectangle, with
 * every line of type measured and fitted to the box that holds it. The same
 * (formatKey, index) always produces the same design, so a template key stays
 * a stable, shareable address — nothing is random at runtime.
 *
 * Imagery is deliberately NOT a hardcoded photo URL. Photo slots carry an
 * automotive/RV search term; the resolver fills them from the dealership's own
 * inventory or the automotive stock pool. A slot that cannot be filled renders
 * as a designed vehicle silhouette panel — never an unrelated stock photo.
 */
(function (global) {
  'use strict';

  const VARIANTS_PER_FORMAT = 1000;

  // ── Deterministic sequencing ──────────────────────────────────────────────
  // Variants are addressed by a mixed-radix decomposition of the index rather
  // than by a random draw, which is what guarantees that indices 0…999 are
  // 1000 DIFFERENT designs. A random seed would collide long before 1000.
  // The stride spreads consecutive indices across the whole combination space
  // so the first screenful is varied instead of showing one archetype 24 times.
  function hashString(value) {
    let h = 2166136261;
    const s = String(value);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  const gcd = (a, b) => b ? gcd(b, a % b) : a;

  // Smallest stride coprime with `total` that is near the golden-ratio step.
  function strideFor(total) {
    let step = Math.max(1, Math.round(total * 0.6180339887));
    for (let i = 0; i < total; i++) {
      const candidate = step + i;
      if (candidate < total && gcd(candidate, total) === 1) return candidate;
    }
    return 1;
  }

  /**
   * A stride whose every mixed-radix digit is non-zero AND coprime with its own
   * radix, so stepping the index advances the archetype, the palette, the type
   * system and the campaign all at once.
   *
   * A plain stride is coprime with the product, which is enough to guarantee
   * 1000 distinct designs but says nothing about the ORDER they arrive in: it
   * advanced the archetype digit quickly and carried into the palette digit only
   * every thirteenth step, so the first screenful of a grid showed nine palettes
   * out of twenty-four and not one of the five light ones. The first screenful
   * is the only one most people look at, so it has to show the range.
   */
  function spreadStride(radices, total) {
    const digitFor = (radix, seed) => {
      if (radix <= 1) return 0;
      for (let k = 0; k < radix; k++) {
        const candidate = ((Math.round(radix * 0.382) + seed + k - 1) % (radix - 1)) + 1;
        if (gcd(candidate, radix) === 1) return candidate;
      }
      return 1;
    };
    for (let seed = 0; seed < 512; seed++) {
      let stride = 0, place = 1;
      for (let i = 0; i < radices.length; i++) {
        stride += digitFor(radices[i], seed + i * 7) * place;
        place *= radices[i];
      }
      stride %= total;
      if (stride > 0 && gcd(stride, total) === 1) return stride;
    }
    return strideFor(total);
  }

  // ── Type measurement ──────────────────────────────────────────────────────
  // Studio scenes are rendered by Fabric on canvas and by the preview grid in
  // CSS, and neither gets a chance to tell us "that did not fit" before the
  // design ships. So widths are estimated here, before a font size is chosen.
  // The table is per-glyph rather than a flat average because the flat average
  // is what lets "MOTORHOME WALKTHROUGH" overflow a box that "trim and stock"
  // fits comfortably.
  const GLYPH_WIDTH = (() => {
    const table = {};
    const assign = (chars, width) => { for (const ch of chars) table[ch] = width; };
    assign('iltIJ.,:;!|\'`', 0.30);
    assign('fjr()[]{}/\\-', 0.36);
    assign(' ', 0.28);
    assign('abcdeghknopqsuvxyz', 0.55);
    assign('0123456789$', 0.58);
    assign('BCDEFGHKLNOPRSTUVXYZ&#', 0.68);
    assign('AQ', 0.72);
    assign('mw', 0.86);
    assign('MW@', 0.92);
    return table;
  })();

  function glyphWidth(ch) { return GLYPH_WIDTH[ch] == null ? 0.58 : GLYPH_WIDTH[ch]; }

  // Width of one run of text at font size 1. Multiply by the font size to get
  // pixels. Bold display weights set wider than book weights, and letter
  // spacing is charge-per-glyph, so both are folded in by the caller.
  function measure(text, tracking) {
    let total = 0;
    const s = String(text == null ? '' : text);
    for (const ch of s) total += glyphWidth(ch) + (tracking || 0);
    return total;
  }

  // Greedy line breaking, identical in spirit to what Fabric does with a fixed
  // width, so the preview and the canvas agree on how many lines there are.
  function wrap(text, maxUnits, tracking) {
    const words = String(text == null ? '' : text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word;
      if (line && measure(candidate, tracking) > maxUnits) { lines.push(line); line = word; }
      else line = candidate;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  const WEIGHT_WIDTH = { '400': 0.97, '500': 0.99, '600': 1.01, '700': 1.03, '800': 1.05, '900': 1.07 };

  /**
   * Representative values used when MEASURING text that contains binding
   * tokens. The stored text keeps the token; only the fit is computed against
   * what the token will become.
   *
   * A token is nothing like the string that replaces it. "{{dealership.name}}"
   * is nineteen mostly-narrow characters — braces, dots, lowercase — while
   * "MOUNTAINVIEW MOTORS GROUP" is a wall of caps nearly twice as wide. Fitting
   * the token and rendering the value is how a letterhead's brand line was
   * measured as one line and shipped as two.
   *
   * The samples are deliberately at the long end of realistic. A design fitted
   * to a generous value survives a dealership with a long name; one fitted to a
   * short value breaks the first time it meets a real one.
   */
  const MEASURE_SAMPLES = {
    'vehicle.year': '2026',
    'vehicle.make': 'Volkswagen',
    'vehicle.model': 'Atlas Cross Sport',
    'vehicle.trim': 'Highline 4MOTION',
    'vehicle.stock_number': 'VW240817',
    'vehicle.price': '$149,995',
    'vehicle.sale_price': '$149,995',
    'vehicle.mileage': '148,500',
    'dealership.name': 'MOUNTAINVIEW MOTORS GROUP',
    'dealership.phone': '(416) 555-0148',
    'dealership.website': 'mountainviewmotors.ca',
    'salesperson.name': 'ALEKSANDRA MARTINEZ',
    'salesperson.phone': '(416) 555-0198',
    'salesperson.email': 'aleksandra@mountainviewmotors.ca'
  };

  function expandForMeasure(text) {
    const source = String(text == null ? '' : text);
    if (source.indexOf('{{') < 0) return source;
    return source.replace(/\{\{\s*([^}|]+?)(?:\|([^}]*))?\s*\}\}/g, (whole, key, fallback) => {
      const sample = MEASURE_SAMPLES[String(key).trim()];
      if (sample) return sample;
      const alt = String(fallback == null ? '' : fallback).trim();
      return alt || 'Your details here';
    });
  }

  /**
   * Chooses the largest font size at or below `max` that renders `text` inside
   * a box of `boxW` × `boxH`, and reports the height it actually occupies so
   * the caller can stack the next block directly beneath it. Never returns a
   * size whose longest word overflows the box — that overflow is exactly the
   * clipped-headline bug this replaces.
   */
  function fit(text, boxW, boxH, options) {
    const opts = options || {};
    const max = Math.max(8, Math.round(opts.max || 64));
    const min = Math.max(7, Math.round(opts.min || max * 0.42));
    const lineHeight = opts.lineHeight || 1.1;
    const tracking = opts.tracking || 0;
    const weight = WEIGHT_WIDTH[String(opts.fontWeight || '700')] || 1;
    const maxLines = opts.maxLines || 4;
    // 4% safety: real faces vary, and a design that is 2% too wide reads as
    // broken while one that is 2% too small reads as intentional.
    const usable = (boxW / weight) * 0.96;
    // Measure what will be RENDERED, not what is stored.
    const probe = expandForMeasure(text);

    // The preferred range first: a size at or above `min` that satisfies the
    // line budget, the width and the height.
    for (let size = max; size >= min; size--) {
      const found = tryFit(probe, usable, boxH, size, lineHeight, tracking, maxLines);
      if (found) return found;
    }
    // Below the preferred range rather than overflowing. A 9px line in a design
    // that wanted 14 is a compromise; a 14px line running past its box is a
    // defect, and this is the branch that used to produce one.
    const floor = Math.max(6, Math.round(opts.floor || 6));
    for (let size = min - 1; size >= floor; size--) {
      const found = tryFit(probe, usable, boxH, size, lineHeight, tracking, maxLines);
      if (found) return found;
    }
    // Even at the floor it will not fit. Keep only the lines the box can hold
    // and report the height they really occupy, so the block below still lands
    // on the grid instead of being pushed off the artboard.
    const units = usable / floor;
    const room = Math.max(1, Math.floor(boxH / (floor * lineHeight)));
    const lines = wrap(probe, units, tracking).slice(0, room);
    return { fontSize: floor, lines, height: Math.ceil(lines.length * floor * lineHeight), fits: false };
  }

  function tryFit(text, usable, boxH, size, lineHeight, tracking, maxLines) {
    const units = usable / size;
    const lines = wrap(text, units, tracking);
    if (lines.length > maxLines) return null;
    const widest = lines.reduce((acc, line) => Math.max(acc, measure(line, tracking)), 0);
    if (widest > units) return null;
    const height = lines.length * size * lineHeight;
    if (height > boxH) return null;
    return { fontSize: size, lines, height: Math.ceil(height), fits: true };
  }

  // ── Palettes ──────────────────────────────────────────────────────────────
  // Each palette is a complete, contrast-checked set: a ground, a panel that
  // sits on the ground, an accent for badges and buttons, ink for headlines and
  // a muted tone for secondary copy. Designs pull all five from one palette so
  // a variant can never mix two colour stories.
  const PALETTES = [
    { id: 'midnight', ground: '#07111F', panel: '#0F1E33', accent: '#D4A94F', ink: '#FFFFFF', muted: '#9DB2CE', onAccent: '#0B1220' },
    { id: 'graphite', ground: '#111418', panel: '#1C2128', accent: '#F97316', ink: '#FFFFFF', muted: '#A5AEBB', onAccent: '#1A1005' },
    { id: 'showroom', ground: '#0B1220', panel: '#152238', accent: '#38BDF8', ink: '#FFFFFF', muted: '#93B4CF', onAccent: '#04121C' },
    { id: 'signal', ground: '#7F1D1D', panel: '#991B1B', accent: '#FDE68A', ink: '#FFFFFF', muted: '#FECACA', onAccent: '#3F1010' },
    { id: 'forest', ground: '#0B2B22', panel: '#123A2E', accent: '#4ADE80', ink: '#FFFFFF', muted: '#A7D8C0', onAccent: '#05231A' },
    { id: 'paper', ground: '#F5F1E8', panel: '#FFFFFF', accent: '#9F1239', ink: '#191614', muted: '#6B6257', onAccent: '#FFFFFF' },
    { id: 'chalk', ground: '#EFEFEA', panel: '#FFFFFF', accent: '#1D4ED8', ink: '#12161C', muted: '#5C6470', onAccent: '#FFFFFF' },
    { id: 'sand', ground: '#EDE3D3', panel: '#FFFDF8', accent: '#B45309', ink: '#22190F', muted: '#7A6A55', onAccent: '#FFFFFF' },
    { id: 'indigo', ground: '#1E1B4B', panel: '#2E2A6B', accent: '#A5B4FC', ink: '#FFFFFF', muted: '#C7CBF5', onAccent: '#161338' },
    { id: 'teal', ground: '#062E33', panel: '#0C4048', accent: '#2DD4BF', ink: '#FFFFFF', muted: '#9CD3D3', onAccent: '#032125' },
    { id: 'plum', ground: '#2E1065', panel: '#3F1A82', accent: '#F0ABFC', ink: '#FFFFFF', muted: '#D6C2F0', onAccent: '#230A4F' },
    { id: 'clay', ground: '#3B1D14', panel: '#54291C', accent: '#FBBF24', ink: '#FFF7ED', muted: '#D9B9A6', onAccent: '#2A140E' },
    { id: 'slate', ground: '#1E293B', panel: '#334155', accent: '#22D3EE', ink: '#F8FAFC', muted: '#A9B6C7', onAccent: '#062B33' },
    { id: 'sunrise', ground: '#7C2D12', panel: '#9A3412', accent: '#FCD34D', ink: '#FFF7ED', muted: '#F5C6A5', onAccent: '#3B1508' },
    { id: 'arctic', ground: '#E8EEF4', panel: '#FFFFFF', accent: '#0F766E', ink: '#0F172A', muted: '#5A6B7C', onAccent: '#FFFFFF' },
    { id: 'carbon', ground: '#0A0A0A', panel: '#171717', accent: '#EF4444', ink: '#FFFFFF', muted: '#A3A3A3', onAccent: '#FFFFFF' },
    { id: 'copper', ground: '#1C1917', panel: '#292524', accent: '#D97706', ink: '#FAFAF9', muted: '#B0A8A0', onAccent: '#1A1005' },
    { id: 'harbour', ground: '#0C4A6E', panel: '#075985', accent: '#FDE047', ink: '#FFFFFF', muted: '#BAE0F5', onAccent: '#1F2506' },
    { id: 'moss', ground: '#1A2E05', panel: '#28430A', accent: '#BEF264', ink: '#FFFFFF', muted: '#C7DDA5', onAccent: '#16250A' },
    { id: 'rose', ground: '#4C0519', panel: '#66102A', accent: '#FDA4AF', ink: '#FFF1F2', muted: '#EFC0C8', onAccent: '#3B0413' },
    { id: 'steel', ground: '#334155', panel: '#475569', accent: '#FACC15', ink: '#FFFFFF', muted: '#C3CDD9', onAccent: '#2B2306' },
    { id: 'linen', ground: '#FAF7F2', panel: '#FFFFFF', accent: '#0F172A', ink: '#161513', muted: '#6E675E', onAccent: '#FFFFFF' },
    { id: 'ocean', ground: '#082F49', panel: '#0E4A6E', accent: '#7DD3FC', ink: '#FFFFFF', muted: '#A8CEE4', onAccent: '#04222F' },
    { id: 'ember', ground: '#450A0A', panel: '#5F1414', accent: '#FB923C', ink: '#FFF7ED', muted: '#EAB8A4', onAccent: '#330808' }
  ];

  // ── Type systems ──────────────────────────────────────────────────────────
  // A display face for the headline and a text face for everything else, plus
  // the case and tracking that make the pairing look deliberate. Tracking is in
  // em and is fed straight into the fitter so a wide-tracked headline is
  // measured wide rather than discovered wide.
  const TYPE_SYSTEMS = [
    { id: 'grotesk', display: 'Archivo Black', body: 'Manrope', displayWeight: '900', bodyWeight: '600', headlineCase: 'upper', tracking: -0.01, kickerTracking: 0.18 },
    { id: 'editorial', display: 'Playfair Display', body: 'Manrope', displayWeight: '800', bodyWeight: '500', headlineCase: 'title', tracking: 0, kickerTracking: 0.22 },
    { id: 'modern', display: 'Montserrat', body: 'Montserrat', displayWeight: '800', bodyWeight: '500', headlineCase: 'upper', tracking: 0.01, kickerTracking: 0.2 },
    { id: 'humanist', display: 'Manrope', body: 'Manrope', displayWeight: '800', bodyWeight: '500', headlineCase: 'sentence', tracking: -0.005, kickerTracking: 0.16 },
    { id: 'condensed', display: 'Oswald', body: 'Manrope', displayWeight: '700', bodyWeight: '500', headlineCase: 'upper', tracking: 0.02, kickerTracking: 0.24 },
    { id: 'serifpress', display: 'Libre Baskerville', body: 'Manrope', displayWeight: '700', bodyWeight: '400', headlineCase: 'title', tracking: 0, kickerTracking: 0.2 },
    { id: 'techno', display: 'Montserrat', body: 'Manrope', displayWeight: '900', bodyWeight: '700', headlineCase: 'upper', tracking: 0.03, kickerTracking: 0.26 },
    { id: 'quiet', display: 'Manrope', body: 'Manrope', displayWeight: '700', bodyWeight: '400', headlineCase: 'title', tracking: 0, kickerTracking: 0.14 }
  ];

  const TOKEN = /\{\{[^}]*\}\}/g;

  function applyCase(text, mode) {
    const source = String(text == null ? '' : text);
    if (!mode || mode === 'none') return source;
    // Case is applied to the prose BETWEEN binding tokens only. A token is a
    // lookup key, and "{{DEALERSHIP.NAME}}" matches nothing — the design then
    // renders its fallback text where the dealership's name should be.
    const transform = segment => {
      if (mode === 'upper') return segment.toUpperCase();
      if (mode === 'title') return segment.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      if (mode === 'sentence') return segment.toLowerCase();
      return segment;
    };
    let out = '', last = 0, match;
    TOKEN.lastIndex = 0;
    while ((match = TOKEN.exec(source)) !== null) {
      out += transform(source.slice(last, match.index)) + match[0];
      last = match.index + match[0].length;
    }
    out += transform(source.slice(last));
    if (mode === 'sentence') {
      const at = out.search(/[a-z]/);
      if (at >= 0) out = out.slice(0, at) + out.charAt(at).toUpperCase() + out.slice(at + 1);
    }
    return out;
  }

  // ── Campaign themes ───────────────────────────────────────────────────────
  // Every theme is an automotive or RV campaign, and every photo slot carries
  // an automotive or RV search term. There is no generic-business theme and no
  // generic-business image query, because "templates need to show only auto
  // and/or RV photos" is not a filter applied afterwards — it is the only
  // vocabulary the generator has.
  const THEMES = [
    { id: 'new_arrival', segment: 'auto', category: 'Inventory', name: 'New Arrival', kicker: 'Just arrived', headline: 'The one you have been waiting for', sub: 'Fresh on the lot and ready for a test drive today.', stat: '{{vehicle.mileage}} km', price: '{{vehicle.price}}', priceLabel: 'Our price', cta: 'Book a test drive', query: 'new car dealership lot' },
    { id: 'price_drop', segment: 'auto', category: 'Price Drop', name: 'Price Drop', kicker: 'Price reduced', headline: 'A better vehicle for less', sub: 'We have repriced this one to move it this week.', stat: 'Reduced today', price: '{{vehicle.price}}', priceLabel: 'Now only', cta: 'See the new price', query: 'sedan on city street' },
    { id: 'certified', segment: 'auto', category: 'Certified Pre-Owned', name: 'Certified Pre-Owned', kicker: 'Certified pre-owned', headline: 'Inspected, reconditioned, covered', sub: 'Certification details available on request.', stat: 'Multi-point inspection', price: '{{vehicle.sale_price}}', priceLabel: 'Certified price', cta: 'View certification', query: 'used car showroom' },
    { id: 'trade_in', segment: 'auto', category: 'Trade-In', name: 'Trade-In Appraisal', kicker: 'Trade appraisal', headline: 'Your trade is worth more right now', sub: 'We need pre-owned inventory. Bring yours in for a same-day appraisal.', stat: 'Same-day offer', price: '', priceLabel: '', cta: 'Value my trade', query: 'car keys handover dealership' },
    { id: 'test_drive', segment: 'auto', category: 'Test Drive', name: 'Test Drive Invite', kicker: 'Test drive', headline: 'Take the wheel this weekend', sub: 'Book a slot online and it will be washed and waiting.', stat: 'Book online', price: '', priceLabel: '', cta: 'Reserve a time', query: 'driver hands on steering wheel' },
    { id: 'finance', segment: 'auto', category: 'Finance', name: 'Finance Offer', kicker: 'Financing', headline: 'Approvals built around your budget', sub: 'Ask about current approved programs and terms.', stat: 'All credit considered', price: '', priceLabel: '', cta: 'Get pre-approved', query: 'car dealership finance desk' },
    { id: 'lease', segment: 'auto', category: 'Finance', name: 'Lease Special', kicker: 'Lease', headline: 'Drive newer, more often', sub: 'Lease terms and eligibility confirmed in store.', stat: 'Short terms available', price: '', priceLabel: '', cta: 'See lease options', query: 'luxury car front grille' },
    { id: 'sales_event', segment: 'auto', category: 'Sales Event', name: 'Sales Event', kicker: 'This weekend', headline: 'Three days. Every model on the lot.', sub: 'Doors open early and the coffee is on us.', stat: 'Fri to Sun', price: '', priceLabel: '', cta: 'See the event', query: 'car dealership lot rows of cars' },
    { id: 'ev', segment: 'auto', category: 'Electric', name: 'Electric Lineup', kicker: 'Electric', headline: 'Plug in to the new lineup', sub: 'Ask about charging, range and current program eligibility.', stat: 'Home charging', price: '{{vehicle.price}}', priceLabel: 'From', cta: 'Explore electric', query: 'electric car charging station' },
    { id: 'truck', segment: 'auto', category: 'Trucks', name: 'Truck Month', kicker: 'Truck month', headline: 'Built for the work you actually do', sub: 'Payload and towing figures confirmed by trim.', stat: 'Tow ready', price: '{{vehicle.price}}', priceLabel: 'Starting at', cta: 'Shop trucks', query: 'pickup truck towing trailer' },
    { id: 'suv_family', segment: 'auto', category: 'Inventory', name: 'Family SUV', kicker: 'Family ready', headline: 'Room for everyone and everything', sub: 'Three rows, big cargo hold, easy to live with.', stat: 'Seats up to 8', price: '{{vehicle.price}}', priceLabel: 'Our price', cta: 'See the SUVs', query: 'family suv on highway' },
    { id: 'service', segment: 'auto', category: 'Service', name: 'Service Special', kicker: 'Service', headline: 'Keep it running like the day you bought it', sub: 'Factory-trained technicians and genuine parts.', stat: 'Book online', price: '', priceLabel: '', cta: 'Book service', query: 'auto service technician garage' },
    { id: 'detailing', segment: 'auto', category: 'Service', name: 'Detailing', kicker: 'Detailing', headline: 'Make it look the way it did on day one', sub: 'Interior and exterior packages available.', stat: 'Same-day slots', price: '', priceLabel: '', cta: 'Book a detail', query: 'car detailing polishing' },
    { id: 'tires', segment: 'auto', category: 'Service', name: 'Tire Season', kicker: 'Tires', headline: 'The right rubber before the weather turns', sub: 'Storage and installation handled in one visit.', stat: 'Install and store', price: '', priceLabel: '', cta: 'Book a fitting', query: 'car tire close up garage' },
    { id: 'sold', segment: 'auto', category: 'Community', name: 'Sold & Delivered', kicker: 'Sold', headline: 'Another happy set of keys', sub: 'Thank you for trusting us with the drive home.', stat: 'Delivered today', price: '', priceLabel: '', cta: 'Find yours', query: 'customer receiving car keys' },
    { id: 'rv_season', segment: 'rv', category: 'RV', name: 'RV Season Opener', kicker: 'RV season', headline: 'The season starts in your driveway', sub: 'Motorhomes, trailers and fifth wheels ready to roll.', stat: 'Ready to tow', price: '{{vehicle.price}}', priceLabel: 'From', cta: 'Shop RVs', query: 'rv motorhome campsite' },
    { id: 'rv_walkthrough', segment: 'rv', category: 'RV', name: 'RV Walkthrough', kicker: 'Walkthrough', headline: 'Step inside before you commit', sub: 'Full floorplan tour, no appointment needed.', stat: 'Open floorplan', price: '', priceLabel: '', cta: 'Book a walkthrough', query: 'rv interior kitchen living space' },
    { id: 'travel_trailer', segment: 'rv', category: 'RV', name: 'Travel Trailer', kicker: 'Travel trailer', headline: 'Light enough for the truck you already own', sub: 'Towing weights confirmed by floorplan.', stat: 'Half-ton towable', price: '{{vehicle.price}}', priceLabel: 'Our price', cta: 'See floorplans', query: 'travel trailer towed by truck' },
    { id: 'fifth_wheel', segment: 'rv', category: 'RV', name: 'Fifth Wheel', kicker: 'Fifth wheel', headline: 'Full-time comfort on the road', sub: 'Residential layouts with real storage.', stat: 'Four-season package', price: '{{vehicle.price}}', priceLabel: 'Starting at', cta: 'Tour a fifth wheel', query: 'fifth wheel trailer rv park' },
    { id: 'camper_van', segment: 'rv', category: 'RV', name: 'Camper Van', kicker: 'Camper van', headline: 'Park it anywhere, sleep in it tonight', sub: 'Drives like a van, lives like a cabin.', stat: 'Fits a driveway', price: '{{vehicle.price}}', priceLabel: 'From', cta: 'See the vans', query: 'camper van mountain road' },
    { id: 'rv_service', segment: 'rv', category: 'RV', name: 'RV Service', kicker: 'RV service', headline: 'Get it road-ready before the first trip', sub: 'Seals, brakes, appliances and roof inspections.', stat: 'Certified techs', price: '', priceLabel: '', cta: 'Book RV service', query: 'rv service bay maintenance' },
    { id: 'rv_storage', segment: 'rv', category: 'RV', name: 'Winter Storage', kicker: 'Storage', headline: 'Put it away properly this year', sub: 'Winterizing and secure indoor storage.', stat: 'Indoor and covered', price: '', priceLabel: '', cta: 'Reserve a spot', query: 'rv parked winter storage' },
    { id: 'rv_rally', segment: 'rv', category: 'RV', name: 'Owner Rally', kicker: 'Owners rally', headline: 'Bring the rig, stay the weekend', sub: 'Demos, clinics and a spot by the fire.', stat: 'Two nights', price: '', priceLabel: '', cta: 'Save my site', query: 'rv park sunset campfire' },
    { id: 'rv_clearance', segment: 'rv', category: 'RV', name: 'Model Year Clearance', kicker: 'Clearance', headline: 'Last year models, this year prices', sub: 'Remaining units listed in store.', stat: 'While they last', price: '{{vehicle.price}}', priceLabel: 'Clearance', cta: 'See what is left', query: 'rv dealership lot rows' }
  ];

  // ── Layout primitives ─────────────────────────────────────────────────────
  // A composition is built from rectangles, never from typed-in coordinates.
  // Photo rectangles and copy rectangles are disjoint by construction, which is
  // why a generated design cannot paint a vehicle photo through its own
  // headline the way the hand-written scenes did.
  function rect(x, y, w, h) { return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }; }
  function inset(r, top, right, bottom, left) {
    const t = top, rr = right == null ? t : right, b = bottom == null ? t : bottom, l = left == null ? rr : left;
    return rect(r.x + l, r.y + t, Math.max(1, r.w - l - rr), Math.max(1, r.h - t - b));
  }

  function makeEmitter(prefix) {
    let z = 0;
    const elements = [];
    const id = name => `${prefix}-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${z}`;
    return {
      elements,
      shape(name, r, fill, options) {
        const o = options || {};
        z += 1;
        elements.push({ id: id(name), type: 'shape', shapeType: o.shapeType || 'rect', name, x: r.x, y: r.y, width: r.w, height: r.h, fill, rx: Math.round(o.rx || 0), opacity: o.opacity == null ? 1 : o.opacity, angle: o.angle || 0, z });
        return elements[elements.length - 1];
      },
      photo(name, r, query, options) {
        const o = options || {};
        z += 1;
        // src stays null on purpose. The resolver fills it from dealership
        // inventory or the automotive stock pool; an unfilled slot renders as a
        // designed vehicle silhouette, never as an off-topic stock photo.
        elements.push({ id: id(name), type: 'vehicle-image', name, src: null, image_query: query, alt: query, x: r.x, y: r.y, width: r.w, height: r.h, fit: o.fit || 'cover', opacity: o.opacity == null ? 1 : o.opacity, z });
        return elements[elements.length - 1];
      },
      text(name, value, r, spec) {
        const s = spec || {};
        z += 1;
        elements.push({
          id: id(name), type: 'text', name, text: value,
          x: r.x, y: r.y, width: r.w, height: r.h,
          fontSize: s.fontSize, fontWeight: s.fontWeight || '700', fill: s.fill,
          fontFamily: s.fontFamily || 'Manrope', lineHeight: s.lineHeight || 1.1,
          charSpacing: Math.round((s.tracking || 0) * 1000),
          textAlign: s.textAlign || 'left', z
        });
        return elements[elements.length - 1];
      }
    };
  }

  /**
   * Lays a campaign message out inside one rectangle: kicker, headline,
   * supporting line, stat/price and call to action, in that order, each fitted
   * to the width it is given and stacked on the actual height the one above it
   * occupied. Blocks that will not fit are dropped from the bottom of the
   * priority list rather than allowed to run past the rectangle — a design with
   * no supporting line still reads; a design with a headline sliced in half
   * does not.
   */
  function composeCopy(emit, boxIn, ctx, options) {
    let box = boxIn;
    const o = options || {};
    const pal = ctx.pal, type = ctx.type, theme = ctx.theme, scale = ctx.scale;
    const align = o.align || 'left';
    // Every archetype declares the colour it painted behind this rectangle, and
    // the type colours are then resolved against it rather than assumed.
    const backdrop = o.bg || (ctx.onDark ? pal.ground : pal.panel);
    const onDark = isDark(backdrop);
    const base = onDark ? '#FFFFFF' : '#0B0F14';
    const ink = readable([o.ink, onDark ? '#FFFFFF' : pal.ink, base], backdrop, 4.5);
    const muted = readable([o.muted, mix(ink, backdrop, 0.74), ink], backdrop, 4.5);
    // The accent carries the kicker and the price. Where it will not read on
    // this backdrop the copy falls back to ink rather than shipping unreadable.
    const accentLarge = readable([o.accent || pal.accent, ink], backdrop, 3.2);
    const accentSmall = readable([o.accent || pal.accent, ink], backdrop, 4.5);
    // WCAG treats >=24px, or >=18.66px bold, as large text. Everything smaller
    // needs the full 4.5:1, so the accent is only used where it earns it.
    const accentFor = f => (f.fontSize >= 24 || (f.fontSize >= 19)) ? accentLarge : accentSmall;
    const gap = Math.max(6, Math.round(box.h * 0.035));
    box = rect(box.x, box.y, box.w, box.h);
    const wantCta = o.cta !== false && !!theme.cta;
    const wantPrice = o.price !== false && !!theme.price;
    const wantSub = o.sub !== false;
    const wantKicker = o.kicker !== false;

    // The call to action is sized around its label, not the other way round.
    // Deriving the button from the canvas and hoping the words fit is what put
    // a two-line label in a seven-pixel box on the small display formats.
    let ctaLabel = wantCta ? applyCase(theme.cta, 'upper') : '';
    const ctaW = wantCta ? Math.round(Math.min(box.w, Math.max(box.w * 0.52, 200 * scale))) : 0;
    let ctaFit = null, ctaH = 0, drawCta = wantCta;
    if (wantCta) {
      const labelW = Math.round(ctaW * 0.86);
      const labelMax = Math.max(10, 22 * scale);
      const labelMin = Math.max(8, 10 * scale);
      // Height is unbounded on the first pass so the fitter reports what the
      // label genuinely needs; the button is then built to hold exactly that.
      ctaFit = fit(ctaLabel, labelW, Number.MAX_SAFE_INTEGER, { max: labelMax, min: labelMin, fontWeight: '900', tracking: 0.08, maxLines: 2, lineHeight: 1.12 });
      ctaH = Math.round(Math.max(ctaFit.height * 1.55, 30 * scale));
      const ctaCap = Math.round(box.h * 0.34);
      if (ctaH > ctaCap) {
        // The rectangle cannot hold the ideal button. Re-fit inside what is
        // actually available rather than overflowing it.
        ctaH = ctaCap;
        ctaFit = fit(ctaLabel, labelW, Math.max(6, Math.round(ctaH * 0.72)), { max: labelMax, min: labelMin, fontWeight: '900', tracking: 0.08, maxLines: 2, lineHeight: 1.12 });
      }
      // A button too small to render its own label legibly is worse than no
      // button: it reads as a rendering fault. Drop it and give the height back
      // to the message, which is what a designer would do at this size.
      if (!ctaFit.fits) { drawCta = false; ctaH = 0; ctaFit = null; ctaLabel = ''; }
    }
    let available = box.h - (drawCta ? ctaH + gap : 0);

    const blocks = [];
    if (wantKicker) {
      const cased = applyCase(theme.kicker, 'upper');
      const f = fit(cased, box.w, Math.max(12, available * 0.12), { max: Math.max(11, 22 * scale), min: Math.max(9, 11 * scale), fontWeight: '800', tracking: type.kickerTracking, maxLines: 1, lineHeight: 1.1 });
      blocks.push({ key: 'kicker', text: cased, f, fill: accentFor(f), weight: '800', family: type.body, tracking: type.kickerTracking, priority: 3 });
    }
    const headline = applyCase(o.headline || theme.headline, type.headlineCase);
    const headlineMax = Math.max(16, Math.round((o.headlineMax || 78) * scale));
    const hf = fit(headline, box.w, available * (o.headlineShare || 0.56), { max: headlineMax, min: Math.max(13, 15 * scale), fontWeight: type.displayWeight, tracking: type.tracking, maxLines: o.headlineLines || 4, lineHeight: 1.04 });
    blocks.push({ key: 'headline', text: headline, f: hf, fill: ink, weight: type.displayWeight, family: type.display, tracking: type.tracking, priority: 0, lineHeight: 1.04 });
    if (wantSub) {
      // Measure against the integer width the element will actually be given.
      // Fitting to 812.4 and emitting 812 is how a line that "fits" ships clipped.
      const subW = Math.round(box.w * (o.subShare || 0.94));
      const sf = fit(theme.sub, subW, available * 0.26, { max: Math.max(11, 26 * scale), min: Math.max(9, 12 * scale), fontWeight: type.bodyWeight, maxLines: 3, lineHeight: 1.3 });
      blocks.push({ key: 'sub', text: theme.sub, f: sf, fill: muted, weight: type.bodyWeight, family: type.body, tracking: 0, priority: 4, lineHeight: 1.3, width: subW });
    }
    if (wantPrice) {
      const label = applyCase(theme.priceLabel || 'Price', 'upper');
      const lf = fit(label, box.w, available * 0.08, { max: Math.max(10, 18 * scale), min: Math.max(8, 10 * scale), fontWeight: '800', tracking: 0.14, maxLines: 1 });
      blocks.push({ key: 'price-label', text: label, f: lf, fill: muted, weight: '800', family: type.body, tracking: 0.14, priority: 5 });
      const pf = fit(theme.price, box.w, available * 0.2, { max: Math.max(16, 52 * scale), min: Math.max(12, 20 * scale), fontWeight: '900', tracking: -0.01, maxLines: 1 });
      blocks.push({ key: 'price', text: theme.price, f: pf, fill: accentFor(pf), weight: '900', family: type.display, tracking: -0.01, priority: 1 });
    }

    // Drop the least important blocks until the stack fits its rectangle.
    const order = [...blocks].sort((a, b) => b.priority - a.priority);
    const total = () => blocks.reduce((sum, b) => sum + b.f.height, 0) + gap * Math.max(0, blocks.length - 1);
    for (const candidate of order) {
      if (total() <= available) break;
      if (candidate.priority === 0) break;
      const at = blocks.indexOf(candidate);
      if (at >= 0) blocks.splice(at, 1);
    }

    const used = total();
    let cursor = box.y;
    if (o.valign === 'bottom') cursor = box.y + available - used;
    else if (o.valign === 'center') cursor = box.y + (available - used) / 2;
    cursor = Math.max(box.y, cursor);

    for (const block of blocks) {
      const width = Math.round(block.width || box.w);
      const x = align === 'center' ? box.x + (box.w - width) / 2 : align === 'right' ? box.x + box.w - width : box.x;
      emit.text(block.key, block.text, rect(x, cursor, width, block.f.height), {
        fontSize: block.f.fontSize, fontWeight: block.weight, fill: block.fill,
        fontFamily: block.family, tracking: block.tracking, lineHeight: block.lineHeight || 1.1,
        textAlign: align
      });
      cursor += block.f.height + gap;
    }

    if (drawCta) {
      const ctaY = box.y + box.h - ctaH;
      const ctaX = align === 'center' ? box.x + (box.w - ctaW) / 2 : align === 'right' ? box.x + box.w - ctaW : box.x;
      const button = rect(ctaX, ctaY, ctaW, ctaH);
      // The button needs to separate from the backdrop AND carry its own label.
      const buttonFill = readable([pal.accent, ink], backdrop, 1.8);
      const buttonInk = readable([pal.onAccent, '#FFFFFF', '#0B0F14'], buttonFill, 4.5);
      emit.shape('cta-button', button, buttonFill, { rx: o.ctaSquare ? 0 : Math.round(ctaH / 2), shapeType: o.ctaSquare ? 'rect' : 'badge' });
      emit.text('cta-label', ctaLabel, rect(ctaX, ctaY + (ctaH - ctaFit.height) / 2, ctaW, ctaFit.height), {
        fontSize: ctaFit.fontSize, fontWeight: '900', fill: buttonInk, fontFamily: type.body, tracking: 0.08, textAlign: 'center', lineHeight: 1.12
      });
    }
  }

  // ── Archetypes ────────────────────────────────────────────────────────────
  // Each archetype is a way of dividing the artboard. They declare which
  // proportions they suit, so a 728×90 leaderboard is never handed a layout
  // designed for a 1080×1920 story.
  function aspectClass(w, h) {
    const ratio = w / h;
    if (ratio >= 3) return 'ultrawide';
    if (ratio >= 1.55) return 'wide';
    if (ratio <= 0.42) return 'ultratall';
    if (ratio <= 0.72) return 'tall';
    return 'square';
  }

  const ARCHETYPES = [
    {
      id: 'hero_band', suits: ['square', 'tall', 'wide'],
      build(ctx, emit) {
        const { W, H, pal, safe } = ctx;
        const photoH = Math.round(H * (ctx.aspect === 'tall' ? 0.58 : 0.55));
        emit.shape('ground', rect(0, 0, W, H), pal.ground);
        emit.photo('vehicle', rect(0, 0, W, photoH), ctx.theme.query);
        emit.shape('copy-panel', rect(0, photoH, W, H - photoH), pal.panel);
        // When the platform's bottom safe zone reaches up into the copy panel
        // (stories and reels), the panel's bottom margin grows to clear it.
        const panel = rect(0, photoH, W, H - photoH);
        const bottomInset = Math.max(ctx.pad, safe.b - (H - photoH) + ctx.pad);
        composeCopy(emit, inset(panel, ctx.pad, ctx.pad, bottomInset, ctx.pad), ctx, { bg: ctx.pal.panel, valign: 'bottom' });
      }
    },
    {
      id: 'band_inverse', suits: ['square', 'tall', 'wide'],
      build(ctx, emit) {
        const { W, H, pal, safe } = ctx;
        const copyH = Math.round(H * 0.46);
        emit.shape('ground', rect(0, 0, W, H), pal.panel);
        emit.photo('vehicle', rect(0, copyH, W, H - copyH), ctx.theme.query);
        composeCopy(emit, inset(rect(0, safe.t, W, copyH - safe.t), ctx.pad), ctx, { bg: ctx.pal.panel, valign: 'center' });
      }
    },
    {
      id: 'split_photo_left', suits: ['wide', 'square'],
      build(ctx, emit) {
        const { W, H, pal } = ctx;
        const photoW = Math.round(W * 0.5);
        emit.shape('ground', rect(0, 0, W, H), pal.panel);
        emit.photo('vehicle', rect(0, 0, photoW, H), ctx.theme.query);
        emit.shape('accent-edge', rect(photoW - Math.round(ctx.pad * 0.18), 0, Math.round(ctx.pad * 0.18), H), pal.accent);
        composeCopy(emit, inset(rect(photoW, 0, W - photoW, H), ctx.pad), ctx, { bg: ctx.pal.panel, valign: 'center' });
      }
    },
    {
      id: 'split_photo_right', suits: ['wide', 'square'],
      build(ctx, emit) {
        const { W, H, pal } = ctx;
        const copyW = Math.round(W * 0.48);
        emit.shape('ground', rect(0, 0, W, H), pal.panel);
        emit.photo('vehicle', rect(copyW, 0, W - copyW, H), ctx.theme.query);
        composeCopy(emit, inset(rect(0, 0, copyW, H), ctx.pad), ctx, { bg: ctx.pal.panel, valign: 'center' });
      }
    },
    {
      id: 'full_bleed_scrim', suits: ['square', 'tall', 'ultratall', 'wide'],
      build(ctx, emit) {
        const { W, H, pal, safe } = ctx;
        emit.shape('ground', rect(0, 0, W, H), pal.ground);
        emit.photo('vehicle', rect(0, 0, W, H), ctx.theme.query);
        // Two flat scrims instead of one gradient: a gradient renders
        // differently in the CSS preview and on canvas, a flat rect does not.
        emit.shape('scrim', rect(0, 0, W, H), ctx.scrim, { opacity: 0.32 });
        const bandTop = Math.round(H * (ctx.aspect === 'wide' ? 0.4 : 0.46));
        emit.shape('scrim-band', rect(0, bandTop, W, H - bandTop), ctx.scrim, { opacity: 0.82 });
        const box = rect(safe.l, bandTop + ctx.pad, W - safe.l - safe.r, H - bandTop - ctx.pad - safe.b);
        composeCopy(emit, box, ctx, { bg: mix(ctx.scrim, '#808080', 1 - (1 - 0.32) * (1 - 0.82)), valign: 'bottom' });
      }
    },
    {
      id: 'inset_card', suits: ['square', 'tall', 'wide'],
      build(ctx, emit) {
        const { W, H, pal } = ctx;
        const m = ctx.pad;
        const photoH = Math.round((H - m * 3) * (ctx.aspect === 'wide' ? 0.46 : 0.5));
        emit.shape('ground', rect(0, 0, W, H), pal.ground);
        emit.photo('vehicle', rect(m, m, W - m * 2, photoH), ctx.theme.query);
        const card = rect(m, m * 2 + photoH, W - m * 2, H - photoH - m * 3);
        emit.shape('card', card, pal.panel, { rx: Math.round(m * 0.7) });
        composeCopy(emit, inset(card, Math.round(m * 0.85)), ctx, { bg: ctx.pal.panel, valign: 'center' });
      }
    },
    {
      id: 'framed', suits: ['square', 'tall', 'wide'],
      build(ctx, emit) {
        const { W, H, pal } = ctx;
        const m = ctx.pad;
        const line = Math.max(2, Math.round(m * 0.12));
        emit.shape('ground', rect(0, 0, W, H), pal.ground);
        emit.shape('frame-top', rect(m, m, W - m * 2, line), pal.accent);
        emit.shape('frame-bottom', rect(m, H - m - line, W - m * 2, line), pal.accent);
        emit.shape('frame-left', rect(m, m, line, H - m * 2), pal.accent);
        emit.shape('frame-right', rect(W - m - line, m, line, H - m * 2), pal.accent);
        const inner = inset(rect(m, m, W - m * 2, H - m * 2), Math.round(m * 0.8));
        const photoH = Math.round(inner.h * 0.42);
        emit.photo('vehicle', rect(inner.x, inner.y, inner.w, photoH), ctx.theme.query);
        composeCopy(emit, rect(inner.x, inner.y + photoH + Math.round(m * 0.6), inner.w, inner.h - photoH - Math.round(m * 0.6)), ctx, { bg: ctx.pal.ground, valign: 'bottom' });
      }
    },
    {
      id: 'corner_wedge', suits: ['square', 'tall', 'wide'],
      build(ctx, emit) {
        const { W, H, pal, safe } = ctx;
        emit.shape('ground', rect(0, 0, W, H), pal.ground);
        emit.photo('vehicle', rect(0, 0, W, H), ctx.theme.query);
        emit.shape('scrim', rect(0, 0, W, H), ctx.scrim, { opacity: 0.3 });
        const panelW = Math.round(W * (ctx.aspect === 'wide' ? 0.52 : 0.82));
        const panelH = Math.round(H * (ctx.aspect === 'wide' ? 0.82 : 0.5));
        const panel = rect(safe.l, H - safe.b - panelH, panelW, panelH);
        emit.shape('copy-panel', panel, pal.panel, { rx: Math.round(ctx.pad * 0.5), opacity: 0.97 });
        emit.shape('wedge', rect(panel.x, panel.y, Math.round(ctx.pad * 0.35), panelH), pal.accent, { rx: Math.round(ctx.pad * 0.5) });
        composeCopy(emit, inset(panel, Math.round(ctx.pad * 0.8), Math.round(ctx.pad * 0.8), Math.round(ctx.pad * 0.8), Math.round(ctx.pad * 1.2)), ctx, { bg: ctx.pal.panel, valign: 'center' });
      }
    },
    {
      id: 'editorial_rule', suits: ['square', 'tall', 'wide', 'ultratall'],
      build(ctx, emit) {
        const { W, H, pal, safe } = ctx;
        emit.shape('ground', rect(0, 0, W, H), pal.ground);
        const box = rect(safe.l, safe.t, W - safe.l - safe.r, H - safe.t - safe.b);
        const line = Math.max(2, Math.round(ctx.pad * 0.08));
        emit.shape('rule-top', rect(box.x, box.y, box.w, line), pal.accent);
        const strip = Math.round(box.h * 0.3);
        emit.photo('vehicle', rect(box.x, box.y + box.h - strip, box.w, strip), ctx.theme.query);
        composeCopy(emit, rect(box.x, box.y + line * 4, box.w, box.h - strip - line * 6), ctx, { bg: ctx.pal.ground, headlineShare: 0.62, valign: 'center' });
      }
    },
    {
      id: 'stat_strip', suits: ['square', 'wide'],
      build(ctx, emit) {
        const { W, H, pal } = ctx;
        const photoH = Math.round(H * 0.44);
        emit.shape('ground', rect(0, 0, W, H), pal.panel);
        emit.photo('vehicle', rect(0, 0, W, photoH), ctx.theme.query);
        const stripH = Math.round(H * 0.12);
        const strip = rect(0, photoH, W, stripH);
        emit.shape('stat-strip', strip, pal.accent);
        const statText = applyCase(ctx.theme.stat || ctx.theme.kicker, 'upper');
        const sf = fit(statText, strip.w * 0.86, strip.h * 0.6, { max: Math.max(10, 26 * ctx.scale), min: Math.max(8, 10 * ctx.scale), fontWeight: '900', tracking: 0.12, maxLines: 1 });
        emit.text('stat', statText, rect(strip.x, strip.y + (strip.h - sf.height) / 2, strip.w, sf.height), { fontSize: sf.fontSize, fontWeight: '900', fill: readable([pal.onAccent, '#FFFFFF', '#0B0F14'], pal.accent, 4.5), fontFamily: ctx.type.body, tracking: 0.12, textAlign: 'center' });
        composeCopy(emit, inset(rect(0, photoH + stripH, W, H - photoH - stripH), ctx.pad), ctx, { bg: ctx.pal.panel, valign: 'center' });
      }
    },
    {
      id: 'price_tag', suits: ['square', 'tall'],
      build(ctx, emit) {
        const { W, H, pal, safe } = ctx;
        emit.shape('ground', rect(0, 0, W, H), pal.ground);
        const photoH = Math.round(H * 0.6);
        emit.photo('vehicle', rect(0, 0, W, photoH), ctx.theme.query);
        // The only element allowed to overlap the photo is this tag, and it is
        // a solid block placed on a photo edge — never a line of type floating
        // over unpredictable pixels.
        const tagH = Math.round(H * 0.11);
        const tagW = Math.round(W * 0.46);
        const tag = rect(safe.l, photoH - Math.round(tagH / 2), tagW, tagH);
        emit.shape('price-tag', tag, pal.accent, { rx: Math.round(tagH * 0.22) });
        const tagText = applyCase(ctx.theme.priceLabel || ctx.theme.kicker, 'upper');
        const tf = fit(tagText, tag.w * 0.86, tag.h * 0.56, { max: Math.max(10, 24 * ctx.scale), min: Math.max(8, 10 * ctx.scale), fontWeight: '900', tracking: 0.1, maxLines: 1 });
        emit.text('tag-label', tagText, rect(tag.x, tag.y + (tag.h - tf.height) / 2, tag.w, tf.height), { fontSize: tf.fontSize, fontWeight: '900', fill: readable([pal.onAccent, '#FFFFFF', '#0B0F14'], pal.accent, 4.5), fontFamily: ctx.type.body, tracking: 0.1, textAlign: 'center' });
        composeCopy(emit, inset(rect(0, photoH + Math.round(tagH * 0.7), W, H - photoH - Math.round(tagH * 0.7)), ctx.pad), ctx, { bg: ctx.pal.ground, kicker: false, valign: 'bottom' });
      }
    },
    {
      id: 'stacked_thirds', suits: ['tall', 'ultratall', 'square'],
      build(ctx, emit) {
        const { W, H, pal, safe } = ctx;
        emit.shape('ground', rect(0, 0, W, H), pal.ground);
        const top = Math.round(H * 0.18);
        emit.shape('brand-band', rect(0, 0, W, top), pal.accent);
        const kicker = applyCase(ctx.theme.kicker, 'upper');
        const kf = fit(kicker, W * 0.8, top * 0.5, { max: Math.max(10, 26 * ctx.scale), min: Math.max(8, 10 * ctx.scale), fontWeight: '900', tracking: 0.18, maxLines: 1 });
        emit.text('band-kicker', kicker, rect(0, Math.max(safe.t * 0.4, (top - kf.height) / 2), W, kf.height), { fontSize: kf.fontSize, fontWeight: '900', fill: readable([pal.onAccent, '#FFFFFF', '#0B0F14'], pal.accent, 4.5), fontFamily: ctx.type.body, tracking: 0.18, textAlign: 'center' });
        const photoH = Math.round(H * 0.38);
        emit.photo('vehicle', rect(0, top, W, photoH), ctx.theme.query);
        composeCopy(emit, inset(rect(0, top + photoH, W, H - top - photoH - safe.b * 0.5), ctx.pad), ctx, { bg: ctx.pal.ground, kicker: false, align: 'center', valign: 'center' });
      }
    },
    {
      id: 'centre_stage', suits: ['square', 'tall'],
      build(ctx, emit) {
        const { W, H, pal, safe } = ctx;
        emit.shape('ground', rect(0, 0, W, H), pal.ground);
        emit.photo('vehicle', rect(0, 0, W, H), ctx.theme.query);
        emit.shape('scrim', rect(0, 0, W, H), ctx.scrim, { opacity: 0.62 });
        const box = rect(safe.l, safe.t, W - safe.l - safe.r, H - safe.t - safe.b);
        const plate = inset(box, Math.round(box.h * 0.12), Math.round(box.w * 0.02));
        emit.shape('plate-top', rect(plate.x + plate.w * 0.35, plate.y, plate.w * 0.3, Math.max(2, ctx.pad * 0.06)), pal.accent);
        composeCopy(emit, inset(plate, Math.round(ctx.pad * 0.5)), ctx, { bg: mix(ctx.scrim, '#808080', 0.62), align: 'center', valign: 'center' });
      }
    },
    {
      id: 'sidebar_rail', suits: ['tall', 'square', 'ultratall'],
      build(ctx, emit) {
        const { W, H, pal, safe } = ctx;
        const railW = Math.round(W * 0.1);
        emit.shape('ground', rect(0, 0, W, H), pal.panel);
        emit.shape('rail', rect(0, 0, railW, H), pal.accent);
        const body = rect(railW, 0, W - railW, H);
        const photoH = Math.round(H * 0.4);
        emit.photo('vehicle', rect(body.x, Math.max(safe.t, ctx.pad), body.w - ctx.pad, photoH), ctx.theme.query);
        composeCopy(emit, rect(body.x + ctx.pad * 0.4, Math.max(safe.t, ctx.pad) + photoH + ctx.pad * 0.6, body.w - ctx.pad * 1.4, H - photoH - Math.max(safe.t, ctx.pad) - ctx.pad * 0.6 - Math.max(safe.b, ctx.pad)), ctx, { bg: ctx.pal.panel, valign: 'bottom' });
      }
    },
    {
      id: 'letterhead', suits: ['tall', 'ultratall', 'square'],
      build(ctx, emit) {
        const { W, H, pal, safe } = ctx;
        const m = Math.max(ctx.pad, safe.l);
        emit.shape('paper', rect(0, 0, W, H), pal.ground);
        const bandH = Math.round(H * 0.11);
        emit.shape('header-band', rect(0, 0, W, bandH), pal.panel);
        emit.shape('accent-rule', rect(0, bandH, W, Math.max(3, Math.round(H * 0.006))), pal.accent);
        const brand = applyCase('{{dealership.name}}', 'upper');
        const bf = fit(brand, W - m * 2, bandH * 0.46, { max: Math.max(12, 40 * ctx.scale), min: Math.max(9, 12 * ctx.scale), fontWeight: '900', tracking: 0.06, maxLines: 1 });
        emit.text('brand', brand, rect(m, (bandH - bf.height) / 2, W - m * 2, bf.height), { fontSize: bf.fontSize, fontWeight: '900', fill: readable([ctx.panelDark ? '#FFFFFF' : pal.ink, '#FFFFFF', '#0B0F14'], pal.panel, 4.5), fontFamily: ctx.type.display, tracking: 0.06 });
        const footH = Math.round(H * 0.09);
        emit.shape('footer-band', rect(0, H - footH, W, footH), pal.panel);
        const contact = '{{dealership.phone}}   ·   {{dealership.website}}';
        const cf = fit(contact, W - m * 2, footH * 0.42, { max: Math.max(9, 22 * ctx.scale), min: Math.max(8, 9 * ctx.scale), fontWeight: '600', tracking: 0.04, maxLines: 1 });
        emit.text('contact', contact, rect(m, H - footH + (footH - cf.height) / 2, W - m * 2, cf.height), { fontSize: cf.fontSize, fontWeight: '600', fill: readable([mix(ctx.panelDark ? '#FFFFFF' : pal.ink, pal.panel, 0.8), '#FFFFFF', '#0B0F14'], pal.panel, 4.5), fontFamily: ctx.type.body, tracking: 0.04, textAlign: 'center' });
        const bodyBox = rect(m, bandH + ctx.pad * 1.2, W - m * 2, H - bandH - footH - ctx.pad * 2.4);
        const stripH = Math.round(bodyBox.h * 0.34);
        emit.photo('vehicle', rect(bodyBox.x, bodyBox.y + bodyBox.h - stripH, bodyBox.w, stripH), ctx.theme.query);
        composeCopy(emit, rect(bodyBox.x, bodyBox.y, bodyBox.w, bodyBox.h - stripH - ctx.pad), ctx, { bg: ctx.pal.ground, valign: 'top', headlineShare: 0.5 });
      }
    },
    {
      id: 'compact_bar', suits: ['ultrawide'],
      build(ctx, emit) {
        const { W, H, pal } = ctx;
        emit.shape('ground', rect(0, 0, W, H), pal.panel);
        const photoW = Math.round(W * 0.26);
        emit.photo('vehicle', rect(0, 0, photoW, H), ctx.theme.query);
        const ctaW = Math.round(W * 0.22);
        const pad = Math.max(6, Math.round(H * 0.14));
        const copy = rect(photoW + pad, pad, W - photoW - ctaW - pad * 3, H - pad * 2);
        composeCopy(emit, copy, ctx, { bg: ctx.pal.panel, cta: false, sub: false, price: false, valign: 'center', headlineMax: 34, headlineLines: 2 });
        const button = rect(W - ctaW - pad, pad, ctaW, H - pad * 2);
        emit.shape('cta-button', button, pal.accent, { rx: Math.round(button.h * 0.28) });
        const label = applyCase(ctx.theme.cta, 'upper');
        const lf = fit(label, button.w * 0.86, button.h * 0.6, { max: Math.max(9, 20 * ctx.scale), min: 8, fontWeight: '900', tracking: 0.06, maxLines: 2, lineHeight: 1.05 });
        emit.text('cta-label', label, rect(button.x, button.y + (button.h - lf.height) / 2, button.w, lf.height), { fontSize: lf.fontSize, fontWeight: '900', fill: readable([pal.onAccent, '#FFFFFF', '#0B0F14'], pal.accent, 4.5), fontFamily: ctx.type.body, tracking: 0.06, textAlign: 'center', lineHeight: 1.05 });
      }
    },
    {
      id: 'compact_tower', suits: ['ultratall'],
      build(ctx, emit) {
        const { W, H, pal } = ctx;
        const pad = Math.max(6, Math.round(W * 0.08));
        emit.shape('ground', rect(0, 0, W, H), pal.panel);
        emit.photo('vehicle', rect(0, 0, W, Math.round(H * 0.3)), ctx.theme.query);
        composeCopy(emit, rect(pad, Math.round(H * 0.3) + pad, W - pad * 2, H - Math.round(H * 0.3) - pad * 2), ctx, { bg: ctx.pal.panel, align: 'center', sub: false, valign: 'center', headlineMax: 30, headlineLines: 5 });
      }
    },
    {
      id: 'photo_grid', suits: ['square', 'wide', 'tall'],
      build(ctx, emit) {
        const { W, H, pal } = ctx;
        const m = ctx.pad;
        emit.shape('ground', rect(0, 0, W, H), pal.ground);
        const gridH = Math.round(H * 0.42);
        const gap = Math.max(3, Math.round(m * 0.22));
        const cellW = Math.round((W - m * 2 - gap) / 2);
        emit.photo('vehicle-a', rect(m, m, cellW, gridH), ctx.theme.query);
        emit.photo('vehicle-b', rect(m + cellW + gap, m, W - m * 2 - cellW - gap, gridH), ctx.theme.query);
        composeCopy(emit, rect(m, m + gridH + m * 0.8, W - m * 2, H - gridH - m * 2.8), ctx, { bg: ctx.pal.ground, valign: 'bottom' });
      }
    }
  ];

  // Two more ultra-wide divisions so a leaderboard is not one layout repeated a
  // thousand times with new colours.
  ARCHETYPES.push({
    id: 'compact_bar_flip', suits: ['ultrawide'],
    build(ctx, emit) {
      const { W, H, pal } = ctx;
      emit.shape('ground', rect(0, 0, W, H), pal.panel);
      const photoW = Math.round(W * 0.26);
      emit.photo('vehicle', rect(W - photoW, 0, photoW, H), ctx.theme.query);
      const pad = Math.max(6, Math.round(H * 0.14));
      const ctaW = Math.round(W * 0.2);
      emit.shape('accent-rail', rect(0, 0, Math.max(3, Math.round(W * 0.006)), H), pal.accent);
      composeCopy(emit, rect(pad * 1.6, pad, W - photoW - ctaW - pad * 3.6, H - pad * 2), ctx, { bg: ctx.pal.panel, cta: false, sub: false, price: false, valign: 'center', headlineMax: 34, headlineLines: 2 });
      const button = rect(W - photoW - ctaW - pad, pad, ctaW, H - pad * 2);
      emit.shape('cta-button', button, pal.accent, { rx: Math.round(button.h * 0.28) });
      const label = applyCase(ctx.theme.cta, 'upper');
      const lf = fit(label, button.w * 0.86, button.h * 0.62, { max: Math.max(9, 20 * ctx.scale), min: 8, fontWeight: '900', tracking: 0.06, maxLines: 2, lineHeight: 1.05 });
      emit.text('cta-label', label, rect(button.x, button.y + (button.h - lf.height) / 2, button.w, lf.height), { fontSize: lf.fontSize, fontWeight: '900', fill: readable([pal.onAccent, '#FFFFFF', '#0B0F14'], pal.accent, 4.5), fontFamily: ctx.type.body, tracking: 0.06, textAlign: 'center', lineHeight: 1.05 });
    }
  });
  ARCHETYPES.push({
    id: 'wide_scrim_bar', suits: ['ultrawide'],
    build(ctx, emit) {
      const { W, H, pal } = ctx;
      emit.shape('ground', rect(0, 0, W, H), pal.ground);
      emit.photo('vehicle', rect(0, 0, W, H), ctx.theme.query);
      emit.shape('scrim', rect(0, 0, W, H), ctx.scrim, { opacity: 0.72 });
      const pad = Math.max(6, Math.round(H * 0.14));
      const ctaW = Math.round(W * 0.2);
      composeCopy(emit, rect(pad, pad, W - ctaW - pad * 3, H - pad * 2), ctx, { bg: mix(ctx.scrim, '#808080', 0.72), cta: false, sub: false, price: false, valign: 'center', headlineMax: 34, headlineLines: 2 });
      const button = rect(W - ctaW - pad, pad, ctaW, H - pad * 2);
      emit.shape('cta-button', button, pal.accent, { rx: Math.round(button.h * 0.28) });
      const label = applyCase(ctx.theme.cta, 'upper');
      const lf = fit(label, button.w * 0.86, button.h * 0.62, { max: Math.max(9, 20 * ctx.scale), min: 8, fontWeight: '900', tracking: 0.06, maxLines: 2, lineHeight: 1.05 });
      emit.text('cta-label', label, rect(button.x, button.y + (button.h - lf.height) / 2, button.w, lf.height), { fontSize: lf.fontSize, fontWeight: '900', fill: readable([pal.onAccent, '#FFFFFF', '#0B0F14'], pal.accent, 4.5), fontFamily: ctx.type.body, tracking: 0.06, textAlign: 'center', lineHeight: 1.05 });
    }
  });

  const ARCHETYPE_LABELS = {
    hero_band: 'Hero Band', band_inverse: 'Headline First', split_photo_left: 'Split Left',
    split_photo_right: 'Split Right', full_bleed_scrim: 'Full Bleed', inset_card: 'Inset Card',
    framed: 'Framed', corner_wedge: 'Corner Panel', editorial_rule: 'Editorial',
    stat_strip: 'Stat Strip', price_tag: 'Price Tag', stacked_thirds: 'Banded',
    centre_stage: 'Centre Stage', sidebar_rail: 'Side Rail', letterhead: 'Letterhead',
    compact_bar: 'Compact Bar', compact_tower: 'Tower', photo_grid: 'Photo Pair',
    compact_bar_flip: 'Compact Bar Reversed', wide_scrim_bar: 'Wide Scrim'
  };

  // ── Colour helpers ────────────────────────────────────────────────────────
  function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return 0;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  function isDark(hex) { return luminance(hex) < 0.55; }

  function toRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return [128, 128, 128];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toHex(rgb) {
    return '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  /** `amount` of `front` laid over `back`. */
  function mix(front, back, amount) {
    const f = toRgb(front), b = toRgb(back);
    return toHex([0, 1, 2].map(i => f[i] * amount + b[i] * (1 - amount)));
  }
  function channel(v) { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }
  function relLuminance(hex) {
    const [r, g, b] = toRgb(hex).map(channel);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrastRatio(a, b) {
    const la = relLuminance(a), lb = relLuminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /**
   * Picks the first candidate colour that clears `min` against `backdrop`, and
   * if none does, the one that comes closest.
   *
   * Colour used to come straight from the palette: the kicker was always the
   * accent, the button label always `onAccent`. That is fine until a palette's
   * accent lands on a panel of similar lightness, and then a real design ships
   * with a heading you cannot read. Contrast is a property of a PAIR, so it has
   * to be resolved where the pair is known — here — not declared in advance.
   */
  function readable(candidates, backdrop, min) {
    let best = candidates[0], bestRatio = -1;
    for (const candidate of candidates) {
      if (!candidate) continue;
      const ratio = contrastRatio(candidate, backdrop);
      if (ratio >= min) return candidate;
      if (ratio > bestRatio) { bestRatio = ratio; best = candidate; }
    }
    return best;
  }

  // ── Variant addressing ────────────────────────────────────────────────────
  const variantCache = new Map();

  function variantSpace(formatKey, format) {
    const cacheKey = `${formatKey}:${format.w}x${format.h}`;
    if (variantCache.has(cacheKey)) return variantCache.get(cacheKey);
    const aspect = aspectClass(format.w, format.h);
    let archetypes = ARCHETYPES.filter(a => a.suits.indexOf(aspect) >= 0);
    // Every proportion must have something to draw. 'square' is the universal
    // fallback because its layouts assume neither extreme.
    if (!archetypes.length) archetypes = ARCHETYPES.filter(a => a.suits.indexOf('square') >= 0);
    const total = archetypes.length * PALETTES.length * TYPE_SYSTEMS.length * THEMES.length;
    const radices = [archetypes.length, PALETTES.length, TYPE_SYSTEMS.length, THEMES.length];
    const space = {
      aspect, archetypes, total,
      stride: spreadStride(radices, total),
      // Each format starts at its own point in the sequence, so index 0 of a
      // square post and index 0 of a story are different campaigns rather than
      // the same design 23 times down an "all sizes" grid.
      offset: hashString(`${formatKey}:${format.w}x${format.h}`) % total
    };
    variantCache.set(cacheKey, space);
    return space;
  }

  function tupleFor(formatKey, format, index) {
    const space = variantSpace(formatKey, format);
    const n = Math.abs(Math.trunc(Number(index) || 0)) % VARIANTS_PER_FORMAT;
    // Mixed radix over a coprime stride: 1000 consecutive indices land on 1000
    // distinct (archetype, palette, type, theme) tuples, and consecutive cards
    // in the grid never repeat an archetype back to back.
    let cursor = (n * space.stride + space.offset) % space.total;
    const archetype = space.archetypes[cursor % space.archetypes.length];
    cursor = Math.floor(cursor / space.archetypes.length);
    const palette = PALETTES[cursor % PALETTES.length];
    cursor = Math.floor(cursor / PALETTES.length);
    const type = TYPE_SYSTEMS[cursor % TYPE_SYSTEMS.length];
    cursor = Math.floor(cursor / TYPE_SYSTEMS.length);
    const theme = THEMES[cursor % THEMES.length];
    return { archetype, palette, type, theme, aspect: space.aspect, index: n };
  }

  function descriptor(formatKey, format, index) {
    const t = tupleFor(formatKey, format, index);
    const label = ARCHETYPE_LABELS[t.archetype.id] || 'Layout';
    return {
      template_key: `auto_${formatKey}_${t.index}`,
      name: `${t.theme.name} · ${label}`,
      category: t.theme.category,
      segment: t.theme.segment,
      desc: `${format.w}×${format.h} • ${t.theme.segment === 'rv' ? 'RV' : 'Automotive'} · ${label} layout`,
      format_key: formatKey,
      width: format.w,
      height: format.h,
      generated: true,
      // Carried so the imagery resolver can draw a placeholder in this design's
      // own colours rather than a generic grey box.
      palette: t.palette,
      keywords: `${t.theme.name} ${t.theme.category} ${t.theme.segment} ${label} ${t.palette.id} ${t.type.id} ${t.theme.query}`.toLowerCase(),
      preview: `linear-gradient(135deg,${t.palette.ground},${t.palette.accent})`
    };
  }

  function scene(formatKey, format, index) {
    const t = tupleFor(formatKey, format, index);
    const W = Math.max(1, Math.round(format.w));
    const H = Math.max(1, Math.round(format.h));
    const safeRaw = Array.isArray(format.safe) && format.safe.length === 4 ? format.safe : [6, 6, 6, 6];
    const ctx = {
      W, H, aspect: t.aspect, pal: t.palette, type: t.type, theme: t.theme,
      safe: {
        t: Math.round(H * safeRaw[0] / 100), r: Math.round(W * safeRaw[1] / 100),
        b: Math.round(H * safeRaw[2] / 100), l: Math.round(W * safeRaw[3] / 100)
      },
      pad: Math.max(8, Math.round(Math.min(W, H) * 0.07)),
      scale: Math.sqrt(W * H) / 1080,
      groundDark: isDark(t.palette.ground),
      panelDark: isDark(t.palette.panel),
      // Always dark. On the light palettes `ink` is the near-black they use for
      // headlines, so the scrim stays in the palette's own colour story while
      // still carrying white type.
      scrim: isDark(t.palette.ground) ? t.palette.ground : t.palette.ink
    };
    ctx.onDark = ctx.groundDark;
    const emit = makeEmitter(`t${t.index}-${t.archetype.id}`);
    t.archetype.build(ctx, emit);
    return {
      version: 1, format_key: formatKey, width: W, height: H,
      background: { color: t.palette.ground },
      elements: emit.elements
    };
  }

  function template(formatKey, format, index) {
    const base = descriptor(formatKey, format, index);
    base.scene = scene(formatKey, format, index);
    return base;
  }

  // Every automotive/RV search term the generated catalogue can ask for. The
  // resolver warms its pool from this list, so a photo slot is always filled
  // from an automotive or RV query — there is no general-purpose fallback term.
  const IMAGE_QUERIES = Array.from(new Set(THEMES.map(theme => theme.query)));

  global.MS_STUDIO_TEMPLATE_FACTORY = {
    VARIANTS_PER_FORMAT, descriptor, scene, template, IMAGE_QUERIES,
    aspectClass, variantSpace, ARCHETYPE_LABELS
  };

  global.MS_STUDIO_TEMPLATE_FACTORY_INTERNALS = {
    hashString, strideFor, spreadStride, measure, expandForMeasure, MEASURE_SAMPLES, wrap, fit, tryFit, applyCase, PALETTES, TYPE_SYSTEMS, THEMES, readable, mix, contrastRatio, ARCHETYPES, aspectClass, rect, inset, makeEmitter, composeCopy, VARIANTS_PER_FORMAT
  };
})(typeof window !== 'undefined' ? window : globalThis);
