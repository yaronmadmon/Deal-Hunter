import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { usePageTracking } from "@/hooks/usePageTracking";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CookieBanner } from "@/components/CookieBanner";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Processing from "./pages/Processing";
import Report from "./pages/Report";
import BuyCredits from "./pages/BuyCredits";
import PaymentSuccess from "./pages/PaymentSuccess";
import ResetPassword from "./pages/ResetPassword";
import Watchlist from "./pages/Watchlist";
import Live from "./pages/Live";
import Admin from "./pages/Admin";
import Pricing from "./pages/Pricing";
import Settings from "./pages/Settings";
import SampleReport from "./pages/SampleReport";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";

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
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/processing/:id" element={<Processing />} />
            <Route path="/report/:id" element={<Report />} />
            <Route path="/buy-credits" element={<BuyCredits />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/live" element={<Live />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/sample-report" element={<SampleReport />} />
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
