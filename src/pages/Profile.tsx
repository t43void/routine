import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import BadgeDisplay from "@/components/BadgeDisplay";
import ContributionGraph from "@/components/ContributionGraph";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowLeft, User } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { validateText, MAX_LENGTHS } from "@/utils/validation";

interface Achievement {
  id: string;
  title: string;
  description: string | null;
  achieved_at: string;
}

type BadgeType = "bronze" | "silver" | "gold" | "samurai" | "warrior" | "early_bird" | "night_owl" | "marathoner" | "sprinter" | "streak_master" | "first_achievement" | "achievement_collector" | "dedicated" | "unstoppable";

interface Badge {
  badge_type: BadgeType;
}

const Profile = () => {
  const { user, loading } = useAuth();
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [totalHours, setTotalHours] = useState(0);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileBio, setProfileBio] = useState<string | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [isViewingFriend, setIsViewingFriend] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editBio, setEditBio] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    
    // Determine which user's profile to show
    const targetUserId = userId || user.id;
    setProfileUserId(targetUserId);
    setIsViewingFriend(targetUserId !== user.id);
    
    fetchProfile(targetUserId);
  }, [user, userId]);

  const fetchProfile = async (targetUserId: string) => {
    if (!targetUserId) return;

    // Fetch profile info
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, bio")
      .eq("id", targetUserId)
      .single();

    if (!profile) {
      toast({
        title: "Error",
        description: "Profile not found",
        variant: "destructive",
      });
      navigate("/profile");
      return;
    }

    setProfileUsername(profile.username);
    setProfileAvatarUrl(profile.avatar_url);
    setProfileBio(profile.bio);
    setEditBio(profile.bio || "");

    // Fetch achievements
    const { data: achievementsData } = await supabase
      .from("achievements")
      .select("*")
      .eq("user_id", targetUserId)
      .order("achieved_at", { ascending: false });

    setAchievements(achievementsData || []);

    // Fetch badges
    const { data: badgesData } = await supabase
      .from("badges")
      .select("badge_type")
      .eq("user_id", targetUserId);

    setBadges((badgesData as Badge[]) || []);

    // Fetch total hours and streak
    // Use secure function when viewing someone else's profile, direct query for own profile
    if (isViewingFriend) {
      // Use secure function for friends' profiles
      const { data: statsArray, error } = await supabase
        .rpc('get_user_public_stats', { p_user_id: targetUserId });

      if (error) {
        console.error('Error calling get_user_public_stats:', {
          error,
          userId: targetUserId,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      }

      if (statsArray && statsArray.length > 0) {
        const stats = statsArray[0];
        setTotalHours(Number(stats.total_hours || 0));
        setCurrentStreak(stats.current_streak || 0);
        setLongestStreak(stats.longest_streak || 0);
      }
    } else {
      // Own profile - can access directly
    const { data: logs } = await supabase
      .from("daily_logs")
      .select("hours_worked")
      .eq("user_id", targetUserId);

    const total = logs?.reduce((sum, log) => sum + Number(log.hours_worked), 0) || 0;
    setTotalHours(total);

    // Fetch streak
    const { data: streak } = await supabase
      .from("streaks")
      .select("current_streak, longest_streak")
      .eq("user_id", targetUserId)
      .eq("streak_type", "daily_log")
      .maybeSingle();

    setCurrentStreak(streak?.current_streak || 0);
    setLongestStreak(streak?.longest_streak || 0);
    }
  };

  const handleAddAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isViewingFriend) return;

    // Validate title
    const titleValidation = validateText(newTitle, "Title", MAX_LENGTHS.TITLE, true);
    if (!titleValidation.valid || titleValidation.value === null) {
      toast({
        title: "Invalid input",
        description: titleValidation.error || "Please enter a valid title.",
        variant: "destructive",
      });
      return;
    }

    // Validate description
    const descriptionValidation = validateText(newDescription, "Description", MAX_LENGTHS.DESCRIPTION, false);
    if (!descriptionValidation.valid) {
      toast({
        title: "Invalid input",
        description: descriptionValidation.error || "Please enter a valid description.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("achievements").insert({
        user_id: user.id,
        title: titleValidation.value,
        description: descriptionValidation.value || null,
      });

      if (error) {
        toast({
          title: "Error",
          description: "Unable to add achievement. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success!",
          description: "Achievement added",
        });
        setIsDialogOpen(false);
        setNewTitle("");
        setNewDescription("");
        if (profileUserId) fetchProfile(profileUserId);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAchievement = async (id: string) => {
    if (isViewingFriend) return;
    const { error } = await supabase.from("achievements").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success!",
        description: "Achievement deleted",
      });
      if (profileUserId) fetchProfile(profileUserId);
    }
  };

  const hourBadges: BadgeType[] = ["bronze", "silver", "gold", "samurai", "warrior"];
  const achievementBadges: BadgeType[] = ["early_bird", "night_owl", "marathoner", "sprinter", "first_achievement", "achievement_collector"];

  if (loading) return null;

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-16 md:pt-0 md:ml-[var(--sidebar-width,5rem)] p-4 sm:p-6 lg:p-8 transition-all duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            {isViewingFriend && (
              <Button
                variant="ghost"
                onClick={() => navigate("/friends")}
                className="text-muted-foreground hover:text-primary text-xs sm:text-sm"
              >
                <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                Back to Friends
              </Button>
            )}
          </div>
          {/* Profile Header with Avatar and Bio */}
          <Card className="glow-card p-6 mb-8">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex-shrink-0">
                <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-primary/30">
                  <AvatarImage src={profileAvatarUrl || undefined} alt={profileUsername} />
                  <AvatarFallback className="bg-primary/20 text-primary text-2xl sm:text-3xl font-display">
                    {profileUsername.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-display mb-2 neon-text break-words">
                      {isViewingFriend ? profileUsername : "Your Profile"}
                    </h1>
                    {isViewingFriend && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Friend Profile
                      </p>
                    )}
                  </div>
                </div>
                {isEditingBio && !isViewingFriend ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      maxLength={500}
                      className="bg-input border-primary/30 min-h-[100px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (!user) return;
                          try {
                            const { error } = await supabase
                              .from("profiles")
                              .update({ bio: editBio.trim() || null })
                              .eq("id", user.id);
                            
                            if (error) throw error;
                            
                            setProfileBio(editBio.trim() || null);
                            setIsEditingBio(false);
                            toast({
                              title: "Success!",
                              description: "Bio updated successfully",
                            });
                          } catch (error: any) {
                            toast({
                              title: "Error",
                              description: error.message || "Failed to update bio",
                              variant: "destructive",
                            });
                          }
                        }}
                        className="bg-primary hover:bg-primary/90"
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditBio(profileBio || "");
                          setIsEditingBio(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {editBio.length} / 500 characters
                    </p>
                  </div>
                ) : (
                  <div>
                    {profileBio ? (
                      <p className="text-foreground whitespace-pre-wrap">{profileBio}</p>
                    ) : (
                      <p className="text-muted-foreground italic">
                        {isViewingFriend 
                          ? "No bio yet" 
                          : "Add a bio to tell others about yourself!"}
                      </p>
                    )}
                    {!isViewingFriend && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingBio(true)}
                        className="mt-2"
                      >
                        {profileBio ? "Edit Bio" : "Add Bio"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Contribution Graph */}
          {profileUserId && (
            <div className="mb-8">
              <ContributionGraph userId={profileUserId} isViewingFriend={isViewingFriend} />
            </div>
          )}

          <Card className="glow-card p-6 mb-8 animate-slide-up">
            <h2 className="text-2xl font-display text-primary mb-4 animate-fade-in">Badges</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">Total Hours</p>
                <p className="text-2xl font-display text-primary">{totalHours.toFixed(1)}</p>
              </div>
              <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <p className="text-sm text-muted-foreground mb-1">Current Streak</p>
                <p className="text-2xl font-display text-orange-400">{currentStreak} 🔥</p>
              </div>
              <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                <p className="text-sm text-muted-foreground mb-1">Longest Streak</p>
                <p className="text-2xl font-display text-accent">{longestStreak} 🏆</p>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-display text-secondary mb-3">Hour-Based Badges</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {hourBadges.map((type) => (
                  <BadgeDisplay
                    key={type}
                    type={type}
                    earned={badges.some((b) => b.badge_type === type)}
                  />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-display text-accent mb-3">Achievement Badges</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {achievementBadges.map((type) => (
                  <BadgeDisplay
                    key={type}
                    type={type}
                    earned={badges.some((b) => b.badge_type === type)}
                  />
                ))}
              </div>
            </div>
          </Card>

          <Card className="glow-card p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-2xl font-display text-primary">Achievements</h2>
              {!isViewingFriend && (
                <Button
                  onClick={() => setIsDialogOpen(true)}
                  className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Achievement</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {achievements.length > 0 ? (
                achievements.map((achievement) => (
                  <Card key={achievement.id} className="glow-card p-4 flex justify-between items-start">
                    <div>
                      <h3 className="font-display text-lg text-foreground">{achievement.title}</h3>
                      {achievement.description && (
                        <p className="text-muted-foreground text-sm mt-1">{achievement.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(achievement.achieved_at).toLocaleDateString()}
                      </p>
                    </div>
                    {!isViewingFriend && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAchievement(achievement.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </Card>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No achievements yet. Add your first one!
                </p>
              )}
            </div>
          </Card>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary">Add Achievement</DialogTitle>
                <DialogDescription>
                  Add a new achievement to showcase your progress
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddAchievement} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    placeholder="e.g., Completed React Course"
                    className="bg-input border-primary/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Add details about your achievement"
                    className="bg-input border-primary/30"
                  />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
                  Add Achievement
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default Profile;
