import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TRACERFY_LOOKUP_URL = "https://tracerfy.com/v1/api/trace/lookup/";

type JsonObject = Record<string, unknown>;
type NormalizedContact = {
  ownerName: string | null;
  phones: Array<{ number: string; type?: string; rank?: number; dnc?: boolean; carrier?: string }>;
  emails: Array<{ address: string; rank?: number }>;
  mailingAddress: JsonObject;
  hit: boolean;
};

const toRecord = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};

const toArray = (value: unknown): JsonObject[] =>
  Array.isArray(value)
    ? value.filter((item): item is JsonObject => !!item && typeof item === "object" && !Array.isArray(item))
    : [];

const normalizePhones = (persons: JsonObject[]) => {
  const seen = new Set<string>();

  return persons.flatMap((person) =>
    toArray(person.phones).flatMap((phone) => {
      const number = String(phone.number ?? "").trim();
      if (!number || seen.has(number)) return [];
      seen.add(number);
      return [{
        number,
        type: String(phone.type ?? "").trim() || undefined,
        rank: typeof phone.rank === "number" ? phone.rank : undefined,
        dnc: typeof phone.dnc === "boolean" ? phone.dnc : undefined,
        carrier: String(phone.carrier ?? "").trim() || undefined,
      }];
    })
  );
};

const normalizeEmails = (persons: JsonObject[]) => {
  const seen = new Set<string>();

  return persons.flatMap((person) =>
    toArray(person.emails).flatMap((email) => {
      const address = String(email.email ?? email.address ?? "").trim().toLowerCase();
      if (!address || seen.has(address)) return [];
      seen.add(address);
      return [{
        address,
        rank: typeof email.rank === "number" ? email.rank : undefined,
      }];
    })
  );
};

const BUSINESS_INDICATORS = [
  "llc",
  "inc",
  "corp",
  "co",
  "company",
  "trust",
  "holdings",
  "partners",
  "properties",
  "ventures",
  "estate",
];

const looksLikeBusinessEntity = (name: string | null) => {
  if (!name) return false;
  const normalized = name.toLowerCase();
  return BUSINESS_INDICATORS.some((token) => normalized.includes(token));
};

const splitOwnerName = (fullName: string | null) => {
  if (!fullName || looksLikeBusinessEntity(fullName)) return null;

  const cleaned = fullName
    .replace(/[,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.includes("&")) return null;

  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return null;

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
};

const isSparseContact = (contact: Pick<NormalizedContact, "phones" | "emails">) =>
  contact.phones.length < 2 || contact.emails.length === 0;

const mergeContacts = (primary: NormalizedContact, secondary: NormalizedContact): NormalizedContact => {
  const phoneMap = new Map<string, { number: string; type?: string; rank?: number; dnc?: boolean; carrier?: string }>();
  for (const phone of [...primary.phones, ...secondary.phones]) {
    if (!phone.number) continue;
    if (!phoneMap.has(phone.number)) phoneMap.set(phone.number, phone);
  }

  const emailMap = new Map<string, { address: string; rank?: number }>();
  for (const email of [...primary.emails, ...secondary.emails]) {
    if (!email.address) continue;
    if (!emailMap.has(email.address)) emailMap.set(email.address, email);
  }

  return {
    ownerName: secondary.ownerName ?? primary.ownerName,
    phones: Array.from(phoneMap.values()).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
    emails: Array.from(emailMap.values()).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
    mailingAddress: Object.keys(primary.mailingAddress).length > 0 ? primary.mailingAddress : secondary.mailingAddress,
    hit: primary.hit || secondary.hit,
  };
};

const extractTracerfyContact = (payload: JsonObject, fallbackOwnerName: string): NormalizedContact => {
  const persons = toArray(payload.persons);
  const owner =
    persons.find((person) => person.property_owner === true) ??
    persons[0] ??
    {};
  const mailingAddress = toRecord(owner.mailing_address ?? owner.mailingAddress);
  const splitName = [owner.first_name, owner.last_name]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ");
  const splitNameCandidate = splitName || undefined;
  const payloadName = typeof payload.name === "string" ? payload.name : undefined;
  const ownerFullName = typeof owner.full_name === "string" ? owner.full_name : undefined;
  const nameCandidate = ownerFullName ?? splitNameCandidate ?? payloadName ?? fallbackOwnerName;
  const fullName = String(nameCandidate).trim() || null;

  return {
    ownerName: fullName,
    phones: normalizePhones(persons),
    emails: normalizeEmails(persons),
    mailingAddress,
    hit: payload.hit !== false && persons.length > 0,
  };
};

const callTracerfyLookup = async (
  tracerfyKey: string,
  body: Record<string, unknown>,
): Promise<JsonObject> => {
  const tracerfyResponse = await fetch(TRACERFY_LOOKUP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tracerfyKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!tracerfyResponse.ok) {
    const responseBody = await tracerfyResponse.text().catch(() => "");
    throw new Error(`Tracerfy API ${tracerfyResponse.status}: ${responseBody.slice(0, 300)}`);
  }

  return await tracerfyResponse.json();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const tracerfyKey = Deno.env.get("TRACERFY_API_KEY");

  try {
    // Authenticate user
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

    const { propertyId, forceRefresh, address: directAddress, city: directCity, state: directState, zip: directZip } = await req.json();

    if (!propertyId && !directAddress) {
      return new Response(JSON.stringify({ error: "propertyId or address is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tracerfyKey) {
      return new Response(JSON.stringify({ error: "Skip tracing service not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // --- Direct address lookup mode (no property in DB required) ---
    if (!propertyId && directAddress) {
      // Deduct 1 credit directly
      const { data: profile } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", user.id)
        .single();
      const currentCredits = typeof profile?.credits === "number" ? profile.credits : 0;
      if (currentCredits < 1) {
        return new Response(JSON.stringify({ error: "Insufficient skip trace credits", code: "NO_CREDITS" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("profiles").update({ credits: currentCredits - 1 }).eq("id", user.id);

      try {
        const ownerLookupPayload = await callTracerfyLookup(tracerfyKey, {
          address: directAddress,
          city: directCity ?? "",
          state: directState ?? "",
          zip: directZip ?? "",
          find_owner: true,
        });
        let contact = extractTracerfyContact(ownerLookupPayload, "");

        const targetedName = splitOwnerName(contact.ownerName);
        if (targetedName && isSparseContact(contact)) {
          const enriched = await callTracerfyLookup(tracerfyKey, {
            address: directAddress,
            city: directCity ?? "",
            state: directState ?? "",
            zip: directZip ?? "",
            find_owner: false,
            first_name: targetedName.firstName,
            last_name: targetedName.lastName,
          });
          contact = mergeContacts(contact, extractTracerfyContact(enriched, contact.ownerName ?? ""));
        }

        return new Response(JSON.stringify({ ok: true, cached: false, direct: true, contact }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        // Refund credit on failure
        await supabase.from("profiles").update({ credits: currentCredits }).eq("id", user.id);
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: `Skip trace failed: ${msg}` }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // --- Property ID mode (existing flow) ---
    // Check if we already have a cached skip trace for this (property, user) pair
    const { data: existing } = await supabase
      .from("owner_contacts")
      .select("*")
      .eq("property_id", propertyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing && !forceRefresh) {
      // Return cached result — no credit charge
      return new Response(JSON.stringify({ ok: true, cached: true, contact: existing }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the property to get address + owner name
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("address, city, state, zip, distress_details")
      .eq("id", propertyId)
      .single();

    if (propError || !property) {
      return new Response(JSON.stringify({ error: "Property not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const distressDetails = property.distress_details as Record<string, unknown> ?? {};
    const ownerName = (distressDetails.ownerName ?? distressDetails.owner_name ?? "") as string;

    // Deduct 1 credit atomically BEFORE calling Tracerfy
    // Uses userClient so auth.uid() resolves correctly in the RPC
    const { data: deducted, error: deductError } = await userClient.rpc(
      "deduct_credit_for_property",
      { p_property_id: propertyId }
    );

    if (deductError || !deducted) {
      return new Response(
        JSON.stringify({ error: "Insufficient skip trace credits", code: "NO_CREDITS" }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Call Tracerfy API
    let ownerLookupContact: NormalizedContact | null = null;
    let targetedLookupContact: NormalizedContact | null = null;
    let tracerfyFailed = false;

    try {
      const ownerLookupPayload = await callTracerfyLookup(tracerfyKey, {
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
        find_owner: true,
      });
      ownerLookupContact = extractTracerfyContact(ownerLookupPayload, ownerName);

      const targetedName = splitOwnerName(ownerLookupContact.ownerName ?? ownerName);
      if (targetedName && isSparseContact(ownerLookupContact)) {
        const targetedLookupPayload = await callTracerfyLookup(tracerfyKey, {
          address: property.address,
          city: property.city,
          state: property.state,
          zip: property.zip,
          find_owner: false,
          first_name: targetedName.firstName,
          last_name: targetedName.lastName,
        });
        targetedLookupContact = extractTracerfyContact(
          targetedLookupPayload,
          ownerLookupContact.ownerName ?? ownerName,
        );
      }
    } catch (tracerfyError) {
      const errMsg = tracerfyError instanceof Error ? tracerfyError.message : String(tracerfyError);
      console.error("[skip-trace] Tracerfy call failed:", errMsg);
      tracerfyFailed = true;

      // Refund the credit -- read current balance, add 1 back
      try {
        const { data: curr } = await supabase
          .from("profiles")
          .select("credits")
          .eq("id", user.id)
          .single();
        const currentCredits = typeof curr?.credits === "number" ? curr.credits : 0;
        await supabase
          .from("profiles")
          .update({ credits: currentCredits + 1 })
          .eq("id", user.id);
        console.log(`[skip-trace] Refunded 1 credit to user ${user.id}`);
      } catch (refundErr) {
        console.error("[skip-trace] Credit refund failed:", refundErr);
      }

      return new Response(
        JSON.stringify({ error: `Skip trace service error: ${errMsg}` }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (tracerfyFailed) {
      return new Response(JSON.stringify({ error: "Skip trace failed" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map Tracerfy response to our schema
    // Tracerfy instant lookup returns `persons[]`; we collapse those into one contact row for the property.
    const freshContact = ownerLookupContact
      ? (targetedLookupContact ? mergeContacts(ownerLookupContact, targetedLookupContact) : ownerLookupContact)
      : extractTracerfyContact({}, ownerName);
    const existingContact = existing
      ? {
          ownerName: typeof existing.owner_name === "string" ? existing.owner_name : null,
          phones: Array.isArray(existing.phones) ? existing.phones as NormalizedContact["phones"] : [],
          emails: Array.isArray(existing.emails) ? existing.emails as NormalizedContact["emails"] : [],
          mailingAddress: toRecord(existing.mailing_address),
          hit: true,
        }
      : null;
    const contact = existingContact ? mergeContacts(existingContact, freshContact) : freshContact;
    const contactRow = {
      property_id: propertyId,
      user_id: user.id,
      owner_name: contact.ownerName,
      phones: contact.phones,
      emails: contact.emails,
      mailing_address: contact.mailingAddress,
      skip_trace_source: targetedLookupContact ? "tracerfy_enriched" : "tracerfy",
      traced_at: new Date().toISOString(),
    };

    const contactQuery = existing?.id
      ? supabase
          .from("owner_contacts")
          .update(contactRow)
          .eq("id", existing.id)
      : supabase.from("owner_contacts").insert(contactRow);

    const { data: inserted, error: insertError } = await contactQuery
      .select()
      .single();

    if (insertError) {
      console.error("[skip-trace] Failed to save owner contact:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save contact data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, cached: false, contact: inserted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[skip-trace] Unhandled error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
