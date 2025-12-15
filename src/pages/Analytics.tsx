import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown, Users, Clock, Trophy, Target, BarChart3, User, Sparkles, Calendar, Zap, Award, FolderOpen, CheckCircle2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfYear } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

interface FriendStats {
  id: string;
  username: string;
  avatar_url: string | null;
  total_hours: number;
  weekly_hours: number;
  monthly_hours: number;
  current_streak: number;
  badges_count: number;
}

interface TimeComparison {
  user: FriendStats;
  comparison: 'higher' | 'lower' | 'equal';
  difference: number;
  percentage: number;
}

const Analytics = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [myStats, setMyStats] = useState<FriendStats | null>(null);
  const [friendsStats, setFriendsStats] = useState<FriendStats[]>([]);
  const [timeComparisons, setTimeComparisons] = useState<TimeComparison[]>([]);
  const [timeframe, setTimeframe] = useState<'total' | 'weekly' | 'monthly'>('total');
  const [isLoading, setIsLoading] = useState(true);
  const [weeklyInsights, setWeeklyInsights] = useState<any>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectAnalytics, setProjectAnalytics] = useState<any>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const fetchAnalyticsRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const fetchUserStats = useCallback(async (userId: string | null | undefined): Promise<FriendStats | null> => {
    // Add null check before RPC call
    if (!userId) {
      console.warn('fetchUserStats called with null/undefined userId');
      return null;
    }

    try {
      // Use secure function to get stats without exposing individual logs
      const { data: statsArray, error } = await supabase
        .rpc('get_user_stats_for_analytics', { 
          p_user_id: userId,
          p_timeframe: 'total'
        });

      if (error) {
        // Add proper error logging for debugging
        console.error('Error calling get_user_stats_for_analytics:', {
          error,
          userId,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return null;
      }

      if (!statsArray || statsArray.length === 0) {
        console.warn('get_user_stats_for_analytics returned no data for user:', userId);
        return null;
      }

      const stats = statsArray[0]; // Get first result

      return {
        id: stats.user_id,
        username: stats.username,
        avatar_url: stats.avatar_url,
        total_hours: Number(stats.total_hours || 0),
        weekly_hours: Number(stats.weekly_hours || 0),
        monthly_hours: Number(stats.monthly_hours || 0),
        current_streak: stats.current_streak || 0,
        badges_count: Number(stats.badges_count || 0),
      };
    } catch (error) {
      console.error('Unexpected error in fetchUserStats:', error);
      return null;
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    // Add null check before proceeding
    if (!user || !user.id) {
      console.warn('fetchAnalytics called without valid user');
      return;
    }

    // Prevent concurrent calls
    if (fetchAnalyticsRef.current) {
      return;
    }

    fetchAnalyticsRef.current = true;
    setIsLoading(true);

    try {
      // Fetch my stats
      const myStatsData = await fetchUserStats(user.id);
      setMyStats(myStatsData);

      // Fetch friends
      const { data: friendships } = await supabase
        .from("friendships")
        .select("user_id, friend_id")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq("status", "accepted");

      if (friendships && friendships.length > 0) {
        const friendIds = friendships.map(f => 
          f.user_id === user.id ? f.friend_id : f.user_id
        );

        // Fetch all friends' stats
        const friendsData = await Promise.all(
          friendIds.map(id => fetchUserStats(id))
        );

        setFriendsStats(friendsData.filter(Boolean) as FriendStats[]);

        // Calculate comparisons
        if (myStatsData) {
          const comparisons = friendsData
            .filter(Boolean)
            .map(friend => {
              const myValue = getTimeValue(myStatsData, timeframe);
              const friendValue = getTimeValue(friend as FriendStats, timeframe);
              const difference = myValue - friendValue;
              const percentage = friendValue > 0 
                ? ((difference / friendValue) * 100) 
                : (myValue > 0 ? 100 : 0);

              return {
                user: friend as FriendStats,
                comparison: difference > 0 ? 'higher' : difference < 0 ? 'lower' : 'equal',
                difference: Math.abs(difference),
                percentage: Math.abs(percentage),
              };
            })
            .sort((a, b) => {
              // Sort by time value descending
              const aValue = getTimeValue(a.user, timeframe);
              const bValue = getTimeValue(b.user, timeframe);
              return bValue - aValue;
            });

          setTimeComparisons(comparisons);
        }
      } else {
        setFriendsStats([]);
        setTimeComparisons([]);
      }
    } catch (error) {
      console.error('Error in fetchAnalytics:', error);
    } finally {
      setIsLoading(false);
      fetchAnalyticsRef.current = false;
    }
  }, [user, timeframe, fetchUserStats]);

  const getTimeValue = (stats: FriendStats, frame: 'total' | 'weekly' | 'monthly'): number => {
    switch (frame) {
      case 'weekly':
        return stats.weekly_hours;
      case 'monthly':
        return stats.monthly_hours;
      default:
        return stats.total_hours;
    }
  };

  const getTimeframeLabel = (): string => {
    switch (timeframe) {
      case 'weekly':
        return 'This Week';
      case 'monthly':
        return 'This Month';
      default:
        return 'All Time';
    }
  };

  const fetchProjects = useCallback(async () => {
    // Add null check before proceeding
    if (!user || !user.id) {
      console.warn('fetchProjects called without valid user');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, color")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) {
        console.error('Error fetching projects:', error);
        return;
      }

      if (data) {
        setProjects(data);
        if (data.length > 0 && !selectedProjectId) {
          setSelectedProjectId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Unexpected error in fetchProjects:', error);
    }
  }, [user, selectedProjectId]);

  const fetchProjectAnalytics = useCallback(async () => {
    // Add null checks before proceeding
    if (!user || !user.id || !selectedProjectId) {
      console.warn('fetchProjectAnalytics called without valid user or projectId');
      return;
    }
    
    setProjectLoading(true);
    try {
      const now = new Date();
      const yearStart = startOfYear(now);
      
      // Fetch tasks for the selected project
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, task_date, hours, completed, created_at")
        .eq("user_id", user.id)
        .eq("project_id", selectedProjectId)
        .gte("task_date", format(yearStart, "yyyy-MM-dd"))
        .order("task_date", { ascending: true });

      // Fetch daily logs that might be related (we'll use tasks primarily)
      const taskDates = tasks?.map(t => t.task_date) || [];
      const uniqueDates = [...new Set(taskDates)];
      
      const { data: logs } = await supabase
        .from("daily_logs")
        .select("log_date, hours_worked")
        .eq("user_id", user.id)
        .in("log_date", uniqueDates)
        .gte("log_date", format(yearStart, "yyyy-MM-dd"))
        .order("log_date", { ascending: true });

      // Process weekly data
      const weeks = eachWeekOfInterval({ start: yearStart, end: now }, { weekStartsOn: 0 });
      const weeklyData = weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
        const weekTasks = tasks?.filter(t => {
          const taskDate = new Date(t.task_date);
          return taskDate >= weekStart && taskDate <= weekEnd;
        }) || [];
        
        const completedTasks = weekTasks.filter(t => t.completed);
        const totalHours = weekTasks.reduce((sum, t) => sum + (Number(t.hours) || 0), 0);
        
        return {
          week: format(weekStart, "MMM d"),
          hours: totalHours,
          tasks: completedTasks.length,
          totalTasks: weekTasks.length,
        };
      }).slice(-12); // Last 12 weeks

      // Process monthly data
      const months = eachMonthOfInterval({ start: yearStart, end: now });
      const monthlyData = months.map(monthStart => {
        const monthEnd = endOfMonth(monthStart);
        const monthTasks = tasks?.filter(t => {
          const taskDate = new Date(t.task_date);
          return taskDate >= monthStart && taskDate <= monthEnd;
        }) || [];
        
        const completedTasks = monthTasks.filter(t => t.completed);
        const totalHours = monthTasks.reduce((sum, t) => sum + (Number(t.hours) || 0), 0);
        
        return {
          month: format(monthStart, "MMM yyyy"),
          hours: totalHours,
          tasks: completedTasks.length,
          totalTasks: monthTasks.length,
        };
      });

      // Hourly breakdown (by day of week)
      const hourlyBreakdown = [0, 1, 2, 3, 4, 5, 6].map(dayOfWeek => {
        const dayTasks = tasks?.filter(t => {
          const taskDate = new Date(t.task_date);
          return taskDate.getDay() === dayOfWeek;
        }) || [];
        
        const totalHours = dayTasks.reduce((sum, t) => sum + (Number(t.hours) || 0), 0);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        return {
          day: dayNames[dayOfWeek],
          hours: totalHours,
          tasks: dayTasks.filter(t => t.completed).length,
        };
      });

      // Calculate totals
      const totalHours = tasks?.reduce((sum, t) => sum + (Number(t.hours) || 0), 0) || 0;
      const completedTasks = tasks?.filter(t => t.completed).length || 0;
      const totalTasks = tasks?.length || 0;
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      const selectedProject = projects.find(p => p.id === selectedProjectId);
      
      setProjectAnalytics({
        project: selectedProject,
        weeklyData,
        monthlyData,
        hourlyBreakdown,
        totalHours,
        completedTasks,
        totalTasks,
        completionRate,
      });
    } catch (error) {
      console.error('Error in fetchProjectAnalytics:', error);
    } finally {
      setProjectLoading(false);
    }
  }, [user, selectedProjectId, projects]);

  useEffect(() => {
    // Only fetch when user is available and not loading
    if (user && !loading && user.id) {
      fetchAnalytics();
      generateWeeklyReview();
      fetchProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, timeframe, loading]);

  useEffect(() => {
    if (user && selectedProjectId) {
      fetchProjectAnalytics();
    }
  }, [user, selectedProjectId]);

  const generateWeeklyReview = useCallback(async () => {
    // Add null check before proceeding
    if (!user || !user.id) {
      console.warn('generateWeeklyReview called without valid user');
      return;
    }

    try {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

      // Fetch logs for this week
      const { data: logs } = await supabase
        .from("daily_logs")
        .select("log_date, hours_worked, description")
        .eq("user_id", user.id)
        .gte("log_date", format(weekStart, "yyyy-MM-dd"))
        .lte("log_date", format(weekEnd, "yyyy-MM-dd"))
        .order("log_date", { ascending: true });

      // Fetch Pomodoro sessions
      const { data: pomodoros } = await supabase
        .from("pomodoro_sessions")
        .select("created_at, duration")
        .eq("user_id", user.id)
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString());

      // Fetch habits completions
      const { data: habits } = await supabase
        .from("habits")
        .select("id, name")
        .eq("user_id", user.id)
        .eq("archived", false);

      let habitCompletions: any[] = [];
      if (habits && habits.length > 0) {
        const { data: completions } = await supabase
          .from("habit_completions")
          .select("habit_id, completion_date")
          .in("habit_id", habits.map(h => h.id))
          .gte("completion_date", format(weekStart, "yyyy-MM-dd"))
          .lte("completion_date", format(weekEnd, "yyyy-MM-dd"));

        habitCompletions = completions || [];
      }

      const totalHours = logs?.reduce((sum, log) => sum + Number(log.hours_worked), 0) || 0;
      const daysLogged = logs?.length || 0;
      const averageDailyHours = daysLogged > 0 ? totalHours / daysLogged : 0;

      // Find best day
      const dayHours: { [key: string]: number } = {};
      logs?.forEach(log => {
        const day = format(new Date(log.log_date), "EEEE");
        dayHours[day] = (dayHours[day] || 0) + Number(log.hours_worked);
      });
      const bestDay = Object.entries(dayHours).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

      // Calculate insights
      const insights = [];
      
      if (daysLogged >= 5) {
        insights.push({
          type: "success",
          icon: "🎉",
          title: "Consistent Week!",
          message: `You logged ${daysLogged} days this week. Great consistency!`,
        });
      } else if (daysLogged < 3) {
        insights.push({
          type: "warning",
          icon: "💪",
          title: "Room for Improvement",
          message: `You logged ${daysLogged} days. Try to be more consistent next week!`,
        });
      }

      if (averageDailyHours >= 6) {
        insights.push({
          type: "success",
          icon: "🔥",
          title: "High Productivity",
          message: `You averaged ${averageDailyHours.toFixed(1)} hours per day. Excellent work!`,
        });
      }

      if (pomodoros && pomodoros.length > 0) {
        const pomodoroHours = pomodoros.reduce((sum, p) => sum + (Number(p.duration) / 3600), 0);
        insights.push({
          type: "info",
          icon: "🍅",
          title: "Pomodoro Sessions",
          message: `You completed ${pomodoros.length} Pomodoro sessions (${pomodoroHours.toFixed(1)}h) this week.`,
        });
      }

      if (habits && habits.length > 0) {
        const totalCompletions = habitCompletions.length;
        const totalPossible = habits.length * 7;
        const habitRate = totalPossible > 0 ? (totalCompletions / totalPossible) * 100 : 0;
        
        if (habitRate >= 70) {
          insights.push({
            type: "success",
            icon: "✅",
            title: "Habit Master",
            message: `You completed ${totalCompletions} habit checks (${habitRate.toFixed(0)}% completion rate)!`,
          });
        }
      }

      if (bestDay !== "N/A") {
        insights.push({
          type: "info",
          icon: "⭐",
          title: "Best Day",
          message: `${bestDay} was your most productive day this week with ${dayHours[bestDay].toFixed(1)} hours.`,
        });
      }

      // Compare with previous week
      const prevWeekStart = subWeeks(weekStart, 1);
      const prevWeekEnd = subWeeks(weekEnd, 1);
      const { data: prevLogs } = await supabase
        .from("daily_logs")
        .select("hours_worked")
        .eq("user_id", user.id)
        .gte("log_date", format(prevWeekStart, "yyyy-MM-dd"))
        .lte("log_date", format(prevWeekEnd, "yyyy-MM-dd"));

      const prevTotalHours = prevLogs?.reduce((sum, log) => sum + Number(log.hours_worked), 0) || 0;
      if (prevTotalHours > 0) {
        const change = ((totalHours - prevTotalHours) / prevTotalHours) * 100;
        if (Math.abs(change) > 5) {
          insights.push({
            type: change > 0 ? "success" : "warning",
            icon: change > 0 ? "📈" : "📉",
            title: change > 0 ? "Week Over Week Growth" : "Week Over Week Decline",
            message: `You worked ${Math.abs(change).toFixed(0)}% ${change > 0 ? "more" : "less"} than last week.`,
          });
        }
      }

      setWeeklyInsights({
        weekStart: format(weekStart, "MMM d"),
        weekEnd: format(weekEnd, "MMM d, yyyy"),
        totalHours,
        daysLogged,
        averageDailyHours,
        bestDay,
        insights,
        pomodoroCount: pomodoros?.length || 0,
        habitCompletions: habitCompletions.length,
      });
    } catch (error) {
      console.error('Error in generateWeeklyReview:', error);
    }
  }, [user]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary text-2xl font-display">Loading...</div>
      </div>
    );
  }

  const myTimeValue = myStats ? getTimeValue(myStats, timeframe) : 0;
  const sortedFriends = [...timeComparisons].sort((a, b) => {
    const aValue = getTimeValue(a.user, timeframe);
    const bValue = getTimeValue(b.user, timeframe);
    return bValue - aValue;
  });

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-16 md:pt-0 md:ml-[var(--sidebar-width,5rem)] p-4 sm:p-6 lg:p-8 transition-all duration-300">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-display mb-2 neon-text">Analytics</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Compare your progress with friends</p>
            </div>
            <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as any)}>
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="total" className="text-xs sm:text-sm">All Time</TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs sm:text-sm">Monthly</TabsTrigger>
                <TabsTrigger value="weekly" className="text-xs sm:text-sm">Weekly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* My Stats Overview */}
          {myStats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <Card className="glow-card p-4 sm:p-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-primary/20 rounded-lg flex-shrink-0">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-xs sm:text-sm">{getTimeframeLabel()}</p>
                    <p className="text-2xl font-display text-primary">{myTimeValue.toFixed(1)}h</p>
                  </div>
                </div>
              </Card>

              <Card className="glow-card p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-500/20 rounded-lg">
                    <Target className="w-6 h-6 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Current Streak</p>
                    <p className="text-2xl font-display text-orange-400">{myStats.current_streak}</p>
                  </div>
                </div>
              </Card>

              <Card className="glow-card p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-accent/20 rounded-lg">
                    <Trophy className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Badges</p>
                    <p className="text-2xl font-display text-accent">{myStats.badges_count}</p>
                  </div>
                </div>
              </Card>

              <Card className="glow-card p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-secondary/20 rounded-lg">
                    <Users className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Friends</p>
                    <p className="text-2xl font-display text-secondary">{friendsStats.length}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Weekly Review & Insights */}
          {weeklyInsights && (
            <Card className="glow-card p-6 mb-8">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-display text-primary">Weekly Review</h2>
                <span className="text-sm text-muted-foreground">
                  {weeklyInsights.weekStart} - {weeklyInsights.weekEnd}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Total Hours</span>
                  </div>
                  <p className="text-2xl font-display text-primary">{weeklyInsights.totalHours.toFixed(1)}h</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/10 border border-secondary/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-secondary" />
                    <span className="text-xs text-muted-foreground">Days Logged</span>
                  </div>
                  <p className="text-2xl font-display text-secondary">{weeklyInsights.daysLogged}/7</p>
                </div>
                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-orange-400" />
                    <span className="text-xs text-muted-foreground">Avg Daily</span>
                  </div>
                  <p className="text-2xl font-display text-orange-400">{weeklyInsights.averageDailyHours.toFixed(1)}h</p>
                </div>
                <div className="p-4 rounded-lg bg-accent/10 border border-accent/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-4 h-4 text-accent" />
                    <span className="text-xs text-muted-foreground">Best Day</span>
                  </div>
                  <p className="text-2xl font-display text-accent">{weeklyInsights.bestDay}</p>
                </div>
              </div>

              {weeklyInsights.insights && weeklyInsights.insights.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-display text-primary mb-3">Insights & Recommendations</h3>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3 pr-4">
                      {weeklyInsights.insights.map((insight: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border-2 ${
                            insight.type === "success"
                              ? "bg-green-500/10 border-green-500/30"
                              : insight.type === "warning"
                              ? "bg-orange-500/10 border-orange-500/30"
                              : "bg-blue-500/10 border-blue-500/30"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{insight.icon}</span>
                            <div className="flex-1">
                              <h4 className="font-display text-primary mb-1">{insight.title}</h4>
                              <p className="text-sm text-muted-foreground">{insight.message}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </Card>
          )}

          {/* Project Analytics */}
          {projects.length > 0 && (
            <Card className="glow-card p-6 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <FolderOpen className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-display text-primary">Project Analytics</h2>
                </div>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="w-full sm:w-[250px]">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: project.color }}
                          />
                          {project.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {projectLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-pulse text-primary text-lg font-display">Loading analytics...</div>
                </div>
              ) : projectAnalytics ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-4 bg-primary/10 border-primary/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <span className="text-xs text-muted-foreground">Total Hours</span>
                      </div>
                      <p className="text-2xl font-display text-primary">{projectAnalytics.totalHours.toFixed(1)}h</p>
                    </Card>
                    <Card className="p-4 bg-green-500/10 border-green-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-muted-foreground">Completed Tasks</span>
                      </div>
                      <p className="text-2xl font-display text-green-400">{projectAnalytics.completedTasks}</p>
                    </Card>
                    <Card className="p-4 bg-blue-500/10 border-blue-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-muted-foreground">Total Tasks</span>
                      </div>
                      <p className="text-2xl font-display text-blue-400">{projectAnalytics.totalTasks}</p>
                    </Card>
                    <Card className="p-4 bg-orange-500/10 border-orange-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy className="w-4 h-4 text-orange-400" />
                        <span className="text-xs text-muted-foreground">Completion Rate</span>
                      </div>
                      <p className="text-2xl font-display text-orange-400">{projectAnalytics.completionRate.toFixed(0)}%</p>
                    </Card>
                  </div>

                  {/* Charts */}
                  <Tabs defaultValue="weekly" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="weekly">Weekly View</TabsTrigger>
                      <TabsTrigger value="monthly">Monthly View</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="weekly" className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Weekly Hours Chart */}
                    <Card className="p-6">
                      <h3 className="text-lg font-display text-primary mb-4">Weekly Hours Worked</h3>
                      <ChartContainer
                        config={{
                          hours: {
                            label: "Hours",
                            color: projectAnalytics.project?.color || "#3b82f6",
                          },
                        }}
                        className="h-[300px]"
                      >
                        <LineChart data={projectAnalytics.weeklyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="week"
                            tick={{ fill: "hsl(var(--muted-foreground))" }}
                            tickLine={{ stroke: "hsl(var(--border))" }}
                          />
                          <YAxis
                            tick={{ fill: "hsl(var(--muted-foreground))" }}
                            tickLine={{ stroke: "hsl(var(--border))" }}
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line
                            type="monotone"
                            dataKey="hours"
                            stroke={projectAnalytics.project?.color || "#3b82f6"}
                            strokeWidth={2}
                            dot={{ fill: projectAnalytics.project?.color || "#3b82f6", r: 4 }}
                          />
                        </LineChart>
                      </ChartContainer>
                    </Card>

                    {/* Monthly Hours Chart */}
                    <Card className="p-6">
                      <h3 className="text-lg font-display text-primary mb-4">Monthly Hours Worked</h3>
                      <ChartContainer
                        config={{
                          hours: {
                            label: "Hours",
                            color: projectAnalytics.project?.color || "#3b82f6",
                          },
                        }}
                        className="h-[300px]"
                      >
                        <BarChart data={projectAnalytics.monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="month"
                            tick={{ fill: "hsl(var(--muted-foreground))" }}
                            tickLine={{ stroke: "hsl(var(--border))" }}
                          />
                          <YAxis
                            tick={{ fill: "hsl(var(--muted-foreground))" }}
                            tickLine={{ stroke: "hsl(var(--border))" }}
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar
                            dataKey="hours"
                            fill={projectAnalytics.project?.color || "#3b82f6"}
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ChartContainer>
                    </Card>

                    {/* Tasks Accomplished Over Time */}
                    <Card className="p-6">
                      <h3 className="text-lg font-display text-primary mb-4">Tasks Accomplished (Weekly)</h3>
                      <ChartContainer
                        config={{
                          tasks: {
                            label: "Completed Tasks",
                            color: "#10b981",
                          },
                          totalTasks: {
                            label: "Total Tasks",
                            color: "#6b7280",
                          },
                        }}
                        className="h-[300px]"
                      >
                        <BarChart data={projectAnalytics.weeklyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="week"
                            tick={{ fill: "hsl(var(--muted-foreground))" }}
                            tickLine={{ stroke: "hsl(var(--border))" }}
                          />
                          <YAxis
                            tick={{ fill: "hsl(var(--muted-foreground))" }}
                            tickLine={{ stroke: "hsl(var(--border))" }}
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Bar dataKey="tasks" fill="#10b981" radius={[4, 4, 0, 0]} name="tasks" />
                          <Bar dataKey="totalTasks" fill="#6b7280" radius={[4, 4, 0, 0]} name="totalTasks" />
                        </BarChart>
                      </ChartContainer>
                    </Card>

                      </div>
                    </TabsContent>

                    <TabsContent value="monthly" className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Monthly Hours Chart */}
                        <Card className="p-6">
                          <h3 className="text-lg font-display text-primary mb-4">Monthly Hours Trend</h3>
                          <ChartContainer
                            config={{
                              hours: {
                                label: "Hours",
                                color: projectAnalytics.project?.color || "#3b82f6",
                              },
                            }}
                            className="h-[300px]"
                          >
                            <LineChart data={projectAnalytics.monthlyData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis
                                dataKey="month"
                                tick={{ fill: "hsl(var(--muted-foreground))" }}
                                tickLine={{ stroke: "hsl(var(--border))" }}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                              />
                              <YAxis
                                tick={{ fill: "hsl(var(--muted-foreground))" }}
                                tickLine={{ stroke: "hsl(var(--border))" }}
                              />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Line
                                type="monotone"
                                dataKey="hours"
                                stroke={projectAnalytics.project?.color || "#3b82f6"}
                                strokeWidth={2}
                                dot={{ fill: projectAnalytics.project?.color || "#3b82f6", r: 4 }}
                              />
                            </LineChart>
                          </ChartContainer>
                        </Card>

                        {/* Monthly Tasks Chart */}
                        <Card className="p-6">
                          <h3 className="text-lg font-display text-primary mb-4">Tasks Accomplished (Monthly)</h3>
                          <ChartContainer
                            config={{
                              tasks: {
                                label: "Completed Tasks",
                                color: "#10b981",
                              },
                              totalTasks: {
                                label: "Total Tasks",
                                color: "#6b7280",
                              },
                            }}
                            className="h-[300px]"
                          >
                            <BarChart data={projectAnalytics.monthlyData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis
                                dataKey="month"
                                tick={{ fill: "hsl(var(--muted-foreground))" }}
                                tickLine={{ stroke: "hsl(var(--border))" }}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                              />
                              <YAxis
                                tick={{ fill: "hsl(var(--muted-foreground))" }}
                                tickLine={{ stroke: "hsl(var(--border))" }}
                              />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <ChartLegend content={<ChartLegendContent />} />
                              <Bar dataKey="tasks" fill="#10b981" radius={[4, 4, 0, 0]} name="tasks" />
                              <Bar dataKey="totalTasks" fill="#6b7280" radius={[4, 4, 0, 0]} name="totalTasks" />
                            </BarChart>
                          </ChartContainer>
                        </Card>
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Hourly Breakdown by Day */}
                  <Card className="p-6">
                    <h3 className="text-lg font-display text-primary mb-4">Hours by Day of Week</h3>
                    <ChartContainer
                      config={{
                        hours: {
                          label: "Hours",
                          color: projectAnalytics.project?.color || "#3b82f6",
                        },
                      }}
                      className="h-[300px]"
                    >
                      <BarChart data={projectAnalytics.hourlyBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="day"
                          tick={{ fill: "hsl(var(--muted-foreground))" }}
                          tickLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <YAxis
                          tick={{ fill: "hsl(var(--muted-foreground))" }}
                          tickLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar
                          dataKey="hours"
                          fill={projectAnalytics.project?.color || "#3b82f6"}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ChartContainer>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Select a project to view analytics
                </div>
              )}
            </Card>
          )}

          {/* Comparison Chart */}
          {friendsStats.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Rankings */}
              <Card className="glow-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <BarChart3 className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-display text-primary">Rankings</h2>
                </div>
                <div className="space-y-4">
                  {[myStats, ...sortedFriends.map(c => c.user)]
                    .filter(Boolean)
                    .map((person, index) => {
                      const isMe = person?.id === user?.id;
                      const value = person ? getTimeValue(person, timeframe) : 0;
                      const rank = index + 1;
                      
                      return (
                        <div
                          key={person?.id}
                          className={`p-4 rounded-lg border-2 ${
                            isMe
                              ? "bg-primary/10 border-primary"
                              : "bg-muted/20 border-primary/20"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display ${
                                rank === 1 ? "bg-yellow-500/20 text-yellow-400" :
                                rank === 2 ? "bg-gray-400/20 text-gray-400" :
                                rank === 3 ? "bg-orange-500/20 text-orange-400" :
                                "bg-muted text-muted-foreground"
                              }`}>
                                {rank}
                              </div>
                              <div className="flex-1">
                                <p className={`font-display ${isMe ? "text-primary" : "text-foreground"} ${!isMe ? "hover:text-primary cursor-pointer" : ""}`}>
                                  {person?.username}
                                  {isMe && <span className="text-xs ml-2 text-primary">(You)</span>}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {value.toFixed(1)} hours
                                </p>
                              </div>
                              {!isMe && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/profile/${person?.id}`);
                                  }}
                                  className="text-muted-foreground hover:text-primary"
                                >
                                  <User className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                            {rank <= 3 && (
                              <Trophy className={`w-5 h-5 ${
                                rank === 1 ? "text-yellow-400" :
                                rank === 2 ? "text-gray-400" :
                                "text-orange-400"
                              }`} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </Card>

              {/* Comparisons */}
              <Card className="glow-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-display text-primary">Comparisons</h2>
                </div>
                <div className="space-y-4">
                  {timeComparisons.map((comparison) => {
                    const friendValue = getTimeValue(comparison.user, timeframe);
                    const myValue = myTimeValue;
                    const isHigher = comparison.comparison === 'higher';
                    const maxValue = Math.max(myValue, friendValue);
                    const myPercentage = maxValue > 0 ? (myValue / maxValue) * 100 : 0;
                    const friendPercentage = maxValue > 0 ? (friendValue / maxValue) * 100 : 0;

                    return (
                      <div key={comparison.user.id} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <p className="font-display text-sm hover:text-primary cursor-pointer" onClick={() => navigate(`/profile/${comparison.user.id}`)}>
                              {comparison.user.username}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/profile/${comparison.user.id}`)}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                            >
                              <User className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className={`flex items-center gap-1 text-xs ${
                            isHigher ? "text-green-400" : "text-red-400"
                          }`}>
                            {isHigher ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {comparison.percentage.toFixed(0)}%
                            {isHigher ? " ahead" : " behind"}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-16">You:</span>
                            <div className="flex-1 bg-muted/30 rounded-full h-4 overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${myPercentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-primary font-display w-12 text-right">
                              {myValue.toFixed(1)}h
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-16">
                              {comparison.user.username}:
                            </span>
                            <div className="flex-1 bg-muted/30 rounded-full h-4 overflow-hidden">
                              <div
                                className="h-full bg-secondary rounded-full transition-all"
                                style={{ width: `${friendPercentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-secondary font-display w-12 text-right">
                              {friendValue.toFixed(1)}h
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          ) : (
            <Card className="glow-card p-8 text-center">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-display text-primary mb-2">No Friends Yet</h3>
              <p className="text-muted-foreground mb-4">
                Add friends to compare your progress and see who's leading!
              </p>
              <button
                onClick={() => navigate("/friends")}
                className="text-primary hover:text-primary/80 underline"
              >
                Go to Friends
              </button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;

