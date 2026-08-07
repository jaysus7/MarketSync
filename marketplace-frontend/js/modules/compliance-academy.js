// ── MarketSync Frontend Module: DealerPilot Compliance & Training Academy ──────
var DEALERSHIP_TRAINING_COURSES = window.DEALERSHIP_TRAINING_COURSES || [
  {
    id: 'ehs',
    category: 'Health & Safety',
    title: 'Employee Health & Safety Awareness',
    duration: '00:30:00',
    role: 'All Dealership Staff',
    icon: '🦺',
    desc: 'Ontario Occupational Health and Safety Act (OHSA) rights, supervisor duties, hazard reporting, and PPE.',
    slides: [
      {
        title: 'Course Introduction',
        subtitle: 'Worker Health & Safety at Work in 4 Steps',
        image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop&q=80',
        points: [
          'This online module explains your rights and responsibilities on the job and tells you what the Health and Safety Act expects from your employer, your supervisor, and you.',
          'These are things you need to know and understand so that you can be safe at work today and every day.',
          'One of your employer\'s duties under the Health & Safety Act is to give you specific information and instructions about how to stay safe on your job.',
          'What you learn from this program will help you start to understand those instructions. We hope you will use what you learn here every day of your working life.'
        ],
        speakerText: 'Welcome to Employee Health and Safety Awareness. This Health and Safety at Work module is divided into four main sections: Step 1 Get On Board, Step 2 Get In The Know, Step 3 Get Involved, and Step 4 Get More Help.'
      },
      {
        title: 'Step 1: Get On Board — Worker & Employer Duties',
        subtitle: 'The 3 Fundamental Rights of Canadian Workers',
        image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
        points: [
          'Right to Know: Workers have the right to be informed about actual and potential hazards in their workplace.',
          'Right to Participate: Right to join Joint Health & Safety Committees (JHSC) or act as safety representatives.',
          'Right to Refuse Unsafe Work: Legal right to refuse work that presents an immediate danger to health or safety without threat of reprisal.',
          'Employer Duty: Provide safe machinery, protective equipment, competent supervision, and mandatory safety instruction.'
        ],
        speakerText: 'Under Step 1: Get On Board, Canadian law grants every worker three basic rights: the right to know about hazards, the right to participate in health and safety, and the right to refuse unsafe work.'
      },
      {
        title: 'Step 2: Get In The Know — Identifying Dealership Hazards',
        subtitle: 'Physical, Chemical, Biological & Ergonomic Hazards',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=80',
        points: [
          'Physical Hazards: Wet showroom floors, hoisted vehicles, moving machinery, noise, electrical cords.',
          'Chemical Hazards: Brake cleaners, detail solvents, paints, battery acids, carbon monoxide from exhaust.',
          'Ergonomic Hazards: Heavy lifting of wheels/tires, awkward postures, repetitive wrist strain in service bays.',
          'Reporting Duty: Report all missing guards, damaged cords, leaks, or near-miss incidents to your supervisor immediately.'
        ],
        speakerText: 'Step 2: Get In The Know requires identifying workplace hazards before they cause injuries. Report any hazardous conditions, damaged equipment, or near-misses to your supervisor right away.'
      },
      {
        title: 'Step 3: Get Involved — Joint Health & Safety Committee (JHSC)',
        subtitle: 'Monthly Inspections & Safety Representatives',
        image: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
        points: [
          'JHSC Mandate: Dealerships with 20+ staff MUST have a joint worker-management safety committee.',
          'Monthly Workplace Inspections: Worker representatives inspect shop bays, detail areas, and sales floors monthly.',
          'Posting Recommendations: JHSC meeting minutes and hazard recommendations must be posted on bulletin boards.',
          'Zero Reprisal: Employers cannot discipline workers for raising health and safety concerns.'
        ],
        speakerText: 'Step 3: Get Involved highlights the role of the Joint Health and Safety Committee. Worker reps inspect all dealership facilities monthly and work with management to resolve safety risks.'
      },
      {
        title: 'Step 4: Get More Help — Emergency Escalation & Support',
        subtitle: 'Ministry of Labour Hotlines & Safety Officers',
        image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
        points: [
          'Internal Escalation: Speak to your supervisor, JHSC worker representative, or Dealership Safety Officer.',
          'External Resources: Ontario Ministry of Labour, Immigration, Training and Skills Development hotline.',
          'WSIB Reporting: Workplace Safety & Insurance Board injury reporting requirements for lost-time incidents.',
          'Continuous Safety: Health and safety is an ongoing daily duty for every dealership employee.'
        ],
        speakerText: 'Step 4: Get More Help provides escalation pathways. If a safety issue remains unresolved internally, workers have access to Ministry hotlines and WSIB resources.'
      },
      {
        title: 'Conclusion & Summary',
        subtitle: 'You\'re Done! Ready for 25-Question Test',
        image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
        points: [
          'Summary: You have completed all 4 steps of Employee Health and Safety Awareness.',
          'Next Step: Click Launch Quiz to complete the 25-question test and earn your official diploma.',
          '100% Score Required: Perfect score required for compliance certification.'
        ],
        speakerText: 'You have completed Employee Health and Safety Awareness. Proceed to the 25-question examination to complete your certification.'
      }
    ],
    quiz: [
      { question: 'What are the 3 fundamental rights of workers under Ontario\'s Health & Safety Act?', options: ['Right to vacation, right to bonus, right to car', 'Right to Know, Right to Participate, Right to Refuse Unsafe Work', 'Right to free lunch, right to sleep, right to leave', 'Right to drive, right to sell, right to buy'], answer: 1, explanation: 'The 3 fundamental worker rights are Right to Know, Right to Participate, and Right to Refuse Unsafe Work.' },
      { question: 'Who has the primary duty to provide protective equipment and safe machinery?', options: ['The Customer', 'The Employer / Dealership', 'The Insurance Agent', 'The Bank'], answer: 1, explanation: 'Employers have the legal duty under OHSA to provide safe equipment and protective gear.' },
      { question: 'What should you do immediately if you spot an unshielded power tool or fluid spill?', options: ['Ignore it', 'Report it immediately to your supervisor', 'Clean it next week', 'Tell a customer'], answer: 1, explanation: 'Workers must report hazards immediately to their supervisor.' },
      { question: 'When is a Joint Health & Safety Committee (JHSC) legally required at a dealership?', options: ['Only at 1000 employees', 'When employing 20 or more workers', 'Never', 'Only for electric cars'], answer: 1, explanation: 'OHSA mandates a JHSC for workplaces with 20 or more workers.' },
      { question: 'Can an employer discipline a worker for refusing work they reasonably believe is unsafe?', options: ['Yes', 'No, discipline/reprisal for exercising safety rights is strictly illegal', 'Only on weekends', 'If manager agrees'], answer: 1, explanation: 'OHSA strictly prohibits any employer reprisal against workers exercising safety rights.' }
    ]
  },
  {
    id: 'fire-safety',
    category: 'Health & Safety',
    title: 'Fire Safety Awareness',
    duration: '00:25:00',
    role: 'All Dealership Staff',
    icon: '🔥',
    desc: 'Fire triangle, Class A/B/C/D extinguishers, PASS technique, and shop evacuation routes.',
    slides: [
      { title: 'Module 1: Fire Prevention & The Fire Triangle', subtitle: 'Fuel, Oxygen & Ignition Source', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=80', points: ['Fire requires 3 elements: Oxygen, Heat, and Fuel.', 'Keep flammable solvents away from open flames or sparks.', 'Inspect fire extinguishers monthly.'], speakerText: 'Fire safety starts with understanding the fire triangle: fuel, oxygen, and heat. Remove any one element to extinguish a fire.' }
    ],
    quiz: [
      { question: 'What does the PASS acronym stand for when using a fire extinguisher?', options: ['Pull, Aim, Squeeze, Sweep', 'Push, Ask, Stop, Start', 'Pause, Action, Save, See', 'Point, Align, Shoot, Stop'], answer: 0, explanation: 'PASS stands for Pull pin, Aim nozzle, Squeeze handle, Sweep side-to-side.' }
    ]
  },
  {
    id: 'hygiene',
    category: 'Health & Safety',
    title: 'Healthy Workplace Hygiene Basics',
    duration: '00:15:00',
    role: 'All Dealership Staff',
    icon: '🧼',
    desc: 'Hand hygiene, sanitizing customer loaner keys, steering wheel covers, and shop air filtration.',
    slides: [
      { title: 'Module 1: Dealership Hygiene Protocols', subtitle: 'Protecting Staff & Customers', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=80', points: ['Wash hands regularly with soap and water for 20 seconds.', 'Use protective covers on customer vehicle seats and steering wheels during service.', 'Sanitize key fobs before returning vehicles to customers.'], speakerText: 'Proper workplace hygiene protects dealership staff and customers. Always use seat covers and sanitize key fobs.' }
    ],
    quiz: [
      { question: 'How long should you wash your hands with soap and warm water?', options: ['5 seconds', '20 seconds minimum', '1 minute', 'Not needed'], answer: 1, explanation: 'Hand hygiene standards recommend washing hands for at least 20 seconds.' }
    ]
  },
  {
    id: 'violence-harassment',
    category: 'Health & Safety',
    title: 'Workplace Violence & Harassment Awareness',
    duration: '00:15:00',
    role: 'All Dealership Staff',
    icon: '🛡️',
    desc: 'Bill 168 definitions, incident reporting, domestic violence threats, and panic button procedures.',
    slides: [
      { title: 'Module 1: Bill 168 Workplace Violence & Harassment Policy', subtitle: 'Zero Tolerance Standard', image: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80', points: ['Zero tolerance for harassment, bullying, or violent threats.', 'Report all incidents to HR or management immediately.', 'Dealership maintains emergency panic buttons and secure access.'], speakerText: 'Under Bill 168, our dealership maintains a zero-tolerance policy against harassment or violence of any kind.' }
    ],
    quiz: [
      { question: 'What Ontario legislation governs workplace violence and harassment prevention?', options: ['Bill 168', 'HIPAA', 'ISO 9001', 'FAR'], answer: 0, explanation: 'Bill 168 amended OHSA to mandate workplace violence and harassment policies.' }
    ]
  },
  {
    id: 'aoda',
    category: 'Human Resources',
    title: 'Accessibility for Ontarians with Disabilities Act Awareness',
    duration: '01:00:00',
    role: 'All Dealership Staff',
    icon: '♿',
    desc: 'AODA customer service standards, service animals, support persons, and accessible dealership facilities.',
    slides: [
      { title: 'Module 1: AODA Customer Service Standards', subtitle: 'Inclusive Dealership Access', image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80', points: ['Ensure accessible ramps, automatic doors, and seating in showrooms.', 'Welcome service animals and support persons without fee.', 'Provide accessible document formats upon request.'], speakerText: 'AODA mandates accessible customer service for all Ontarians. Ensure service animals and support persons are welcomed.' }
    ],
    quiz: [
      { question: 'Are service animals permitted inside dealership showrooms and service waiting areas under AODA?', options: ['No', 'Yes, fully permitted in all public areas', 'Only outside', 'Only for trucks'], answer: 1, explanation: 'AODA mandates allowing service animals in all areas open to the public.' }
    ]
  },
  {
    id: 'cyber-security',
    category: 'Human Resources',
    title: 'Cyber Security',
    duration: '00:15:00',
    role: 'All Dealership Staff',
    icon: '🔒',
    desc: 'Dealer CRM phishing email recognition, password policies, ransomware defense, and secure WiFi.',
    slides: [
      { title: 'Module 1: Dealership Cyber Threat Defense', subtitle: 'Phishing, Ransomware & Credentials', image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80', points: ['Never click suspicious links or download unauthorized attachments.', 'Use complex passwords and enable Multi-Factor Authentication (MFA).', 'Lock your computer screen (Win+L / Ctrl+Cmd+Q) whenever leaving your desk.'], speakerText: 'Cyber security safeguards dealership customer records and financial software from phishing attacks.' }
    ],
    quiz: [
      { question: 'What keyboard shortcut locks your computer screen when stepping away from your workstation?', options: ['Ctrl+Alt+Del only', 'Win+L or Ctrl+Cmd+Q', 'Spacebar', 'Esc'], answer: 1, explanation: 'Lock computer screens immediately with Win+L or Ctrl+Cmd+Q when leaving desks.' }
    ]
  },
  {
    id: 'human-rights',
    category: 'Human Resources',
    title: 'Ontario\'s Human Rights 101 Awareness',
    duration: '00:15:00',
    role: 'All Dealership Staff',
    icon: '⚖️',
    desc: 'Protected grounds under Ontario Human Rights Code, discrimination prevention, and duty to accommodate.',
    slides: [
      { title: 'Module 1: Ontario Human Rights Code Fundamentals', subtitle: 'Protected Grounds & Non-Discrimination', image: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80', points: ['17 protected grounds including race, creed, disability, age, and family status.', 'Zero tolerance for discrimination in hiring, sales, or employment.', 'Duty to accommodate workers to the point of undue hardship.'], speakerText: 'Ontario Human Rights Code protects workers and customers across seventeen grounds. Discrimination is strictly prohibited.' }
    ],
    quiz: [
      { question: 'How many protected grounds exist under the Ontario Human Rights Code?', options: ['5', '17 protected grounds', '50', '1'], answer: 1, explanation: 'The Code covers 17 protected grounds including race, disability, creed, age, and sex.' }
    ]
  },
  {
    id: 'pipeda',
    category: 'Human Resources',
    title: 'Personal Information Protection and Electronic Documents Act Awareness',
    duration: '00:25:00',
    role: 'All Dealership Staff',
    icon: '📋',
    desc: 'PIPEDA 10 principles, SIN masking, credit app security, clean desk policy, and 7-year archives.',
    slides: [
      { title: 'Module 1: PIPEDA Customer Privacy Rules', subtitle: 'Canadian Federal Data Protection Standard', image: 'https://images.unsplash.com/photo-1618042164219-62c820f10723?w=800&auto=format&fit=crop&q=80', points: ['Obtain explicit customer consent before pulling credit reports.', 'Mask Social Insurance Numbers (xxx-xxx-123) on deal sheets.', 'Store paper deal jackets in locked F&I filing cabinets overnight.', 'Archive closed deal files in locked storage for 7 years.'], speakerText: 'PIPEDA governs customer privacy in Canadian dealerships. Protect credit files, mask SINs, and lock deal jackets overnight.' }
    ],
    quiz: [
      { question: 'What is the maximum fine per violation for intentional PIPEDA non-compliance or failure to report breach?', options: ['$500', '$100,000 per violation', '$1,000', '$10,000'], answer: 1, explanation: 'PIPEDA violations carry fines up to $100,000 per offence.' }
    ]
  },
  {
    id: 'personalities',
    category: 'Human Resources',
    title: 'Personalities at Work Awareness',
    duration: '00:15:00',
    role: 'All Dealership Staff',
    icon: '🤝',
    desc: 'Workplace communication styles, constructive feedback, conflict resolution, and teamwork.',
    slides: [
      { title: 'Module 1: Effective Dealership Team Communication', subtitle: 'Collaboration Across Sales, Service & Parts', image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop&q=80', points: ['Understand diverse communication preferences among team members.', 'Practice active listening during customer hand-offs.', 'Resolve inter-departmental conflicts constructively.'], speakerText: 'Effective teamwork across sales, service, and office departments ensures seamless dealership operations.' }
    ],
    quiz: [
      { question: 'What is a key principle of constructive communication at work?', options: ['Shouting', 'Active listening and mutual respect', 'Ignoring feedback', 'Blaming others'], answer: 1, explanation: 'Active listening and mutual respect foster effective teamwork.' }
    ]
  },
  {
    id: 'whmis',
    category: 'WHMIS',
    title: 'WHMIS 2015 Awareness',
    duration: '00:30:00',
    role: 'All Dealership Staff',
    icon: '🧪',
    desc: 'Canadian GHS hazard classification, 16-section SDS sheets, GHS pictograms, and shop spill containment.',
    slides: [
      {
        title: 'WHMIS 2015 Introductory Training',
        subtitle: 'WHMIS 2015 for Workers',
        image: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&auto=format&fit=crop&q=80',
        points: [
          'Welcome to WHMIS 2015 for Workers.',
          'The Workplace Hazardous Materials Information System (WHMIS) helps you to know about the hazardous products that are used and stored in the workplace.',
          'WHMIS has now aligned with Globally Harmonized System of Classification and Labelling of Chemicals (GHS).',
          'GHS is a global system and has a common set of rules for classifying hazardous products.'
        ],
        speakerText: 'Welcome to WHMIS 2015 for Workers. WHMIS helps you know about hazardous products used and stored in your workplace, aligned with the Globally Harmonized System GHS.'
      },
      {
        title: 'Introduction to WHMIS & GHS Adoption',
        subtitle: 'Hazard Communication in Canadian Dealerships',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=80',
        points: [
          'WHMIS 2015 GHS Adoption in Canada is here.',
          'Applies to brake cleaners, detail solvents, paints, lubricants, and battery acids across service and detail bays.',
          'Mandated under Canadian Federal Hazardous Products Act and Provincial OHSA legislation.'
        ],
        speakerText: 'WHMIS 2015 GHS adoption in Canada applies to all chemical solvents, cleaners, and paints handled in dealership operations.'
      },
      {
        title: 'WHMIS Overview',
        subtitle: '3 Core WHMIS Elements: Labels, SDS & Worker Education',
        image: 'https://images.unsplash.com/photo-1618042164219-62c820f10723?w=800&auto=format&fit=crop&q=80',
        points: [
          'Product Labels: Supplier Labels and Workplace Labels on all chemical containers.',
          'Safety Data Sheets (SDS): 16-section documents detailing health effects and safe handling.',
          'Worker Education: Mandatory annual training for all dealership staff.'
        ],
        speakerText: 'The 3 core elements of WHMIS are product labels, Safety Data Sheets, and worker education.'
      },
      {
        title: 'Hazard Classes and Pictograms - Prior to GHS',
        subtitle: 'Legacy WHMIS 1988 Circles vs GHS Red Diamonds',
        image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
        points: [
          'Legacy WHMIS 1988 used black circular borders.',
          'WHMIS 2015 replaced circles with standardized GHS Red Diamond borders.',
          'Ensures international uniformity across Canada, USA, and Europe.'
        ],
        speakerText: 'WHMIS 2015 updated legacy circular symbols to international GHS red diamond pictograms.'
      },
      {
        title: 'Hazard Classes and Pictograms - GHS',
        subtitle: 'The 9 GHS Pictograms & Symbol Meanings',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=80',
        points: [
          'Flame: Flammable liquids, solvens, and spray paints.',
          'Flame Over Circle: Oxidizing liquids and gases.',
          'Corrosion: Causes skin burns and eye damage (acid cleaners).',
          'Skull & Crossbones: Acute toxicity (fatal or toxic).',
          'Health Hazard: Respiratory sensitizer, carcinogenicity, organ toxicity.'
        ],
        speakerText: 'GHS pictograms feature red diamond borders surrounding black symbols like Flame, Corrosion, and Skull & Crossbones.'
      },
      {
        title: 'Hazard Categories & Groups',
        subtitle: 'Physical Hazards vs Health Hazards',
        image: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&auto=format&fit=crop&q=80',
        points: [
          'Physical Hazards Group: Flammables, gases under pressure, self-reactive substances.',
          'Health Hazards Group: Acute toxicity, skin corrosion, eye irritation, carcinogenicity.',
          'Category Numbers: Category 1 represents highest severity hazard.'
        ],
        speakerText: 'Hazards are divided into Physical Hazards and Health Hazards. Category 1 indicates highest hazard severity.'
      },
      {
        title: 'Product Labels & Workplace Secondary Containers',
        subtitle: 'Supplier Labels vs Workplace Labels',
        image: 'https://images.unsplash.com/photo-1618042164219-62c820f10723?w=800&auto=format&fit=crop&q=80',
        points: [
          'Supplier Labels feature 6 required items: Product Name, GHS Pictograms, Signal Word, Hazard Statements, Precautionary Statements, Supplier ID.',
          'Workplace Labels MUST be affixed whenever transferring chemicals to secondary spray bottles.',
          'Secondary Workplace Labels require: Product Identifier, Safe Handling Precautions, Reference to SDS.'
        ],
        speakerText: 'Always affix a Workplace Label whenever decanting chemical solvents into secondary spray bottles.'
      },
      {
        title: 'Safety Data Sheets (SDS) & Worker Training',
        subtitle: '16 Standardized Sections & 24/7 Access',
        image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
        points: [
          'SDS binders or electronic access must be accessible to workers 24/7.',
          'Section 4: First-Aid Measures (eyewash, skin contact).',
          'Section 8: Exposure Controls & Personal Protection (PPE nitrile gloves, respirators).',
          'Worker Education: Annual WHMIS review mandatory for all staff.'
        ],
        speakerText: 'Safety Data Sheets feature sixteen uniform sections. Section 4 details first aid, while Section 8 specifies required PPE.'
      },
      {
        title: 'You\'re Done!',
        subtitle: 'Ready for WHMIS 2015 Examination',
        image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
        points: [
          'Congratulations! You have completed all WHMIS 2015 modules.',
          'Click Launch Quiz to complete the 25-question examination.',
          '100% Passing score required to earn your official WHMIS 2015 Certificate.'
        ],
        speakerText: 'You have completed WHMIS 2015 Awareness. Click Launch Quiz to take the test and earn your certificate.'
      }
    ],
    quiz: [
      { question: 'What border shape and color identifies WHMIS 2015 / GHS hazard pictograms?', options: ['Yellow Triangle', 'Red Diamond', 'Blue Circle', 'Black Square'], answer: 1, explanation: 'WHMIS 2015 pictograms feature a black symbol inside a Red Diamond border.' },
      { question: 'How long must you flush your eyes at an eyewash station after chemical contact?', options: ['2 minutes', '5 minutes', '15 continuous minutes', '30 seconds'], answer: 2, explanation: 'Emergency eyewash standards mandate flushing eyes for at least 15 continuous minutes.' },
      { question: 'What must be applied when transferring brake cleaner or solvent into a secondary spray bottle?', options: ['A price sticker', 'A Workplace Label', 'A shipping tag', 'Nothing is needed'], answer: 1, explanation: 'Workplace Labels are mandatory on all secondary containers.' }
    ]
  }
];
window.DEALERSHIP_TRAINING_COURSES = DEALERSHIP_TRAINING_COURSES;

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

    const sidebarItems = c.slides.map((sl, idx) => {
      const isActive = idx === slideIdx;
      const isDone = idx < slideIdx;
      return `
        <button onclick="stopSpeech(); openTrainingCourseModal('${c.id}', ${idx}, 'slides')" class="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${isActive ? 'bg-indigo-600 text-white font-bold' : isDone ? 'text-emerald-700 dark:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-800' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}">
          <span class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-white text-indigo-600' : 'border border-slate-400 text-slate-400'}">${isDone ? '✓' : idx + 1}</span>
          <span class="truncate">${esc(sl.title)}</span>
        </button>
      `;
    }).join('');

    const modalHtml = `
      <div class="flex flex-col h-[88vh] max-h-[850px] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 shadow-2xl">
        <div class="bg-[#00a2e8] text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold shadow-md flex-shrink-0">
          <div class="flex items-center gap-2">
            <button onclick="stopSpeech(); closeAutomationModal();" class="p-1 hover:bg-white/20 rounded transition text-base">☰</button>
            <button onclick="switchPage('people-compliance'); closeAutomationModal();" class="p-1 hover:bg-white/20 rounded transition">🏠</button>
            <span class="opacity-90">Me</span>
            <span>➔</span>
            <span class="font-extrabold tracking-wide">My Training Courses</span>
            <span class="opacity-80">(${esc(c.category)}: ${esc(c.title)})</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[11px] bg-white/20 px-2.5 py-0.5 rounded-full font-mono font-black">${pct}% COMPLETE</span>
            <button onclick="stopSpeech(); closeAutomationModal();" class="text-white hover:text-red-200 font-black text-base px-2 py-0.5 rounded hover:bg-white/10">✕</button>
          </div>
        </div>

        <div class="flex flex-1 min-h-0 overflow-hidden">
          <div class="w-64 bg-slate-900 text-white border-r border-slate-800 flex flex-col flex-shrink-0 overflow-y-auto">
            <div class="p-4 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 border-b border-slate-800 space-y-2">
              <div class="text-[10px] font-black uppercase text-indigo-400 tracking-wider">${esc(c.category)}</div>
              <h3 class="text-sm font-black text-white leading-tight">${esc(c.title)}</h3>
              <div class="space-y-1 pt-1">
                <div class="flex justify-between text-[10px] text-slate-400 font-bold">
                  <span>Progress</span>
                  <span>${slideIdx + 1}/${totalSlides} Lessons</span>
                </div>
                <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full bg-emerald-500 rounded-full transition-all" style="width: ${pct}%"></div>
                </div>
              </div>
            </div>

            <div class="p-2 space-y-1 flex-1 overflow-y-auto">
              ${sidebarItems}
              <button onclick="stopSpeech(); openTrainingCourseModal('${c.id}', 0, 'quiz')" class="w-full text-left px-3 py-2 rounded-lg text-xs font-black text-amber-300 hover:bg-amber-950/40 border border-amber-500/30 flex items-center gap-2 mt-3 transition">
                <span>❓</span><span>Launch 25-Question Test</span>
              </button>
            </div>
          </div>

          <div class="flex-1 flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 space-y-5">
            <div class="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <span class="text-[11px] font-bold text-slate-400">Lesson ${slideIdx + 1} of ${totalSlides}</span>
                <h1 class="text-2xl font-black text-slate-900 dark:text-white mt-0.5 leading-tight">${esc(s.title)}</h1>
                <p class="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-1">${esc(s.subtitle)}</p>
              </div>
            </div>

            <div class="bg-[#fdf2f2] dark:bg-rose-950/30 border border-[#f8b4b4] dark:border-rose-900/60 rounded-xl p-4 space-y-3 shadow-sm">
              <div class="flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200">
                <span class="text-base flex-shrink-0">ⓘ</span>
                <p class="leading-relaxed font-semibold">
                  Many of the lesson sections have playback audio that contain relevant information. Look for the audio files and click play to listen. The first playback audio is directly below.
                </p>
              </div>

              <div class="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-lg p-2.5 flex items-center justify-between gap-3 shadow-inner">
                <div class="flex items-center gap-2">
                  <button onclick="speakText(decodeURIComponent('${encodeURIComponent(fullSlideAudioText)}'))" class="w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center font-bold text-sm shadow transition">
                    ▶
                  </button>
                  <button onclick="stopSpeech()" class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs transition">
                    ⏸
                  </button>
                  <span class="text-xs font-bold text-slate-700 dark:text-slate-300">Click to play audio for ${esc(s.title)}</span>
                </div>
                <div class="text-[11px] font-mono text-slate-400">00:45 / TTS</div>
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
              ${s.image ? `
                <div class="w-full h-56 md:h-64 rounded-xl overflow-hidden shadow border border-slate-200 dark:border-slate-800 relative">
                  <img src="${esc(s.image)}" alt="${esc(s.title)}" class="w-full h-full object-cover">
                </div>
              ` : ''}

              <div class="space-y-3">
                <h3 class="text-base font-black text-slate-900 dark:text-white">${esc(s.title)}</h3>
                <div class="space-y-2.5">
                  ${s.points.map((pt, idx) => `
                    <div class="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                      <span class="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">${idx + 1}</span>
                      <span class="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">${esc(pt)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>

              <div class="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1 text-xs">
                <div class="font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <span>💡 Workplace Safety Guideline</span>
                </div>
                <p class="text-amber-900 dark:text-amber-200 leading-relaxed text-[11px]">${esc(s.speakerText)}</p>
              </div>
            </div>

            <div class="pt-2 flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
              <button onclick="stopSpeech(); openTrainingCourseModal('${c.id}', ${slideIdx - 1}, 'slides')" class="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition ${slideIdx === 0 ? 'opacity-40 pointer-events-none' : ''}">
                ← Previous Lesson
              </button>

              ${slideIdx < totalSlides - 1 ? `
                <button onclick="stopSpeech(); openTrainingCourseModal('${c.id}', ${slideIdx + 1}, 'slides')" class="px-5 py-2 rounded-xl bg-[#00a2e8] hover:bg-cyan-500 text-white font-black text-xs shadow transition flex items-center gap-1.5">
                  <span>Next Lesson (${slideIdx + 2}/${totalSlides})</span><span>→</span>
                </button>
              ` : `
                <button onclick="stopSpeech(); openTrainingCourseModal('${c.id}', 0, 'quiz')" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow transition flex items-center gap-1.5">
                  <span>❓ Launch 25-Question Quiz</span><span>→</span>
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
    automationModal(modalHtml, 'max-w-5xl');

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
            <div class="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xl">📝</div>
            <div>
              <h3 class="text-base font-black text-slate-900 dark:text-white leading-tight">${esc(c.title)}</h3>
              <p class="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">Official Health &amp; Safety Compliance Examination</p>
            </div>
          </div>
          <button onclick="closeAutomationModal()" class="text-slate-400 hover:text-slate-600 text-lg font-bold p-1">✕</button>
        </div>

        <div class="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-2">
          <span class="text-lg">⚠️</span>
          <span>100% Passing Score (${totalQuestions}/${totalQuestions} Correct) is required to earn your official Canadian Dealership Health &amp; Safety Diploma. Answer all questions below.</span>
        </div>

        <div class="space-y-4">
          ${quizHtml}
        </div>

        <div class="pt-3 sticky bottom-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md p-3 border-t border-slate-200 dark:border-slate-800 rounded-b-2xl flex items-center justify-between gap-3 shadow-lg">
          <button onclick="openTrainingCourseModal('${c.id}', ${c.slides.length - 1}, 'slides')" class="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            ← Back to Lessons
          </button>
          <button onclick="submitTrainingCourseQuiz('${c.id}')" class="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-600/30 transition flex items-center gap-2">
            <span>Submit Test &amp; Grade</span><span>✓</span>
          </button>
        </div>
      </div>
    `;
    automationModal(modalHtml, 'max-w-3xl');
  }
}
window.openTrainingCourseModal = openTrainingCourseModal;

function renderPeopleComplianceTab(body, employees) {
  let completedMap = {};
  try { completedMap = JSON.parse(localStorage.getItem('ms_completed_courses') || '{}'); } catch {}

  const categories = ['Health & Safety', 'Human Resources', 'WHMIS'];
  const categorySections = categories.map(catName => {
    const catCourses = DEALERSHIP_TRAINING_COURSES.filter(c => c.category === catName);

    const rows = catCourses.map(c => {
      const isDone = !!completedMap[c.id];
      const compDate = isDone ? (completedMap[c.id].date || '05/20/2026') : '-';
      const score = isDone ? (completedMap[c.id].score || '100%') : '-';

      return `
        <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition text-xs">
          <td class="py-3 px-4 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer" onclick="openTrainingCourseModal('${c.id}')">
            ${esc(c.title)}
          </td>
          <td class="py-3 px-4 text-slate-500 font-mono">${esc(c.duration)}</td>
          <td class="py-3 px-4">
            ${isDone ? `<span class="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">✓ ${esc(compDate)}</span>` : `<span class="text-slate-400">-</span>`}
          </td>
          <td class="py-3 px-4">
            ${isDone ? `<span class="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">✓ ${esc(compDate)}</span>` : `<span class="text-slate-400">-</span>`}
          </td>
          <td class="py-3 px-4 font-bold ${isDone ? 'text-slate-900 dark:text-white' : 'text-slate-400'}">${esc(score)}</td>
          <td class="py-3 px-4 text-center">
            <button onclick="openTrainingCourseModal('${c.id}', 0, 'slides')" title="Launch Course" class="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center justify-center shadow transition">
              ▶
            </button>
          </td>
          <td class="py-3 px-4 text-center">
            <button onclick="openTrainingCourseModal('${c.id}', 0, 'quiz')" title="Launch Quiz" class="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs inline-flex items-center justify-center transition">
              ❓
            </button>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm space-y-0">
        <div class="bg-slate-100/90 dark:bg-slate-800/80 px-4 py-3 font-black text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div class="flex items-center gap-2">
            <span class="text-indigo-600 dark:text-indigo-400">▾</span>
            <span>${esc(catName)}</span>
          </div>
          <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">✓ Active Compliance</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider bg-slate-50/50 dark:bg-slate-950/50">
                <th class="py-2.5 px-4">Title</th>
                <th class="py-2.5 px-4">Duration</th>
                <th class="py-2.5 px-4">Date Course Completed</th>
                <th class="py-2.5 px-4">Quiz Date Passed</th>
                <th class="py-2.5 px-4">Final Quiz Score</th>
                <th class="py-2.5 px-4 text-center">Launch Course</th>
                <th class="py-2.5 px-4 text-center">Launch Quiz</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  body.innerHTML = `
    <div class="space-y-6">
      <div class="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div>
          <h2 class="text-xl font-black text-slate-900 dark:text-white leading-tight">DealerPilot Compliant Health &amp; Safety Academy</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Mandatory Canadian dealership compliance, WHMIS 2015 GHS, and OHSA employee training requirements.</p>
        </div>
        <span class="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-black border border-emerald-300">✓ DealerPilot Synchronized</span>
      </div>

      <div class="space-y-5">
        ${categorySections}
      </div>
    </div>
  `;
}
window.renderPeopleComplianceTab = renderPeopleComplianceTab;
