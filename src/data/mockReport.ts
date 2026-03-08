export interface SignalCardData {
  title: string;
  source: string;
  metrics: { label: string; value: string }[];
  evidence: string[];
  verdict: string;
}

export interface OpportunityData {
  featureGaps: string[];
  underservedUsers: string[];
  strategicAngle: string;
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
  verdictExplanation: "There is demand but competition is moderate. Success requires strong differentiation.",
  signalCards: [
    {
      title: "Trend Momentum",
      source: "Social Media + Search Trends",
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
      metrics: [
        { label: "NoteAI", value: "3.1 ★ • 18k reviews • 210k downloads" },
        { label: "StudyBuddy", value: "4.0 ★ • 8k reviews • 95k downloads" },
        { label: "LectureSnap", value: "3.5 ★ • 3k reviews • 40k downloads" },
      ],
      evidence: [
        "NoteAI weakness: complex UI that confuses new users.",
        "StudyBuddy weakness: no offline mode.",
      ],
      verdict: "Top competitor has weak reviews despite strong downloads.",
    },
    {
      title: "User Sentiment",
      source: "App Reviews + Social Discussions",
      metrics: [
        { label: "Top Complaints", value: "Confusing onboarding, no offline, subscription pricing" },
        { label: "User Loves", value: "Accurate summaries, fast transcription" },
        { label: "Emotional Tone", value: "Frustrated but hopeful" },
      ],
      evidence: [
        '"The AI is amazing but the app crashes every 10 minutes" — App Store review',
        '"Why do all note apps require a subscription?" — r/students',
      ],
      verdict: "Users clearly want better usability.",
    },
    {
      title: "Growth Signals",
      source: "Search Trends + Market Activity",
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
    featureGaps: ["Offline mode missing in top apps", "Simpler onboarding needed", "No freemium tier in most competitors"],
    underservedUsers: ["Non-technical professionals", "Older users", "Students in developing countries"],
    strategicAngle: "Offline-first, ultra-simple UX with a generous free tier.",
  },
  scoreBreakdown: [
    { label: "Trend Momentum", value: 17 },
    { label: "Market Saturation", value: 14 },
    { label: "Sentiment", value: 13 },
    { label: "Growth", value: 15 },
    { label: "Opportunity", value: 12 },
  ],
};
