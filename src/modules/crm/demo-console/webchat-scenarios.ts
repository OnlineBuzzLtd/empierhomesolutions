export type DemoWebchatScenarioKey =
  | "emergency_repair_booking"
  | "boiler_install_survey"
  | "fixed_price_service_quote";

export type DemoWebchatScenario = {
  key: DemoWebchatScenarioKey;
  label: string;
  description: string;
  expectedOutcome: string;
  facts: {
    service: string;
    problem: string;
    addressLine: string;
    postcode: string;
    propertyNotes: string;
    preferredTime: string;
    acceptancePhrase: string;
    openingMessage: string;
    consolidatedDetailsMessage: string;
  };
  lines: string[];
};

export type DemoWebchatScenarioContext = {
  prospectName: string;
  prospectPhone: string;
};

export const DEMO_WEBCHAT_SCENARIOS: DemoWebchatScenario[] = [
  {
    key: "emergency_repair_booking",
    label: "Emergency repair booking",
    description: "No heating or hot water, then accepts the first suitable slot.",
    expectedOutcome: "Customer, enquiry, job, and appointment appear in Live CRM.",
    facts: {
      service: "Emergency boiler repair callout",
      problem: "No heating or hot water. The boiler is making a loud noise.",
      addressLine: "188 Hello Lane, Uxbridge",
      postcode: "UB8 1AA",
      propertyNotes: "Residential property; customer needs an urgent engineer visit.",
      preferredTime: "Tomorrow morning, preferably from 8am.",
      acceptancePhrase: "Yes, please book that.",
      openingMessage: "Hi, I have no heating or hot water and need someone urgently.",
      consolidatedDetailsMessage:
        "My name is {{prospect_name}}, my phone is {{prospect_phone}}, and the address is 188 Hello Lane, Uxbridge UB8 1AA. The boiler is making a loud noise and tomorrow morning from 8am works. Yes, please book the slot.",
    },
    lines: [
      "Hi, I have no heating or hot water and need someone urgently.",
      "My name is {{prospect_name}} and my number is {{prospect_phone}}.",
      "The address is 188 Hello Lane, Uxbridge UB8 1AA. The boiler is making a loud noise.",
      "Tomorrow morning works if you have anything.",
      "Yes, please book that.",
    ],
  },
  {
    key: "boiler_install_survey",
    label: "Boiler install survey",
    description: "Install enquiry where the AI should book a survey, not invent a price.",
    expectedOutcome: "Survey-classified booking appears; quote drafting waits for survey completion.",
    facts: {
      service: "Boiler install survey",
      problem: "Customer wants a quote for a new combi boiler installation.",
      addressLine: "188 Hello Lane, Uxbridge",
      postcode: "UB8 1AA",
      propertyNotes: "Three bedroom house; customer wants a survey before the quote.",
      preferredTime: "Tomorrow morning if available.",
      acceptancePhrase: "Tomorrow morning is good. Please confirm the survey.",
      openingMessage:
        "Hi, I need to book a boiler install survey for a new combi boiler. Can someone come out to assess it?",
      consolidatedDetailsMessage:
        "It is for {{prospect_name}}, my phone is {{prospect_phone}}, and the property is 188 Hello Lane, Uxbridge UB8 1AA. It is a three bedroom house and I want a survey for a new combi boiler install. Tomorrow morning is good if you can confirm the survey.",
    },
    lines: [
      "Hi, I need to book a boiler install survey for a new combi boiler. Can someone come out to assess it?",
      "It is for {{prospect_name}}. My phone is {{prospect_phone}}.",
      "The property is 188 Hello Lane, Uxbridge UB8 1AA. It is a three bedroom house.",
      "Can someone come and survey it this week?",
      "Tomorrow morning is good. Please confirm the survey.",
    ],
  },
  {
    key: "fixed_price_service_quote",
    label: "Fixed-price service quote",
    description: "Simple service booking that can safely use catalogue pricing.",
    expectedOutcome: "Booked service appears; AI quote draft can be generated from catalogue pricing.",
    facts: {
      service: "Boiler service",
      problem: "Customer needs a routine boiler service.",
      addressLine: "188 Hello Lane, Uxbridge",
      postcode: "UB8 1AA",
      propertyNotes: "Standard residential boiler service; no survey requested.",
      preferredTime: "Tomorrow after 8am.",
      acceptancePhrase: "Yes, book that slot please.",
      openingMessage: "Hi, I need a boiler service.",
      consolidatedDetailsMessage:
        "My name is {{prospect_name}}, my phone number is {{prospect_phone}}, and the address is 188 Hello Lane, Uxbridge UB8 1AA. I need a boiler service, tomorrow after 8am works, and yes please book that slot.",
    },
    lines: [
      "Hi, I need a boiler service.",
      "My name is {{prospect_name}} and my phone number is {{prospect_phone}}.",
      "The address is 188 Hello Lane, Uxbridge UB8 1AA.",
      "Tomorrow after 8am would work.",
      "Yes, book that slot please.",
    ],
  },
];

export function getDemoWebchatScenario(key: DemoWebchatScenarioKey): DemoWebchatScenario {
  return DEMO_WEBCHAT_SCENARIOS.find((scenario) => scenario.key === key) ?? DEMO_WEBCHAT_SCENARIOS[0];
}

export function renderDemoWebchatLine(line: string, context: DemoWebchatScenarioContext) {
  return line
    .replaceAll("{{prospect_name}}", context.prospectName)
    .replaceAll("{{prospect_phone}}", context.prospectPhone);
}

export function renderDemoWebchatScenarioFacts(
  scenario: DemoWebchatScenario,
  context: DemoWebchatScenarioContext,
) {
  return {
    ...scenario.facts,
    openingMessage: renderDemoWebchatLine(scenario.facts.openingMessage, context),
    consolidatedDetailsMessage: renderDemoWebchatLine(
      scenario.facts.consolidatedDetailsMessage,
      context,
    ),
    prospectName: context.prospectName,
    prospectPhone: context.prospectPhone,
  };
}
