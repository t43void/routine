import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, Trophy, Users, Plus, Flame, Zap, Calendar, Edit, Trash2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, addDays } from "date-fns";

interface Challenge {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  challenge_type: string;
  target_value: number | null;
  start_date: string;
  end_date: string;
  status: string;
  participants: number;
  my_progress: number;
  creator_username: string;
}

const Challenges = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeDescription, setChallengeDescription] = useState("");
  const [challengeType, setChallengeType] = useState("weekly_hours");
  const [targetValue, setTargetValue] = useState("");
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchChallenges();
    }
  }, [user]);

  const fetchChallenges = async () => {
    if (!user) return;

    // Fetch all active challenges
    const { data: challenges } = await supabase
      .from("challenges")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (!challenges) return;

    // Get creator usernames
    const creatorIds = [...new Set(challenges.map(c => c.creator_id))];
    const { data: creators } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", creatorIds);

    const creatorsMap = new Map(creators?.map(c => [c.id, c.username]) || []);

    // Get participants for each challenge
    const challengesWithData = await Promise.all(
      challenges.map(async (challenge) => {
        const { data: participants } = await supabase
          .from("challenge_participants")
          .select("user_id, current_value")
          .eq("challenge_id", challenge.id);

        const myParticipation = participants?.find(p => p.user_id === user.id);
        const isParticipating = !!myParticipation;

        // Calculate progress based on challenge type
        let calculatedProgress = 0;
        if (isParticipating) {
          if (challenge.challenge_type === 'weekly_hours') {
            const weekStart = startOfWeek(new Date(challenge.start_date));
            const weekEnd = endOfWeek(new Date(challenge.end_date));
            const { data: logs } = await supabase
              .from("daily_logs")
              .select("hours_worked")
              .eq("user_id", user.id)
              .gte("log_date", format(weekStart, "yyyy-MM-dd"))
              .lte("log_date", format(weekEnd, "yyyy-MM-dd"));
            calculatedProgress = logs?.reduce((sum, log) => sum + Number(log.hours_worked), 0) || 0;
          } else if (challenge.challenge_type === 'daily_streak') {
            const { data: streak } = await supabase
              .from("streaks")
              .select("current_streak")
              .eq("user_id", user.id)
              .eq("streak_type", "daily_log")
              .single();
            calculatedProgress = streak?.current_streak || 0;
          } else {
            calculatedProgress = myParticipation?.current_value || 0;
          }
        }

        return {
          ...challenge,
          creator_username: creatorsMap.get(challenge.creator_id) || "Unknown",
          participants: participants?.length || 0,
          my_progress: calculatedProgress,
        };
      })
    );

    setActiveChallenges(challengesWithData);
    
    // Get all challenges user is participating in
    const { data: myParticipations } = await supabase
      .from("challenge_participants")
      .select("challenge_id")
      .eq("user_id", user.id);
    
    const myChallengeIds = new Set(
      myParticipations?.map(p => p.challenge_id) || []
    );
    
    setMyChallenges(challengesWithData.filter(c => 
      c.creator_id === user.id || myChallengeIds.has(c.id)
    ));
  };

  const createChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const weekStart = startOfWeek(new Date());
    const weekEnd = endOfWeek(weekStart);

    const { data: challenge, error } = await supabase
      .from("challenges")
      .insert({
        creator_id: user.id,
        title: challengeTitle,
        description: challengeDescription || null,
        challenge_type: challengeType,
        target_value: targetValue ? parseFloat(targetValue) : null,
        start_date: format(weekStart, "yyyy-MM-dd"),
        end_date: format(weekEnd, "yyyy-MM-dd"),
        status: "active",
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Auto-join the challenge
      await supabase
        .from("challenge_participants")
        .insert({
          challenge_id: challenge.id,
          user_id: user.id,
          current_value: 0,
        });

      toast({
        title: "Challenge created!",
        description: "You've been automatically added as a participant",
      });
      setIsCreateOpen(false);
      setChallengeTitle("");
      setChallengeDescription("");
      setTargetValue("");
      fetchChallenges();
    }
  };

  const joinChallenge = async (challengeId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("challenge_participants")
      .insert({
        challenge_id: challengeId,
        user_id: user.id,
        current_value: 0,
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Joined challenge!",
        description: "Good luck!",
      });
      fetchChallenges();
    }
  };

  const handleEditChallenge = (challenge: Challenge) => {
    setEditingChallenge(challenge);
    setChallengeTitle(challenge.title);
    setChallengeDescription(challenge.description || "");
    setChallengeType(challenge.challenge_type);
    setTargetValue(challenge.target_value?.toString() || "");
    setIsEditOpen(true);
  };

  const handleUpdateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingChallenge) return;

    const { error } = await supabase
      .from("challenges")
      .update({
        title: challengeTitle,
        description: challengeDescription || null,
        challenge_type: challengeType,
        target_value: targetValue ? parseFloat(targetValue) : null,
      })
      .eq("id", editingChallenge.id)
      .eq("creator_id", user.id); // Ensure user owns the challenge

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Challenge updated!",
        description: "Your challenge has been updated.",
      });
      setIsEditOpen(false);
      setEditingChallenge(null);
      setChallengeTitle("");
      setChallengeDescription("");
      setTargetValue("");
      fetchChallenges();
    }
  };

  const handleDeleteChallenge = async (challengeId: string) => {
    if (!user) return;

    if (!confirm("Are you sure you want to delete this challenge? This action cannot be undone.")) {
      return;
    }

    // Delete participants first (cascade should handle this, but being explicit)
    await supabase
      .from("challenge_participants")
      .delete()
      .eq("challenge_id", challengeId);

    // Delete the challenge
    const { error } = await supabase
      .from("challenges")
      .delete()
      .eq("id", challengeId)
      .eq("creator_id", user.id); // Ensure user owns the challenge

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Challenge deleted!",
        description: "The challenge has been removed.",
      });
      fetchChallenges();
    }
  };

  const getProgressPercentage = (challenge: Challenge) => {
    if (!challenge.target_value) return 0;
    return Math.min((challenge.my_progress / challenge.target_value) * 100, 100);
  };

  if (loading) return null;

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-16 md:pt-0 md:ml-[var(--sidebar-width,5rem)] p-4 sm:p-6 lg:p-8 transition-all duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-display mb-2 neon-text animate-fade-in">Challenges</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Compete with friends and push your limits</p>
            </div>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Challenge
            </Button>
          </div>

          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="active">Active Challenges</TabsTrigger>
              <TabsTrigger value="my">My Challenges</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="animate-slide-up">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {activeChallenges.map((challenge) => {
                  const isParticipating = challenge.my_progress > 0 || activeChallenges.some(c => c.id === challenge.id);
                  const progress = getProgressPercentage(challenge);
                  
                  return (
                    <Card key={challenge.id} className="glow-card p-4 sm:p-6 hover:scale-105 transition-all duration-300">
                      <div className="flex items-start justify-between mb-4 gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 mb-2">
                            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0 mt-1" />
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg sm:text-xl font-display text-primary break-words">{challenge.title}</h3>
                            </div>
                            {challenge.creator_id === user.id && (
                              <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditChallenge(challenge)}
                                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                                >
                                  <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteChallenge(challenge.id)}
                                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                          {challenge.description && (
                            <p className="text-xs sm:text-sm text-muted-foreground mb-2 break-words">{challenge.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 flex-shrink-0" />
                              {challenge.participants} participants
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 flex-shrink-0" />
                              {format(new Date(challenge.end_date), "MMM d")}
                            </span>
                          </div>
                        </div>
                      </div>

                      {challenge.my_progress > 0 || challenge.creator_id === user.id ? (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-muted-foreground">Your Progress</span>
                            <span className="font-display text-primary">
                              {challenge.my_progress.toFixed(1)} / {challenge.target_value || "∞"}
                            </span>
                          </div>
                          {challenge.target_value && (
                            <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-primary h-full transition-all duration-500 rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <Button
                          onClick={() => joinChallenge(challenge.id)}
                          className="w-full bg-primary hover:bg-primary/90 mt-4 text-xs sm:text-sm"
                        >
                          <Trophy className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                          Join Challenge
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
              {activeChallenges.length === 0 && (
                <Card className="glow-card p-12 text-center">
                  <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground mb-4">No active challenges yet</p>
                  <Button onClick={() => setIsCreateOpen(true)} className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Challenge
                  </Button>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="my" className="animate-slide-up">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {myChallenges.map((challenge) => {
                  const progress = getProgressPercentage(challenge);
                  return (
                    <Card key={challenge.id} className="glow-card p-4 sm:p-6">
                      <div className="flex items-start justify-between mb-4 gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg sm:text-xl font-display text-primary break-words">{challenge.title}</h3>
                            </div>
                            {challenge.creator_id === user.id && (
                              <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditChallenge(challenge)}
                                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                                >
                                  <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteChallenge(challenge.id)}
                                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 sm:gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 flex-shrink-0" />
                              {challenge.participants} participants
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs sm:text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-display text-primary">
                            {challenge.my_progress.toFixed(1)} / {challenge.target_value || "∞"}
                          </span>
                        </div>
                        {challenge.target_value && (
                          <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-primary h-full transition-all duration-500 rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>

          {/* Create Challenge Dialog */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary">Create Challenge</DialogTitle>
              </DialogHeader>
              <form onSubmit={createChallenge} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Challenge Title</Label>
                  <Input
                    id="title"
                    value={challengeTitle}
                    onChange={(e) => setChallengeTitle(e.target.value)}
                    required
                    placeholder="e.g., 40 Hours This Week"
                    className="bg-input border-primary/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={challengeDescription}
                    onChange={(e) => setChallengeDescription(e.target.value)}
                    placeholder="What's this challenge about?"
                    className="bg-input border-primary/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Challenge Type</Label>
                  <select
                    id="type"
                    value={challengeType}
                    onChange={(e) => setChallengeType(e.target.value)}
                    className="w-full p-2 bg-input border border-primary/30 rounded-md"
                  >
                    <option value="weekly_hours">Weekly Hours</option>
                    <option value="daily_streak">Daily Streak</option>
                    <option value="total_hours">Total Hours</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target">Target Value (Optional)</Label>
                  <Input
                    id="target"
                    type="number"
                    step="0.1"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="e.g., 40 for 40 hours"
                    className="bg-input border-primary/30"
                  />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
                  Create Challenge
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Challenge Dialog */}
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary">Edit Challenge</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateChallenge} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Challenge Title</Label>
                  <Input
                    id="edit-title"
                    value={challengeTitle}
                    onChange={(e) => setChallengeTitle(e.target.value)}
                    required
                    placeholder="e.g., 40 Hours This Week"
                    className="bg-input border-primary/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description (Optional)</Label>
                  <Textarea
                    id="edit-description"
                    value={challengeDescription}
                    onChange={(e) => setChallengeDescription(e.target.value)}
                    placeholder="What's this challenge about?"
                    className="bg-input border-primary/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Challenge Type</Label>
                  <select
                    id="edit-type"
                    value={challengeType}
                    onChange={(e) => setChallengeType(e.target.value)}
                    className="w-full p-2 bg-input border border-primary/30 rounded-md"
                  >
                    <option value="weekly_hours">Weekly Hours</option>
                    <option value="daily_streak">Daily Streak</option>
                    <option value="total_hours">Total Hours</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-target">Target Value (Optional)</Label>
                  <Input
                    id="edit-target"
                    type="number"
                    step="0.1"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="e.g., 40 for 40 hours"
                    className="bg-input border-primary/30"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditOpen(false);
                      setEditingChallenge(null);
                      setChallengeTitle("");
                      setChallengeDescription("");
                      setTargetValue("");
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                    Update Challenge
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default Challenges;

