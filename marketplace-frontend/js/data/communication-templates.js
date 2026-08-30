/**
 * Default communication template content: the subject lines and block structure
 * MarketSync ships for dealer email and SMS campaigns.
 *
 * This is campaign CONTENT, not Dealer OS chrome. It is rendered into an email a
 * dealership sends to its customers, where emoji in a subject line is deliberate
 * marketing copy rather than interface decoration. Keeping it out of js/modules/
 * is what lets the no-emoji rule stay strict about the interface without stripping
 * shipped marketing copy.
 *
 * Loaded as a classic script before the dashboard part files, so the top-level
 * const is in scope for them exactly as it was when it lived in dashboard-part18.
 */
const DEFAULT_COMMUNICATION_TEMPLATES = [
  {
    id: 'tpl_summer_truck_suv',
    name: 'Summer Used Truck & SUV Clearance Event',
    category: 'Promotions',
    channel: 'Email',
    desc: 'Seasonal inventory clearance showcase with 2-col truck & SUV grid, $1,000 extra trade bonus voucher, and VIP test drive reservation.',
    used_by: 4,
    subject: '🔥 Summer Truck & SUV Clearance: Save up to $4,500 + $1,000 Extra Trade Bonus at {{dealership.name}}',
    sms_message: "Summer Truck & SUV Clearance is live at {{dealership.name}}! Over 45 frontline 4x4 trucks & SUVs discounted with up to $1,000 extra trade bonus this week: {{inventory_url|view inventory}}",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center', logoUrl: '' } },
      { id: 'b2', type: 'heading', data: { text: 'Summer Pre-Owned Truck & SUV Clearance Event', level: 'h1', align: 'center' } },
      { id: 'b3', type: 'text', data: { text: 'Hi {{customer.first_name}},<br><br>We just marked down over 45 pre-owned 4x4 trucks, full-size SUVs, and family crossovers to make room for incoming dealer inventory.<br><br>Take advantage of <strong>exclusive summer price cuts up to $4,500 below market</strong>, plus an additional $1,000 bonus cash on any trade-in.' } },
      { id: 'b4', type: 'vehicle_card', data: { title: '2023 Chevrolet Silverado 1500 RST 4WD', price: '$43,995 (Save $3,500)', vin: '1GCPYFEF8RA129841', stock: 'TR-8492', mileage: '16,450 mi', fuel: '5.3L V8 EcoTec3', exterior: 'Glacier Blue Metallic', transmission: '10-Speed Automatic' } },
      { id: 'b5', type: 'inventory_grid', data: { title: 'More Clearance Frontline Units', layout: '2-col', items: [
        { title: '2024 GMC Sierra 1500 Elevation', price: '$46,750', mileage: '12,200 mi', stock: 'TR-7821' },
        { title: '2023 Ford Expedition Max Limited', price: '$54,900', mileage: '21,400 mi', stock: 'SU-9034' }
      ] } },
      { id: 'b6', type: 'service_offer', data: { headline: '$1,000 Extra Trade-In Cash Bonus', discount: '$1,000 BONUS', desc: 'Present this coupon code when appraising your trade during the Summer Clearance Event.', code: 'SUMMER-TRADE-1K' } },
      { id: 'b7', type: 'button', data: { text: 'Browse All Clearance Inventory & Reserve Keys', url: 'https://dealership.com/clearance', align: 'center', btnBg: '#4f46e5' } },
      { id: 'b8', type: 'rep_card', data: { name: 'Michael Scott', role: 'Dedicated Sales Specialist', phone: '(555) 234-8901', email: 'm.scott@dealership.com' } },
      { id: 'b9', type: 'footer', data: { dealershipName: '{{dealership.name}}', address: '123 Automotive Parkway, Metro Area', phone: '(555) 321-4567', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_spring_tire_brake',
    name: 'Spring Tire Changeover & Complete Brake Special',
    category: 'Service',
    channel: 'Email + SMS',
    desc: 'Seasonal tire swap, 4-wheel brake inspection coupon ($89.95), alignment rebate, and online service bay scheduler.',
    used_by: 3,
    subject: '🚗 Spring Tire Changeover & Complete Brake Inspection Package at {{dealership.name}}',
    sms_message: "Hi {{customer.first_name|there}}, get your {{vehicle.model|vehicle}} road-trip ready with our Spring Tire Swap & Brake Inspection Package ($89.95). Book online in 60s: {{service_url|our service page}}",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'Spring Tire Swap & Multi-Point Brake Safety Special', level: 'h2', align: 'left' } },
      { id: 'b3', type: 'text', data: { text: 'Hi {{customer.first_name}},<br><br>Spring weather is here! Protect your seasonal tires, maximize your fuel economy, and ensure total stopping safety with our factory-certified spring service package.<br><br>Schedule this week to claim our seasonal package discount:' } },
      { id: 'b4', type: 'service_offer', data: { headline: 'Spring Tire Changeover & 4-Wheel Brake Check', discount: '$89.95 SPECIAL', desc: 'Includes mount & balance check, brake pad & rotor micrometer measurement, and tire pressure reset.', code: 'SPRING-TIRE-89' } },
      { id: 'b5', type: 'service_offer', data: { headline: '$20 Off Computerized 4-Wheel Alignment', discount: '$20 OFF', desc: 'Prevent uneven tire wear and ensure your steering tracks straight after winter road conditions.', code: 'ALIGN-20' } },
      { id: 'b6', type: 'button', data: { text: 'Schedule Spring Service Online (Instant Confirmation)', url: 'https://dealership.com/service-booking', align: 'center', btnBg: '#059669' } },
      { id: 'b7', type: 'footer', data: { dealershipName: '{{dealership.name}} Service Center', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_trade_equity_vip',
    name: 'High Trade-In Equity VIP Private Event',
    category: 'Vehicle',
    channel: 'SMS',
    desc: 'Exclusive VIP invitation for vehicle owners with calculated trade valuation above market and private appraisal slot.',
    used_by: 3,
    subject: 'VIP Private Sale: Top-Dollar Trade Appraisal & Equity Exchange at {{dealership.name}}',
    sms_message: "VIP Invitation: {{customer.first_name}}, urgent buyer demand for your {{vehicle.year}} {{vehicle.model}}. We are paying up to 120% book value this Saturday at {{dealership.name}}. Claim pass: {{equity_url|our VIP page}}",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'Exclusive VIP Invitation: Trade Equity Exchange Event', level: 'h1', align: 'center' } },
      { id: 'b3', type: 'text', data: { text: 'Dear {{customer.first_name}},<br><br>Because of high pre-owned buyer demand, our acquisition team has pre-approved your <strong>{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}</strong> for an Above-Market Equity Appraisal.<br><br>Upgrade your vehicle while keeping your monthly payment equal or lower, or cash out your positive equity today.' } },
      { id: 'b4', type: 'trade_cta', data: { headline: 'Your Estimated Equity Position: +$3,200', subheadline: 'Current pre-owned auction indices are at peak values for your vehicle class.', btnText: 'View Instant Trade-In Valuation' } },
      { id: 'b5', type: 'service_offer', data: { headline: 'VIP Loyalty Bonus at Signing', discount: '$500 CASH', desc: 'Bonus $500 applied towards your purchase or paid directly by check at closing.', code: 'VIP-EQUITY-500' } },
      { id: 'b6', type: 'button', data: { text: 'RSVP for Your Private 15-Minute Appraisal Slot', url: 'https://dealership.com/vip-appraisal', align: 'center', btnBg: '#e11d48' } },
      { id: 'b7', type: 'rep_card', data: { name: 'David Wallace', role: 'Used Car Acquisition Manager', phone: '(555) 345-9012' } },
      { id: 'b8', type: 'footer', data: { dealershipName: '{{dealership.name}}', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_vip_ownership_1yr',
    name: 'VIP Customer 1-Year Ownership Milestone Check-in',
    category: 'Vehicle',
    channel: 'Email',
    desc: '1-year ownership milestone celebration with complimentary 27-point inspection, complimentary oil change certificate, and customer loyalty rewards.',
    used_by: 3,
    subject: 'Happy 1-Year Anniversary with your {{vehicle.year}} {{vehicle.make}} {{vehicle.model}}! 🎉',
    sms_message: "Happy 1-Year Anniversary with your {{vehicle.model}}, {{customer.first_name}}! To celebrate, your next routine maintenance is on us. Schedule anytime: {{service_url|our service page}}",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'Happy 1-Year Anniversary with Your {{vehicle.model}}! 🎉', level: 'h1', align: 'center' } },
      { id: 'b3', type: 'text', data: { text: 'Dear {{customer.first_name}},<br><br>It has been exactly one year since you drove home in your <strong>{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}</strong>! We hope you have loved every mile of ownership.<br><br>As a token of our appreciation for being part of our dealership family, please enjoy a complimentary anniversary maintenance visit on us:' } },
      { id: 'b4', type: 'vehicle_card', data: { title: 'Your Vehicle: {{vehicle.year}} {{vehicle.make}} {{vehicle.model}}', price: '1-Year Milestone', vin: '{{vehicle.vin}}', stock: 'Delivered', exterior: '{{vehicle.exterior_color}}' } },
      { id: 'b5', type: 'service_offer', data: { headline: 'Complimentary Anniversary Maintenance Pass', discount: '100% FREE', desc: 'Includes full synthetic oil & filter change plus comprehensive multi-point safety inspection.', code: '1YR-VIP-FREE' } },
      { id: 'b6', type: 'service_offer', data: { headline: '$200 Customer Referral Bonus', discount: '$200 CASH', desc: 'Know a friend or family member looking for a vehicle? We will send you $200 cash when they buy!', code: 'VIP-REF-200' } },
      { id: 'b7', type: 'button', data: { text: 'Schedule Complimentary Anniversary Service', url: 'https://dealership.com/service-booking', align: 'center', btnBg: '#4f46e5' } },
      { id: 'b8', type: 'footer', data: { dealershipName: '{{dealership.name}}', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_year_end_clearance',
    name: 'Year-End Model Clearance & 0% Financing Event',
    category: 'Promotions',
    channel: 'Email + SMS',
    desc: 'Year-end manufacturer model blowout with 0% APR financing, $5,000 factory cash, and express digital pre-approval.',
    used_by: 2,
    subject: '⚡ Year-End Clearance Event: 0% APR & Up to $5,000 Factory Cash at {{dealership.name}}',
    sms_message: "Year-End Clearance is on at {{dealership.name}}! 0% financing and up to $5,000 off remaining models this weekend only: {{clearance_url|view clearance}}",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'Year-End Model Closeout: Up to $5,000 Factory Cash', level: 'h1', align: 'center' } },
      { id: 'b3', type: 'text', data: { text: 'Hi {{customer.first_name}},<br><br>All remaining current-model year inventory must go before month-end. We are passing manufacturer rebates, 0% APR dealer incentives, and instant trade bonuses directly to you.<br><br>Browse remaining vehicles and get pre-approved in under 2 minutes:' } },
      { id: 'b4', type: 'inventory_grid', data: { title: 'Remaining Model Closeouts', layout: '2-col', items: [
        { title: '2024 GMC Sierra 1500 SLT', price: '$49,990 (Save $5,200)', mileage: '15 mi', stock: 'NEW-1049' },
        { title: '2024 Chevrolet Traverse RS', price: '$44,500 (Save $4,100)', mileage: '20 mi', stock: 'NEW-2091' }
      ] } },
      { id: 'b5', type: 'service_offer', data: { headline: '0% APR for 60 Months on Approved Credit', discount: '0% FINANCING', desc: 'Combine with up to $2,000 trade equity booster on select units.', code: 'YEAR-END-0APR' } },
      { id: 'b6', type: 'button', data: { text: 'Get Instant 2-Minute Pre-Approval', url: 'https://dealership.com/finance-app', align: 'center', btnBg: '#e11d48' } },
      { id: 'b7', type: 'footer', data: { dealershipName: '{{dealership.name}}', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_customer_appreciation',
    name: 'Customer Appreciation Weekend & BBQ Invite',
    category: 'Holiday',
    channel: 'Email',
    desc: 'Annual customer appreciation event invitation with complimentary BBQ, free vehicle health inspection, and prize raffle.',
    used_by: 2,
    subject: "You're Invited: Annual Customer Appreciation BBQ & Complimentary Vehicle Health Check",
    sms_message: "Join us this Saturday for our Customer Appreciation BBQ & free vehicle check at {{dealership.name}}! RSVP: {{event_url|rsvp here}}",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'Join Us for Our Annual Customer Appreciation Day!', level: 'h1', align: 'center' } },
      { id: 'b3', type: 'text', data: { text: 'Dear {{customer.first_name}},<br><br>To celebrate our amazing community of drivers, we are hosting our Annual Customer Appreciation Weekend this Saturday from 11:00 AM to 3:00 PM!<br><br><strong>What to expect:</strong><br>• Complimentary Gourmet BBQ Lunch & Refreshments<br>• Free 27-Point Vehicle Safety & Battery Health Check<br>• Live Prize Drawings for a $500 Service Credit' } },
      { id: 'b4', type: 'service_offer', data: { headline: 'Free Vehicle Health & Battery Check Coupon', discount: '100% FREE', desc: 'No purchase necessary. Valid during Customer Appreciation Weekend.', code: 'BBQ-CHECK-FREE' } },
      { id: 'b5', type: 'button', data: { text: 'RSVP for Customer Appreciation BBQ', url: 'https://dealership.com/bbq-rsvp', align: 'center', btnBg: '#10b981' } },
      { id: 'b6', type: 'footer', data: { dealershipName: '{{dealership.name}}', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_lead_90s',
    name: 'Instant 90-Second Rapid Lead Response',
    category: 'Sales',
    channel: 'Email + SMS',
    desc: 'Salesperson-first intro with vehicle specs, history card, and 1-click test drive scheduler.',
    used_by: 3,
    subject: 'Your Vehicle Inquiry at {{dealership.name}}',
    sms_message: "Hi {{customer.first_name|there}}, it's {{rep.first_name|the team}} at {{dealership.name}}. Saw you were looking at the {{vehicle.ymm|vehicle}} — is that still the one you had your eye on, or are you open to options? Happy to check live availability for you.",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center', logoUrl: '' } },
      { id: 'b2', type: 'heading', data: { text: 'Your Vehicle Inquiry at {{dealership.name}}', level: 'h2', align: 'left' } },
      { id: 'b3', type: 'text', data: { text: 'Hi {{customer.first_name}},<br><br>Thank you for inquiring about the <strong>{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}</strong>. I just pulled the vehicle history, live availability, and window sticker for you.' } },
      { id: 'b4', type: 'vehicle_card', data: { title: '2024 Chevrolet Silverado 1500 RST', price: '$48,995', vin: '1GCPYFEF8RA129841', stock: 'TR-8492', mileage: '12,450 mi', fuel: '5.3L V8 EcoTec3', exterior: 'Glacier Blue Metallic', transmission: '10-Speed Automatic' } },
      { id: 'b5', type: 'rep_card', data: { name: 'Michael Scott', role: 'Dedicated Sales Specialist', phone: '(555) 234-8901', email: 'm.scott@dealership.com' } },
      { id: 'b6', type: 'button', data: { text: 'Schedule a 2-Minute Call or Test Drive', url: 'https://dealership.com/schedule', align: 'center', btnBg: '#4f46e5' } },
      { id: 'b7', type: 'footer', data: { dealershipName: '{{dealership.name}}', address: '123 Automotive Parkway, Metro Area', phone: '(555) 321-4567', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_lead_day3',
    name: 'Day 3 "Still Looking" Alternative Showcase',
    category: 'Follow-up',
    channel: 'Email + SMS',
    desc: '2-unit alternative inventory grid with trade appraisal callout and direct text bump.',
    used_by: 2,
    subject: 'Still shopping? 2 similar vehicles you might like at {{dealership.name}}',
    sms_message: "Hey {{customer.first_name|there}} — did you end up finding something, or are you still shopping around for the {{vehicle.model|right vehicle}}?",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'Still Searching for the Right Match?', level: 'h2', align: 'left' } },
      { id: 'b3', type: 'text', data: { text: 'Hi {{customer.first_name}},<br><br>Just checking in on your search. If you haven\'t settled on a unit yet, here are two fresh arrivals matching similar options and strong pricing:' } },
      { id: 'b4', type: 'inventory_grid', data: { title: 'Similar Frontline Inventory', layout: '2-col', items: [
        { title: '2023 GMC Sierra 1500 Elevation', price: '$46,750', mileage: '18,200 mi', stock: 'TR-7821' },
        { title: '2024 Ford F-150 XLT Sport 4x4', price: '$49,200', mileage: '8,400 mi', stock: 'TR-9034' }
      ] } },
      { id: 'b5', type: 'trade_cta', data: { headline: 'Have a Trade-In? Get Guaranteed Cash Value', subheadline: 'Used vehicle trade values are at seasonal highs this week.', btnText: 'Get 2-Minute Trade Estimate' } },
      { id: 'b6', type: 'rep_card', data: { name: 'Michael Scott', role: 'Dedicated Sales Specialist', phone: '(555) 234-8901' } },
      { id: 'b7', type: 'footer', data: { dealershipName: '{{dealership.name}}', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_sold_congrats',
    name: 'Sold Congratulations & Digital Welcome Packet',
    category: 'Sales',
    channel: 'Email + SMS',
    desc: 'Celebratory welcome hero, vehicle showcase, referral incentive, and Google review router.',
    used_by: 4,
    subject: 'Congratulations on your new {{vehicle.year}} {{vehicle.make}} {{vehicle.model}}!',
    sms_message: "Congratulations {{customer.first_name|there}}! Everyone at {{dealership.name}} is thrilled for you and your new {{vehicle.ymm|vehicle}}. We appreciate your business and are here for anything you need!",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'Congratulations & Welcome to the Family!', level: 'h1', align: 'center' } },
      { id: 'b3', type: 'text', data: { text: 'Dear {{customer.first_name}},<br><br>Everyone at {{dealership.name}} is thrilled for you! Driving home in your new <strong>{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}</strong> is an exciting milestone.<br><br>Below are key resources for your ownership journey, including your digital roadside assistance information and warranty overview.' } },
      { id: 'b4', type: 'vehicle_card', data: { title: '2025 GMC Yukon Denali Ultimate', price: 'Delivered', vin: '1GKS2CKL9RR849201', stock: 'DLV-4921', exterior: 'Onyx Black', fuel: '6.2L EcoTec3 V8' } },
      { id: 'b5', type: 'service_offer', data: { headline: '$200 Customer Referral Bonus', discount: '$200 CASH', desc: 'Know a friend or family member looking for a vehicle? We will send you $200 cash when they buy!', code: 'VIP-REF-200' } },
      { id: 'b6', type: 'review_request', data: { headline: 'How Was Your Delivery Experience?', subheadline: 'Your feedback helps our team constantly improve.', btnText: 'Leave a 5-Star Google Review', reviewUrl: 'https://g.page/r/dealership/review' } },
      { id: 'b7', type: 'footer', data: { dealershipName: '{{dealership.name}}', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_delivery_reminder',
    name: 'Vehicle Delivery Logistics & What-to-Bring',
    category: 'Sales',
    channel: 'Email + SMS',
    desc: 'Delivery time, logistics checklist, delivery coordinator contact, and driving directions.',
    used_by: 3,
    subject: 'Delivery Checklist for Your {{vehicle.year}} {{vehicle.make}} {{vehicle.model}}',
    sms_message: "Hi {{customer.first_name|there}}, your vehicle delivery is set for {{delivery_time|your scheduled time}}. Please remember to bring your driver's license and proof of insurance. We'll have everything ready!",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'Your Delivery is Scheduled!', level: 'h2', align: 'left' } },
      { id: 'b3', type: 'text', data: { text: 'Hi {{customer.first_name}},<br><br>We are detailing and inspecting your <strong>{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}</strong> so it is in showroom-ready condition for delivery.<br><br><strong>What to bring with you:</strong><br>• Valid Driver\'s License for all registered parties<br>• Current Auto Insurance Card (or binder from your agent)<br>• Title/Registration and all key fobs if trading in a vehicle<br>• Certified funds or bank draft for down payment (if applicable)' } },
      { id: 'b4', type: 'vehicle_card', data: { title: '2024 Chevrolet Tahoe RST', price: 'Scheduled for Delivery', stock: 'DLV-1094', exterior: 'Summit White' } },
      { id: 'b5', type: 'rep_card', data: { name: 'Sarah Jenkins', role: 'Delivery Specialist', phone: '(555) 432-8921' } },
      { id: 'b6', type: 'button', data: { text: 'View Delivery Location & Directions', url: 'https://dealership.com/directions', align: 'center' } },
      { id: 'b7', type: 'footer', data: { dealershipName: '{{dealership.name}}', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_review_request',
    name: '48-Hour Google Review & Sentiment Ask',
    category: 'Review',
    channel: 'Email + SMS',
    desc: 'Minimal, high-converting 5-star rating graphic with 1-click Google review router.',
    used_by: 2,
    subject: 'How did we do at {{dealership.name}}?',
    sms_message: "Hi {{customer.first_name|there}}, thank you again for choosing {{dealership.name}}! If you have 30 seconds, a quick Google review would mean the world to our team: {{review_url|our review page}}",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'How Was Your Experience With Us?', level: 'h2', align: 'center' } },
      { id: 'b3', type: 'text', data: { text: 'Hi {{customer.first_name}},<br><br>Thank you for choosing {{dealership.name}}! Our family-owned business thrives on honest feedback from valued customers like you.<br><br>If you have 30 seconds, tapping the link below to share your experience on Google makes a huge impact for our team:' } },
      { id: 'b4', type: 'review_request', data: { headline: 'Share Your 5-Star Experience', subheadline: 'Click below to open Google Reviews directly.', btnText: 'Rate Us on Google (30 Seconds)', reviewUrl: 'https://g.page/r/dealership/review' } },
      { id: 'b5', type: 'footer', data: { dealershipName: '{{dealership.name}}', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_referral_request',
    name: '$200 Customer Referral Reward Program',
    category: 'Referral',
    channel: 'Email + SMS',
    desc: 'Reward-focused referral incentive with cash bonus badge and 1-click submission form.',
    used_by: 2,
    subject: 'Earn $200 cash for every friend you refer to {{dealership.name}}',
    sms_message: "{{customer.first_name|Hey}} — hope you're loving the {{vehicle.model|new ride}}! Quick note: we pay {{referral_bonus|a $200 referral bonus}} for anyone you send our way who buys. Know a friend or family member shopping? Send them my way! — {{rep.first_name|Your team}}",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'Earn $200 Cash for Every Referral', level: 'h2', align: 'center' } },
      { id: 'b3', type: 'text', data: { text: 'Hi {{customer.first_name}},<br><br>We love having you as part of our community! Did you know we pay a <strong>$200 cash referral bonus</strong> for any friend, coworker, or family member you refer who purchases a vehicle from us?' } },
      { id: 'b4', type: 'service_offer', data: { headline: '$200 CASH Referral Bonus', discount: '$200 Cash', desc: 'No limits on referral rewards. Simply submit their name before they buy.', code: 'REF-200' } },
      { id: 'b5', type: 'button', data: { text: 'Submit a Referral & Claim $200', url: 'https://dealership.com/referrals', align: 'center', btnBg: '#10b981' } },
      { id: 'b6', type: 'rep_card', data: { name: 'Michael Scott', role: 'Sales Specialist', phone: '(555) 234-8901' } },
      { id: 'b7', type: 'footer', data: { dealershipName: '{{dealership.name}}', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_service_reminder',
    name: '6-Month Routine Service Interval & Oil Special',
    category: 'Service',
    channel: 'Email + SMS',
    desc: 'Factory service interval notice with $59.95 synthetic oil special and online scheduler.',
    used_by: 5,
    subject: 'Time for your 6-month routine maintenance at {{dealership.name}}',
    sms_message: "Hi {{customer.first_name|there}}, our records indicate your {{vehicle.ymm|vehicle}} is due for its 6-month routine maintenance. Protect your warranty and book online here: {{service_url|book appointment}}",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'Time for Routine Service on Your {{vehicle.model}}', level: 'h2', align: 'left' } },
      { id: 'b3', type: 'text', data: { text: 'Hi {{customer.first_name}},<br><br>Our records show your <strong>{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}</strong> is due for its factory-recommended 6-month maintenance interval. Regular service protects your engine, keeps your warranty valid, and maintains maximum resale value.' } },
      { id: 'b4', type: 'service_offer', data: { headline: 'Full Synthetic Oil & Filter + Tire Rotation', discount: '$59.95 SPECIAL', desc: 'Includes complimentary 27-point multi-point safety inspection and fluid top-off.', code: 'SERV-5995' } },
      { id: 'b5', type: 'button', data: { text: 'Book Service Appointment Online', url: 'https://dealership.com/service-booking', align: 'center', btnBg: '#059669' } },
      { id: 'b6', type: 'footer', data: { dealershipName: '{{dealership.name}} Service Center', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_service_declined',
    name: 'Declined Service 14-Day Safety Notice & 10% Off',
    category: 'Service',
    channel: 'Email + SMS',
    desc: '10% safety discount coupon on deferred repairs with direct booking CTA.',
    used_by: 2,
    subject: 'Safety follow-up regarding your {{vehicle.year}} {{vehicle.make}} {{vehicle.model}}',
    sms_message: "Hi {{customer.first_name|there}}, our service team wanted to follow up on the maintenance recommendations for your {{vehicle.model|vehicle}}. Use code SAFETY10 for 10% off when you schedule: {{service_url|our service page}}",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'Important Safety Follow-up on Your {{vehicle.model}}', level: 'h2', align: 'left' } },
      { id: 'b3', type: 'text', data: { text: 'Hi {{customer.first_name}},<br><br>During your recent visit to our service center, our certified technician identified maintenance items on your <strong>{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}</strong> that were deferred.<br><br>To make completing these safety items convenient and budget-friendly, we have applied an exclusive 10% discount to your customer account.' } },
      { id: 'b4', type: 'service_offer', data: { headline: '10% Off Recommended Maintenance Items', discount: '10% OFF', desc: 'Valid for brake pads, rotors, fluid flushes, filters, and suspension repairs.', code: 'SAFETY10' } },
      { id: 'b5', type: 'button', data: { text: 'Schedule Deferred Maintenance', url: 'https://dealership.com/service-booking', align: 'center', btnBg: '#dc2626' } },
      { id: 'b6', type: 'footer', data: { dealershipName: '{{dealership.name}} Service Center', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_win_back',
    name: '12-Month Inactive Customer Win-Back & $25 Voucher',
    category: 'Follow-up',
    channel: 'Email + SMS',
    desc: 'Warm personalized letter with $25 gift certificate and trade equity appraisal offer.',
    used_by: 2,
    subject: 'We miss you at {{dealership.name}} — $25 Service Gift Inside',
    sms_message: "Hi {{customer.first_name|there}}, it's been over a year since we've seen your {{vehicle.model|vehicle}}! Enjoy $25 off your next service visit. Book online at {{service_url|our website}} with code WELCOMEBACK.",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'We Miss Seeing You at {{dealership.name}}!', level: 'h2', align: 'center' } },
      { id: 'b3', type: 'text', data: { text: 'Dear {{customer.first_name}},<br><br>It has been over a year since your last visit to our store. We value your relationship and want to make sure your vehicle is still running at peak performance.<br><br>Please accept this complimentary $25 gift certificate towards any service, oil change, detailing, or parts purchase.' } },
      { id: 'b4', type: 'service_offer', data: { headline: '$25 Welcome Back Gift Certificate', discount: '$25 CREDIT', desc: 'Applicable to any service or parts order over $50.', code: 'WELCOMEBACK' } },
      { id: 'b5', type: 'trade_cta', data: { headline: 'Curious What Your Vehicle Is Worth Today?', subheadline: 'Pre-owned trade-in values have increased. Get a quick equity estimate.', btnText: 'Check My Vehicle Equity' } },
      { id: 'b6', type: 'footer', data: { dealershipName: '{{dealership.name}}', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_price_drop',
    name: 'Price Reduction Alert on Saved Vehicle',
    category: 'Promotions',
    channel: 'Email + SMS',
    desc: 'Price reduction alert with vehicle card, savings amount, and instant test drive reservation.',
    used_by: 2,
    subject: 'Price Drop Alert: Save on {{vehicle.year}} {{vehicle.make}} {{vehicle.model}}',
    sms_message: "Great news {{customer.first_name|there}}! The price on the {{vehicle.ymm|vehicle}} you checked out has just dropped by {{price_drop_amount|$500}}. Want me to hold the keys for a test drive? — {{rep.first_name|Your sales rep}}",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'Price Reduced on Your Saved Vehicle!', level: 'h2', align: 'left' } },
      { id: 'b3', type: 'text', data: { text: 'Great news {{customer.first_name}}!<br><br>The price on the <strong>{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}</strong> you viewed on our website has just been reduced by <strong>$1,200</strong>.<br><br>Because of high demand on this vehicle class, we recommend reserving a test drive before the weekend rush.' } },
      { id: 'b4', type: 'vehicle_card', data: { title: '2024 Ford Explorer ST 4WD', price: '$44,795', vin: '1FM5K8GC8RGA19824', stock: 'SU-4192', mileage: '9,800 mi', exterior: 'Rapid Red Metallic', transmission: '10-Speed Automatic' } },
      { id: 'b5', type: 'button', data: { text: 'Hold Keys & Reserve Test Drive', url: 'https://dealership.com/reserve', align: 'center', btnBg: '#e11d48' } },
      { id: 'b6', type: 'rep_card', data: { name: 'Michael Scott', role: 'Sales Specialist', phone: '(555) 234-8901' } },
      { id: 'b7', type: 'footer', data: { dealershipName: '{{dealership.name}}', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_new_inventory',
    name: 'Fresh Inventory Arrival & VIP First Look',
    category: 'Promotions',
    channel: 'Email + SMS',
    desc: 'Fresh lot arrival showcase with 2-unit inventory grid and window sticker viewer.',
    used_by: 3,
    subject: 'Fresh Lot Arrival: {{vehicle.year}} {{vehicle.make}} {{vehicle.model}} at {{dealership.name}}',
    sms_message: "Hi {{customer.first_name|there}}, a fresh {{vehicle.ymm|vehicle}} matching your preferences just landed on our lot! Want me to send over the photos & window sticker? — {{rep.first_name|Your team}}",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'Just Arrived: Fresh Frontline Trade-in', level: 'h2', align: 'left' } },
      { id: 'b3', type: 'text', data: { text: 'Hi {{customer.first_name}},<br><br>A pristine <strong>{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}</strong> just finished multi-point reconditioning and arrived on our frontline lot. As a VIP shopper who saved similar criteria, you get first access before public advertising.' } },
      { id: 'b4', type: 'vehicle_card', data: { title: '2024 RAM 1500 Laramie 4x4', price: '$51,450', vin: '1C6SRFJT8RN190248', stock: 'TR-3910', mileage: '14,100 mi', exterior: 'Diamond Black Crystal' } },
      { id: 'b5', type: 'inventory_grid', data: { title: 'Other Fresh Arrivals This Week', layout: '2-col', items: [
        { title: '2023 Chevrolet Tahoe Premier', price: '$58,900', mileage: '22,400 mi', stock: 'SU-8921' },
        { title: '2024 Toyota Tundra Limited', price: '$53,200', mileage: '11,300 mi', stock: 'TR-4412' }
      ] } },
      { id: 'b6', type: 'rep_card', data: { name: 'Michael Scott', role: 'Sales Specialist', phone: '(555) 234-8901' } },
      { id: 'b7', type: 'footer', data: { dealershipName: '{{dealership.name}}', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_birthday',
    name: 'Customer Birthday Celebration Greeting',
    category: 'Holiday',
    channel: 'SMS + Email',
    desc: 'Warm personal greeting with celebratory visuals and zero sales pressure.',
    used_by: 2,
    subject: 'Happy Birthday from all of us at {{dealership.name}}!',
    sms_message: "Happy Birthday, {{customer.first_name|there}}! Wishing you a fantastic year ahead from all of us at {{dealership.name}}. Enjoy your day! — {{rep.first_name|Your friends at the store}}",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'Happy Birthday, {{customer.first_name}}!', level: 'h1', align: 'center' } },
      { id: 'b3', type: 'text', data: { text: 'Wishing you a wonderful birthday filled with happiness and celebration!<br><br>Everyone on our team at <strong>{{dealership.name}}</strong> appreciates having you in our community. Thank you for being a valued customer, and here\'s to great roads and adventures in the year ahead!' } },
      { id: 'b4', type: 'rep_card', data: { name: 'The {{dealership.name}} Team', role: 'Your Dealership Family', phone: '(555) 321-4567', email: 'team@dealership.com' } },
      { id: 'b5', type: 'footer', data: { dealershipName: '{{dealership.name}}', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_anniversary',
    name: '1-Year Ownership Anniversary & Equity Review',
    category: 'Vehicle',
    channel: 'Email + SMS',
    desc: 'Ownership milestone celebration with complimentary trade valuation offer.',
    used_by: 3,
    subject: 'Happy 1-Year Anniversary With Your {{vehicle.model}}!',
    sms_message: "Happy 1-Year Anniversary with your {{vehicle.model}}, {{customer.first_name}}! We hope you've loved every mile. Curious what it's worth today? Check your equity here: {{equity_url|instant trade value}}",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'Happy 1-Year Anniversary with Your {{vehicle.model}}!', level: 'h1', align: 'center' } },
      { id: 'b3', type: 'text', data: { text: 'Dear {{customer.first_name}},<br><br>It has been one year since you drove home in your <strong>{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}</strong>! We hope you have made incredible memories on the road.<br><br>As an anniversary gift, we have prepared a complimentary vehicle valuation and trade equity report for your records.' } },
      { id: 'b4', type: 'trade_cta', data: { headline: 'See Your 1-Year Equity Report', subheadline: 'Pre-owned trade values remain high. Find out what your vehicle is worth today.', btnText: 'View My Trade Valuation' } },
      { id: 'b5', type: 'service_offer', data: { headline: 'Anniversary Service Gift: $20 Off Next Visit', discount: '$20 OFF', desc: 'Valid for routine maintenance, oil change, or detailing service.', code: 'ANNIV-20' } },
      { id: 'b6', type: 'footer', data: { dealershipName: '{{dealership.name}}', showUnsub: true } }
    ]
  },
  {
    id: 'tpl_newsletter',
    name: 'Dealership Monthly Community Newsletter',
    category: 'Newsletter',
    channel: 'Email',
    desc: 'Multi-column editorial layout with lot specials, maintenance tips, and community news.',
    used_by: 2,
    subject: 'The {{dealership.name}} Monthly Insider: News, Specials & Highlights',
    sms_message: "Check out this month's {{dealership.name}} community newsletter and service specials: {{service_url|our monthly update}}",
    blocks: [
      { id: 'b1', type: 'logo', data: { align: 'center' } },
      { id: 'b2', type: 'heading', data: { text: 'The {{dealership.name}} Monthly Dispatch', level: 'h1', align: 'left' } },
      { id: 'b3', type: 'text', data: { text: 'Welcome to this month\'s dealership update! Here is what is happening across our showroom, service bays, and local community.' } },
      { id: 'b4', type: 'inventory_grid', data: { title: 'Featured Frontline Arrivals', layout: '2-col', items: [
        { title: '2024 GMC Sierra Denali Ultimate', price: '$72,900', mileage: '6,200 mi', stock: 'TR-1192' },
        { title: '2024 Ford Mustang Mach-E GT', price: '$49,850', mileage: '4,100 mi', stock: 'EV-3091' }
      ] } },
      { id: 'b5', type: 'service_offer', data: { headline: 'Seasonal Service Pass', discount: '$15 OFF', desc: 'Any fluid flush, brake inspection, or cabin air filter replacement.', code: 'NEWS-15' } },
      { id: 'b6', type: 'trade_cta', data: { headline: 'We Need Pre-Owned Trades', subheadline: 'Get an instant appraisal on your current vehicle today.', btnText: 'Get Trade Estimate' } },
      { id: 'b7', type: 'footer', data: { dealershipName: '{{dealership.name}}', showUnsub: true } }
    ]
  }
];
