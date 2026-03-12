import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, ChevronRight, ClipboardList, Layers3, ShieldCheck, Sparkles, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Empire Tech Solutions | CRM for Trades Businesses",
  description:
    "CRM for growing trade businesses with three packages, setup support, and clear pricing.",
};

const tierCards = [
  {
    name: "Ops Launch",
    monthly: "GBP 399",
    setup: "GBP 3,000",
    fit: "Best for smaller trade businesses that want one simple system for leads, jobs, quotes, invoices, and the diary.",
    highlight: "Fastest route off spreadsheets",
    features: [
      "Up to 5 users included",
      "Leads, customer records, jobs, diary, quotes, and invoices",
      "Different logins for office staff and engineers",
      "Branded quote and invoice templates",
      "Simple dashboard for open jobs and sales pipeline",
      "2 onboarding sessions plus remote setup",
    ],
  },
  {
    name: "Revenue Control",
    monthly: "GBP 599",
    setup: "GBP 7,500",
    fit: "Best for growing plumbing, heating, electrical, and HVAC businesses with a busy office team and multiple engineers.",
    highlight: "Most popular",
    features: [
      "Up to 15 users included",
      "Everything in Ops Launch",
      "Different job types and service workflows",
      "Required fields and required documents before jobs can move forward",
      "Engineer checklists, sign-off capture, and file uploads",
      "Reports for sales, conversions, and job value",
      "Data migration and 4 weeks of rollout support",
    ],
  },
  {
    name: "Scale Command",
    monthly: "GBP 999",
    setup: "GBP 15,000",
    fit: "Best for larger trade businesses with several teams, services, or office locations that need tighter control and deeper reporting.",
    highlight: "Built for multi-team growth",
    features: [
      "Up to 40 users included",
      "Everything in Revenue Control",
      "Different workflows and permissions for separate teams or divisions",
      "Custom fields across leads, customers, assets, and jobs",
      "Rollout planning and process workshops",
      "Quarterly review sessions and priority support",
      "Management reporting and support for extra service lines",
    ],
  },
] as const;

const trustPoints = [
  "Track the full job in one place: lead, quote, booking, job, invoice, payment.",
  "Simple for the office team and clear for engineers on site.",
  "Setup and training included so your team can get started properly.",
] as const;

const includedItems = [
  "Secure login with access for different team roles",
  "Customer history with notes, files, and linked jobs",
  "Quotes, invoices, payments, and saved documents",
  "Diary and engineer scheduling view",
  "Control over required job information and paperwork",
  "Room to add more services as the business grows",
] as const;

const addOns = [
  { name: "Additional office user", price: "GBP 89/user/mo" },
  { name: "Additional field user", price: "GBP 49/user/mo" },
  { name: "Old data moved into the new system", price: "from GBP 2,500" },
  { name: "Email and text message setup", price: "from GBP 350/mo" },
  { name: "Custom certificates or job documents", price: "from GBP 1,800" },
  { name: "Ongoing CRM support", price: "from GBP 950/mo" },
] as const;

const faqs = [
  {
    question: "Why is the pricing higher than basic field service apps?",
    answer:
      "Because this is more than a basic app. You are paying for setup, workflow build, onboarding, and support as well as the software itself.",
  },
  {
    question: "Is this a one-off build or a monthly platform fee?",
    answer:
      "There is a one-off setup fee to get everything built and ready, then a monthly fee for the software and ongoing support.",
  },
  {
    question: "Who is this best suited to?",
    answer:
      "It is best for trade businesses that have outgrown spreadsheets, WhatsApp updates, and disconnected systems for quotes, jobs, and invoices.",
  },
  {
    question: "How quickly can we launch?",
    answer:
      "Smaller setups can be live in a few weeks. Bigger jobs take longer if there are more users, more services, or old data to move over.",
  },
] as const;

export default function EmpireTechSolutionsPage() {
  return (
    <main className="min-h-screen bg-[#f4efe7] text-[#18161a]">
      <section className="relative overflow-hidden bg-[#16151a] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(194,137,58,0.28),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(90,122,255,0.18),_transparent_34%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[#dbc092]">
                <Sparkles size={14} />
                Empire Tech Solutions
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                CRM software for plumbers, electricians, and growing trade businesses.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/74 sm:text-lg">
                Manage leads, jobs, quotes, invoices, and your diary in one place. Keep the office team and engineers
                working from the same system.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="mailto:shaz@onlinebuzz.co.uk?subject=Empire%20Tech%20Solutions%20CRM%20Demo"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c2893a] px-5 py-3 text-sm font-semibold text-[#16151a] transition hover:bg-[#d39c51]"
                >
                  Book Pricing Call
                  <ArrowRight size={16} />
                </a>
                <a
                  href="#tiers"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  See 3 Tiers
                  <ChevronRight size={16} />
                </a>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#dbc092]">Why trades choose it</p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">One place for the whole job</p>
                  <p className="mt-1 text-sm text-white/70">From first enquiry to quote, booking, job, invoice, and payment.</p>
                </div>
                <div className="rounded-2xl border border-[#c2893a]/50 bg-[#c2893a]/12 p-4">
                  <p className="text-sm font-semibold text-white">Office and engineers stay in sync</p>
                  <p className="mt-1 text-sm text-white/80">
                    Everyone sees the same job details, notes, files, and updates.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">Built to grow with you</p>
                  <p className="mt-1 text-sm text-white/70">Add more staff, more services, and more jobs as the business grows.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {trustPoints.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/6 p-4 text-sm leading-6 text-white/78">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7e5b23]">Built for trade teams</p>
          <h2 className="mt-3 text-3xl font-semibold text-[#15131a] sm:text-4xl">
            One system to help your team stay organised from first enquiry to final payment.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-700">
            Stop jumping between spreadsheets, notes, inboxes, and separate apps. Give the office and engineers one clear
            place to manage the whole job from start to finish.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-[#d8cab3] bg-white p-6 shadow-[0_18px_45px_rgba(45,35,16,0.08)]">
            <Users className="h-6 w-6 text-[#7e5b23]" />
            <h3 className="mt-4 text-lg font-semibold">Management control</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Set permissions, job stages, required fields, and required documents inside the system.
            </p>
          </div>
          <div className="rounded-3xl border border-[#d8cab3] bg-white p-6 shadow-[0_18px_45px_rgba(45,35,16,0.08)]">
            <ClipboardList className="h-6 w-6 text-[#7e5b23]" />
            <h3 className="mt-4 text-lg font-semibold">From lead to payment</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Track the lead, book the work, send the quote, do the job, and raise the invoice from the same system.
            </p>
          </div>
          <div className="rounded-3xl border border-[#d8cab3] bg-white p-6 shadow-[0_18px_45px_rgba(45,35,16,0.08)]">
            <BarChart3 className="h-6 w-6 text-[#7e5b23]" />
            <h3 className="mt-4 text-lg font-semibold">Reporting that supports decisions</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              See what is booked, what is sold, what is unpaid, and where the team needs attention.
            </p>
          </div>
        </div>
      </section>

      <section id="tiers" className="border-y border-[#d8cab3] bg-[#efe6d7]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7e5b23]">Three Tiers</p>
              <h2 className="mt-3 text-3xl font-semibold text-[#15131a] sm:text-4xl">Choose the rollout that matches your business.</h2>
              <p className="mt-4 text-base leading-7 text-slate-700">
                Every option includes a monthly software fee and a one-off setup fee, so the system can be built properly
                and your team can be trained to use it.
              </p>
            </div>
            <div className="rounded-2xl border border-[#ccb08a] bg-white px-4 py-3 text-sm text-slate-700">
              Typical agreement: <span className="font-semibold text-[#15131a]">12-month software term with setup paid upfront</span>
            </div>
          </div>

          <div className="mt-10 grid gap-5 xl:grid-cols-3">
            {tierCards.map((tier, index) => (
              <article
                key={tier.name}
                className={[
                  "rounded-[30px] border p-6 shadow-[0_22px_50px_rgba(45,35,16,0.1)]",
                  index === 1
                    ? "border-[#7e5b23] bg-[#1b1920] text-white"
                    : "border-[#d8cab3] bg-white text-[#15131a]",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={index === 1 ? "text-xs font-semibold uppercase tracking-[0.24em] text-[#dbc092]" : "text-xs font-semibold uppercase tracking-[0.24em] text-[#7e5b23]"}>
                      {tier.highlight}
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold">{tier.name}</h3>
                  </div>
                  <span
                    className={[
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      index === 1 ? "bg-white/10 text-white" : "bg-[#f5ede0] text-[#7e5b23]",
                    ].join(" ")}
                  >
                    {index === 1 ? "Recommended" : "Tailored onboarding"}
                  </span>
                </div>

                <div className="mt-8 border-t border-black/10 pt-6">
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-semibold">{tier.monthly}</span>
                    <span className={index === 1 ? "pb-1 text-sm text-white/70" : "pb-1 text-sm text-slate-500"}>/month</span>
                  </div>
                  <p className={index === 1 ? "mt-2 text-sm text-white/78" : "mt-2 text-sm text-slate-600"}>
                    Setup and onboarding: <span className="font-semibold">{tier.setup}</span>
                  </p>
                </div>

                <p className={index === 1 ? "mt-6 text-sm leading-6 text-white/80" : "mt-6 text-sm leading-6 text-slate-600"}>
                  {tier.fit}
                </p>

                <ul className="mt-6 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm leading-6">
                      <CheckCircle2 className={index === 1 ? "mt-0.5 h-5 w-5 shrink-0 text-[#dbc092]" : "mt-0.5 h-5 w-5 shrink-0 text-[#7e5b23]"} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="mailto:shaz@onlinebuzz.co.uk?subject=Empire%20Tech%20Solutions%20CRM%20Pricing"
                  className={[
                    "mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition",
                    index === 1
                      ? "bg-[#c2893a] text-[#16151a] hover:bg-[#d39c51]"
                      : "bg-[#15131a] text-white hover:bg-[#24202b]",
                  ].join(" ")}
                >
                  Request Demo
                  <ArrowRight size={16} />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[30px] bg-[#16151a] p-7 text-white shadow-[0_24px_60px_rgba(22,21,26,0.18)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#dbc092]">Included in every plan</p>
            <ul className="mt-6 space-y-4">
              {includedItems.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-6 text-white/82">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#dbc092]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[30px] border border-[#d8cab3] bg-white p-7 shadow-[0_20px_50px_rgba(45,35,16,0.08)]">
            <div className="flex items-center gap-3">
              <Layers3 className="h-6 w-6 text-[#7e5b23]" />
              <h2 className="text-2xl font-semibold text-[#15131a]">Optional add-ons</h2>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {addOns.map((item) => (
                <div key={item.name} className="rounded-2xl border border-[#eadfce] bg-[#fbf8f3] p-4">
                  <p className="text-sm font-semibold text-[#15131a]">{item.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.price}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-600">
              Add help with moving old data, setting up messages, building job documents, or supporting the team after go-live.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-[#d8cab3] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7e5b23]">FAQ</p>
            <h2 className="mt-3 text-3xl font-semibold text-[#15131a] sm:text-4xl">Common questions before getting started.</h2>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {faqs.map((item) => (
              <article key={item.question} className="rounded-3xl border border-[#e7dccb] bg-[#fbf8f3] p-6">
                <h3 className="text-lg font-semibold text-[#15131a]">{item.question}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="rounded-[34px] bg-[#15131a] px-6 py-10 text-white shadow-[0_25px_60px_rgba(21,19,26,0.2)] sm:px-8 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#dbc092]">Next Step</p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
                Ready to run the business from one clear system?
              </h2>
              <p className="mt-4 text-base leading-7 text-white/76">
                We can show you the right package, talk through your workflow, and map out how the CRM would work for your
                office team and engineers.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <a
                href="mailto:shaz@onlinebuzz.co.uk?subject=Empire%20Tech%20Solutions%20CRM%20LP"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c2893a] px-5 py-3 text-sm font-semibold text-[#15131a] hover:bg-[#d39c51]"
              >
                Request Pricing Deck
                <ArrowRight size={16} />
              </a>
              <Link
                href="/demo-routes"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 px-5 py-3 text-sm font-semibold text-white hover:bg-white/6"
              >
                Back to Demo Routes
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
