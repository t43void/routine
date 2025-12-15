import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle, Megaphone, Users, Trophy, Flame, Mail, AtSign } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
  from_user_id: string | null;
}

const Notifications = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch notifications
      const { data: notificationsData, error: notificationsError } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (notificationsError) throw notificationsError;

      // Fetch active announcements to filter out expired announcement notifications
      const { data: activeAnnouncements, error: announcementsError } = await supabase
        .from("system_announcements")
        .select("id, title, expires_at, is_active")
        .eq("is_active", true)
        .or("expires_at.is.null,expires_at.gt.now()");

      // If there's an error fetching announcements, log it but continue
      if (announcementsError) {
        console.error("Error fetching announcements:", announcementsError);
      }

      // Filter out announcement notifications that don't have an active announcement
      // We match by title (removing the 📢 emoji prefix) since notifications don't store announcement ID
      const activeAnnouncementTitles = new Set(
        (activeAnnouncements || []).map(a => a.title.toLowerCase().trim())
      );

      const filteredNotifications = (notificationsData || []).filter((notification) => {
        // If it's not an announcement notification, keep it
        if (notification.notification_type !== "announcement") {
          return true;
        }

        // For announcement notifications, check if there's an active announcement with matching title
        const notificationTitle = notification.title.replace(/^📢\s*/, "").toLowerCase().trim();
        return activeAnnouncementTitles.has(notificationTitle);
      });

      setNotifications(filteredNotifications);
      setUnreadCount(filteredNotifications.filter((n) => !n.read).length);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch notifications",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Set up periodic refresh to check for expired announcements (every 30 seconds)
      const refreshInterval = setInterval(() => {
        fetchNotifications();
      }, 30000);

      // Set up real-time subscription for announcements
      const announcementsSubscription = supabase
        .channel("system_announcements_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "system_announcements",
          },
          () => {
            // Refresh notifications when announcements change
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        clearInterval(refreshInterval);
        announcementsSubscription.unsubscribe();
      };
    }
  }, [user, fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to mark as read",
        variant: "destructive",
      });
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate to chat if it's a mention or has from_user_id
    if (notification.notification_type === "mention") {
      // Extract group name from message (format: "Someone mentioned you in GroupName")
      const groupNameMatch = notification.message?.match(/mentioned you in (.+)$/);
      if (groupNameMatch && groupNameMatch[1]) {
        const groupName = groupNameMatch[1].trim();
        // Find the group by name
        const { data: groups } = await supabase
          .from("groups")
          .select("id")
          .eq("name", groupName)
          .limit(1);
        
        if (groups && groups.length > 0) {
          navigate(`/chat/group/${groups[0].id}`);
          return;
        }
      }
    } else if (notification.from_user_id) {
      // Navigate to direct chat with the user
      navigate(`/chat/${notification.from_user_id}`);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);

      toast({
        title: "All notifications marked as read",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to mark all as read",
        variant: "destructive",
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "announcement":
      case "milestone":
        return <Megaphone className="w-5 h-5 text-primary" />;
      case "friend_request":
      case "friend_accepted":
        return <Users className="w-5 h-5 text-primary" />;
      case "streak_milestone":
        return <Flame className="w-5 h-5 text-primary" />;
      case "daily_reminder":
        return <Mail className="w-5 h-5 text-primary" />;
      case "mention":
        return <AtSign className="w-5 h-5 text-primary" />;
      default:
        return <Bell className="w-5 h-5 text-primary" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "announcement":
        return "bg-blue-500/20 border-blue-500/30";
      case "milestone":
        return "bg-green-500/20 border-green-500/30";
      case "streak_milestone":
        return "bg-orange-500/20 border-orange-500/30";
      case "daily_reminder":
        return "bg-purple-500/20 border-purple-500/30";
      default:
        return "bg-primary/20 border-primary/30";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary text-2xl font-display">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-16 md:pt-0 md:ml-[var(--sidebar-width,5rem)] p-4 sm:p-6 lg:p-8 transition-all duration-300">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-display mb-2 neon-text flex items-center gap-2 sm:gap-3">
                <Bell className="w-6 h-6 sm:w-8 sm:h-8 text-primary flex-shrink-0" />
                <span className="break-words">Notifications</span>
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up!"}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button onClick={markAllAsRead} variant="outline">
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark All Read
              </Button>
            )}
          </div>

          {notifications.length === 0 ? (
            <Card className="glow-card p-12 text-center">
              <Bell className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No notifications yet</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`glow-card p-4 sm:p-6 cursor-pointer hover:scale-[1.02] transition-all duration-300 ${
                    !notification.read ? "border-l-4 border-primary" : ""
                  } ${getNotificationColor(notification.notification_type)}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.notification_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className={`font-display text-lg ${!notification.read ? "text-primary" : "text-foreground"}`}>
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2"></div>
                        )}
                      </div>
                      {notification.message && (
                        <p className="text-sm text-foreground mb-2">{notification.message}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(notification.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;

