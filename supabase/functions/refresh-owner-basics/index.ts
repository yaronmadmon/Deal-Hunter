import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_SOURCE_TIMEOUT = 15000;
const MAX_BATCH_SIZE = 50;
const CONCURRENCY = 3;
const CHUNK_DELAY_MS = 250;

type PropertyRow = {
  id: string;
  user_id: string;
  attom_id?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  last_sale_date?: string | null;
  distress_details?: Record<string, unknown> | null;
};

type AttomOwnerMortgageDetails = {
  attomId: string;
  ownerName: string | null;
  ownerMailingAddress: string | null;
  mortgageLoanAmount: number | null;
  mortgageLenderName: string | null;
  mortgageLoanType: string | null;
  deedBuyerName: string | null;
  deedSellerName: string | null;
  rawDeed: Record<string, unknown> | null;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const toTextValue = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const toNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const normalized = value.replace(/[$,\s]/g, "");
      if (!normalized) continue;
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const buildOwnerDisplayName = (ownerRecord: Record<string, unknown>) => {
  const owner1 = toRecord(ownerRecord.owner1);
  const owner2 = toRecord(ownerRecord.owner2);

  const firstOwner = [
    toTextValue(owner1.firstnameandmi, owner1.firstNameAndMi, owner1.firstname, owner1.firstName),
    toTextValue(owner1.lastname, owner1.lastName),
  ].filter(Boolean).join(" ").trim();

  const secondOwner = [
    toTextValue(owner2.firstnameandmi, owner2.firstNameAndMi, owner2.firstname, owner2.firstName),
    toTextValue(owner2.lastname, owner2.lastName),
  ].filter(Boolean).join(" ").trim();

  return toTextValue(
    firstOwner && secondOwner ? `${firstOwner} & ${secondOwner}` : firstOwner || secondOwner,
    ownerRecord.name1full,
    ownerRecord.ownerName,
  );
};

const buildPartyDisplayName = (partyRecord: Record<string, unknown>) => {
  const party1 = toRecord(partyRecord.party1);
  const party2 = toRecord(partyRecord.party2);

  const firstParty = [
    toTextValue(party1.firstnameandmi, party1.firstNameAndMi, party1.firstname, party1.firstName),
    toTextValue(party1.lastname, party1.lastName),
  ].filter(Boolean).join(" ").trim();

  const secondParty = [
    toTextValue(party2.firstnameandmi, party2.firstNameAndMi, party2.firstname, party2.firstName),
    toTextValue(party2.lastname, party2.lastName),
  ].filter(Boolean).join(" ").trim();

  return toTextValue(
    firstParty && secondParty ? `${firstParty} & ${secondParty}` : firstParty || secondParty,
    partyRecord.name1full,
    partyRecord.name,
    partyRecord.ownerName,
  );
};

const normalizeOwnerMortgageProperty = (propertyRecord: Record<string, unknown>): AttomOwnerMortgageDetails => {
  const identifier = toRecord(propertyRecord.identifier);
  const owner = toRecord(propertyRecord.owner);
  const mortgage = toRecord(propertyRecord.mortgage);
  const lender = toRecord(mortgage.lender);
  const deed = toRecord(propertyRecord.deed);
  const deedBuyer = toRecord(deed.buyer);
  const deedSeller = toRecord(deed.seller);

  const lenderName = toTextValue(
    [toTextValue(lender.firstname, lender.firstName), toTextValue(lender.lastname, lender.lastName)]
      .filter(Boolean)
      .join(" ")
      .trim(),
    lender.companyname,
    lender.companyName,
    lender.name,
  );

  return {
    attomId: String(identifier.attomId ?? identifier.Id ?? propertyRecord.id ?? "").trim(),
    ownerName: buildOwnerDisplayName(owner),
    ownerMailingAddress: toTextValue(owner.mailingaddressoneline, owner.mailingAddressOneLine),
    mortgageLoanAmount: toNumber(mortgage.amount, toRecord(mortgage.amount).loanamt, toRecord(mortgage.amount).amount),
    mortgageLenderName: lenderName,
    mortgageLoanType: toTextValue(
      mortgage.loantypecode,
      mortgage.loanTypeCode,
      mortgage.deedtype,
      mortgage.deedType,
      mortgage.interestratetype,
      mortgage.interestRateType,
    ),
    deedBuyerName: buildPartyDisplayName(deedBuyer),
    deedSellerName: buildPartyDisplayName(deedSeller),
    rawDeed: Object.keys(deed).length > 0 ? deed : null,
  };
};

async function fetchAttomOwnerMortgageDetails(opts: {
  attomId?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): Promise<AttomOwnerMortgageDetails | null> {
  const attomApiKey = Deno.env.get("ATTOM_API_KEY");
  if (!attomApiKey) throw new Error("ATTOM_API_KEY not configured");

  const params = new URLSearchParams({ page: "1", pagesize: "1" });

  if (opts.attomId) {
    params.set("attomId", opts.attomId);
  } else {
    const addressLine = toTextValue(opts.address);
    const localityLine = [toTextValue(opts.city), toTextValue(opts.state), toTextValue(opts.zip)]
      .filter(Boolean)
      .join(", ")
      .replace(", ,", ",");

    if (addressLine) params.set("address1", addressLine);
    if (localityLine) {
      params.set("address2", localityLine.replace(/, ([A-Z]{2}), (\d{5}(?:-\d{4})?)/, ", $1 $2"));
    }
  }

  if (![...params.keys()].some((key) => key !== "page" && key !== "pagesize")) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_SOURCE_TIMEOUT);

  try {
    const response = await fetch(
      `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detailmortgageowner?${params.toString()}`,
      {
        headers: {
          apikey: attomApiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`ATTOM owner/mortgage error ${response.status}: ${body.slice(0, 500)}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const properties = Array.isArray(data.property)
      ? data.property as Record<string, unknown>[]
      : Array.isArray(data.properties)
      ? data.properties as Record<string, unknown>[]
      : [];

    if (properties.length === 0) return null;
    return normalizeOwnerMortgageProperty(properties[0]);
  } finally {
    clearTimeout(timeout);
  }
}

const chunk = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const enrichProperty = async (
  supabase: ReturnType<typeof createClient>,
  property: PropertyRow,
) => {
  const details = await fetchAttomOwnerMortgageDetails({
    attomId: property.attom_id,
    address: property.address,
    city: property.city,
    state: property.state,
    zip: property.zip,
  });

  if (!details) return;

  const currentDistressDetails = toRecord(property.distress_details);
  const currentMortgage = toRecord(currentDistressDetails.mortgage);

  const nextDistressDetails = {
    ...currentDistressDetails,
    ownerName: details.ownerName ?? toTextValue(currentDistressDetails.ownerName, currentDistressDetails.owner_name),
    ownerMailingAddress: details.ownerMailingAddress ?? toTextValue(currentDistressDetails.ownerMailingAddress),
    rawDeed: details.rawDeed ?? toRecord(currentDistressDetails.rawDeed),
    deedBuyerName: details.deedBuyerName ?? toTextValue(currentDistressDetails.deedBuyerName),
    deedSellerName: details.deedSellerName ?? toTextValue(currentDistressDetails.deedSellerName),
    mortgage: {
      ...currentMortgage,
      loanAmount: details.mortgageLoanAmount ?? toNumber(currentMortgage.loanAmount),
      lenderName: details.mortgageLenderName ?? toTextValue(currentMortgage.lenderName),
      loanType: details.mortgageLoanType ?? toTextValue(currentMortgage.loanType),
      isCashPurchase: typeof currentMortgage.isCashPurchase === "boolean" ? currentMortgage.isCashPurchase : false,
    },
  };

  const currentOwnerName = toTextValue(currentDistressDetails.ownerName, currentDistressDetails.owner_name);
  const currentOwnerMailingAddress = toTextValue(currentDistressDetails.ownerMailingAddress);
  const currentDeedBuyerName = toTextValue(currentDistressDetails.deedBuyerName);
  const currentDeedSellerName = toTextValue(currentDistressDetails.deedSellerName);
  const currentLoanAmount = toNumber(currentMortgage.loanAmount);
  const currentLenderName = toTextValue(currentMortgage.lenderName);
  const currentLoanType = toTextValue(currentMortgage.loanType);

  const changed =
    currentOwnerName !== nextDistressDetails.ownerName ||
    currentOwnerMailingAddress !== nextDistressDetails.ownerMailingAddress ||
    currentDeedBuyerName !== nextDistressDetails.deedBuyerName ||
    currentDeedSellerName !== nextDistressDetails.deedSellerName ||
    currentLoanAmount !== (nextDistressDetails.mortgage.loanAmount ?? null) ||
    currentLenderName !== (nextDistressDetails.mortgage.lenderName ?? null) ||
    currentLoanType !== (nextDistressDetails.mortgage.loanType ?? null);

  if (!changed) return;

  const { error } = await supabase
    .from("properties")
    .update({ distress_details: nextDistressDetails })
    .eq("id", property.id)
    .eq("user_id", property.user_id);

  if (error) {
    console.error("[refresh-owner-basics] Failed to update property", property.id, error);
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const propertyIds = Array.isArray(body.propertyIds)
      ? body.propertyIds.filter((value: unknown): value is string => typeof value === "string").slice(0, MAX_BATCH_SIZE)
      : [];

    if (propertyIds.length === 0) {
      return new Response(JSON.stringify({ error: "propertyIds is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: properties, error: propertiesError } = await supabase
      .from("properties")
      .select("id, user_id, attom_id, address, city, state, zip, last_sale_date, distress_details")
      .eq("user_id", user.id)
      .in("id", propertyIds);

    if (propertiesError) {
      return new Response(JSON.stringify({ error: propertiesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const propertyRows = (properties ?? []) as PropertyRow[];
    const missingOwnerRows = propertyRows.filter((property) => {
      const distressDetails = toRecord(property.distress_details);
      const mortgage = toRecord(distressDetails.mortgage);
      return (
        !toTextValue(distressDetails.ownerName, distressDetails.owner_name) ||
        toNumber(mortgage.loanAmount) === null ||
        (!toTextValue(distressDetails.deedBuyerName, distressDetails.deedSellerName) && Boolean(property.last_sale_date ?? toTextValue(toRecord(distressDetails.rawSale).saleTransDate)))
      );
    });

    const job = (async () => {
      for (const group of chunk(missingOwnerRows, CONCURRENCY)) {
        await Promise.all(group.map((property) =>
          enrichProperty(supabase, property).catch((error) => {
            console.error("[refresh-owner-basics] Enrichment failed", property.id, error);
          })
        ));
        await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
      }
    })();

    const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(job);
      return new Response(JSON.stringify({ ok: true, queued: missingOwnerRows.length }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await job;
    return new Response(JSON.stringify({ ok: true, refreshed: missingOwnerRows.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
