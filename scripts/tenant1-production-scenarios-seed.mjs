/**
 * Empire tenant-1 production scenario seed.
 *
 * What it does:
 * - wipes tenant-1 operational CRM data (customers, leads, jobs, quotes, invoices, notes, attachments, etc.)
 * - keeps the tenant, staff memberships, auth, services, and job types intact
 * - replaces demo-looking catalog rows with live-looking supplier/product/template data
 * - seeds a realistic 14-day schedule with linked customers, sites, leads, jobs, appointments,
 *   quotes, invoice schedules, payments, compliance records, purchase orders, and visual files
 *
 * Run:
 *   node scripts/tenant1-production-scenarios-seed.mjs
 */

import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { requireCrmScriptConfig } from "./crm-env.mjs";

const { supabaseUrl, serviceRoleKey } = requireCrmScriptConfig(true);

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TENANT_SLUG = "empire-home-solutions";
const STAFF_PASSWORD = "Empire-Staff-2026!";
const STORAGE_BUCKET = "crm-uploads";

const STAFF = [
  { email: "admin@empirehomesolutions.local", fullName: "Empire CRM Admin", role: "admin", phone: "0208 555 0101", agreedHours: "Mon-Fri 08:00-18:00", payType: "salary" },
  { email: "engineer@empirehomesolutions.local", fullName: "Empire Field Engineer", role: "engineer", phone: "07700 300 101", agreedHours: "Mon-Fri 08:00-17:30", payType: "salary" },
  { email: "shaz@onlinebuzz.co.uk", fullName: "Shaz Iqbal", role: "engineer", phone: "07770 123 456", agreedHours: "Mon-Fri 08:00-17:00", payType: "day-rate" },
  { email: "ops@empirehomesolutions.local", fullName: "Claire Sutton", role: "management", phone: "07700 300 102", agreedHours: "Mon-Fri 07:30-17:30", payType: "salary" },
  { email: "sales@empirehomesolutions.local", fullName: "Ben Carter", role: "sales", phone: "07700 300 103", agreedHours: "Mon-Fri 09:00-18:00", payType: "salary" },
  { email: "accounts@empirehomesolutions.local", fullName: "Maria Ahmed", role: "accounts", phone: "07700 300 104", agreedHours: "Mon-Fri 09:00-17:30", payType: "salary" },
  { email: "luke.bennett@empirehomesolutions.local", fullName: "Luke Bennett", role: "engineer", phone: "07700 300 105", agreedHours: "Mon-Sat 07:30-16:30", payType: "day-rate" },
  { email: "amina.rahman@empirehomesolutions.local", fullName: "Amina Rahman", role: "engineer", phone: "07700 300 106", agreedHours: "Tue-Sat 08:00-17:00", payType: "day-rate" },
];

const SUPPLIERS = [
  { name: "Wolseley Uxbridge", category: "merchant", contact_name: "Trade Counter", email: "uxbridge@wolseley.example", phone: "01895 410 221", notes: "Primary boiler and cylinder merchant for install jobs." },
  { name: "City Plumbing Hayes", category: "merchant", contact_name: "Branch Desk", email: "hayes@cityplumbing.example", phone: "0208 845 4421", notes: "Used for plumbing consumables and same-day call-out parts." },
  { name: "Vaillant Advance Spares", category: "manufacturer", contact_name: "Spare Parts Desk", email: "advance@vaillant.example", phone: "0345 602 2922", notes: "Preferred for repair parts and warranty installs." },
  { name: "Grundfos Commercial Support", category: "manufacturer", contact_name: "Project Support", email: "support@grundfos.example", phone: "01525 850 000", notes: "Commercial pump and plantroom support." },
  { name: "Stuart Turner Distribution", category: "manufacturer", contact_name: "Trade Support", email: "trade@stuartturner.example", phone: "0191 516 2002", notes: "Used for shower pumps and boosting solutions." },
];

const PRODUCTS = [
  { supplier: "Wolseley Uxbridge", service: "boilers", category: "boiler", name: "Vaillant ecoTEC Plus 832 Combi", sku: "VAIL-832-COMBI", unit_cost: 1875, markup_percent: 29.33, sell_price: 2425, vat_category: "standard_20" },
  { supplier: "Wolseley Uxbridge", service: "boilers", category: "boiler", name: "Worcester 4000 30kW Combi", sku: "WORC-4000-30", unit_cost: 1695, markup_percent: 30.97, sell_price: 2220, vat_category: "standard_20" },
  { supplier: "City Plumbing Hayes", service: "power-flushing", category: "consumable", name: "Sentinel X800 Power Flush Pack", sku: "SENT-X800", unit_cost: 92, markup_percent: 57.61, sell_price: 145, vat_category: "standard_20" },
  { supplier: "City Plumbing Hayes", service: "plumbing", category: "controls", name: "Honeywell Home T6 Smart Thermostat", sku: "HONEY-T6", unit_cost: 118, markup_percent: 52.54, sell_price: 180, vat_category: "standard_20" },
  { supplier: "Wolseley Uxbridge", service: "cylinders", category: "cylinder", name: "Heatrae Sadia Megaflo Eco 210i", sku: "MEGAFLO-210I", unit_cost: 940, markup_percent: 38.30, sell_price: 1300, vat_category: "standard_20" },
  { supplier: "Grundfos Commercial Support", service: "commercial-boilers", category: "pump", name: "Grundfos MAGNA3 32-120", sku: "MAGNA3-32120", unit_cost: 620, markup_percent: 33.87, sell_price: 830, vat_category: "standard_20" },
];

const QUOTE_TEMPLATES = [
  {
    name: "Combi Boiler Swap",
    service: "boilers",
    jobType: "boiler-install",
    description: "Standard combi swap template with flue, filter, chemicals, and commissioning.",
    line_items: [
      { description: "Vaillant ecoTEC Plus 832 Combi", qty: 1, unit_price: 2425 },
      { description: "Horizontal flue and fitting kit", qty: 1, unit_price: 185 },
      { description: "Magnetic filter and system chemicals", qty: 1, unit_price: 225 },
      { description: "Installation labour and commissioning", qty: 1, unit_price: 1180 },
    ],
    optional_extras: [
      { description: "Smart thermostat upgrade", qty: 1, unit_price: 180 },
      { description: "System power flush", qty: 1, unit_price: 540 },
    ],
    payment_terms: { deposit: "25% on booking", stage: "50% on first install day", final: "Balance on handover" },
  },
  {
    name: "Unvented Cylinder Replacement",
    service: "cylinders",
    jobType: "unvented-cylinder",
    description: "Cylinder replacement with valves, discharge checks, and commissioning.",
    line_items: [
      { description: "Heatrae Sadia Megaflo Eco 210i", qty: 1, unit_price: 1300 },
      { description: "Controls, tundish, and safety valve kit", qty: 1, unit_price: 260 },
      { description: "Labour, discharge pipework, and commissioning", qty: 1, unit_price: 980 },
    ],
    optional_extras: [{ description: "Lime scale reducer", qty: 1, unit_price: 145 }],
    payment_terms: { deposit: "30% on booking", final: "Balance on commissioning" },
  },
  {
    name: "Power Flush - 10 Radiator System",
    service: "power-flushing",
    jobType: "power-flush",
    description: "Full system power flush including magnetic filter and inhibitor.",
    line_items: [
      { description: "System power flush labour", qty: 1, unit_price: 520 },
      { description: "Sentinel chemicals and inhibitor", qty: 1, unit_price: 145 },
      { description: "Magnetic filter supply and fit", qty: 1, unit_price: 180 },
    ],
    optional_extras: [{ description: "Thermostatic radiator valve replacement", qty: 2, unit_price: 45 }],
    payment_terms: { final: "Payment on completion" },
  },
];

const SCENARIOS = [
  {
    customer: {
      full_name: "Hannah Mercer",
      phone: "07800 410 001",
      email: "hannah.mercer@gmail.com",
      address_line1: "14 Cedar Lane",
      city: "Uxbridge",
      postcode: "UB8 2TR",
      property_type: "semi-detached",
      occupancy_type: "owner-occupier",
      source: "website booking form",
      notes: "Young family. Wants same-day updates by text.",
      site: { label: "Home", access_notes: "Ring doorbell. Toddler naps after lunch.", parking_notes: "Driveway on left, avoid blocking neighbour." },
      asset: { service: "boilers", asset_type: "boiler", make: "Ideal", model: "Logic+ C30", serial_number: "IDEAL-HM-3021", install_date: daysAgo(6 * 365), service_due_date: daysFromToday(40), warranty_end_date: daysFromToday(420), notes: "Pressure drops overnight below 0.5 bar." },
    },
    lead: {
      status: "booked",
      source: "website booking form",
      intake_source: "website",
      customer_match_result: "new",
      dedupe_result: "created",
      submission_count: 1,
      next_action_at: isoAtDay(0, "07:45"),
      notes: "Customer reports no hot water since last night.",
      noteBodies: [
        "Website enquiry received at 07:02. Customer reports boiler pressure dropping overnight and intermittent hot water.",
        "Ops called back at 07:20. Same-day diagnostic slot accepted and customer asked for arrival text.",
      ],
      attachments: [{ label: "pressure-gauge-before", extension: "svg" }],
    },
    job: {
      title: "No hot water and pressure loss diagnostic",
      service: "boilers",
      jobType: "boiler-repair",
      dayOffset: 0,
      time: "08:30",
      durationHours: 2,
      status: "in_progress",
      appointmentType: "booking",
      appointmentStatus: "scheduled",
      assignees: ["Empire Field Engineer"],
      notes: [
        { author: "Claire Sutton", body: "Job dispatched for first slot. Customer asked for engineer ETA by text." },
        { author: "Empire Field Engineer", body: "On site. Pressure dropped to 0.4 bar. Expansion vessel and filling loop under review." },
      ],
      photos: ["boiler-casing-before", "pressure-gauge-close-up", "filling-loop-layout"],
      hazards: [{ title: "Tight cupboard access", description: "Cupboard is narrow and storage shelves limit movement around the boiler.", status: "active" }],
      checklists: [{ title: "Initial diagnostics complete", notes: "Need photos of pressure gauge and discharge pipework.", status: "required" }],
      expenses: [{ description: "Call-out consumables", amount: 18, category: "materials" }],
    },
  },
  {
    customer: {
      full_name: "Peter Wills",
      phone: "07800 410 002",
      email: "peter.wills@outlook.com",
      address_line1: "22 Willowbank Road",
      city: "Hayes",
      postcode: "UB3 3LP",
      property_type: "terraced",
      occupancy_type: "owner-occupier",
      source: "repeat customer",
      notes: "Long-term service customer. Interested in smart controls.",
      site: { label: "Home", access_notes: "Side gate is stiff. Customer works from home upstairs.", parking_notes: "Street parking only." },
      asset: { service: "boilers", asset_type: "boiler", make: "Vaillant", model: "ecoTEC Pro 28", serial_number: "VAIL-PW-2218", install_date: daysAgo(7 * 365), service_due_date: daysFromToday(3), warranty_end_date: null, notes: "Annual service due and thermostat upgrade requested." },
    },
    job: {
      title: "Annual boiler service and smart thermostat survey",
      service: "boilers",
      jobType: "boiler-service",
      dayOffset: 0,
      time: "13:30",
      durationHours: 1.5,
      status: "booked",
      appointmentType: "booking",
      appointmentStatus: "scheduled",
      assignees: ["Shaz Iqbal"],
      notes: [
        { author: "Ben Carter", body: "Customer also wants a price to replace old thermostat with a smart controller while on site." },
      ],
      photos: ["boiler-front-elevation", "existing-controls"],
      quote: {
        documentType: "estimate",
        status: "sent",
        validUntilOffsetDays: 21,
        versions: [
          {
            version: 1,
            documentType: "estimate",
            status: "sent",
            changeSummary: "Smart thermostat add-on estimate sent ahead of service visit.",
            line_items: [{ description: "Honeywell Home T6 Smart Thermostat supply and fit", qty: 1, unit_price: 180 }],
          },
        ],
      },
    },
  },
  {
    customer: {
      full_name: "Farah Khan",
      phone: "07800 410 003",
      email: "farah.khan@gmail.com",
      address_line1: "8 Lime Tree Close",
      city: "Southall",
      postcode: "UB1 2EA",
      property_type: "semi-detached",
      occupancy_type: "owner-occupier",
      source: "google ads",
      notes: "Approved finance. Wants old boiler removed and kitchen left tidy each evening.",
      site: { label: "Home", access_notes: "Rear access through kitchen. Dog stays in lounge.", parking_notes: "Driveway fits one van." },
      asset: { service: "boilers", asset_type: "boiler", make: "Worcester", model: "Greenstar Ri", serial_number: "WORC-FK-2009", install_date: daysAgo(15 * 365), service_due_date: null, warranty_end_date: null, notes: "Current heat-only boiler and cylinder due for full combi swap." },
    },
    lead: {
      status: "accepted",
      source: "google ads",
      intake_source: "website",
      customer_match_result: "new",
      dedupe_result: "updated_existing",
      submission_count: 2,
      next_action_at: isoAtDay(1, "07:15"),
      notes: "Quote accepted and deposit paid. Customer resubmitted website form after booking to ask about flue boxing.",
      noteBodies: [
        "Lead converted from LP enquiry after same-day survey. Customer chose Vaillant option with smart controls.",
      ],
    },
    job: {
      title: "Vaillant combi swap and flue relocation",
      service: "boilers",
      jobType: "boiler-install",
      dayOffset: 1,
      time: "08:00",
      durationHours: 8,
      status: "booked",
      appointmentType: "booking",
      appointmentStatus: "scheduled",
      assignees: ["Empire Field Engineer", "Luke Bennett"],
      notes: [
        { author: "Claire Sutton", body: "Materials confirmed. Customer requested daily tidy-down and text on arrival." },
        { author: "Ben Carter", body: "Quote revised to include boxed flue section and wireless thermostat." },
      ],
      photos: ["old-heat-only-boiler", "existing-cylinder-cupboard", "flue-route-external"],
      phases: [
        { name: "Pre-start survey", description: "Measure flue route, confirm pipework alterations, confirm asbestos-free route.", status: "completed", sort_order: 1, targetOffsetDays: -2, completedOffsetDays: -2 },
        { name: "Materials ready", description: "Boiler, filter, flue, and chemicals checked into van.", status: "ready", sort_order: 2, targetOffsetDays: 0 },
        { name: "Installation day one", description: "Remove old boiler and cylinder, run new condensate and gas line upgrades.", status: "planned", sort_order: 3, targetOffsetDays: 1 },
        { name: "Commissioning and handover", description: "Benchmark, controls handover, and customer demo.", status: "planned", sort_order: 4, targetOffsetDays: 2 },
      ],
      variations: [{ title: "Additional boxed flue route", description: "Customer requested boxed section in utility room after survey.", estimated_value: 220, status: "approved" }],
      hazards: [
        { title: "Loft hatch near flue route", description: "Use crawl boards if entering loft void to inspect final flue route.", status: "mitigated" },
        { title: "Heavy manual handling", description: "Old cylinder removal requires two-person lift and dust sheets on staircase.", status: "active" },
      ],
      checklists: [
        { title: "Pre-install photos captured", notes: "Before photos required for old appliance and flue route.", status: "completed", completedOffsetDays: -2 },
        { title: "Commissioning pack ready", notes: "Benchmark, warranty registration, and customer handover pack to be completed on day two.", status: "required" },
      ],
      certificates: [{ title: "Gas Safe installation record", certificate_number: "GSI-260329-001", status: "draft", issuedOffsetDays: null, fileLabel: "gas-safe-installation-record" }],
      quote: {
        documentType: "quote",
        status: "accepted",
        validUntilOffsetDays: 30,
        versions: [
          {
            version: 1,
            documentType: "quote",
            status: "sent",
            changeSummary: "Initial survey quote issued.",
            line_items: [
              { description: "Vaillant ecoTEC Plus 832 Combi", qty: 1, unit_price: 2425 },
              { description: "Magnetic filter and chemicals", qty: 1, unit_price: 225 },
              { description: "Installation labour and controls", qty: 1, unit_price: 1180 },
            ],
          },
          {
            version: 2,
            documentType: "quote",
            status: "accepted",
            changeSummary: "Revised to include boxed flue route and wireless thermostat.",
            line_items: [
              { description: "Vaillant ecoTEC Plus 832 Combi", qty: 1, unit_price: 2425 },
              { description: "Magnetic filter and chemicals", qty: 1, unit_price: 225 },
              { description: "Wireless smart thermostat", qty: 1, unit_price: 180 },
              { description: "Installation labour and controls", qty: 1, unit_price: 1180 },
              { description: "Boxed flue route", qty: 1, unit_price: 220 },
            ],
          },
        ],
        acceptance: {
          accepted_by_name: "Farah Khan",
          accepted_by_email: "farah.khan@gmail.com",
          acceptance_method: "phone",
          notes: "Customer accepted revised scope and paid deposit by bank transfer.",
          acceptedOffsetDays: -1,
        },
        schedules: [
          { label: "Booking deposit", payment_type: "deposit", percentage: 25, fixed_amount: null, due_offset_days: -1, status: "paid", invoice_status: "paid", payment_status: "received", payment_offsetDays: -1 },
          { label: "First install day", payment_type: "stage", percentage: 50, fixed_amount: null, due_offset_days: 1, status: "planned" },
          { label: "Completion balance", payment_type: "final", percentage: 25, fixed_amount: null, due_offset_days: 2, status: "planned" },
        ],
      },
      purchaseOrders: [
        { supplier: "Wolseley Uxbridge", status: "issued", total_amount: 2265, notes: "Boiler, flue, filter, and chemicals ordered for collection.", issuedOffsetDays: -1 },
      ],
      reconciliation: [
        { supplier: "Wolseley Uxbridge", entry_type: "invoice", reference_number: "WOL-UXB-12872", amount: 2265, status: "open" },
      ],
      expenses: [{ description: "Congestion and parking", amount: 26, category: "travel" }],
    },
  },
  {
    customer: {
      full_name: "Daniel Brooks",
      phone: "07800 410 004",
      email: "daniel.brooks@brookslettings.co.uk",
      address_line1: "Brooks Lettings, 42 High Street",
      city: "Ruislip",
      postcode: "HA4 8LJ",
      property_type: "office",
      occupancy_type: "agent",
      source: "landlord account",
      notes: "Portfolio landlord. Prefers certificates emailed same day.",
      site: { label: "Flat 2, 17 Fern Court", address_line1: "17 Fern Court, Flat 2", city: "Northolt", postcode: "UB5 5DP", access_notes: "Tenant will be home from 10:45.", parking_notes: "Visitor bays at rear." },
      siteContact: { full_name: "Maya Brooks", phone: "07800 410 044", email: "maya.brooks@brookslettings.co.uk", role_label: "Property manager" },
      asset: { service: "boilers", asset_type: "boiler", make: "Baxi", model: "600 Combi", serial_number: "BAXI-DB-600", install_date: daysAgo(5 * 365), service_due_date: daysFromToday(1), warranty_end_date: daysFromToday(365), notes: "Tenant reports occasional banging from boiler casing." },
    },
    job: {
      title: "Landlord gas safety certificate and boiler service",
      service: "boilers",
      jobType: "gas-safety-cert",
      dayOffset: 1,
      time: "11:30",
      durationHours: 1.5,
      status: "booked",
      appointmentType: "booking",
      appointmentStatus: "scheduled",
      assignees: ["Amina Rahman"],
      notes: [
        { author: "Maria Ahmed", body: "Invoice to Brooks Lettings Ltd with PO reference BL-APR-17." },
      ],
      photos: ["meter-position", "boiler-serial-label"],
      checklists: [{ title: "Landlord cert paperwork pack", notes: "Tenant signature and meter reading required.", status: "required" }],
      certificates: [{ title: "CP12 Landlord Gas Safety Record", certificate_number: "CP12-260329-017", status: "draft", fileLabel: "cp12-record" }],
    },
  },
  {
    customer: {
      full_name: "Sandeep Gill",
      phone: "07800 410 005",
      email: "sandeep.gill@gmail.com",
      address_line1: "34 Kingswood Drive",
      city: "Harrow",
      postcode: "HA2 6EY",
      property_type: "detached",
      occupancy_type: "owner-occupier",
      source: "referral",
      notes: "Referred by Peter Wills. Wants system balanced properly before winter.",
      site: { label: "Home", access_notes: "Garage side door unlocked for hose route.", parking_notes: "Wide driveway for van." },
      asset: { service: "boilers", asset_type: "boiler", make: "Worcester", model: "CDi 29", serial_number: "WORC-SG-2911", install_date: daysAgo(12 * 365), service_due_date: daysFromToday(60), warranty_end_date: null, notes: "System slow to heat upstairs bedrooms." },
    },
    job: {
      title: "Power flush and magnetic filter installation",
      service: "power-flushing",
      jobType: "power-flush",
      dayOffset: 2,
      time: "09:00",
      durationHours: 6,
      status: "booked",
      appointmentType: "booking",
      appointmentStatus: "scheduled",
      assignees: ["Luke Bennett"],
      notes: [
        { author: "Claire Sutton", body: "Customer approved full flush package after survey and wants before/after temperature readings." },
      ],
      photos: ["radiator-sludge-sample", "system-filter-position"],
      hazards: [{ title: "Chemical handling", description: "Power flush chemicals stored in garage. Gloves and eye protection required.", status: "active" }],
      checklists: [{ title: "Before and after radiator temperatures", notes: "Capture kitchen, lounge, and master bedroom readings.", status: "required" }],
      quote: {
        documentType: "quote",
        status: "accepted",
        validUntilOffsetDays: 14,
        versions: [
          {
            version: 1,
            documentType: "quote",
            status: "accepted",
            changeSummary: "Accepted after referral visit.",
            line_items: [
              { description: "System power flush labour", qty: 1, unit_price: 520 },
              { description: "Sentinel chemicals and inhibitor", qty: 1, unit_price: 145 },
              { description: "Magnetic filter supply and fit", qty: 1, unit_price: 180 },
            ],
          },
        ],
        acceptance: {
          accepted_by_name: "Sandeep Gill",
          accepted_by_email: "sandeep.gill@gmail.com",
          acceptance_method: "email",
          notes: "Customer approved full power flush package from emailed quote.",
          acceptedOffsetDays: -1,
        },
        schedules: [{ label: "Completion invoice", payment_type: "final", percentage: 100, fixed_amount: null, due_offset_days: 2, status: "planned" }],
      },
      purchaseOrders: [{ supplier: "City Plumbing Hayes", status: "received", total_amount: 118, notes: "Chemicals and filter collected same morning.", issuedOffsetDays: 0 }],
      reconciliation: [{ supplier: "City Plumbing Hayes", entry_type: "invoice", reference_number: "CP-HAY-55218", amount: 118, status: "open" }],
    },
  },
  {
    customer: {
      full_name: "Laura Finch",
      phone: "07800 410 006",
      email: "laura.finch@gmail.com",
      address_line1: "9 Orchard View",
      city: "Iver",
      postcode: "SL0 9QF",
      property_type: "semi-detached",
      occupancy_type: "owner-occupier",
      source: "google ads",
      notes: "Kitchen cupboard ceiling height is tight above cylinder location.",
      site: { label: "Home", access_notes: "Customer on site all day. Side entrance preferred for tools.", parking_notes: "Driveway space available." },
      asset: { service: "cylinders", asset_type: "cylinder", make: "Telford", model: "Tempest 180", serial_number: "TELF-LF-180", install_date: daysAgo(14 * 365), service_due_date: null, warranty_end_date: null, notes: "Cylinder leaking from base and recovery is slow." },
    },
    lead: {
      status: "booked",
      source: "google ads",
      intake_source: "website",
      customer_match_result: "new",
      dedupe_result: "created",
      submission_count: 1,
      next_action_at: isoAtDay(3, "07:30"),
      notes: "Quote accepted for cylinder swap with scale reducer.",
      noteBodies: ["Cylinder replacement lead converted after photo review and same-day quote."],
    },
    job: {
      title: "Unvented cylinder replacement and controls refresh",
      service: "cylinders",
      jobType: "unvented-cylinder",
      dayOffset: 3,
      time: "08:30",
      durationHours: 7,
      status: "booked",
      appointmentType: "booking",
      appointmentStatus: "scheduled",
      assignees: ["Shaz Iqbal", "Amina Rahman"],
      notes: [
        { author: "Ben Carter", body: "Customer chose option including scale reducer due to local hard water." },
      ],
      photos: ["existing-cylinder-cupboard", "discharge-pipe-route"],
      phases: [
        { name: "Strip out", description: "Drain and remove failed cylinder, prep discharge route.", status: "planned", sort_order: 1, targetOffsetDays: 3 },
        { name: "New cylinder install", description: "Fit cylinder, controls, and scale reducer. Fill and commission.", status: "planned", sort_order: 2, targetOffsetDays: 3 },
      ],
      hazards: [{ title: "Hot water isolation", description: "Ensure supply isolated and discharge route verified before removal.", status: "active" }],
      checklists: [{ title: "Benchmark cylinder commissioning sheet", notes: "Record incoming pressure and expansion vessel charge.", status: "required" }],
      certificates: [{ title: "Unvented cylinder commissioning record", certificate_number: "UNV-260329-004", status: "draft", fileLabel: "unvented-commissioning-record" }],
      quote: {
        documentType: "quote",
        status: "accepted",
        validUntilOffsetDays: 21,
        versions: [
          {
            version: 1,
            documentType: "quote",
            status: "accepted",
            changeSummary: "Accepted cylinder replacement proposal.",
            line_items: [
              { description: "Heatrae Sadia Megaflo Eco 210i", qty: 1, unit_price: 1300 },
              { description: "Valve kit and discharge alterations", qty: 1, unit_price: 260 },
              { description: "Labour, commissioning, and controls", qty: 1, unit_price: 980 },
              { description: "Scale reducer", qty: 1, unit_price: 145 },
            ],
          },
        ],
        acceptance: {
          accepted_by_name: "Laura Finch",
          accepted_by_email: "laura.finch@gmail.com",
          acceptance_method: "phone",
          notes: "Customer approved after discussing recovery time improvement.",
          acceptedOffsetDays: -1,
        },
        schedules: [
          { label: "Booking deposit", payment_type: "deposit", percentage: 30, fixed_amount: null, due_offset_days: -1, status: "invoiced", invoice_status: "unpaid" },
          { label: "Completion balance", payment_type: "final", percentage: 70, fixed_amount: null, due_offset_days: 3, status: "planned" },
        ],
      },
      purchaseOrders: [{ supplier: "Wolseley Uxbridge", status: "issued", total_amount: 1040, notes: "Cylinder and valve kit to collect at 07:30 on install day.", issuedOffsetDays: 2 }],
      reconciliation: [{ supplier: "Wolseley Uxbridge", entry_type: "invoice", reference_number: "WOL-UXB-12901", amount: 1040, status: "open" }],
    },
  },
  {
    customer: {
      full_name: "Martin Osei",
      phone: "07800 410 007",
      email: "martin.osei@gmail.com",
      address_line1: "5 Turnberry Rise",
      city: "Gerrards Cross",
      postcode: "SL9 8PX",
      property_type: "detached",
      occupancy_type: "owner-occupier",
      source: "website brochure download",
      notes: "Warm lead for ASHP survey. Wants figures for grant eligibility.",
      site: { label: "Home", access_notes: "Meet customer at side gate for garden plant room discussion.", parking_notes: "Driveway fits two vans." },
    },
    lead: {
      status: "survey_booked",
      source: "website brochure download",
      intake_source: "website",
      customer_match_result: "new",
      dedupe_result: "created",
      submission_count: 1,
      next_action_at: isoAtDay(4, "09:00"),
      notes: "ASHP interest after reading grant funding page. Wants room-by-room heat loss survey.",
      noteBodies: [
        "Sales qualified property as detached with good garden access and existing radiator upgrades already partly completed.",
      ],
      attachments: [{ label: "garden-elevation", extension: "svg" }],
    },
    job: {
      title: "ASHP feasibility survey",
      service: "ashp",
      jobType: "ashp-install",
      dayOffset: 4,
      time: "10:30",
      durationHours: 2,
      status: "enquiry",
      appointmentType: "survey",
      appointmentStatus: "scheduled",
      assignees: ["Claire Sutton"],
      notes: [
        { author: "Ben Carter", body: "Customer wants grant-ready proposal and likely staged works plan." },
      ],
      photos: ["garden-unit-position", "consumer-unit-distance"],
      quote: {
        documentType: "estimate",
        status: "draft",
        validUntilOffsetDays: 30,
        versions: [
          {
            version: 1,
            documentType: "estimate",
            status: "draft",
            changeSummary: "ASHP budget estimate prepared for post-survey review.",
            line_items: [
              { description: "Air source heat pump design and survey", qty: 1, unit_price: 0 },
              { description: "Indicative grant-assisted install budget", qty: 1, unit_price: 9800 },
            ],
          },
        ],
      },
    },
  },
  {
    customer: {
      full_name: "Sophie Patel",
      phone: "07800 410 008",
      email: "sophie.patel@outlook.com",
      address_line1: "27 Ashbourne Way",
      city: "Wembley",
      postcode: "HA9 9ES",
      property_type: "terraced",
      occupancy_type: "owner-occupier",
      source: "builder referral",
      notes: "Builder handling tiling. Empire doing plumbing first-fix and second-fix return visit.",
      site: { label: "Home", access_notes: "Rear extension under construction. PPE required on entry.", parking_notes: "Permit scratch card under porch." },
    },
    job: {
      title: "Bathroom first-fix plumbing package",
      service: "plumbing",
      jobType: "plumbing-general",
      dayOffset: 5,
      time: "07:30",
      durationHours: 6,
      status: "booked",
      appointmentType: "booking",
      appointmentStatus: "scheduled",
      assignees: ["Luke Bennett"],
      notes: [
        { author: "Claire Sutton", body: "Builder wants wastes and shower valve position signed off before boarding walls." },
      ],
      photos: ["stud-wall-layout", "soil-stack-position"],
      phases: [
        { name: "First fix", description: "Wastes, feeds, tray, and shower valve position.", status: "planned", sort_order: 1, targetOffsetDays: 5 },
        { name: "Second fix return", description: "Return after tiling for sanitaryware and brassware install.", status: "planned", sort_order: 2, targetOffsetDays: 11 },
      ],
      quote: {
        documentType: "quote",
        status: "accepted",
        validUntilOffsetDays: 21,
        versions: [
          {
            version: 1,
            documentType: "quote",
            status: "accepted",
            changeSummary: "Accepted builder referral plumbing package.",
            line_items: [
              { description: "Bathroom first-fix plumbing labour", qty: 1, unit_price: 780 },
              { description: "Wastes, valves, and consumables", qty: 1, unit_price: 220 },
              { description: "Second-fix return visit", qty: 1, unit_price: 460 },
            ],
          },
        ],
        acceptance: {
          accepted_by_name: "Sophie Patel",
          accepted_by_email: "sophie.patel@outlook.com",
          acceptance_method: "email",
          notes: "Accepted after builder sign-off on scope.",
          acceptedOffsetDays: -2,
        },
        schedules: [
          { label: "First-fix payment", payment_type: "stage", percentage: 60, fixed_amount: null, due_offset_days: 5, status: "planned" },
          { label: "Second-fix balance", payment_type: "final", percentage: 40, fixed_amount: null, due_offset_days: 11, status: "planned" },
        ],
      },
    },
  },
  {
    customer: {
      full_name: "Oakridge Dental Practice",
      phone: "0208 410 0911",
      email: "facilities@oakridgedental.co.uk",
      address_line1: "1 Windsor Parade",
      city: "Uxbridge",
      postcode: "UB10 0QH",
      property_type: "commercial",
      occupancy_type: "business",
      source: "commercial referral",
      notes: "Need morning survey before surgeries begin. Plant room access through rear alley.",
      site: { label: "Practice Plant Room", access_notes: "Meet site manager at rear loading door.", parking_notes: "Commercial bay behind premises." },
      siteContact: { full_name: "Nadia Ellis", phone: "07700 410 081", email: "nadia.ellis@oakridgedental.co.uk", role_label: "Facilities manager" },
    },
    lead: {
      status: "quoted",
      source: "commercial referral",
      intake_source: "manual",
      customer_match_result: "new",
      dedupe_result: "created",
      submission_count: 1,
      next_action_at: isoAtDay(6, "16:00"),
      notes: "Commercial plant room survey complete. Waiting on decision for summer replacement project.",
      noteBodies: ["Warm commercial lead. Client wants phased replacement options to avoid surgery downtime."],
    },
    job: {
      title: "Commercial plant room replacement survey",
      service: "commercial-boilers",
      jobType: "commercial-install",
      dayOffset: 6,
      time: "14:00",
      durationHours: 2.5,
      status: "enquiry",
      appointmentType: "survey",
      appointmentStatus: "scheduled",
      assignees: ["Claire Sutton", "Shaz Iqbal"],
      notes: [
        { author: "Ben Carter", body: "Client asked for phased replacement costings with out-of-hours switchover options." },
      ],
      photos: ["plant-room-overview", "existing-header-layout", "pump-serial-label"],
      quote: {
        documentType: "estimate",
        status: "sent",
        validUntilOffsetDays: 45,
        versions: [
          {
            version: 1,
            documentType: "estimate",
            status: "sent",
            changeSummary: "Budget estimate issued pending full design package.",
            line_items: [
              { description: "Commercial boiler replacement budget estimate", qty: 1, unit_price: 18450 },
              { description: "Pump and header modifications", qty: 1, unit_price: 2650 },
            ],
          },
        ],
      },
    },
  },
  {
    customer: {
      full_name: "Emma Carlisle",
      phone: "07800 410 009",
      email: "emma.carlisle@gmail.com",
      address_line1: "61 Beechwood Avenue",
      city: "Beaconsfield",
      postcode: "HP9 2XR",
      property_type: "detached",
      occupancy_type: "owner-occupier",
      source: "referral",
      notes: "Busy household. Wants install finished before flooring contractor starts.",
      site: { label: "Home", access_notes: "Alarm code to be provided morning of install.", parking_notes: "Driveway can take two vans." },
      asset: { service: "boilers", asset_type: "boiler", make: "Ideal", model: "Mexico FF", serial_number: "IDEAL-EC-1998", install_date: daysAgo(28 * 365), service_due_date: null, warranty_end_date: null, notes: "Very old boiler due for full replacement." },
    },
    job: {
      title: "Worcester combi conversion with finance",
      service: "boilers",
      jobType: "boiler-install",
      dayOffset: 7,
      time: "08:00",
      durationHours: 8,
      status: "booked",
      appointmentType: "booking",
      appointmentStatus: "scheduled",
      assignees: ["Empire Field Engineer", "Amina Rahman"],
      notes: [
        { author: "Maria Ahmed", body: "Finance application approved. Customer signed finance docs digitally." },
      ],
      photos: ["old-back-boiler-cupboard", "loft-feed-and-expansion"],
      phases: [
        { name: "Strip out and pipe alterations", description: "Remove legacy boiler and prepare combi pipework.", status: "ready", sort_order: 1, targetOffsetDays: 7 },
        { name: "Install and commission", description: "Fit boiler, flue, and smart controls. Complete handover.", status: "planned", sort_order: 2, targetOffsetDays: 8 },
      ],
      quote: {
        documentType: "quote",
        status: "accepted",
        validUntilOffsetDays: 30,
        versions: [
          {
            version: 1,
            documentType: "quote",
            status: "accepted",
            changeSummary: "Finance-backed combi conversion accepted.",
            line_items: [
              { description: "Worcester 4000 30kW Combi", qty: 1, unit_price: 2220 },
              { description: "Flue, filter, and smart controls", qty: 1, unit_price: 460 },
              { description: "Installation labour and commissioning", qty: 1, unit_price: 1320 },
            ],
          },
        ],
        acceptance: {
          accepted_by_name: "Emma Carlisle",
          accepted_by_email: "emma.carlisle@gmail.com",
          acceptance_method: "email",
          notes: "Accepted with finance plan over 24 months.",
          acceptedOffsetDays: -3,
        },
        schedules: [
          { label: "Finance-funded install", payment_type: "finance", percentage: 100, fixed_amount: null, due_offset_days: 8, status: "planned" },
        ],
      },
      purchaseOrders: [{ supplier: "Wolseley Uxbridge", status: "issued", total_amount: 2015, notes: "Worcester boiler and flue kit reserved for collection.", issuedOffsetDays: 6 }],
      reconciliation: [{ supplier: "Wolseley Uxbridge", entry_type: "invoice", reference_number: "WOL-UXB-12988", amount: 2015, status: "open" }],
    },
  },
  {
    customer: {
      full_name: "Joel Morrow",
      phone: "07800 410 010",
      email: "joel.morrow@gmail.com",
      address_line1: "7 Elm Court",
      city: "Slough",
      postcode: "SL1 5AP",
      property_type: "flat",
      occupancy_type: "owner-occupier",
      source: "existing customer",
      notes: "Cylinder service due. Wants engineer to check immersion while onsite.",
      site: { label: "Home", access_notes: "Parking behind block. Call on arrival for gate code.", parking_notes: "Use visitor bay 12." },
      asset: { service: "cylinders", asset_type: "cylinder", make: "Megaflo", model: "Eco 170", serial_number: "MEGA-JM-170", install_date: daysAgo(4 * 365), service_due_date: daysFromToday(10), warranty_end_date: daysFromToday(730), notes: "Annual maintenance visit due." },
    },
    job: {
      title: "Annual cylinder service and immersion check",
      service: "cylinders",
      jobType: "vented-cylinder",
      dayOffset: 9,
      time: "11:00",
      durationHours: 1.5,
      status: "booked",
      appointmentType: "booking",
      appointmentStatus: "scheduled",
      assignees: ["Shaz Iqbal"],
      notes: [{ author: "Claire Sutton", body: "Customer requested immersion check as hot water was slow after off-peak cycle." }],
      photos: ["cylinder-controls", "immersion-switch"],
      checklists: [{ title: "Cylinder service checklist", notes: "Check expansion vessel pressure and tundish route.", status: "required" }],
      certificates: [{ title: "Cylinder service record", certificate_number: "CSR-260329-010", status: "draft", fileLabel: "cylinder-service-record" }],
    },
  },
  {
    customer: {
      full_name: "Chloe Abrams",
      phone: "07800 410 011",
      email: "chloe.abrams@icloud.com",
      address_line1: "19 Woodberry Grove",
      city: "Greenford",
      postcode: "UB6 0QS",
      property_type: "terraced",
      occupancy_type: "owner-occupier",
      source: "website booking form",
      notes: "Needs stopcock replaced and under-sink leak resolved before decorator returns.",
      site: { label: "Home", access_notes: "Customer working from kitchen table. Keep water isolation updates clear.", parking_notes: "Street parking on opposite side after 10am." },
    },
    job: {
      title: "Stopcock replacement and kitchen leak trace",
      service: "plumbing",
      jobType: "plumbing-general",
      dayOffset: 0,
      time: "15:30",
      durationHours: 3,
      status: "completed",
      appointmentType: "booking",
      appointmentStatus: "completed",
      assignees: ["Amina Rahman"],
      notes: [
        { author: "Amina Rahman", body: "Main stopcock seized. Replaced stopcock and remade compression joint under sink. System pressure stable after 30-minute test." },
      ],
      photos: ["stopcock-before", "stopcock-after", "sink-joint-remade"],
      expenses: [{ description: "22mm stopcock and fittings", amount: 24, category: "materials" }],
      quote: {
        documentType: "quote",
        status: "accepted",
        validUntilOffsetDays: 7,
        versions: [
          {
            version: 1,
            documentType: "quote",
            status: "accepted",
            changeSummary: "Approved same-day plumbing repair.",
            line_items: [
              { description: "Stopcock replacement and leak repair", qty: 1, unit_price: 185 },
              { description: "22mm fittings and consumables", qty: 1, unit_price: 24 },
            ],
          },
        ],
        acceptance: {
          accepted_by_name: "Chloe Abrams",
          accepted_by_email: "chloe.abrams@icloud.com",
          acceptance_method: "phone",
          notes: "Customer accepted fixed price before work started.",
          acceptedOffsetDays: 0,
        },
        schedules: [{ label: "Completion invoice", payment_type: "final", percentage: 100, fixed_amount: null, due_offset_days: 0, status: "invoiced", invoice_status: "unpaid" }],
      },
    },
  },
  {
    customer: {
      full_name: "Stanmore Lettings Ltd",
      phone: "0208 410 4400",
      email: "compliance@stanmorelettings.co.uk",
      address_line1: "58 Station Approach",
      city: "Stanmore",
      postcode: "HA7 4PD",
      property_type: "office",
      occupancy_type: "agent",
      source: "landlord account",
      notes: "Portfolio gas safety renewals for three HMOs. Wants one consolidated invoice.",
      site: { label: "14 Almond House", address_line1: "14 Almond House", city: "Hayes", postcode: "UB4 8QE", access_notes: "Caretaker opens meter cupboard at 08:15.", parking_notes: "Permit available from caretaker." },
      siteContact: { full_name: "Rita Mistry", phone: "07800 410 099", email: "rita.mistry@stanmorelettings.co.uk", role_label: "Compliance coordinator" },
    },
    job: {
      title: "Landlord annual service block - Almond House",
      service: "boilers",
      jobType: "gas-safety-cert",
      dayOffset: 11,
      time: "08:30",
      durationHours: 3,
      status: "booked",
      appointmentType: "booking",
      appointmentStatus: "scheduled",
      assignees: ["Empire Field Engineer"],
      notes: [
        { author: "Maria Ahmed", body: "Client wants one monthly consolidated invoice. Tag any remedial works separately." },
      ],
      photos: ["meter-cupboard", "boiler-label-flat14"],
      checklists: [{ title: "Portfolio cert pack", notes: "Record all tenant names and meter serials before leaving site.", status: "required" }],
      certificates: [{ title: "Portfolio CP12 record", certificate_number: "CP12-260329-114", status: "draft", fileLabel: "portfolio-cp12-record" }],
    },
  },
  {
    customer: {
      full_name: "Mike Nash",
      phone: "07800 410 012",
      email: "mike.nash@gmail.com",
      address_line1: "3 Rowan Court",
      city: "Denham",
      postcode: "UB9 4AE",
      property_type: "detached",
      occupancy_type: "owner-occupier",
      source: "website booking form",
      notes: "New house purchase. Wants boiler replacement options before exchanging.",
      site: { label: "Home", access_notes: "Estate agent meeting customer onsite for first visit.", parking_notes: "Driveway available." },
    },
    lead: {
      status: "quoted",
      source: "website booking form",
      intake_source: "website",
      customer_match_result: "new",
      dedupe_result: "created",
      submission_count: 1,
      next_action_at: isoAtDay(12, "15:30"),
      notes: "Budget and premium boiler options requested.",
      noteBodies: [
        "Customer wants two options before exchange: standard combi swap and premium system with weather compensation.",
      ],
    },
    job: {
      title: "Boiler replacement options survey",
      service: "boilers",
      jobType: "boiler-install",
      dayOffset: 12,
      time: "13:30",
      durationHours: 1.5,
      status: "enquiry",
      appointmentType: "survey",
      appointmentStatus: "scheduled",
      assignees: ["Ben Carter"],
      notes: [{ author: "Ben Carter", body: "Two-tier proposal requested before exchange date." }],
      photos: ["boiler-room-wide", "existing-flue-path"],
      quote: {
        documentType: "estimate",
        status: "sent",
        validUntilOffsetDays: 30,
        versions: [
          {
            version: 1,
            documentType: "estimate",
            status: "sent",
            changeSummary: "Issued budget and premium option estimate.",
            line_items: [
              { description: "Budget combi swap option", qty: 1, unit_price: 3150 },
              { description: "Premium controls and flush option", qty: 1, unit_price: 3980 },
            ],
          },
        ],
      },
    },
  },
  {
    customer: {
      full_name: "Rita Begum",
      phone: "07800 410 013",
      email: "rita.begum@gmail.com",
      address_line1: "48 Willow Road",
      city: "Northolt",
      postcode: "UB5 6SE",
      property_type: "semi-detached",
      occupancy_type: "owner-occupier",
      source: "existing customer",
      notes: "Intermittent hot water in shower only. Wants afternoon slot after school run.",
      site: { label: "Home", access_notes: "Use back door if front porch is locked.", parking_notes: "Street parking unrestricted after 11am." },
      asset: { service: "boilers", asset_type: "boiler", make: "Baxi", model: "EcoBlue 24", serial_number: "BAXI-RB-2405", install_date: daysAgo(3 * 365), service_due_date: daysFromToday(120), warranty_end_date: daysFromToday(540), notes: "Suspected diverter issue causing intermittent hot water at shower." },
    },
    job: {
      title: "Intermittent hot water fault investigation",
      service: "boilers",
      jobType: "boiler-repair",
      dayOffset: 7,
      time: "14:30",
      durationHours: 2,
      status: "booked",
      appointmentType: "booking",
      appointmentStatus: "scheduled",
      assignees: ["Shaz Iqbal"],
      notes: [{ author: "Claire Sutton", body: "Customer says kitchen tap hot water is fine; shower cuts out after a minute." }],
      photos: ["shower-valve", "boiler-controls-panel"],
    },
  },
  {
    customer: {
      full_name: "Oliver Reed",
      phone: "07800 410 014",
      email: "oliver.reed@gmail.com",
      address_line1: "11 Berkeley Gardens",
      city: "Hillingdon",
      postcode: "UB10 8AT",
      property_type: "terraced",
      occupancy_type: "owner-occupier",
      source: "website booking form",
      notes: "Just moved in. Wants quick stop-start snagging jobs over two visits.",
      site: { label: "Home", access_notes: "Loose floorboards in landing. Watch step carrying tools upstairs.", parking_notes: "Street parking outside property." },
    },
    job: {
      title: "New-home snagging plumbing list",
      service: "plumbing",
      jobType: "plumbing-general",
      dayOffset: 13,
      time: "09:00",
      durationHours: 4,
      status: "booked",
      appointmentType: "booking",
      appointmentStatus: "scheduled",
      assignees: ["Luke Bennett"],
      notes: [{ author: "Ben Carter", body: "Customer has three small items: leaking WC inlet, dripping tap, and isolate outside tap for winter." }],
      photos: ["wc-inlet-valve", "kitchen-tap-drip"],
      quote: {
        documentType: "quote",
        status: "sent",
        validUntilOffsetDays: 14,
        versions: [
          {
            version: 1,
            documentType: "quote",
            status: "sent",
            changeSummary: "Snagging list quote sent after walkthrough.",
            line_items: [
              { description: "Snagging plumbing labour", qty: 1, unit_price: 240 },
              { description: "Small fittings and consumables", qty: 1, unit_price: 35 },
            ],
          },
        ],
      },
    },
  },
  {
    customer: {
      full_name: "Sarah Wood",
      phone: "07800 410 015",
      email: "sarah.wood@gmail.com",
      address_line1: "91 Belgrave Road",
      city: "Ealing",
      postcode: "W5 1PT",
      property_type: "flat",
      occupancy_type: "owner-occupier",
      source: "referral",
      notes: "Wants quotes compared before deciding between flush and radiator replacement.",
      site: { label: "Home", access_notes: "Top-floor flat with narrow stairs. Call on approach.", parking_notes: "Permit available from concierge." },
    },
    lead: {
      status: "new",
      source: "referral",
      service: "power-flushing",
      jobType: "power-flush",
      intake_source: "manual",
      customer_match_result: "new",
      dedupe_result: "created",
      submission_count: 1,
      next_action_at: isoAtDay(1, "15:00"),
      notes: "Referred by Hannah Mercer for upstairs radiators staying cold.",
      noteBodies: ["Need triage call and likely survey slot for flush versus partial radiator replacement."],
    },
  },
  {
    customer: {
      full_name: "Imran Qureshi",
      phone: "07800 410 016",
      email: "imran.q@gmail.com",
      address_line1: "4 Maple Terrace",
      city: "Watford",
      postcode: "WD17 3BS",
      property_type: "semi-detached",
      occupancy_type: "owner-occupier",
      source: "facebook",
      notes: "General plumbing enquiry plus outside tap relocation.",
      site: { label: "Home", access_notes: "Customer on night shifts. Prefers after-10am callback.", parking_notes: "Driveway clear after 10am." },
    },
    lead: {
      status: "contacted",
      source: "facebook",
      service: "plumbing",
      jobType: "plumbing-general",
      intake_source: "website",
      customer_match_result: "new",
      dedupe_result: "created",
      submission_count: 1,
      next_action_at: isoAtDay(2, "10:30"),
      notes: "Quoted rough budget on phone. Waiting for photos of current pipework.",
      noteBodies: ["Lead contacted. Customer to send photos before survey is booked."],
      attachments: [{ label: "outside-tap-current-position", extension: "svg" }],
    },
  },
  {
    customer: {
      full_name: "Reece Talbot",
      phone: "07800 410 017",
      email: "reece.talbot@gmail.com",
      address_line1: "12 Station View",
      city: "Hayes",
      postcode: "UB4 0EN",
      property_type: "flat",
      occupancy_type: "tenant",
      source: "website booking form",
      notes: "Wants finance options for boiler replacement in rented flat he is buying from landlord.",
      site: { label: "Flat 12", access_notes: "Flat buzzer 12. Please text before arrival.", parking_notes: "Pay-by-phone only." },
    },
    lead: {
      status: "follow_up",
      source: "website booking form",
      service: "boilers",
      jobType: "boiler-install",
      intake_source: "website",
      customer_match_result: "new",
      dedupe_result: "updated_existing",
      submission_count: 2,
      next_action_at: isoAtDay(3, "14:15"),
      notes: "Customer resubmitted after finance calculator page. Needs funding discussion before survey.",
      noteBodies: ["Finance-focused lead. Sales to call with monthly repayment examples before booking survey."],
    },
  },
  {
    customer: {
      full_name: "Harper Estates",
      phone: "0208 410 5566",
      email: "projects@harperestates.co.uk",
      address_line1: "68 Crown Walk",
      city: "Wembley",
      postcode: "HA9 8HU",
      property_type: "office",
      occupancy_type: "agent",
      source: "commercial referral",
      notes: "Looking at summer works list across two managed blocks.",
      site: { label: "Managed Block A", address_line1: "Block A, 21 Kendal House", city: "Wembley", postcode: "HA9 8HZ", access_notes: "Meet site supervisor at loading bay.", parking_notes: "Trade bay behind shutter." },
      siteContact: { full_name: "Mikael Jones", phone: "07800 410 188", email: "mikael.jones@harperestates.co.uk", role_label: "Site supervisor" },
    },
    lead: {
      status: "survey_booked",
      source: "commercial referral",
      service: "commercial-boilers",
      jobType: "commercial-install",
      intake_source: "manual",
      customer_match_result: "new",
      dedupe_result: "created",
      submission_count: 1,
      next_action_at: isoAtDay(5, "13:00"),
      notes: "Commercial replacement survey booked for managed block boiler room.",
      noteBodies: ["Need survey notes focused on phased replacement and service contract options."],
    },
  },
];

function log(message) {
  console.log(message);
}

function yearNow() {
  return new Date().getFullYear();
}

function daysFromToday(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function daysAgo(offset) {
  return daysFromToday(-offset);
}

function isoAtDay(offset, hhmm) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString();
}

function plusHours(isoString, hours) {
  const date = new Date(isoString);
  date.setMinutes(date.getMinutes() + Math.round(hours * 60));
  return date.toISOString();
}

function buildQuoteNumber(sequence, year = yearNow()) {
  return `Q-${year}-${String(sequence).padStart(4, "0")}`;
}

function buildInvoiceNumber(sequence, year = yearNow()) {
  return `INV-${year}-${String(sequence).padStart(4, "0")}`;
}

function buildPoNumber(sequence, year = yearNow()) {
  return `PO-${year}-${String(sequence).padStart(4, "0")}`;
}

function sumLineItems(lineItems) {
  return Number(lineItems.reduce((sum, item) => sum + item.qty * item.unit_price, 0).toFixed(2));
}

function chunk(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function findUserByEmail(email) {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw error;
    }
    const user = data.users.find((entry) => entry.email?.toLowerCase() === email.toLowerCase());
    if (user) {
      return user;
    }
    if (data.users.length < 200) {
      return null;
    }
    page += 1;
  }
}

async function ensureUser(email, password, fullName) {
  let user = await findUserByEmail(email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) {
      throw new Error(error?.message ?? `Failed to create auth user ${email}`);
    }
    user = data.user;
    log(`  created auth user ${email}`);
  }
  return user;
}

async function waitForProfile(userId, tenantId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data } = await admin
      .schema("crm")
      .from("user_profiles")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      return data;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(`Timed out waiting for profile user=${userId} tenant=${tenantId}`);
}

async function ensureTenant() {
  const { data, error } = await admin.schema("crm").from("tenants").select("*").eq("slug", TENANT_SLUG).single();
  if (error || !data) {
    throw new Error(error?.message ?? `Could not load tenant ${TENANT_SLUG}`);
  }
  return data;
}

async function ensureStaffProfiles(tenantId) {
  const staffMap = new Map();

  for (const member of STAFF) {
    const user = await ensureUser(member.email, STAFF_PASSWORD, member.fullName);

    const { error: membershipError } = await admin.schema("crm").from("tenant_memberships").upsert(
      {
        tenant_id: tenantId,
        user_id: user.id,
        role: member.role,
        active: true,
        is_owner: member.email === "admin@empirehomesolutions.local",
        is_demo: false,
      },
      { onConflict: "tenant_id,user_id" },
    );
    if (membershipError) {
      throw membershipError;
    }

    const { error: profileError } = await admin.schema("crm").from("user_profiles").upsert(
      {
        tenant_id: tenantId,
        user_id: user.id,
        role: member.role,
        full_name: member.fullName,
        phone: member.phone,
        email: member.email,
        agreed_hours: member.agreedHours,
        pay_type: member.payType,
        active: true,
        is_demo: false,
        demo_scenario_key: null,
      },
      { onConflict: "tenant_id,user_id" },
    );
    if (profileError) {
      throw profileError;
    }

    const profile = await waitForProfile(user.id, tenantId);
    staffMap.set(member.fullName, { ...member, userId: user.id, profileId: profile.id });
  }

  return staffMap;
}

async function seedStaffCertifications(tenantId, staffMap) {
  await admin.schema("crm").from("user_certifications").delete().eq("tenant_id", tenantId);

  const certifications = [
    { name: "Empire Field Engineer", title: "Gas Safe Registration", category: "qualification", issuer: "Gas Safe Register", issue_date: daysAgo(300), expiry_date: daysFromToday(65), reminder_days_before: 45, notes: "Domestic natural gas and LPG scope." },
    { name: "Shaz Iqbal", title: "Unvented Hot Water", category: "training", issuer: "BPEC", issue_date: daysAgo(220), expiry_date: daysFromToday(420), reminder_days_before: 60, notes: "G3 compliant for unvented cylinder work." },
    { name: "Luke Bennett", title: "Asbestos Awareness", category: "training", issuer: "UKATA", issue_date: daysAgo(90), expiry_date: daysFromToday(275), reminder_days_before: 30, notes: "Annual refresher completed." },
    { name: "Amina Rahman", title: "Water Regulations", category: "qualification", issuer: "WRAS", issue_date: daysAgo(160), expiry_date: daysFromToday(520), reminder_days_before: 60, notes: "Approved for plumbing compliance inspections." },
  ];

  for (const certification of certifications) {
    const staff = staffMap.get(certification.name);
    if (!staff) {
      continue;
    }

    const { error } = await admin.schema("crm").from("user_certifications").insert({
      id: randomUUID(),
      tenant_id: tenantId,
      user_profile_id: staff.profileId,
      title: certification.title,
      category: certification.category,
      issuer: certification.issuer,
      issue_date: certification.issue_date,
      expiry_date: certification.expiry_date,
      reminder_days_before: certification.reminder_days_before,
      notes: certification.notes,
      is_demo: false,
      demo_scenario_key: null,
    });

    if (error) {
      throw error;
    }
  }
}

async function nextSequence(sequenceKey, tenantId) {
  const { data, error } = await admin.schema("crm").rpc("next_sequence", {
    p_sequence_key: sequenceKey,
    p_tenant_id: tenantId,
  });
  if (error || typeof data !== "number") {
    throw new Error(error?.message ?? `Could not allocate ${sequenceKey} sequence`);
  }
  return data;
}

function buildPhotoSvg(title, subtitle, accent = "#2563eb") {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${accent}" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#bg)" />
      <rect x="72" y="72" width="1456" height="756" rx="28" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" />
      <text x="120" y="220" font-family="Arial, sans-serif" font-size="70" font-weight="700" fill="#ffffff">${title}</text>
      <text x="120" y="300" font-family="Arial, sans-serif" font-size="34" fill="rgba(255,255,255,0.86)">${subtitle}</text>
      <text x="120" y="760" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.78)">Empire CRM seeded scenario photo</text>
    </svg>`,
  );
}

function buildPdfBuffer(title, reference) {
  const safeTitle = title.replace(/[()]/g, "");
  const safeReference = reference.replace(/[()]/g, "");
  const stream = `BT /F1 22 Tf 72 760 Td (${safeTitle}) Tj ET\nBT /F1 12 Tf 72 720 Td (Reference: ${safeReference}) Tj ET\nBT /F1 12 Tf 72 690 Td (Generated for tenant 1 production scenario seeding.) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length ${stream.length} >> stream
${stream}
endstream endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000062 00000 n 
0000000119 00000 n 
0000000246 00000 n 
0000000316 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
${390 + stream.length}
%%EOF`;
  return Buffer.from(pdf);
}

async function uploadStorageObject(path, body, contentType) {
  const response = await admin.storage.from(STORAGE_BUCKET).upload(path, body, {
    upsert: true,
    contentType,
  });
  if (response.error) {
    throw response.error;
  }
}

async function createAttachment({ tenantId, entityType, entityId, fileName, fileType, createdBy, body, contentType }) {
  const storagePath = `${tenantId}/${entityType}/${entityId}/${Date.now()}-${fileName}`;
  await uploadStorageObject(storagePath, body, contentType);

  const { data, error } = await admin.schema("crm").from("attachments").insert({
    id: randomUUID(),
    tenant_id: tenantId,
    entity_type: entityType,
    entity_id: entityId,
    file_name: fileName,
    file_url: storagePath,
    file_type: fileType,
    created_by: createdBy,
    is_demo: false,
    demo_scenario_key: null,
  }).select("*").single();

  if (error || !data) {
    throw new Error(error?.message ?? `Could not create attachment ${fileName}`);
  }

  return data;
}

async function createCertificateFile({ tenantId, jobId, title, reference }) {
  const fileName = `${reference.toLowerCase()}.pdf`;
  const storagePath = `${tenantId}/job/${jobId}/${Date.now()}-${fileName}`;
  await uploadStorageObject(storagePath, buildPdfBuffer(title, reference), "application/pdf");
  return storagePath;
}

async function removeStoragePaths(paths) {
  if (!paths.length) {
    return;
  }

  for (const part of chunk(paths, 100)) {
    const { error } = await admin.storage.from(STORAGE_BUCKET).remove(part);
    if (error) {
      log(`  storage remove warning: ${error.message}`);
    }
  }
}

async function wipeTenantOperationalData(tenantId) {
  log("2. Wiping tenant-1 operational data...");

  const [attachmentsResult, certificatesResult, customersResult, leadsResult, jobsResult, quotesResult, invoicesResult] = await Promise.all([
    admin.schema("crm").from("attachments").select("file_url, entity_type, entity_id").eq("tenant_id", tenantId),
    admin.schema("crm").from("job_certificates").select("file_url").eq("tenant_id", tenantId),
    admin.schema("crm").from("customers").select("id").eq("tenant_id", tenantId),
    admin.schema("crm").from("leads").select("id").eq("tenant_id", tenantId),
    admin.schema("crm").from("jobs").select("id").eq("tenant_id", tenantId),
    admin.schema("crm").from("quotes").select("id").eq("tenant_id", tenantId),
    admin.schema("crm").from("invoices").select("id").eq("tenant_id", tenantId),
  ]);

  const entityIdsByType = {
    customer: (customersResult.data ?? []).map((row) => row.id),
    lead: (leadsResult.data ?? []).map((row) => row.id),
    job: (jobsResult.data ?? []).map((row) => row.id),
    quote: (quotesResult.data ?? []).map((row) => row.id),
    invoice: (invoicesResult.data ?? []).map((row) => row.id),
  };

  const storagePaths = [
    ...(attachmentsResult.data ?? []).map((row) => row.file_url).filter(Boolean),
    ...(certificatesResult.data ?? []).map((row) => row.file_url).filter(Boolean),
  ];

  for (const [entityType, ids] of Object.entries(entityIdsByType)) {
    if (!ids.length) {
      continue;
    }
    const { error } = await admin
      .schema("crm")
      .from("custom_field_values")
      .delete()
      .eq("entity_type", entityType)
      .in("entity_id", ids);
    if (error && !error.message.includes("custom_field_values")) {
      throw error;
    }
  }

  const orderedDeletes = [
    "supplier_reconciliation",
    "purchase_orders",
    "job_certificates",
    "job_checklists",
    "job_hazards",
    "job_variations",
    "job_phases",
    "job_assignees",
    "invoice_schedules",
    "quote_acceptances",
    "quote_versions",
    "payments",
    "expenses",
    "appointments",
    "attachments",
    "notes",
    "customer_assets",
    "invoices",
    "quotes",
    "site_contacts",
    "sites",
    "leads",
    "jobs",
    "customers",
    "products",
    "quote_templates",
    "suppliers",
  ];

  for (const table of orderedDeletes) {
    const { error } = await admin.schema("crm").from(table).delete().eq("tenant_id", tenantId);
    if (error) {
      throw new Error(`Could not wipe ${table}: ${error.message}`);
    }
  }

  await admin.schema("crm").from("number_sequences").delete().eq("tenant_id", tenantId);
  await removeStoragePaths(storagePaths);

  log("  operational rows cleared");
}

async function seedCatalog(tenantId) {
  log("3. Seeding live supplier, product, and quote-template catalog...");

  const { data: services } = await admin.schema("crm").from("services").select("id, slug").eq("tenant_id", tenantId);
  const { data: jobTypes } = await admin.schema("crm").from("job_types").select("id, slug").eq("tenant_id", tenantId);
  const serviceMap = new Map((services ?? []).map((entry) => [entry.slug, entry.id]));
  const jobTypeMap = new Map((jobTypes ?? []).map((entry) => [entry.slug, entry.id]));

  const supplierMap = new Map();

  for (const supplier of SUPPLIERS) {
    const id = randomUUID();
    const { error } = await admin.schema("crm").from("suppliers").insert({
      id,
      tenant_id: tenantId,
      ...supplier,
      pricing_last_updated_at: new Date().toISOString(),
      is_demo: false,
      demo_scenario_key: null,
    });
    if (error) {
      throw error;
    }
    supplierMap.set(supplier.name, id);
  }

  for (const product of PRODUCTS) {
    const { error } = await admin.schema("crm").from("products").insert({
      id: randomUUID(),
      tenant_id: tenantId,
      service_id: serviceMap.get(product.service) ?? null,
      supplier_id: supplierMap.get(product.supplier) ?? null,
      category: product.category,
      name: product.name,
      sku: product.sku,
      unit_cost: product.unit_cost,
      markup_percent: product.markup_percent,
      sell_price: product.sell_price,
      vat_category: product.vat_category,
      active: true,
      is_demo: false,
      demo_scenario_key: null,
    });
    if (error) {
      throw error;
    }
  }

  for (const template of QUOTE_TEMPLATES) {
    const { error } = await admin.schema("crm").from("quote_templates").insert({
      id: randomUUID(),
      tenant_id: tenantId,
      service_id: serviceMap.get(template.service) ?? null,
      job_type_id: jobTypeMap.get(template.jobType) ?? null,
      name: template.name,
      description: template.description,
      line_items: template.line_items,
      optional_extras: template.optional_extras,
      payment_terms: template.payment_terms,
      active: true,
      is_demo: false,
      demo_scenario_key: null,
    });
    if (error) {
      throw error;
    }
  }

  return { serviceMap, jobTypeMap, supplierMap };
}

async function createCustomerScenario({ tenantId, scenario, serviceMap, jobTypeMap, supplierMap, staffMap }) {
  const primaryOps = staffMap.get("Claire Sutton");
  const primarySales = staffMap.get("Ben Carter");

  const { data: customer, error: customerError } = await admin.schema("crm").from("customers").insert({
    id: randomUUID(),
    tenant_id: tenantId,
    full_name: scenario.customer.full_name,
    phone: scenario.customer.phone,
    email: scenario.customer.email,
    address_line1: scenario.customer.address_line1,
    city: scenario.customer.city,
    postcode: scenario.customer.postcode,
    property_type: scenario.customer.property_type,
    occupancy_type: scenario.customer.occupancy_type,
    source: scenario.customer.source,
    notes: scenario.customer.notes,
    archived: false,
    is_demo: false,
    demo_scenario_key: null,
  }).select("*").single();
  if (customerError || !customer) {
    throw new Error(customerError?.message ?? `Could not create customer ${scenario.customer.full_name}`);
  }

  const sitePayload = {
    id: randomUUID(),
    tenant_id: tenantId,
    customer_id: customer.id,
    label: scenario.customer.site?.label ?? "Primary address",
    address_line1: scenario.customer.site?.address_line1 ?? scenario.customer.address_line1,
    address_line2: scenario.customer.site?.address_line2 ?? null,
    city: scenario.customer.site?.city ?? scenario.customer.city,
    postcode: scenario.customer.site?.postcode ?? scenario.customer.postcode,
    access_notes: scenario.customer.site?.access_notes ?? null,
    parking_notes: scenario.customer.site?.parking_notes ?? null,
    is_primary: true,
    is_demo: false,
    demo_scenario_key: null,
  };

  const { data: site, error: siteError } = await admin.schema("crm").from("sites").insert(sitePayload).select("*").single();
  if (siteError || !site) {
    throw new Error(siteError?.message ?? `Could not create site for ${scenario.customer.full_name}`);
  }

  let siteContact = null;
  if (scenario.customer.siteContact) {
    const { data, error } = await admin.schema("crm").from("site_contacts").insert({
      id: randomUUID(),
      tenant_id: tenantId,
      site_id: site.id,
      full_name: scenario.customer.siteContact.full_name,
      phone: scenario.customer.siteContact.phone ?? null,
      email: scenario.customer.siteContact.email ?? null,
      role_label: scenario.customer.siteContact.role_label ?? null,
      is_primary: true,
      is_demo: false,
      demo_scenario_key: null,
    }).select("*").single();
    if (error || !data) {
      throw new Error(error?.message ?? `Could not create site contact for ${scenario.customer.full_name}`);
    }
    siteContact = data;
  }

  if (scenario.customer.asset) {
    const { error } = await admin.schema("crm").from("customer_assets").insert({
      id: randomUUID(),
      tenant_id: tenantId,
      customer_id: customer.id,
      service_id: serviceMap.get(scenario.customer.asset.service) ?? null,
      asset_type: scenario.customer.asset.asset_type,
      make: scenario.customer.asset.make ?? null,
      model: scenario.customer.asset.model ?? null,
      serial_number: scenario.customer.asset.serial_number ?? null,
      install_date: scenario.customer.asset.install_date ?? null,
      service_due_date: scenario.customer.asset.service_due_date ?? null,
      warranty_end_date: scenario.customer.asset.warranty_end_date ?? null,
      notes: scenario.customer.asset.notes ?? null,
      is_demo: false,
      demo_scenario_key: null,
    });
    if (error) {
      throw error;
    }
  }

  await admin.schema("crm").from("notes").insert({
    id: randomUUID(),
    tenant_id: tenantId,
    entity_type: "customer",
    entity_id: customer.id,
    body: `Customer profile seeded for live production scenario: ${scenario.customer.notes}`,
    created_by: primaryOps?.userId ?? null,
    is_demo: false,
    demo_scenario_key: null,
  });

  let lead = null;
  if (scenario.lead) {
    const leadServiceSlug = scenario.lead.service ?? scenario.job?.service ?? null;
    const leadJobTypeSlug = scenario.lead.jobType ?? scenario.job?.jobType ?? null;
    const { data, error } = await admin.schema("crm").from("leads").insert({
      id: randomUUID(),
      tenant_id: tenantId,
      customer_id: customer.id,
      service_id: leadServiceSlug ? serviceMap.get(leadServiceSlug) ?? null : null,
      job_type_id: leadJobTypeSlug ? jobTypeMap.get(leadJobTypeSlug) ?? null : null,
      status: scenario.lead.status,
      source: scenario.lead.source,
      assigned_to: primarySales?.userId ?? null,
      next_action_at: scenario.lead.next_action_at ?? null,
      notes: scenario.lead.notes ?? null,
      intake_source: scenario.lead.intake_source ?? null,
      submission_fingerprint: createHash("sha1").update(`${scenario.customer.email}:${scenario.lead.source}:${scenario.lead.notes}`).digest("hex"),
      submission_count: scenario.lead.submission_count ?? 1,
      first_submitted_at: scenario.lead.next_action_at ?? new Date().toISOString(),
      last_submitted_at: scenario.lead.next_action_at ?? new Date().toISOString(),
      possible_duplicate_customer_id: scenario.lead.possible_duplicate_customer_id ?? null,
      matched_customer_confidence: scenario.lead.customer_match_result === "matched" ? "high" : scenario.lead.customer_match_result === "possible_duplicate" ? "low" : "new",
      customer_match_result: scenario.lead.customer_match_result ?? "new",
      dedupe_result: scenario.lead.dedupe_result ?? "created",
      is_demo: false,
      demo_scenario_key: null,
    }).select("*").single();
    if (error || !data) {
      throw new Error(error?.message ?? `Could not create lead for ${scenario.customer.full_name}`);
    }
    lead = data;

    for (const noteBody of scenario.lead.noteBodies ?? []) {
      await admin.schema("crm").from("notes").insert({
        id: randomUUID(),
        tenant_id: tenantId,
        entity_type: "lead",
        entity_id: lead.id,
        body: noteBody,
        created_by: primarySales?.userId ?? null,
        is_demo: false,
        demo_scenario_key: null,
      });
    }

    for (const attachment of scenario.lead.attachments ?? []) {
      await createAttachment({
        tenantId,
        entityType: "lead",
        entityId: lead.id,
        fileName: `${attachment.label}.${attachment.extension ?? "svg"}`,
        fileType: "photo",
        createdBy: primarySales?.userId ?? null,
        body: buildPhotoSvg(attachment.label.replaceAll("-", " "), scenario.customer.full_name),
        contentType: "image/svg+xml",
      });
    }
  }

  let job = null;
  if (scenario.job) {
    const startsAt = isoAtDay(scenario.job.dayOffset, scenario.job.time);
    const primaryAssignee = staffMap.get(scenario.job.assignees[0]);
    const assigneeProfiles = scenario.job.assignees.map((name) => staffMap.get(name)).filter(Boolean);

    const { data, error } = await admin.schema("crm").from("jobs").insert({
      id: randomUUID(),
      tenant_id: tenantId,
      customer_id: customer.id,
      site_id: site.id,
      site_contact_id: siteContact?.id ?? null,
      lead_id: lead?.id ?? null,
      service_id: serviceMap.get(scenario.job.service) ?? null,
      job_type_id: jobTypeMap.get(scenario.job.jobType) ?? null,
      title: scenario.job.title,
      description: scenario.job.notes?.[0]?.body ?? null,
      scheduled_date: daysFromToday(scenario.job.dayOffset),
      scheduled_time: scenario.job.time,
      duration_hours: scenario.job.durationHours ?? null,
      status: scenario.job.status,
      assigned_engineer: primaryAssignee?.fullName ?? null,
      created_by: primaryOps?.userId ?? null,
      is_demo: false,
      demo_scenario_key: null,
    }).select("*").single();
    if (error || !data) {
      throw new Error(error?.message ?? `Could not create job ${scenario.job.title}`);
    }
    job = data;

    for (const assignee of assigneeProfiles) {
      await admin.schema("crm").from("job_assignees").insert({
        id: randomUUID(),
        tenant_id: tenantId,
        job_id: job.id,
        user_profile_id: assignee.profileId,
        assignment_role: assignee.role === "engineer" ? "field engineer" : assignee.role,
      });
    }

    await admin.schema("crm").from("appointments").insert({
      id: randomUUID(),
      tenant_id: tenantId,
      customer_id: customer.id,
      lead_id: lead?.id ?? null,
      job_id: job.id,
      assigned_to: primaryAssignee?.userId ?? primaryOps?.userId ?? null,
      type: scenario.job.appointmentType,
      title: scenario.job.title,
      starts_at: startsAt,
      ends_at: plusHours(startsAt, scenario.job.durationHours ?? 1),
      status: scenario.job.appointmentStatus,
      reminder_offset_minutes: 60,
      recurrence_rule: null,
      is_demo: false,
      demo_scenario_key: null,
    });

    for (const note of scenario.job.notes ?? []) {
      const author = staffMap.get(note.author);
      await admin.schema("crm").from("notes").insert({
        id: randomUUID(),
        tenant_id: tenantId,
        entity_type: "job",
        entity_id: job.id,
        body: note.body,
        created_by: author?.userId ?? primaryOps?.userId ?? null,
        is_demo: false,
        demo_scenario_key: null,
      });
    }

    for (const photo of scenario.job.photos ?? []) {
      await createAttachment({
        tenantId,
        entityType: "job",
        entityId: job.id,
        fileName: `${photo}.svg`,
        fileType: "photo",
        createdBy: primaryAssignee?.userId ?? primaryOps?.userId ?? null,
        body: buildPhotoSvg(photo.replaceAll("-", " "), scenario.job.title),
        contentType: "image/svg+xml",
      });
    }

    for (const hazard of scenario.job.hazards ?? []) {
      await admin.schema("crm").from("job_hazards").insert({
        id: randomUUID(),
        tenant_id: tenantId,
        job_id: job.id,
        title: hazard.title,
        description: hazard.description ?? null,
        status: hazard.status,
      });
    }

    for (const checklist of scenario.job.checklists ?? []) {
      await admin.schema("crm").from("job_checklists").insert({
        id: randomUUID(),
        tenant_id: tenantId,
        job_id: job.id,
        title: checklist.title,
        notes: checklist.notes ?? null,
        status: checklist.status,
        completed_at: checklist.completedOffsetDays != null ? isoAtDay(checklist.completedOffsetDays, "17:00") : null,
      });
    }

    for (const phase of scenario.job.phases ?? []) {
      await admin.schema("crm").from("job_phases").insert({
        id: randomUUID(),
        tenant_id: tenantId,
        job_id: job.id,
        name: phase.name,
        description: phase.description ?? null,
        status: phase.status,
        sort_order: phase.sort_order,
        target_date: phase.targetOffsetDays != null ? daysFromToday(phase.targetOffsetDays) : null,
        completed_at: phase.completedOffsetDays != null ? isoAtDay(phase.completedOffsetDays, "16:30") : null,
      });
    }

    for (const variation of scenario.job.variations ?? []) {
      await admin.schema("crm").from("job_variations").insert({
        id: randomUUID(),
        tenant_id: tenantId,
        job_id: job.id,
        title: variation.title,
        description: variation.description ?? null,
        estimated_value: variation.estimated_value,
        status: variation.status,
        created_by: primaryOps?.userId ?? null,
        approved_at: variation.status === "approved" ? new Date().toISOString() : null,
      });
    }

    for (const expense of scenario.job.expenses ?? []) {
      await admin.schema("crm").from("expenses").insert({
        id: randomUUID(),
        tenant_id: tenantId,
        job_id: job.id,
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        created_by: primaryAssignee?.userId ?? primaryOps?.userId ?? null,
        is_demo: false,
        demo_scenario_key: null,
      });
    }

    for (const certificate of scenario.job.certificates ?? []) {
      const fileUrl = await createCertificateFile({
        tenantId,
        jobId: job.id,
        title: certificate.title,
        reference: certificate.certificate_number,
      });

      await admin.schema("crm").from("job_certificates").insert({
        id: randomUUID(),
        tenant_id: tenantId,
        job_id: job.id,
        title: certificate.title,
        certificate_number: certificate.certificate_number,
        status: certificate.status,
        issued_at: certificate.issuedOffsetDays != null ? daysFromToday(certificate.issuedOffsetDays) : null,
        file_url: fileUrl,
      });
    }

    let quote = null;
    if (scenario.job.quote) {
      const latestVersion = scenario.job.quote.versions.reduce((current, version) => (version.version > current.version ? version : current), scenario.job.quote.versions[0]);
      const subtotal = sumLineItems(latestVersion.line_items);
      const vatRate = latestVersion.vat_rate ?? 0.2;
      const total = Number((subtotal * (1 + vatRate)).toFixed(2));
      const quoteNumber = buildQuoteNumber(await nextSequence("quote", tenantId));

      const { data: quoteRow, error: quoteError } = await admin.schema("crm").from("quotes").insert({
        id: randomUUID(),
        tenant_id: tenantId,
        job_id: job.id,
        customer_id: customer.id,
        quote_number: quoteNumber,
        document_type: scenario.job.quote.documentType,
        current_version_number: latestVersion.version,
        line_items: latestVersion.line_items,
        subtotal,
        vat_rate: vatRate,
        vat_category: latestVersion.vat_category ?? "standard_20",
        total,
        status: scenario.job.quote.status,
        valid_until: daysFromToday(scenario.job.quote.validUntilOffsetDays ?? 30),
        is_demo: false,
        demo_scenario_key: null,
      }).select("*").single();
      if (quoteError || !quoteRow) {
        throw new Error(quoteError?.message ?? `Could not create quote for ${scenario.job.title}`);
      }
      quote = quoteRow;

      for (const version of scenario.job.quote.versions) {
        const versionSubtotal = sumLineItems(version.line_items);
        const versionVatRate = version.vat_rate ?? 0.2;
        const versionTotal = Number((versionSubtotal * (1 + versionVatRate)).toFixed(2));
        await admin.schema("crm").from("quote_versions").insert({
          id: randomUUID(),
          tenant_id: tenantId,
          quote_id: quote.id,
          version_number: version.version,
          document_type: version.documentType,
          line_items: version.line_items,
          subtotal: versionSubtotal,
          vat_rate: versionVatRate,
          vat_category: version.vat_category ?? "standard_20",
          total: versionTotal,
          valid_until: daysFromToday(scenario.job.quote.validUntilOffsetDays ?? 30),
          status: version.status,
          change_summary: version.changeSummary ?? null,
          created_by: primarySales?.userId ?? primaryOps?.userId ?? null,
          created_at: new Date().toISOString(),
        });
      }

      if (scenario.job.quote.acceptance) {
        await admin.schema("crm").from("quote_acceptances").insert({
          id: randomUUID(),
          tenant_id: tenantId,
          quote_id: quote.id,
          accepted_by_name: scenario.job.quote.acceptance.accepted_by_name,
          accepted_by_email: scenario.job.quote.acceptance.accepted_by_email ?? null,
          acceptance_method: scenario.job.quote.acceptance.acceptance_method,
          notes: scenario.job.quote.acceptance.notes ?? null,
          accepted_at: isoAtDay(scenario.job.quote.acceptance.acceptedOffsetDays ?? 0, "18:00"),
        });
      }

      for (const schedule of scenario.job.quote.schedules ?? []) {
        const invoiceScheduleId = randomUUID();
        const fixedAmount =
          schedule.fixed_amount != null
            ? schedule.fixed_amount
            : schedule.percentage != null
              ? Number((quote.total * (schedule.percentage / 100)).toFixed(2))
              : null;
        let generatedInvoiceId = null;

        if (schedule.invoice_status) {
          const invoiceNumber = buildInvoiceNumber(await nextSequence("invoice", tenantId));
          const invoiceSubtotal = fixedAmount ?? quote.total;
          const invoiceTotal = invoiceSubtotal;
          const { data: invoice, error: invoiceError } = await admin.schema("crm").from("invoices").insert({
            id: randomUUID(),
            tenant_id: tenantId,
            quote_id: quote.id,
            job_id: job.id,
            customer_id: customer.id,
            invoice_number: invoiceNumber,
            line_items: [{ description: schedule.label, qty: 1, unit_price: invoiceSubtotal }],
            subtotal: invoiceSubtotal,
            vat_rate: 0,
            vat_category: "zero",
            total: invoiceTotal,
            status: schedule.invoice_status,
            due_date: daysFromToday(schedule.due_offset_days),
            paid_at: schedule.payment_status === "received" ? isoAtDay(schedule.payment_offsetDays ?? schedule.due_offset_days, "12:00") : null,
            is_demo: false,
            demo_scenario_key: null,
          }).select("*").single();
          if (invoiceError || !invoice) {
            throw new Error(invoiceError?.message ?? `Could not create invoice for ${scenario.job.title}`);
          }
          generatedInvoiceId = invoice.id;

          if (schedule.payment_status) {
            await admin.schema("crm").from("payments").insert({
              id: randomUUID(),
              tenant_id: tenantId,
              invoice_id: invoice.id,
              quote_id: quote.id,
              customer_id: customer.id,
              payment_type: schedule.payment_type,
              amount: invoiceTotal,
              status: schedule.payment_status,
              requested_at: isoAtDay(schedule.due_offset_days, "09:00"),
              received_at: schedule.payment_status === "received" ? isoAtDay(schedule.payment_offsetDays ?? schedule.due_offset_days, "12:00") : null,
              reference: schedule.payment_status === "received" ? `BANK-${invoice.invoice_number}` : null,
              notes: schedule.payment_status === "received" ? `${schedule.label} received by bank transfer.` : `${schedule.label} invoice issued.`,
              is_demo: false,
              demo_scenario_key: null,
            });
          }
        }

        await admin.schema("crm").from("invoice_schedules").insert({
          id: invoiceScheduleId,
          tenant_id: tenantId,
          quote_id: quote.id,
          label: schedule.label,
          payment_type: schedule.payment_type,
          percentage: schedule.percentage ?? null,
          fixed_amount: schedule.fixed_amount ?? null,
          due_offset_days: schedule.due_offset_days,
          status: schedule.status,
          invoice_id: generatedInvoiceId,
        });
      }
    }

    for (const purchaseOrder of scenario.job.purchaseOrders ?? []) {
      const poNumber = buildPoNumber(await nextSequence("purchase-order", tenantId));
      const { data: poRow, error: poError } = await admin.schema("crm").from("purchase_orders").insert({
        id: randomUUID(),
        tenant_id: tenantId,
        job_id: job.id,
        supplier_id: supplierMap.get(purchaseOrder.supplier) ?? null,
        po_number: poNumber,
        status: purchaseOrder.status,
        total_amount: purchaseOrder.total_amount,
        notes: purchaseOrder.notes ?? null,
        issued_at: purchaseOrder.issuedOffsetDays != null ? daysFromToday(purchaseOrder.issuedOffsetDays) : null,
      }).select("*").single();
      if (poError || !poRow) {
        throw new Error(poError?.message ?? `Could not create purchase order for ${scenario.job.title}`);
      }

      for (const entry of scenario.job.reconciliation ?? []) {
        await admin.schema("crm").from("supplier_reconciliation").insert({
          id: randomUUID(),
          tenant_id: tenantId,
          job_id: job.id,
          purchase_order_id: poRow.id,
          supplier_id: supplierMap.get(entry.supplier) ?? null,
          entry_type: entry.entry_type,
          reference_number: entry.reference_number ?? null,
          amount: entry.amount,
          status: entry.status,
        });
      }
    }
  }

  return { customer, lead, job };
}

async function main() {
  log("\n━━━ Empire tenant-1 production scenario seed ━━━\n");

  const tenant = await ensureTenant();
  log(`1. Tenant loaded: ${tenant.name} (${tenant.id})`);

  const staffMap = await ensureStaffProfiles(tenant.id);
  await seedStaffCertifications(tenant.id, staffMap);
  await wipeTenantOperationalData(tenant.id);
  const catalog = await seedCatalog(tenant.id);

  log("4. Creating customers, leads, jobs, quotes, invoices, and files...");

  let customers = 0;
  let leads = 0;
  let jobs = 0;

  for (const scenario of SCENARIOS) {
    const result = await createCustomerScenario({
      tenantId: tenant.id,
      scenario,
      serviceMap: catalog.serviceMap,
      jobTypeMap: catalog.jobTypeMap,
      supplierMap: catalog.supplierMap,
      staffMap,
    });

    customers += result.customer ? 1 : 0;
    leads += result.lead ? 1 : 0;
    jobs += result.job ? 1 : 0;
  }

  const summaryTables = [
    "customers",
    "leads",
    "jobs",
    "appointments",
    "quotes",
    "quote_versions",
    "quote_acceptances",
    "invoice_schedules",
    "invoices",
    "payments",
    "notes",
    "attachments",
    "customer_assets",
    "job_phases",
    "job_variations",
    "job_hazards",
    "job_checklists",
    "job_certificates",
    "purchase_orders",
    "supplier_reconciliation",
  ];

  log("\n5. Summary counts...");
  for (const table of summaryTables) {
    const { count, error } = await admin.schema("crm").from(table).select("*", { head: true, count: "exact" }).eq("tenant_id", tenant.id);
    if (error) {
      throw error;
    }
    log(`  ${table.padEnd(24)} ${String(count ?? 0)}`);
  }

  log("\nCreated staff logins:");
  for (const member of STAFF.filter((entry) => entry.email !== "admin@empirehomesolutions.local" && entry.email !== "engineer@empirehomesolutions.local" && entry.email !== "shaz@onlinebuzz.co.uk")) {
    log(`  ${member.role.padEnd(10)} ${member.email}`);
  }

  log(`\nSeed complete. Customers: ${customers}, Leads: ${leads}, Jobs: ${jobs}`);
  log(`Live CRM: https://empire-home-solutions.vercel.app/login`);
  log(`Shared seeded staff password for newly-added users: ${STAFF_PASSWORD}\n`);
}

main().catch((error) => {
  console.error("\nSeed failed:\n", error);
  process.exitCode = 1;
});
