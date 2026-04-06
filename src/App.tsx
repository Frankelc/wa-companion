import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SplashScreen from "@/components/SplashScreen";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Connect from "./pages/Connect";
import Status from "./pages/Status";
import StatusList from "./pages/StatusList";
import StatusDetail from "./pages/StatusDetail";
import StatusSchedule from "./pages/StatusSchedule";
import StatusConfig from "./pages/StatusConfig";
import ViewOnce from "./pages/ViewOnce";
import DeletedMessages from "./pages/DeletedMessages";
import Autoresponder from "./pages/Autoresponder";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Upgrade from "./pages/Upgrade";
import Help from "./pages/Help";
import SnapCaptures from "./pages/SnapCaptures";
import DashboardLayout from "./components/layout/DashboardLayout";
import NotFound from "./pages/NotFound";
import { PWAInstallBanner } from "./components/PWAInstallBanner";
import { PWAUpdateHandler } from "./components/PWAUpdateHandler";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <SplashScreen />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="connect" element={<Connect />} />
              <Route path="status" element={<Status />} />
              <Route path="status/list" element={<StatusList />} />
              <Route path="status/:contactId" element={<StatusDetail />} />
              <Route path="status/schedule" element={<StatusSchedule />} />
              <Route path="status/config" element={<StatusConfig />} />
              <Route path="view-once" element={<ViewOnce />} />
              <Route path="deleted-messages" element={<DeletedMessages />} />
              <Route path="autoresponder" element={<Autoresponder />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settings" element={<Settings />} />
              <Route path="upgrade" element={<Upgrade />} />
              <Route path="help" element={<Help />} />
              <Route path="snap-captures" element={<SnapCaptures />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <PWAInstallBanner />
          <PWAUpdateHandler />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
