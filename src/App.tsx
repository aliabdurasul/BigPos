import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";
import { POSProvider } from "@/context/POSContext";
import LandingPage from "./pages/LandingPage";
import POSEntry from "./pages/POSEntry";
import AdminLogin from "./pages/AdminLogin";
import StaffLogin from "./pages/StaffLogin";
import GarsonPOS from "./pages/GarsonPOS";
import CashierPOS from "./pages/CashierPOS";
import MutfakEkrani from "./pages/MutfakEkrani";
import RestoranAdmin from "./pages/RestoranAdmin";
import SuperAdmin from "./pages/SuperAdmin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function POSLayout({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const restaurantId = session?.restaurantId || '';
  const staffId = session?.type === 'staff' ? session.staffId : null;
  return (
    <POSProvider restaurantId={restaurantId} staffId={staffId}>
      {children}
    </POSProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/pos" element={<POSEntry />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/pos/:slug" element={<StaffLogin />} />
            <Route path="/admin/dashboard" element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SuperAdmin />
              </ProtectedRoute>
            } />
            <Route path="/pos/:slug/dashboard" element={
              <ProtectedRoute allowedRoles={['restoran_admin']}>
                <POSLayout><RestoranAdmin /></POSLayout>
              </ProtectedRoute>
            } />
            <Route path="/pos/:slug/tables" element={
              <ProtectedRoute allowedRoles={['garson', 'manager']}>
                <POSLayout><GarsonPOS /></POSLayout>
              </ProtectedRoute>
            } />
            <Route path="/pos/:slug/cashier" element={
              <ProtectedRoute allowedRoles={['cashier', 'restoran_admin', 'manager']}>
                <POSLayout><CashierPOS /></POSLayout>
              </ProtectedRoute>
            } />
            <Route path="/pos/:slug/kitchen" element={
              <ProtectedRoute allowedRoles={['mutfak']}>
                <MutfakEkrani />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
