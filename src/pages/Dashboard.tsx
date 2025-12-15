import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import QuoteCard from "@/components/QuoteCard";
import StreakDisplay from "@/components/StreakDisplay";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, Target, Trophy, Users, TrendingUp, Bell, Timer } from "lucide-react";
import { format } from "date-fns";

interface Activity {
  id: string;
  activity_type: string;
  activity_data: any;
  created_at: string;
  username?: string;
}

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalHours: 0, thisWeek: 0, rank: 0, streak: 0 });
  const [streakData, setStreakData] = useState<{ current: number; longest: number; lastActivity?: string } | null>(null);
  const [friendActivities, setFriendActivities] = useState<Activity[]>([]);
  const [dailyGoal, setDailyGoal] = useState<{ target: number; current: number } | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      // Fetch total hours
      const { data: logs } = await supabase
        .from("daily_logs")
        .select("hours_worked")
        .eq("user_id", user.id);

      const totalHours = logs?.reduce((sum, log) => sum + Number(log.hours_worked), 0) || 0;

      // Fetch this week's hours
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { data: weekLogs } = await supabase
        .from("daily_logs")
        .select("hours_worked")
        .eq("user_id", user.id)
        .gte("log_date", oneWeekAgo.toISOString().split("T")[0]);

      const thisWeek = weekLogs?.reduce((sum, log) => sum + Number(log.hours_worked), 0) || 0;

      // Fetch streak
      const { data: streak } = await supabase
        .from("streaks")
        .select("current_streak, longest_streak, last_activity_date")
        .eq("user_id", user.id)
        .eq("streak_type", "daily_log")
        .maybeSingle();

      setStreakData({
        current: streak?.current_streak || 0,
        longest: streak?.longest_streak || 0,
        lastActivity: streak?.last_activity_date || undefined,
      });

      // Calculate rank using secure function (only shows aggregated data)
      const { data: leaderboardData } = await supabase
        .rpc('get_leaderboard_data', {
          p_timeframe: 'total',
          p_friend_ids: null
      });

      const sortedUsers = (leaderboardData || []).sort((a, b) => 
        Number(b.total_hours || 0) - Number(a.total_hours || 0)
      );
      const rank = sortedUsers.findIndex((entry) => entry.user_id === user.id) + 1;

      setStats({ totalHours, thisWeek, rank, streak: streak?.current_streak || 0 });

      // Fetch daily goal
      try {
        const today = format(new Date(), "yyyy-MM-dd");
        const { data: goal, error: goalError } = await supabase
          .from("daily_goals")
          .select("target_hours")
          .eq("user_id", user.id)
          .eq("goal_date", today)
          .maybeSingle();

        if (goal && !goalError) {
          const { data: todayLogs } = await supabase
            .from("daily_logs")
            .select("hours_worked")
            .eq("user_id", user.id)
            .eq("log_date", today);

          const current = todayLogs?.reduce((sum, log) => sum + Number(log.hours_worked), 0) || 0;
          setDailyGoal({ target: goal.target_hours, current });
        } else {
          setDailyGoal(null);
        }
      } catch (error) {
        console.error("Error fetching daily goal:", error);
        setDailyGoal(null);
      }

      // Fetch friend activities
      fetchFriendActivities();

      // Fetch unread notifications
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);

      setUnreadNotifications(count || 0);
    };

    fetchStats();
  }, [user]);

  const fetchFriendActivities = async () => {
    if (!user) return;

    // Get friend IDs
    const { data: friendships } = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq("status", "accepted");

    if (!friendships || friendships.length === 0) {
      setFriendActivities([]);
      return;
    }

    const friendIds = friendships.map(f => 
      f.user_id === user.id ? f.friend_id : f.user_id
    );

    // Fetch recent activities
    const { data: activities } = await supabase
      .from("activity_feed")
      .select("*")
      .in("user_id", friendIds)
      .order("created_at", { ascending: false })
      .limit(5);

    if (activities) {
      // Get usernames
      const userIds = [...new Set(activities.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p.username]) || []);

      setFriendActivities(
        activities.map(a => ({
          ...a,
          username: profilesMap.get(a.user_id),
        }))
      );
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-primary text-2xl font-display">Loading...</div>
    </div>;
  }

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-16 md:pt-0 md:ml-[var(--sidebar-width,5rem)] p-4 sm:p-6 lg:p-8 transition-all duration-300">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display mb-2 neon-text">
                Welcome back, Warrior
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">Track your progress and dominate your goals</p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/notifications")}
              className={`relative w-full sm:w-auto ${unreadNotifications > 0 ? "animate-pulse" : ""}`}
            >
              <Bell className="w-4 h-4 mr-2" />
              Notifications
              {unreadNotifications > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs">
                  {unreadNotifications}
                </span>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <Card className="glow-card p-4 sm:p-6 animate-slide-up hover:scale-105 transition-all duration-300 animate-float">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-primary/20 rounded-lg animate-pulse-slow flex-shrink-0">
                  <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-primary animate-bounce-slow" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-xs sm:text-sm">Total Hours</p>
                  <p className="text-2xl sm:text-3xl font-display text-primary animate-fade-in truncate">{stats.totalHours.toFixed(1)}</p>
                </div>
              </div>
            </Card>

            <Card className="glow-card p-4 sm:p-6 animate-slide-up hover:scale-105 transition-all duration-300 animate-float" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-secondary/20 rounded-lg animate-pulse-slow flex-shrink-0">
                  <Target className="w-6 h-6 sm:w-8 sm:h-8 text-secondary animate-bounce-slow" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-xs sm:text-sm">This Week</p>
                  <p className="text-2xl sm:text-3xl font-display text-secondary animate-fade-in truncate">{stats.thisWeek.toFixed(1)}</p>
                </div>
              </div>
            </Card>

            <StreakDisplay
              currentStreak={streakData?.current || 0}
              longestStreak={streakData?.longest || 0}
              lastActivityDate={streakData?.lastActivity}
            />

            <Card className="glow-card p-4 sm:p-6 animate-slide-up hover:scale-105 transition-all duration-300 animate-float" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-accent/20 rounded-lg animate-pulse-slow flex-shrink-0">
                  <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-accent animate-bounce-slow" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-xs sm:text-sm">Your Rank</p>
                  <p className="text-2xl sm:text-3xl font-display text-accent animate-fade-in truncate">#{stats.rank || "-"}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Daily Goal Card */}
          {dailyGoal && (
            <Card className="glow-card p-4 sm:p-6 mb-6 sm:mb-8 animate-slide-up">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
                  <h3 className="text-lg sm:text-xl font-display text-primary">Today's Goal</h3>
                </div>
                <span className={`text-xl sm:text-2xl font-display ${dailyGoal.current >= dailyGoal.target ? 'text-green-400' : 'text-primary'}`}>
                  {dailyGoal.current.toFixed(1)} / {dailyGoal.target.toFixed(1)}h
                </span>
              </div>
              <div className="w-full bg-muted/30 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    dailyGoal.current >= dailyGoal.target ? 'bg-green-400' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min((dailyGoal.current / dailyGoal.target) * 100, 100)}%` }}
                />
              </div>
            </Card>
          )}

          {/* Pomodoro Timer */}
          <div className="mb-6 sm:mb-8">
            <PomodoroTimer />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* Friend Activity Feed */}
            <Card className="glow-card p-4 sm:p-6 animate-slide-up">
              <div className="flex items-center gap-2 sm:gap-3 mb-4">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
                <h3 className="text-lg sm:text-xl font-display text-primary">Friend Activity</h3>
              </div>
              <ScrollArea className="h-64 pr-4">
                <div className="space-y-3">
                {friendActivities.length > 0 ? (
                  friendActivities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        activity.activity_type === 'pomodoro_completed' 
                          ? 'bg-primary/20' 
                          : 'bg-primary/20'
                      }`}>
                        {activity.activity_type === 'pomodoro_completed' ? (
                          <Timer className="w-4 h-4 text-primary" />
                        ) : (
                          <Users className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-display text-primary">{activity.username}</span>
                          {" "}
                          {activity.activity_type === 'badge_earned' && (
                            <>earned a <span className="text-secondary font-display">badge</span>! 🎉</>
                          )}
                          {activity.activity_type === 'log_created' && (
                            <>logged hours today! 💪</>
                          )}
                          {activity.activity_type === 'achievement_added' && (
                            <>added an achievement! ⭐</>
                          )}
                          {activity.activity_type === 'streak_milestone' && (
                            <>hit a streak milestone! 🔥</>
                          )}
                          {activity.activity_type === 'pomodoro_completed' && (
                            <>completed a <span className="text-primary font-display">Pomodoro session</span>! 🍅</>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(activity.created_at), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">No friend activity yet</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate("/friends")}
                      className="mt-4"
                    >
                      Add Friends
                    </Button>
                  </div>
                )}
              </div>
              </ScrollArea>
            </Card>

            {/* Quote Card */}
            <QuoteCard />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
