import { useEffect, useState } from "react";
import type React from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Users, Search, Trash2, Ban, FileText, Calendar, RotateCcw, Edit, CheckCircle, Crown, TrendingUp, Megaphone, BarChart3, UserCog, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Pagination, PaginationContent, PaginationItem, PaginationEllipsis } from "@/components/ui/pagination";

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  email?: string;
  total_logs?: number;
  total_hours?: number;
  role?: string;
  is_banned?: boolean;
  banned_at?: string;
  current_streak?: number;
  longest_streak?: number;
}

interface SystemAnnouncement {
  id: string;
  title: string;
  message: string;
  announcement_type: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

interface UserLog {
  id: string;
  log_date: string;
  hours_worked: number;
  description: string;
  created_at: string;
}

const Admin = () => {
  const { user, loading } = useAuth();
  const { isZen, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [userLogs, setUserLogs] = useState<UserLog[]>([]);
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);
  const [isResetLogsDialogOpen, setIsResetLogsDialogOpen] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editRole, setEditRole] = useState("");
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", message: "", announcement_type: "info", expires_at: "" });
  const [systemStats, setSystemStats] = useState({ totalUsers: 0, totalLogs: 0, totalHours: 0, activeUsers: 0 });
  const [isMessageCleanupDialogOpen, setIsMessageCleanupDialogOpen] = useState(false);
  const [cleanupPeriod, setCleanupPeriod] = useState("30");
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  
  // Pagination states
  const [usersPage, setUsersPage] = useState(1);
  const [announcementsPage, setAnnouncementsPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);
  const itemsPerPage = 6; // Show 6 items per page

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
    // Only redirect if we've finished loading and user is not admin
    // Add a small delay to ensure state has propagated
    if (!loading && !adminLoading) {
      // Use setTimeout to ensure state has fully updated
      const timer = setTimeout(() => {
        if (!user) {
          navigate("/auth");
          return;
        }
        if (!isZen) {
          navigate("/dashboard");
          return;
        }
      }, 100); // Small delay to ensure state propagation

      return () => clearTimeout(timer);
    }
  }, [user, loading, isZen, adminLoading, navigate]);

  useEffect(() => {
    if (isZen && user) {
      fetchUsers();
      fetchAnnouncements();
      setAnnouncementsPage(1); // Reset to first page
    }
  }, [isZen, user]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (u) =>
            u.username.toLowerCase().includes(query) ||
            u.email?.toLowerCase().includes(query) ||
            u.id.toLowerCase().includes(query)
        )
      );
    }
    // Reset to first page when search changes
    setUsersPage(1);
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    try {
      // Fetch all profiles with role and ban status
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, created_at, role, is_banned, banned_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get stats for each user
      const usersWithStats = await Promise.all(
        (profiles || []).map(async (profile) => {
          // Get total logs count
          const { count: logsCount, error: logsCountError } = await supabase
            .from("daily_logs")
            .select("*", { count: "exact", head: true })
            .eq("user_id", profile.id);

          if (logsCountError) {
            console.error('Error fetching logs count:', {
              userId: profile.id,
              error: logsCountError,
              message: logsCountError.message,
              details: logsCountError.details,
              hint: logsCountError.hint,
              code: logsCountError.code
            });
          }

          // Get total hours
          const { data: logs, error: logsError } = await supabase
            .from("daily_logs")
            .select("hours_worked")
            .eq("user_id", profile.id);

          if (logsError) {
            console.error('Error fetching logs:', {
              userId: profile.id,
              error: logsError,
              message: logsError.message,
              details: logsError.details,
              hint: logsError.hint,
              code: logsError.code
            });
          }

          const totalHours = logs?.reduce((sum, log) => sum + Number(log.hours_worked || 0), 0) || 0;

          // Get streak info
          const { data: streak, error: streakError } = await supabase
            .from("streaks")
            .select("current_streak, longest_streak")
            .eq("user_id", profile.id)
            .eq("streak_type", "daily_log")
            .maybeSingle();

          if (streakError) {
            console.error('Error fetching streak for user:', {
              userId: profile.id,
              error: streakError,
              message: streakError.message,
              details: streakError.details,
              hint: streakError.hint,
              code: streakError.code,
              query: `streaks?select=current_streak,longest_streak&user_id=eq.${profile.id}&streak_type=eq.daily_log`
            });
          }

          return {
            ...profile,
            email: undefined,
            total_logs: logsCount || 0,
            total_hours: totalHours,
            current_streak: streak?.current_streak || 0,
            longest_streak: streak?.longest_streak || 0,
          };
        })
      );

      setUsers(usersWithStats);
      setFilteredUsers(usersWithStats);
      fetchSystemStats();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch users",
        variant: "destructive",
      });
    }
  };

  const fetchSystemStats = async () => {
    try {
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: totalLogs } = await supabase
        .from("daily_logs")
        .select("*", { count: "exact", head: true });

      const { data: allLogs } = await supabase
        .from("daily_logs")
        .select("hours_worked");

      const totalHours = allLogs?.reduce((sum, log) => sum + Number(log.hours_worked || 0), 0) || 0;

      // Active users (logged in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: activeLogs } = await supabase
        .from("daily_logs")
        .select("user_id")
        .gte("log_date", thirtyDaysAgo.toISOString().split("T")[0]);
      const activeUsers = new Set(activeLogs?.map(log => log.user_id) || []).size;

      setSystemStats({
        totalUsers: totalUsers || 0,
        totalLogs: totalLogs || 0,
        totalHours: totalHours,
        activeUsers: activeUsers,
      });
    } catch (error: any) {
      console.error("Failed to fetch system stats:", error);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from("system_announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch announcements",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      // Call the database function to delete all user-related data
      const { error: functionError } = await supabase.rpc('delete_user_completely', {
        user_id_to_delete: selectedUser.id
      });

      if (functionError) throw functionError;

      // Delete auth user via Edge Function (requires admin privileges)
      try {
        const { error: authDeleteError } = await supabase.functions.invoke('delete-user', {
          body: { user_id: selectedUser.id }
        });

        if (authDeleteError) {
          // If Edge Function fails, log but don't fail the whole operation
          console.warn('Failed to delete auth user via Edge Function:', authDeleteError);
          toast({
            title: "User data deleted",
            description: `All data for ${selectedUser.username} has been removed. Note: Auth account deletion may require manual cleanup in Supabase dashboard.`,
            variant: "default",
          });
        } else {
          toast({
            title: "User completely deleted",
            description: `User ${selectedUser.username} and all associated data have been permanently removed.`,
          });
        }
      } catch (edgeFunctionError: any) {
        // Edge Function might not exist yet, that's okay
        console.warn('Edge Function not available:', edgeFunctionError);
        toast({
          title: "User data deleted",
          description: `All data for ${selectedUser.username} has been removed. The auth account may need to be deleted manually in Supabase dashboard.`,
          variant: "default",
        });
      }

      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const handleBanUser = async () => {
    if (!selectedUser || !user) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_banned: true,
          banned_at: new Date().toISOString(),
          banned_by: user.id,
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      toast({
        title: "User banned",
        description: `${selectedUser.username} has been banned from the platform.`,
      });

      setIsBanDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to ban user",
        variant: "destructive",
      });
    }
  };

  const handleUnbanUser = async (userProfile: UserProfile) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_banned: false,
          banned_at: null,
          banned_by: null,
        })
        .eq("id", userProfile.id);

      if (error) throw error;

      toast({
        title: "User unbanned",
        description: `${userProfile.username} has been unbanned.`,
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to unban user",
        variant: "destructive",
      });
    }
  };

  const handleEditUser = (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    setEditUsername(userProfile.username);
    setEditAvatarUrl(userProfile.avatar_url || "");
    setEditRole(userProfile.role || "warrior");
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username: editUsername.trim(),
          avatar_url: editAvatarUrl.trim() || null,
          role: editRole,
        })
        .eq("id", selectedUser.id);

      if (error) {
        if (error.message.includes("duplicate") || error.message.includes("unique")) {
          toast({
            title: "Username taken",
            description: "This username is already taken. Please choose another.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "User updated",
        description: `${editUsername}'s profile has been updated.`,
      });

      setIsEditDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    }
  };

  const handleChangeRole = async (userProfile: UserProfile, newRole: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userProfile.id);

      if (error) throw error;

      toast({
        title: "Role updated",
        description: `${userProfile.username} is now a ${newRole === "zen" ? "Zen" : "Warrior"}.`,
      });

      setIsRoleDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!user) return;

    try {
      // Create the announcement
      const { data: announcement, error } = await supabase
        .from("system_announcements")
        .insert({
          title: newAnnouncement.title,
          message: newAnnouncement.message,
          announcement_type: newAnnouncement.announcement_type,
          expires_at: newAnnouncement.expires_at || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Send notification to all users automatically
      if (announcement) {
        const { data: allUsers, error: usersError } = await supabase
          .from("profiles")
          .select("id");

        if (usersError) {
          console.error("Error fetching users:", usersError);
          throw new Error(`Failed to fetch users: ${usersError.message}`);
        }

        if (allUsers && allUsers.length > 0) {
          const notifications = allUsers.map((profile) => ({
            user_id: profile.id,
            notification_type: "announcement" as const,
            title: `📢 ${newAnnouncement.title}`,
            message: newAnnouncement.message,
            read: false,
          }));

          // Insert notifications in batches (admin can insert for any user)
          const batchSize = 100;
          let totalInserted = 0;
          let totalErrors = 0;

          for (let i = 0; i < notifications.length; i += batchSize) {
            const batch = notifications.slice(i, i + batchSize);
            const { error: insertError } = await supabase.from("notifications").insert(batch);
            if (insertError) {
              console.error(`Error inserting batch ${i}:`, insertError);
              totalErrors += batch.length;
              // Continue with next batch even if one fails
            } else {
              totalInserted += batch.length;
            }
          }

          if (totalErrors > 0) {
            toast({
              title: "Warning",
              description: `Announcement created, but ${totalErrors} notifications failed to send. ${totalInserted} notifications sent successfully.`,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Announcement created",
              description: `The announcement has been posted and sent to all ${totalInserted} users as notifications! 🎉`,
            });
          }
        } else {
          toast({
            title: "Announcement created",
            description: "The announcement has been posted, but no users found to notify.",
          });
        }
      }

      // Note: Toast is now shown in the notification sending logic above
      setIsAnnouncementDialogOpen(false);
      setNewAnnouncement({ title: "", message: "", announcement_type: "info", expires_at: "" });
      fetchAnnouncements();
      setAnnouncementsPage(1); // Reset to first page
      setAnnouncementsPage(1); // Reset to first page
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create announcement",
        variant: "destructive",
      });
    }
  };

  const handleToggleAnnouncement = async (announcement: SystemAnnouncement) => {
    try {
      const { error } = await supabase
        .from("system_announcements")
        .update({ is_active: !announcement.is_active })
        .eq("id", announcement.id);

      if (error) throw error;

      toast({
        title: announcement.is_active ? "Announcement deactivated" : "Announcement activated",
        description: `The announcement has been ${announcement.is_active ? "deactivated" : "activated"}.`,
      });

      fetchAnnouncements();
      setAnnouncementsPage(1); // Reset to first page
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update announcement",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    try {
      const { error } = await supabase
        .from("system_announcements")
        .delete()
        .eq("id", announcementId);

      if (error) throw error;

      toast({
        title: "Announcement deleted",
        description: "The announcement has been removed.",
      });

      fetchAnnouncements();
      setAnnouncementsPage(1); // Reset to first page
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete announcement",
        variant: "destructive",
      });
    }
  };

  const fetchUserLogs = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", userId)
        .order("log_date", { ascending: false })
        .limit(100);

      if (error) throw error;
      setUserLogs(data || []);
      setLogsPage(1); // Reset to first page when fetching new logs
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch logs",
        variant: "destructive",
      });
    }
  };

  const handleViewLogs = (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    fetchUserLogs(userProfile.id);
    setIsLogsDialogOpen(true);
  };

  const handleDeleteLog = async (logId: string) => {
    try {
      const { error } = await supabase
        .from("daily_logs")
        .delete()
        .eq("id", logId);

      if (error) throw error;

      toast({
        title: "Log deleted",
        description: "The log has been removed.",
      });

      if (selectedUser) {
        fetchUserLogs(selectedUser.id);
        fetchUsers(); // Refresh user stats
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete log",
        variant: "destructive",
      });
    }
  };

  const handleCleanupOldMessages = async () => {
    if (!user) return;

    setIsCleaningUp(true);
    try {
      const daysOld = parseInt(cleanupPeriod);
      if (isNaN(daysOld) || daysOld < 1) {
        toast({
          title: "Invalid period",
          description: "Please enter a valid number of days (minimum 1 day).",
          variant: "destructive",
        });
        setIsCleaningUp(false);
        return;
      }

      const { data, error } = await supabase.rpc('delete_old_messages' as any, {
        days_old: daysOld
      });

      if (error) throw error;

      const deletedMessages = (data && Array.isArray(data) && data[0]) ? (data[0] as any).deleted_messages_count || 0 : 0;
      const deletedGroupMessages = (data && Array.isArray(data) && data[0]) ? (data[0] as any).deleted_group_messages_count || 0 : 0;
      const totalDeleted = deletedMessages + deletedGroupMessages;

      toast({
        title: "Messages cleaned up",
        description: `Deleted ${totalDeleted} messages (${deletedMessages} individual, ${deletedGroupMessages} group messages) older than ${daysOld} days.`,
      });

      setIsMessageCleanupDialogOpen(false);
      setCleanupPeriod("30");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to cleanup old messages",
        variant: "destructive",
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleResetUserLogs = async () => {
    if (!selectedUser) return;

    try {
      // Delete all logs (this must be first to avoid triggers re-awarding badges)
      const { error: logsError } = await supabase
        .from("daily_logs")
        .delete()
        .eq("user_id", selectedUser.id);

      if (logsError) throw logsError;

      // Delete all achievements (to prevent achievement badge triggers from re-awarding)
      const { error: achievementsError } = await supabase
        .from("achievements")
        .delete()
        .eq("user_id", selectedUser.id);

      if (achievementsError) throw achievementsError;

      // Delete all badges (since they're based on hours/logs/achievements)
      const { error: badgesError } = await supabase
        .from("badges")
        .delete()
        .eq("user_id", selectedUser.id);

      if (badgesError) throw badgesError;

      // Reset streaks
      const { error: resetStreakError } = await supabase
        .from("streaks")
        .update({
          current_streak: 0,
          longest_streak: 0,
          last_activity_date: null,
        })
        .eq("user_id", selectedUser.id);

      if (resetStreakError) {
        console.error('Error resetting streak:', {
          userId: selectedUser.id,
          error: resetStreakError,
          message: resetStreakError.message,
          details: resetStreakError.details,
          hint: resetStreakError.hint,
          code: resetStreakError.code
        });
        throw resetStreakError;
      }

      toast({
        title: "All data reset",
        description: `All logs, achievements, badges, and streaks for ${selectedUser.username} have been reset.`,
      });

      setIsResetLogsDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset logs",
        variant: "destructive",
      });
    }
  };

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading Zen status...</div>
      </div>
    );
  }
  
  // Don't render anything if not Zen - useEffect will handle redirect
  // But wait a bit to ensure Zen check has completed
  if (!isZen && user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Access denied. Redirecting...</div>
      </div>
    );
  }
  
  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-16 md:pt-0 md:ml-[var(--sidebar-width,5rem)] p-4 sm:p-6 lg:p-8 transition-all duration-300">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-display mb-2 neon-text flex items-center gap-2 sm:gap-3">
                <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-primary flex-shrink-0" />
                <span className="break-words">Zen Panel</span>
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">Manage users and system settings</p>
            </div>
          </div>

          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Users</span>
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Stats</span>
              </TabsTrigger>
              <TabsTrigger value="announcements" className="flex items-center gap-2">
                <Megaphone className="w-4 h-4" />
                <span className="hidden sm:inline">Announcements</span>
              </TabsTrigger>
              <TabsTrigger value="system" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">System</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4">
              <Card className="glow-card p-4 sm:p-6 mb-4 sm:mb-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
                  <Input
                    placeholder="Search users by username, email, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-input border-primary/30 w-full"
                  />
                </div>
              </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredUsers
              .slice((usersPage - 1) * itemsPerPage, usersPage * itemsPerPage)
              .map((userProfile) => (
              <Card key={userProfile.id} className="glow-card p-4 sm:p-6 hover:scale-105 transition-all duration-300">
                <div className="flex items-start justify-between mb-4 gap-3">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    {userProfile.avatar_url ? (
                      <img
                        src={userProfile.avatar_url}
                        alt={userProfile.username}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-display text-primary truncate">{userProfile.username}</h3>
                      {userProfile.email && (
                        <p className="text-xs text-muted-foreground truncate">{userProfile.email}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Member since</span>
                    <span className="text-foreground text-right">
                      {format(new Date(userProfile.created_at), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Total logs</span>
                    <span className="text-foreground">{userProfile.total_logs || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Total hours</span>
                    <span className="text-foreground">{userProfile.total_hours?.toFixed(1) || "0.0"}h</span>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {userProfile.role === "zen" && (
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <Crown className="w-3 h-3" />
                      <span>Zen</span>
                    </div>
                  )}
                  {userProfile.is_banned && (
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <Ban className="w-3 h-3" />
                      <span>Banned</span>
                    </div>
                  )}
                  {userProfile.current_streak && userProfile.current_streak > 0 && (
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-muted-foreground">Current streak</span>
                      <span className="text-foreground">🔥 {userProfile.current_streak} days</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewLogs(userProfile)}
                    className="w-full text-xs sm:text-sm"
                  >
                    <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    View Logs
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditUser(userProfile)}
                      className="text-xs"
                    >
                      <Edit className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(userProfile);
                        setIsRoleDialogOpen(true);
                      }}
                      className="text-xs"
                    >
                      <UserCog className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Role</span>
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(userProfile);
                        setIsResetLogsDialogOpen(true);
                      }}
                      className="text-xs"
                    >
                      <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Reset</span>
                    </Button>
                    {userProfile.is_banned ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnbanUser(userProfile)}
                        className="text-xs text-green-600 hover:text-green-700"
                      >
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                        <span className="hidden sm:inline">Unban</span>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(userProfile);
                          setIsBanDialogOpen(true);
                        }}
                        className="text-xs"
                      >
                        <Ban className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                        <span className="hidden sm:inline">Ban</span>
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(userProfile);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="text-xs"
                    >
                      <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <Card className="glow-card p-12 text-center">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">
                {searchQuery ? "No users found matching your search" : "No users found"}
              </p>
            </Card>
          )}

          {filteredUsers.length > itemsPerPage && (
            <div className="mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                      disabled={usersPage === 1}
                      className="h-9 w-9"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </PaginationItem>
                  {(() => {
                    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
                    const visiblePages = getVisiblePages(usersPage, totalPages);
                    const pages: React.ReactNode[] = [];
                    
                    if (visiblePages[0] > 1) {
                      pages.push(
                        <PaginationItem key={1}>
                          <Button
                            variant={usersPage === 1 ? "outline" : "ghost"}
                            size="icon"
                            onClick={() => setUsersPage(1)}
                            className="h-9 w-9"
                          >
                            1
                          </Button>
                        </PaginationItem>
                      );
                      if (visiblePages[0] > 2) {
                        pages.push(<PaginationItem key="ellipsis-start"><PaginationEllipsis /></PaginationItem>);
                      }
                    }
                    
                    visiblePages.forEach((page) => {
                      pages.push(
                        <PaginationItem key={page}>
                          <Button
                            variant={usersPage === page ? "outline" : "ghost"}
                            size="icon"
                            onClick={() => setUsersPage(page)}
                            className="h-9 w-9"
                          >
                            {page}
                          </Button>
                        </PaginationItem>
                      );
                    });
                    
                    if (visiblePages[visiblePages.length - 1] < totalPages) {
                      if (visiblePages[visiblePages.length - 1] < totalPages - 1) {
                        pages.push(<PaginationItem key="ellipsis-end"><PaginationEllipsis /></PaginationItem>);
                      }
                      pages.push(
                        <PaginationItem key={totalPages}>
                          <Button
                            variant={usersPage === totalPages ? "outline" : "ghost"}
                            size="icon"
                            onClick={() => setUsersPage(totalPages)}
                            className="h-9 w-9"
                          >
                            {totalPages}
                          </Button>
                        </PaginationItem>
                      );
                    }
                    
                    return pages;
                  })()}
                  <PaginationItem>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setUsersPage(p => Math.min(Math.ceil(filteredUsers.length / itemsPerPage), p + 1))}
                      disabled={usersPage >= Math.ceil(filteredUsers.length / itemsPerPage)}
                      className="h-9 w-9"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
            </TabsContent>

            <TabsContent value="stats" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="glow-card p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Users</p>
                      <p className="text-2xl font-display text-primary mt-1">{systemStats.totalUsers}</p>
                    </div>
                    <Users className="w-8 h-8 text-primary opacity-50" />
                  </div>
                </Card>
                <Card className="glow-card p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Users (30d)</p>
                      <p className="text-2xl font-display text-primary mt-1">{systemStats.activeUsers}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-primary opacity-50" />
                  </div>
                </Card>
                <Card className="glow-card p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Logs</p>
                      <p className="text-2xl font-display text-primary mt-1">{systemStats.totalLogs}</p>
                    </div>
                    <FileText className="w-8 h-8 text-primary opacity-50" />
                  </div>
                </Card>
                <Card className="glow-card p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Hours</p>
                      <p className="text-2xl font-display text-primary mt-1">{systemStats.totalHours.toFixed(0)}h</p>
                    </div>
                    <Calendar className="w-8 h-8 text-primary opacity-50" />
                  </div>
                </Card>
              </div>

              <Card className="glow-card p-6">
                <h2 className="text-xl font-display text-primary mb-4">Top Performers</h2>
                <div className="space-y-3">
                  {[...users]
                    .sort((a, b) => (b.total_hours || 0) - (a.total_hours || 0))
                    .slice(0, 10)
                    .map((user, index) => (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-card/50">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-display text-primary w-6">#{index + 1}</span>
                          <span className="font-medium">{user.username}</span>
                          {user.role === "zen" && <Crown className="w-4 h-4 text-primary" />}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">{user.total_logs || 0} logs</span>
                          <span className="text-primary font-medium">{user.total_hours?.toFixed(1) || "0.0"}h</span>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="announcements" className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-display text-primary">System Announcements</h2>
                <Button onClick={() => setIsAnnouncementDialogOpen(true)}>
                  <Megaphone className="w-4 h-4 mr-2" />
                  New Announcement
                </Button>
              </div>

              <div className="space-y-4">
                {announcements.length === 0 ? (
                  <Card className="glow-card p-12 text-center">
                    <Megaphone className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No announcements yet</p>
                  </Card>
                ) : (
                  <>
                    {announcements
                      .slice((announcementsPage - 1) * itemsPerPage, announcementsPage * itemsPerPage)
                      .map((announcement) => (
                    <Card key={announcement.id} className="glow-card p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-display text-primary">{announcement.title}</h3>
                            <span className={`text-xs px-2 py-1 rounded ${
                              announcement.announcement_type === "info" ? "bg-blue-500/20 text-blue-400" :
                              announcement.announcement_type === "warning" ? "bg-yellow-500/20 text-yellow-400" :
                              announcement.announcement_type === "success" ? "bg-green-500/20 text-green-400" :
                              "bg-red-500/20 text-red-400"
                            }`}>
                              {announcement.announcement_type}
                            </span>
                            {announcement.is_active ? (
                              <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">Active</span>
                            ) : (
                              <span className="text-xs px-2 py-1 rounded bg-gray-500/20 text-gray-400">Inactive</span>
                            )}
                          </div>
                          <p className="text-sm text-foreground mb-2">{announcement.message}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Created: {format(new Date(announcement.created_at), "MMM d, yyyy")}</span>
                            {announcement.expires_at && (
                              <span>Expires: {format(new Date(announcement.expires_at), "MMM d, yyyy")}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleAnnouncement(announcement)}
                          >
                            {announcement.is_active ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteAnnouncement(announcement.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                    {announcements.length > itemsPerPage && (
                      <div className="mt-6">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setAnnouncementsPage(p => Math.max(1, p - 1))}
                                disabled={announcementsPage === 1}
                                className="h-9 w-9"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                            </PaginationItem>
                            {getVisiblePages(announcementsPage, Math.ceil(announcements.length / itemsPerPage)).map((page) => (
                              <PaginationItem key={page}>
                                <Button
                                  variant={announcementsPage === page ? "outline" : "ghost"}
                                  size="icon"
                                  onClick={() => setAnnouncementsPage(page)}
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
                                onClick={() => setAnnouncementsPage(p => Math.min(Math.ceil(announcements.length / itemsPerPage), p + 1))}
                                disabled={announcementsPage >= Math.ceil(announcements.length / itemsPerPage)}
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
                )}
              </div>
            </TabsContent>

            <TabsContent value="system" className="space-y-4">
              <Card className="glow-card p-6">
                <h2 className="text-xl font-display text-primary mb-4">System Information</h2>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Platform Status</Label>
                    <p className="text-foreground mt-1">All systems operational</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Database</Label>
                    <p className="text-foreground mt-1">Supabase (PostgreSQL)</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Zen Features</Label>
                    <p className="text-foreground mt-1">User management, announcements, analytics, role management</p>
                  </div>
                </div>
              </Card>

              <Card className="glow-card p-6">
                <h2 className="text-xl font-display text-primary mb-4">Message Cleanup</h2>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Cleanup Old Messages</Label>
                    <p className="text-foreground mt-1 text-sm">
                      Delete all messages (individual and group) older than a specified period. This action cannot be undone.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setIsMessageCleanupDialogOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Cleanup Old Messages
                  </Button>
                </div>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Edit User Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary">Edit User</DialogTitle>
                <DialogDescription>
                  Update user information and settings
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-username">Username</Label>
                  <Input
                    id="edit-username"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-avatar">Avatar URL</Label>
                  <Input
                    id="edit-avatar"
                    value={editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-role">Role</Label>
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warrior">Warrior (User)</SelectItem>
                      <SelectItem value="zen">Zen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setSelectedUser(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveEdit} className="flex-1">
                    <Edit className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Role Management Dialog */}
          <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary">Change User Role</DialogTitle>
                <DialogDescription>
                  Modify the role and permissions for this user
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-foreground">
                  Change role for <strong>{selectedUser?.username}</strong>
                </p>
                <div className="flex gap-2">
                  <Button
                    variant={selectedUser?.role === "warrior" ? "default" : "outline"}
                    onClick={() => selectedUser && handleChangeRole(selectedUser, "warrior")}
                    className="flex-1"
                  >
                    Warrior (User)
                  </Button>
                  <Button
                    variant={selectedUser?.role === "zen" ? "default" : "outline"}
                    onClick={() => selectedUser && handleChangeRole(selectedUser, "zen")}
                    className="flex-1"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Zen
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsRoleDialogOpen(false);
                    setSelectedUser(null);
                  }}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Create Announcement Dialog */}
          <Dialog open={isAnnouncementDialogOpen} onOpenChange={setIsAnnouncementDialogOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary">Create Announcement</DialogTitle>
                <DialogDescription>
                  Create a new system announcement for all users
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="announcement-title">Title</Label>
                  <Input
                    id="announcement-title"
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="announcement-message">Message</Label>
                  <Textarea
                    id="announcement-message"
                    value={newAnnouncement.message}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                    className="mt-1"
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="announcement-type">Type</Label>
                  <Select
                    value={newAnnouncement.announcement_type}
                    onValueChange={(value) => setNewAnnouncement({ ...newAnnouncement, announcement_type: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="announcement-expires">Expires At (optional)</Label>
                  <Input
                    id="announcement-expires"
                    type="datetime-local"
                    value={newAnnouncement.expires_at}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, expires_at: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAnnouncementDialogOpen(false);
                      setNewAnnouncement({ title: "", message: "", announcement_type: "info", expires_at: "" });
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateAnnouncement} className="flex-1">
                    <Megaphone className="w-4 h-4 mr-2" />
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete User Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary text-destructive">
                  Delete User
                </DialogTitle>
                <DialogDescription>
                  This action cannot be undone. All user data will be permanently deleted.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-foreground">
                  Are you sure you want to delete <strong>{selectedUser?.username}</strong>? This will
                  permanently delete all their data including logs, challenges, and profile. This action
                  cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDeleteDialogOpen(false);
                      setSelectedUser(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteUser}
                    className="flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete User
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* View User Logs Dialog */}
          <Dialog open={isLogsDialogOpen} onOpenChange={setIsLogsDialogOpen}>
            <DialogContent className="bg-card border-primary/30 max-w-4xl max-h-[80vh] w-[95vw] sm:w-full">
              <DialogHeader>
                <DialogTitle className="font-display text-primary text-lg sm:text-xl">
                  Logs for {selectedUser?.username}
                </DialogTitle>
                <DialogDescription>
                  View all daily activity logs for this user
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {userLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No logs found</p>
                ) : (
                  <>
                    <ScrollArea className="h-[60vh]">
                      <div className="space-y-2 pr-4">
                    {userLogs
                      .slice((logsPage - 1) * itemsPerPage, logsPage * itemsPerPage)
                      .map((log) => (
                      <Card key={log.id} className="p-3 sm:p-4">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-display text-primary text-sm sm:text-base">
                                {format(new Date(log.log_date), "MMM d, yyyy")}
                              </span>
                              <span className="text-muted-foreground text-sm">
                                {log.hours_worked}h
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-foreground break-words">{log.description}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteLog(log.id)}
                            className="text-destructive hover:text-destructive flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                      </div>
                    </ScrollArea>
                    {userLogs.length > itemsPerPage && (
                      <div className="mt-4 pt-4 border-t border-primary/20 pr-4">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                                disabled={logsPage === 1}
                                className="h-9 w-9"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                            </PaginationItem>
                            {getVisiblePages(logsPage, Math.ceil(userLogs.length / itemsPerPage)).map((page) => (
                              <PaginationItem key={page}>
                                <Button
                                  variant={logsPage === page ? "outline" : "ghost"}
                                  size="icon"
                                  onClick={() => setLogsPage(page)}
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
                                onClick={() => setLogsPage(p => Math.min(Math.ceil(userLogs.length / itemsPerPage), p + 1))}
                                disabled={logsPage >= Math.ceil(userLogs.length / itemsPerPage)}
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
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Reset User Logs Dialog */}
          <Dialog open={isResetLogsDialogOpen} onOpenChange={setIsResetLogsDialogOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary text-destructive">
                  Reset All User Data
                </DialogTitle>
                <DialogDescription>
                  This will permanently delete all logs, achievements, badges, and streaks for this user.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-foreground">
                  Are you sure you want to reset all data for <strong>{selectedUser?.username}</strong>? 
                  This will permanently delete all their activity logs, achievements, badges, and reset their streak counters. This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsResetLogsDialogOpen(false);
                      setSelectedUser(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleResetUserLogs}
                    className="flex-1"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset All
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Ban User Dialog */}
          <Dialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary">Ban User</DialogTitle>
                <DialogDescription>
                  Ban or unban this user from accessing the platform
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-foreground">
                  Are you sure you want to ban <strong>{selectedUser?.username}</strong>? They will
                  not be able to access the platform.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsBanDialogOpen(false);
                      setSelectedUser(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleBanUser}
                    className="flex-1"
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Ban User
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Message Cleanup Dialog */}
          <Dialog open={isMessageCleanupDialogOpen} onOpenChange={setIsMessageCleanupDialogOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary text-destructive">
                  Cleanup Old Messages
                </DialogTitle>
                <DialogDescription>
                  Delete messages older than the specified time period
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-foreground">
                  This will permanently delete all messages (individual and group) older than the specified period. This action cannot be undone.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="cleanup-period">Delete messages older than (days):</Label>
                  <Select value={cleanupPeriod} onValueChange={setCleanupPeriod}>
                    <SelectTrigger id="cleanup-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days (1 week)</SelectItem>
                      <SelectItem value="30">30 days (1 month)</SelectItem>
                      <SelectItem value="60">60 days (2 months)</SelectItem>
                      <SelectItem value="90">90 days (3 months)</SelectItem>
                      <SelectItem value="180">180 days (6 months)</SelectItem>
                      <SelectItem value="365">365 days (1 year)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsMessageCleanupDialogOpen(false);
                      setCleanupPeriod("30");
                    }}
                    className="flex-1"
                    disabled={isCleaningUp}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCleanupOldMessages}
                    className="flex-1"
                    disabled={isCleaningUp}
                  >
                    {isCleaningUp ? (
                      <>
                        <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                        Cleaning up...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Messages
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default Admin;

