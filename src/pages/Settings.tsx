import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Lock, Mail, Save, KeyRound, RotateCcw, Trash2, AlertTriangle, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { validateUsername, validatePassword, isValidEmail, MAX_LENGTHS } from "@/utils/validation";

const Settings = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [usernameErrors, setUsernameErrors] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isResetLogsDialogOpen, setIsResetLogsDialogOpen] = useState(false);
  const [isResetStreaksDialogOpen, setIsResetStreaksDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [pomodoroActivityVisible, setPomodoroActivityVisible] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    // Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, pomodoro_activity_visible")
      .eq("id", user.id)
      .single();

    if (profile) {
      setUsername(profile.username);
      setPomodoroActivityVisible(profile.pomodoro_activity_visible ?? true);
    }

    // Fetch email from auth
    if (user.email) {
      setEmail(user.email);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsUpdating(true);

    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      setUsernameErrors(usernameValidation.errors);
      setIsUpdating(false);
      return;
    }
    setUsernameErrors([]);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ username: username.trim() })
        .eq("id", user.id);

      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          toast({
            title: "Username taken",
            description: "This username is already taken. Please choose another.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: "Unable to update profile. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Success!",
          description: "Profile updated successfully",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }

    setIsUpdating(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;

    setIsChangingPassword(true);
    setPasswordErrors([]);

    // Validate current password is provided
    if (!currentPassword || currentPassword.trim().length === 0) {
      setPasswordErrors(["Current password is required"]);
      setIsChangingPassword(false);
      return;
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      setPasswordErrors(passwordValidation.errors);
      setIsChangingPassword(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrors(["Passwords do not match"]);
      setIsChangingPassword(false);
      return;
    }

    // Check if new password is different from current password
    if (currentPassword === newPassword) {
      setPasswordErrors(["New password must be different from current password"]);
      setIsChangingPassword(false);
      return;
    }

    try {
      // First, verify the current password is correct
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordErrors(["Current password is incorrect"]);
        setIsChangingPassword(false);
        return;
      }

      // If current password is correct, update to new password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message.includes('same')
            ? "New password must be different from current password"
            : "Unable to change password. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success!",
          description: "Password changed successfully",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }

    setIsChangingPassword(false);
  };

  const handlePasswordReset = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    if (!isValidEmail(email)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password reset email sent!",
          description: "Check your email for password reset instructions",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleResetLogs = async () => {
    if (!user) return;

    setIsResetting(true);
    try {
      // Delete all logs first
      const { error: logsError } = await supabase
        .from("daily_logs")
        .delete()
        .eq("user_id", user.id);

      if (logsError) throw logsError;

      // Delete all achievements (to prevent achievement badge triggers from re-awarding)
      const { error: achievementsError } = await supabase
        .from("achievements")
        .delete()
        .eq("user_id", user.id);

      if (achievementsError) throw achievementsError;

      // Delete all badges (since they're based on hours/logs/achievements)
      const { error: badgesError } = await supabase
        .from("badges")
        .delete()
        .eq("user_id", user.id);

      if (badgesError) throw badgesError;

      // Reset streaks
      await supabase
        .from("streaks")
        .update({
          current_streak: 0,
          longest_streak: 0,
          last_activity_date: null,
        })
        .eq("user_id", user.id);

      toast({
        title: "All data reset",
        description: "All your logs, achievements, badges, and streaks have been reset.",
      });

      setIsResetLogsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset data",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetStreaks = async () => {
    if (!user) return;

    setIsResetting(true);
    try {
      const { error } = await supabase
        .from("streaks")
        .update({
          current_streak: 0,
          last_activity_date: null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Streaks reset",
        description: "Your streak counters have been reset to zero.",
      });

      setIsResetStreaksDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset streaks",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-16 md:pt-0 md:ml-[var(--sidebar-width,5rem)] p-4 sm:p-6 lg:p-8 transition-all duration-300">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-display mb-2 neon-text">Settings</h1>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">Manage your account and preferences</p>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 mb-4 sm:mb-6">
              <TabsTrigger value="profile" className="text-xs sm:text-sm">
                <User className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="privacy" className="text-xs sm:text-sm">
                <Users className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Privacy</span>
              </TabsTrigger>
              <TabsTrigger value="password" className="text-xs sm:text-sm">
                <Lock className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Password</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="text-xs sm:text-sm">
                <KeyRound className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Security</span>
              </TabsTrigger>
              <TabsTrigger value="data" className="text-xs sm:text-sm">
                <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Data</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-4 sm:mt-6">
              <Card className="glow-card p-4 sm:p-6">
                <h2 className="text-2xl font-display text-primary mb-6">Profile Information</h2>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (e.target.value) {
                          const validation = validateUsername(e.target.value);
                          setUsernameErrors(validation.errors);
                        } else {
                          setUsernameErrors([]);
                        }
                      }}
                      maxLength={MAX_LENGTHS.USERNAME}
                      className="bg-input border-primary/30"
                      required
                    />
                    {usernameErrors.length > 0 && (
                      <div className="text-xs text-destructive space-y-1">
                        {usernameErrors.map((error, idx) => (
                          <div key={idx}>{error}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      disabled
                      className="bg-input border-primary/30 opacity-50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed. Contact support if you need to update it.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={isUpdating}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isUpdating ? "Updating..." : "Update Profile"}
                  </Button>
                </form>
              </Card>
            </TabsContent>

            <TabsContent value="privacy" className="mt-6">
              <Card className="glow-card p-6">
                <h2 className="text-2xl font-display text-primary mb-6">Privacy Settings</h2>
                <div className="space-y-6">
                  <div className="p-4 border border-primary/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-display text-primary mb-1">Share Pomodoro Activities</h3>
                        <p className="text-sm text-muted-foreground">
                          When enabled, your friends can see when you complete Pomodoro sessions in their activity feed.
                        </p>
                      </div>
                      <Switch
                        checked={pomodoroActivityVisible}
                        onCheckedChange={async (checked) => {
                          setPomodoroActivityVisible(checked);
                          try {
                            const { error } = await supabase
                              .from("profiles")
                              .update({ pomodoro_activity_visible: checked })
                              .eq("id", user?.id);

                            if (error) throw error;

                            toast({
                              title: "Settings updated",
                              description: checked
                                ? "Your Pomodoro activities are now visible to friends"
                                : "Your Pomodoro activities are now private",
                            });
                          } catch (error: any) {
                            toast({
                              title: "Error",
                              description: error.message || "Failed to update setting",
                              variant: "destructive",
                            });
                            // Revert on error
                            setPomodoroActivityVisible(!checked);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="password" className="mt-6">
              <Card className="glow-card p-6">
                <h2 className="text-2xl font-display text-primary mb-6">Change Password</h2>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        // Clear errors when user starts typing
                        if (passwordErrors.length > 0 && passwordErrors[0]?.includes("Current password")) {
                          setPasswordErrors([]);
                        }
                      }}
                      maxLength={MAX_LENGTHS.PASSWORD}
                      className="bg-input border-primary/30"
                      required
                      placeholder="Enter your current password"
                    />
                    {passwordErrors.some(err => err.includes("Current password")) && (
                      <div className="text-xs text-destructive">
                        {passwordErrors.find(err => err.includes("Current password"))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (e.target.value) {
                          const validation = validatePassword(e.target.value);
                          setPasswordErrors(validation.errors);
                        } else {
                          setPasswordErrors([]);
                        }
                      }}
                      maxLength={MAX_LENGTHS.PASSWORD}
                      className="bg-input border-primary/30"
                      required
                    />
                    {passwordErrors.length > 0 && (
                      <div className="text-xs text-destructive space-y-1">
                        {passwordErrors.map((error, idx) => (
                          <div key={idx}>{error}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      maxLength={MAX_LENGTHS.PASSWORD}
                      className="bg-input border-primary/30"
                      required
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-destructive">Passwords do not match</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      isChangingPassword || 
                      !currentPassword || 
                      newPassword !== confirmPassword || 
                      passwordErrors.length > 0 ||
                      currentPassword === newPassword
                    }
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    {isChangingPassword ? "Changing..." : "Change Password"}
                  </Button>
                </form>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="mt-6">
              <Card className="glow-card p-6">
                <h2 className="text-2xl font-display text-primary mb-6">Password Reset</h2>
                <p className="text-muted-foreground mb-4">
                  If you've forgotten your password, we can send you a reset link via email.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email Address</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-input border-primary/30"
                      placeholder="your@email.com"
                    />
                  </div>
                  <Button
                    onClick={handlePasswordReset}
                    className="bg-secondary hover:bg-secondary/90"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Send Password Reset Email
                  </Button>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="data" className="mt-6">
              <Card className="glow-card p-6">
                <h2 className="text-2xl font-display text-primary mb-6">Data Management</h2>
                <p className="text-muted-foreground mb-6">
                  Reset your activity logs or streaks. These actions cannot be undone.
                </p>
                <div className="space-y-4">
                  <div className="p-4 border border-primary/30 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-display text-primary mb-1">Reset All Data</h3>
                        <p className="text-sm text-muted-foreground">
                          Permanently delete all your activity logs, achievements, badges, and reset streaks. This will completely reset your account data.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => setIsResetLogsDialogOpen(true)}
                      className="mt-4"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Reset All Data
                    </Button>
                  </div>

                  <div className="p-4 border border-primary/30 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-display text-primary mb-1">Reset Streaks</h3>
                        <p className="text-sm text-muted-foreground">
                          Reset your streak counters to zero. This will not delete your logs, only reset the streak tracking.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => setIsResetStreaksDialogOpen(true)}
                      className="mt-4"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset Streaks
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Reset Logs Dialog */}
          <Dialog open={isResetLogsDialogOpen} onOpenChange={setIsResetLogsDialogOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Reset All Data
                </DialogTitle>
                <DialogDescription>
                  This action cannot be undone. All your activity data will be permanently deleted.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-foreground">
                  Are you sure you want to reset all your data? This will permanently delete:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>All activity logs and logged hours</li>
                  <li>All achievements</li>
                  <li>All earned badges</li>
                  <li>All streak counters (reset to zero)</li>
                </ul>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsResetLogsDialogOpen(false)}
                    className="flex-1"
                    disabled={isResetting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleResetLogs}
                    className="flex-1"
                    disabled={isResetting}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isResetting ? "Resetting..." : "Reset All Data"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Reset Streaks Dialog */}
          <Dialog open={isResetStreaksDialogOpen} onOpenChange={setIsResetStreaksDialogOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Reset Streaks
                </DialogTitle>
                <DialogDescription>
                  This will reset your streak counters to zero. Your logs will not be affected.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-foreground">
                  Are you sure you want to reset your streaks? This will:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Reset current streak to 0</li>
                  <li>Keep your longest streak record</li>
                  <li>Not delete any of your logs</li>
                </ul>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsResetStreaksDialogOpen(false)}
                    className="flex-1"
                    disabled={isResetting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleResetStreaks}
                    className="flex-1"
                    disabled={isResetting}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {isResetting ? "Resetting..." : "Reset Streaks"}
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

export default Settings;

