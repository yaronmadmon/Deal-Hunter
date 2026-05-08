import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, Mail, MapPin, MessageSquare, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

interface OwnerContact {
  id: string;
  owner_name?: string | null;
  phones?: { number?: string; type?: string }[] | string[] | null;
  emails?: { email?: string; address?: string }[] | string[] | null;
  mailing_address?: { street?: string; city?: string; state?: string; zip?: string } | null;
  traced_at?: string | null;
}

interface Props {
  propertyId: string;
  contact?: OwnerContact | null;
  fallbackOwnerName?: string | null;
  propertyAddress?: string | null;
  onContactRevealed?: (contact: OwnerContact) => void;
}

const extractPhone = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return String((value as { number?: string }).number ?? "");
  return "";
};

const extractEmail = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as { email?: string; address?: string };
    return String(record.address ?? record.email ?? "");
  }
  return "";
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
};

const formatDialLabel = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return value;
};

const AddressRow = ({ value }: { value: string }) => (
  <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
    <div className="flex min-w-0 items-center gap-2 text-sm text-foreground">
      <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{value}</span>
    </div>
    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(value)}>
      <Copy className="h-3.5 w-3.5" />
    </Button>
  </div>
);

const PhoneRow = ({ phone, propertyAddress }: { phone: string; propertyAddress?: string | null }) => {
  const label = formatDialLabel(phone);
  const smsBody = encodeURIComponent(
    `Hi, I'm a local investor reaching out about your property${propertyAddress ? ` at ${propertyAddress}` : ""}. Would you be open to a quick conversation?`
  );
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 text-sm text-foreground">
        <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
        <a href={`tel:${phone}`} className="truncate font-medium hover:underline">{label}</a>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={`sms:${phone}?body=${smsBody}`}
          title="Send text"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </a>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(phone)}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

const EmailRow = ({ email, propertyAddress }: { email: string; propertyAddress?: string | null }) => {
  const subject = encodeURIComponent(`Regarding${propertyAddress ? ` ${propertyAddress}` : " your property"}`);
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 text-sm text-foreground">
        <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
        <a href={`mailto:${email}?subject=${subject}`} className="truncate font-medium hover:underline">{email}</a>
      </div>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(email)}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export const OwnerContactSection = ({ propertyId, contact, fallbackOwnerName, propertyAddress, onContactRevealed }: Props) => {
  const [tracing, setTracing] = useState(false);

  const phones = (contact?.phones ?? []).map(extractPhone).filter(Boolean);
  const emails = (contact?.emails ?? []).map(extractEmail).filter(Boolean);
  const isSparseContact = Boolean(contact) && (phones.length < 2 || emails.length === 0);

  const handleSkipTrace = async (forceRefresh = false) => {
    setTracing(true);
    try {
      const { data, error } = await supabase.functions.invoke("skip-trace", {
        body: { propertyId, forceRefresh },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error === "Insufficient credits" ? "Not enough skip trace credits. Buy more in Settings." : data.error);
        return;
      }
      onContactRevealed?.(data?.contact ?? data);
      toast.success("Owner contact info updated.");
    } catch {
      toast.error("Failed to retrieve owner info. Please try again.");
    } finally {
      setTracing(false);
    }
  };

  const mailingAddress = contact?.mailing_address
    ? [contact.mailing_address.street, contact.mailing_address.city, contact.mailing_address.state, contact.mailing_address.zip].filter(Boolean).join(", ")
    : "";
  const ownerName = contact?.owner_name || fallbackOwnerName || "Owner name unavailable";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Owner</p>
            <div className="mt-2 flex items-center gap-2">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <p className="text-lg font-semibold text-foreground">{ownerName}</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {contact?.traced_at
                ? `Skip trace completed ${new Date(contact.traced_at).toLocaleDateString()}`
                : fallbackOwnerName
                ? "Public record owner only. Run skip trace for phones and email."
                : "No public owner name found yet. Run skip trace to try enriched contact data."}
            </p>
          </div>

          <Button onClick={() => void handleSkipTrace(Boolean(contact))} disabled={tracing}>
            {tracing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Tracing...
              </>
            ) : (
              contact ? "Refresh Owner Info" : "Get Owner Info"
            )}
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {phones.length} phone{phones.length === 1 ? "" : "s"} and {emails.length} email{emails.length === 1 ? "" : "s"} available.
        </p>
        {isSparseContact ? (
          <p className="mt-1 text-xs text-muted-foreground">
            This hit is shallow. Refresh retries with a targeted owner lookup.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Phone Numbers</p>
          {phones.length > 0 ? (
            <div className="space-y-2">
              {phones.map((phone, index) => (
                <PhoneRow key={`${phone}-${index}`} phone={phone} propertyAddress={propertyAddress} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No phone numbers available yet.</p>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Email Addresses</p>
          {emails.length > 0 ? (
            <div className="space-y-2">
              {emails.map((email, index) => (
                <EmailRow key={`${email}-${index}`} email={email} propertyAddress={propertyAddress} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No email addresses available yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Mailing Address</p>
        {mailingAddress ? (
          <div className="mt-3">
            <AddressRow value={mailingAddress} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No mailing address available yet.</p>
        )}
      </div>
    </div>
  );
};
