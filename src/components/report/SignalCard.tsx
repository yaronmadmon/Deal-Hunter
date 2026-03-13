import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, PieChart, Users, MessageCircle, Zap, ExternalLink, Twitter, Heart, Repeat2, BadgeCheck } from "lucide-react";
import {
  AreaChart, Area, PieChart as RePieChart, Pie, Cell,
  LineChart, Line, BarChart, Bar,
  ResponsiveContainer, Tooltip, XAxis,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SignalCardData, ProductHuntLaunch, TwitterSentimentItem, InfluencerSignal } from "@/data/mockReport";
import { DataSourceBadge } from "./DataSourceBadge";
import { EvidenceLink } from "./EvidenceLink";

interface SignalCardProps {
  card: SignalCardData;
  subtitle?: string;
}

const iconMap: Record<string, React.ElementType> = {
  TrendingUp, PieChart, Users, MessageCircle, Zap,
};

const confidenceBadge = (c: string) => {
  if (c === "High") return "go" as const;
  if (c === "Medium") return "pivot" as const;
  return "nogo" as const;
};

/** Safely display a value — never show null, undefined, NaN, or N/A */
const safeVal = (val: any): string => {
  if (val === null || val === undefined || val === "N/A" || val === "n/a" || val === "NaN" || Number.isNaN(val)) {
    return "Insufficient data";
  }
  const s = String(val);
  if (s.toLowerCase() === "unknown" || s.toLowerCase() === "data unavailable") {
    return "Insufficient data";
  }
  return s;
};

const isMutedValue = (val: string) => val === "Insufficient data";

const ProductHuntInsight = ({ launches }: { launches: ProductHuntLaunch[] }) => {
  const maxUpvotes = Math.max(...launches.map(l => l.upvotes));
  const now = new Date();
  const recentLaunches = launches.filter(l => {
    const diff = now.getTime() - new Date(l.launchDate).getTime();
    return diff < 180 * 24 * 60 * 60 * 1000; // 6 months
  });

  if (maxUpvotes >= 500) {
    return <p className="text-[13px] font-medium text-primary bg-primary/10 rounded-md px-3 py-2">🔥 Proven demand in this space — top launches have {maxUpvotes.toLocaleString()}+ upvotes</p>;
  }
  if (recentLaunches.length >= 2) {
    return <p className="text-[13px] font-medium text-warning bg-warning/10 rounded-md px-3 py-2">📈 Active and growing category — {recentLaunches.length} launches in the last 6 months</p>;
  }
  return <p className="text-[13px] text-muted-foreground px-3 py-2">Some related products exist but with moderate traction.</p>;
};

export const SignalCard = ({ card, subtitle }: SignalCardProps) => {
  const IconComp = iconMap[card.icon] || TrendingUp;

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <IconComp className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-heading">{card.title}</CardTitle>
              {subtitle && <p className="text-[13px] text-muted-foreground italic">{subtitle}</p>}
              <span className="text-[13px] text-muted-foreground">{card.source}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Badge variant={confidenceBadge(card.confidence)} className="text-xs px-2 py-0.5">
            {card.confidence}
          </Badge>
          <span className="text-[13px] text-muted-foreground">
            {card.evidenceCount} signals analyzed
          </span>
          <DataSourceBadge dataSource={card.dataSource} sourceUrls={card.sourceUrls} compact />
        </div>
        {/* Fallback gap warning */}
        {(card as any).fallbackWarning && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5">
            <span className="text-amber-400 text-[11px] font-medium shrink-0">⚠️</span>
            <span className="text-[11px] text-muted-foreground">{(card as any).fallbackWarning}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 pt-0">
        {/* Sparkline for Trend — AI-simulated */}
        {card.sparkline && (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground/60 italic uppercase tracking-wide">Simulated trend (illustrative only)</span>
            </div>
            <div className="h-16 -mx-1 opacity-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={card.sparkline}>
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(239 84% 67%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(239 84% 67%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="hsl(239 84% 67%)" fill="url(#sparkGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Google Trends Sparkline */}
        {card.googleTrendsSparkline && card.googleTrendsSparkline.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">Google Trends</div>
              <DataSourceBadge dataSource="serper" compact />
            </div>
            <div className="h-20 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={card.googleTrendsSparkline}>
                  <defs>
                    <linearGradient id="googleTrendsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(220 9% 46%)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(220 13% 91%)', background: 'hsl(0 0% 100%)' }}
                    labelFormatter={(label) => `${label}`}
                    formatter={(value: number) => [`${value}`, 'Search Interest']}
                  />
                  <Area type="monotone" dataKey="value" stroke="hsl(142 71% 45%)" fill="url(#googleTrendsGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1">
              <EvidenceLink href="https://trends.google.com" label="View Source" />
            </div>
          </div>
        )}

        {/* X/Twitter Volume Sparkline */}
        {card.twitterVolumeSparkline && card.twitterVolumeSparkline.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">X Buzz (7 days)</div>
              <DataSourceBadge dataSource="twitter" compact />
            </div>
            <div className="h-16 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={card.twitterVolumeSparkline}>
                  <defs>
                    <linearGradient id="twitterVolumeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(204 88% 53%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(204 88% 53%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(220 9% 46%)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(220 13% 91%)', background: 'hsl(0 0% 100%)' }}
                    formatter={(value: number) => [`${value}`, 'Tweets']}
                  />
                  <Area type="monotone" dataKey="value" stroke="hsl(204 88% 53%)" fill="url(#twitterVolumeGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {card.donut && (
          <div className="h-20 flex items-center justify-center">
            <ResponsiveContainer width={80} height={80}>
              <RePieChart>
                <Pie data={card.donut} dataKey="value" innerRadius={22} outerRadius={35} paddingAngle={3} strokeWidth={0}>
                  <Cell fill="hsl(239 84% 67%)" />
                  <Cell fill="hsl(220 14% 90%)" />
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
            <div className="text-[13px] text-muted-foreground ml-2 space-y-1">
              {card.donut.map(s => (
                <div key={s.name} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${s.name === "Top 5" ? "bg-primary" : "bg-muted"}`} />
                  {s.name}: {s.value}%
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Line chart for Growth — AI-simulated */}
        {card.lineChart && (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground/60 italic uppercase tracking-wide">Simulated trend (illustrative only)</span>
            </div>
            <div className="h-16 -mx-1 opacity-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={card.lineChart}>
                  <Line type="monotone" dataKey="value" stroke="hsl(174 58% 40%)" strokeWidth={2} dot={false} />
                  <XAxis dataKey="name" hide />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Product Hunt Launches Table */}
        {card.productHuntLaunches && card.productHuntLaunches.length > 0 && (
          <div className="space-y-2">
            <div className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">Product Hunt Launches</div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead className="h-8 text-[13px]">Product</TableHead>
                    <TableHead className="h-8 text-[13px]">Tagline</TableHead>
                    <TableHead className="h-8 text-[13px] text-right">Upvotes</TableHead>
                    <TableHead className="h-8 text-[13px] text-right">Launch Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {card.productHuntLaunches.map((launch) => (
                    <TableRow key={launch.name + launch.launchDate}>
                      <TableCell className="py-2 text-[13px] font-medium">
                        {launch.url ? (
                          <a href={launch.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                            {launch.name}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : launch.name}
                      </TableCell>
                      <TableCell className="py-2 text-[13px] text-muted-foreground max-w-[180px] truncate">{launch.tagline}</TableCell>
                      <TableCell className="py-2 text-[13px] text-right font-medium">{launch.upvotes.toLocaleString()}</TableCell>
                      <TableCell className="py-2 text-[13px] text-right text-muted-foreground">{launch.launchDate}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ProductHuntInsight launches={card.productHuntLaunches} />
          </div>
        )}

        {card.productHuntLaunches && card.productHuntLaunches.length === 0 && (
          <div className="space-y-2">
            <div className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">Product Hunt Launches</div>
            <p className="text-[13px] text-success font-medium bg-success/10 rounded-md px-3 py-2">
              🟢 No similar launches found — blue ocean opportunity
            </p>
          </div>
        )}

        {/* Metrics */}
        {card.type === "metrics" && card.metrics && (() => {
          const isPHZero = (m: typeof card.metrics[0]) =>
            (m.label.includes("PH Similar Launches") || m.label.includes("Top PH Upvotes")) &&
            (m.value === "0" || m.value === "0 upvotes" || m.value === "None");
          const visibleMetrics = card.metrics.filter(m => !isPHZero(m));
          const hasHiddenPH = visibleMetrics.length < card.metrics.length;

          return (
            <div className="space-y-2">
              {visibleMetrics.map((m) => {
                const displayValue = safeVal(m.value);
                // If a numeric stat has no source URL, mark as "Reported" instead of showing as verified
                const isNumeric = /\d/.test(displayValue) && !isMutedValue(displayValue);
                const hasSource = !!(m.sourceUrl || (m.dataSource && m.dataSource !== "ai_estimated"));
                const showReported = isNumeric && !hasSource;
                return (
                  <div key={m.label} className="flex justify-between text-sm items-start gap-2">
                    <span className="text-muted-foreground">{m.label}</span>
                    <div className="text-right flex flex-col items-end gap-0.5">
                      <span className={`font-medium ${isMutedValue(displayValue) ? "text-muted-foreground/60 text-[13px] italic" : "text-foreground"}`}>
                        {displayValue}
                      </span>
                      {showReported && (
                        <span className="text-[10px] text-muted-foreground/60 italic">Reported (unverified)</span>
                      )}
                      {m.dataSource && (
                        <DataSourceBadge dataSource={m.dataSource} sourceUrl={m.sourceUrl} compact />
                      )}
                      {m.sourceUrl && (
                        <EvidenceLink href={m.sourceUrl} label="View Source" />
                      )}
                    </div>
                  </div>
                );
              })}
              {hasHiddenPH && (
                <p className="text-[13px] text-success font-medium bg-success/10 rounded-md px-3 py-2">
                  🟢 No competing launches found on Product Hunt — this is a blue ocean signal for launch strategy.
                </p>
              )}
            </div>
          );
        })()}

        {/* Competitors */}
        {card.type === "competitors" && card.competitors && (
          <div className="space-y-2.5">
            {card.competitors.map((c) => (
              <div key={c.name} className="border rounded-lg p-3 space-y-1.5 bg-secondary/30">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm text-foreground">{c.name}</div>
                  <DataSourceBadge dataSource={c.dataSource} sourceUrl={c.sourceUrl} compact />
                </div>
                <div className="grid grid-cols-3 gap-1 text-[13px] text-muted-foreground">
                  <span>{safeVal(c.rating)}</span>
                  <span className={isMutedValue(safeVal(c.reviews)) ? "text-muted-foreground/60 italic" : ""}>{safeVal(c.reviews)} {!isMutedValue(safeVal(c.reviews)) && "reviews"}</span>
                  <span className={isMutedValue(safeVal(c.downloads)) ? "text-muted-foreground/60 italic" : ""}>{safeVal(c.downloads)} {!isMutedValue(safeVal(c.downloads)) && "dl"}</span>
                </div>
                <div className="text-[13px] text-destructive/80">⚠ {c.weakness}</div>
                <div className="flex items-center gap-2 mt-1">
                  <EvidenceLink href={c.sourceUrl} label="View App Store" />
                  {c.websiteUrl && <EvidenceLink href={c.websiteUrl} label="View Website" />}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sentiment with bar chart */}
        {card.type === "sentiment" && card.sentiment && (
          <div className="space-y-3">
            <div className="h-10">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={[
                  { name: "Complaints", value: card.sentiment.complaintCount },
                  { name: "Positive", value: card.sentiment.positiveCount },
                ]}>
                  <XAxis type="number" hide />
                  <Bar dataKey="value" radius={4} barSize={12}>
                    <Cell fill="hsl(0 72% 51%)" />
                    <Cell fill="hsl(142 71% 45%)" />
                  </Bar>
                  <Tooltip />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Top Complaints</div>
              <ul className="space-y-1">
                {card.sentiment.complaints.map((c) => (
                  <li key={c} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-destructive mt-0.5 text-[13px]">●</span> {c}
                  </li>
                ))}
              </ul>
              {card.sentiment.complaintsSourceUrl && (
                <div className="mt-1.5">
                  <EvidenceLink
                    href={card.sentiment.complaintsSourceUrl}
                    label={card.sentiment.complaintsSourceLabel || `View ${card.sentiment.complaintCount} reviews`}
                  />
                </div>
              )}
            </div>
            <div>
              <div className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">What Users Love</div>
              <ul className="space-y-1">
                {card.sentiment.loves.map((l) => (
                  <li key={l} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-success mt-0.5 text-[13px]">●</span> {l}
                  </li>
                ))}
              </ul>
              {card.sentiment.lovesSourceUrl && (
                <div className="mt-1.5">
                  <EvidenceLink
                    href={card.sentiment.lovesSourceUrl}
                    label={card.sentiment.lovesSourceLabel || "View discussions"}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Dominant Emotion</span>
              <span className="font-medium text-foreground">{card.sentiment.emotion}</span>
            </div>
          </div>
        )}

        {/* X/Twitter Sentiment Posts — "What people are saying on X" */}
        {card.twitterSentiment && card.twitterSentiment.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">What people are saying on X</div>
              <DataSourceBadge dataSource="twitter" compact />
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {card.twitterSentiment.slice(0, 10).map((tweet, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-1.5 bg-[hsl(204,88%,53%)]/5">
                  <p className="text-[13px] text-foreground leading-relaxed">{tweet.text}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <BadgeCheck className="w-3.5 h-3.5 text-[hsl(204,88%,53%)]" />
                      <span className="font-medium">@{tweet.authorUsername}</span>
                      <span>·</span>
                      <span>{tweet.followerCount.toLocaleString()} followers</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-0.5">
                        <Heart className="w-3 h-3" /> {tweet.likeCount}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Repeat2 className="w-3 h-3" /> {tweet.retweetCount}
                      </span>
                    </div>
                  </div>
                  {tweet.tweetUrl && (
                    <EvidenceLink href={tweet.tweetUrl} label="View on X" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* X Influencer / Founder Signals */}
        {card.influencerSignals && card.influencerSignals.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">Who's Building in This Space</div>
              <DataSourceBadge dataSource="twitter" compact />
            </div>
            <div className="space-y-2">
              {card.influencerSignals.map((inf, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2 bg-[hsl(204,88%,53%)]/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Twitter className="w-4 h-4 text-[hsl(204,88%,53%)]" />
                      <div>
                        <span className="text-sm font-medium text-foreground">{inf.name}</span>
                        <span className="text-[13px] text-muted-foreground ml-1">@{inf.username}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs px-1.5 py-0 border-[hsl(204,88%,53%)]/30 text-[hsl(204,88%,53%)]">
                      {inf.followers_count.toLocaleString()} followers
                    </Badge>
                  </div>
                  {inf.description && (
                    <p className="text-[13px] text-muted-foreground line-clamp-2">{inf.description}</p>
                  )}
                  {inf.latest_niche_tweet && (
                    <div className="bg-background/50 rounded-md p-2 space-y-1.5">
                      <p className="text-[13px] text-foreground leading-relaxed line-clamp-3">{inf.latest_niche_tweet.text}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Heart className="w-3 h-3" /> {inf.latest_niche_tweet.like_count}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Repeat2 className="w-3 h-3" /> {inf.latest_niche_tweet.retweet_count}
                        </span>
                        <EvidenceLink href={`https://x.com/${inf.username}/status/${inf.latest_niche_tweet.id}`} label="View on X" />
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-primary font-medium bg-primary/5 rounded px-2 py-1">
                    ✅ Respected founder active in this space
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence quote box */}
        <div className="bg-secondary/50 border border-border/50 rounded-lg p-3 space-y-2">
          {card.evidence.map((e, i) => (
            <p key={i} className="text-[13px] text-muted-foreground italic leading-relaxed">
              {e}
            </p>
          ))}
        </div>

        {/* Insight footer */}
        <p className="text-sm font-medium text-foreground mt-auto pt-3 border-t border-border/50">
          {card.insight}
        </p>
      </CardContent>
    </Card>
  );
};