import { Link, useLocation } from "react-router-dom";
import { Home, Calendar, Trophy, User, LogOut, Users, Target, Settings, BarChart3, Shield, Menu, X, ChevronLeft, ChevronRight, Folder, HelpCircle, MessageCircle, UserCircle, CheckSquare, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useState, useEffect, createContext, useContext } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

// Create context for sidebar state
const SidebarContext = createContext<{
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}>({
  isExpanded: false,
  setIsExpanded: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

const Navigation = () => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isZen } = useAdmin();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // Load sidebar state from localStorage and initialize CSS variable
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-expanded");
    const expanded = saved === "true";
    setIsExpanded(expanded);
    // Initialize CSS variable immediately
    document.documentElement.style.setProperty(
      "--sidebar-width",
      expanded ? "16rem" : "5rem"
    );
  }, []);

  // Save sidebar state to localStorage and update CSS variable
  useEffect(() => {
    localStorage.setItem("sidebar-expanded", String(isExpanded));
    document.documentElement.style.setProperty(
      "--sidebar-width",
      isExpanded ? "16rem" : "5rem"
    );
  }, [isExpanded]);

  // Fetch unread message count
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("read", false);

      setUnreadMessageCount(count || 0);
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  const navItems = [
    { icon: Home, label: "Dashboard", path: "/dashboard" },
    { icon: Calendar, label: "Calendar", path: "/calendar" },
    { icon: Folder, label: "Projects", path: "/projects" },
    { icon: CheckSquare, label: "Habits", path: "/habits" },
    { icon: Flag, label: "Goals", path: "/goals" },
    { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
    { icon: Target, label: "Challenges", path: "/challenges" },
    { icon: Users, label: "Friends", path: "/friends" },
    { icon: MessageCircle, label: "Chat", path: "/chat" },
    { icon: UserCircle, label: "Groups", path: "/groups" },
    { icon: BarChart3, label: "Analytics", path: "/analytics" },
    { icon: User, label: "Profile", path: "/profile" },
    { icon: Settings, label: "Settings", path: "/settings" },
    { icon: HelpCircle, label: "Help & Docs", path: "/docs" },
    ...(isZen ? [{ icon: Shield, label: "Zen", path: "/zen" }] : []),
  ];

  const isActive = (path: string) => location.pathname === path;

  const NavContent = ({ showLabels = true }: { showLabels?: boolean }) => (
    <>
      <div className={`mb-8 transition-all duration-300 ${isExpanded && showLabels ? "text-left" : "text-center"}`}>
        {isExpanded && showLabels ? (
          <>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display neon-text tracking-wider animate-pulse">
              Lotus Routine
            </h1>
            <div className="neon-line mt-2"></div>
          </>
        ) : (
          <h1 className="text-2xl font-display neon-text tracking-wider animate-pulse">L</h1>
        )}
      </div>

      <div className="flex-1 space-y-2">
        {navItems.map((item) => {
          const showBadge = item.path === "/chat" && unreadMessageCount > 0;
          const button = (
            <Button
              variant="ghost"
              className={`w-full transition-all duration-300 relative ${
                isExpanded && showLabels ? "justify-start" : "justify-center"
              } ${
                isActive(item.path)
                  ? "bg-primary/20 text-primary border-l-4 border-primary"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/10"
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {isExpanded && showLabels && (
                <span className="ml-3 flex items-center gap-2">
                  {item.label}
                  {showBadge && (
                    <span className="px-2 py-0.5 bg-secondary text-white text-xs rounded-full font-bold">
                      {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                    </span>
                  )}
                </span>
              )}
              {showBadge && !isExpanded && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-secondary text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                </span>
              )}
            </Button>
          );

          // Show tooltip when sidebar is collapsed (on desktop, not mobile)
          // Mobile uses Sheet which always shows labels, so no tooltips needed
          if (!isExpanded && showLabels) {
            return (
              <TooltipProvider key={item.path}>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Link to={item.path} onClick={() => setMobileMenuOpen(false)}>
                      {button}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-card border border-primary/30">
                    <p className="text-sm">{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }

          return (
            <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}>
              {button}
            </Link>
          );
        })}
      </div>

      {!isExpanded && showLabels ? (
        <TooltipProvider>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={signOut}
                className="w-full justify-center text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-card border border-primary/30">
              <p className="text-sm">Logout</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Button
          variant="ghost"
          onClick={signOut}
          className={`w-full transition-all duration-300 ${
            isExpanded && showLabels ? "justify-start" : "justify-center"
          } text-destructive hover:text-destructive hover:bg-destructive/10`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {isExpanded && showLabels && <span className="ml-3">Logout</span>}
        </Button>
      )}
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="fixed top-4 left-4 z-50 md:hidden">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-card border-primary/30">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-card border-primary/30 p-4">
            <NavContent showLabels={true} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Navigation */}
      <SidebarContext.Provider value={{ isExpanded, setIsExpanded }}>
        <nav
          className={`hidden md:flex fixed left-0 top-0 h-screen bg-card border-r border-primary/30 flex-col transition-all duration-300 z-40 ${
            isExpanded ? "w-64" : "w-20"
          } ${isExpanded ? "items-stretch" : "items-center"} p-3 lg:p-4 space-y-4`}
        >
          <NavContent showLabels={true} />
          
          {/* Toggle Button */}
          <div className={`mt-auto pt-4 border-t border-primary/20 ${isExpanded ? "flex justify-end" : "flex justify-center"}`}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="hover:bg-primary/10"
                  >
                    {isExpanded ? (
                      <ChevronLeft className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{isExpanded ? "Collapse" : "Expand"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </nav>
      </SidebarContext.Provider>
    </>
  );
};

export default Navigation;
