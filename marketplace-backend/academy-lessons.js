/**
 * The lessons inside each course.
 *
 * `academy-curriculum.js` says which courses exist and who has to take them. Until this
 * file existed, that was the whole Academy: 32 course records, every one with no content,
 * so somebody could be assigned "Credit applications and privacy law", be blocked from a
 * certification until they completed it, and have nothing at all to open.
 *
 * Checked in for the same reason the curriculum is — it has to be reviewable in a diff,
 * and CI has no database. `scripts/academy-sync.mjs` pushes it into
 * `staff_training_lessons` as global rows (`dealership_id = null`).
 *
 * TWO KINDS, and the distinction is the point:
 *
 *   lesson      — something to read. It teaches the thing.
 *   checkpoint  — something to GO AND DO in MarketSync. Reading about a repair order is
 *                 not the same as opening one, and a course made only of reading
 *                 produces people who have "completed training" and cannot do the job.
 *
 * Every course ends on a checkpoint for that reason.
 *
 * The bodies are deliberately written about how MarketSync ACTUALLY behaves — the states
 * a repair order really moves through, the refusals the software really makes — because
 * training that describes an idealised product is training somebody has to unlearn.
 */

const l = (lesson_key, title, estimated_minutes, summary, body) =>
  ({ lesson_key, title, estimated_minutes, summary, body, kind: 'lesson' })

const cp = (lesson_key, title, estimated_minutes, summary, body) =>
  ({ lesson_key, title, estimated_minutes, summary, body, kind: 'checkpoint' })

export const LESSONS = {

  // ══ Everyone ═══════════════════════════════════════════════════════════════
  ms_getting_started: [
    l('my_day', 'My Day is where you start', 3,
      'Every role lands on a My Day, and it is a to-do list rather than a report.',
      `Signing in puts you on your own My Day — Sales reps get the Sales one, advisors get Service, managers get the store-wide one. It leads with what needs you: customers waiting, jobs blocked, approvals outstanding. It is deliberately not a wall of numbers, because a number you cannot act on is not work.\n\nIf something on My Day says it could not be loaded, believe it. MarketSync says when a read failed rather than showing you a calm empty screen, because a quiet zero is how people miss things.`),
    l('workspaces', 'Your department, and its tabs', 4,
      'One header per department, and no second row of tabs underneath it.',
      `Each department is a workspace with a single row of tabs across the top: My Day first, then the places you do the work, then Settings. There is never a second row of tabs inside a tab — anything a tab holds is stacked in it under headings you scroll to.\n\nThe sidebar lists departments, not features. You navigate the dealership, not our software architecture.`),
    l('finding_things', 'Finding a customer or a vehicle', 3,
      'One customer record, one vehicle record, reached from anywhere.',
      `A customer exists once. Sales, Service and F&I all attach to the same record, which is why a repair order can see that the person bought the car from you two years ago. The same is true of a vehicle: appraisal, recon, pricing and publishing are all views of one unit.\n\nIf you find yourself creating a second record for somebody who is already in the system, stop — the duplicate is what breaks the history.`),
    cp('open_your_day', 'Open your My Day and clear one thing', 5,
      'Do the smallest real piece of work in the product.',
      `Open My Day, find the top item in "Needs attention", and action it. If there is nothing there, open your department's main tab and look at what is in it.\n\nThe point is that you have now used the product to do a real thing, rather than read about it.`),
  ],

  ms_privacy_basics: [
    l('why_consent', 'Why consent is not paperwork', 4,
      'Contacting somebody who has not agreed to it is a legal problem, not a style choice.',
      `Anti-spam and privacy law in most of North America treats an unsolicited commercial message as an offence with real penalties, and "we had their number" is not a defence. Consent has to have been given, and you have to be able to show when and how.\n\nMarketSync records consent against the customer, which is why some sends are refused. That refusal is protecting the dealership.`),
    l('what_you_may_collect', 'What you may collect, and what you may not', 5,
      'Collect what the job needs. Everything else is a liability you are storing.',
      `You need what the transaction requires — identity to sell a car, a licence to let somebody drive one, financial detail to submit a credit application. You do not need, and should not be typing in, information nobody asked for.\n\nSensitive fields in MarketSync are gated separately: compensation, credit applications and identity documents each need their own permission, and several need a verified MFA session on top. That is not friction for its own sake — it means a leaked password is not a leaked filing cabinet.`),
    l('when_refused', 'When the software refuses you', 4,
      'A refusal is a message about the state of the record, not an error to route around.',
      `If a message will not send, the usual reason is that the customer has not consented, or has withdrawn consent. If a document will not open, the usual reason is that it is not shared with you. In both cases the right move is to fix the underlying fact, not to find another way to do it.\n\nWorking around a control is the single fastest way to turn a compliance system into theatre.`),
    cp('check_a_customer', 'Check a real customer record for consent', 4,
      'Look at where consent actually lives.',
      `Open any customer in Customers and find their contact preferences and communication history. Note what is recorded and what is not.\n\nIf you cannot tell from the record whether you may text that person, that is exactly the gap this course exists to close.`),
  ],

  // ══ Sales ══════════════════════════════════════════════════════════════════
  sales_crm_basics: [
    l('the_record', 'The customer record', 4,
      'One person, one record, and everything hangs off it.',
      `A customer carries their contact detail, their vehicles, their deals, their repair orders and every message either way. It is not a Sales object that Service borrows — it is the dealership's record of that person.\n\nWhen you assign a customer to yourself you are taking responsibility for their follow-up, and the system will hold you to it.`),
    l('assignment', 'Assignment and ownership', 4,
      'An unassigned customer is nobody\'s customer.',
      `Every lead should have an owner. MarketSync routes new leads by whatever rule the store has set, and an unrouted lead sits visibly in the queue rather than quietly aging.\n\nIf you take over somebody's customer, reassign the record. The follow-up tasks and the commission both key off the assignment, so leaving it stale gets somebody paid wrongly.`),
    l('keeping_it_fresh', 'A book that does not go stale', 5,
      'Pipeline stages mean something only if you move them.',
      `Uncontacted, Contacted, Appointment, Sold, Delivered is a sequence of facts, not a mood. A customer sitting in "Contacted" for three weeks is telling you either that they are cold or that you have stopped working them, and either is worth knowing.\n\nUse tasks rather than memory. A task with a due date survives your day off; an intention does not.`),
    cp('work_your_book', 'Work three customers to their next stage', 6,
      'Move real records, not example ones.',
      `Open Customers, sort by oldest contact, and take three people to their genuine next step: call, book, or mark them cold with a reason.\n\nMarking somebody cold honestly is a legitimate outcome. Leaving them ambiguous is not.`),
  ],

  sales_lead_workflow: [
    l('lead_arrives', 'What happens when a lead arrives', 4,
      'Where leads come from and what the system does before you see one.',
      `Leads arrive from your website, Facebook, the AI chat and phone integrations. MarketSync creates or matches the customer record, applies your routing rule, and raises the follow-up task.\n\nMatching matters: a returning shopper should land on their existing record, with their history, rather than becoming a stranger.`),
    l('speed', 'Why the first hour decides it', 4,
      'Response time is the single most predictive number in a sales department.',
      `The industry evidence is unusually consistent: contact attempts inside the first hour convert dramatically better than attempts the next day, and most of that advantage is gone by the afternoon. This is not a MarketSync opinion, it is what the data says.\n\nMy Day puts waiting leads at the top for exactly this reason.`),
    l('ownership', 'Who owns it, and what that means', 4,
      'Owning a lead means owning the outcome, including the "no".',
      `The owner is responsible for contacting, qualifying, booking and recording what happened. "No answer" is a result to log, not a reason to leave the record untouched.\n\nA lead nobody has recorded an outcome on will keep appearing on somebody's My Day, which is the system working correctly.`),
    cp('take_a_lead', 'Take a live lead end to end', 6,
      'One lead, from arrival to a recorded outcome.',
      `Claim a waiting lead, make the contact attempt, and record what actually happened — booked, no answer, not in market. Set the next task if there is one.\n\nThe record should now let somebody else pick this customer up cold and know exactly where things stand.`),
  ],

  sales_appraisal: [
    l('taking_one', 'Taking an appraisal', 5,
      'VIN in, condition honestly stated, numbers that mean something.',
      `The appraisal page decodes the VIN, pulls specs and gives you live market value. Your job is condition and recon: an optimistic condition grade produces a number the store cannot honour, and somebody has to explain that to the customer later.\n\nRecon and target gross come from store defaults so appraisals are consistent between salespeople.`),
    l('reading_market', 'What the market number is telling you', 5,
      'Retail value, comparable supply, and what "days to sell" actually means.',
      `The market value is drawn from comparable live listings, not from a book — it is what similar cars are currently advertised at near you. Supply matters as much as price: a common car at a good price still sits if forty of them are listed within your radius.\n\nDays-to-sell is the number to respect. A vehicle you will hold for ninety days costs you money every one of them.`),
    l('handing_over', 'Handing it to Inventory cleanly', 4,
      'An appraisal becomes a unit, and the handover is where detail gets lost.',
      `When the trade comes in, the appraisal should become an inventory record with its condition notes and recon estimate intact. Recon does not want to rediscover the tyres.\n\nThe unit is not saleable until it has been through cleanup and merchandised, so the sooner it is in the system the sooner that clock starts.`),
    cp('appraise_one', 'Appraise a real vehicle', 6,
      'Use the appraisal tool on something actually in front of you.',
      `Open Inventory → Appraisals and take a full appraisal on a real car: VIN, condition, recon, target gross. Save it and produce the customer summary.\n\nIf the number surprises you, that is the lesson — look at what the comparable listings are doing.`),
  ],

  sales_video: [
    l('why_video', 'Why a walkaround gets opened', 4,
      'Video is a trust device, not a production exercise.',
      `A short personal video outperforms a polished generic one because it proves a specific human is dealing with the customer. Thirty to ninety seconds, their name in the first sentence, the car behind you.\n\nThe production value that matters is audio. Wind noise loses more viewers than poor lighting.`),
    l('what_to_show', 'What to show, and what to say', 5,
      'Cover the things a photo cannot answer.',
      `Photos already show the paint. Video should answer the questions photos leave: how the interior smells of nothing, the service history in your hand, the tyre tread, the panel gap they will ask about anyway.\n\nName the flaw yourself. A customer who finds it after you did not mention it stops believing everything else you said.`),
    l('reading_watch_data', 'Reading the watch data honestly', 5,
      'Watch time tells you about your video, not about their intent.',
      `A high drop-off in the first ten seconds is an opening problem. A drop at forty seconds usually means you started narrating rather than showing. Completed views on a long video mean genuine interest.\n\nWhat watch data does not tell you is whether they are buying. Treat it as feedback on your craft.`),
    cp('record_one', 'Record and send one walkaround', 6,
      'Send it to a real customer with a real question.',
      `Record a walkaround for a customer who is actually considering that unit and send it. Watch what the engagement does.\n\nOne real send teaches more than any amount of theory about ideal length.`),
  ],

  sales_pipeline_advanced: [
    l('volume_problem', 'The volume problem', 5,
      'Past a certain book size, memory stops working and process starts.',
      `A rep can hold maybe forty relationships in their head. Beyond that, people get dropped — and the ones dropped are disproportionately the slow-burn buyers who were worth the most.\n\nThe fix is not working harder. It is making the system remember for you.`),
    l('sequencing', 'Sequencing follow-up', 6,
      'Cadence that respects the customer and survives your week off.',
      'A sequence is a planned series of touches with sensible gaps — not five messages in three days. Aggressive cadence produces unsubscribes and complaints, and in most jurisdictions the complaint is a legal matter.\n\nBuild sequences that a human would not resent receiving, and let the system hold the schedule.'),
    l('honest_forecast', 'Forecasting without lying to yourself', 6,
      'A forecast built on optimistic stages is worse than no forecast.',
      `A pipeline is only predictive if the stages mean what they say. If "Appointment" includes people who have not confirmed, your forecast is fiction and your manager will plan staffing on it.\n\nMove a deal forward when the customer does something, not when you feel good about the conversation.`),
    cp('audit_your_pipeline', 'Audit your own pipeline for honesty', 7,
      'Find the deals that are further along on screen than in reality.',
      `Go through your pipeline and move anything that is overstated back to where it truly is. Count how many you moved.\n\nThat number is how wrong your forecast was, and it is the most useful thing you will learn this week.`),
  ],

  // ══ Inventory ══════════════════════════════════════════════════════════════
  inv_import: [
    l('ways_in', 'The ways a vehicle gets in', 4,
      'Feed, import, trade or purchase — four doors, one pool.',
      `Inventory arrives from a website feed, a CSV import, a customer trade or a direct purchase. However it arrives it lands in one pool; there is not a "feed inventory" and a "real inventory".\n\nKnowing which door a unit came through matters, because feed data is only as good as the source and trades carry condition history the feed never will.`),
    l('what_to_check', 'What to check before you trust it', 5,
      'A synced number is not a verified number.',
      `After an import, check the count against what is physically on the lot, and check that VINs decoded to the right trim. A feed that silently drops units is a feed that makes your lot look smaller than it is.\n\nMileage and price are the two fields most often wrong on arrival, and both change what a shopper sees.`),
    l('possession', 'Possession versus listed', 4,
      'A car you have not got yet should not be advertised as if you have.',
      `MarketSync distinguishes vehicles you have taken possession of from ones you have committed to. Advertising a unit you cannot show is how a lead becomes a complaint.\n\nMark possession when the car is physically yours, not when the deal is agreed.`),
    cp('import_and_verify', 'Import and reconcile against the lot', 6,
      'Make the system agree with reality.',
      `Run a sync or import, then walk the difference: anything in the system that is not on the lot, and anything on the lot that is not in the system.\n\nThe gap you find is the gap your advertising has been running on.`),
  ],

  inv_merchandising: [
    l('photos', 'Photos decide the click', 5,
      'The number and quality of photos is the strongest lever you control.',
      `Listings with a full set of photos get materially more engagement than thin ones, and a listing with fewer than about eight photos reads as something being hidden. Shoot the interior, the odometer, the tyres and any flaw.\n\nMarketSync flags thin listings before they go live for exactly this reason.`),
    l('description', 'A description that answers questions', 5,
      'Write what the buyer wants to know, not what the feed emitted.',
      `Generic feed text tells a shopper nothing. Name the trim, the options that matter, the service history, and why this particular car is worth the drive.\n\nIf the description could be pasted onto any other unit of that model, it is not doing any work.`),
    l('the_checks', 'The merchandising checks', 4,
      'What blocks a vehicle from the front line, and why.',
      `MarketSync checks each unit for photos, price, description and required detail, and groups what is missing. A unit that fails is not hidden — it is listed as blocked, with the specific gap named.\n\nFix the gap rather than overriding the check. The check is a proxy for whether a shopper can make a decision.`),
    cp('fix_three', 'Take three blocked units to frontline ready', 7,
      'Clear real merchandising gaps.',
      `Open Inventory, find units flagged as blocked or thin, and fix three of them properly — photos, description, price.\n\nThen look at what those three did over the following week.`),
  ],

  inv_pricing: [
    l('market_position', 'Reading your market position', 6,
      'Where you sit against live comparable supply.',
      `Price position is relative: being at $24,000 means nothing until you know the eleven comparable cars near you are between $22,500 and $26,000. MarketSync reads live comparable listings rather than a book value.\n\nBeing third-cheapest with more photos beats being cheapest with four.`),
    l('aging', 'Aging costs money quietly', 6,
      'Every day a unit sits has a cost, and it compounds.',
      `Floorplan interest, depreciation and opportunity cost run whether the car moves or not. The industry rule of thumb is that a unit past sixty days is losing money faster than most stores admit, and past ninety it is usually a wholesale decision.\n\nActing at thirty is cheap. Acting at ninety is expensive. The whole discipline is acting earlier than feels comfortable.`),
    l('defending_price', 'Defending a price', 5,
      'A price you can explain is a price you can hold.',
      `If the unit is above market, you need the reason ready: lower mileage, better history, a trim difference, condition. Say it before the customer asks.\n\nIf you cannot articulate the reason, the price is not defensible and you are about to discount it anyway — better to price it right and sell it sooner.`),
    cp('reprice_aged', 'Reprice the oldest three units', 7,
      'Make an aging decision with real numbers.',
      `Find your three oldest units, look at their live market position, and make a decision on each: reprice, re-merchandise, or wholesale. Record why.\n\n"Leave it" is allowed, but it must be a decision with a reason, not a default.`),
  ],

  inv_syndication: [
    l('where_they_go', 'Where your vehicles appear', 4,
      'The channels, and what each one wants.',
      `Your units go to your website, Facebook Marketplace and whatever third-party sites you subscribe to. Each has its own rules about photos, description length and what counts as a valid listing.\n\nA unit that is fine on your site can be rejected elsewhere for a reason that has nothing to do with the car.`),
    l('why_it_fails', 'Why a listing fails', 5,
      'A rejection is information, and it is usually specific.',
      `Failures cluster: missing photos, a price of zero, a VIN that will not decode, an account that has lost authorisation. MarketSync surfaces the provider's own reason rather than the word "failed", because "failed" tells you nothing about whether to retry, fix or give up.\n\nRe-posting without reading the reason usually fails the same way.`),
    l('facebook', 'Facebook Marketplace specifically', 5,
      'The highest-volume channel, and the fussiest.',
      `Facebook is where a great deal of used-car shopping now starts, and its rules change without notice. Posting the same vehicle repeatedly, or in ways that look automated, risks the account rather than the listing.\n\nTreat the account as the asset. A suspended account costs more than any single listing.`),
    cp('fix_a_failure', 'Diagnose one failed publication', 6,
      'Read the real reason and act on it.',
      `Find a vehicle that failed to publish, read the provider's stated reason, fix that specific thing, and republish.\n\nIf it fails again for a different reason, that is progress — you eliminated the first one.`),
  ],

  // ══ F&I ════════════════════════════════════════════════════════════════════
  fni_credit_compliance: [
    l('what_you_collect', 'What a credit application actually contains', 6,
      'Some of the most sensitive information the dealership will ever hold.',
      `A credit application carries date of birth, government identifiers, income, employment and address history. In the wrong hands it is enough to open accounts in somebody's name.\n\nThis is why MarketSync gates it behind its own permission and a verified MFA session, and why it is not visible to Sales.`),
    l('who_may_see', 'Who may see it', 5,
      'Need to know, enforced by the system rather than by convention.',
      `F&I needs the application. A salesperson does not, even the one who sold the car. The rule is not about trust, it is about limiting how many people a breach exposes.\n\nIf you find yourself reading somebody else's application out of curiosity, that is the behaviour the audit trail exists to catch.`),
    l('what_is_recorded', 'What must be recorded', 5,
      'Consent, disclosure and the trail that proves both.',
      `You need a record that the customer consented to the credit pull, what disclosures were given, and when. If a regulator asks in two years, the record is the only thing that will answer.\n\nMarketSync keeps one canonical application per deal for this reason — a second copy means two different answers to the same question.`),
    cp('walk_an_application', 'Walk a live application end to end', 7,
      'From the deal, through submission, to the recorded decision.',
      `Open a real deal, start its credit application, and follow it through submission and the lender decision. Note where consent is captured and where the decision is stored.\n\nIf you had to hand this file to a compliance auditor, could you?`),
  ],

  fni_funding: [
    l('contract_to_funded', 'From contract to funded', 6,
      'The journey the money takes, and where it stalls.',
      `A signed contract is not money. The lender has to receive a complete package, approve it, and fund. Between those points the dealership has delivered a car and been paid nothing.\n\nMarketSync tracks funding as its own canonical state — pending, submitted, conditions, exception, funded — rather than guessing from whether a contract was signed.`),
    l('what_lenders_want', 'What a lender needs from you', 5,
      'Complete packages fund. Incomplete ones age.',
      `Most funding delays are missing documents: a stipulation not met, proof of income, a signature in the wrong place. The lender will not chase you, and every day of delay is your money sitting with them.\n\nSubmit complete or expect conditions.`),
    l('cit', 'Why Contracts in Transit is the number to watch', 6,
      'The clearest measure of money owed to the dealership.',
      `Contracts in Transit is what lenders owe you on cars you have already delivered. It is a receivable, and it ages exactly like any other. A growing CIT balance with growing age is a funding process that has stopped working.\n\nMarketSync deliberately keeps it separate from customer receivables. Conflating what a lender owes with what a customer owes hides both problems.`),
    cp('clear_one', 'Clear one aged contract', 7,
      'Find the oldest unfunded deal and move it.',
      `Open Accounting → My Day → Contracts in transit, take the oldest item, find out exactly what the lender is waiting for, and supply it.\n\nWrite down how long it had been sitting. That is the cost of the gap you just closed.`),
  ],

  fni_products: [
    l('what_they_are', 'What the products actually do', 5,
      'You cannot sell honestly what you cannot explain plainly.',
      `Warranty, GAP, protection packages — each covers a specific risk with specific exclusions. A customer who buys something they do not understand cancels it, complains about it, or discovers the exclusion at the worst possible moment.\n\nBe able to say in one sentence what each product covers and what it does not.`),
    l('presenting', 'Presenting without pressure', 6,
      'A menu presented consistently to everybody is both fairer and more defensible.',
      `Presenting the same menu to every customer, in the same order, at the same point, protects the dealership from claims of discriminatory pricing and protects the customer from a pitch calibrated to how they look.\n\nIt also happens to sell more, because consistency beats improvisation.`),
    l('disclosure', 'The disclosures that keep it defensible', 6,
      'Price, term, what it covers, and that it is optional.',
      `Every product needs its price stated separately, its term clear, and the fact that it is optional made explicit. A product bundled invisibly into a payment is the single most common source of F&I complaints and regulatory action.\n\nIf the customer cannot tell you afterwards what they bought and what it cost, the disclosure failed regardless of what the paperwork says.`),
    cp('present_a_menu', 'Present a full menu on a live deal', 7,
      'Do it the same way you would for anybody.',
      `Take a real deal to the menu presentation, present every product with its price and term, and record the customer\'s decisions including the declines.\n\nA recorded decline protects you later just as much as a sale does.`),
  ],

  // ══ Service ════════════════════════════════════════════════════════════════
  svc_appointments: [
    l('booking', 'Booking that the shop can work with', 5,
      'What has to be captured at booking time.',
      `A booking needs the customer, the vehicle, what is wrong in their words, and a realistic time. "Service" as a complaint tells the technician nothing and guarantees a diagnostic conversation at the counter.\n\nThe customer\'s own description of the symptom is worth more than your translation of it.`),
    l('arrival', 'Arrival and check-in', 5,
      'Check-in is the moment a booking becomes a repair order.',
      `When the customer arrives you check them in, which resolves the canonical customer and vehicle, carries the concern forward, and opens exactly one repair order. MarketSync makes this idempotent on purpose — two advisors checking the same person in produce one RO, not two.\n\nMileage at check-in matters. It drives warranty eligibility and the next service interval.`),
    l('promise_time', 'The promise time', 4,
      'The number the customer will judge you by.',
      `Everything else can go well and a missed promise time will still define the visit. Promise what the shop can do, not what the customer wants to hear.\n\nIf it changes, tell them before they find out by waiting.`),
    cp('check_one_in', 'Check a customer in properly', 6,
      'Take a real arrival from appointment to open RO.',
      `Find a booked appointment, check the customer in, and confirm the RO carries the concern, the mileage and the vehicle correctly.\n\nOpen the RO afterwards and read it as a technician would. Is there enough there to start?`),
  ],

  svc_ro_workflow: [
    l('the_states', 'The states an RO moves through', 6,
      'Twelve canonical states, and the database owns them.',
      `A repair order moves: appointment, checked in, inspection, estimate sent, customer approved or declined, parts ordered, in progress, quality check, ready, delivered, closed. Those are the real states — not a status field somebody types into.\n\nMarketSync will not let you make an illegal move. The screen asks the database what is legal from where you are and only offers that, so you cannot skip authorisation by accident.`),
    l('who_moves_it', 'Who may move it', 5,
      'The desk and the bench have different permissions, deliberately.',
      `An advisor works the desk: estimates, customer contact, closing. A technician works their assigned lines: start, complete, block. The same SERVICE role covers both, and what you can do is decided by whether you hold the workflow permission — not by a job title.\n\nBlocking a job requires a reason. A job that silently stalls is a car nobody is working on and nobody knows it.`),
    l('authorization_first', 'Why authorisation comes before work', 6,
      'Work done without authorisation is work you may not be paid for.',
      `The customer has to approve the estimate before the work happens. This is not a formality: unauthorised work is frequently unrecoverable, and in many jurisdictions charging for it is unlawful.\n\nThe state machine enforces the order for you. If it will not let you start, that is the reason.`),
    l('closing', 'Closing is a financial act', 5,
      'Closing an RO draws parts from stock and posts to the books.',
      `Closing consumes the parts, writes the journal, and states how the job was settled — paid in full, warranty, internal, goodwill, or carried as a receivable. MarketSync refuses an implicit balance because "we will sort it out later" is how a shop loses money it already earned.\n\nAnd once it is closed, the customer gets a call. That follow-up is created automatically.`),
    cp('run_one_ro', 'Take one RO from check-in to closed', 8,
      'The whole chain, on a real job.',
      `Take a repair order through every state you legitimately can today. Note where the system refused you and why.\n\nEach refusal you hit is a control doing its job — understand it rather than working around it.`),
  ],

  svc_authorization: [
    l('good_estimate', 'An estimate that holds up', 6,
      'Specific, priced, and in language the customer understands.',
      `An estimate that says "brakes — $900" invites an argument. One that lists pads, rotors, labour hours and the reason each is needed does not. Specificity is what makes the number defensible.\n\nInclude what you are NOT doing, if you inspected it and it is fine. That is where trust comes from.`),
    l('capturing_it', 'Capturing authorisation properly', 5,
      'Who approved, what they approved, and when.',
      `Authorisation needs to be recorded against the repair order with a timestamp. A verbal "yes" that nobody wrote down is worth nothing when the invoice is disputed.\n\nMarketSync records authorisations as their own records against the RO, including partial approvals.`),
    l('job_changes', 'When the job changes mid-repair', 6,
      'A new problem needs a new authorisation. Every time.',
      `Discovering a second fault does not extend the first authorisation. Stop, quote it, get approval, then continue. Doing the work first and explaining later is the most common cause of an unpaid invoice and a lost customer.\n\nIf you cannot reach them, do the authorised work and park the rest.`),
    cp('authorize_one', 'Build and get one estimate approved', 7,
      'Do it properly on a live job.',
      `Build an estimate on a real repair order with the work itemised, send it, and record the customer\'s decision — including any lines they declined.\n\nA recorded decline is as valuable as an approval when somebody asks in six months why the tyres were not done.`),
  ],

  svc_fixed_ops: [
    l('dispatch', 'Dispatch is the whole game', 6,
      'Matching the right job to the right technician at the right time.',
      `Dispatch decides shop throughput more than technician skill does. A diagnostic job on your fastest lube technician wastes both. A stack of unassigned approved work means the bottleneck is the desk, not the bench.\n\nApproved work with no technician assigned is the first thing to look at every morning.`),
    l('elr', 'Effective labour rate', 6,
      'What you actually earn per hour sold, not what you advertise.',
      `Your posted rate is not your effective rate. Discounts, warranty rates, internal work and comebacks all pull it down. Effective labour rate is total labour revenue over hours sold, and it is usually a surprise the first time somebody calculates it.\n\nSmall discounts applied habitually do more damage than occasional large ones.`),
    l('lost_hours', 'Where a shop quietly loses hours', 6,
      'Waiting on parts, waiting on approval, and rework.',
      `The three big leaks are the same in almost every shop: technicians waiting for parts, jobs waiting on customer approval, and comebacks. None of them show up as an obvious problem — they show up as a shop that feels busy and does not make money.\n\nMarketSync surfaces parts-blocked and awaiting-approval as first-class attention items because they are the leaks you can actually close.`),
    cp('measure_a_leak', 'Measure one leak for a week', 8,
      'Count something you currently guess at.',
      `Pick one: hours lost to parts, or jobs sitting in "estimate sent". Track it for a week using the workspace rather than intuition.\n\nBring the number to your next department meeting. A measured leak gets fixed; a felt one gets discussed.`),
  ],

  // ══ Parts ══════════════════════════════════════════════════════════════════
  parts_workflow: [
    l('the_request', 'From a request to a part on the bench', 5,
      'The four states a parts request moves through.',
      `A request is raised, reserved against stock, issued to the job, and fulfilled. If there is nothing on the shelf it goes on backorder, which is a real answer rather than a failure.\n\nReserving short is normal: MarketSync will reserve what it has and backorder the rest rather than refusing the whole request.`),
    l('who_asks', 'Not every request comes from Service', 5,
      'The counter, Sales and internal jobs are real demand too.',
      `A customer buying a filter over the counter, a salesperson needing a mat for a delivery, and a technician on a repair order are all asking Parts for something. Each request states which department it is for.\n\nOnly a Service request belongs to a repair order — the system enforces that, because a counter sale with an invented RO number corrupts the job costing.`),
    l('ledger', 'Keeping the stock ledger honest', 6,
      'Quantities move through transactions, never by editing a number.',
      `Every movement — receive, reserve, issue, return, adjust — writes a ledger entry and moves the balance atomically. You cannot type a new on-hand figure, and that is deliberate: a hand-edited quantity destroys the audit trail that tells you where stock went.\n\nRemoving stock requires a reason. "Miscount" is a legitimate reason; no reason is not.`),
    cp('fulfil_one', 'Fulfil one request end to end', 6,
      'Reserve, issue, and watch the stock move.',
      `Take a live parts request, reserve it, issue it to the job, and then look at the part\'s on-hand and available figures before and after.\n\nAvailable is on-hand minus reserved, and the server calculates it. If those numbers ever look wrong, the ledger will tell you why.`),
  ],

  parts_inventory: [
    l('reorder', 'Reorder points that mean something', 5,
      'The number below which you are about to disappoint somebody.',
      `A reorder point should reflect how fast the part moves and how long it takes to arrive. Set it too low and jobs wait; too high and you are financing a shelf.\n\nParts with no reorder point set will never warn you, which is the most common reason a shop runs out of something obvious.`),
    l('receiving', 'Receiving properly', 5,
      'The moment stock becomes real.',
      `Receiving is a real transaction: it writes the ledger, raises on-hand, and clears the shortage that was blocking a job. Receiving into the system days after the box arrived means the shop was told it had nothing while the part sat on the counter.\n\nReceive when it physically arrives.`),
    l('counts', 'Counts and the truth', 5,
      'A stock figure nobody has verified is a guess with a decimal point.',
      `Cycle counting a small number of parts frequently beats a full count once a year, because you find and fix the drift while you can still remember the cause.\n\nWhen a count disagrees with the system, adjust with a reason rather than silently overwriting. The reason is the data.`),
    cp('count_a_bin', 'Count one bin and reconcile it', 6,
      'Find out how accurate your stock actually is.',
      `Physically count one bin, compare against the system, and adjust any differences with an honest reason.\n\nThe size of the gap tells you how much to trust every other number in the catalogue.`),
  ],

  // ══ Accounting ═════════════════════════════════════════════════════════════
  acct_posting: [
    l('what_posts', 'Which business events post', 6,
      'The books are written by what the dealership does, not by typing.',
      `Delivering a deal, closing a repair order, paying a bill — each emits an event, and the Accounting engine posts the balanced journal for it. Nobody keys those entries by hand.\n\nThis is why the operational states matter so much: a repair order that is never closed is revenue that never reaches the books.`),
    l('posted_means', 'What "posted" means', 5,
      'Posted is financial truth. A draft is not.',
      `A posted journal is included in every balance, report and trial balance. A draft is excluded from all of them. MarketSync shows drafts clearly labelled as not being financial truth, because a draft that looks posted is how a period closes wrong.\n\nA posted entry is immutable. A correction is a new reversing entry, not an edit.`),
    l('silent_failure', 'Why a failure must never be silent', 6,
      'The most dangerous accounting bug is the one that looks like a quiet day.',
      `If a posting fails and nothing says so, the books are wrong and everything downstream — the P&L, the close, the commission — is wrong with them, invisibly. MarketSync surfaces posting exceptions as first-class attention items for exactly this reason.\n\nAn exception queue with items in it is the system working. An empty one you have not checked is not evidence of anything.`),
    cp('trace_one', 'Trace one deal into the ledger', 7,
      'Follow a real transaction from the showroom to the journal.',
      `Take a delivered deal and find its journal entry. Read the lines: what was debited, what was credited, and where the tax went.\n\nIf you cannot find it, you have found a posting exception — which is the more valuable outcome.`),
  ],

  acct_deal_settlement: [
    l('what_it_owes', 'What a delivered deal owes you', 6,
      'The money is in more than one place.',
      `A delivered deal typically owes you money from the lender (the contract), possibly money from the customer (a down payment or balance), and it has consumed a vehicle from inventory. Each is a separate receivable with a separate risk.\n\nTreating them as one number hides which one has gone wrong.`),
    l('cit_vs_ar', 'Contracts in Transit versus customer AR', 6,
      'Two different debtors, two different problems.',
      `Contracts in Transit is what a lender owes on a funded sale. Customer AR is what a person owes you. Conflating them means an aging report that cannot tell you whether to chase a bank or a buyer.\n\nMarketSync separates them deliberately — a fix made specifically because they had been merged.`),
    l('reading_ar', 'Reading AR without guessing', 5,
      'Aging buckets, and what each one means operationally.',
      `Current is fine. Thirty days is a reminder. Sixty is a phone call. Ninety is a decision about whether you are going to collect at all. The buckets are not decoration; each implies a different action.\n\nAn overpaid balance is also an exception. Money you were not owed is somebody else\'s money.`),
    cp('age_your_ar', 'Work the oldest receivable', 7,
      'Take one real item to a decision.',
      `Open Accounting → My Day → Receivables, take the oldest open item, and find out what it actually is. Then decide: collect, correct, or write off with approval.\n\nOld receivables are rarely collection problems. They are usually errors nobody looked at.`),
  ],

  acct_close: [
    l('what_close_is', 'What closing a period means', 6,
      'Declaring that a month is final.',
      `Closing says: everything that happened in this period is in the books, and the numbers will not change again. That is a strong claim, which is why it is gated on real checks rather than a checkbox.\n\nAfter closing, a correction is a reversing entry in an open period — never a quiet edit to a closed one.`),
    l('blockers', 'What blocks a close, and why', 6,
      'Each blocker is a specific unfinished thing.',
      `Unposted drafts, unresolved exceptions, an out-of-balance trial balance, deals delivered but not posted, commission exceptions — each blocks the close because closing over them would bake an error into a permanent record.\n\nMarketSync will not let you advance a period with blockers standing, and it names every one.`),
    l('locked', 'Why a locked period protects you', 5,
      'The restriction is the feature.',
      `A locked period refuses new postings. That sounds like an obstacle until the first time somebody tries to post a September transaction in December and your filed figures change underneath you.\n\nThe lock is what makes a reported number mean something.`),
    cp('read_the_checklist', 'Read your own close checklist', 6,
      'Find out what would stop you closing today.',
      `Open Accounting → Journal → Period close and read every item. For each blocker, identify who has to do what.\n\nIf there are none, check the trial balance is genuinely balanced rather than assuming.`),
  ],

  acct_reconciliation: [
    l('why', 'Why reconcile at all', 5,
      'The bank is the only external check on your books.',
      `Everything else in the ledger is something your dealership asserted. The bank statement is what actually happened to the money. Reconciliation is where those two meet, and it is the only place an internal error or a fraud reliably surfaces.\n\nA book that has never been reconciled is a book nobody has checked.`),
    l('matching', 'Matching in practice', 6,
      'Most items match. The few that do not are the whole point.',
      `Timing differences, fees you did not book, deposits in transit and duplicated entries account for most exceptions. Work them individually rather than forcing a balancing entry.\n\nA plug figure to make a reconciliation balance destroys the only control you had.`),
    l('honest_scope', 'What MarketSync does and does not do yet', 5,
      'The bank feed is real. Automatic matching is not built.',
      `MarketSync imports your bank transactions through Plaid and shows them beside the ledger. There is no reconciliation model yet — no match state, no statement record — so nothing in the product claims a transaction is reconciled.\n\nThat is stated plainly on the screen rather than implied by a tick. Do the matching in your process until the feature exists.`),
    cp('reconcile_a_week', 'Reconcile one week by hand', 8,
      'Compare the feed against the ledger for seven days.',
      `Take one week of bank transactions and match each against the ledger. List everything that does not match and why.\n\nThat list is your reconciliation backlog, and it existed whether or not you had looked at it.`),
  ],

  // ══ Marketing ══════════════════════════════════════════════════════════════
  mkt_campaigns: [
    l('needs_an_id', 'Why a campaign needs an identifier', 5,
      'Without one, attribution is guesswork forever after.',
      `A campaign with an id can be linked to the leads and deals it produced. A campaign without one can only ever be inferred from a free-text source field, which is a guess dressed as a number.\n\nCreate the campaign before you spend the money, not after somebody asks whether it worked.`),
    l('spend', 'Recording spend honestly', 5,
      'Actual spend, never budget.',
      `Budget is what you intended. Actual is what left the account. Reporting return against budget flatters every campaign that underspent and punishes every one that did not.\n\nMarketSync reports actual spend and says so explicitly.`),
    l('attributed', 'What "attributed" honestly means', 6,
      'A linked deal, with gross from the posted ledger.',
      `An attributed deal is one traceable to the campaign by id, whose gross is read from a posted journal. If the deal has not reached the books, its units count and its gross does not — and the campaign is marked as having an incomplete gross rather than quietly under-reporting.\n\nThis is why some campaigns show no return on spend at all. The honest answer is "not yet known".`),
    cp('build_one', 'Create a campaign that can be measured', 6,
      'Set it up so the question is answerable later.',
      `Create a real campaign with its budget, and record actual spend as it happens. Check that leads arriving are linking to it.\n\nIn thirty days you will be able to answer whether it worked. Without this, you will have an opinion.`),
  ],

  mkt_social: [
    l('connecting', 'Connecting accounts', 5,
      'Whose account, and what that grants.',
      `Connecting a page authorises MarketSync to publish as that page. Understand whether the account is the dealership\'s or an individual\'s, because an individual who leaves takes their authorisation with them.\n\nRe-authorisation is routine — tokens expire and platforms change terms.`),
    l('who_may_publish', 'Who may publish as whom', 5,
      'The server decides, and it says why when it refuses.',
      `Publishing rights are decided server-side per account, not by the screen. An account you may not publish to is shown with the reason rather than hidden, so nobody wonders where their page went.\n\nThis matters because publishing as the dealership is speaking for the dealership.`),
    l('partial_failure', 'Reading a publication that failed', 6,
      'Posting to four accounts and reaching three is not "published".',
      `MarketSync reports per-account outcomes: what published, what failed, and the provider\'s own reason for each. A partial result is labelled partial rather than rounded up to success.\n\nRetry the failures specifically. Re-running the whole post duplicates the ones that worked.`),
    cp('publish_one', 'Publish to multiple accounts and read the result', 6,
      'Watch what the outcome actually says.',
      `Compose one post to more than one account and publish. Read the per-account result carefully.\n\nIf one failed, act on its stated reason rather than retrying blindly.`),
  ],

  mkt_attribution: [
    l('linked_vs_inferred', 'Linked versus inferred', 6,
      'Two different kinds of number that must never be added together.',
      `Linked attribution means the deal carries the campaign id. Inferred means somebody typed a source that looks like it. One is evidence; the other is a reasonable guess.\n\nMarketSync shows them separately and refuses to sum them, because a total that mixes the two is a number nobody should make a budget decision on.`),
    l('gross_from_ledger', 'Gross comes from the posted ledger', 6,
      'Not an assumed average, not the deal screen.',
      `Attributed gross is read from posted journals. If a campaign\'s deliveries have not been posted, its gross is incomplete and the product says so instead of substituting an average.\n\nAn assumed average gross makes every campaign look similar, which is exactly the information you were trying to get.`),
    l('incomplete', 'Why an incomplete number is said out loud', 5,
      'Silence about a gap is a claim that there is none.',
      `When any campaign has incomplete gross, return on spend is withheld entirely rather than shown as a smaller number. A ROAS computed on partial revenue understates the campaign and somebody will cut it.\n\nSaying "not yet known" is more useful than a confident wrong figure.`),
    cp('audit_attribution', 'Audit one month of attribution', 7,
      'Find out how much of your reporting is linked.',
      `Take last month: how many deals carry a campaign id, and how many are inferred from free text? Calculate the proportion.\n\nThat proportion is how much of your marketing reporting is actually evidence.`),
  ],

  mkt_automation: [
    l('consent_first', 'Automation that respects consent', 6,
      'Scale multiplies a compliance mistake by your whole database.',
      `Sending one message to somebody who did not consent is a problem. Automating it to eleven thousand people is a different order of problem, and it is the kind that produces regulatory attention.\n\nBuild every audience from consent state first and interest second.`),
    l('segmentation', 'Segmentation that is worth the effort', 6,
      'Relevance is the only thing that makes automation tolerable.',
      `Service customers due for maintenance, buyers approaching equity, shoppers who looked and went quiet — these are segments with something real to say. "Everybody" is not a segment.\n\nEquity mining in particular tends to be the highest-return automation a dealership runs, because the customer is already yours and the message is genuinely useful.`),
    l('not_embarrassing', 'Automation that does not embarrass you', 5,
      'Test what a real person receives.',
      `Send yourself the message. Check the merge fields resolve, that it does not address somebody as "Hi ," and that the timing is not 3am. An automation that goes out broken goes out broken to everybody at once.\n\nAnd give somebody a way out that works. An unsubscribe that does not unsubscribe is worse than none.`),
    cp('build_one_sequence', 'Build and test one sequence', 7,
      'Send it to yourself before anybody else.',
      `Build a short automation on a real segment, and put yourself in the audience. Receive every message.\n\nFix whatever made you wince. That is the standard.`),
  ],

  // ══ Management ═════════════════════════════════════════════════════════════
  mgmt_my_day: [
    l('across_departments', 'Reading the day across departments', 6,
      'One screen, every department, worst first.',
      `Management\'s My Day groups what needs attention by department, so you can see that Service has three blocked jobs and Accounting has an unposted deal without opening either. It also shows what ran — the automations that fired, the campaigns that sent.\n\nStart at the top. It is ordered by severity, not by department politics.`),
    l('incomplete_day', 'What an incomplete day is telling you', 6,
      'A calm screen caused by a failed read is the dangerous case.',
      `If a department\'s data could not be loaded, My Day says so explicitly rather than showing zero. This matters more than it sounds: a quiet morning that is actually a broken integration is how a store loses a day.\n\nWhen you see "could not be loaded", treat it as an outage, not as good news.`),
    l('what_not_to_do', 'What not to do with My Day', 5,
      'It is a queue, not a performance review.',
      `The items on My Day are work states, not verdicts about people. A rep with several waiting leads may have been given several leads. Use it to unblock the store, and use the actual performance surfaces for performance.\n\nManaging from an exception queue produces a team that hides exceptions.`),
    cp('clear_the_top', 'Clear the top three items', 7,
      'Actually unblock three things today.',
      `Take the three highest-severity items on your My Day and drive each to a resolution or a named owner.\n\nNote how many of the three were blocked on somebody not knowing they were blocking it.`),
  ],

  mgmt_people: [
    l('adding_properly', 'Adding somebody properly', 6,
      'A login is not an employee.',
      `Somebody needs both an account and an employment record. A login with no employment record can sign in but appears in no report, can be assigned nothing, and shows up in HR as a specific warning for exactly that reason.\n\nCreate both, set their department, and their required training is assigned automatically.`),
    l('what_a_role_grants', 'What a role actually grants', 6,
      'Roles are permission bundles, and some of them are significant.',
      `A role decides what somebody can see and do — including whether they can see compensation, credit applications, or close a period. Giving somebody manager permissions to save a conversation is how sensitive data spreads.\n\nGrant the narrowest role that lets them do their job. The system re-checks on every request, so a role change takes effect immediately.`),
    l('offboarding', 'Leaving without orphaning their work', 6,
      'The customers do not leave with the person.',
      `Offboarding revokes access — and MarketSync checks what they still own before it does, because a departing rep\'s customers, open deals and assigned tasks become nobody\'s the moment their account closes.\n\nReassign first. Then offboard with a reason on the record.`),
    cp('audit_your_team', 'Audit your team list', 7,
      'Find the gaps that are already there.',
      `Open HR → Staff. Find anybody who can sign in with no employment record, anybody with a role broader than their job, and anybody who has left and still has access.\n\nFix at least one of each.`),
  ],

  mgmt_approvals: [
    l('what_needs_you', 'What needs your approval', 5,
      'The decisions the system deliberately will not make alone.',
      `Identity reviews, deal exceptions, trade decisions, period advancement, commission exceptions. Each is a point where a human judgement is required and the software refuses to guess.\n\nThey are gathered under Pulse so there is one place that answers "what is waiting on me".`),
    l('why_refusals', 'Why some things refuse to proceed', 6,
      'A refusal is usually protecting a number somebody will rely on.',
      `Closing a period with blockers, closing an RO without stating how it was settled, exporting an empty payroll batch — each is refused because proceeding would produce a record that looks valid and is not.\n\nWhen you hit one, read the message. It generally names the exact thing to fix.`),
    l('audit_trail', 'Reading an audit trail', 6,
      'Who did what, when, and what it looked like before.',
      `Sensitive actions are recorded with the actor, the timestamp and the before-and-after state. This protects your staff as much as it monitors them — it is the thing that shows a disputed change was legitimate.\n\nIf you are approving something, your approval is in that trail too.`),
    cp('review_approvals', 'Clear your approval queue', 6,
      'Decide, rather than deferring.',
      `Open Management → Pulse and take every waiting approval to a decision. For anything you cannot decide, name what you need and from whom.\n\nAn approval queue is only a control if somebody works it.`),
  ],

  mgmt_analytics: [
    l('cross_department', 'Numbers that cross departments', 6,
      'The interesting questions are never inside one department.',
      `Gross per unit combines Sales, F&I and Inventory. Fixed absorption combines Service, Parts and the whole expense base. Marketing return combines campaigns with the posted ledger.\n\nThis is why the departments share canonical records rather than each keeping their own copy — a cross-department number built from two disagreeing sources is worthless.`),
    l('derived_from', 'Know what a number is derived from', 6,
      'A metric you cannot trace is a metric you cannot defend.',
      `Before acting on any figure, know its source: is gross from the posted ledger or from the deal screen? Is a lead count linked or inferred? Two reasonable definitions of "sold" will differ by ten percent and both will be defensible.\n\nMarketSync labels derivation deliberately, including where it cannot compute something honestly.`),
    l('not_yet_trustworthy', 'Which numbers cannot be trusted yet', 6,
      'The product tells you where it is not measuring.',
      `Some things are not yet measurable here and are said so plainly: technician productivity and cycle time need actual labour time on every job; reconciliation has no match model; compliance coverage reports whether an area is measured at all rather than assuming zero means clean.\n\nAn absence of records is not a clean bill of health, and any screen that implies otherwise is lying to you.`),
    cp('trace_a_metric', 'Trace one number you rely on', 7,
      'Pick the figure you quote most and find its source.',
      `Choose a number you use in a meeting. Find exactly where it comes from, what it includes, and what it excludes.\n\nIf you cannot, stop quoting it until you can.`),
  ],
}

// Every course key that has lessons. The sync script refuses to run if a course in the
// curriculum has none — a course somebody can be REQUIRED to complete and cannot open is
// the exact dead-wiring this file was written to end.
export const LESSON_COURSE_KEYS = new Set(Object.keys(LESSONS))

export const LESSON_COUNT = Object.values(LESSONS).reduce((n, ls) => n + ls.length, 0)
