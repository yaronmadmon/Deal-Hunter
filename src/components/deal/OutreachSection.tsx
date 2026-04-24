import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Copy, Phone, Mail } from "lucide-react";

interface OwnerContact {
  owner_name?: string | null;
  phones?: Array<{ number?: string }> | null;
  emails?: Array<{ address?: string }> | null;
}

interface Props {
  propertyId: string;
  ownerContact?: OwnerContact | null;
}

export const OutreachSection = ({ propertyId, ownerContact }: Props) => {
  const [tab, setTab] = useState<"email" | "sms">("email");
  const [loading, setLoading] = useState(false);
  const [emailDraft, setEmailDraft] = useState<{ subject: string; body: string } | null>(null);
  const [smsDraft, setSmsDraft] = useState<{ body: string } | null>(null);

  const firstPhone = ownerContact?.phones?.[0]?.number ?? null;
  const firstEmail = ownerContact?.emails?.[0]?.address ?? null;

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-outreach", {
        body: { propertyId, outreachType: tab },
      });
      if (error || !data?.ok) {
        toast.error("Failed to generate draft. Try again.");
        return;
      }
      if (tab === "email") {
        setEmailDraft({ subject: data.draft.subject ?? "", body: data.draft.body ?? "" });
      } else {
        setSmsDraft({ body: data.draft.body ?? "" });
      }
    } catch {
      toast.error("Failed to generate draft.");
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied!")).catch(() => toast.error("Copy failed"));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Generate a personalized message based on this deal's distress signals and owner situation.
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "email" | "sms")}>
        <TabsList>
          <TabsTrigger value="email">Email Draft</TabsTrigger>
          <TabsTrigger value="sms">SMS Draft</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-3 mt-4">
          <Button onClick={generate} disabled={loading} size="sm" variant="outline">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            {loading ? "Generating…" : emailDraft ? "Regenerate" : "Generate Email Draft"}
          </Button>

          {emailDraft && (
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Subject</label>
                <Input
                  value={emailDraft.subject}
                  onChange={(e) => setEmailDraft({ ...emailDraft, subject: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Body</label>
                <Textarea
                  value={emailDraft.body}
                  onChange={(e) => setEmailDraft({ ...emailDraft, body: e.target.value })}
                  rows={10}
                  className="text-sm resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => copy(`Subject: ${emailDraft.subject}\n\n${emailDraft.body}`)}>
                  <Copy className="w-3.5 h-3.5 mr-1.5" />Copy
                </Button>
                {firstEmail && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={`mailto:${firstEmail}?subject=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(emailDraft.body)}`}>
                      <Mail className="w-3.5 h-3.5 mr-1.5" />Open in Mail App
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sms" className="space-y-3 mt-4">
          <Button onClick={generate} disabled={loading} size="sm" variant="outline">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            {loading ? "Generating…" : smsDraft ? "Regenerate" : "Generate SMS Draft"}
          </Button>

          {smsDraft && (
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Message</label>
                  <span className={`text-xs ${smsDraft.body.length > 160 ? "text-red-400" : "text-muted-foreground"}`}>
                    {smsDraft.body.length}/160
                  </span>
                </div>
                <Textarea
                  value={smsDraft.body}
                  onChange={(e) => setSmsDraft({ body: e.target.value })}
                  rows={4}
                  className="text-sm resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => copy(smsDraft.body)}>
                  <Copy className="w-3.5 h-3.5 mr-1.5" />Copy
                </Button>
                {firstPhone && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={`sms:${firstPhone}?body=${encodeURIComponent(smsDraft.body)}`}>
                      <Phone className="w-3.5 h-3.5 mr-1.5" />Open SMS App
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
