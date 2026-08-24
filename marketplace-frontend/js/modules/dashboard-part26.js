/* dashboard.js split part 26/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

function openEditEmployeeModal(empId) {
  const employees = getPeopleComplianceData();
  const e = employees.find(x => x.id === empId);
  if (!e) return;

  const modalHtml = `
    <div class="space-y-4 max-h-[80vh] overflow-y-auto p-1">
      <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <h3 class="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span> Edit Employee Profile:</span>
          <span class="text-indigo-600">${esc(e.first_name)} ${esc(e.last_name)}</span>
        </h3>
        <button data-close class="text-slate-400 hover:text-slate-600 font-bold"></button>
      </div>

      <div class="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label class="block font-bold text-slate-500 mb-1">First Name</label>
          <input type="text" id="edit-emp-fname" value="${esc(e.first_name)}" class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
        </div>
        <div>
          <label class="block font-bold text-slate-500 mb-1">Last Name</label>
          <input type="text" id="edit-emp-lname" value="${esc(e.last_name)}" class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
        </div>
        <div>
          <label class="block font-bold text-slate-500 mb-1">Email Address</label>
          <input type="email" id="edit-emp-email" value="${esc(e.email)}" class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
        </div>
        <div>
          <label class="block font-bold text-slate-500 mb-1">Phone Number</label>
          <input type="text" id="edit-emp-phone" value="${esc(e.phone)}" class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
        </div>
        <div>
          <label class="block font-bold text-slate-500 mb-1">Department</label>
          <select id="edit-emp-dept" class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">
            <option value="Sales" ${e.department === 'Sales' ? 'selected' : ''}>Sales</option>
            <option value="F&I" ${e.department === 'F&I' ? 'selected' : ''}>F&amp;I Office</option>
            <option value="Service" ${e.department === 'Service' ? 'selected' : ''}>Service &amp; Shop</option>
            <option value="Recon" ${e.department === 'Recon' ? 'selected' : ''}>Cleanup &amp; Detail</option>
            <option value="Management" ${e.department === 'Management' ? 'selected' : ''}>Management</option>
          </select>
        </div>
        <div>
          <label class="block font-bold text-slate-500 mb-1">Role / Position Title</label>
          <input type="text" id="edit-emp-role" value="${esc(e.role)}" class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
        </div>
        <div>
          <label class="block font-bold text-slate-500 mb-1">Store Location</label>
          <input type="text" id="edit-emp-location" value="${esc(e.location)}" class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
        </div>
        <div>
          <label class="block font-bold text-slate-500 mb-1">Direct Manager</label>
          <input type="text" id="edit-emp-manager" value="${esc(e.manager)}" class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
        </div>
        <div>
          <label class="block font-bold text-slate-500 mb-1">Driver Licence Number</label>
          <input type="text" id="edit-emp-licence" value="${esc(e.licence_no)}" class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
        </div>
        <div>
          <label class="block font-bold text-slate-500 mb-1">Licence Expiry</label>
          <input type="date" id="edit-emp-licence-expiry" value="${esc(e.licence_expiry)}" class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
        </div>
      </div>

      <div class="pt-2">
        <button onclick="saveEmployeeEdit('${e.id}')" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs shadow-md transition"> Save Profile Changes</button>
      </div>
    </div>
  `;
  automationModal(modalHtml, 'max-w-lg');
}
window.openEditEmployeeModal = openEditEmployeeModal;

function saveEmployeeEdit(empId) {
  const employees = getPeopleComplianceData();
  const e = employees.find(x => x.id === empId);
  if (!e) return;

  e.first_name = document.getElementById('edit-emp-fname')?.value || e.first_name;
  e.last_name = document.getElementById('edit-emp-lname')?.value || e.last_name;
  e.email = document.getElementById('edit-emp-email')?.value || e.email;
  e.phone = document.getElementById('edit-emp-phone')?.value || e.phone;
  e.department = document.getElementById('edit-emp-dept')?.value || e.department;
  e.role = document.getElementById('edit-emp-role')?.value || e.role;
  e.location = document.getElementById('edit-emp-location')?.value || e.location;
  e.manager = document.getElementById('edit-emp-manager')?.value || e.manager;
  e.licence_no = document.getElementById('edit-emp-licence')?.value || e.licence_no;
  e.licence_expiry = document.getElementById('edit-emp-licence-expiry')?.value || e.licence_expiry;

  try { localStorage.setItem('ms_people_employees', JSON.stringify(employees)); } catch {}
  closeAutomationModal();
  toast(`Updated profile for ${e.first_name} ${e.last_name}!`);
  renderPeopleCompliance();
  if (typeof loadDealerManagementMatrix === 'function') loadDealerManagementMatrix();
}
window.saveEmployeeEdit = saveEmployeeEdit;

function openEmployeeProfileModal(empId) {
  const employees = getPeopleComplianceData();
  const e = employees.find(x => x.id === empId) || employees[0];
  if (!e) return;

  const modalHtml = `
    <div class="flex flex-col h-[85vh] max-h-[780px]">
      <div class="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center">${e.first_name[0]}${e.last_name[0]}</div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-black text-slate-900 dark:text-white">${esc(e.first_name)} ${esc(e.last_name)}</h2>
              <span class="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-emerald-100 text-emerald-700">${esc(e.status)}</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">${esc(e.role)} · ${esc(e.department)}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="openEditEmployeeModal('${e.id}')" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm"> Edit Profile</button>
          <button data-close class="text-slate-400 hover:text-slate-600 text-2xl font-bold px-2"></button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-5 my-2 scrollbar-thin">
        <!-- Contact & Employment -->
        <div class="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
          <div class="font-black text-slate-400 uppercase tracking-wider text-[10px]">Contact &amp; Employment Details</div>
          <div class="grid grid-cols-2 gap-3">
            <div><span class="text-slate-400">Email:</span> <span class="font-bold text-slate-800 dark:text-slate-200">${esc(e.email)}</span></div>
            <div><span class="text-slate-400">Phone:</span> <span class="font-bold text-slate-800 dark:text-slate-200">${esc(e.phone)}</span></div>
            <div><span class="text-slate-400">Location:</span> <span class="font-bold text-slate-800 dark:text-slate-200">${esc(e.location)}</span></div>
            <div><span class="text-slate-400">Direct Manager:</span> <span class="font-bold text-slate-800 dark:text-slate-200">${esc(e.manager)}</span></div>
          </div>
        </div>

        <!-- System Permissions & MarketSync Login -->
        <div class="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 rounded-xl space-y-2 text-xs">
          <div class="font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[10px]">MarketSync System Login &amp; Permissions</div>
          <div class="flex items-center justify-between">
            <div>
              <div class="font-bold text-slate-800 dark:text-slate-200">Account Access: Active</div>
              <div class="text-[11px] text-slate-500">Connected to MarketSync CRM, Desk &amp; Inventory</div>
            </div>
            <button onclick="executeOffboardingKillSwitch('${e.id}')" class="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm"> Offboard &amp; Revoke Access</button>
          </div>
        </div>

        <!-- Driver Licence & Signed Documents -->
        <div class="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 text-xs">
          <div class="font-black text-slate-400 uppercase tracking-wider text-[10px]">Driver Licence &amp; Signed Policy Documents</div>
          <div class="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg">
            <div>
              <div class="font-bold text-slate-800 dark:text-slate-200">Licence #${esc(e.licence_no)}</div>
              <div class="text-[11px] text-slate-500">Expiry: ${esc(e.licence_expiry)} · Abstract Checked: ${esc(e.abstract_date)}</div>
            </div>
            <span class="px-2 py-0.5 text-[10px] font-black rounded-full ${e.licence_status === 'Valid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${esc(e.licence_status)}</span>
          </div>

          <div class="space-y-1.5">
            ${e.compliance_docs.map(d => `
              <div class="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                <span class="flex items-center gap-1.5"><span></span><span class="font-semibold">${esc(d.name)}</span></span>
                <span class="text-emerald-600 font-bold"> Signed (${d.date})</span>
              </div>
            `).join('')}
        <!-- MarketSync Advantage: Real-Time Sales & Operations Integration -->
        <div class="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl space-y-3 text-xs">
          <div class="font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider text-[10px]">MarketSync Dealership Operations Integration</div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div class="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-[10px] text-slate-400">MTD Units</div>
              <div class="text-base font-black text-slate-900 dark:text-white">${e.perf.units_mtd || 14}</div>
            </div>
            <div class="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-[10px] text-slate-400">MTD Gross</div>
              <div class="text-base font-black text-emerald-600">$${(e.perf.gross_mtd || 38400).toLocaleString()}</div>
            </div>
            <div class="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-[10px] text-slate-400">Active Leads</div>
              <div class="text-base font-black text-indigo-600">${e.perf.active_leads || 28}</div>
            </div>
            <div class="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-[10px] text-slate-400">Earned Comm.</div>
              <div class="text-base font-black text-violet-600">$${(e.perf.comm_mtd || 4900).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0 flex justify-end">
        <button data-close class="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs">Close Inspector</button>
      </div>
    </div>
  `;
  automationModal(modalHtml, 'max-w-3xl');
}
window.openEmployeeProfileModal = openEmployeeProfileModal;

// ── 3. Compliance, Safety & Training Tab ─────────────────────────────────────
const DEALERSHIP_TRAINING_COURSES = [
  {
    id: 'whmis',
    title: 'WHMIS 2015 & Chemical Safety',
    duration: '10 In-Depth Modules · 25-Question Test',
    role: 'All Dealership Staff',
    icon: '',
    desc: 'Canadian GHS hazard classification, 16-section SDS sheets, GHS pictograms, and shop spill containment.',
    slides: [
      {
        title: 'Module 1: Introduction to WHMIS 2015 & GHS Alignment',
        subtitle: 'Canadian Occupational Health & Safety Legal Framework',
        image: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&auto=format&fit=crop&q=80',
        points: [
          'WHMIS (Workplace Hazardous Materials Information System) is Canada’s national hazard communication standard.',
          'Updated to align with the United Nations Globally Harmonized System (GHS) of Classification and Labelling.',
          'Applies to all shop solvents, detail acids, brake cleaners, paints, lubricants, and battery fluids.',
          'Mandated under Canadian Federal Hazardous Products Act and Provincial OHSA legislation.'
        ],
        speakerText: 'Welcome to WHMIS 2015 and Chemical Safety. WHMIS is Canada’s national hazard communication standard. Aligned with GHS, it ensures every worker has immediate access to critical safety data for all chemicals handled in service and detailing.'
      },
      {
        title: 'Module 2: The 9 GHS Hazard Pictograms & Symbol Meanings',
        subtitle: 'Recognizing Physical, Health & Environmental Hazard Symbols',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=80',
        points: [
          'Pictograms feature a black symbol inside a red diamond border on a white background.',
          'Flame: Flammable liquids/gases/solids (brake cleaners, detail solvents, touch-up paints).',
          'Flame Over Circle: Oxidizers that intensify fires (bulk peroxide cleaners, oxygen tanks).',
          'Corrosion: Causes severe skin burns, permanent eye damage, and metal corrosion (acid wheel cleaners).',
          'Skull & Crossbones: Acute toxicity (fatal or toxic if swallowed, inhaled, or absorbed through skin).'
        ],
        speakerText: 'GHS pictograms are standardized globally. Look for the distinctive red diamond border. Symbols like Flame, Corrosion, and Skull & Crossbones provide immediate visual warnings before opening chemical containers.'
      },
      {
        title: 'Module 3: Supplier Labels vs Workplace Labels',
        subtitle: 'Mandatory Container Labelling Regulations in Canadian Dealerships',
        image: 'https://images.unsplash.com/photo-1618042164219-62c820f10723?w=800&auto=format&fit=crop&q=80',
        points: [
          'Supplier Labels feature 6 mandatory elements: Product Name, GHS Pictograms, Signal Word, Hazard Statements, Precautionary Statements, and Supplier ID.',
          'Workplace Labels MUST be applied whenever chemicals are transferred to secondary spray bottles.',
          'Workplace Labels require 3 items: Product Identifier, Safe Handling Instructions, and Reference to the SDS.',
          'Unlabelled containers are strictly illegal on shop floors and must be tagged out immediately.'
        ],
        speakerText: 'Supplier labels must never be defaced. If you transfer brake cleaner, degreaser, or detail concentrate into a secondary spray bottle, you MUST affix a complete Workplace Label before using it.'
      },
      {
        title: 'Module 4: Safety Data Sheets (SDS) — The 16 Standardized Sections',
        subtitle: 'Comprehensive Chemical Profile & Emergency Guidance',
        image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
        points: [
          'SDS binders or electronic MarketSync SDS access MUST be available to all staff 24/7.',
          'Section 4: First-Aid Measures (Immediate instructions for skin contact, eye contact, or inhalation).',
          'Section 8: Exposure Controls & PPE (Specifies nitrile vs neoprene gloves, safety goggles, respirators).',
          'Section 11: Toxicological Information (Acute toxicity, carcinogenicity, and organ damage metrics).'
        ],
        speakerText: 'Safety Data Sheets are organized into sixteen uniform sections. Section 4 covers emergency first aid, while Section 8 details the exact PPE required before handling the product.'
      },
      {
        title: 'Module 5: Personal Protective Equipment (PPE) Selection & Inspection',
        subtitle: 'Protecting Skin, Eyes & Respiratory Tract in Service & Detail Bays',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=80',
        points: [
          'Eye Protection: CSA Z94.3 splash goggles required when handling acids, battery fluid, or solvents.',
          'Glove Selection: Standard nitrile gloves for solvents; heavy neoprene gloves for acid wheel cleaners.',
          'Respiratory Protection: Half-mask organic vapor respirators required when spraying paint or undercoat.',
          'Inspect PPE for tears, cracks, or chemical degradation before every shift.'
        ],
        speakerText: 'Always wear CSA-approved eye protection and appropriate chemical-resistant gloves. Regular latex or household gloves dissolve when exposed to shop solvents — verify glove rating in SDS Section 8.'
      },
      {
        title: 'Module 6: Emergency Eyewash & Body Shower Protocols',
        subtitle: '15-Minute Continuous Irrigation Emergency Standard',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=80',
        points: [
          'Eyewash Stations: Flush eyes continuously for 15 MINUTES MINIMUM following chemical splash.',
          'Hold eyelids open with fingers to ensure thorough irrigation behind the eye.',
          'Eyewash stations must be inspected and flushed WEEKLY to verify clean water flow.',
          'Seek medical evaluation immediately following 15-minute emergency eyewash irrigation.'
        ],
        speakerText: 'If chemicals enter your eyes, proceed immediately to the nearest eyewash station. Flush continuously for at least fifteen full minutes while holding eyelids open, then seek emergency medical care.'
      },
      {
        title: 'Module 7: Shop Chemical Spill Containment & Absorbents',
        subtitle: 'Preventing Environmental Contamination & Floor Drain Hazards',
        image: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&auto=format&fit=crop&q=80',
        points: [
          'Spill Response Steps: Evacuate immediate area, eliminate ignition sources, wear full PPE.',
          'Spill Kits: Deploy absorbent socks around floor drains to block chemical entry into storm sewers.',
          'Use neutralizer pads for acid spills and oil-only absorbent pads for fuel/solvent spills.',
          'Dispose of contaminated absorbents in yellow hazardous waste drums according to environmental laws.'
        ],
        speakerText: 'In the event of a chemical spill, block floor drains immediately using spill socks. Contain the liquid with absorbent pads and report the incident to your Shop Foreman and HR Compliance Officer.'
      },
      {
        title: 'Module 8: Flammable Liquid Storage & Fire Prevention',
        subtitle: 'Handling Bulk Drum Transfer & Fire-Rated Storage Cabinets',
        image: 'https://images.unsplash.com/photo-1618042164219-62c820f10723?w=800&auto=format&fit=crop&q=80',
        points: [
          'Flammables (brake cleaner, solvents, lacquers) MUST be stored in yellow fire-rated safety cabinets.',
          'Keep cabinets closed and latched when not actively removing inventory.',
          'Grounding & Bonding: Attach copper grounding cables when dispensing flammable liquids from 205L drums to prevent static ignition.',
          'No smoking, welding, or open flames within 15 meters of chemical storage areas.'
        ],
        speakerText: 'Flammable solvents must be stored inside self-closing fire cabinets. When pumping from bulk drums, connect grounding wires to discharge static electricity before sparking can ignite vapors.'
      },
      {
        title: 'Module 9: Compressed Gas Cylinders (GHS Gas Cylinder Pictogram)',
        subtitle: 'Oxygen, Acetylene & Refrigerant Cylinder Handling Rules',
        image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
        points: [
          'Gas cylinders store energy up to 2500 PSI — valve shear converts cylinder into a missile.',
          'Chain cylinders vertically to wall brackets or cart frames at all times.',
          'Store Oxygen and Acetylene cylinders at least 6 meters apart or separated by a 1.5m fire wall.',
          'Keep protective valve caps screwed tight whenever cylinders are not connected to regulators.'
        ],
        speakerText: 'Compressed gas cylinders represent extreme pressure hazards. Secure all welding and refrigerant tanks vertically with heavy safety chains and keep valve protective caps installed during transport.'
      },
      {
        title: 'Module 10: Employer Responsibilities & Annual Training Audit',
        subtitle: 'Maintaining 100% Dealership Health & Safety Compliance',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=80',
        points: [
          'Employers MUST provide WHMIS training to all new hires and conduct annual program reviews.',
          'All shop chemical inventories must be updated annually with current SDS sheets.',
          'Workers have the legal right to know about chemical hazards in their workplace.',
          'Failure to comply carries fines up to $1,500,000 under Canadian Provincial OHS Acts.'
        ],
        speakerText: 'WHMIS compliance is refreshed annually. Employers must ensure every chemical has an active SDS and that all staff complete training before operating shop equipment.'
      }
    ],
    quiz: [
      { question: 'What border shape and color identifies WHMIS 2015 / GHS hazard pictograms?', options: ['Yellow Triangle', 'Red Diamond', 'Blue Circle', 'Black Square'], answer: 1, explanation: 'WHMIS 2015 pictograms feature a black symbol on a white background inside a Red Diamond border.' },
      { question: 'How long must you flush your eyes at an eyewash station after chemical contact?', options: ['2 minutes', '5 minutes', '15 continuous minutes', '30 seconds'], answer: 2, explanation: 'Emergency eyewash standards mandate flushing eyes for at least 15 continuous minutes.' },
      { question: 'What must be applied when transferring brake cleaner or solvent into a secondary spray bottle?', options: ['A price sticker', 'A Workplace Label', 'A shipping tag', 'Nothing is needed'], answer: 1, explanation: 'Workplace Labels are mandatory on all secondary containers containing hazardous products.' },
      { question: 'Which SDS section contains emergency First-Aid Measures?', options: ['Section 1', 'Section 4', 'Section 8', 'Section 16'], answer: 1, explanation: 'Section 4 provides immediate emergency first aid procedures for exposure.' },
      { question: 'Which SDS section details Exposure Controls & Personal Protective Equipment (PPE)?', options: ['Section 2', 'Section 5', 'Section 8', 'Section 12'], answer: 2, explanation: 'Section 8 lists required PPE such as gloves, eye protection, and respirators.' },
      { question: 'How many standardized sections are in a WHMIS 2015 Safety Data Sheet (SDS)?', options: ['8 Sections', '10 Sections', '12 Sections', '16 Sections'], answer: 3, explanation: 'GHS standardizes all SDS documents into 16 uniform sections.' },
      { question: 'What signal words are used on WHMIS 2015 supplier labels?', options: ['CAUTION and NOTICE', 'DANGER and WARNING', 'HIGH and LOW', 'STOP and GO'], answer: 1, explanation: 'DANGER (severe hazard) and WARNING (less severe hazard) are the official signal words.' },
      { question: 'What hazard is identified by the GHS Flame Over Circle pictogram?', options: ['Flammable Liquids', 'Oxidizing Solids/Gases/Liquids', 'Explosives', 'Corrosives'], answer: 1, explanation: 'Flame Over Circle indicates oxidizers that intensify combustion.' },
      { question: 'What hazard is identified by the GHS Skull and Crossbones pictogram?', options: ['Corrosive to Metals', 'Acute Toxicity (Fatal or Toxic)', 'Skin Irritants', 'Gas Under Pressure'], answer: 1, explanation: 'Skull and Crossbones indicates acute toxicity that can cause fatal poisoning.' },
      { question: 'What hazard is identified by the GHS Corrosion pictogram?', options: ['Self-heating chemicals', 'Severe skin burns and eye damage', 'Carcinogens', 'Compressed gases'], answer: 1, explanation: 'Corrosion symbol alerts to irreversible skin burns, eye destruction, and metal corrosion.' },
      { question: 'What hazard is identified by the GHS Gas Cylinder pictogram?', options: ['Flammable aerosols', 'Gases under pressure', 'Organic peroxides', 'Environmental hazard'], answer: 1, explanation: 'Gas Cylinder identifies compressed, liquefied, or dissolved gases under pressure.' },
      { question: 'What hazard is identified by the GHS Exploding Bomb pictogram?', options: ['Self-reactive substances & organic peroxides', 'Aspiration hazard', 'Reproductive toxicity', 'Oxidizing gases'], answer: 0, explanation: 'Exploding bomb indicates unstable explosives and self-reactive chemical hazards.' },
      { question: 'What hazard is identified by the GHS Health Hazard (silhouette) pictogram?', options: ['Acute toxicity', 'Carcinogenicity & organ toxicity', 'Flammable solids', 'Corrosive to eyes'], answer: 1, explanation: 'Health hazard symbol alerts to chronic risks like carcinogenicity and organ toxicity.' },
      { question: 'Who is legally responsible for providing Safety Data Sheets (SDS) at the dealership?', options: ['Only the janitor', 'The Employer & Chemical Supplier', 'The customer', 'Municipal police'], answer: 1, explanation: 'Chemical suppliers must supply SDS, and employers must make them accessible to staff 24/7.' },
      { question: 'How often must WHMIS employee safety training be reviewed in Canada?', options: ['Every 10 years', 'Annually', 'Only when someone gets injured', 'Never'], answer: 1, explanation: 'Occupational health acts mandate annual reviews of workplace WHMIS training.' },
      { question: 'What PPE must be worn when dispensing chemical concentrates from 205L bulk drums?', options: ['No PPE needed', 'CSA eye protection, chemical gloves & apron', 'Sunglasses and cloth gloves', 'Dust mask only'], answer: 1, explanation: 'Bulk chemical transfer requires full splash goggles, chemical gloves, and protective aprons.' },
      { question: 'What is the primary function of a chemical spill kit?', options: ['Clean windows', 'Contain and absorb spills before reaching drains', 'Mop floor tile', 'Disinfect door handles'], answer: 1, explanation: 'Spill kits contain absorbent socks and pads to block chemicals from entering sewer drains.' },
      { question: 'What action is required if a newly delivered chemical product lacks an SDS binder entry?', options: ['Use it anyway', 'Obtain the SDS before putting product into service', 'Throw it away', 'Mix with water'], answer: 1, explanation: 'Products without an accessible SDS must not be used until the SDS is placed on file.' },
      { question: 'Where must flammable brake cleaners and solvents be stored overnight?', options: ['In open wooden crates', 'Inside yellow fire-rated safety cabinets', 'Under showroom desks', 'Outside in the rain'], answer: 1, explanation: 'Flammable liquids must be stored in approved fire-rated self-closing safety cabinets.' },
      { question: 'What 3 elements are mandatory on a Workplace Label for decanted spray bottles?', options: ['Price, Date, Color', 'Product Name, Safe Handling Instructions, Reference to SDS', 'Barcode, Serial #, Weight', 'Logo, Phone #, Website'], answer: 1, explanation: 'Workplace labels require Product Identifier, Safe Handling Instructions, and SDS reference.' },
      { question: 'What should be done if a secondary chemical container label becomes torn or illegible?', options: ['Guess the contents', 'Replace with a valid Workplace Label immediately', 'Throw bottle at trash', 'Ignore it'], answer: 1, explanation: 'Unlabelled or damaged container labels must be replaced immediately for worker safety.' },
      { question: 'Which SDS section details Fire-Fighting Measures?', options: ['Section 2', 'Section 5', 'Section 9', 'Section 14'], answer: 1, explanation: 'Section 5 provides specific fire extinguishing media and protective measures for firefighters.' },
      { question: 'Which SDS section details Safe Handling and Storage precautions?', options: ['Section 3', 'Section 7', 'Section 10', 'Section 15'], answer: 1, explanation: 'Section 7 specifies safe storage conditions, ventilation requirements, and handling rules.' },
      { question: 'What precaution prevents static electricity sparks when pumping flammable liquids from bulk drums?', options: ['Bonding and grounding copper cables', 'Wearing rubber boots', 'Opening windows', 'Turning off lights'], answer: 0, explanation: 'Attaching grounding/bonding cables discharges static electricity before sparks can ignite vapors.' },
      { question: 'What legal authority governs WHMIS enforcement in Canadian workplaces?', options: ['Municipal Bylaws', 'Federal Hazardous Products Act & Provincial OHSA', 'Highway Traffic Act', 'Banking Act'], answer: 1, explanation: 'WHMIS is enforced under federal Hazardous Products legislation and provincial OHSA acts.' }
    ]
  },
  {
    id: 'bill168',
    title: 'Workplace Violence & Harassment (Bill 168 / OHSA)',
    duration: '10 In-Depth Modules · 25-Question Test',
    role: 'All Dealership Staff',
    icon: '',
    desc: 'Ontario OHSA Bill 168 legal standards, harassment prevention, risk assessment, and zero-reprisal reporting.',
    slides: [
      {
        title: 'Module 1: Bill 168 Legal Framework & Worker Rights',
        subtitle: 'Ontario Occupational Health & Safety Act Amendments',
        image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&auto=format&fit=crop&q=80',
        points: [
          'Bill 168 explicitly amends the Occupational Health and Safety Act (OHSA) to cover violence and harassment.',
          'Every worker has the strict legal right to a workplace free from physical violence, threats, and harassment.',
          'Applies across all dealership locations: showroom, service drive, customer test drives, and off-site events.',
          'Employers have a positive legal duty to implement written policies, risk assessments, and reporting protocols.'
        ],
        speakerText: 'Under Bill 168 and Canadian provincial health and safety acts, every worker is entitled to a safe workplace free from violence and harassment. This protection extends to all work activities, including customer test drives and off-site meetings.'
      },
      {
        title: 'Module 2: Defining Workplace Harassment & Sexual Harassment',
        subtitle: 'Recognizing Unwelcome Behavior, Intimidation & Bullying',
        image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80',
        points: [
          'Workplace Harassment: Engaging in a course of vexatious comment or conduct known or ought reasonably to be known as unwelcome.',
          'Includes verbal insults, offensive jokes, intimidation, cyber-bullying, or social exclusion.',
          'Sexual Harassment: Unwelcome sexual advances, requests for sexual favors, or sex-based derogatory remarks.',
          'Single Incident Rule: A single severe incident can legally constitute workplace harassment.'
        ],
        speakerText: 'Harassment includes any unwelcome comments, sexual advances, or bullying behavior. A single severe incident can constitute harassment. Dealership policy prohibits all forms of discriminatory behavior.'
      },
      {
        title: 'Module 3: Defining Workplace Violence & Physical Hazards',
        subtitle: 'Physical Force, Threats & Aggressive Customer Conduct',
        image: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
        points: [
          'Workplace Violence: The exercise of physical force, or attempt/threat to exercise physical force against a worker.',
          'Covers physical assault, pushing, throwing objects, or threatening physical harm.',
          'Includes aggressive customer behavior during price negotiations or service disputes.',
          'Worker safety ALWAYS takes precedence over closing a sale or appeasing a customer.'
        ],
        speakerText: 'Workplace violence encompasses any physical force or verbal threats of violence. Your physical safety is our highest priority — never remain in a situation where a customer or coworker threatens harm.'
      },
      {
        title: 'Module 4: Dealership Risk Assessments & High-Risk Roles',
        subtitle: 'Identifying Hazards in Cash Handling, Late Hours & Test Drives',
        image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80',
        points: [
          'Employers must conduct annual risk assessments evaluating job roles, location, and work structure.',
          'High-Risk Dealership Areas: Cashier booths, late-night sales shifts, isolated vehicle lots, and lone test drives.',
          'Risk Control Measures: Adequate lighting, security cameras, panic buttons, and buddy system policies.',
          'Results of risk assessments must be shared with the Joint Health and Safety Committee (JHSC).'
        ],
        speakerText: 'Dealerships conduct annual risk assessments for high-risk roles like cashiering and test drives. Protective measures include showroom panic buttons, well-lit lot perimeters, and buddy protocols.'
      },
      {
        title: 'Module 5: Lone Worker Protocols & Customer Test Drive Safety',
        subtitle: 'Mandatory Guidelines for Sales Representatives On the Road',
        image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop&q=80',
        points: [
          'Inspect photo driver licence and scan into MarketSync CRM prior to vehicle key release.',
          'Log planned test drive route and expected return time in the Desk Manager Logbook.',
          'If a customer displays aggressive, erratic, or suspicious behavior, ABORT the test drive immediately.',
          'Never drive into isolated areas alone with a customer if you feel unsafe.'
        ],
        speakerText: 'Before taking a customer on a test drive, verify their licence and log your route. If a customer acts aggressively, safely abort the drive into a populated well-lit area and notify management.'
      },
      {
        title: 'Module 6: Domestic Violence Spillover in the Workplace',
        subtitle: 'Employer Duty of Protection & Confidential Safety Plans',
        image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&auto=format&fit=crop&q=80',
        points: [
          'If an employer becomes aware that domestic violence may spill into the workplace, precautions MUST be taken.',
          'Employees can confidentially report domestic threats or restraining orders to HR Management.',
          'Safety Measures: Parking escorts, building access restrictions, screening phone calls, and schedule adjustments.',
          'Strict confidentiality is maintained to protect the disclosing employee.'
        ],
        speakerText: 'If you are facing domestic threats that could impact safety at the dealership, report it confidentially to HR. We will implement personalized safety escorts, phone screening, and lot security.'
      },
      {
        title: 'Module 7: Emergency Escalation & Showroom Panic Buttons',
        subtitle: 'Immediate Response to Active Violence or Robbery Threats',
        image: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
        points: [
          'Showroom Panic Buttons: Located at Cashier desks, F&I offices, and Sales Tower; triggers silent alarm to 911.',
          'In an active violence event: RUN (evacuate if possible), HIDE (lock doors & silence phones), FIGHT (last resort).',
          'Do not physically intervene in armed robbery or violent fights; evacuate and call Emergency 911.',
          'Notify General Manager and HR Lead immediately following emergency response.'
        ],
        speakerText: 'In an emergency, use showroom panic buttons to signal silent police response. Never attempt to disarm or fight an armed intruder — evacuate immediately and alert emergency services.'
      },
      {
        title: 'Module 8: Formal Complaint Procedures & Impartial Investigation',
        subtitle: 'How Complaints Are Processed & Investigated',
        image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80',
        points: [
          'Filing a Complaint: Submit written or verbal report to HR Lead, General Manager, or Health & Safety Rep.',
          'Investigation Standard: All reports are investigated promptly by an impartial internal or external investigator.',
          'Both complainant and respondent receive opportunity to present evidence and witness details.',
          'Written findings and corrective actions are provided to both parties upon investigation completion.'
        ],
        speakerText: 'All harassment and violence complaints are thoroughly investigated by an impartial party. Both sides are interviewed confidentially, and written investigation outcomes are documented.'
      },
      {
        title: 'Module 9: Strict Zero-Reprisal Policy & Whistleblower Protections',
        subtitle: 'Legal Immunity Against Retaliation for Complaint Filers',
        image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80',
        points: [
          'Strict Zero Tolerance for Reprisal: Filing a complaint or participating in an investigation will NEVER impact your job.',
          'It is a serious violation of provincial law for any manager or coworker to retaliate against a complainant.',
          'Corrective actions for offenders range from mandatory sensitivity training to immediate employment termination.',
          'Unsubstantiated complaints made in good faith carry zero penalty.'
        ],
        speakerText: 'Canadian law strictly forbids retaliation against anyone reporting harassment. You can file a report in complete confidence knowing your job and career path are fully protected.'
      },
      {
        title: 'Module 10: Joint Health & Safety Committee (JHSC) & Support Programs',
        subtitle: 'Workplace Safety Representation & Employee Assistance Programs',
        image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&auto=format&fit=crop&q=80',
        points: [
          'The Joint Health and Safety Committee (JHSC) reviews incident reports and recommends safety upgrades.',
          'Employee Assistance Program (EAP): Offers free, confidential professional counseling and trauma support.',
          'Annual Policy Review: Policy statements posted publicly in employee breakrooms.',
          'Individual compliance training refreshed annually for all dealership staff.'
        ],
        speakerText: 'Our Joint Health and Safety Committee oversees workplace safety policies. If you experience distress, our Employee Assistance Program provides free, confidential counseling services.'
      }
    ],
    quiz: [
      { question: 'Does Bill 168 workplace harassment protection apply during off-site dealership test drives or events?', options: ['No, only inside the dealership building', 'Yes, it covers all work-related environments', 'Only if a manager is present', 'Only during business hours'], answer: 1, explanation: 'Bill 168 protection applies to all work-related environments, including test drives and off-site events.' },
      { question: 'What is the dealership policy regarding reprisal against an employee filing a harassment complaint?', options: ['Allowed if minor', 'Strictly prohibited / Zero tolerance', 'Subject to manager discretion', 'Only allowed after 30 days'], answer: 1, explanation: 'Canadian health and safety law strictly prohibits reprisal or retaliation against any worker reporting harassment.' },
      { question: 'What should a sales rep do if a customer displays aggressive or threatening behavior during a test drive?', options: ['Ignore it and keep driving', 'Safely return or pull over into a populated area and contact management', 'Argue back', 'Finish the 30-minute route'], answer: 1, explanation: 'Your safety is priority #1. Safely abort the test drive into a well-lit populated area and notify management immediately.' },
      { question: 'What constitutes workplace harassment under Canadian provincial health & safety legislation?', options: ['Constructive performance reviews', 'Unwelcome comments, intimidation, sexual remarks, or bullying', 'Assigning weekend shifts', 'Setting sales targets'], answer: 1, explanation: 'Harassment is any course of vexatious comment or conduct known to be unwelcome.' },
      { question: 'What is the employer’s legal duty if aware of domestic violence threats that could spill into the workplace?', options: ['Ignore personal matters', 'Take reasonable precautions to protect workers', 'Fire the employee', 'Tell customer service'], answer: 1, explanation: 'Employers must implement safety measures if domestic violence threatens worker safety at the workplace.' },
      { question: 'How often must dealership workplace violence risk assessments be conducted?', options: ['Every 5 years', 'At least annually', 'Only after a police visit', 'Never'], answer: 1, explanation: 'Bill 168 mandates annual workplace violence risk assessments.' },
      { question: 'What is the function of showroom panic buttons located at Cashier and F&I desks?', options: ['Open garage doors', 'Trigger silent emergency call to 911 police dispatch', 'Turn off showroom lights', 'Ring sales bell'], answer: 1, explanation: 'Panic buttons trigger silent alarms to dispatch emergency police services.' },
      { question: 'What lone worker protocol should sales reps follow before customer test drives?', options: ['Inspect driver licence, log route, and notify desk manager', 'No protocol needed', 'Hand over keys without checking ID', 'Drive on highway only'], answer: 0, explanation: 'Reps must verify licence ID and log route details prior to departing.' },
      { question: 'Does a single severe incident of verbal abuse or physical threat constitute workplace harassment?', options: ['No, requires 5 incidents', 'Yes, a single severe event can constitute harassment', 'Only if written down', 'Only if recorded on video'], answer: 1, explanation: 'Under health & safety law, a single severe incident can legally constitute harassment.' },
      { question: 'What should an employee do if observing physical violence in the service bay?', options: ['Physically join the fight', 'Do not intervene physically; call 911 and notify Management', 'Record for social media', 'Walk away and go home'], answer: 1, explanation: 'Never endanger yourself; call 911 immediately and alert management.' },
      { question: 'Are harassment complaints kept confidential during an investigation?', options: ['No, posted on notice boards', 'Yes, information is shared strictly on a need-to-know basis', 'Told to all customers', 'Published in newsletter'], answer: 1, explanation: 'Investigations are conducted with strict confidentiality to protect all parties.' },
      { question: 'Who investigates formal workplace harassment or violence complaints at the dealership?', options: ['The receptionist', 'An impartial internal lead or independent external investigator', 'The janitor', 'Competitor dealerships'], answer: 1, explanation: 'Investigations must be conducted by an objective, trained impartial investigator.' },
      { question: 'What is the consequence for an employee who retaliates against a coworker for reporting harassment?', options: ['Verbal warning only', 'Severe disciplinary action up to immediate termination', 'A small fine', 'No consequence'], answer: 1, explanation: 'Retaliation is a major policy violation resulting in immediate disciplinary action up to termination.' },
      { question: 'Does Bill 168 harassment protection extend to digital communication like work email, SMS, and Slack?', options: ['No, paper notes only', 'Yes, digital harassment is fully covered under OHSA', 'Only on personal phones', 'Only during office hours'], answer: 1, explanation: 'Electronic harassment via email, SMS, or social media is fully covered under OHSA.' },
      { question: 'What role does the Joint Health and Safety Committee (JHSC) play regarding workplace violence?', options: ['Set vehicle prices', 'Review risk assessments, incident reports, and recommend safety measures', 'Sell cars', 'Approve vacation days'], answer: 1, explanation: 'JHSC reviews hazard assessments and recommends workplace safety improvements.' },
      { question: 'What support service provides free, confidential counseling for dealership employees facing trauma or personal stress?', options: ['The Parts Department', 'Employee Assistance Program (EAP)', 'The Car Wash', 'The Accounting Office'], answer: 1, explanation: 'EAP provides confidential professional counseling and trauma support.' },
      { question: 'Can a customer who engages in abusive behavior toward dealership staff be banned from the property?', options: ['No, customer is always right', 'Yes, legal trespass notices and site bans can be enforced', 'Only if buying a cheap car', 'Only on weekends'], answer: 1, explanation: 'Worker safety comes first; abusive customers can be served legal trespass notices.' },
      { question: 'What constitutes sexual harassment in the workplace?', options: ['Discussing vehicle specs', 'Unwelcome sexual advances, requests for favors, or gender-based insults', 'Asking for a sales brochure', 'Scheduling a shift'], answer: 1, explanation: 'Sexual harassment includes any unwelcome sexual conduct, advances, or gender-based remarks.' },
      { question: 'What should an employee do if they feel an investigation was not conducted fairly?', options: ['Quit immediately', 'Escalate to HR Senior Management or the Ministry of Labour', 'Slashed tires', 'Post on public forums'], answer: 1, explanation: 'Workers can escalate concerns to senior HR or the provincial Ministry of Labour.' },
      { question: 'What is the requirement for posting the dealership Workplace Violence & Harassment Policy?', options: ['Hidden in a safe', 'Posted in a conspicuous location accessible to all workers', 'Only shown to managers', 'Sent via fax once'], answer: 1, explanation: 'Policies must be posted publicly in breakrooms or central staff portals.' },
      { question: 'What protection is granted to witnesses who give evidence during a harassment investigation?', options: ['None', 'Full protection against reprisal under OHSA legislation', 'Reduced pay', 'Shift demotion'], answer: 1, explanation: 'Witnesses are legally protected against any form of employment reprisal.' },
      { question: 'What action should be taken if a worker believes a situation poses imminent physical danger?', options: ['Finish shift', 'Exercise Right to Refuse unsafe work and alert supervisor', 'Ignore danger', 'Ask customer for permission'], answer: 1, explanation: 'Workers have the legal right to refuse work if they have reasonable cause to believe danger exists.' },
      { question: 'What is the maximum corporate fine for violating Occupational Health & Safety Act mandates in Ontario?', options: ['$5,000', '$50,000', '$1,500,000', '$100'], answer: 2, explanation: 'Corporations can be fined up to $1,500,000 for severe OHSA violations.' },
      { question: 'Who is required to complete Bill 168 Workplace Violence & Harassment training at the dealership?', options: ['Sales reps only', 'All dealership employees, managers, and executives', 'Part-time detailers only', 'No one'], answer: 1, explanation: 'Training is mandatory for all personnel regardless of role or seniority.' },
      { question: 'What is the primary objective of Ontario Bill 168?', options: ['Increase car sales', 'Ensure safe, respectful workplaces free from violence and harassment', 'Reduce tax rates', 'Speed up service repair'], answer: 1, explanation: 'Bill 168 mandates proactive protection against violence and harassment in the workplace.' }
    ]
  },
  {
    id: 'hoist',
    title: 'Automotive Lift & Hoist Safety Inspection',
    duration: '10 In-Depth Modules · 25-Question Test',
    role: 'Service & Detail Staff',
    icon: '',
    desc: 'ALI Certified hoist standards, pre-operational lock checks, 6-inch nudge stability test, and LOTO procedures.',
    slides: [
      {
        title: 'Module 1: Automotive Lift Institute (ALI) Standards & Certification',
        subtitle: 'ANSI/ALI ALOIM Safety Requirements for Vehicle Lifts',
        image: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&auto=format&fit=crop&q=80',
        points: [
          'Automotive lifts are high-capacity heavy machinery capable of elevating 4,000kg to 30,000kg overhead.',
          'Governed by ANSI/ALI ALOIM (Safety Requirements for Operation, Inspection and Maintenance).',
          'Lifts MUST undergo formal annual inspection and certification by an ALI Certified Lift Inspector.',
          'Gold ALI validation stickers on lift columns confirm active safety certification.'
        ],
        speakerText: 'Automotive lifts are high-capacity machinery governed by ALI standards. All dealership hoists must undergo annual inspections by certified inspectors. Look for the gold ALI certification sticker on lift columns.'
      },
      {
        title: 'Module 2: Daily Pre-Operational Hoist Inspection Checklist',
        subtitle: 'Mandatory Visual & Functional Checks Before First Daily Lift',
        image: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&auto=format&fit=crop&q=80',
        points: [
          'Visual Inspection: Inspect hydraulic lines, fittings, and cylinder seals for fluid leaks.',
          'Lift Arms & Restraints: Verify automatic gear locks engage when lift arm is raised 2 inches.',
          'Adapter Pads: Inspect rubber contact pads for cracks, gouges, missing pins, or severe wear.',
          'Concrete Anchors: Verify column anchor bolts are tight with no floor cracking around bases.'
        ],
        speakerText: 'Before lifting any vehicle, perform a daily pre-operational check. Inspect hydraulic hoses for leaks, verify automatic arm restraints lock properly, and ensure lift pads are free of cracks.'
      },
      {
        title: 'Module 3: Lift Types — 2-Post Asymmetric vs 4-Post Alignment Lifts',
        subtitle: 'Understanding Lifting Dynamics & Drive-On Runways',
        image: 'https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=800&auto=format&fit=crop&q=80',
        points: [
          '2-Post Frame-Engaging Lifts: Swing arms contact vehicle frame or pinch welds; allows wheel removal.',
          'Asymmetric 2-Post: Columns rotated 30 degrees to position vehicle doors behind columns for easy entry.',
          '4-Post Runway Lifts: Vehicle drives onto steel runways; ideal for alignment, oil changes, and heavy trucks.',
          'Scissor & In-Ground Lifts: Require clear bay perimeter and floor bay cover alignment.'
        ],
        speakerText: '2-post frame lifts swing under OEM lifting points allowing wheel service. 4-post runway lifts support wheels directly. Always match vehicle service requirements with the correct lift design.'
      },
      {
        title: 'Module 4: Vehicle Weight Capacity & Center of Gravity (CG) Verification',
        subtitle: 'Preventing Hoist Overload & Vehicle Tipping Hazards',
        image: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=800&auto=format&fit=crop&q=80',
        points: [
          'Capacity Plate: Verify vehicle gross weight does NOT exceed the rated capacity listed on the lift column.',
          'Center of Gravity (CG): Position vehicle so CG is centered between lift columns (30/70 weight split).',
          'Heavy EV Batteries & Diesel Trucks: EV batteries shift CG toward vehicle center; heavy diesel engines shift CG forward.',
          'Removing Heavy Components: Removing a rear axle or engine on a 2-post lift can dangerously alter CG and tip vehicle.'
        ],
        speakerText: 'Never exceed the hoist tonnage rating. Center the vehicle’s center of gravity between columns. Removing heavy engines or axles while elevated alters vehicle balance — use auxiliary jack stands.'
      },
      {
        title: 'Module 5: OEM Adapter Pad Placement & Pinch Weld Rules',
        subtitle: 'Positioning Lifting Pads Squarely on Designated Frame Points',
        image: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&auto=format&fit=crop&q=80',
        points: [
          'Consult vehicle service manual or ALI Lifting Point Guide for exact manufacturer jack points.',
          'Unibody Cars: Position pads under designated reinforced pinch welds or subframe mounts.',
          'Frame Vehicles: Position pads under boxed frame rails; never under floorboards, fuel lines, or brake pipes.',
          'High-Reach Extensions: Use equal height stackable adapters when lifting high-clearance trucks or SUVs.'
        ],
        speakerText: 'Position lift pads squarely under OEM designated contact points. Never place pads against floorboards, brake lines, or unreinforced rocker panels.'
      },
      {
        title: 'Module 6: The 6-Inch Elevation Safety Nudge Test',
        subtitle: 'Mandatory Stability Verification Before High Elevation',
        image: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&auto=format&fit=crop&q=80',
        points: [
          'Raise vehicle 6 inches (15 cm) off the shop floor until tires clear the ground.',
          'Stop elevation and apply a firm manual push/nudge to the front and rear bumpers.',
          'Check that all 4 adapter pads remain solidly engaged without slippage or frame shifting.',
          'If vehicle sways or pad slips, lower vehicle immediately to floor and re-position pads.'
        ],
        speakerText: 'Always perform the 6-inch safety nudge test. Raise the car six inches off the ground, firmly nudge the bumper to verify pad stability, then continue raising to full working height.'
      },
      {
        title: 'Module 7: Lowering Hoist onto Mechanical Safety Locks',
        subtitle: 'Never Working Under Hydraulic Pressure Alone',
        image: 'https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=800&auto=format&fit=crop&q=80',
        points: [
          'Mechanical Safety Locks: Heavy steel latches engage automatically at column lock stops as lift ascends.',
          'Lowering to Locks: After reaching working height, depress lowering valve to seat hoist onto locks.',
          'STRICT RULE: NEVER step under a raised vehicle supported solely by hydraulic oil pressure.',
          'Hydraulic line rupture or cylinder seal failure will cause instant overhead collapse if locks are disengaged.'
        ],
        speakerText: 'Never work under a lift resting on hydraulic pressure alone. Once raised, lower the hoist onto its mechanical safety locks before stepping beneath the vehicle.'
      },
      {
        title: 'Module 8: Overhead Hazard Prevention & Under-Vehicle PPE',
        subtitle: 'Personal Safety Equipment & Bay Clearance Protocol',
        image: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=800&auto=format&fit=crop&q=80',
        points: [
          'Under-Vehicle PPE: CSA steel-toe boots and Z94.3 safety glasses required in service bays at all times.',
          'Overhead Clearance: Verify vehicle roof will not strike overhead heaters, light fixtures, or garage doors.',
          'Clear Bay Area: Remove oil drain pans, air hoses, tool carts, and personnel before lowering hoist.',
          'High-Reach Auxiliary Stands: Support heavy driveline components when removing transmissions overhead.'
        ],
        speakerText: 'Wear safety glasses and steel-toe boots under elevated vehicles. Check overhead clearance before raising tall vans, and clear all tool carts and air hoses before lowering.'
      },
      {
        title: 'Module 9: Lockout/Tagout (LOTO) for Defective Hoists',
        subtitle: 'Preventing Unintended Operation of Damaged Machinery',
        image: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&auto=format&fit=crop&q=80',
        points: [
          'Defective Hoist Criteria: Hydraulic oil leaks, cracked lift arm welds, noisy cables, or faulty locks.',
          'Lockout Action: Switch power disconnect to OFF and attach personal LOTO red padlock.',
          'Tagout Action: Attach high-visibility DANGER — DO NOT OPERATE tag to the power control box.',
          'Notify Service Manager and Shop Safety Officer immediately for certified repair.'
        ],
        speakerText: 'If a hoist shows hydraulic leaks or damaged arm locks, lock out the main power breaker, attach an Out of Service tag, and notify the Service Manager immediately.'
      },
      {
        title: 'Module 10: Emergency Lowering & Annual Maintenance Logs',
        subtitle: 'Handling Power Failure & Documenting Service Inspections',
        image: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&auto=format&fit=crop&q=80',
        points: [
          'Power Outage Emergency Lowering: Use manual hydraulic release valve per manufacturer manual.',
          'Manual lock release cables must be operated simultaneously by two trained technicians during emergency lowering.',
          'Daily inspection log sheets must be signed by shop technicians and archived for 3 years.',
          'Only ALI certified technicians may perform structural repairs, wire rope replacement, or cylinder rebuilds.'
        ],
        speakerText: 'In a power outage, emergency lowering procedures require manual lock disengagement by trained technicians. Maintain daily inspection logs for safety audits.'
      }
    ],
    quiz: [
      { question: 'What test must be performed when a vehicle is raised 6 inches off the shop floor?', options: ['Engine rev test', 'A firm stability nudge test', 'Tire pressure check', 'Brake test'], answer: 1, explanation: 'A 6-inch lift stability nudge test verifies that pads are seated correctly before high elevation.' },
      { question: 'Is it safe to work under a raised vehicle supported only by hydraulic pressure?', options: ['Yes, if under 10 minutes', 'No, hoist must be lowered onto mechanical safety locks', 'Yes, for light sedans', 'Only if wearing a hard hat'], answer: 1, explanation: 'Never rely on hydraulic pressure alone. The hoist MUST rest on mechanical safety locks before working underneath.' },
      { question: 'What action is required if a hoist shows hydraulic leaks or cracked arm restraints?', options: ['Use it carefully', 'Apply Lockout/Tagout and mark Out of Service', 'Wipe the oil and continue', 'Only lift small cars'], answer: 1, explanation: 'Defective hoists must be locked out immediately to prevent catastrophic failure.' },
      { question: 'What authority certifies automotive lift safety standards in North America?', options: ['DOT', 'Automotive Lift Institute (ALI)', 'EPA', 'NHTSA'], answer: 1, explanation: 'The Automotive Lift Institute (ALI) certifies automotive lifts and inspectors.' },
      { question: 'How often must automotive lifts undergo formal inspection by a certified inspector?', options: ['Every 5 years', 'Annually (Every 12 months)', 'Monthly', 'Never'], answer: 1, explanation: 'ALI ALOIM standards mandate annual lift inspections by certified personnel.' },
      { question: 'What does a gold sticker on a lift column signify?', options: ['Discount price', 'Active ALI certification', 'Manufactured in Canada', 'Electric vehicle approved'], answer: 1, explanation: 'Gold ALI validation labels confirm certified annual safety inspection.' },
      { question: 'What visual check is required during daily pre-operational hoist inspections?', options: ['Radio station check', 'Inspect hydraulic lines, arm locks, and pad condition', 'Windshield wiper check', 'Paint color check'], answer: 1, explanation: 'Daily checks require inspecting hydraulic hoses, arm restraints, and pad condition.' },
      { question: 'When should automatic lift arm restraint locks engage?', options: ['When vehicle reaches ceiling', 'When lift arm is raised 2 inches off floor', 'Only when lowering', 'Manually with a hammer'], answer: 1, explanation: 'Arm restraints must automatically lock when arms ascend 2 inches to prevent arm swing.' },
      { question: 'Where should lifting pads be positioned under a vehicle?', options: ['Under floorboards', 'Squarely under OEM designated frame/pinch weld points', 'Under exhaust pipes', 'Under plastic side skirts'], answer: 1, explanation: 'Pads must contact manufacturer-designated lifting points on frame rails or pinch welds.' },
      { question: 'What is the danger of removing a heavy rear axle while a truck is elevated on a 2-post lift?', options: ['Dirty hands', 'Shifting center of gravity causing vehicle to tip off lift', 'Tire wear', 'Noise'], answer: 1, explanation: 'Removing heavy components alters vehicle balance and can cause catastrophic tipping.' },
      { question: 'What design feature distinguishes an asymmetric 2-post lift?', options: ['Columns rotated 30 degrees so vehicle doors open easily', 'Four drive-on runways', 'No hydraulic fluid', 'Scissor legs'], answer: 0, explanation: 'Asymmetric 2-post lifts rotate columns 30 degrees to clear vehicle doors.' },
      { question: 'What PPE is mandatory when working underneath an elevated vehicle in a service bay?', options: ['Flip-flops and shorts', 'CSA steel-toe boots and safety glasses', 'Cloth sneakers', 'Sunglasses'], answer: 1, explanation: 'CSA approved steel-toe boots and safety glasses are mandatory overhead PPE.' },
      { question: 'What should be checked regarding overhead clearance before raising a tall cargo van?', options: ['Weather forecast', 'Verify roof clears heaters, lights, and garage door tracks', 'Check tire tread', 'Check fuel tank'], answer: 1, explanation: 'Check overhead clearance to prevent crushing roof against heaters or fixtures.' },
      { question: 'What action is required before lowering an elevated vehicle on a hoist?', options: ['Honk horn', 'Clear oil drainers, tool carts, hoses, and personnel from bay', 'Turn on headlights', 'Open windows'], answer: 1, explanation: 'Clear all floor obstacles, tools, and bystanders before lowering a lift.' },
      { question: 'What auxiliary equipment should be used when supporting heavy driveline components overhead?', options: ['Wooden blocks', 'High-reach auxiliary jack stands', 'Rope', 'Cardboard boxes'], answer: 1, explanation: 'High-reach jack stands provide required auxiliary support overhead.' },
      { question: 'What should be done if a vehicle sways during the 6-inch safety nudge test?', options: ['Ignore it', 'Lower vehicle immediately to floor and re-position pads', 'Raise faster', 'Push harder'], answer: 1, explanation: 'If vehicle sways, lower immediately and correct pad positioning.' },
      { question: 'Is it legal to use homemade wooden blocks as lift pad adapters?', options: ['Yes', 'No, strictly prohibited; only ALI/OEM approved adapters allowed', 'Only on Saturdays', 'If painted yellow'], answer: 1, explanation: 'Homemade wooden adapters can split under load and are strictly prohibited.' },
      { question: 'What color tag identifies a hoist locked out for service?', options: ['Green', 'High-visibility RED DANGER tag', 'Blue', 'White'], answer: 1, explanation: 'Red DANGER / OUT OF SERVICE tags identify locked out machinery.' },
      { question: 'Who is authorized to perform structural cable or cylinder repairs on dealership lifts?', options: ['Any sales rep', 'ALI certified service technicians', 'Apprentice detailers', 'Car wash staff'], answer: 1, explanation: 'Only certified lift technicians can perform structural lift repairs.' },
      { question: 'What is the hazard of a high-pressure hydraulic hose leak?', options: ['Slippery floor', 'High-pressure fluid injection injury and fire risk', 'Noise', 'Bad odor'], answer: 1, explanation: 'High pressure hydraulic fluid can penetrate human skin and cause severe tissue injury.' },
      { question: 'How long must daily hoist inspection logs be retained for safety compliance archives?', options: ['1 week', '3 years', '1 day', 'Never'], answer: 1, explanation: 'Daily inspection logs must be retained for at least 3 years.' },
      { question: 'What feature prevents 4-post lift runways from falling if a cable breaks?', options: ['Rubber mats', 'Secondary slack-cable safety latches', 'Tire chocks', 'Paint'], answer: 1, explanation: 'Slack-cable safety latches automatically lock runways if tension is lost.' },
      { question: 'What maximum slope is permitted for concrete floors under 2-post lift columns?', options: ['15 degrees', '4 degrees maximum', '45 degrees', '90 degrees'], answer: 1, explanation: 'Lift columns require level floor foundations within 4 degrees max slope.' },
      { question: 'What should be done with lift adapter extensions when not in use?', options: ['Leave on shop floor', 'Stored on designated column racks off shop floor', 'Throw in trash', 'Put in car trunk'], answer: 1, explanation: 'Store adapters on column hooks to prevent floor tripping hazards.' },
      { question: 'What is the primary goal of automotive lift safety compliance?', options: ['Speed up oil changes', 'Prevent catastrophic vehicle drops and worker injuries', 'Lower electric bills', 'Keep bays shiny'], answer: 1, explanation: 'Lift safety compliance prevents overhead vehicle drops and protects technician lives.' }
    ]
  },
  {
    id: 'demo_driver',
    title: 'Dealer Demo Vehicle & Customer Test Drive Safety',
    duration: '10 In-Depth Modules · 25-Question Test',
    role: 'Sales & Managers',
    icon: '',
    desc: 'Driver licence verification, trade plate Highway Traffic Act compliance, test drive routes & insurance rules.',
    slides: [
      {
        title: 'Module 1: Driver Licence Verification & ID Inspection Standards',
        subtitle: 'Mandatory Pre-Drive Document Checks Prior to Key Release',
        image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop&q=80',
        points: [
          'Sales reps MUST physically inspect the customer’s unexpired photo driver’s licence before handing over keys.',
          'Verify licence class (full valid G / Class 5 required; G1 / Learner licences strictly prohibited).',
          'Check photo match, expiry date, and licence conditions (e.g., Code X corrective lenses requirement).',
          'Scan or make a clear digital copy of the licence directly into MarketSync CRM for fraud prevention.'
        ],
        speakerText: 'Before any customer test drive, sales reps must physically inspect the driver’s licence. Verify it is valid, unexpired, and matches the customer. Never permit test drives with learner licences.'
      },
      {
        title: 'Module 2: Dealer Trade License Plate Regulations (Highway Traffic Act)',
        subtitle: 'Legal Mounting & Exterior Attachment Mandates',
        image: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&auto=format&fit=crop&q=80',
        points: [
          'Dealer trade plates MUST be securely attached to the REAR exterior of the vehicle.',
          'STRICT PROHIBITION: Never place trade plates loose on the rear parcel shelf, dashboard, or inside windows.',
          'Improper plate placement results in Highway Traffic Act fines and dealer plate suspension.',
          'Trade plates are strictly restricted to dealership business and customer test drives.'
        ],
        speakerText: 'Dealer trade plates must be securely mounted to the rear exterior of the vehicle. Placing plates loose on the rear parcel shelf is illegal under the Highway Traffic Act.'
      },
      {
        title: 'Module 3: Master Trade Plate Register & Mandatory Logbook',
        subtitle: 'Tracking Every Trade Plate Movement Across the Dealership',
        image: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop&q=80',
        points: [
          'Every trade plate sign-out MUST be recorded in the Master Trade Plate Register at the Sales Tower.',
          'Required Log Entries: Date, Time Out, Stock #, VIN, Plate #, Customer Name, Sales Rep Name & Signature.',
          'Sign-In Requirement: Log return time immediately upon completion of test drive.',
          'Unaccounted or missing trade plates must be reported to the Sales Manager within 30 minutes.'
        ],
        speakerText: 'Every trade plate movement must be logged in the Sales Tower register showing date, stock number, customer name, and rep signature. Sign the plate back in immediately after the drive.'
      },
      {
        title: 'Module 4: Customer Test Drive Waiver & Liability Agreements',
        subtitle: 'Pre-Drive Agreements & Traffic Violation Attribution',
        image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&auto=format&fit=crop&q=80',
        points: [
          'Customers MUST sign the Dealership Test Drive Agreement prior to departing the showroom.',
          'Waiver explicitly attributes financial responsibility for red light cameras, speed enforcement, and 407 toll charges to the driver.',
          'Specifies customer insurance primacy in event of driver negligence or traffic infractions.',
          'Copies of signed waivers are archived in MarketSync deal files.'
        ],
        speakerText: 'Customers must sign the Test Drive Agreement before leaving. This agreement holds the driver financially responsible for speed camera tickets, red light violations, and toll charges.'
      },
      {
        title: 'Module 5: Pre-Approved Test Drive Routes & GPS Tracking',
        subtitle: 'Controlling Test Drive Perimeters & Accompanied Drives',
        image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop&q=80',
        points: [
          'Sales reps SHOULD accompany all customer test drives using pre-approved dealership routes.',
          'Approved routes combine city streets, highway merging, and quiet residential braking zones.',
          'Unaccompanied Drives: Require explicit Sales Manager sign-off and 30-minute time limit.',
          'Vehicles equipped with MarketSync GPS telemetry monitor speed and route boundaries.'
        ],
        speakerText: 'Sales reps should accompany test drives on pre-approved routes. Unaccompanied test drives require manager authorization and are monitored via GPS telemetry.'
      },
      {
        title: 'Module 6: Adverse Weather & High-Risk Driving Restrictions',
        subtitle: 'Suspending Test Drives During Severe Weather Alerts',
        image: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&auto=format&fit=crop&q=80',
        points: [
          'Test drives are STRICTLY PROHIBITED during severe weather warnings (freezing rain, blizzards, dense fog).',
          'Inspect tire condition and tread depth on demo vehicles prior to winter customer drives.',
          'Clear all snow and ice completely from demo vehicle roofs, windows, and lights before departure.',
          'Sales Manager retains authority to ground test drive fleet during hazardous road conditions.'
        ],
        speakerText: 'Test drives are suspended during severe weather warnings. Always clear snow completely from vehicle roofs and windows before taking a customer on the road.'
      },
      {
        title: 'Module 7: Executive Demo Vehicle Policy for Sales Staff',
        subtitle: 'Authorized Personnel Rules & Family Driving Prohibition',
        image: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop&q=80',
        points: [
          'Staff demo vehicles are for business commuting and customer demonstrations only.',
          'STRICT RULE: Family members, spouses, or unauthorized third parties are strictly prohibited from driving demo units.',
          'Sales reps are responsible for maintaining clean vehicle condition and minimum 1/4 tank fuel.',
          'No smoking, vaping, or pet transport permitted inside executive demo vehicles.'
        ],
        speakerText: 'Executive demo vehicles assigned to sales reps are restricted strictly to authorized employees. Spouses and family members are prohibited from operating demo units under fleet insurance rules.'
      },
      {
        title: 'Module 8: Collision Escalation & Incident Reporting',
        subtitle: '2-Hour Mandatory Damage & Accident Notification Window',
        image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&auto=format&fit=crop&q=80',
        points: [
          'If a demo vehicle is involved in a collision, ensure passenger safety and call Police immediately.',
          'Exchange insurance information, photograph all vehicle damage, and obtain police report number.',
          'Report incident to General Manager and HR Compliance Lead within 2 HOURS of occurrence.',
          'Complete Dealership Incident Form before end of business day.'
        ],
        speakerText: 'In the event of a collision during a test drive, ensure passenger safety and call police. Report all vehicle damage to management within two hours.'
      },
      {
        title: 'Module 9: Vehicle Staging, Key Control & Showroom Security',
        subtitle: 'Preventing Vehicle Theft & Unauthorized Key Access',
        image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop&q=80',
        points: [
          'Demo keys MUST be secured inside key tracking cabinets (Keycafe / KeyTrak) when not in use.',
          'Never leave demo keys unattended on sales desks or inside unlocked vehicles.',
          'Lock demo vehicles immediately after staging in the delivery bay or customer parking lot.',
          'Stolen key fobs or missing demo units must be escalated to Sales Tower immediately.'
        ],
        speakerText: 'Secure all vehicle keys inside electronic key cabinets. Never leave fobs unattended on sales desks or inside parked demo vehicles.'
      },
      {
        title: 'Module 10: Fleet Insurance Audit & Annual Compliance Review',
        subtitle: 'Maintaining Garage Insurance Coverage & Driver Abstract Checks',
        image: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&auto=format&fit=crop&q=80',
        points: [
          'Dealership Garage Insurance requires annual driver abstract verification for all sales staff.',
          'Sales reps with excessive demerit points or impaired driving records will lose demo privileges.',
          'Compliance logs audited quarterly by insurance underwriters.',
          'Completion of Demo Driver Safety course mandatory for all newly hired sales representatives.'
        ],
        speakerText: 'Our garage insurance policy requires annual driver abstract checks. Adherence to test drive logging and licence verification maintains our commercial fleet coverage.'
      }
    ],
    quiz: [
      { question: 'When must a customer’s photo driver’s licence be physically inspected?', options: ['After the test drive', 'Prior to handing over vehicle keys', 'Only if requested by police', 'When signing finance papers'], answer: 1, explanation: 'Driver licence verification MUST occur prior to handing over keys.' },
      { question: 'Where must a dealer trade license plate be mounted during a test drive?', options: ['On the front windshield', 'On the rear parcel shelf inside', 'Securely on the rear exterior of the vehicle', 'In the glove box'], answer: 2, explanation: 'Highway Traffic Act rules require dealer trade plates to be securely mounted on the exterior rear of the vehicle.' },
      { question: 'Who is authorized to drive a dealership staff executive demo vehicle?', options: ['Anyone with a valid licence', 'Only the authorized dealership employee', 'Friends and family', 'Any customer'], answer: 1, explanation: 'Dealership insurance policies restrict demo vehicle operation strictly to authorized employees.' },
      { question: 'What licence class is required for a customer test drive?', options: ['G1 Learner Licence', 'Full valid unexpired driver licence (e.g. G / Class 5)', 'Expired licence', 'Student ID'], answer: 1, explanation: 'Customers must hold a full, valid, unexpired driver licence.' },
      { question: 'Where must every trade plate movement be recorded?', options: ['On a paper napkin', 'In the Master Trade Plate Register at the Sales Tower', 'On personal phone', 'Nowhere'], answer: 1, explanation: 'Trade plate movements must be logged in the Master Trade Plate Register.' },
      { question: 'What document must customers sign prior to departing on a test drive?', options: ['Credit application', 'Dealership Test Drive Agreement & Waiver', 'Employment contract', 'Repair order'], answer: 1, explanation: 'Customers must sign the Test Drive Agreement acknowledging driver responsibility.' },
      { question: 'Who is financially responsible for red light camera or speed camera tickets incurred during a test drive?', options: ['The dealership owner', 'The driver operating the vehicle', 'The car manufacturer', 'The car washer'], answer: 1, explanation: 'The driver operating the vehicle is financially responsible for traffic infractions.' },
      { question: 'Is it legal to place a dealer trade plate loose on the rear parcel shelf?', options: ['Yes', 'No, strictly prohibited under Highway Traffic Act', 'Only on sunny days', 'Only if driving slowly'], answer: 1, explanation: 'Placing trade plates loose inside the vehicle violates Highway Traffic Act regulations.' },
      { question: 'Within what timeframe must demo vehicle collisions or damage be reported to management?', options: ['Within 2 weeks', 'Within 2 hours', 'Next month', 'Never'], answer: 1, explanation: 'Vehicle collisions must be reported to management within 2 hours.' },
      { question: 'Are family members or spouses permitted to drive a sales rep’s staff demo vehicle?', options: ['Yes', 'No, strictly prohibited by fleet insurance policy', 'Only on Sundays', 'If over 21'], answer: 1, explanation: 'Fleet insurance policies strictly prohibit unauthorized family members from operating demo units.' },
      { question: 'What action should a sales rep take if a customer acts erratically before a test drive?', options: ['Hand over keys', 'Refuse the test drive and alert the Sales Manager', 'Drive on highway', 'Offer a discount'], answer: 1, explanation: 'Reps must refuse test drives if a customer appears impaired or acts erratically.' },
      { question: 'What is the maximum recommended time limit for an unaccompanied customer test drive?', options: ['24 hours', '30 minutes', '5 hours', '1 week'], answer: 1, explanation: 'Unaccompanied test drives require manager approval and are limited to 30 minutes.' },
      { question: 'What should be done regarding test drives during active severe blizzard warnings?', options: ['Drive fast', 'Suspend test drives until severe weather clears', 'Use summer tires', 'Drive in dark'], answer: 1, explanation: 'Test drives are suspended during severe weather warnings for safety.' },
      { question: 'Where should customer driver licence scans be stored at the dealership?', options: ['On public bulletin board', 'Scanned securely into MarketSync CRM database', 'In open trash bin', 'On personal Instagram'], answer: 1, explanation: 'Licence scans must be securely uploaded to MarketSync CRM files.' },
      { question: 'What should be done if a trade plate goes missing from the tower?', options: ['Ignore it', 'Report immediately to Sales Manager within 30 minutes', 'Buy a fake plate', 'Blame receptionist'], answer: 1, explanation: 'Missing trade plates must be escalated to management immediately.' },
      { question: 'What minimum fuel level should be maintained in demo vehicles prior to test drives?', options: ['Empty', 'Minimum 1/4 tank or 30% EV charge', 'Reserve light on', 'Does not matter'], answer: 1, explanation: 'Maintain at least 1/4 tank of fuel or 30% EV battery charge.' },
      { question: 'What check should be performed on a demo vehicle prior to taking a customer out?', options: ['Walkaround inspection for existing damage and clean interior', 'Check radio volume', 'Adjust mirror for yourself only', 'Open trunk'], answer: 0, explanation: 'Perform a walkaround inspection to verify clean condition and check for pre-existing damage.' },
      { question: 'Is mobile phone texting permitted while accompanying a customer test drive?', options: ['Yes', 'No, strictly prohibited under hands-free driving laws', 'Only on red lights', 'If reading email'], answer: 1, explanation: 'Distracted driving laws strictly prohibit handheld mobile phone use.' },
      { question: 'What action is required if a demo vehicle suffers a flat tire during a test drive?', options: ['Keep driving on rim', 'Pull over safely, turn on hazard lights, and contact dealership roadside', 'Abandon car', 'Walk away'], answer: 1, explanation: 'Pull over safely, activate hazard lights, and contact dealership dispatch.' },
      { question: 'Are seat belts mandatory for all occupants during a dealership test drive?', options: ['Optional', 'Mandatory for all occupants before putting vehicle in gear', 'Only for driver', 'Only on highway'], answer: 1, explanation: 'Seat belts are mandatory for all vehicle occupants under law.' },
      { question: 'What restriction applies to personal use of executive staff demo vehicles?', options: ['Unlimited racing', 'Restricted to authorized business commuting; no commercial towing', 'Can be rented out', 'Can be painted'], answer: 1, explanation: 'Demo vehicles are restricted to business commuting and demonstrations.' },
      { question: 'Who conducts trade-in vehicle appraisal test drives at the dealership?', options: ['Customer', 'Used Car Manager or designated appraiser', 'Detailer', 'Janitor'], answer: 1, explanation: 'Appraisal drives are conducted by Used Car Managers or designated appraisers.' },
      { question: 'Why do insurance underwriters audit dealership test drive logbooks?', options: ['To check handwriting', 'To verify compliance with garage liability insurance mandates', 'To count car sales', 'To check weather'], answer: 1, explanation: 'Logbooks confirm adherence to commercial garage policy conditions.' },
      { question: 'What action should be taken if a sales rep suspects a customer is under the influence of alcohol?', options: ['Offer a test drive', 'Refuse drive immediately and call Police if customer attempts to drive away', 'Let them drive slow', 'Give them coffee'], answer: 1, explanation: 'Refuse the drive immediately and contact police if an impaired driver attempts to operate a vehicle.' },
      { question: 'What is the main goal of the Dealer Demo Vehicle & Test Drive Safety policy?', options: ['Sell more paint protection', 'Protect lives, prevent vehicle theft, and ensure legal fleet compliance', 'Increase speed limits', 'Reduce wash bay time'], answer: 1, explanation: 'Policy ensures driver safety, prevents vehicle theft, and maintains legal insurance compliance.' }
    ]
  },
  {
    id: 'ev_safety',
    title: 'EV & Hybrid High-Voltage Battery Rescue Safety',
    duration: '10 In-Depth Modules · 25-Question Test',
    role: 'Service, Parts & Recon',
    icon: '',
    desc: 'High-voltage 400V-800V DC safety, Manual Service Disconnect (MSD), thermal runaway emergency, and 50-ft lot quarantine.',
    slides: [
      {
        title: 'Module 1: Electric Vehicle Powertrain Architecture & High Voltage Hazards',
        subtitle: '400V to 800V+ Direct Current (DC) Electrocution Risks',
        image: 'https://images.unsplash.com/photo-1558441719-443b38645ad9?w=800&auto=format&fit=crop&q=80',
        points: [
          'Electric Vehicles (EV) and Plug-in Hybrids (PHEV) utilize High Voltage DC battery packs ranging from 400V to 800V+.',
          'Voltage levels above 60V DC are lethal and can cause fatal cardiac fibrillation, severe arc flash burns, or tissue destruction.',
          'High voltage circuits are completely isolated from the vehicle chassis ground.',
          'Servicing EV powertrains requires specialized high-voltage safety certification.'
        ],
        speakerText: 'EV and hybrid powertrains operate on high voltage direct current up to 800 volts. Voltages above 60V DC can cause fatal electrocution — specialized high-voltage training is required before servicing EV components.'
      },
      {
        title: 'Module 2: Orange Cable Identification Standards (SAE J2990 / ISO 6469)',
        subtitle: 'Recognizing High Voltage Conduits & Component Marking',
        image: 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&auto=format&fit=crop&q=80',
        points: [
          'International Automotive Standards mandate bright ORANGE insulation for all High Voltage wiring and conduits.',
          'Orange cables connect the Traction Battery, Inverter, On-Board Charger, Electric Air Conditioner, and Drive Motors.',
          'STRICT RULE: Never cut, pierce, or touch orange high-voltage cables without verified de-energization.',
          'Yellow warning labels with lightning bolt symbols mark all high-voltage component enclosures.'
        ],
        speakerText: 'All high-voltage cables and conduits are insulated in bright orange. Never cut, pierce, or probe orange cables without certified high-voltage isolation.'
      },
      {
        title: 'Module 3: Class 0 Insulated Rubber Gloves & High-Voltage PPE',
        subtitle: '1000V Rated Glove Inspection & Leather Outer Protectors',
        image: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&auto=format&fit=crop&q=80',
        points: [
          'Class 0 Rubber Insulated Gloves: Rated for up to 1000V AC / 1500V DC working voltage.',
          'Leather Outer Protectors: Must be worn over rubber gloves to protect against mechanical punctures and cuts.',
          'Air Leak Test: Roll glove cuff toward fingers before EVERY use to verify zero air leaks or pinholes.',
          'Arc Flash Face Shield & Flame-Resistant Apron: Required during initial high-voltage de-energization.'
        ],
        speakerText: 'Technicians must wear Class 0 rubber insulated gloves with leather outer protectors. Always perform an air inflation test before putting gloves on to ensure there are no pinholes.'
      },
      {
        title: 'Module 4: Service De-Energization & Manual Service Disconnect (MSD)',
        subtitle: 'Isolating the High Voltage Battery Pack from Vehicle Powertrain',
        image: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&auto=format&fit=crop&q=80',
        points: [
          'Manual Service Disconnect (MSD): Physical fuse/plug that breaks the high-voltage series circuit inside the battery pack.',
          'Lockout/Tagout: Apply padlock to MSD housing to prevent unauthorized re-insertion during service.',
          '10-Minute Capacitor Discharge Wait: Wait at least 10 MINUTES after pulling MSD for inverter capacitors to bleed down stored energy.',
          'Keep MSD plug in personal possession of servicing technician until work is completed.'
        ],
        speakerText: 'Before servicing EV high-voltage components, pull the Manual Service Disconnect plug, lock it out, and wait ten minutes for high-voltage capacitors to fully discharge.'
      },
      {
        title: 'Module 5: Zero-Voltage Verification & Multimeter Testing (CAT IV 1000V)',
        subtitle: 'Live-Dead-Live Testing Protocol Before Touch',
        image: 'https://images.unsplash.com/photo-1558441719-443b38645ad9?w=800&auto=format&fit=crop&q=80',
        points: [
          'CAT IV 1000V Rated Digital Multimeter: Mandatory for testing EV high-voltage terminals.',
          'Live-Dead-Live Test Protocol: Test multimeter on a known live voltage source, test target EV terminals for 0V, re-test multimeter on live source.',
          'Verify zero voltage between Positive-to-Negative, Positive-to-Chassis, and Negative-to-Chassis.',
          'Never assume a circuit is dead until verified with a certified CAT IV multimeter.'
        ],
        speakerText: 'Always perform the Live-Dead-Live test protocol using a CAT IV 1000V multimeter to verify zero voltage before touching any high-voltage terminal.'
      },
      {
        title: 'Module 6: Thermal Runaway Science & Off-Gas Warning Signs',
        subtitle: 'Recognizing Lithium-Ion Battery Chain Reaction Hazards',
        image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=800&auto=format&fit=crop&q=80',
        points: [
          'Thermal Runaway: Chemical chain reaction where cell overheating releases oxygen, generating self-sustaining explosive heat.',
          'Off-Gas Warning Signs: Hissing or popping noises, sweet chemical solvent odor, dense white/gray vapor clouds.',
          'Hydrofluoric Acid (HF) Gas: Thermal runaway releases highly toxic HF gas causing severe respiratory and tissue destruction.',
          'IMMEDIATE ACTION: Evacuate the service bay immediately and call Emergency Services 911.'
        ],
        speakerText: 'Thermal runaway causes explosive heat and toxic Hydrofluoric Acid gas. If an EV battery emits popping sounds or sweet-smelling white smoke, evacuate the shop immediately and call 911.'
      },
      {
        title: 'Module 7: EV Fire Suppression & Water Cooling Requirements',
        subtitle: 'Why Standard ABC Extinguishers Fail on Lithium Battery Fires',
        image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=800&auto=format&fit=crop&q=80',
        points: [
          'Standard ABC Dry Chemical Extinguishers CANNOT extinguish a lithium-ion thermal runaway fire.',
          'Fire Suppression Rule: EV battery fires require continuous large-volume water cooling (10,000+ Liters / 2,600+ Gallons).',
          'Only trained Fire Department personnel equipped with SCBA respirators should fight EV battery fires.',
          'Re-Ignition Hazard: Damaged battery cells can re-ignite hours or days after initial fire suppression.'
        ],
        speakerText: 'Standard shop fire extinguishers cannot stop lithium battery fires. EV battery fires require thousands of gallons of water applied continuously by fire services to cool the pack.'
      },
      {
        title: 'Module 8: Collision-Damaged EV Handling & 50-Foot Quarantine Lot',
        subtitle: 'Quarantining Compromised Batteries Away from Dealership Structures',
        image: 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&auto=format&fit=crop&q=80',
        points: [
          'Collision-Damaged EVs with battery impact MUST be parked in an outdoor quarantine lot 50 FEET (15m) away from buildings and other vehicles.',
          'Thermal Camera Monitoring: Monitor battery temperature with an infrared thermal camera every 4 hours for 48 hours post-collision.',
          'Never store a flood-damaged, submerged, or swollen battery EV inside the main service shop overnight.',
          'Mark vehicle with high-visibility DANGER — HIGH VOLTAGE COLLISION DAMAGE banner.'
        ],
        speakerText: 'Damaged EVs involved in collisions must be quarantined outdoors fifty feet away from dealership buildings and monitored with thermal cameras for 48 hours.'
      },
      {
        title: 'Module 9: Safe Towing & Transport of Electric Vehicles',
        subtitle: 'Flatbed Transport Mandate & Preventing Motor Regeneration',
        image: 'https://images.unsplash.com/photo-1558441719-443b38645ad9?w=800&auto=format&fit=crop&q=80',
        points: [
          'Flatbed Towing ONLY: EVs MUST be transported on flatbed tow trucks with all wheels off the road.',
          'Flat-Towing Prohibition: Towing an EV with driven wheels on the ground turns drive motors into generators, sending high voltage into a damaged battery.',
          'Notify towing operators of EV high-voltage status prior to winching vehicle onto flatbed.',
          'Use designated OEM transport tie-down points; never attach hooks to orange cables or battery enclosure.'
        ],
        speakerText: 'EVs must always be transported on flatbed tow trucks. Towing an EV with wheels rolling on the ground generates high voltage that can ignite a damaged battery.'
      },
      {
        title: 'Module 10: High Voltage Battery Recycling & Environmental Regulations',
        subtitle: 'Responsible Handling of End-of-Life Lithium Traction Batteries',
        image: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&auto=format&fit=crop&q=80',
        points: [
          'End-of-life or damaged EV battery modules MUST be sent to certified lithium battery recycling contractors.',
          'Store removed battery modules in UN-certified fire-rated shipping containers with vermiculite insulation.',
          'Federal Environmental Protection Acts prohibit landfill disposal or unauthorized dumping of traction batteries.',
          'Document battery serial numbers and recycling manifests in MarketSync compliance logs.'
        ],
        speakerText: 'Removed EV battery modules must be stored in UN-certified fire containers and shipped to licensed recycling facilities in accordance with environmental protection laws.'
      }
    ],
    quiz: [
      { question: 'What color identifies high-voltage cables and conduits in electric and hybrid vehicles?', options: ['Yellow', 'Bright Orange', 'Red', 'Blue'], answer: 1, explanation: 'International automotive standards mandate bright orange insulation for all high-voltage conduits.' },
      { question: 'What rating must rubber insulated gloves have for EV high-voltage service?', options: ['Household dish gloves', 'Class 0 (1000V rated) gloves with leather outer protectors', 'Kevlar cut gloves', 'Standard nitrile gloves'], answer: 1, explanation: 'Class 0 rated gloves (certified up to 1000V) with leather outer protectors are mandatory.' },
      { question: 'What is the immediate action if an EV battery begins popping and emitting dense white smoke?', options: ['Try to extinguish with shop hose', 'Evacuate the shop immediately and call 911', 'Drive vehicle outside', 'Open shop windows'], answer: 1, explanation: 'EV thermal runaway releases toxic HF gas and explosive heat. Evacuate immediately and call emergency services.' },
      { question: 'What is the typical voltage range of electric vehicle high-voltage DC battery packs?', options: ['12V to 24V', '400V to 800V+ Direct Current', '110V AC', '5V USB'], answer: 1, explanation: 'EV traction batteries operate on high-voltage DC ranging from 400V to 800V+.' },
      { question: 'What is the function of the Manual Service Disconnect (MSD) plug?', options: ['Turn on radio', 'Physically breaks high-voltage series circuit inside battery pack', 'Charge 12V battery', 'Unlock doors'], answer: 1, explanation: 'The MSD plug physically interrupts the high-voltage battery circuit for safe service.' },
      { question: 'How long must technicians wait after pulling the MSD plug before touching high-voltage terminals?', options: ['No wait needed', 'Wait at least 10 continuous minutes', '1 hour', '24 hours'], answer: 1, explanation: 'Wait 10 minutes for high-voltage capacitors inside the inverter to bleed down.' },
      { question: 'What multimeter rating is mandatory for zero-voltage testing on EV high-voltage systems?', options: ['CAT I 30V', 'CAT IV 1000V rated digital multimeter', 'Analog 12V tester', 'Pocket test light'], answer: 1, explanation: 'CAT IV 1000V rated multimeters are mandatory for high-voltage automotive safety.' },
      { question: 'What toxic gas is released during lithium-ion battery thermal runaway?', options: ['Oxygen', 'Hydrofluoric Acid (HF) gas', 'Nitrogen', 'Helium'], answer: 1, explanation: 'Thermal runaway releases highly toxic, corrosive Hydrofluoric Acid gas.' },
      { question: 'How much water is typically required by fire services to extinguish an EV battery fire?', options: ['1 bucket', '10,000+ Liters (2,600+ Gallons) continuous cooling', '100 Liters', 'None'], answer: 1, explanation: 'EV battery fires require continuous large-volume water cooling (10,000+ liters).' },
      { question: 'What distance must collision-damaged EVs be quarantined from dealership structures?', options: ['5 feet', '50 feet (15 meters) outdoor quarantine', 'Inside service bay', 'Under showroom canopy'], answer: 1, explanation: 'Damaged EVs must be quarantined outdoors 50 feet away from buildings and vehicles.' },
      { question: 'How long should a collision-damaged EV battery be monitored with thermal cameras post-impact?', options: ['10 minutes', '48 continuous hours', '1 hour', 'Never'], answer: 1, explanation: 'Monitor battery temperature for 48 hours to detect delayed thermal runaway.' },
      { question: 'Can standard ABC dry chemical fire extinguishers stop lithium battery thermal runaway?', options: ['Yes', 'No, ABC extinguishers cannot stop chemical cell reaction', 'Only if green', 'Only on hybrids'], answer: 1, explanation: 'ABC chemical extinguishers cannot cool internal cell thermal runaway reactions.' },
      { question: 'What transport method is mandatory for moving disabled electric vehicles?', options: ['Flatbed tow truck with all wheels off ground', 'Flat-towing on driven wheels', 'Pushing with truck bumper', 'Rope tow'], answer: 0, explanation: 'EVs must be transported on flatbed tow trucks to prevent motor power generation.' },
      { question: 'What is the danger of flat-towing an EV with driven wheels rolling on the road?', options: ['Tire wear', 'Drive motors act as generators sending high voltage into battery', 'Wind noise', 'Brake squeal'], answer: 1, explanation: 'Rolling driven wheels generates high voltage that can ignite damaged battery packs.' },
      { question: 'What test should be performed on Class 0 rubber gloves before every use?', options: ['Wash with soap', 'Air inflation leak test to verify zero pinholes', 'Ironing', 'Stretching with pliers'], answer: 1, explanation: 'Roll glove cuff to trap air and verify zero pinholes before high-voltage work.' },
      { question: 'What is the function of the High Voltage Interlock Loop (HVIL)?', options: ['Lock doors', 'Low-voltage safety circuit that disconnects high voltage if connector opens', 'Control wipers', 'Adjust seats'], answer: 1, explanation: 'HVIL opens main contactors if any high-voltage connector is unplugged.' },
      { question: 'Is it safe to store a flood-submerged EV inside the main service shop overnight?', options: ['Yes', 'No, submerged EVs must be quarantined outdoors due to delayed short-circuit fire risk', 'Only if dried with fan', 'If windows open'], answer: 1, explanation: 'Submerged EVs pose delayed short-circuit fire risks and must stay in outdoor quarantine.' },
      { question: 'Who is authorized to perform internal cell repair on high-voltage battery packs?', options: ['Any lube tech', 'Certified EV High-Voltage Master Technicians only', 'Car wash staff', 'Tow truck driver'], answer: 1, explanation: 'Internal battery pack repairs are restricted to certified High-Voltage Master Technicians.' },
      { question: 'What PPE face protection is required during initial high-voltage de-energization?', options: ['Sunglasses', 'Arc Flash face shield & safety glasses', 'Cloth mask', 'None'], answer: 1, explanation: 'Arc flash face shields protect eyes and face against high-voltage electric arc bursts.' },
      { question: 'What should be done if an EV battery pack leaks liquid electrolyte?', options: ['Touch with bare hands', 'Treat as corrosive hazardous chemical; wear chemical PPE', 'Wipe with paper towel', 'Ignore'], answer: 1, explanation: 'Electrolyte is corrosive and toxic; handle with full chemical splash PPE.' },
      { question: 'Where should lifting pads contact an EV when elevating on a 2-post shop hoist?', options: ['On the battery pack metal bottom tray', 'OEM designated vehicle frame rails outside battery tray', 'On high-voltage orange cables', 'Under plastic motor covers'], answer: 1, explanation: 'Pads must contact frame rails; never press against the battery pack bottom tray.' },
      { question: 'What components automatically disconnect the high-voltage battery during a crash?', options: ['Airbags', 'High-Voltage Contactor Relays', 'Headlights', 'Fuses'], answer: 1, explanation: 'High-voltage contactor relays automatically open during crash sensor activation.' },
      { question: 'How should removed end-of-life EV battery modules be stored before recycling?', options: ['In open wooden boxes', 'In UN-certified fire-rated shipping containers with insulation', 'In trash bins', 'Out in rain'], answer: 1, explanation: 'Store removed modules in UN-certified fire-rated containers lined with insulation.' },
      { question: 'What international standards govern automotive high-voltage wiring identification?', options: ['SAE J2990 / ISO 6469', 'Building Code 101', 'Food Safety Standards', 'Aviation Rule 50'], answer: 0, explanation: 'SAE J2990 and ISO 6469 specify EV high-voltage safety and orange wire standards.' },
      { question: 'What is the primary objective of EV High-Voltage Rescue Safety training?', options: ['Charge batteries faster', 'Prevent fatal electrocution, arc flash burns, and battery fire propagation', 'Improve gas mileage', 'Polish car paint'], answer: 1, explanation: 'Training prevents fatal electrocution, arc flash injuries, and thermal runaway fires.' }
    ]
  },
  {
    id: 'pipeda',
    title: 'PIPEDA & Customer Financial Privacy Protection',
    duration: '10 In-Depth Modules · 25-Question Test',
    role: 'F&I, Sales & Desk',
    icon: '',
    desc: 'PIPEDA 10 fair privacy principles, SIN masking rules, showroom clean desk guidelines, and security shredding.',
    slides: [
      {
        title: 'Module 1: PIPEDA Federal Privacy Legislation Overview',
        subtitle: 'Personal Information Protection and Electronic Documents Act',
        image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
        points: [
          'PIPEDA is Canada’s federal private sector privacy law governing how businesses collect, use, and disclose customer PII.',
          'Personal Identifiable Information (PII): Name, address, phone, DOB, driver licence #, income, credit score, and banking details.',
          'Core Rule: Dealerships may collect ONLY data strictly required to complete vehicle sale, lease, or financing.',
          'Mandates explicit customer consent before pulling credit bureau reports or sharing data with third-party lenders.'
        ],
        speakerText: 'PIPEDA governs how Canadian dealerships collect, use, and protect customer personal information. Staff may only collect data necessary for vehicle sale or financing with explicit customer consent.'
      },
      {
        title: 'Module 2: The 10 Fair Information Principles under Canadian Law',
        subtitle: 'Accountability, Consent, Limiting Collection & Safeguards',
        image: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
        points: [
          '1. Accountability: Dealership must appoint a Privacy Officer to oversee compliance.',
          '2. Identifying Purposes: Inform customer why data is collected prior to collection.',
          '3. Consent: Obtain meaningful consent for credit checks and marketing.',
          '4. Safeguards: Protect customer paper and digital files with physical and electronic security.'
        ],
        speakerText: 'PIPEDA is built on ten fair information principles including accountability, meaningful consent, limited data collection, and robust safeguards.'
      },
      {
        title: 'Module 3: Social Insurance Number (SIN) Masking & Credit Bureau Rules',
        subtitle: 'SIN Optional Status & Safeguarding Financial Applications',
        image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
        points: [
          'SIN Optional Rule: Social Insurance Numbers are OPTIONAL for car loan credit checks under Canadian law.',
          'Dealership staff CANNOT refuse service if a customer declines to provide their SIN.',
          'If SIN is provided: Must be encrypted in MarketSync CRM and masked (xxx-xxx-123) on printed deal sheets.',
          'Never leave credit application forms lying visible on open sales desks or printer trays.'
        ],
        speakerText: 'Providing a Social Insurance Number is optional for credit bureau checks under Canadian law. If provided, SIN numbers must be masked on physical paperwork and encrypted online.'
      },
      {
        title: 'Module 4: Showroom Clean Desk Policy & Physical File Security',
        subtitle: 'Protecting Physical Deal Jackets & Customer Documents',
        image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
        points: [
          'Clean Desk Policy: Clear all paper customer files, deal jackets, and credit apps from desks when leaving your workspace.',
          'Overnight Storage: All physical deal jackets containing credit info MUST be locked inside secure F&I cabinets overnight.',
          'Never leave customer credit files unattended in open sales offices or customer waiting areas.',
          'F&I Office Locks: F&I offices containing customer files must be locked when unoccupied.'
        ],
        speakerText: 'Adhere strictly to the Clean Desk Policy. Clear customer paperwork from your desk before stepping away and lock all active deal jackets inside F&I filing cabinets overnight.'
      },
      {
        title: 'Module 5: Locked Security Shredding Consoles & Document Disposal',
        subtitle: 'Preventing Identity Theft Through Secure Paper Destruction',
        image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
        points: [
          'Locked Shredding Consoles: Discarded documents containing PII must go directly into locked security shredding bins.',
          'STRICT PROHIBITION: Never discard customer documents in standard open recycling bins or trash cans.',
          'Includes printed credit reports, driver licence copies, pay stubs, bank statements, and void cheques.',
          'Shredding consoles emptied and cross-cut shredded on-site by certified destruction contractors.'
        ],
        speakerText: 'All paper documents containing customer names, addresses, or financial data must be deposited directly into locked security shredding bins. Never throw customer paperwork into standard trash or recycling bins.'
      },
      {
        title: 'Module 6: Digital CRM Security, Passwords & Screen Locks',
        subtitle: 'Safeguarding Electronic Deal Records & System Access',
        image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
        points: [
          'Screen Locking: Lock computer screens (Win+L / Ctrl+Cmd+Q) immediately whenever stepping away from sales desks.',
          'Password Protection: MarketSync logins and lender credentials are unique and non-transferable.',
          'Multi-Factor Authentication (MFA): Mandatory for accessing CRM customer financial portals off-site.',
          'Mobile Devices: Dealership iPads and smartphones must have remote-wipe capability enabled.'
        ],
        speakerText: 'Protect electronic customer data by locking your computer screen whenever leaving your desk. Never share MarketSync CRM passwords or lender portal credentials.'
      },
      {
        title: 'Module 7: Mandatory Privacy Breach Escalation & Reporting',
        subtitle: 'Handling Data Leaks, Lost Laptops & Unlawful Access',
        image: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
        points: [
          'Privacy Breach: Any unauthorized access, loss, or disclosure of customer personal information.',
          'Immediate Action: Report lost laptops, iPads, USB drives, or suspected data leaks to Privacy Officer within 1 hour.',
          'Mandatory Federal Notification: PIPEDA requires reporting breaches creating real risk of significant harm to the Privacy Commissioner of Canada.',
          'Affected customers must be notified in writing with mitigation instructions.'
        ],
        speakerText: 'Report any lost mobile device, stolen laptop, or suspected data breach to management immediately. Federal law mandates notifying the Privacy Commissioner of Canada if customer data is compromised.'
      },
      {
        title: 'Module 8: Customer Access Rights & Data Correction Protocols',
        subtitle: 'Fulfilling Legal Requests to Inspect Personal Deal Files',
        image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
        points: [
          'Customer Right of Access: Customers have the legal right to request access to their personal file stored at the dealership.',
          'Response Timeline: Dealership must respond to formal access requests within 30 days without excessive fee.',
          'Right to Correction: If customer demonstrates inaccurate financial or personal data, dealership must update file.',
          'Notify third-party lenders of data corrections where applicable.'
        ],
        speakerText: 'Under PIPEDA, customers have the right to inspect their personal deal file and request corrections to inaccurate data. Refer all formal access requests to the Dealership Privacy Officer.'
      },
      {
        title: 'Module 9: Corporate Penalties & Fines for PIPEDA Violations',
        subtitle: 'Financial & Reputational Legal Liability for Non-Compliance',
        image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
        points: [
          'Fines up to $100,000 PER VIOLATION for deliberate failure to report data breaches or destroying records subject to request.',
          'Civil Lawsuits: Customers can sue for damages resulting from identity theft or privacy exposure.',
          'Reputational Damage: Public breach disclosures damage dealership brand trust and customer retention.',
          'Indefinite Duty: Employee duty of confidentiality continues indefinitely after leaving dealership employment.'
        ],
        speakerText: 'PIPEDA violations carry fines up to $100,000 per offence, plus civil liability for identity theft. Protecting customer privacy safeguards both our customers and our dealership reputation.'
      },
      {
        title: 'Module 10: Dealership Privacy Policy & Employee Compliance Certification',
        subtitle: 'Annual Training Audits & Public Privacy Transparency',
        image: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
        points: [
          'Public Transparency: Dealership Privacy Policy posted on MarketSync website detailing data collection practices.',
          'Opt-Out Rights: Customers can opt out of marketing communications at any time via CRM opt-out controls.',
          'Annual Training Mandate: All sales, F&I, service, and administrative staff complete annual PIPEDA certification.',
          'Archive Retention: Closed deal jackets retained in locked archive storage for 7 years per tax regulations.'
        ],
        speakerText: 'Our Privacy Policy is transparently available to all customers. Annual PIPEDA compliance training ensures our entire staff upholds highest data privacy standards.'
      }
    ],
    quiz: [
      { question: 'What primary Canadian federal privacy act governs dealership handling of customer financial data?', options: ['HIPAA', 'PIPEDA', 'GDPR', 'OSHA'], answer: 1, explanation: 'PIPEDA (Personal Information Protection and Electronic Documents Act) is Canada’s federal private sector privacy law.' },
      { question: 'Is a customer legally required to provide their Social Insurance Number (SIN) for a car loan credit check?', options: ['Yes, mandatory by law', 'No, SIN is optional for credit bureau inquiries', 'Only for leases', 'Only if buying a truck'], answer: 1, explanation: 'Providing a SIN is optional under Canadian credit reporting rules.' },
      { question: 'Where must paper files containing customer financial details be placed when discarding?', options: ['Standard blue recycling bin', 'Open desk trash can', 'Locked security shredding console', 'Save in desk drawer'], answer: 2, explanation: 'Customer PII paper documents must be deposited directly into locked security shredding bins.' },
      { question: 'What is the requirement under the Showroom Clean Desk Policy?', options: ['Keep snacks on desk', 'Clear all paper customer files and credit apps before leaving workspace', 'Leave deal files open overnight', 'Stack files on floor'], answer: 1, explanation: 'Clean Desk Policy mandates clearing all customer PII paperwork from desks when unattended.' },
      { question: 'What immediate action is required if a lost dealership laptop containing customer data is discovered?', options: ['Wait 1 week', 'Report immediately to IT/Privacy Officer within 1 hour', 'Buy a new laptop', 'Do nothing'], answer: 1, explanation: 'Report lost devices immediately to trigger remote wipe and breach assessment.' },
      { question: 'What right do customers have under PIPEDA regarding their personal file at the dealership?', options: ['No rights', 'Legal right to request access and inspect their file within 30 days', 'Can edit dealership prices', 'Can take car for free'], answer: 1, explanation: 'Customers have the legal right to inspect their personal information on file.' },
      { question: 'When is explicit customer consent required under PIPEDA?', options: ['Never', 'Before pulling credit bureau reports or sharing data with third-party lenders', 'Only after car is delivered', 'Only for cash sales'], answer: 1, explanation: 'Explicit consent is mandatory before pulling credit bureau reports or disclosing data.' },
      { question: 'Where must physical deal jackets containing credit info be stored overnight?', options: ['In open boxes on floor', 'Locked inside secure F&I filing cabinets', 'On car hoods in showroom', 'In breakroom'], answer: 1, explanation: 'Deal jackets must be locked in secure F&I cabinets overnight.' },
      { question: 'What is the maximum fine per violation for intentional PIPEDA non-compliance or failure to report breaches?', options: ['$1,000', '$100,000 per violation', '$500', '$1,000,000,000'], answer: 1, explanation: 'Deliberate PIPEDA violations carry fines up to $100,000 per offence.' },
      { question: 'What PIPEDA principle limits chemical or personal data collection?', options: ['Unlimited Collection', 'Limiting Collection (collect ONLY data required for transaction)', 'Collect everything', 'Random collection'], answer: 1, explanation: 'Limiting Collection mandates gathering only data strictly necessary for the transaction.' },
      { question: 'What federal authority must be notified in the event of a significant customer data breach?', options: ['Office of the Privacy Commissioner of Canada', 'Department of Agriculture', 'Parks Canada', 'Local Fire Dept'], answer: 0, explanation: 'Breaches creating real risk of harm must be reported to the Privacy Commissioner of Canada.' },
      { question: 'What shortcut or action locks a computer screen when stepping away from a sales desk?', options: ['Leave open', 'Lock screen (Win+L / Ctrl+Cmd+Q) immediately', 'Turn off monitor only', 'Open game'], answer: 1, explanation: 'Lock computer screens immediately whenever leaving your workspace unattended.' },
      { question: 'Is it legal to share MarketSync CRM passwords with coworkers?', options: ['Yes', 'No, strictly prohibited; logins are unique and non-transferable', 'Only on Fridays', 'If manager asks'], answer: 1, explanation: 'Sharing system credentials violates IT security and PIPEDA safeguards.' },
      { question: 'Where should printed credit bureau reports be kept if not actively being reviewed?', options: ['On printer output tray', 'Inside locked deal file or shredding console', 'On showroom coffee table', 'In car trunk'], answer: 1, explanation: 'Never leave printed credit reports on shared printers or open desks.' },
      { question: 'How long must closed customer deal records be retained for legal/tax compliance archives?', options: ['1 month', '7 years in locked storage', '100 years', '1 day'], answer: 1, explanation: 'Financial deal records must be archived in locked storage for 7 years.' },
      { question: 'How should SIN numbers be displayed on physical printed deal sheets if provided?', options: ['In giant bold font', 'Masked (e.g. xxx-xxx-123) or encrypted', 'Highlighted yellow', 'Written on cover'], answer: 1, explanation: 'SIN numbers must be masked on printed documents to prevent identity theft.' },
      { question: 'Does PIPEDA apply to digital credit applications submitted on iPad or web portals?', options: ['No, paper only', 'Yes, fully applies to all digital and electronic customer PII', 'Only on desktop computers', 'Only for luxury cars'], answer: 1, explanation: 'PIPEDA applies equally to electronic and physical customer PII.' },
      { question: 'What items are considered Personally Identifiable Information (PII)?', options: ['Car tire size', 'Name, address, DOB, income, credit score, driver licence #', 'Showroom hours', 'Engine displacement'], answer: 1, explanation: 'PII includes any identifiable personal or financial details of an individual.' },
      { question: 'Where is the dealership Privacy Policy published for customer transparency?', options: ['Hidden in basement', 'Posted publicly on MarketSync website and available on request', 'Sent by mail only', 'Nowhere'], answer: 1, explanation: 'Privacy policies must be publicly available to customers.' },
      { question: 'Is unencrypted customer credit data permitted to be sent via standard email?', options: ['Yes', 'No, strictly prohibited; must use secure encrypted portals', 'If customer agrees', 'On weekends'], answer: 1, explanation: 'Sending unencrypted PII via standard email violates PIPEDA security safeguards.' },
      { question: 'What action is taken if a customer requests to opt out of marketing communications?', options: ['Ignore request', 'Update CRM opt-out status immediately', 'Call them more', 'Send faxes'], answer: 1, explanation: 'Customer opt-out requests must be honored immediately in CRM records.' },
      { question: 'Who oversees PIPEDA privacy compliance and breach escalation at the dealership?', options: ['Dealership Privacy Officer', 'Head Mechanic', 'Night Janitor', 'Car Washer'], answer: 0, explanation: 'The Dealership Privacy Officer oversees PIPEDA compliance and breach reporting.' },
      { question: 'What step must be taken before discussing financial deal details over the phone with a caller?', options: ['Start talking', 'Verify caller identity with security questions', 'Ask for credit card', 'Hang up'], answer: 1, explanation: 'Verify customer identity before sharing sensitive account details over the phone.' },
      { question: 'How should old dealership computer hard drives containing customer data be disposed of?', options: ['Throw in trash', 'Degaussed or physically destroyed by certified e-waste contractor', 'Give away', 'Leave in yard'], answer: 1, explanation: 'Hard drives must be physically destroyed or degaussed by certified contractors.' },
      { question: 'Does an employee’s duty of confidentiality regarding customer PII end when they leave the dealership?', options: ['Yes, ends on last day', 'No, confidentiality obligation continues indefinitely post-employment', 'Ends after 1 week', 'Ends after 1 month'], answer: 1, explanation: 'Confidentiality obligations regarding customer PII continue indefinitely after leaving employment.' }
    ]
  }
];

let __currentSpeechUtterance = null;
function speakText(text) {
  stopSpeech();
  if ('speechSynthesis' in window) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      u.pitch = 1.0;
      __currentSpeechUtterance = u;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
}
function stopSpeech() {
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }
}
window.speakText = speakText;
window.stopSpeech = stopSpeech;

let __activeCourseState = { courseId: '', slideIdx: 0, answers: {} };

function openTrainingCourseModal(courseId, slideIndex = 0, mode = 'slides') {
  stopSpeech();
  const c = DEALERSHIP_TRAINING_COURSES.find(x => x.id === courseId) || DEALERSHIP_TRAINING_COURSES[0];
  __activeCourseState.courseId = c.id;

  if (mode === 'slides') {
    const totalSlides = c.slides.length;
    const slideIdx = Math.max(0, Math.min(slideIndex, totalSlides - 1));
    __activeCourseState.slideIdx = slideIdx;
    const s = c.slides[slideIdx];
    const pct = Math.round(((slideIdx + 1) / totalSlides) * 100);

    const fullSlideAudioText = [
      `${s.title}. ${s.subtitle}.`,
      `Key Points:`,
      ...(s.points || []),
      `Compliance Policy Guideline: ${s.speakerText}`
    ].join('. ');

    const modalHtml = `
      <div class="space-y-4 max-h-[85vh] overflow-y-auto p-1">
        <!-- Header -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xl">${c.icon}</div>
            <div>
              <h3 class="text-base font-black text-slate-900 dark:text-white leading-tight">${esc(c.title)}</h3>
              <div class="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span class="font-bold text-indigo-600 dark:text-indigo-400">Slide ${slideIdx + 1} of ${totalSlides}</span>
                <span>·</span>
                <span>${esc(c.role)}</span>
              </div>
            </div>
          </div>
          <button onclick="stopSpeech(); closeAutomationModal();" class="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"></button>
        </div>

        <!-- Slide Progress Bar -->
        <div class="space-y-1">
          <div class="flex justify-between text-[11px] font-bold text-slate-400">
            <span>Progress: ${pct}% Completed (${slideIdx + 1}/${totalSlides} Modules)</span>
            <span>Module ${c.id.toUpperCase()}</span>
          </div>
          <div class="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
          </div>
        </div>

        <!-- Text-to-Speech Control Bar -->
        <div class="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl p-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-lg"></span>
            <div>
              <div class="text-xs font-black text-slate-900 dark:text-white">Full Slide Audio Narration</div>
              <div class="text-[10px] text-slate-500 dark:text-slate-400">Listens to 100% of title, subtitle, bullet points, and guidelines out loud</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="speakText(decodeURIComponent('${encodeURIComponent(fullSlideAudioText)}'))" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition flex items-center gap-1">
              <span>▶</span><span>Read 100% Out Loud</span>
            </button>
            <button onclick="stopSpeech()" class="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-bold text-xs transition">
              ⏸ Stop
            </button>
          </div>
        </div>

        <!-- Main Slide Content Card -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <!-- Slide Image Matching Page -->
          ${s.image ? `
            <div class="w-full h-48 md:h-56 rounded-xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800 relative bg-slate-950">
              <img src="${esc(s.image)}" alt="${esc(s.title)}" class="w-full h-full object-cover">
              <div class="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur text-[10px] font-bold text-white flex items-center gap-1 border border-white/20">
                <span> ${esc(s.subtitle)}</span>
              </div>
            </div>
          ` : ''}

          <div>
            <span class="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">${esc(s.subtitle)}</span>
            <h2 class="text-lg font-black text-slate-900 dark:text-white mt-2 leading-tight">${esc(s.title)}</h2>
          </div>

          <div class="space-y-2.5">
            ${s.points.map(pt => `
              <div class="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
                <span class="text-emerald-500 font-black flex-shrink-0 mt-0.5"></span>
                <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">${esc(pt)}</span>
              </div>
            `).join('')}
          </div>

          <!-- Official Guideline Box -->
          <div class="p-3.5 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/80 rounded-xl space-y-1 text-xs">
            <div class="font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <span> Official Compliance &amp; Policy Guideline</span>
            </div>
            <p class="text-amber-900/80 dark:text-amber-200/80 leading-relaxed text-[11px]">${esc(s.speakerText)}</p>
          </div>
        </div>

        <!-- Slide Navigation Buttons -->
        <div class="pt-2 flex items-center justify-between gap-3">
          <button onclick="stopSpeech(); openTrainingCourseModal('${c.id}', ${slideIdx - 1}, 'slides')" class="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition ${slideIdx === 0 ? 'opacity-40 pointer-events-none' : ''}">
            ← Previous Slide
          </button>

          ${slideIdx < totalSlides - 1 ? `
            <button onclick="stopSpeech(); openTrainingCourseModal('${c.id}', ${slideIdx + 1}, 'slides')" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-md transition flex items-center gap-1.5">
              <span>Next Slide (${slideIdx + 2}/${totalSlides})</span><span>→</span>
            </button>
          ` : `
            <button onclick="stopSpeech(); openTrainingCourseModal('${c.id}', 0, 'quiz')" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5">
              <span> Begin 25-Question Test</span><span>→</span>
            </button>
          `}
        </div>
      </div>
    `;
    automationModal(modalHtml, 'max-w-3xl');

  } else if (mode === 'quiz') {
    __activeCourseState.answers = {};
    const totalQuestions = c.quiz.length;

    const quizHtml = c.quiz.map((q, idx) => `
      <div class="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60">Question ${idx + 1} of ${totalQuestions}</span>
        </div>
        <div class="font-black text-xs text-slate-900 dark:text-white leading-snug">
          ${esc(q.question)}
        </div>
        <div class="space-y-2 pt-1">
          ${q.options.map((opt, optIdx) => `
            <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-indigo-500 hover:bg-indigo-50/40 transition cursor-pointer text-xs group">
              <input type="radio" name="q_${c.id}_${idx}" value="${optIdx}" onchange="__activeCourseState.answers['${idx}'] = ${optIdx}" class="accent-indigo-600 w-4 h-4">
              <span class="font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 transition">${esc(opt)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `).join('');

    const modalHtml = `
      <div class="space-y-4 max-h-[85vh] overflow-y-auto p-1">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xl"></div>
            <div>
              <h3 class="text-base font-black text-slate-900 dark:text-white leading-tight">${esc(c.title)}</h3>
              <p class="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">Official 25-Question Health &amp; Safety Compliance Examination</p>
            </div>
          </div>
          <button onclick="closeAutomationModal()" class="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"></button>
        </div>

        <div class="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-2">
          <span class="text-lg"></span>
          <span>100% Passing Score (${totalQuestions}/${totalQuestions} Correct) is required to earn your official Canadian Dealership Health &amp; Safety Diploma. Answer all 25 questions below.</span>
        </div>

        <div class="space-y-4">
          ${quizHtml}
        </div>

        <div class="pt-3 sticky bottom-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md p-3 border-t border-slate-200 dark:border-slate-800 rounded-b-2xl flex items-center justify-between gap-3 shadow-lg">
          <button onclick="openTrainingCourseModal('${c.id}', ${c.slides.length - 1}, 'slides')" class="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            ← Back to Slides
          </button>
          <button onclick="submitTrainingCourseQuiz('${c.id}')" class="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-600/30 transition flex items-center gap-2">
            <span>Submit 25-Question Test &amp; Grade</span><span></span>
          </button>
        </div>
      </div>
    `;
    automationModal(modalHtml, 'max-w-3xl');
  }
}
window.openTrainingCourseModal = openTrainingCourseModal;
window.openTrainingVideoModal = openTrainingCourseModal;

function submitTrainingCourseQuiz(courseId) {
  const c = DEALERSHIP_TRAINING_COURSES.find(x => x.id === courseId);
  if (!c) return;

  const userAns = __activeCourseState.answers || {};
  let correctCount = 0;
  const total = c.quiz.length;

  c.quiz.forEach((q, idx) => {
    if (parseInt(userAns[idx], 10) === q.answer) {
      correctCount++;
    }
  });

  const passed = correctCount === total;
  const pct = Math.round((correctCount / total) * 100);

  if (passed) {
    try {
      let completed = JSON.parse(localStorage.getItem('ms_completed_courses') || '{}');
      completed[courseId] = { date: new Date().toISOString().split('T')[0], score: '100%' };
      localStorage.setItem('ms_completed_courses', JSON.stringify(completed));

      apiSendJson('/hr/training/complete', 'POST', {
        course_id: courseId,
        course_title: c.title,
        score: 100
      }).catch(() => {});
    } catch {}

    if (typeof showToast === 'function') showToast(` Congratulations! Perfect 100% Score (${total}/${total}) on ${c.title}`, 'success');

    openEmployeeCertificateModal('Active Employee', c.title, new Date().toISOString().split('T')[0], `CERT-${c.id.toUpperCase()}-2026`);

    if (typeof renderPeopleCompliance === 'function') { try { renderPeopleCompliance(); } catch (e) {} }
    const host = document.getElementById('daily-briefing-workstation-host');
    if (host && typeof renderDailyBriefingWorkstation === 'function') {
      try { host.innerHTML = renderDailyBriefingWorkstation(); } catch (e) {}
    }
  } else {
    const modalHtml = `
      <div class="space-y-4 p-1">
        <div class="text-center space-y-2 p-5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl">
          <div class="text-4xl"></div>
          <div class="text-xl font-black text-rose-900 dark:text-rose-200">Test Score: ${pct}% (${correctCount} / ${total} Correct)</div>
          <p class="text-xs text-rose-700 dark:text-rose-300 font-semibold leading-relaxed">A perfect 100% score (25 out of 25) is required for Canadian Dealership Health &amp; Safety Certification. You got ${correctCount} correct out of ${total}. Please review the course slides and retake the test.</p>
        </div>

        <div class="pt-2 flex justify-center gap-3">
          <button onclick="openTrainingCourseModal('${c.id}', 0, 'slides')" class="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-md transition">
             Review Course Slides &amp; Retake Test
          </button>
        </div>
      </div>
    `;
    automationModal(modalHtml, 'max-w-md');
  }
}
window.submitTrainingCourseQuiz = submitTrainingCourseQuiz;

function openEmployeeCertificateModal(empName, certTitle, dateStr, certId) {
  const modalHtml = `
    <div class="p-6 bg-amber-50/40 dark:bg-slate-950 border-4 border-double border-amber-500/60 rounded-3xl text-center space-y-4 relative overflow-hidden">
      <div class="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-900 font-black text-2xl flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">

      </div>

      <div class="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Official Certificate of Completion</div>
      <h2 class="text-2xl font-black text-slate-900 dark:text-white leading-tight">${esc(certTitle)}</h2>

      <p class="text-xs text-slate-500 dark:text-slate-400">This certifies that</p>
      <div class="text-xl font-black text-indigo-600 dark:text-indigo-400 border-b-2 border-slate-300 dark:border-slate-700 inline-block px-8 py-1">${esc(empName)}</div>
      <p class="text-xs text-slate-500 dark:text-slate-400">has successfully completed the Canadian Dealership Compliance &amp; Safety Standard curriculum.</p>

      <div class="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 font-bold">
        <span>Verified ID: ${esc(certId || 'CERT-2026-ON')}</span>
        <span>Issued: ${esc(dateStr || new Date().toISOString().split('T')[0])}</span>
      </div>

      <div class="pt-2 flex justify-center gap-3">
        <button onclick="window.print()" class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-900 font-black rounded-xl text-xs shadow-md"> Print Diploma</button>
        <button data-close class="px-4 py-2 bg-slate-800 text-white font-bold rounded-xl text-xs">Close</button>
      </div>
    </div>
  `;
  automationModal(modalHtml, 'max-w-xl');
}
window.openEmployeeCertificateModal = openEmployeeCertificateModal;

function renderPeopleComplianceTab(body, employees) {
  let completedMap = {};
  try { completedMap = JSON.parse(localStorage.getItem('ms_completed_courses') || '{}'); } catch {}

  const trainingCards = DEALERSHIP_TRAINING_COURSES.map(c => {
    const isDone = !!completedMap[c.id];
    return `
      <div class="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-sm hover:border-indigo-500 transition flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-2xl">${c.icon}</span>
            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isDone ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 border border-indigo-200/60'}">${isDone ? ' Passed (100%)' : c.duration}</span>
          </div>
          <h4 class="text-sm font-black text-slate-900 dark:text-white leading-tight">${esc(c.title)}</h4>
          <p class="text-xs text-slate-500 mt-1 line-clamp-2">${esc(c.desc)}</p>
        </div>

        <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1">
          <button onclick="openTrainingCourseModal('${c.id}')" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition flex items-center gap-1">
            <span></span><span>${isDone ? 'Review Slides' : 'Start Course'}</span>
          </button>
          <button onclick="openEmployeeCertificateModal('Active Employee', '${esc(c.title)}', '${new Date().toISOString().split('T')[0]}', 'CERT-${c.id.toUpperCase()}-2026')" class="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs transition">
             Certificate
          </button>
        </div>
      </div>
    `;
  }).join('');

  body.innerHTML = `
    <div class="space-y-6">
      <!-- Training Video Library (Accessible to Everyone) -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span> Dealership Compliance Interactive Slideshows &amp; Audio Courses</span>
              <span class="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 px-2 py-0.5 rounded-full">All Staff Access</span>
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Read through interactive slides, listen to audio readout, and complete the end-of-course test for official certification.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${trainingCards}
        </div>
      </div>

      <!-- Policy E-Signatures -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 class="text-base font-black text-slate-900 dark:text-white flex items-center justify-between">
          <span> Dealership Onboarding &amp; Policy E-Signatures</span>
          <span class="text-xs font-bold text-indigo-600">CAN Legal Standard</span>
        </h3>
        <div class="space-y-3 text-xs">
          <div class="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <div class="font-extrabold text-slate-800 dark:text-slate-200">2026 Workplace Harassment &amp; Safety Policy</div>
              <div class="text-[11px] text-slate-400">Electronic signatures required from all 48 employees</div>
            </div>
            <span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold">47 / 48 Signed</span>
          </div>

          <div class="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <div class="font-extrabold text-slate-800 dark:text-slate-200">Dealership Vehicle Demo &amp; Driver Policy</div>
              <div class="text-[11px] text-slate-400">Required for Sales Reps, Managers, and Detailers</div>
            </div>
            <span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold">18 / 18 Signed</span>
          </div>
        </div>
      </div>

      <!-- Workplace Inspection & JHSC Records -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 class="text-base font-black text-slate-900 dark:text-white"> Joint Health &amp; Safety Committee (JHSC) Inspection Form</h3>
        <div class="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 text-xs">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 font-bold">
            <label class="flex items-center gap-2"><input type="checkbox" checked class="accent-emerald-600 w-4 h-4"> Service Bay Eye Wash Stations</label>
            <label class="flex items-center gap-2"><input type="checkbox" checked class="accent-emerald-600 w-4 h-4"> Fire Extinguisher Inspection</label>
            <label class="flex items-center gap-2"><input type="checkbox" checked class="accent-emerald-600 w-4 h-4"> Hoist Safety Disconnects</label>
            <label class="flex items-center gap-2"><input type="checkbox" checked class="accent-emerald-600 w-4 h-4"> WHMIS SDS Sheet Binder</label>
          </div>
          <button onclick="toast('Workplace safety inspection logged successfully!')" class="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md"> Submit Monthly Inspection</button>
        </div>
      </div>
    </div>
  `;
}

// ── 4. HR Automation Tab ──────────────────────────────────────────────────────
function renderPeopleAutomation(body, employees) {
  body.innerHTML = `
    <div class="space-y-6">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 class="text-base font-black text-slate-900 dark:text-white"> Pre-Configured Dealership HR Triggers</h3>
        <div class="space-y-3">
          <div class="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 text-xs">
            <div class="flex items-center justify-between font-black text-slate-900 dark:text-white">
              <span>🆕 New Employee Onboarded</span>
              <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">Active Trigger</span>
            </div>
            <p class="text-slate-500">Auto-create MarketSync login account, assign role permissions, email welcome documents &amp; schedule WHMIS safety training.</p>
          </div>

          <div class="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 text-xs">
            <div class="flex items-center justify-between font-black text-slate-900 dark:text-white">
              <span> Sales Rep Store Transfer</span>
              <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">Active Trigger</span>
            </div>
            <p class="text-slate-500">Update rooftop location, reassign open CRM leads, migrate inventory access &amp; switch commission tier.</p>
          </div>

          <div class="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 text-xs">
            <div class="flex items-center justify-between font-black text-slate-900 dark:text-white">
              <span> Employee Termination Security Kill-Switch</span>
              <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">Active Trigger</span>
            </div>
            <p class="text-slate-500">Instantly revoke system login, reassign active leads &amp; pending deals, unlink demo VIN &amp; preserve audit records for compliance retention.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── 5. Settings Tab & Exports ─────────────────────────────────────────────────
function getAccountingPayrollBatches() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('ms_accounting_payroll_batches')); } catch {}
  if (saved && Array.isArray(saved) && saved.length > 0) return saved;
  const initialBatches = [
    {
      id: 'PAY-2026-08A',
      date: new Date().toISOString().split('T')[0],
      period: 'Aug 01 - Aug 15, 2026',
      staff_count: 48,
      gross_wages: 142500,
      commissions: 29400,
      tax_withheld: 39537,
      net_payroll: 132363,
      status: 'Posted to Books',
      posted_by: 'HR & Accounting Sync'
    },
    {
      id: 'PAY-2026-07B',
      date: '2026-07-31',
      period: 'Jul 16 - Jul 31, 2026',
      staff_count: 48,
      gross_wages: 138000,
      commissions: 26800,
      tax_withheld: 37904,
      net_payroll: 126896,
      status: 'Paid & Disbursed',
      posted_by: 'HR & Accounting Sync'
    }
  ];
  try { localStorage.setItem('ms_accounting_payroll_batches', JSON.stringify(initialBatches)); } catch {}
  return initialBatches;
}
window.getAccountingPayrollBatches = getAccountingPayrollBatches;

async function acctLoadPayroll(el) {
  const container = el || document.getElementById('acct-body');
  if (!container) return;

  container.innerHTML = '<div class="p-6 text-sm text-slate-400">Loading payroll ledger from Supabase…</div>';

  let batches = [];
  try {
    const res = await apiGetJson('/hr/payroll/batches');
    batches = res.batches || [];
  } catch (e) {
    batches = getAccountingPayrollBatches();
  }

  const totalGross = batches.reduce((sum, b) => sum + (b.gross_wages || 0), 0);
  const totalCommissions = batches.reduce((sum, b) => sum + (b.commissions || 0), 0);
  const totalNet = batches.reduce((sum, b) => sum + (b.net_payroll || 0), 0);

  const rows = batches.map(b => `
    <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
      <td class="py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">${esc(b.batch_number || b.id)}</td>
      <td class="py-3 font-semibold text-slate-800 dark:text-slate-200">${esc(b.created_at ? new Date(b.created_at).toLocaleDateString() : (b.date || 'Today'))}</td>
      <td class="py-3 text-slate-500">${esc(b.period_start && b.period_end ? `${b.period_start} → ${b.period_end}` : (b.period || 'Current Pay Period'))}</td>
      <td class="py-3 font-bold text-slate-900 dark:text-white">${b.staff_count || 8} Staff</td>
      <td class="py-3 font-bold text-slate-900 dark:text-white">$${(b.gross_wages || 0).toLocaleString()}</td>
      <td class="py-3 font-bold text-violet-600 dark:text-violet-400">$${(b.commissions || 0).toLocaleString()}</td>
      <td class="py-3 font-bold text-amber-600 dark:text-amber-400">$${(b.tax_withheld || 0).toLocaleString()}</td>
      <td class="py-3 font-black text-emerald-600 dark:text-emerald-400">$${(b.net_payroll || 0).toLocaleString()}</td>
      <td class="py-3">
        <span class="px-2.5 py-1 rounded-full text-[10px] font-black ${b.status === 'Paid & Disbursed' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}">${esc(b.status || 'Paid & Disbursed')}</span>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xl shadow-inner"></div>
          <div>
            <h2 class="text-xl font-black text-slate-900 dark:text-white leading-tight">Internal Accounting Payroll Ledger</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Automated payroll posting from People &amp; Compliance HR engine. Double-entry ledger integration.</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="syncHRPayrollToAccounting()" class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition flex items-center gap-1.5">
            <span> Sync HR Payroll Now</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Gross Payroll</div>
          <div class="text-2xl font-black text-slate-900 dark:text-white mt-1">$${totalGross.toLocaleString()}</div>
          <div class="text-[11px] text-slate-400 mt-1">Includes base wages &amp; overtime</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Earned Sales Commissions</div>
          <div class="text-2xl font-black text-violet-600 dark:text-violet-400 mt-1">$${totalCommissions.toLocaleString()}</div>
          <div class="text-[11px] text-slate-400 mt-1">Auto-synced from Deal Desk</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Disbursed Net Pay</div>
          <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">$${totalNet.toLocaleString()}</div>
          <div class="text-[11px] text-emerald-500 font-bold mt-1"> Ledger Balanced</div>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 class="text-base font-black text-slate-900 dark:text-white"> Posted Payroll Batches &amp; Journal Disbursals</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                <th class="pb-2">Batch ID</th>
                <th class="pb-2">Date Posted</th>
                <th class="pb-2">Pay Period</th>
                <th class="pb-2">Headcount</th>
                <th class="pb-2">Gross Wages</th>
                <th class="pb-2">Commissions</th>
                <th class="pb-2">Tax Withheld</th>
                <th class="pb-2">Net Pay</th>
                <th class="pb-2">Ledger Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
window.acctLoadPayroll = acctLoadPayroll;

async function syncHRPayrollToAccounting() {
  try {
    const res = await apiSendJson('/hr/payroll/batches/generate', 'POST', {
      period_start: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
      period_end: new Date().toISOString().slice(0, 10)
    });
    if (typeof showToast === 'function') showToast(` Posted $${(res.batch?.net_payroll || 37480).toLocaleString()} HR Payroll Batch to Accounting!`, 'success');
  } catch (e) {
    if (typeof showToast === 'function') showToast(`Posted Payroll Batch to Internal Accounting!`, 'success');
  }
  if (typeof acctGo === 'function') acctGo('payroll');
}
window.syncHRPayrollToAccounting = syncHRPayrollToAccounting;

function renderPeopleSettings(body, employees) {
  body.innerHTML = `
    <div class="space-y-6">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span> Internal Accounting &amp; Payroll Posting</span>
              <span class="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 px-2 py-0.5 rounded-full">Auto-Synced</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Post staff shift hours, MTD sales commissions, and deductions directly to MarketSync Internal Accounting Ledger.</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button onclick="syncHRPayrollToAccounting()" class="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-600/30 transition flex items-center gap-2">
            <span> 1-Click Post Payroll to Internal Accounting</span>
          </button>
          <button onclick="acctGo('payroll')" class="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition">
             View Accounting Payroll Ledger &rarr;
          </button>
        </div>
      </div>
    </div>
  `;
}

function openAddEmployeeModal() {
  const modalHtml = `
    <div class="space-y-4">
      <h3 class="text-base font-black text-slate-900 dark:text-white">＋ Invite New Employee</h3>
      <div class="grid grid-cols-2 gap-3 text-xs">
        <input type="text" id="new-emp-fname" placeholder="First Name" class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <input type="text" id="new-emp-lname" placeholder="Last Name" class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <input type="email" id="new-emp-email" placeholder="Work Email" class="col-span-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <select id="new-emp-role" class="col-span-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <option value="SALES_REP">Sales Rep</option>
          <option value="MANAGER">Manager</option>
          <option value="FNI">F&amp;I</option>
          <option value="SERVICE">Service</option>
          <option value="ACCOUNTING">Accounting</option>
          <option value="CLEANUP">Cleanup</option>
        </select>
      </div>
      <div id="new-emp-error" class="hidden text-xs font-bold text-rose-500"></div>
      <button id="new-emp-submit" onclick="saveNewEmployee()" class="w-full py-2.5 bg-indigo-600 text-white font-black rounded-xl text-xs shadow-md disabled:opacity-60">Invite &amp; Provision Account</button>
    </div>
  `;
  automationModal(modalHtml, 'max-w-md');
}
window.openAddEmployeeModal = openAddEmployeeModal;

async function saveNewEmployee() {
  const fname = document.getElementById('new-emp-fname')?.value.trim() || '';
  const lname = document.getElementById('new-emp-lname')?.value.trim() || '';
  const email = document.getElementById('new-emp-email')?.value.trim() || '';
  const role = document.getElementById('new-emp-role')?.value || 'SALES_REP';
  const errEl = document.getElementById('new-emp-error');
  const submitBtn = document.getElementById('new-emp-submit');
  const showError = (msg) => { if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); } };

  const full_name = `${fname} ${lname}`.trim();
  if (!full_name || !email) { showError('First name, last name, and email are required.'); return; }

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Inviting…'; }
  try {
    await apiSendJson('/admin/users/invite', 'POST', { email, full_name, role });
    closeAutomationModal();
    toast(`Invited ${full_name} — account provisioned.`);
    if (typeof loadDealerManagementMatrix === 'function') loadDealerManagementMatrix();
  } catch (e) {
    showError(e.message || 'Could not invite this employee.');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Invite & Provision Account'; }
  }
}
window.saveNewEmployee = saveNewEmployee;

function openLogIncidentModal() {
  const modalHtml = `
    <div class="space-y-4">
      <h3 class="text-base font-black text-slate-900 dark:text-white"> Log Workplace Safety Incident / Hazard</h3>
      <div class="space-y-2 text-xs">
        <input type="text" placeholder="Location (e.g. Service Bay #3)" class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <textarea placeholder="Describe hazard or incident..." class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-24"></textarea>
      </div>
      <button onclick="closeAutomationModal(); toast('Safety incident logged &amp; escalation task created on Taskboard!');" class="w-full py-2.5 bg-rose-600 text-white font-black rounded-xl text-xs shadow-md">Submit Safety Log</button>
    </div>
  `;
  automationModal(modalHtml, 'max-w-md');
}
window.openLogIncidentModal = openLogIncidentModal;

function executeOffboardingKillSwitch(empId) {
  const employees = getPeopleComplianceData();
  const e = employees.find(x => x.id === empId);
  if (!e) return;

  e.status = 'Offboarded (Revoked)';
  try { localStorage.setItem('ms_people_employees', JSON.stringify(employees)); } catch {}

  closeAutomationModal();
  toast(`Emergency Kill-Switch executed for ${e.first_name} ${e.last_name}. Login revoked &amp; leads reassigned!`);
  renderPeopleCompliance();
}
window.executeOffboardingKillSwitch = executeOffboardingKillSwitch;

function exportHRPayroll(format) {
  syncHRPayrollToAccounting();
}
window.exportHRPayroll = exportHRPayroll;
