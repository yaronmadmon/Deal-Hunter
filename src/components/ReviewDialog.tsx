import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const ReviewDialog = () => {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async () => {
    if (!user || title.trim().length < 3 || body.trim().length < 10) {
      toast.error("Please fill in all fields (title 3+ chars, review 10+ chars).");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("reviews" as any).insert({
        user_id: user.id,
        rating,
        title: title.trim(),
        body: body.trim(),
        display_name: displayName.trim() || null,
      } as any);
      if (error) throw error;
      toast.success("Thank you for your review! It will appear once approved.");
      setTitle("");
      setBody("");
      setDisplayName("");
      setRating(5);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
          <Star className="h-4 w-4" />
          Review
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Leave a Review</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Star Rating */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Your rating</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-0.5 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      "h-7 w-7 transition-colors",
                      (hoverRating || rating) >= star
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/30"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name (optional)"
            maxLength={50}
          />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Review title"
            maxLength={100}
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your review..."
            className="min-h-[100px] resize-none"
            maxLength={500}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{body.length}/500</span>
            <Button onClick={handleSubmit} disabled={submitting || title.trim().length < 3 || body.trim().length < 10}>
              {submitting ? "Submitting…" : "Submit Review"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
