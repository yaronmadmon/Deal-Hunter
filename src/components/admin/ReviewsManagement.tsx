import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, Check, X, Trash2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReviewItem {
  id: string;
  user_id: string;
  rating: number;
  title: string;
  body: string;
  display_name: string | null;
  approved: boolean;
  created_at: string;
  user_email?: string;
}

export const ReviewsManagement = () => {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");

  const fetchReviews = async () => {
    setLoading(true);
    try {
      let query = supabase.from("reviews").select("*").order("created_at", { ascending: false });
      if (filter === "pending") query = query.eq("approved", false);
      if (filter === "approved") query = query.eq("approved", true);
      const { data, error } = await query;
      if (error) throw error;

      const userIds = [...new Set((data as any[]).map((d: any) => d.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, email, display_name").in("id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p.email || p.display_name || "Unknown"]));

      setReviews((data as any[]).map((d: any) => ({
        ...d,
        user_email: profileMap.get(d.user_id) || "Unknown",
      })));
    } catch (err: any) {
      toast.error(err.message || "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReviews(); }, [filter]);

  const toggleApproval = async (id: string, approved: boolean) => {
    const { error } = await supabase.from("reviews" as any).update({ approved } as any).eq("id", id);
    if (error) { toast.error("Failed to update"); return; }
    setReviews(prev => prev.map(r => r.id === id ? { ...r, approved } : r));
    toast.success(approved ? "Review approved" : "Review hidden");
  };

  const deleteReview = async (id: string) => {
    const { error } = await supabase.from("reviews" as any).delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    setReviews(prev => prev.filter(r => r.id !== id));
    toast.success("Review deleted");
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "—";
  const pendingCount = reviews.filter(r => !r.approved).length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{reviews.length}</p>
          <p className="text-xs text-muted-foreground">Total Reviews</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <Star className="h-5 w-5 fill-primary text-primary" />
            <p className="text-2xl font-bold text-foreground">{avgRating}</p>
          </div>
          <p className="text-xs text-muted-foreground">Avg Rating</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">Pending Approval</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(["all", "pending", "approved"] as const).map(f => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={fetchReviews} className="ml-auto">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-muted-foreground text-sm animate-pulse">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="text-muted-foreground text-sm">No reviews yet.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id} className={!review.approved ? "border-primary/30" : ""}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={cn("h-3.5 w-3.5", review.rating >= s ? "fill-primary text-primary" : "text-muted-foreground/20")} />
                        ))}
                      </div>
                      <Badge variant={review.approved ? "default" : "secondary"}>
                        {review.approved ? "Approved" : "Pending"}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm text-foreground">{review.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {review.display_name || review.user_email} · {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!review.approved ? (
                      <Button variant="outline" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700" onClick={() => toggleApproval(review.id, true)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => toggleApproval(review.id, false)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteReview(review.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{review.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
