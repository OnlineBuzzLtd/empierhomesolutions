import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  Mail,
  MessageSquareText,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

export const metadata: Metadata = {
  title: "CustomerJourneys.AI | The AI Front Office for UK Trades",
  description:
    "Always-on AI agents for UK plumbers, electricians and heating engineers. Answer every call, chase every quote and book more jobs.",
};

const demoHref = "mailto:shaz@onlinebuzz.co.uk?subject=CustomerJourneys.AI%20Demo";

const tickerItems = [
  { time: "11:42pm", channel: "WhatsApp", detail: "Sarah, SW12 - boiler quote", outcome: "booked in 8s" },
  { time: "09:14am", channel: "Phone", detail: "Mike, SE5 - burst pipe", outcome: "2pm slot" },
  { time: "08:51am", channel: "Email", detail: "Checkatrade lead - bathroom refit", outcome: "quoted" },
  { time: "08:22am", channel: "Web form", detail: "Priya, NW6 - annual service", outcome: "Thu 10am" },
  { time: "07:55am", channel: "Google Ad", detail: "James, W4 - boiler install", outcome: "callback set" },
] as const;

const products = [
  {
    tag: "01 - Book",
    icon: PhoneCall,
    title: "Answer every call. Book jobs 24/7.",
    pitch:
      "An always-on agent that picks up the phone, replies on WhatsApp, qualifies the job and drops the booking into your diary.",
    features: ["Phone, WhatsApp, web chat, email and Google leads", "Average speed-to-lead: 8 seconds", "Trained to speak like your business"],
    rows: [
      ["WhatsApp - Sarah", "Booked - 8s"],
      ["Phone - Mike", "Booked - 0s"],
      ["Web - Priya", "Booked - 9s"],
    ],
  },
  {
    tag: "02 - Win Back",
    icon: MessageSquareText,
    title: "Every quote chased. Every invoice followed up.",
    pitch:
      "SMS and email follow-ups re-engage cold quotes and chase overdue invoices until they are won, paid or ready for owner review.",
    features: ["Polite multi-channel follow-up", "On-brand messages written for trades", "Only escalates when a human is needed"],
    rows: [
      ["QT-091 - GBP 2,000", "Won - day 5"],
      ["INV-088 - GBP 850", "Paid - day 4"],
      ["INV-090 - GBP 1,200", "Chasing"],
    ],
  },
  {
    tag: "03 - Run",
    icon: CalendarCheck2,
    title: "Diary full. Engineers briefed. Invoices fired.",
    pitch:
      "Bookings flow into the scheduler, engineers get the job context, and the customer gets the right message at the right time.",
    features: ["Live scheduler with engineer assignment", "Job briefs with address, parts and notes", "Review requests after completed work"],
    rows: [
      ["9am - Mike - SE5", "On site"],
      ["10am - Sarah survey", "New"],
      ["2pm - J. Ryder", "Scheduled"],
    ],
  },
] as const;

const processSteps = [
  {
    day: "Day 1",
    title: "Map how your business actually works",
    detail:
      "Services, prices, areas, hours, common questions and the way you answer the phone. We document it before anything goes live.",
  },
  {
    day: "Day 2-5",
    title: "Build and train your AI front office",
    detail:
      "Phone forwarding or porting, WhatsApp, web chat and email connected. The agent is trained on your qualifying questions and booking rules.",
  },
  {
    day: "Day 6",
    title: "Test it side by side",
    detail:
      "You hear it answer test calls and messages. We tune tone, handoff rules and edge cases until it fits your business.",
  },
  {
    day: "Day 7",
    title: "Live, capturing real leads",
    detail:
      "Your phone stops ringing out. WhatsApp replies happen in seconds. You get back on the tools while the diary fills.",
  },
  {
    day: "Ongoing",
    title: "Managed, tuned and improved",
    detail:
      "Weekly checks, monthly tuning and new answers added as you grow. You do not have to learn another piece of software.",
  },
] as const;

const proofStats = [
  {
    stat: "+GBP 3.4k",
    label: "extra monthly revenue",
    detail: "Average in the first 90 days from jobs that previously would have gone to voicemail.",
    dark: true,
  },
  {
    stat: "94%",
    label: "of inbound calls answered",
    detail: "Measured across phone, WhatsApp, web chat and email.",
    dark: false,
  },
  {
    stat: "8s",
    label: "average speed-to-lead",
    detail: "Across phone, WhatsApp, web forms and email enquiries.",
    dark: false,
  },
  {
    stat: "7 hrs",
    label: "back per week per owner",
    detail: "Time previously spent on admin, follow-ups and manual booking.",
    dark: false,
  },
] as const;

const faqs = [
  {
    question: "Will the AI sound like a real person?",
    answer:
      "Yes. It is trained on your services, your tone, your opening hours and your booking rules. We test the flows with you before launch.",
  },
  {
    question: "What happens if it cannot handle something?",
    answer:
      "It takes the details, logs the item for review and pings you. Nothing is dropped, and you can confirm or amend the booking.",
  },
  {
    question: "Do I need to change my phone number?",
    answer:
      "No. You can forward your current number or port it later. Customers can keep calling the number they already know.",
  },
  {
    question: "What if I already use Jobber, ServiceM8 or Commusoft?",
    answer:
      "CustomerJourneys.AI can sit alongside your current setup and push bookings, customer details, jobs and invoices into the workflow you already use.",
  },
  {
    question: "What size of business is this for?",
    answer:
      "From a one-van owner answering calls between jobs to a growing team that needs the office to stop being the bottleneck.",
  },
  {
    question: "Can I cancel?",
    answer:
      "Yes. Monthly rolling. You keep your data, your customer list and your phone number. If it is not paying for itself, it should not stay.",
  },
] as const;

const includes = [
  "AI receptionist across phone, WhatsApp, web chat and email",
  "Live scheduler, enquiries, jobs, quotes, invoices and payment chase",
  "Done-with-you onboarding with go-live in 7 days",
  "Weekly checks, monthly tuning and UK support",
  "Monthly rolling plan with your data kept portable",
] as const;

function BrandMark() {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#c2893a] text-sm font-black text-[#15131a]">
      CJ
    </span>
  );
}

export default function CustomerJourneysAiPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4efe7] text-[#18161a]">
      <section className="overflow-hidden border-b border-white/10 bg-[#15131a] py-2 text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 text-[11px] sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-2 font-semibold uppercase tracking-[0.22em] text-[#dbc092]">
            <span className="h-2 w-2 rounded-full bg-[#c2893a]" />
            Live captured today
          </div>
          <div className="no-scrollbar flex min-w-0 gap-8 overflow-x-auto font-mono text-white/58">
            {[...tickerItems, ...tickerItems].map((item, index) => (
              <span key={`${item.time}-${index}`} className="shrink-0">
                <span className="text-[#dbc092]">{item.time}</span> - <span className="text-white">{item.channel}</span> - {item.detail} -{" "}
                <span className="text-emerald-300">{item.outcome}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <header className="sticky top-0 z-40 border-b border-[#d8cab3] bg-[#f4efe7]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/empire-tech-solutions" className="flex items-center gap-3">
            <BrandMark />
            <span className="text-lg font-black tracking-tight text-[#15131a]">
              CustomerJourneys<span className="text-[#7e5b23]">.AI</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-700 md:flex">
            <a href="#products" className="hover:text-[#7e5b23]">
              Products
            </a>
            <a href="#process" className="hover:text-[#7e5b23]">
              How it works
            </a>
            <a href="#proof" className="hover:text-[#7e5b23]">
              Proof
            </a>
            <a href="#pricing" className="hover:text-[#7e5b23]">
              Pricing
            </a>
          </nav>
          <a
            href={demoHref}
            className="inline-flex items-center justify-center rounded-xl bg-[#15131a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#24202b]"
          >
            Book a demo
          </a>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#15131a] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(194,137,58,0.26),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(79,120,195,0.18),_transparent_34%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-8 lg:py-24">
          <div className="min-w-0 max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#c2893a]/40 bg-white/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#dbc092]">
              <Sparkles size={14} />
              The AI front office for UK trades
            </div>
            <h1 className="mt-6 break-words text-[2.55rem] font-black leading-[0.98] tracking-tight [overflow-wrap:anywhere] sm:text-6xl lg:text-7xl">
              <span className="block text-[2.08rem] text-[#dbc092] sm:text-inherit">CustomerJourneys.AI</span>
              <span className="block">answers every call and fills every diary.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
              Always-on agents for UK plumbers, electricians and heating engineers. Every call answered. Every quote
              chased. Every job booked without missing a lead.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={demoHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c2893a] px-5 py-3 text-sm font-semibold text-[#15131a] transition hover:bg-[#d39c51]"
              >
                Book a 15-min demo
                <ArrowRight size={16} />
              </a>
              <a
                href="#products"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                See how it works
                <ChevronRight size={16} />
              </a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              <span className="shrink-0">Live in 7 days</span>
              <span className="shrink-0">UK-based team</span>
              <span className="shrink-0">Monthly rolling</span>
            </div>
          </div>

          <div className="min-w-0 rounded-[30px] border border-white/10 bg-white p-4 text-[#15131a] shadow-[0_28px_70px_rgba(0,0,0,0.28)]">
            <div className="rounded-2xl bg-[#15131a] px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-white/62">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#c2893a]" />
              CustomerJourneys.AI - Live - 11:42pm
            </div>
            <div className="mt-4 rounded-2xl border border-[#e7dccb] bg-[#fbf8f3]">
              <div className="flex items-center gap-3 border-b border-[#e7dccb] px-4 py-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#c2893a] text-sm font-bold text-[#15131a]">
                  SM
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Sarah Mitchell</p>
                  <p className="font-mono text-[11px] text-slate-500">+44 7901 234 567 - SW12</p>
                </div>
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
              </div>
              <div className="space-y-3 px-4 py-4 text-sm leading-6 text-slate-700">
                <p>
                  <span className="mr-2 font-mono text-[10px] font-bold uppercase text-slate-400">CU</span>
                  I need a quote for a new boiler. Mine keeps cutting out.
                </p>
                <p>
                  <span className="mr-2 font-mono text-[10px] font-bold uppercase text-[#7e5b23]">AI</span>
                  Happy to help. What area are you in, and which boiler do you have currently?
                </p>
                <p>
                  <span className="mr-2 font-mono text-[10px] font-bold uppercase text-slate-400">CU</span>
                  SW12. Worcester Bosch, around 12 years old.
                </p>
                <p>
                  <span className="mr-2 font-mono text-[10px] font-bold uppercase text-[#7e5b23]">AI</span>
                  We cover SW12. Thursday 10am for a survey?
                </p>
              </div>
              <div className="flex items-center gap-3 border-t border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                <CheckCircle2 size={18} />
                Booked - Thu 10am - survey scheduled
                <span className="ml-auto font-mono text-xs">8s</span>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <MiniNotice icon={<MessageSquareText size={17} />} title="WhatsApp - Mike, SE5" detail="emergency leak - booked" />
              <MiniNotice icon={<Mail size={17} />} title="Web form - Priya, NW6" detail="annual service - booked" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#d8cab3] bg-[#efe6d7]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:px-8 lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7e5b23]">Why speed wins jobs</p>
            <h2 className="mt-3 max-w-3xl text-4xl font-black leading-tight text-[#15131a] sm:text-5xl">
              Customers buy from whoever picks up first.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700">
              Not always the cheapest. Not always the best reviewed. The first business to respond gets the chance to book the job.
              Every missed call gives the next company a cleaner shot.
            </p>
          </div>
          <div className="grid gap-4">
            <CompareRow label="Typical trade response" value="42" unit="hours to respond" />
            <CompareRow label="With CustomerJourneys.AI" value="8" unit="seconds - every channel" active />
          </div>
        </div>
      </section>

      <section id="products" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7e5b23]">The system, end to end</p>
          <h2 className="mt-3 text-4xl font-black leading-tight text-[#15131a] sm:text-5xl">
            Your business scales on your terms.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-700">
            From first ring to final invoice, run by always-on agents and managed by our UK team.
          </p>
        </div>

        <div className="mt-10 grid gap-5 xl:grid-cols-3">
          {products.map((product) => {
            const Icon = product.icon;
            return (
              <article key={product.tag} className="rounded-[30px] border border-[#d8cab3] bg-white p-6 shadow-[0_20px_50px_rgba(45,35,16,0.08)]">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7e5b23]">{product.tag}</p>
                  <span className="rounded-2xl bg-[#f5ede0] p-3 text-[#7e5b23]">
                    <Icon size={22} />
                  </span>
                </div>
                <h3 className="mt-5 text-2xl font-black leading-tight text-[#15131a]">{product.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">{product.pitch}</p>
                <ul className="mt-5 space-y-3">
                  {product.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#7e5b23]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-2xl border border-[#eadfce] bg-[#fbf8f3] p-4 font-mono text-xs">
                  {product.rows.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 border-b border-dashed border-[#d8cab3] py-2 last:border-0">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-semibold text-[#15131a]">{value}</span>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="process" className="border-y border-[#d8cab3] bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7e5b23]">Built and managed by our team</p>
            <h2 className="mt-3 text-4xl font-black leading-tight text-[#15131a] sm:text-5xl">
              Live in 7 days, end to end.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-700">
              We do not ship you software and walk away. We build the agent, train it on your business, connect the channels and run it alongside you.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#d8cab3] bg-[#fbf8f3] px-4 py-3 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[#7e5b23]">
              <Wrench size={16} />
              UK team - done with you
            </div>
          </div>
          <div className="divide-y divide-[#e7dccb]">
            {processSteps.map((step) => (
              <div key={step.day} className="grid gap-3 py-6 sm:grid-cols-[120px_1fr]">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#7e5b23]">{step.day}</p>
                <div>
                  <h3 className="text-xl font-bold text-[#15131a]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="proof" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7e5b23]">Built on customer outcomes</p>
          <h2 className="mt-3 text-4xl font-black leading-tight text-[#15131a] sm:text-5xl">
            More jobs booked. Less work done.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-700">
            Anonymised numbers from early UK trades businesses running on CustomerJourneys.AI.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {proofStats.map((item) => (
            <article
              key={item.label}
              className={[
                "rounded-[30px] border p-7 shadow-[0_20px_50px_rgba(45,35,16,0.08)]",
                item.dark ? "border-[#15131a] bg-[#15131a] text-white" : "border-[#d8cab3] bg-white text-[#15131a]",
              ].join(" ")}
            >
              <p className={item.dark ? "text-5xl font-black text-[#dbc092]" : "text-5xl font-black text-[#7e5b23]"}>{item.stat}</p>
              <h3 className="mt-3 text-lg font-bold">{item.label}</h3>
              <p className={item.dark ? "mt-2 text-sm leading-7 text-white/68" : "mt-2 text-sm leading-7 text-slate-600"}>{item.detail}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 rounded-[30px] border border-[#d8cab3] bg-[#fbf8f3] p-7 shadow-[0_20px_50px_rgba(45,35,16,0.08)]">
          <p className="text-2xl font-bold leading-9 text-[#15131a]">
            &quot;I stopped being the person every problem came back to. The system answers, qualifies and books. I just look
            at the dashboard and turn up to jobs.&quot;
          </p>
          <p className="mt-5 font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
            Plumbing director - 2-van operation - London
          </p>
        </div>
      </section>

      <section id="pricing" className="bg-[#15131a] text-white">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:px-8 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#dbc092]">One price - no surprises</p>
          <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">
            Less than the cost of one part-time receptionist.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/60">
            Transparent setup and a flat managed monthly fee. No per-seat, per-call or hidden integration charges.
          </p>

          <div className="mx-auto mt-10 max-w-2xl rounded-[30px] border border-white/10 bg-white/6 p-7 text-left shadow-[0_28px_70px_rgba(0,0,0,0.24)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#dbc092]">Full system - done with you</p>
            <h3 className="mt-3 text-3xl font-black">CustomerJourneys.AI</h3>
            <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
              <PriceRow label="One-time setup and training" value="GBP 1,500" />
              <PriceRow label="Monthly, managed and tuned" value="GBP 500/mo" />
            </div>
            <ul className="mt-7 space-y-3">
              {includes.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-6 text-white/72">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#dbc092]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <a
              href={demoHref}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#c2893a] px-5 py-3 text-sm font-semibold text-[#15131a] transition hover:bg-[#d39c51]"
            >
              Book a 15-min demo
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7e5b23]">FAQ</p>
          <h2 className="mt-3 text-4xl font-black leading-tight text-[#15131a] sm:text-5xl">Questions worth asking.</h2>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          {faqs.map((item) => (
            <article key={item.question} className="rounded-[26px] border border-[#e7dccb] bg-white p-6 shadow-[0_18px_45px_rgba(45,35,16,0.06)]">
              <h3 className="text-lg font-bold text-[#15131a]">{item.question}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="demo" className="border-t border-[#d8cab3] bg-[#fbf8f3]">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
          <h2 className="text-5xl font-black leading-tight text-[#15131a] sm:text-6xl">Every moment, handled.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-700">
            See what your AI front office would book this week. 15 minutes, no heavy pitch, just the numbers.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href={demoHref}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c2893a] px-5 py-3 text-sm font-semibold text-[#15131a] transition hover:bg-[#d39c51]"
            >
              Book a 15-min demo
              <ArrowRight size={16} />
            </a>
            <a
              href="mailto:shaz@onlinebuzz.co.uk?subject=SYSTEM"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d8cab3] bg-white px-5 py-3 text-sm font-semibold text-[#15131a] transition hover:bg-[#f4efe7]"
            >
              DM &quot;SYSTEM&quot; by email
            </a>
          </div>
          <p className="mt-5 font-mono text-xs uppercase tracking-[0.18em] text-slate-400">
            No sales pitch - just the numbers - 15 minutes
          </p>
        </div>
      </section>

      <footer className="bg-[#15131a] text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 border-b border-white/10 pb-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-3">
                <BrandMark />
                <p className="text-lg font-black">
                  CustomerJourneys<span className="text-[#dbc092]">.AI</span>
                </p>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-7 text-white/54">
                The AI front office for UK plumbers, electricians and heating engineers. Built and managed by Online Buzz Marketing Ltd.
              </p>
            </div>
            <FooterLinks title="Product" links={["Book", "Win Back", "Run", "Pricing"]} />
            <FooterLinks title="Company" links={["How it works", "Proof", "Book a demo", "Contact"]} />
            <FooterLinks title="Legal" links={["Terms", "Privacy", "GDPR"]} />
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-6 font-mono text-xs text-white/35">
            <span>(c) 2026 Online Buzz Marketing Ltd - UK</span>
            <span>Made for the people on the tools.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function MiniNotice({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#e7dccb] bg-[#fbf8f3] p-3">
      <span className="rounded-xl bg-[#f5ede0] p-2 text-[#7e5b23]">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block truncate font-mono text-[11px] text-slate-500">{detail}</span>
      </span>
    </div>
  );
}

function CompareRow({ label, value, unit, active = false }: { label: string; value: string; unit: string; active?: boolean }) {
  return (
    <div className={active ? "rounded-[26px] border border-[#c2893a] bg-[#15131a] p-6 text-white" : "rounded-[26px] border border-[#d8cab3] bg-white p-6"}>
      <p className={active ? "text-xs font-semibold uppercase tracking-[0.24em] text-[#dbc092]" : "text-xs font-semibold uppercase tracking-[0.24em] text-slate-500"}>
        {label}
      </p>
      <p className="mt-3 flex items-end gap-3">
        <span className={active ? "text-6xl font-black text-white" : "text-6xl font-black text-[#7e5b23]"}>{value}</span>
        <span className={active ? "pb-2 text-sm text-white/60" : "pb-2 text-sm text-slate-600"}>{unit}</span>
      </p>
    </div>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-4">
      <span className="text-sm text-white/64">{label}</span>
      <span className="text-2xl font-black text-white">{value}</span>
    </div>
  );
}

function FooterLinks({ title, links }: { title: string; links: readonly string[] }) {
  return (
    <div>
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-white/35">{title}</p>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link}>
            <a href="#demo" className="text-sm text-white/58 hover:text-white">
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
