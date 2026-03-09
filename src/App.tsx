import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";
import { POSProvider } from "@/context/POSContext";
import RoleSelection from "./pages/RoleSelection";
import AdminLogin from "./pages/AdminLogin";
import StaffLogin from "./pages/StaffLogin";
import GarsonPOS from "./pages/GarsonPOS";
import MutfakEkrani from "./pages/MutfakEkrani";
import RestoranAdmin from "./pages/RestoranAdmin";
import SuperAdmin from "./pages/SuperAdmin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Wraps POS pages in POSProvider using restaurantId + staffId from auth session
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
            <Route path="/" element={<RoleSelection />} />
            <Route path="/login" element={<AdminLogin />} />
            <Route path="/pos/:slug" element={<StaffLogin />} />
            <Route path="/super-admin" element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SuperAdmin />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['restoran_admin']}>
                <POSLayout><RestoranAdmin /></POSLayout>
              </ProtectedRoute>
            } />
            <Route path="/garson" element={
              <ProtectedRoute allowedRoles={['garson', 'manager']}>
                <POSLayout><GarsonPOS /></POSLayout>
              </ProtectedRoute>
            } />
            <Route path="/mutfak" element={
              <ProtectedRoute allowedRoles={['mutfak']}>
                <POSLayout><MutfakEkrani /></POSLayout>
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
