import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PropertiesPage from "./pages/PropertiesPage";
import TenantsPage from "./pages/TenantsPage";
import FinancePage from "./pages/FinancePage";
import UtilityBillingPage from "./pages/UtilityBillingPage";
import DocumentsPage from "./pages/DocumentsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<AppLayout><DashboardPage /></AppLayout>} />
          <Route path="/properties" element={<AppLayout><PropertiesPage /></AppLayout>} />
          <Route path="/tenants" element={<AppLayout><TenantsPage /></AppLayout>} />
          <Route path="/finance" element={<AppLayout><FinancePage /></AppLayout>} />
          <Route path="/finance/utility-billing" element={<AppLayout><UtilityBillingPage /></AppLayout>} />
          <Route path="/documents" element={<AppLayout><DocumentsPage /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
