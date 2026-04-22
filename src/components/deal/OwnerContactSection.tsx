import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface OwnerContact {
  id: string;
  owner_name?: string | null;
  phones?: { number: string; type?: string }[] | string[] | null;
  emails?: { email: string }[] | string[] | null;
  mailing_address?: { street?: string; city?: string; state?: string; zip?: string } | null;
  traced_at?: string | null;
}

interface Props {
  propertyId: string;
  contact?: OwnerContact | null;
  onContactRevealed?: (contact: OwnerContact) => void;
}

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied!"));
};

const extractPhone = (p: any): string => typeof p === "string" ? p : p?.number ?? "";
const extractEmail = (e: any): string => typeof e === "string" ? e : e?.email ?? "";

export const OwnerContactSection = ({ propertyId, contact, onContactRevealed }: Props) => {
  const [tracing, setTracing] = useState(false);

  const handleSkipTrace = async () => {
    setTracing(true);
    try {
      const { data, error } = await supabase.functions.invoke("skip-trace", {
        body: { propertyId },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error === "Insufficient credits") {
          toast.error("Not enough skip trace credits. Buy more in Settings.");
        } else {
          toast.error(data.error);
        }
        return;
      }
      onContactRevealed?.(data);
      toast.success("Owner contact info revealed!");
    } catch {
      toast.error("Failed to retrieve owner info. Please try again.");
    } finally {
      setTracing(false);
    }
  };

  if (!contact) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
        <Phone className="h-8 w-8 text-muted-foreground mx-auto" />
        <div>
          <p className="font-medium text-foreground">Owner contact not revealed yet</p>
          <p className="text-sm text-muted-foreground mt-1">Uses 1 skip trace credit. Up to 8 phone numbers and 5 emails.</p>
        </div>
        <Button onClick={handleSkipTrace} disabled={tracing} className="w-full">
          {tracing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Tracing...</> : "Get Owner Info"}
        </Button>
      </div>
    );
  }

  const phones = (contact.phones ?? []).map(extractPhone).filter(Boolean);
  const emails = (contact.emails ?? []).map(extractEmail).filter(Boolean);
  const addr = contact.mailing_address;

  return (
    <div className="space-y-4">
      {contact.owner_name && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{contact.owner_name}</p>
          {contact.traced_at && (
            <span className="text-xs text-muted-foreground">Traced {new Date(contact.traced_at).toLocaleDateString()}</span>
          )}
        </div>
      )}

      {phones.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Phone Numbers</p>
          {phones.map((p, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{p}</span>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToClipboard(p)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {emails.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Email Addresses</p>
          {emails.map((e, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{e}</span>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToClipboard(e)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {addr && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-background px-4 py-3">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-foreground">
            {[addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
};
