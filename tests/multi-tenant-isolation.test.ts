import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { GET as getLeadsRoute } from "@/app/api/leads/route";
import { GET as getLeadMessagesRoute } from "@/app/api/leads/[leadId]/messages/route";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasSupabaseIntegrationEnv = Boolean(supabaseUrl && serviceRoleKey);

const describeIf = hasSupabaseIntegrationEnv ? describe : describe.skip;

type Agency = { id: string; api_key: string };
type Lead = { id: string };

describeIf("multi-tenant isolation", () => {
  it("isolates leads and messages between two agencies", async () => {
    const supabase = createClient(supabaseUrl as string, serviceRoleKey as string, {
      auth: { persistSession: false },
    });

    const scopeId = randomUUID();

    const createdAgencyIds: string[] = [];
    const createdLeadIds: string[] = [];

    const createAgency = async (name: string): Promise<Agency> => {
      const apiKey = `ag_test_${randomUUID().replaceAll("-", "")}`;
      const { data, error } = await supabase
        .from("agencies")
        .insert({ name, api_key: apiKey })
        .select("id,api_key")
        .single();

      if (error || !data) {
        throw new Error(`Unable to create agency: ${error?.message || "unknown"}`);
      }

      createdAgencyIds.push(data.id);
      return data as Agency;
    };

    const createLead = async (agencyId: string, name: string): Promise<Lead> => {
      const { data, error } = await supabase
        .from("leads")
        .insert({
          agency_id: agencyId,
          name,
          status: "cold",
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(`Unable to create lead: ${error?.message || "unknown"}`);
      }

      createdLeadIds.push(data.id);
      return data as Lead;
    };

    try {
      const agencyA = await createAgency(`Isolation A ${scopeId}`);
      const agencyB = await createAgency(`Isolation B ${scopeId}`);

      const leadA = await createLead(agencyA.id, `Lead A ${scopeId}`);
      const leadB = await createLead(agencyB.id, `Lead B ${scopeId}`);

      const { error: messageError } = await supabase.from("messages").insert({
        agency_id: agencyB.id,
        lead_id: leadB.id,
        sender: "user",
        role: "user",
        content: `Message B ${scopeId}`,
        timestamp: new Date().toISOString(),
      });

      if (messageError) {
        throw new Error(`Unable to create message: ${messageError.message}`);
      }

      const leadsResponseA = await getLeadsRoute(
        new Request(`http://localhost:3000/api/leads?agencyApiKey=${agencyA.api_key}`),
      );
      expect(leadsResponseA.status).toBe(200);
      const leadsPayloadA = (await leadsResponseA.json()) as { leads: Array<{ id: string }> };

      expect(leadsPayloadA.leads.some((lead) => lead.id === leadA.id)).toBe(true);
      expect(leadsPayloadA.leads.some((lead) => lead.id === leadB.id)).toBe(false);

      const crossAccessMessagesResponse = await getLeadMessagesRoute(
        new Request(`http://localhost:3000/api/leads/${leadB.id}/messages?agencyApiKey=${agencyA.api_key}`),
        { params: Promise.resolve({ leadId: leadB.id }) },
      );

      expect(crossAccessMessagesResponse.status).toBe(404);
    } finally {
      if (createdLeadIds.length > 0) {
        await supabase.from("leads").delete().in("id", createdLeadIds);
      }

      if (createdAgencyIds.length > 0) {
        await supabase.from("agencies").delete().in("id", createdAgencyIds);
      }
    }
  }, 30_000);
});
