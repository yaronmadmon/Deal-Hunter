export interface SignalMetric {
  label: string;
  value: string;
  dataSource?: "perplexity" | "firecrawl" | "twitter" | "ai_estimated";
  sourceUrl?: string | null;
}

export interface CompetitorEntry {
  name: string;
  rating: string;
  reviews: string;
  downloads: string;
  weakness: string;
  dataSource?: "perplexity" | "firecrawl" | "twitter" | "ai_estimated";
  sourceUrl?: string | null;
  websiteUrl?: string | null;
}

export interface SentimentData {
  complaints: string[];
  loves: string[];
  emotion: string;
  complaintCount: number;
  positiveCount: number;
  complaintsSourceUrl?: string;
  lovesSourceUrl?: string;
  complaintsSourceLabel?: string;
  lovesSourceLabel?: string;
}

export interface TwitterSentimentItem {
  text: string;
  authorName: string;
  authorUsername: string;
  followerCount: number;
  likeCount: number;
  retweetCount: number;
  tweetUrl: string;
}

export interface InfluencerSignal {
  name: string;
  username: string;
  followers_count: number;
  description: string;
  latest_niche_tweet: {
    text: string;
    like_count: number;
    retweet_count: number;
    id: string;
  } | null;
}

export interface ChartPoint {
  name: string;
  value: number;
}

export interface DonutSegment {
  name: string;
  value: number;
}

export interface ProductHuntLaunch {
  name: string;
  tagline: string;
  upvotes: number;
  launchDate: string;
  url?: string;
}

export interface SignalCardData {
  title: string;
  source: string;
  icon: string;
  type: "metrics" | "competitors" | "sentiment";
  confidence: "High" | "Medium" | "Low";
  evidenceCount: number;
  dataSource?: DataSourceType;
  sourceUrls?: string[];
  metrics?: SignalMetric[];
  competitors?: CompetitorEntry[];
  sentiment?: SentimentData;
  twitterSentiment?: TwitterSentimentItem[];
  influencerSignals?: InfluencerSignal[];
  productHuntLaunches?: ProductHuntLaunch[];
  evidence: string[];
  insight: string;
  sparkline?: ChartPoint[];
  googleTrendsSparkline?: ChartPoint[];
  twitterVolumeSparkline?: ChartPoint[];
  donut?: DonutSegment[];
  lineChart?: ChartPoint[];
  githubRepos?: GitHubRepoData[];
}

export interface GitHubRepoData {
  name: string;
  description: string;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  url: string;
  updatedAt: string;
  pushedAt: string;
  topics: string[];
}

export interface OpportunityData {
  featureGaps: string[];
  underservedUsers: string[];
  positioning: string;
}

export interface RevenueBenchmarkData {
  summary: string;
  range: string;
  basis: string;
  dataSource?: DataSourceType;
  sourceUrls?: string[];
}

export interface NicheAnalysisData {
  samEstimate: string;
  samPercentage: string;
  samReasoning: string;
  competitorClarity: string;
  directCompetitors: number;
  competitorDetail: string;
  xSignalInterpretation: string;
  xVolumeContext: string;
  dataSource?: DataSourceType;
  sourceUrls?: string[];
}

export interface UnitEconomicsData {
  churnBenchmarks: { name: string; churnRate: string; source: string }[];
  churnImplication: string;
  realisticArpu: string;
  arpuReasoning: string;
  privacyPremium: string;
  ltvEstimate: string;
  dataSource?: DataSourceType;
  sourceUrls?: string[];
}

export interface BuildEstimate {
  timeRange: string;
  costRange: string;
  skillsRequired: string[];
}

export interface BuildEstimateComparison {
  traditional: BuildEstimate;
  aiAssisted: BuildEstimate;
}

export interface BuildComplexityData {
  mvpTimeline: string;
  mvpScope: string[];
  techChallenges: string[];
  estimatedCost: string;
  voiceApiCosts: string;
  onDeviceNote: string;
  complexityScore?: number;
  vibeCoderFeasibility?: "Easy" | "Moderate" | "Hard" | "Do Not Attempt";
  complexityFactors?: string[];
  scorePenalty?: number;
  buildEstimateComparison?: BuildEstimateComparison;
  dataSource?: DataSourceType;
  sourceUrls?: string[];
}

export interface ReviewIntelligenceData {
  complaintClusters: {
    theme: string;
    complaints: string[];
    frequency: number;
    severity: "High" | "Medium" | "Low";
    opportunityLevel: "High Opportunity" | "Moderate Opportunity" | "Already Solved";
    exploitableGap: string;
  }[];
  topAttackAngles: {
    angle: string;
    complaint: string;
    competitorWeakness: string;
  }[];
  matrixData: {
    theme: string;
    frequency: number;
    intensity: number;
    quadrant: "Critical Pain" | "Minor Annoyance" | "Loved Feature" | "Hidden Gem";
  }[];
  differentiationStatements: string[];
  totalReviewsAnalyzed: number;
  confidence?: "High" | "Medium" | "Low";
}

export type DataSourceType = "perplexity" | "firecrawl" | "serper" | "producthunt" | "github" | "twitter" | "ai_estimated";

export interface ScoreBreakdownItem {
  label: string;
  value: number;
  weight?: string;
}

export interface ProofDashboardData {
  searchDemand?: {
    keyword: string;
    monthlySearches: string;
    trend: string;
    confidence?: "High" | "Medium" | "Low";
    source?: string;
    relatedKeywords?: string[];
  };
  developerActivity?: {
    repoCount: string;
    totalStars: string;
    recentCommits: string;
    trend: string;
    confidence?: "High" | "Medium" | "Low";
  };
  socialActivity?: {
    twitterMentions: string;
    redditThreads: string;
    sentimentScore: string;
    hnPhLaunches: string;
    confidence?: "High" | "Medium" | "Low";
  };
  appStoreSignals?: {
    relatedApps: string;
    avgRating: string;
    downloadEstimate: string;
    marketGap: string;
    confidence?: "High" | "Medium" | "Low";
  };
}

export interface KeywordDemandData {
  keywords: {
    keyword: string;
    volume: string;
    difficulty: string;
    trend: string;
    cpc?: string;
  }[];
  confidence?: "High" | "Medium" | "Low";
  source?: string;
}

export interface AppStoreIntelligenceData {
  apps: {
    name: string;
    platform: string;
    rating: string;
    reviews: string;
    downloads: string;
    url?: string;
  }[];
  insight?: string;
  confidence?: "High" | "Medium" | "Low";
  source?: string;
}

export interface RecommendedStrategyData {
  positioning: string;
  suggestedPricing: string;
  differentiators: string[];
  primaryTarget?: string;
  channels?: string[];
  confidence?: "High" | "Medium" | "Low";
}

export interface EnhancedCompetitorEntry extends CompetitorEntry {
  type?: string;
  trafficEstimate?: string;
  pricingModel?: string;
  targetUser?: string;
  strengths?: string;
}

export interface MarketExploitMapData {
  competitorWeaknesses: string[];
  competitorStrengths: string[];
  topComplaints: { complaint: string; frequency: "High" | "Medium" | "Low" }[];
  topPraise: { praise: string; frequency: "High" | "Medium" | "Low" }[];
  whereToWin: string[];
  attackAngle: string;
  confidence?: "High" | "Medium" | "Low";
}

export interface CompetitorMatrixData {
  features: string[];
  competitors: {
    name: string;
    isYou?: boolean;
    scores: Record<string, string>;
  }[];
  confidence?: "High" | "Medium" | "Low";
}

export interface KillShotRisk {
  risk: string;
  severity?: "Low" | "Medium" | "High";
}

export interface KillShotAnalysisData {
  risks: KillShotRisk[];
  riskLevel: "Low" | "Medium" | "High";
  interpretation: string;
  confidence?: "High" | "Medium" | "Low";
}

export interface ScoreExplanationFactor {
  category: string;
  explanation: string;
}

export interface ScoreExplanationData {
  summary?: string;
  factors: ScoreExplanationFactor[];
  confidence?: "High" | "Medium" | "Low";
}

export interface FounderDecisionData {
  decision: "Build Now" | "Build, But Niche Down" | "Validate Further" | "Proceed with Caution" | "Do Not Build";
  reasoning: string;
  whyFactors: string[];
  nextStep: string;
  riskLevel: "Low" | "Medium" | "High";
  speedToMvp: "Fast" | "Medium" | "Slow";
  commercialClarity: "Clear" | "Moderate" | "Weak";
  confidence?: "High" | "Medium" | "Low";
}

export interface BlueprintData {
  reportSummary?: string;
  productConcept: string;
  strategicPositioning: string;
  competitiveEdge?: string[];
  coreFeatures: string[];
  targetUsers: string[];
  primaryLaunchSegment?: string;
  monetization: string[];
  monetizationValidation?: string[];
  mvpPlan: string[];
  mvpPhasing?: { mvp: string[]; phase2: string[] };
  techStack?: string[];
  techTradeoffs?: string[];
  goToMarket?: string[];
  competitiveResponse?: string[];
  validationMilestones?: string[];
}

export interface KeyStat {
  value: string;
  label: string;
  change?: string;
  sentiment?: "positive" | "negative" | "neutral";
}

export interface UserQuote {
  text: string;
  source: string;
  sourceUrl?: string;
  upvotes?: string;
  platform: "reddit" | "app_store" | "twitter" | "product_hunt" | "other";
}

export interface MethodologyInfo {
  totalSources: number;
  perplexityQueries: number;
  firecrawlScrapes: number;
  serperSearches?: number;
  productHuntQueries?: number;
  githubSearches?: number;
  twitterSearches?: number;
  dataPoints: number;
  analysisDate: string;
  confidenceNote: string;
}

export interface FounderInsightData {
  summary: string;
  marketReality: string;
  competitivePressure: string;
  possibleGaps: string;
  signalInterpretation: string;
  confidence?: "High" | "Medium" | "Low";
}

export interface MockReportData {
  idea: string;
  overallScore: number;
  signalStrength: "Strong" | "Moderate" | "Weak";
  signalCards: SignalCardData[];
  opportunity: OpportunityData;
  revenueBenchmark: RevenueBenchmarkData;
  nicheAnalysis?: NicheAnalysisData;
  unitEconomics?: UnitEconomicsData;
  buildComplexity?: BuildComplexityData;
  reviewIntelligence?: ReviewIntelligenceData;
  scoreBreakdown: ScoreBreakdownItem[];
  scoreExplanation: string;
  blueprint: BlueprintData;
  dataSources?: string[];
  keyStats?: KeyStat[];
  userQuotes?: UserQuote[];
  methodology?: MethodologyInfo;
  githubRepos?: GitHubRepoData[];
  proofDashboard?: ProofDashboardData;
  keywordDemand?: KeywordDemandData;
  appStoreIntelligence?: AppStoreIntelligenceData;
  recommendedStrategy?: RecommendedStrategyData;
  marketExploitMap?: MarketExploitMapData;
  competitorMatrix?: CompetitorMatrixData;
  founderDecision?: FounderDecisionData;
  killShotAnalysis?: KillShotAnalysisData;
  scoreExplanationData?: ScoreExplanationData;
  dataQualitySummary?: { sourceName: string; dataTier: string; signalCount: string; reliabilityNote: string }[];
  founderInsight?: FounderInsightData;
  pipelineMetrics?: {
    relevanceFilter?: { scored?: number; filtered?: number; discardedItems?: { source: string; title: string; score: number }[]; sourceContamination?: { source: string; total: number; filtered: number; contaminationPct: number }[] } | null;
    perplexityDominanceBanner?: { percentage: number; message: string } | null;
    crossValidatedSignals?: { claim: string; sources: string[]; category: string }[];
    sourceContamination?: { source: string; total: number; filtered: number; contaminationPct: number }[];
    [key: string]: any;
  };
  conflictingSignals?: { signalA: string; sourceA: string; signalB: string; sourceB: string; category: string }[];
  fallbackGaps?: { section: string; failedSource: string; status: string }[];
  scoringJourney?: {
    steps: { label: string; value: number; description: string }[];
    finalScore: number;
    complexityPenalty: number;
  };
}

export const mockReport: MockReportData = {
  idea: "AI Note Taking App for Students",
  overallScore: 71,
  signalStrength: "Moderate",
  scoreExplanation:
    "Market signals indicate real demand and growing interest, but moderate competition means differentiation is critical. The opportunity exists in underserved segments with simpler UX.",
  signalCards: [
    {
      title: "Trend Momentum",
      source: "Social Media + Search Trends",
      icon: "TrendingUp",
      type: "metrics",
      confidence: "High",
      evidenceCount: 247,
      metrics: [
        { label: "Interest Change (90d)", value: "+34%" },
        { label: "Top Platforms", value: "Reddit, TikTok, X" },
        { label: "Trending Keywords", value: "AI notes, lecture summary, study assistant" },
      ],
      sparkline: [
        { name: "W1", value: 20 },
        { name: "W2", value: 25 },
        { name: "W3", value: 22 },
        { name: "W4", value: 30 },
        { name: "W5", value: 35 },
        { name: "W6", value: 28 },
        { name: "W7", value: 40 },
        { name: "W8", value: 45 },
        { name: "W9", value: 42 },
        { name: "W10", value: 55 },
        { name: "W11", value: 60 },
        { name: "W12", value: 67 },
      ],
      evidence: [
        '"I wish there was an app that auto-summarizes my lectures" — r/college (1.2k upvotes)',
        '"AI note apps are blowing up on TikTok right now" — r/edtech',
      ],
      insight: "Interest around this concept is steadily growing.",
    },
    {
      title: "Market Saturation",
      source: "App Store + Google Play",
      icon: "PieChart",
      type: "metrics",
      confidence: "High",
      evidenceCount: 162,
      metrics: [
        { label: "Total Competitors", value: "140" },
        { label: "Average Rating", value: "3.7 ★" },
        { label: "Top 5 Download Share", value: "70%" },
        { label: "New Apps (6 months)", value: "22" },
      ],
      donut: [
        { name: "Top 5", value: 70 },
        { name: "Others", value: 30 },
      ],
      evidence: [
        "Top competitor Notion holds 30% of the market with a 4.2 rating.",
        "22 new note-taking apps launched in the last 6 months.",
      ],
      insight: "Market is moderately saturated but not dominated.",
    },
    {
      title: "Competitor Snapshot",
      source: "App Stores",
      icon: "Users",
      type: "competitors",
      confidence: "High",
      evidenceCount: 89,
      competitors: [
        {
          name: "NoteAI",
          rating: "3.1 ★",
          reviews: "18k",
          downloads: "210k",
          weakness: "Complex UI that confuses new users",
        },
        {
          name: "StudyBuddy",
          rating: "4.0 ★",
          reviews: "8k",
          downloads: "95k",
          weakness: "No offline mode",
        },
        {
          name: "LectureSnap",
          rating: "3.5 ★",
          reviews: "3k",
          downloads: "40k",
          weakness: "Limited language support",
        },
      ],
      evidence: [
        "NoteAI has strong downloads but weak retention due to UX issues.",
        "StudyBuddy is the highest-rated but lacks key features.",
      ],
      insight: "Top competitor has weak reviews despite strong downloads.",
    },
    {
      title: "Sentiment & Pain Points",
      source: "App Reviews + Social Discussions",
      icon: "MessageCircle",
      type: "sentiment",
      confidence: "Medium",
      evidenceCount: 534,
      sentiment: {
        complaints: [
          "Confusing onboarding flow",
          "No offline mode",
          "Aggressive subscription pricing",
        ],
        loves: [
          "Accurate AI summaries",
          "Fast transcription speed",
        ],
        emotion: "Frustrated but hopeful",
        complaintCount: 312,
        positiveCount: 222,
      },
      evidence: [
        '"The AI is amazing but the app crashes every 10 minutes" — App Store review',
        '"Why do all note apps require a subscription?" — r/students',
      ],
      insight: "Users clearly want better usability.",
    },
    {
      title: "Growth Signals",
      source: "Search Trends + Market Activity",
      icon: "Zap",
      type: "metrics",
      confidence: "Medium",
      evidenceCount: 118,
      metrics: [
        { label: "Search Growth (90d)", value: "+61%" },
        { label: "Builder Activity", value: "Increasing" },
        { label: "Discussion Growth", value: "High" },
      ],
      lineChart: [
        { name: "Jan", value: 10 },
        { name: "Feb", value: 18 },
        { name: "Mar", value: 15 },
        { name: "Apr", value: 25 },
        { name: "May", value: 32 },
        { name: "Jun", value: 28 },
        { name: "Jul", value: 38 },
        { name: "Aug", value: 50 },
        { name: "Sep", value: 61 },
      ],
      evidence: [
        "Google Trends shows consistent upward trajectory since Q4 2025.",
        "3 new YC-backed startups entered this space in 2026.",
      ],
      insight: "This category is expanding quickly.",
    },
  ],
  opportunity: {
    featureGaps: [
      "Offline mode missing in top apps",
      "Simpler onboarding needed",
      "No freemium tier in most competitors",
    ],
    underservedUsers: [
      "Non-technical professionals",
      "Older users",
      "Students in developing countries",
    ],
    positioning: "Offline-first, ultra-simple UX with a generous free tier.",
  },
  revenueBenchmark: {
    summary: "Apps with ~10K downloads in this category average $4K–$12K monthly revenue.",
    range: "$4K–$12K/mo",
    basis: "Based on comparable apps with 10K+ downloads in the education/productivity category.",
  },
  founderInsight: {
    summary: "This market has real demand but is getting crowded fast. Your window is narrowing.",
    marketReality: "AI note-taking is a proven category with 140+ competitors. The top 5 control 70% of downloads, but their average rating of 3.7★ signals widespread user dissatisfaction — a clear opening.",
    competitivePressure: "3 YC-backed startups entered in 2026. NoteAI leads with 210k downloads but has a 3.1★ rating. The market is growing faster than incumbents can improve.",
    possibleGaps: "No major player offers offline-first + generous free tier + multi-language. Students in developing countries are completely ignored. This is the wedge.",
    signalInterpretation: "The +34% interest surge combined with high complaint volume (312 negative mentions about UX) indicates users are actively seeking alternatives. Timing is favorable but urgency is high.",
    confidence: "High",
  },
  founderDecision: {
    decision: "Build, But Niche Down",
    reasoning: "Strong market signals and clear pain points exist, but the competitive landscape is intensifying. Success depends on targeting an underserved niche (offline-first for students in developing countries) rather than competing head-on with well-funded incumbents.",
    whyFactors: [
      "Real demand validated by +34% interest growth and 1.2k upvote Reddit posts",
      "Clear competitor weaknesses: NoteAI's UX problems, StudyBuddy's missing offline mode",
      "Underserved segment identified: students in developing countries need offline-first apps",
      "Revenue benchmark ($4K–$12K/mo) is achievable with focused positioning",
    ],
    nextStep: "Build a stripped-down MVP with offline-first note capture and AI summarization. Launch to r/college and r/edtech within 5 weeks. Validate with 100 beta users before expanding scope.",
    riskLevel: "Medium",
    speedToMvp: "Fast",
    commercialClarity: "Moderate",
    confidence: "High",
  },
  killShotAnalysis: {
    risks: [
      { risk: "Apple/Google could build native AI note features into their platforms", severity: "High" },
      { risk: "OpenAI or Notion could add real-time lecture capture, eliminating your differentiator", severity: "High" },
      { risk: "Free alternatives from university IT departments could reduce demand", severity: "Medium" },
      { risk: "AI accuracy for non-English lectures may not meet user expectations", severity: "Medium" },
    ],
    riskLevel: "Medium",
    interpretation: "Platform risk is the biggest concern — Apple's WWDC 2026 could announce native lecture transcription. However, the offline-first + multi-language niche is unlikely to be addressed by platform-level features. Move fast.",
    confidence: "Medium",
  },
  marketExploitMap: {
    competitorWeaknesses: [
      "NoteAI: Complex UI drives away casual users (3.1★ rating despite 210k downloads)",
      "StudyBuddy: No offline mode — unusable for commuters and developing-country students",
      "LectureSnap: English-only transcription limits TAM to ~40% of global student market",
    ],
    competitorStrengths: [
      "NoteAI: Strong brand recognition and distribution (210k downloads)",
      "StudyBuddy: Highest user satisfaction among power users (4.0★)",
      "LectureSnap: Best-in-class transcription accuracy for English content",
    ],
    topComplaints: [
      { complaint: "Confusing onboarding flow", frequency: "High" },
      { complaint: "No offline mode available", frequency: "High" },
      { complaint: "Aggressive subscription pricing", frequency: "Medium" },
      { complaint: "App crashes frequently", frequency: "Medium" },
    ],
    topPraise: [
      { praise: "Accurate AI summaries save hours of study time", frequency: "High" },
      { praise: "Fast transcription speed impresses users", frequency: "Medium" },
    ],
    whereToWin: [
      "Offline-first architecture — no competitor offers this",
      "One-tap onboarding with zero account requirement",
      "Generous free tier to capture price-sensitive students",
      "Multi-language transcription for international students",
    ],
    attackAngle: "Position as the 'simple, free, offline-first' alternative. Lead with the onboarding experience — let users capture their first lecture in under 10 seconds with no signup.",
    confidence: "High",
  },
  competitorMatrix: {
    features: ["Offline Mode", "AI Summaries", "Multi-Language", "Free Tier", "Flashcards", "Export Options"],
    competitors: [
      { name: "NoteAI", scores: { "Offline Mode": "❌", "AI Summaries": "✅", "Multi-Language": "⚠️", "Free Tier": "⚠️", "Flashcards": "❌", "Export Options": "✅" } },
      { name: "StudyBuddy", scores: { "Offline Mode": "❌", "AI Summaries": "✅", "Multi-Language": "❌", "Free Tier": "✅", "Flashcards": "✅", "Export Options": "⚠️" } },
      { name: "LectureSnap", scores: { "Offline Mode": "⚠️", "AI Summaries": "✅", "Multi-Language": "❌", "Free Tier": "❌", "Flashcards": "❌", "Export Options": "✅" } },
      { name: "Your App", isYou: true, scores: { "Offline Mode": "✅", "AI Summaries": "✅", "Multi-Language": "✅", "Free Tier": "✅", "Flashcards": "✅", "Export Options": "✅" } },
    ],
    confidence: "High",
  },
  reviewIntelligence: {
    complaintClusters: [
      {
        theme: "Onboarding Complexity",
        complaints: ["Too many steps to create an account", "Forced tutorial takes 5 minutes", "Can't skip the setup wizard"],
        frequency: 85,
        severity: "High",
        opportunityLevel: "High Opportunity",
        exploitableGap: "One-tap start with no account required would immediately differentiate",
      },
      {
        theme: "Offline Limitations",
        complaints: ["Can't take notes without internet", "Sync fails on poor connections", "Lost notes when offline"],
        frequency: 67,
        severity: "High",
        opportunityLevel: "High Opportunity",
        exploitableGap: "Offline-first architecture with reliable sync would solve the #2 complaint category",
      },
      {
        theme: "Pricing Frustration",
        complaints: ["$9.99/mo is too expensive for students", "Free tier is too limited", "Paywall blocks basic features"],
        frequency: 52,
        severity: "Medium",
        opportunityLevel: "Moderate Opportunity",
        exploitableGap: "Generous free tier with $4.99/mo premium would undercut competitors",
      },
    ],
    topAttackAngles: [
      { angle: "Zero-friction start", complaint: "Confusing onboarding flow", competitorWeakness: "NoteAI requires 6 steps to start taking notes" },
      { angle: "Offline-first reliability", complaint: "No offline mode", competitorWeakness: "StudyBuddy loses notes when internet drops" },
      { angle: "Student-friendly pricing", complaint: "Aggressive subscription pricing", competitorWeakness: "LectureSnap charges $9.99/mo with no free tier" },
    ],
    matrixData: [
      { theme: "Onboarding UX", frequency: 85, intensity: 9, quadrant: "Critical Pain" },
      { theme: "Offline Mode", frequency: 67, intensity: 8, quadrant: "Critical Pain" },
      { theme: "Pricing", frequency: 52, intensity: 6, quadrant: "Minor Annoyance" },
      { theme: "AI Accuracy", frequency: 40, intensity: 3, quadrant: "Loved Feature" },
      { theme: "Transcription Speed", frequency: 35, intensity: 2, quadrant: "Loved Feature" },
    ],
    differentiationStatements: [
      "The only AI note app that works fully offline — no internet required",
      "Start taking notes in under 10 seconds, no account needed",
      "Built for students, priced for students — generous free tier included",
    ],
    totalReviewsAnalyzed: 2847,
    confidence: "High",
  },
  nicheAnalysis: {
    samEstimate: "$340M",
    samPercentage: "12%",
    samReasoning: "Based on 180M global college students, ~15% in lecture-heavy courses, with ~$12.50 average annual spend on study tools. Serviceable market focuses on English-speaking and developing-country students.",
    competitorClarity: "Moderate — clear leaders exist but none dominate the offline/multi-language niche",
    directCompetitors: 12,
    competitorDetail: "12 direct competitors with AI note-taking features; top 3 control 65% of downloads but leave significant gaps in offline capability and language support.",
    xSignalInterpretation: "Twitter/X discussions around AI study tools grew 45% in Q1 2026, with particular interest from international student communities.",
    xVolumeContext: "~2,400 tweets/week mentioning AI note-taking tools, up from ~1,650/week in Q4 2025.",
  },
  unitEconomics: {
    churnBenchmarks: [
      { name: "Education SaaS Average", churnRate: "6.5%", source: "Industry reports" },
      { name: "NoteAI (estimated)", churnRate: "8.2%", source: "Review analysis" },
      { name: "StudyBuddy (estimated)", churnRate: "4.1%", source: "Review analysis" },
    ],
    churnImplication: "Student apps face semester-driven churn cycles. Expect higher churn in summer months (May–August). Annual plans can mitigate this.",
    realisticArpu: "$3.50/mo blended (free + premium mix)",
    arpuReasoning: "Assuming 15% conversion to $4.99/mo premium, with 85% on free tier. Student demographic is price-sensitive but willing to pay for proven value.",
    privacyPremium: "Moderate — students are less privacy-conscious than professionals, but parents may influence purchasing decisions.",
    ltvEstimate: "$42–$84 (12–24 month retention for converted users)",
  },
  buildComplexity: {
    mvpTimeline: "5–6 weeks",
    mvpScope: [
      "Offline-first note editor with local storage",
      "AI summarization integration (OpenAI/Anthropic API)",
      "One-tap onboarding flow",
      "Multi-language transcription (Whisper API)",
      "Basic export (PDF, plain text)",
    ],
    techChallenges: [
      "Offline-first sync architecture (conflict resolution)",
      "Real-time audio transcription with low latency",
      "Multi-language model accuracy for academic content",
      "Mobile-first responsive design for lecture environments",
    ],
    estimatedCost: "$2,000–$5,000 for MVP (API costs + hosting)",
    voiceApiCosts: "Whisper API: ~$0.006/minute. At 500 active users × 3 hours/week = ~$180/month.",
    onDeviceNote: "On-device transcription possible with Whisper.cpp for offline mode, reducing API costs to near-zero for basic features.",
    complexityScore: 6,
    vibeCoderFeasibility: "Moderate",
    complexityFactors: [
      "Offline sync requires careful architecture decisions",
      "Audio processing adds mobile performance constraints",
      "Multi-language support multiplies testing surface",
    ],
    scorePenalty: 5,
  },
  recommendedStrategy: {
    positioning: "The simple, offline-first AI note app built for students who can't afford to lose their lecture notes.",
    suggestedPricing: "Freemium: Free tier with 5 lectures/month, $4.99/mo for unlimited (50% student discount available)",
    differentiators: [
      "Only AI note app with full offline mode",
      "Start in under 10 seconds — no signup required",
      "Multi-language transcription for international students",
      "Most generous free tier in the category",
    ],
    primaryTarget: "College students in lecture-heavy courses (STEM, humanities, law)",
    channels: ["Reddit (r/college, r/edtech)", "TikTok (study influencers)", "University partnerships", "Product Hunt launch"],
    confidence: "High",
  },
  proofDashboard: {
    searchDemand: {
      keyword: "AI note taking app",
      monthlySearches: "18,100",
      trend: "+34% (90d)",
      confidence: "High",
      source: "Google Trends + Keyword Planner",
      relatedKeywords: ["lecture summarizer", "AI study tool", "automatic notes app"],
    },
    developerActivity: {
      repoCount: "340+",
      totalStars: "45,200",
      recentCommits: "2,100+ (30d)",
      trend: "Accelerating",
      confidence: "High",
    },
    socialActivity: {
      twitterMentions: "2,400/week",
      redditThreads: "85 new threads (30d)",
      sentimentScore: "62% positive",
      hnPhLaunches: "3 launches (90d)",
      confidence: "Medium",
    },
    appStoreSignals: {
      relatedApps: "140+",
      avgRating: "3.7★",
      downloadEstimate: "12M+ category total",
      marketGap: "No offline-first leader",
      confidence: "High",
    },
  },
  keywordDemand: {
    keywords: [
      { keyword: "AI note taking app", volume: "18,100", difficulty: "Medium", trend: "+34%" },
      { keyword: "lecture summarizer app", volume: "8,200", difficulty: "Low", trend: "+52%" },
      { keyword: "AI study assistant", volume: "14,500", difficulty: "High", trend: "+28%" },
      { keyword: "automatic lecture notes", volume: "5,400", difficulty: "Low", trend: "+61%" },
      { keyword: "offline note taking app", volume: "3,200", difficulty: "Low", trend: "+18%" },
    ],
    confidence: "High",
    source: "Google Keyword Planner + Trends API",
  },
  appStoreIntelligence: {
    apps: [
      { name: "NoteAI", platform: "iOS + Android", rating: "3.1★", reviews: "18,000", downloads: "210,000", url: "#" },
      { name: "StudyBuddy", platform: "iOS + Android", rating: "4.0★", reviews: "8,000", downloads: "95,000", url: "#" },
      { name: "LectureSnap", platform: "iOS", rating: "3.5★", reviews: "3,000", downloads: "40,000", url: "#" },
      { name: "NoteMaster AI", platform: "Android", rating: "3.8★", reviews: "5,200", downloads: "62,000", url: "#" },
    ],
    insight: "The category leader (NoteAI) has high downloads but poor ratings, suggesting users are desperate for alternatives. The gap between download volume and satisfaction is your opportunity.",
    confidence: "High",
    source: "App Store + Google Play data via Sensor Tower estimates",
  },
  scoreExplanationData: {
    summary: "Your score of 71/100 reflects strong demand signals offset by moderate competitive pressure and execution complexity.",
    factors: [
      { category: "Trend Momentum", explanation: "+34% interest growth in 90 days with consistent upward trajectory. Strong signal from both search trends and social media activity." },
      { category: "Market Saturation", explanation: "140 competitors exist but top 5 control 70% — the market isn't locked down. Average rating of 3.7★ suggests room for a better product." },
      { category: "User Sentiment", explanation: "312 complaints vs 222 positive mentions. Users are frustrated with existing solutions — a strong indicator of switching willingness." },
      { category: "Growth Signals", explanation: "+61% search growth combined with 3 new YC-backed entrants validates the category is heating up." },
      { category: "Build Complexity Penalty", explanation: "-5 points for offline sync architecture and multi-language support challenges." },
    ],
    confidence: "High",
  },
  scoringJourney: {
    steps: [
      { label: "Base Score", value: 50, description: "Starting point for all analyses" },
      { label: "Trend Momentum", value: 67, description: "+17 points: Strong upward trend (+34% in 90d)" },
      { label: "Market Saturation", value: 81, description: "+14 points: Market exists but isn't locked down" },
      { label: "Sentiment Analysis", value: 94, description: "+13 points: Clear user pain points to exploit" },
      { label: "Growth Signals", value: 109, description: "+15 points: Multiple growth indicators firing" },
      { label: "Opportunity Gaps", value: 121, description: "+12 points: Real gaps in competitor offerings" },
      { label: "Complexity Penalty", value: 116, description: "-5 points: Offline sync adds technical risk" },
      { label: "Normalization", value: 71, description: "Normalized to 0–100 scale" },
    ],
    finalScore: 71,
    complexityPenalty: 5,
  },
  dataQualitySummary: [
    { sourceName: "Google Trends", dataTier: "Tier 1 — Direct", signalCount: "247", reliabilityNote: "High confidence: first-party search data" },
    { sourceName: "App Store Reviews", dataTier: "Tier 1 — Direct", signalCount: "534", reliabilityNote: "High confidence: verified user reviews" },
    { sourceName: "Reddit Discussions", dataTier: "Tier 2 — Aggregated", signalCount: "162", reliabilityNote: "Medium confidence: public forum data" },
    { sourceName: "GitHub Activity", dataTier: "Tier 2 — Aggregated", signalCount: "89", reliabilityNote: "Medium confidence: developer interest proxy" },
    { sourceName: "Twitter/X Mentions", dataTier: "Tier 2 — Aggregated", signalCount: "118", reliabilityNote: "Medium confidence: social signal proxy" },
  ],
  methodology: {
    totalSources: 5,
    perplexityQueries: 12,
    firecrawlScrapes: 8,
    serperSearches: 15,
    githubSearches: 3,
    twitterSearches: 5,
    dataPoints: 1150,
    analysisDate: "2026-03-15",
    confidenceNote: "This analysis is based on 1,150 data points from 5 verified sources. Confidence is highest for search trend and app store data (Tier 1), and moderate for social signals (Tier 2).",
  },
  userQuotes: [
    { text: "I wish there was an app that auto-summarizes my lectures", source: "r/college", platform: "reddit", upvotes: "1.2k" },
    { text: "AI note apps are blowing up on TikTok right now", source: "r/edtech", platform: "reddit", upvotes: "340" },
    { text: "The AI is amazing but the app crashes every 10 minutes", source: "App Store — NoteAI", platform: "app_store" },
    { text: "Why do all note apps require a subscription?", source: "r/students", platform: "reddit", upvotes: "890" },
    { text: "I'd pay for an app that actually works offline during lectures", source: "r/college", platform: "reddit", upvotes: "567" },
  ],
  githubRepos: [
    { name: "whisper-notes", description: "Open-source lecture transcription tool using OpenAI Whisper", stars: 4200, forks: 380, openIssues: 45, language: "Python", url: "https://github.com/example/whisper-notes", updatedAt: "2026-03-10", pushedAt: "2026-03-10", topics: ["whisper", "transcription", "notes"] },
    { name: "ai-study-buddy", description: "AI-powered study assistant with flashcard generation", stars: 2800, forks: 210, openIssues: 23, language: "TypeScript", url: "https://github.com/example/ai-study-buddy", updatedAt: "2026-03-08", pushedAt: "2026-03-08", topics: ["ai", "study", "education"] },
    { name: "offline-notes-sync", description: "CRDTs-based offline-first note sync library", stars: 1500, forks: 120, openIssues: 12, language: "Rust", url: "https://github.com/example/offline-notes-sync", updatedAt: "2026-02-28", pushedAt: "2026-02-28", topics: ["crdt", "offline", "sync"] },
  ],
  dataSources: [
    "https://trends.google.com/trends/explore?q=AI+note+taking+app",
    "https://www.reddit.com/r/college/comments/example",
    "https://www.reddit.com/r/edtech/comments/example",
    "https://apps.apple.com/search?term=ai+notes",
    "https://play.google.com/store/search?q=ai+note+taking",
  ],
  keyStats: [
    { value: "71/100", label: "Market Signal Score", sentiment: "positive" },
    { value: "1150+", label: "Data Points Analyzed", sentiment: "neutral" },
    { value: "+34%", label: "Interest Change (90d)", change: "+34%", sentiment: "positive" },
    { value: "$4K–$12K/mo", label: "Revenue Potential (est.)", sentiment: "positive" },
  ],
  scoreBreakdown: [
    { label: "Trend Momentum", value: 17, weight: "20%" },
    { label: "Market Saturation", value: 14, weight: "20%" },
    { label: "Sentiment", value: 13, weight: "20%" },
    { label: "Growth", value: 15, weight: "20%" },
    { label: "Opportunity", value: 12, weight: "20%" },
  ],
  blueprint: {
    reportSummary:
      "Based on a market score of 71/100 with moderate signal strength, a +34% interest surge in AI note-taking tools, and a clear gap in offline capability among the top 3 competitors, here is your build strategy.",
    productConcept:
      "An AI-powered note-taking app that directly addresses the three biggest competitor weaknesses found in the analysis: NoteAI's confusing UX, StudyBuddy's lack of offline mode, and LectureSnap's limited language support. Built for students who need simple, reliable, offline-first lecture capture.",
    strategicPositioning:
      "Position as the 'simple, offline-first' alternative to NoteAI (3.1★, 210k downloads but plagued by UX complaints) and StudyBuddy (no offline mode despite 4.0★ rating). The opportunity gaps show no competitor offers a generous free tier — this is the wedge.",
    competitiveEdge: [
      "NoteAI weakness: Complex UI that confuses new users. Your edge: One-tap onboarding with zero-account-required start, directly solving the #1 complaint in app reviews.",
      "StudyBuddy weakness: No offline mode. Your edge: Full offline-first architecture with automatic sync — critical for the underserved student segment in developing countries with unreliable internet.",
      "LectureSnap weakness: Limited language support. Your edge: Multi-language transcription targeting the non-native English speaker segment identified in the opportunity analysis.",
    ],
    coreFeatures: [
      "Real-time lecture transcription with AI summarization — addresses 'I wish there was an app that auto-summarizes my lectures' (1.2k upvotes on r/college)",
      "Full offline mode with automatic sync — directly solves StudyBuddy's missing feature and the #2 user complaint",
      "One-tap onboarding, no account required — tackles 'Confusing onboarding flow', the top sentiment complaint (312 negative mentions)",
      "Smart flashcard generation from notes — fills the feature gap identified in the opportunity analysis",
      "Multi-language transcription — addresses LectureSnap's weakness and serves international students",
      "Generous free tier with no aggressive upsells — responds to 'Why do all note apps require a subscription?' (r/students)",
      "Export to PDF, Notion, and Google Docs — no lock-in, addressing trust issues in the sentiment data",
    ],
    targetUsers: [
      "College students in lecture-heavy courses — the primary audience driving the +34% interest trend on Reddit and TikTok",
      "Non-native English speakers studying abroad — underserved by LectureSnap's limited language support",
      "Students in developing countries — need offline-first due to unreliable internet, completely ignored by current competitors",
      "Professionals in frequent meetings — adjacent segment validated by growth signals showing 'Builder Activity: Increasing'",
    ],
    monetization: [
      "Freemium at $4.99/mo premium tier — positioned within the $4K–$12K/mo revenue benchmark for 10K+ download apps in education/productivity",
      "Student discount: 50% off with .edu verification — targets the primary user segment at an accessible price point within benchmark range",
      "Team plans at $2.99/user/mo for study groups — captures the collaborative use case identified in growth signals",
    ],
    mvpPlan: [
      "Week 1–2: Build offline-first note editor with local storage — addresses the highest-signal opportunity (offline gap) and the strongest trend momentum (+34% interest)",
      "Week 3: Integrate AI summarization and one-tap onboarding — solves the top 2 sentiment pain points (confusing onboarding, need for AI summaries)",
      "Week 4: Add multi-language transcription and basic export — exploits LectureSnap's weakness, the least defended competitor position",
      "Week 5: Beta launch targeting r/college and r/edtech communities — these are the exact platforms where demand signals were strongest (247 evidence points)",
      "Week 6: Iterate on feedback, add flashcard generation — fills the remaining feature gap from opportunity analysis",
      "Post-MVP: Financial modeling (TAM/SAM/SOM), team plans, and enterprise features — scope-managed to avoid MVP bloat",
    ],
  },
};
