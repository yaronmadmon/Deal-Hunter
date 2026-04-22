import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { usePageTracking } from "@/hooks/usePageTracking";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CookieBanner } from "@/components/CookieBanner";

// Shared pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import BuyCredits from "./pages/BuyCredits";
import PaymentSuccess from "./pages/PaymentSuccess";
import ResetPassword from "./pages/ResetPassword";
import Pricing from "./pages/Pricing";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";

// Gold Rush (idea validation)
import Dashboard from "./pages/Dashboard";
import Processing from "./pages/Processing";
import Report from "./pages/Report";
import Watchlist from "./pages/Watchlist";
import Live from "./pages/Live";
import SampleReport from "./pages/SampleReport";

// Deal Hunter (real estate)
import DealSearch from "./pages/DealSearch";
import DealProcessing from "./pages/DealProcessing";
import PropertyDetail from "./pages/PropertyDetail";
import DealPipeline from "./pages/DealPipeline";
import AuctionCalendar from "./pages/AuctionCalendar";

const queryClient = new QueryClient();

const PageTracker = () => {
  usePageTracking();
  return null;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PageTracker />
          <CookieBanner />
          <Routes>
            {/* Landing */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />

            {/* Gold Rush — idea validation */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/processing/:id" element={<Processing />} />
            <Route path="/report/:id" element={<Report />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/live" element={<Live />} />
            <Route path="/sample-report" element={<SampleReport />} />

            {/* Deal Hunter — real estate */}
            <Route path="/deals" element={<DealSearch />} />
            <Route path="/deal-batch/:id" element={<DealProcessing />} />
            <Route path="/property/:id" element={<PropertyDetail />} />
            <Route path="/pipeline" element={<DealPipeline />} />
            <Route path="/auctions" element={<AuctionCalendar />} />

            {/* Shared */}
            <Route path="/buy-credits" element={<BuyCredits />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
