import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Trophy, Brain, Search, Microscope, Rocket } from "lucide-react";

interface NavSection {
  id: string;
  label: string;
  icon: React.ElementType;
}

const sections: NavSection[] = [
  { id: "layer-verdict", label: "Overview", icon: Trophy },
  { id: "layer-explanation", label: "Explanation", icon: Brain },
  { id: "layer-evidence", label: "Evidence", icon: Search },
  { id: "layer-deep-analysis", label: "Deep Analysis", icon: Microscope },
  { id: "blueprint-content", label: "Blueprint", icon: Rocket },
];

export const ReportNavigator = () => {
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <nav className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col gap-1 bg-card/80 backdrop-blur-md border border-border rounded-xl p-1.5 shadow-lg">
      {sections.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => scrollTo(id)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap",
            activeSection === id
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          )}
        >
          <Icon className="w-3.5 h-3.5 shrink-0" />
          {label}
        </button>
      ))}
    </nav>
  );
};
