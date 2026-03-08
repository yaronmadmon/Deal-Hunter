export interface SignalMetric {
  label: string;
  value: string;
}

export interface CompetitorEntry {
  name: string;
  rating: string;
  reviews: string;
  downloads: string;
  weakness: string;
}

export interface SentimentData {
  complaints: string[];
  loves: string[];
  emotion: string;
}

export interface SignalCardData {
  title: string;
  source: string;
  type: "metrics" | "competitors" | "sentiment";
  metrics?: SignalMetric[];
  competitors?: CompetitorEntry[];
  sentiment?: SentimentData;
  evidence: string[];
  verdict: string;
}

export interface OpportunityData {
  featureGaps: string[];
  underservedUsers: string[];
  positioning: string;
}

export interface ScoreBreakdownItem {
  label: string;
  value: number;
}

export interface MockReportData {
  idea: string;
  overallScore: number;
  verdict: "GO" | "PIVOT" | "NO-GO";
  verdictExplanation: string;
  signalCards: SignalCardData[];
  opportunity: OpportunityData;
  scoreBreakdown: ScoreBreakdownItem[];
}

export const mockReport: MockReportData = {
  idea: "AI Note Taking App for Students",
  overallScore: 71,
  verdict: "PIVOT",
  verdictExplanation:
    "There is demand but competition is moderate. Success requires strong differentiation.",
  signalCards: [
    {
      title: "Trend Momentum",
      source: "Social Media + Search Trends",
      type: "metrics",
      metrics: [
        { label: "Interest Change (90d)", value: "+34%" },
        { label: "Top Platforms", value: "Reddit, TikTok, X" },
        { label: "Trending Keywords", value: "AI notes, lecture summary, study assistant" },
      ],
      evidence: [
        '"I wish there was an app that auto-summarizes my lectures" — r/college (1.2k upvotes)',
        '"AI note apps are blowing up on TikTok right now" — r/edtech',
      ],
      verdict: "Interest around this concept is steadily growing.",
    },
    {
      title: "Market Saturation",
      source: "App Store + Google Play",
      type: "metrics",
      metrics: [
        { label: "Total Competitors", value: "140" },
        { label: "Average Rating", value: "3.7 ★" },
        { label: "Top 5 Download Share", value: "70%" },
        { label: "New Apps (6 months)", value: "22" },
      ],
      evidence: [
        "Top competitor Notion holds 30% of the market with a 4.2 rating.",
        "22 new note-taking apps launched in the last 6 months.",
      ],
      verdict: "Market is moderately saturated but not dominated.",
    },
    {
      title: "Competitor Snapshot",
      source: "App Stores",
      type: "competitors",
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
      verdict: "Top competitor has weak reviews despite strong downloads.",
    },
    {
      title: "Sentiment & Pain Points",
      source: "App Reviews + Social Discussions",
      type: "sentiment",
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
      },
      evidence: [
        '"The AI is amazing but the app crashes every 10 minutes" — App Store review',
        '"Why do all note apps require a subscription?" — r/students',
      ],
      verdict: "Users clearly want better usability.",
    },
    {
      title: "Growth Signals",
      source: "Search Trends + Market Activity",
      type: "metrics",
      metrics: [
        { label: "Search Growth (90d)", value: "+61%" },
        { label: "Builder Activity", value: "Increasing" },
        { label: "Discussion Growth", value: "High" },
      ],
      evidence: [
        "Google Trends shows consistent upward trajectory since Q4 2025.",
        "3 new YC-backed startups entered this space in 2026.",
      ],
      verdict: "This category is expanding quickly.",
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
  scoreBreakdown: [
    { label: "Trend Momentum", value: 17 },
    { label: "Market Saturation", value: 14 },
    { label: "Sentiment", value: 13 },
    { label: "Growth", value: 15 },
    { label: "Opportunity", value: 12 },
  ],
};
