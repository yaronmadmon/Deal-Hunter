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
  confidence: "High" | "Medium" | "Low";
  evidenceCount: number;
  metrics?: SignalMetric[];
  competitors?: CompetitorEntry[];
  sentiment?: SentimentData;
  evidence: string[];
  insight: string;
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
}

export interface ScoreBreakdownItem {
  label: string;
  value: number;
}

export interface BlueprintData {
  productConcept: string;
  strategicPositioning: string;
  coreFeatures: string[];
  targetUsers: string[];
  monetization: string[];
  mvpPlan: string[];
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
      type: "metrics",
      confidence: "High",
      evidenceCount: 247,
      metrics: [
        { label: "Interest Change (90d)", value: "+34%" },
        { label: "Top Platforms", value: "Reddit, TikTok, X" },
        { label: "Trending Keywords", value: "AI notes, lecture summary, study assistant" },
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
      type: "metrics",
      confidence: "High",
      evidenceCount: 162,
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
      insight: "Market is moderately saturated but not dominated.",
    },
    {
      title: "Competitor Snapshot",
      source: "App Stores",
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
      type: "metrics",
      confidence: "Medium",
      evidenceCount: 118,
      metrics: [
        { label: "Search Growth (90d)", value: "+61%" },
        { label: "Builder Activity", value: "Increasing" },
        { label: "Discussion Growth", value: "High" },
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
    productConcept:
      "An AI-powered note-taking app designed for students that automatically summarizes lectures, supports offline usage, and provides a distraction-free, ultra-simple interface.",
    strategicPositioning:
      "Differentiate by addressing the top three competitor weaknesses: complex UX, no offline mode, and aggressive pricing. Position as the 'simple, free-to-start' alternative that just works.",
    coreFeatures: [
      "Real-time lecture transcription with AI summarization",
      "Full offline mode with automatic sync",
      "One-tap onboarding — no account required to start",
      "Smart flashcard generation from notes",
      "Collaborative study groups with shared notes",
      "Multi-language support for international students",
      "Export to PDF, Notion, and Google Docs",
    ],
    targetUsers: [
      "College students taking lecture-heavy courses",
      "Non-native English speakers studying abroad",
      "Professionals attending frequent meetings",
      "Students in developing countries with unreliable internet",
    ],
    monetization: [
      "Freemium: Core features free, premium AI features at $4.99/mo",
      "Student discount: 50% off with .edu email verification",
      "Team plans for study groups at $2.99/user/mo",
    ],
    mvpPlan: [
      "Week 1–2: Build core note-taking editor with offline storage",
      "Week 3: Integrate AI summarization API",
      "Week 4: Add one-tap onboarding and basic export",
      "Week 5: Beta launch on ProductHunt with 100 student testers",
      "Week 6: Iterate based on feedback, add flashcard generation",
    ],
  },
};
