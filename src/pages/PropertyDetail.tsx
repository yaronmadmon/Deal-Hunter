import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/report/ScoreRing";
import { CollapsibleSection } from "@/components/report/CollapsibleSection";
import { PropertyInfoSection } from "@/components/deal/PropertyInfoSection";
import { DistressDetailsSection } from "@/components/deal/DistressDetailsSection";
import { AIAnalysisSection } from "@/components/deal/AIAnalysisSection";
import { IntelligenceSection } from "@/components/deal/IntelligenceSection";
import { OwnerContactSection } from "@/components/deal/OwnerContactSection";
import { ContactLogSection } from "@/components/deal/ContactLogSection";
import { ROICalculator } from "@/components/deal/ROICalculator";
import { DistressTypeBadge } from "@/components/deal/DistressTypeBadge";
import { toast } from "sonner";
import { ArrowLeft, Home, TrendingUp, Brain, Phone, MessageSquare, Plus, Loader2, BarChart3, Calculator } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const VERDICT_TO_STRENGTH: Record<string, "Strong" | "Moderate" | "Weak"> = {
  "Strong Deal": "Strong",
  "Investigate": "Moderate",
  "Pass": "Weak",
};

const PIPELINE_STAGES = [
  { value: "new", label: "New Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "follow_up", label: "Follow-up" },
  { value: "negotiating", label: "Negotiating" },
  { value: "under_contract", label: "Under Contract" },
  { value: "won", label: "Won" },
  { value: "dead", label: "Dead" },
];

const PropertyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [property, setProperty] = useState<any>(null);
  const [loadingProp, setLoadingProp] = useState(true);
  const [ownerContact, setOwnerContact] = useState<any>(null);
  const [contactLog, setContactLog] = useState<any[]>([]);
  const [pipelineDeal, setPipelineDeal] = useState<any>(null);
  const [addingToPipeline, setAddingToPipeline] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!id || !user) return;
    supabase
      .from("properties" as any)
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { navigate("/dashboard", { replace: true }); return; }
        setProperty(data);
        setLoadingProp(false);
      });

    supabase
      .from("owner_contacts" as any)
      .select("*")
      .eq("property_id", id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setOwnerContact(data));

    supabase
      .from("contact_log" as any)
      .select("*")
      .eq("property_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setContactLog(data ?? []));

    supabase
      .from("pipeline_deals" as any)
      .select("*")
      .eq("property_id", id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setPipelineDeal(data));
  }, [id, user, loading, navigate]);

  const handleAddToPipeline = async () => {
    if (!user || !id) return;
    setAddingToPipeline(true);
    const { data, error } = await supabase
      .from("pipeline_deals" as any)
      .insert({ user_id: user.id, property_id: id, stage: "new", priority: "medium" })
      .select()
      .single();
    setAddingToPipeline(false);
    if (error) { toast.error("Failed to add to pipeline."); return; }
    setPipelineDeal(data);
    toast.success("Added to pipeline!");
  };

  const handleStageChange = async (stage: string) => {
    if (!pipelineDeal) return;
    const prev = pipelineDeal;
    setPipelineDeal({ ...pipelineDeal, stage });
    const { error } = await supabase
      .from("pipeline_deals" as any)
      .update({ stage })
      .eq("id", pipelineDeal.id);
    if (error) { setPipelineDeal(prev); toast.error("Failed to update stage."); }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading || loadingProp) return null;
  if (!property) return null;

  const reportData = property.report_data ?? {};
  const signalStrength = VERDICT_TO_STRENGTH[property.deal_verdict] ?? "Moderate";
  const intelligence = reportData.intelligence;

  return (
    <div className="min-h-screen bg-background">
      <AppNav credits={profile?.credits} onSignOut={handleSignOut} />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Back */}
        <Button variant="ghost" size="sm" className="mb-6 text-muted-foreground" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-1" />Back to Search
        </Button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-2">
            {(property.distress_types ?? []).map((t: string) => <DistressTypeBadge key={t} type={t} />)}
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">{property.address}</h1>
          <p className="text-muted-foreground">{property.city}, {property.state} {property.zip}</p>
        </div>

        {/* Score + actions */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            {property.deal_score !== null && property.deal_score !== undefined && (
              <ScoreRing score={property.deal_score} signalStrength={signalStrength} />
            )}
            <div className="flex flex-col gap-3 sm:ml-auto">
              {pipelineDeal ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Pipeline stage:</span>
                  <Select value={pipelineDeal.stage} onValueChange={handleStageChange}>
                    <SelectTrigger className="w-44 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_STAGES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <Button variant="outline" onClick={handleAddToPipeline} disabled={addingToPipeline}>
                  {addingToPipeline ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Add to Pipeline
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Sections */}
        <CollapsibleSection title="Property Info" icon={<Home className="h-4 w-4 text-primary" />} defaultOpen>
          <PropertyInfoSection property={{ ...property, report_data: reportData }} />
        </CollapsibleSection>

        <CollapsibleSection title="Distress Details" icon={<BarChart3 className="h-4 w-4 text-primary" />} defaultOpen>
          <DistressDetailsSection distressTypes={property.distress_types} distressDetails={property.distress_details} />
        </CollapsibleSection>

        <CollapsibleSection title="AI Analysis" icon={<Brain className="h-4 w-4 text-primary" />} defaultOpen>
          <AIAnalysisSection reportData={reportData} />
        </CollapsibleSection>

        {intelligence && (
          <CollapsibleSection title="Market Intelligence" icon={<TrendingUp className="h-4 w-4 text-primary" />}>
            <IntelligenceSection intelligence={intelligence} />
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Owner Contact" icon={<Phone className="h-4 w-4 text-primary" />} defaultOpen>
          <OwnerContactSection
            propertyId={property.id}
            contact={ownerContact}
            onContactRevealed={(c) => setOwnerContact(c)}
          />
        </CollapsibleSection>

        <CollapsibleSection title="ROI Calculator" icon={<Calculator className="h-4 w-4 text-primary" />}>
          <ROICalculator estimatedValue={property.estimated_value} />
        </CollapsibleSection>

        <CollapsibleSection title="Contact Log" icon={<MessageSquare className="h-4 w-4 text-primary" />}>
          {user && (
            <ContactLogSection
              propertyId={property.id}
              userId={user.id}
              entries={contactLog}
              onEntryAdded={(e) => setContactLog((prev) => [e, ...prev])}
            />
          )}
        </CollapsibleSection>
      </main>
    </div>
  );
};

export default PropertyDetail;
