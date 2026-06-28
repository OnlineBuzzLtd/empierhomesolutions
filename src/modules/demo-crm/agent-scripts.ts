/**
 * Scripted conversations + CRM outcomes for each of the five AI agents.
 * Playing a script animates the conversation, then applies the outcome to the
 * in-memory CRM state (see reducer.applyAgentOutcome).
 */
import type { DemoAgentId, DemoAgentOutcome, DemoMessage } from "./types";

export type DemoAgentScript = {
  id: DemoAgentId;
  name: string;
  tagline: string;
  /** Short description shown on the agent card. */
  blurb: string;
  /** The customer on the other end of the conversation (shown in channel headers). */
  contactName: string;
  /** Their number/handle, shown in the channel header subtitle where relevant. */
  contactHandle: string;
  turns: DemoMessage[];
  produces: DemoAgentOutcome;
};

export const AGENT_SCRIPTS: Record<DemoAgentId, DemoAgentScript> = {
  voice: {
    id: "voice",
    name: "Voice Agent",
    tagline: "Answers missed & after-hours calls",
    blurb: "Recovers the calls you miss on the tools, qualifies the job, and books it in.",
    contactName: "Helen Carter",
    contactHandle: "07700 900512",
    turns: [
      { role: "system", channel: "voice", text: "Missed call detected — 21:48, out of hours." },
      { role: "agent", channel: "sms", text: "Hi, this is Uxbridge Heating. Sorry we missed your call — what can we help with?" },
      { role: "customer", channel: "sms", text: "No heating at all and it's freezing. Can someone come out?" },
      { role: "agent", channel: "sms", text: "Sorry to hear that. Can I take your name, postcode, and a number to confirm?" },
      { role: "customer", channel: "sms", text: "Helen Carter, 7 Park Road Uxbridge UB8 1RG, 07700 900512." },
      { role: "agent", channel: "sms", text: "Thanks Helen. I can get an engineer to you tomorrow 11:00–12:30. Shall I book it?" },
      { role: "customer", channel: "sms", text: "Yes please." },
      { role: "agent", channel: "sms", text: "Booked. You'll get a text confirmation shortly." },
    ],
    produces: {
      activity: "Voice Agent recovered an out-of-hours missed call from Helen Carter and booked an emergency callout.",
      leads: [
        {
          customerName: "Helen Carter",
          phone: "07700 900512",
          source: "voice",
          agent: "voice",
          service: "No heating — emergency callout",
          problem: "No heating, property cold. Out-of-hours missed call recovered by AI.",
          urgency: "emergency",
          status: "booked",
        },
      ],
      appointments: [
        {
          customerName: "Helen Carter",
          type: "callout",
          engineerId: "eng_1",
          start: isoTomorrow(11),
          durationMins: 90,
          status: "scheduled",
          addressLine: "7 Park Road, Uxbridge",
          postcode: "UB8 1RG",
        },
      ],
    },
  },

  lead: {
    id: "lead",
    name: "Lead Agent",
    tagline: "Replies to web & ad leads in seconds",
    blurb: "Responds to website and Google leads before they go cold, then qualifies the job.",
    contactName: "Raj Patel",
    contactHandle: "07700 900633",
    turns: [
      { role: "system", channel: "web_form", text: "New website lead received: 'New boiler quote'." },
      { role: "agent", channel: "sms", text: "Hi Raj, thanks for your enquiry about a new boiler. Is it a like-for-like replacement?" },
      { role: "customer", channel: "sms", text: "Yes, old system boiler, want to move to a combi." },
      { role: "agent", channel: "sms", text: "Great. We'd send an engineer to survey before quoting. Does Thursday morning suit?" },
      { role: "customer", channel: "sms", text: "Thursday works." },
      { role: "agent", channel: "sms", text: "Perfect — I've pencilled a survey in and the office will confirm." },
    ],
    produces: {
      activity: "Lead Agent replied to a website boiler enquiry from Raj Patel and booked a survey.",
      leads: [
        {
          customerName: "Raj Patel",
          phone: "07700 900633",
          source: "web_form",
          agent: "lead",
          service: "Combi boiler conversion quote",
          problem: "System boiler to combi conversion; wants a survey-led quote.",
          urgency: "routine",
          status: "survey_booked",
        },
      ],
      appointments: [
        {
          customerName: "Raj Patel",
          type: "survey",
          engineerId: "eng_3",
          start: isoTomorrow(9, 2),
          durationMins: 60,
          status: "scheduled",
          addressLine: "23 Park Avenue, Uxbridge",
          postcode: "UB8 2RT",
        },
      ],
    },
  },

  messaging: {
    id: "messaging",
    name: "Messaging Agent",
    tagline: "Handles SMS & WhatsApp threads",
    blurb: "Replies on the channels customers actually use, captures photos and details.",
    contactName: "Lucy Adams",
    contactHandle: "07700 900744",
    turns: [
      { role: "customer", channel: "whatsapp", text: "Hiya, got a dripping tap in the kitchen 💧 [photo attached]" },
      { role: "agent", channel: "whatsapp", text: "Thanks for the photo, Lucy — looks like a worn cartridge. What's the postcode?" },
      { role: "customer", channel: "whatsapp", text: "UB10 9TG, 14 Honeycroft Hill." },
      { role: "agent", channel: "whatsapp", text: "Got it. A plumber can sort that on a standard visit. Want me to get the office to call with a time?" },
      { role: "customer", channel: "whatsapp", text: "Yes please, mornings are best." },
      { role: "agent", channel: "whatsapp", text: "Will do — I've logged the details and your photo for the engineer." },
    ],
    produces: {
      activity: "Messaging Agent captured a dripping-tap enquiry from Lucy Adams over WhatsApp, with a photo.",
      leads: [
        {
          customerName: "Lucy Adams",
          phone: "07700 900744",
          source: "whatsapp",
          agent: "messaging",
          service: "Dripping kitchen tap",
          problem: "Worn tap cartridge, photo supplied. Customer prefers morning visit.",
          urgency: "soon",
          status: "qualified",
          notes: "Photo attached in thread.",
        },
      ],
    },
  },

  web_chat: {
    id: "web_chat",
    name: "Web Chat Agent",
    tagline: "Turns site visitors into booked jobs",
    blurb: "Answers questions on your website and books the job before visitors leave.",
    contactName: "Mark Doyle",
    contactHandle: "Website visitor",
    turns: [
      { role: "customer", channel: "web_chat", text: "Do you cover Uxbridge? I've got water coming through the ceiling." },
      { role: "agent", channel: "web_chat", text: "Yes we do, and that sounds urgent. Can I take your address and number?" },
      { role: "customer", channel: "web_chat", text: "Mark Doyle, 5 Whitehall Road UB8 2LP, 07700 900855." },
      { role: "agent", channel: "web_chat", text: "Thanks Mark. I can get an engineer to you today between 14:00–15:30. Book it?" },
      { role: "customer", channel: "web_chat", text: "Yes, please hurry!" },
      { role: "agent", channel: "web_chat", text: "Booked and logged as urgent. An engineer is on the way list now." },
    ],
    produces: {
      activity: "Web Chat Agent booked an urgent burst-pipe callout for Mark Doyle from the website.",
      leads: [
        {
          customerName: "Mark Doyle",
          phone: "07700 900855",
          source: "web_chat",
          agent: "web_chat",
          service: "Burst pipe — water through ceiling",
          problem: "Water coming through ceiling; urgent same-day callout needed.",
          urgency: "emergency",
          status: "booked",
        },
      ],
      appointments: [
        {
          customerName: "Mark Doyle",
          type: "callout",
          engineerId: "eng_2",
          start: isoToday(14),
          durationMins: 90,
          status: "scheduled",
          addressLine: "5 Whitehall Road, Uxbridge",
          postcode: "UB8 2LP",
        },
      ],
      jobs: [
        {
          ref: "JOB-1051",
          customerName: "Mark Doyle",
          service: "Emergency burst pipe callout",
          status: "booked",
          engineerId: "eng_2",
          appointmentId: null,
          valueGbp: 195,
        },
      ],
    },
  },

  payments: {
    id: "payments",
    name: "Payments Agent",
    tagline: "Chases unpaid invoices politely",
    blurb: "Follows up overdue invoices on time, with the right next step — and stops when paid.",
    contactName: "Priya Shah",
    contactHandle: "07700 900377",
    turns: [
      { role: "system", channel: "email", text: "Invoice INV-3120 (£140) is 9 days overdue." },
      { role: "agent", channel: "sms", text: "Hi Priya, a friendly reminder that invoice INV-3120 for £140 is now due. Here's a secure pay link." },
      { role: "customer", channel: "sms", text: "Oh sorry, completely forgot! Paying now." },
      { role: "agent", channel: "sms", text: "No problem at all — thank you! I'll mark it as settled once it lands." },
      { role: "system", channel: "email", text: "Payment received — INV-3120 marked paid. Follow-up stopped." },
    ],
    produces: {
      activity: "Payments Agent chased overdue invoice INV-3120 and it was paid the same day.",
      payInvoiceRef: "INV-3120",
    },
  },
};

export const AGENT_ORDER: DemoAgentId[] = ["voice", "lead", "messaging", "web_chat", "payments"];

function isoToday(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function isoTomorrow(hour: number, addDays = 1, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
