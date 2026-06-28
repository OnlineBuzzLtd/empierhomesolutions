/**
 * Seeded fictional plumbing business for the Try Empire CRM demo.
 * All names, numbers, addresses, and prices are invented. No real PII/pricing.
 */
import type { DemoCrmState } from "./types";

function daysFrom(base: Date, days: number, hour = 9, minute = 0): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function dateOnly(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Build a fresh seeded CRM. `now` is injectable so tests are deterministic.
 */
export function createSeedState(now: Date = new Date()): DemoCrmState {
  const engineers = [
    { id: "eng_1", name: "Dave Pearce", initials: "DP", trade: "Gas & heating engineer" },
    { id: "eng_2", name: "Sam Okafor", initials: "SO", trade: "Plumber" },
    { id: "eng_3", name: "Marek Nowak", initials: "MN", trade: "Heating engineer" },
  ];

  const customers = [
    {
      id: "cust_1",
      name: "Janet Hughes",
      phone: "07700 900181",
      email: "janet.hughes@example.com",
      addressLine: "42 Cowley Road, Uxbridge",
      postcode: "UB8 2LX",
    },
    {
      id: "cust_2",
      name: "Tom Bradley",
      phone: "07700 900244",
      email: "tom.bradley@example.com",
      addressLine: "9 Hillingdon Hill, Uxbridge",
      postcode: "UB10 0JQ",
    },
    {
      id: "cust_3",
      name: "Priya Shah",
      phone: "07700 900377",
      email: "priya.shah@example.com",
      addressLine: "17 Belmont Road, Uxbridge",
      postcode: "UB8 1QX",
    },
  ];

  const leads = [
    {
      id: "lead_1",
      customerName: "Janet Hughes",
      phone: "07700 900181",
      source: "voice" as const,
      agent: "voice" as const,
      service: "Boiler not firing up",
      problem: "No hot water since this morning; boiler shows a fault light.",
      urgency: "emergency" as const,
      status: "booked" as const,
      createdAt: daysFrom(now, -2, 8, 12),
      notes: "Recovered from a missed call out of hours.",
    },
    {
      id: "lead_2",
      customerName: "Tom Bradley",
      phone: "07700 900244",
      source: "web_form" as const,
      agent: "lead" as const,
      service: "New combi boiler quote",
      problem: "Wants a quote for replacing an old system boiler.",
      urgency: "routine" as const,
      status: "survey_booked" as const,
      createdAt: daysFrom(now, -1, 14, 5),
    },
    {
      id: "lead_3",
      customerName: "Priya Shah",
      phone: "07700 900377",
      source: "whatsapp" as const,
      agent: "messaging" as const,
      service: "Leaking radiator valve",
      problem: "Slow drip under the upstairs radiator; sent a photo.",
      urgency: "soon" as const,
      status: "quoted" as const,
      createdAt: daysFrom(now, -1, 10, 40),
    },
  ];

  const appointments = [
    {
      id: "appt_1",
      leadId: "lead_1",
      customerName: "Janet Hughes",
      type: "callout" as const,
      engineerId: "eng_1",
      start: daysFrom(now, 0, 11, 0),
      durationMins: 90,
      status: "scheduled" as const,
      addressLine: "42 Cowley Road, Uxbridge",
      postcode: "UB8 2LX",
    },
    {
      id: "appt_2",
      leadId: "lead_2",
      customerName: "Tom Bradley",
      type: "survey" as const,
      engineerId: "eng_3",
      start: daysFrom(now, 1, 9, 30),
      durationMins: 60,
      status: "scheduled" as const,
      addressLine: "9 Hillingdon Hill, Uxbridge",
      postcode: "UB10 0JQ",
    },
  ];

  const jobs = [
    {
      id: "job_1",
      ref: "JOB-1042",
      customerName: "Janet Hughes",
      service: "Emergency boiler repair",
      status: "booked" as const,
      engineerId: "eng_1",
      appointmentId: "appt_1",
      valueGbp: 180,
    },
    {
      id: "job_2",
      ref: "JOB-1039",
      customerName: "Priya Shah",
      service: "Radiator valve replacement",
      status: "completed" as const,
      engineerId: "eng_2",
      appointmentId: null,
      valueGbp: 140,
    },
  ];

  const quotes = [
    {
      id: "quote_1",
      ref: "QUO-2051",
      customerName: "Tom Bradley",
      service: "Combi boiler supply & install",
      totalGbp: 2650,
      status: "sent" as const,
    },
    {
      id: "quote_2",
      ref: "QUO-2048",
      customerName: "Priya Shah",
      service: "Radiator valve replacement",
      totalGbp: 140,
      status: "accepted" as const,
    },
  ];

  const invoices = [
    {
      id: "inv_1",
      ref: "INV-3120",
      customerName: "Priya Shah",
      jobRef: "JOB-1039",
      amountGbp: 140,
      // Overdue — this is the invoice the Payments agent chases in its demo.
      status: "overdue" as const,
      dueDate: dateOnly(now, -9),
    },
    {
      id: "inv_2",
      ref: "INV-3118",
      customerName: "Janet Hughes",
      jobRef: "JOB-1031",
      amountGbp: 95,
      status: "paid" as const,
      dueDate: dateOnly(now, -20),
    },
  ];

  return {
    engineers,
    customers,
    leads,
    appointments,
    jobs,
    quotes,
    invoices,
    conversations: { voice: [], lead: [], messaging: [], web_chat: [], payments: [] },
    activity: [
      {
        id: "act_seed_1",
        at: daysFrom(now, -1, 10, 41),
        agent: "messaging",
        text: "Messaging Agent qualified a leaking radiator enquiry from Priya Shah.",
      },
      {
        id: "act_seed_2",
        at: daysFrom(now, -2, 8, 13),
        agent: "voice",
        text: "Voice Agent recovered an out-of-hours missed call from Janet Hughes and booked a callout.",
      },
    ],
  };
}
