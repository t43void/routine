import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Award, Users, User, ChevronLeft, ChevronRight } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";

interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_hours: number;
}

const Leaderboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [weeklyData, setWeeklyData] = useState<LeaderboardEntry[]>([]);
  const [monthlyData, setMonthlyData] = useState<LeaderboardEntry[]>([]);
  const [friendFilter, setFriendFilter] = useState(true); // Default to friends only
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [weeklyPage, setWeeklyPage] = useState(1);
  const [monthlyPage, setMonthlyPage] = useState(1);
  const itemsPerPage = 10; // Show 10 entries per page

  // Helper function to get visible page numbers (show max 7 pages)
  const getVisiblePages = (currentPage: number, totalPages: number) => {
    const maxVisible = 7;
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchFriends();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchLeaderboards();
      // Reset to first page when friend list or filter changes
      setWeeklyPage(1);
      setMonthlyPage(1);
    }
  }, [user, friendIds, friendFilter]);

  const fetchFriends = async () => {
    if (!user) return;

    const { data: friendships } = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq("status", "accepted");

    if (friendships) {
      const ids = friendships.map(f => 
        f.user_id === user.id ? f.friend_id : f.user_id
      );
      setFriendIds([...ids, user.id]); // Include self
    }
  };

  const fetchLeaderboards = async () => {
    if (!user) return;
    
    // Use secure function to get leaderboard data without exposing individual logs
    // Leaderboard is friends-only by default (include yourself)
    // If friendFilter is false, show all users (pass null)
    // When friendFilter is true, show only friends (friendIds already includes user.id)
    // When friendFilter is false, show all users (pass null)
    const friendIdsArray = friendFilter && friendIds.length > 0
      ? friendIds
      : null;

    // Fetch weekly leaderboard
    const { data: weeklyData, error: weeklyError } = await supabase
      .rpc('get_leaderboard_data', {
        p_timeframe: 'weekly',
        p_friend_ids: friendIdsArray
    });

    // Fetch monthly leaderboard
    const { data: monthlyData, error: monthlyError } = await supabase
      .rpc('get_leaderboard_data', {
        p_timeframe: 'monthly',
        p_friend_ids: friendIdsArray
      });

    if (weeklyError || !weeklyData) {
      setWeeklyData([]);
    } else {
    setWeeklyData(
        weeklyData.map(entry => ({
          user_id: entry.user_id,
          username: entry.username,
          avatar_url: entry.avatar_url,
          total_hours: Number(entry.total_hours || 0),
        })).sort((a, b) => b.total_hours - a.total_hours)
    );
    }

    if (monthlyError || !monthlyData) {
      setMonthlyData([]);
    } else {
    setMonthlyData(
        monthlyData.map(entry => ({
          user_id: entry.user_id,
          username: entry.username,
          avatar_url: entry.avatar_url,
          total_hours: Number(entry.total_hours || 0),
        })).sort((a, b) => b.total_hours - a.total_hours)
    );
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-300" />;
    if (rank === 3) return <Award className="w-6 h-6 text-orange-400" />;
    return <span className="w-6 h-6 flex items-center justify-center text-muted-foreground">#{rank}</span>;
  };

  const LeaderboardTable = ({ data, currentPage, onPageChange }: { data: LeaderboardEntry[]; currentPage: number; onPageChange: (page: number) => void }) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedData = data.slice(startIndex, startIndex + itemsPerPage);
    const totalPages = Math.ceil(data.length / itemsPerPage);
    const visiblePages = getVisiblePages(currentPage, totalPages);
    
    return (
      <>
        <div className="space-y-3">
          {paginatedData.map((entry, index) => {
            const globalIndex = startIndex + index;
        const isCurrentUser = entry.user_id === user?.id;
        return (
          <Card
            key={entry.user_id}
            className={`glow-card p-4 flex items-center gap-4 transition-all duration-300 ${
              isCurrentUser ? "border-primary shadow-lg shadow-primary/20" : "hover:scale-[1.02] cursor-pointer"
            }`}
            onClick={() => !isCurrentUser && navigate(`/profile/${entry.user_id}`)}
          >
            <div className="flex-shrink-0">{getRankIcon(globalIndex + 1)}</div>
            <div className="flex-1">
              <h3 className={`font-display ${isCurrentUser ? "text-primary" : "text-foreground hover:text-primary"}`}>
                {entry.username}
                {isCurrentUser && <span className="text-xs ml-2 text-secondary">(You)</span>}
              </h3>
            </div>
            <div className="text-right">
              <p className="text-2xl font-display text-primary">{entry.total_hours.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">hours</p>
            </div>
            {!isCurrentUser && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${entry.user_id}`);
                }}
                className="text-muted-foreground hover:text-primary"
              >
                <User className="w-4 h-4" />
              </Button>
            )}
          </Card>
          );
        })}
        </div>
        {totalPages > 1 && (
          <div className="mt-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="h-9 w-9"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </PaginationItem>
                {visiblePages.map((page) => (
                  <PaginationItem key={page}>
                    <Button
                      variant={currentPage === page ? "outline" : "ghost"}
                      size="icon"
                      onClick={() => onPageChange(page)}
                      className="h-9 w-9"
                    >
                      {page}
                    </Button>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                    className="h-9 w-9"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </>
    );
  };

  if (loading) return null;

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-16 md:pt-0 md:ml-[var(--sidebar-width,5rem)] p-4 sm:p-6 lg:p-8 transition-all duration-300">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-display mb-2 neon-text">Leaderboard</h1>
              <p className="text-sm sm:text-base text-muted-foreground">See how you rank among warriors</p>
            </div>
            <Button
              variant={friendFilter ? "default" : "outline"}
              onClick={() => setFriendFilter(!friendFilter)}
              className={`${friendFilter ? "bg-primary" : ""} w-full sm:w-auto`}
            >
              <Users className="w-4 h-4 mr-2" />
              {friendFilter ? "Friends Only" : "Show All Users"}
            </Button>
          </div>

          <Tabs defaultValue="weekly" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>

            <TabsContent value="weekly" className="animate-slide-up">
              {weeklyData.length > 0 ? (
                <LeaderboardTable data={weeklyData} currentPage={weeklyPage} onPageChange={setWeeklyPage} />
              ) : (
                <Card className="glow-card p-8 text-center">
                  <p className="text-muted-foreground">No data yet. Start logging your hours!</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="monthly" className="animate-slide-up">
              {monthlyData.length > 0 ? (
                <LeaderboardTable data={monthlyData} currentPage={monthlyPage} onPageChange={setMonthlyPage} />
              ) : (
                <Card className="glow-card p-8 text-center">
                  <p className="text-muted-foreground">No data yet. Start logging your hours!</p>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
