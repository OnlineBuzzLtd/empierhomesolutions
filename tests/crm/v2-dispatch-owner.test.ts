import {afterEach,expect,it,vi} from "vitest";
import {dispatchDueNotifications} from "@/modules/crm/notifications/scheduler";
afterEach(()=>vi.unstubAllEnvs());
it("legacy dispatcher leaves Empire deliveries untouched after the shared owner moves to v2",async()=>{
 vi.stubEnv("CRM_V2_DISPATCH_HANDOFF_ENABLED","true");const sendSms=vi.fn();const query={select:()=>query,eq:()=>query,lte:()=>query,order:()=>query,limit:async()=>({data:[{id:"fixture",tenant_id:"11111111-1111-4111-8111-111111111111",next_attempt_at:null}],error:null}),maybeSingle:async()=>({data:{v2_dispatcher_owner:"v2"},error:null})};
 const result=await dispatchDueNotifications({schema:()=>({from:()=>query})} as never,{senders:{sendSms}});
 expect(sendSms).not.toHaveBeenCalled();expect(result.sent).toBe(0);expect(result.retried).toBe(1);
});
