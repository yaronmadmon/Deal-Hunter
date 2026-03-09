import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
