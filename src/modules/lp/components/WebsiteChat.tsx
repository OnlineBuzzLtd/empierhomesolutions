import { headers } from "next/headers";
import { AiChatBubble } from "./AiChatBubble";
import { EducationalChatBubble } from "./EducationalChatBubble";
import { isEmpireWebsiteHost } from "@/modules/education/policy";
import { getAbFlags } from "@/modules/lp/abFlags";

export async function WebsiteChat({ preflightEnabled = false }: { preflightEnabled?: boolean }) {
  if (getAbFlags().webchat !== "on") return null;
  const host = (await headers()).get("host");
  return isEmpireWebsiteHost(host) ? (
    <EducationalChatBubble />
  ) : (
    <AiChatBubble preflightEnabled={preflightEnabled} />
  );
}
