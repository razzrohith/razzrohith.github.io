import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import BrowsePage from "@/pages/BrowsePage";
import ProduceDetailPage from "@/pages/ProduceDetailPage";
import FarmerDashboard from "@/pages/FarmerDashboard";
import AgentDashboard from "@/pages/AgentDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import FarmerProfilePage from "@/pages/FarmerProfilePage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import InstallBanner from "@/components/InstallBanner";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={LandingPage} />
      <Route path="/browse" component={BrowsePage} />
      <Route path="/produce/:id" component={ProduceDetailPage} />
      <Route path="/farmers/:id" component={FarmerProfilePage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />

      {/* Protected routes */}
      <Route path="/farmer">
        {() => (
          <ProtectedRoute allowedRoles={["farmer", "admin"]}>
            <FarmerDashboard />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/agent">
        {() => (
          <ProtectedRoute allowedRoles={["agent", "admin"]}>
            <AgentDashboard />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/admin">
        {() => (
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster richColors position="top-center" />
        <InstallBanner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
