import { headers } from "next/headers";
import { AiChatBubble } from "./AiChatBubble";
import { EducationalChatBubble } from "./EducationalChatBubble";
import { isEmpireWebsiteHost } from "@/modules/education/policy";

export async function WebsiteChat({ preflightEnabled = false }: { preflightEnabled?: boolean }) {
  const host = (await headers()).get("host");
  return isEmpireWebsiteHost(host) ? (
    <EducationalChatBubble />
  ) : (
    <AiChatBubble preflightEnabled={preflightEnabled} />
  );
}
