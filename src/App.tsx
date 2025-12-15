import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Calendar from "./pages/Calendar";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import Friends from "./pages/Friends";
import Challenges from "./pages/Challenges";
import Settings from "./pages/Settings";
import ResetPassword from "./pages/ResetPassword";
import ForgotPassword from "./pages/ForgotPassword";
import Analytics from "./pages/Analytics";
import Admin from "./pages/Admin";
import Notifications from "./pages/Notifications";
import Projects from "./pages/Projects";
import Documentation from "./pages/Documentation";
import Chat from "./pages/Chat";
import Groups from "./pages/Groups";
import Habits from "./pages/Habits";
import Goals from "./pages/Goals";
import { PomodoroProvider } from "./contexts/PomodoroContext";
import { FloatingPomodoroTimer } from "./components/FloatingPomodoroTimer";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PomodoroProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/challenges" element={<Challenges />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:userId" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/zen" element={<Admin />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:friendId" element={<Chat />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/groups/invite/:inviteCode" element={<Groups />} />
          <Route path="/chat/group/:groupId" element={<Chat />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/docs" element={<Documentation />} />
          <Route path="/help" element={<Documentation />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <FloatingPomodoroTimer />
      </BrowserRouter>
      </PomodoroProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
