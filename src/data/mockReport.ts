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

export type DataSourceType = "perplexity" | "firecrawl" | "serper" | "producthunt" | "github" | "twitter" | "ai_estimated";

export interface ScoreBreakdownItem {
  label: string;
  value: number;
}

export interface BlueprintData {
  reportSummary?: string;
  productConcept: string;
  strategicPositioning: string;
  competitiveEdge?: string[];
  coreFeatures: string[];
  targetUsers: string[];
  monetization: string[];
  mvpPlan: string[];
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

export interface MockReportData {
  idea: string;
  overallScore: number;
  signalStrength: "Strong" | "Moderate" | "Weak";
  signalCards: SignalCardData[];
  opportunity: OpportunityData;
  revenueBenchmark: RevenueBenchmarkData;
  scoreBreakdown: ScoreBreakdownItem[];
  scoreExplanation: string;
  blueprint: BlueprintData;
  dataSources?: string[];
  keyStats?: KeyStat[];
  userQuotes?: UserQuote[];
  methodology?: MethodologyInfo;
  githubRepos?: GitHubRepoData[];
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
  scoreBreakdown: [
    { label: "Trend Momentum", value: 17 },
    { label: "Market Saturation", value: 14 },
    { label: "Sentiment", value: 13 },
    { label: "Growth", value: 15 },
    { label: "Opportunity", value: 12 },
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
