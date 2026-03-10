import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Star, GitFork, AlertCircle, Code2, Clock } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip, Cell } from "recharts";
import { DataSourceBadge } from "./DataSourceBadge";
import type { GitHubRepoData } from "@/data/mockReport";

interface OpenSourceLandscapeProps {
  repos: GitHubRepoData[];
}

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

export const OpenSourceLandscape = ({ repos }: OpenSourceLandscapeProps) => {
  if (!repos || repos.length === 0) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Code2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-heading">Open Source Landscape</CardTitle>
              <span className="text-[13px] text-muted-foreground">GitHub API</span>
            </div>
            <DataSourceBadge dataSource="github" compact />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-success font-medium bg-success/10 rounded-md px-3 py-2">
            🟢 No significant open-source competition found — blue ocean for builders
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalStars = repos.reduce((s, r) => s + r.stars, 0);
  const totalForks = repos.reduce((s, r) => s + r.forks, 0);
  const topRepo = repos[0];
  const languages = repos.reduce((acc, r) => {
    if (r.language) acc[r.language] = (acc[r.language] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topLanguages = Object.entries(languages).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const chartData = repos.slice(0, 8).map(r => ({
    name: r.name.split("/").pop() || r.name,
    stars: r.stars,
  }));

  const recentlyActive = repos.filter(r => {
    const days = (Date.now() - new Date(r.pushedAt).getTime()) / (1000 * 60 * 60 * 24);
    return days < 30;
  });

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Code2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-heading">Open Source Landscape</CardTitle>
              <span className="text-[13px] text-muted-foreground">GitHub API · {repos.length} repositories</span>
            </div>
          </div>
          <DataSourceBadge dataSource="github" compact />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-secondary/40 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-foreground">{repos.length}</div>
            <div className="text-[13px] text-muted-foreground">Repos Found</div>
          </div>
          <div className="bg-secondary/40 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
              <Star className="w-3.5 h-3.5 text-warning" />
              {totalStars.toLocaleString()}
            </div>
            <div className="text-[13px] text-muted-foreground">Total Stars</div>
          </div>
          <div className="bg-secondary/40 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
              <GitFork className="w-3.5 h-3.5 text-primary" />
              {totalForks.toLocaleString()}
            </div>
            <div className="text-[13px] text-muted-foreground">Total Forks</div>
          </div>
          <div className="bg-secondary/40 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-foreground">{recentlyActive.length}</div>
            <div className="text-[13px] text-muted-foreground">Active (30d)</div>
          </div>
        </div>

        {/* Stars bar chart */}
        {chartData.length > 0 && (
          <div className="space-y-2">
            <div className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">Stars by Repository</div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(220 9% 46%)' }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={40} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(220 13% 91%)' }} formatter={(v: number) => [v.toLocaleString(), 'Stars']} />
                  <Bar dataKey="stars" radius={[4, 4, 0, 0]} barSize={28}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "hsl(239 84% 67%)" : "hsl(239 84% 67% / 0.5)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top languages */}
        {topLanguages.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">Top Languages</div>
            <div className="flex flex-wrap gap-1.5">
              {topLanguages.map(([lang, count]) => (
                <Badge key={lang} variant="secondary" className="text-xs px-2 py-0.5">
                  {lang} ({count})
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Repository list */}
        <div className="space-y-2">
          <div className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">Top Repositories</div>
          {repos.slice(0, 6).map((repo) => (
            <div key={repo.name} className="border rounded-lg p-3 space-y-1.5 bg-secondary/30">
              <div className="flex items-start justify-between gap-2">
                <a href={repo.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1">
                  {repo.name}
                  <ExternalLink className="w-3 h-3" />
                </a>
                {repo.language && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0 shrink-0">
                    {repo.language}
                  </Badge>
                )}
              </div>
              {repo.description && (
                <p className="text-[13px] text-muted-foreground line-clamp-2">{repo.description}</p>
              )}
              <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
                <span className="inline-flex items-center gap-0.5">
                  <Star className="w-3 h-3 text-warning" /> {repo.stars.toLocaleString()}
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <GitFork className="w-3 h-3" /> {repo.forks.toLocaleString()}
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <AlertCircle className="w-3 h-3" /> {repo.openIssues}
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <Clock className="w-3 h-3" /> {timeAgo(repo.pushedAt)}
                </span>
              </div>
              {repo.topics && repo.topics.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {repo.topics.slice(0, 5).map(t => (
                    <span key={t} className="text-[11px] bg-primary/10 text-primary rounded px-1.5 py-0.5">{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Insight */}
        <div className="bg-secondary/50 border border-border/50 rounded-lg p-3">
          <p className="text-[13px] text-muted-foreground italic">
            {recentlyActive.length > repos.length / 2
              ? `🔥 High open-source activity — ${recentlyActive.length} of ${repos.length} repos pushed code in the last 30 days, indicating strong builder interest.`
              : totalStars > 1000
                ? `⭐ Significant community interest with ${totalStars.toLocaleString()} total stars across ${repos.length} repositories.`
                : `📊 ${repos.length} related repositories found with moderate activity — open-source competition is manageable.`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};