import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Brain,
  Calculator,
  History,
  Home,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { AppNav } from "@/components/AppNav";
import { DistressDetailsSection } from "@/components/deal/DistressDetailsSection";
import { DistressTypeBadge } from "@/components/deal/DistressTypeBadge";
import { OwnerContactSection } from "@/components/deal/OwnerContactSection";
import { PropertyInfoSection } from "@/components/deal/PropertyInfoSection";
import { PropertyHistorySection } from "@/components/deal/PropertyHistorySection";
import { AIAnalysisSection } from "@/components/deal/AIAnalysisSection";
import { IntelligenceSection } from "@/components/deal/IntelligenceSection";
import { OutreachSection } from "@/components/deal/OutreachSection";
import { ContactLogSection } from "@/components/deal/ContactLogSection";
import { SMSConversationSection } from "@/components/deal/SMSConversationSection";
import { ROICalculator } from "@/components/deal/ROICalculator";
import { AISalesCoachingSection } from "@/components/deal/AISalesCoachingSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getDebtStatus } from "@/lib/property-history";

const PIPELINE_STAGES = [
  { value: "new", label: "New Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "follow_up", label: "Follow-up" },
  { value: "negotiating", label: "Negotiating" },
  { value: "under_contract", label: "Under Contract" },
  { value: "won", label: "Won" },
  { value: "dead", label: "Dead" },
];

const formatCurrency = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return `${Math.round(value)}%`;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

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

const toTextValue = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const buildHistoryWithFallback = (property: any, history: Record<string, unknown> | null | undefined) => {
  const baseHistory = toRecord(history);
  const rawSales = Array.isArray(baseHistory.sales) ? baseHistory.sales : [];
  const rawAssessments = Array.isArray(baseHistory.assessments) ? baseHistory.assessments : [];
  const rawListing = Array.isArray(baseHistory.listing) ? baseHistory.listing : [];
  const distressDetails = toRecord(property?.distress_details);
  const assessmentTax = toRecord(distressDetails.assessmentTax);
  const rawSale = toRecord(distressDetails.rawSale);
  const rawSaleAmount = toRecord(rawSale.amount);
  const rawDeed = toRecord(distressDetails.rawDeed);
  const deedBuyer = toRecord(rawDeed.buyer);
  const deedSeller = toRecord(rawDeed.seller);

  const fallbackSales = rawSales.length > 0
    ? rawSales
    : (() => {
        const saleTransDate = toTextValue(property?.last_sale_date, rawSale.saleTransDate, rawSale.salesearchdate);
        const saleAmt = toNumber(
          property?.last_sale_price,
          distressDetails.deedSaleAmt,
          rawSale.saleAmt,
          rawSale.saleamt,
          rawSaleAmount.saleAmt,
          rawSaleAmount.saleamt,
        );
        const buyerName = toTextValue(
          distressDetails.deedBuyerName,
          deedBuyer.name1full,
          deedBuyer.name,
          distressDetails.ownerName,
          distressDetails.owner_name,
        );
        const sellerName = toTextValue(
          distressDetails.deedSellerName,
          deedSeller.name1full,
          deedSeller.name,
        );

        return saleTransDate || saleAmt !== null
          ? [{ saleTransDate, saleAmt, buyerName, sellerName }]
          : [];
      })();

  const fallbackAssessments = rawAssessments.length > 0
    ? rawAssessments
    : (() => {
        const landValue = toNumber(distressDetails.assessedLandValue);
        const improvementValue = toNumber(distressDetails.assessedImprValue);
        const assessedValue = landValue !== null || improvementValue !== null ? (landValue ?? 0) + (improvementValue ?? 0) : null;
        const marketValue = toNumber(property?.estimated_value);
        const taxYear = toNumber(assessmentTax.taxYear, assessmentTax.taxyear);
        const taxAmt = toNumber(assessmentTax.taxAmt, assessmentTax.taxamt);

        return taxYear !== null || assessedValue !== null || marketValue !== null || taxAmt !== null
          ? [{ taxYear, assessedValue, marketValue, taxAmt }]
          : [];
      })();

  return {
    sales: fallbackSales,
    assessments: fallbackAssessments,
    listing: rawListing,
  };
};

const SummaryStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-border bg-background px-4 py-3">
    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
  </div>
);

const SectionCard = ({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: typeof Home;
  children: ReactNode;
}) => (
  <Card className="border-border/80 bg-card/90">
    <CardHeader className="pb-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">{title}</CardTitle>
      </div>
      {description ? <CardDescription>{description}</CardDescription> : null}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const PropertyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, profile } = useAuth();
  const [property, setProperty] = useState<any>(null);
  const [loadingProp, setLoadingProp] = useState(true);
  const [ownerContact, setOwnerContact] = useState<any>(null);
  const [contactLog, setContactLog] = useState<any[]>([]);
  const [pipelineDeal, setPipelineDeal] = useState<any>(null);
  const [addingToPipeline, setAddingToPipeline] = useState(false);
  const [refreshingFacts, setRefreshingFacts] = useState(false);
  const outreachRef = useRef<HTMLDivElement>(null);
  const autoRefreshTriggeredRef = useRef(false);

  const reloadProperty = async () => {
    if (!id || !user) return null;

    const { data, error } = await supabase
      .from("properties" as any)
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      navigate("/dashboard", { replace: true });
      return null;
    }

    setProperty(data);
    setLoadingProp(false);
    return data;
  };

  const refreshFacts = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!property?.id || refreshingFacts) return;

    setRefreshingFacts(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-deal-analyze", {
        body: { propertyId: property.id },
      });

      if (error || data?.error) {
        throw error ?? new Error(data?.error ?? "Refresh failed");
      }

      await reloadProperty();

      if (!silent) {
        toast.success("Property data refreshed.");
      }
    } catch (error) {
      console.error("Failed to refresh property data:", error);
      if (!silent) {
        toast.error("Failed to refresh property data.");
      }
    } finally {
      setRefreshingFacts(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (location.hash === "#outreach" && outreachRef.current) {
      setTimeout(() => outreachRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    }
  }, [location.hash, loadingProp]);

  useEffect(() => {
    if (!id || !user) return;
    void reloadProperty();

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
    if (error) {
      toast.error("Failed to add to pipeline.");
      return;
    }
    setPipelineDeal(data);
    toast.success("Added to pipeline.");
  };

  const handleStageChange = async (stage: string) => {
    if (!pipelineDeal) return;
    const prev = pipelineDeal;
    setPipelineDeal({ ...pipelineDeal, stage });
    const { error } = await supabase
      .from("pipeline_deals" as any)
      .update({ stage })
      .eq("id", pipelineDeal.id);
    if (error) {
      setPipelineDeal(prev);
      toast.error("Failed to update stage.");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const reportData = property?.report_data ?? {};
  const intelligence = reportData.intelligence;
  const fallbackOwnerName = property?.distress_details?.ownerName ?? property?.distress_details?.owner_name ?? null;
  const historyWithFallback = property ? buildHistoryWithFallback(property, reportData.history) : { sales: [], assessments: [], listing: [] };
  const distressDetails = property?.distress_details ?? {};
  const mortgage = distressDetails.mortgage ?? {};
  const debtStatus = getDebtStatus(distressDetails);
  const annualTax = distressDetails.assessmentTax?.taxamt ?? null;
  const heroOwner = ownerContact?.owner_name || fallbackOwnerName || "Owner unavailable";
  const photos = Array.isArray(reportData.photos) ? reportData.photos : [];
  const mapUrl = property
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.address}, ${property.city}, ${property.state} ${property.zip}`)}`
    : "";
  const isMissingOwner = !fallbackOwnerName;
  const isMissingMortgage = !mortgage.isCashPurchase && (mortgage.loanAmount === null || mortgage.loanAmount === undefined);
  const isMissingHistory = historyWithFallback.sales.length === 0 && historyWithFallback.assessments.length === 0;
  const isMissingPhotos = photos.length === 0;
  const needsDebtStatus = (property?.distress_types ?? []).some((type: string) => ["foreclosure", "tax_lien", "delinquency", "pre_foreclosure"].includes(type));
  const isMissingDebtStatus = needsDebtStatus && !(
    debtStatus.delinquentAmount !== null ||
    debtStatus.taxLienAmount !== null ||
    debtStatus.defaultDate ||
    debtStatus.auctionDate ||
    debtStatus.taxDelinquentYear
  );
  const shouldAutoRefreshFacts = isMissingOwner || isMissingMortgage || isMissingHistory || isMissingPhotos || isMissingDebtStatus;

  useEffect(() => {
    if (!property?.id || !shouldAutoRefreshFacts || autoRefreshTriggeredRef.current) return;
    autoRefreshTriggeredRef.current = true;
    void refreshFacts({ silent: true });
  }, [property?.id, shouldAutoRefreshFacts]);

  if (loading || loadingProp) return null;
  if (!property) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppNav credits={profile?.credits} onSignOut={handleSignOut} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Button variant="ghost" size="sm" className="mb-6 text-muted-foreground" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Search
        </Button>

        <Card className="border-border/80 bg-card/90">
          <CardContent className="space-y-6 p-5 sm:p-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  {(property.distress_types ?? []).map((type: string) => (
                    <DistressTypeBadge key={type} type={type} />
                  ))}
                </div>
                <h1 className="mt-3 font-heading text-3xl font-semibold text-foreground">{property.address}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>{property.city}, {property.state} {property.zip}</span>
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] hover:border-foreground/30 hover:text-foreground"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Open Map
                  </a>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Primary owner: <span className="font-medium text-foreground">{heroOwner}</span></p>
              </div>

              <div className="flex flex-col gap-4 xl:min-w-[280px] xl:items-end">
                <Button variant="outline" onClick={() => void refreshFacts()} disabled={refreshingFacts}>
                  {refreshingFacts ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh Property Data
                </Button>

                {pipelineDeal ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Pipeline stage</span>
                    <Select value={pipelineDeal.stage} onValueChange={handleStageChange}>
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PIPELINE_STAGES.map((stage) => (
                          <SelectItem key={stage.value} value={stage.value}>{stage.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <Button variant="outline" onClick={handleAddToPipeline} disabled={addingToPipeline}>
                    {addingToPipeline ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Add to Pipeline
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <SummaryStat label="Estimated Value" value={formatCurrency(property.estimated_value)} />
              <SummaryStat label="Equity" value={formatPercent(property.equity_pct)} />
              <SummaryStat label="Mortgage" value={mortgage.isCashPurchase ? "Cash Purchase" : formatCurrency(mortgage.loanAmount)} />
              <SummaryStat label="Annual Tax" value={formatCurrency(annualTax)} />
              <SummaryStat label="Last Sale" value={formatCurrency(property.last_sale_price)} />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
          <div className="space-y-6">
            <SectionCard title="Property Overview" description="Core physical details and photos" icon={Home}>
              <PropertyInfoSection property={{ ...property, report_data: reportData }} />
            </SectionCard>

            <SectionCard title="Ownership & Financials" description="Mortgage, taxes, valuation, and distress signals" icon={BarChart3}>
              <DistressDetailsSection distressTypes={property.distress_types} distressDetails={property.distress_details} />
            </SectionCard>

            <SectionCard title="Deal Timeline" description="Purchase history, listing attempts, debt load, and urgency" icon={History}>
              <PropertyHistorySection history={historyWithFallback} distressDetails={property.distress_details} />
            </SectionCard>

            {intelligence ? (
              <SectionCard title="Market Intelligence" description="Neighborhood, public-record, and market context" icon={TrendingUp}>
                <IntelligenceSection intelligence={intelligence} />
              </SectionCard>
            ) : null}
          </div>

          <div className="space-y-6">
            <SectionCard title="Opportunity Snapshot" description="AI turns the history and public records into a cleaner investor brief" icon={Brain}>
              <AIAnalysisSection
                reportData={reportData}
                history={historyWithFallback}
                property={property}
                distressDetails={property.distress_details}
              />
            </SectionCard>

            <SectionCard title="Owner Contact" description="Public owner plus skip-trace contact details" icon={Phone}>
              <OwnerContactSection
                propertyId={property.id}
                contact={ownerContact}
                fallbackOwnerName={fallbackOwnerName}
                propertyAddress={property.address}
                onContactRevealed={(contact) => setOwnerContact(contact)}
              />
            </SectionCard>

            {user ? (
              <SectionCard title="AI Text Conversation" description="AI engages the owner over SMS and books a meeting" icon={Bot}>
                <SMSConversationSection
                  propertyId={property.id}
                  userId={user.id}
                  ownerPhones={(ownerContact?.phones ?? [])
                    .map((p: unknown) => typeof p === "string" ? p : ((p as Record<string, unknown>)?.number as string) ?? "")
                    .filter(Boolean) as string[]}
                />
              </SectionCard>
            ) : null}

            <div ref={outreachRef}>
              <SectionCard title="AI Outreach" description="Generate outreach copy once owner details are available" icon={Sparkles}>
                <OutreachSection propertyId={property.id} ownerContact={ownerContact} />
              </SectionCard>
            </div>

            <SectionCard title="ROI Calculator" description="Pressure-test the deal with your own numbers" icon={Calculator}>
              <ROICalculator estimatedValue={property.estimated_value} />
            </SectionCard>

            <SectionCard title="Contact Log" description="Track calls, emails, and follow-ups" icon={MessageSquare}>
              {user ? (
                <ContactLogSection
                  propertyId={property.id}
                  userId={user.id}
                  entries={contactLog}
                  onEntryAdded={(entry) => {
                    setContactLog((prev) => [entry, ...prev]);
                    supabase.functions.invoke("schedule-followup", { body: { propertyId: property.id } }).catch(() => {});
                  }}
                />
              ) : null}
            </SectionCard>

            {/* AI Sales Coaching — shown after first contact is logged */}
            <AISalesCoachingSection
              pipelineDeal={pipelineDeal}
              reportData={reportData}
              distressTypes={Array.isArray(property.distress_types) ? property.distress_types : []}
              contactCount={contactLog.length}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default PropertyDetail;
