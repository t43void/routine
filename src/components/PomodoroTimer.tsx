import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Play, Pause, RotateCcw, Coffee, CheckCircle, Settings, Volume2, VolumeX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePomodoro } from "@/contexts/PomodoroContext";

export const PomodoroTimer = () => {
  const { toast } = useToast();
  const {
    timeLeft,
    isRunning,
    sessionType,
    completedSessions,
    settings,
    isCompleted,
    startTimer,
    pauseTimer,
    resetTimer,
    updateSettings,
  } = usePomodoro();
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState(settings);
  
  const workDuration = settings.work_duration * 60; // Convert to seconds
  const shortBreakDuration = settings.short_break_duration * 60;
  const longBreakDuration = settings.long_break_duration * 60;

  // Update temp settings when context settings change
  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  const saveSettings = async () => {
    await updateSettings(tempSettings);
    setIsSettingsOpen(false);
    toast({
      title: "Settings saved",
      description: "Your Pomodoro settings have been updated.",
    });
  };

  const toggleTimer = () => {
    if (timeLeft === 0) {
      resetTimer();
      return;
    }
    if (isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  };

  const requestNotificationPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  };

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getProgress = () => {
    const total = sessionType === "work" ? workDuration : sessionType === "short_break" ? shortBreakDuration : longBreakDuration;
    return ((total - timeLeft) / total) * 100;
  };

  const getSessionEmoji = () => {
    if (sessionType === "work") return "🍅";
    if (sessionType === "short_break") return "☕";
    return "🌴";
  };

  return (
    <Card className="glow-card p-6 animate-slide-up hover:scale-105 transition-all duration-300">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-4xl">{getSessionEmoji()}</span>
          <h2 className="text-2xl font-display text-primary">Pomodoro Timer</h2>
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-auto">
                <Settings className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-primary/30 max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display text-primary">Pomodoro Settings</DialogTitle>
                <DialogDescription>
                  Customize your Pomodoro timer durations and preferences
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="work-duration">Work Duration (minutes)</Label>
                  <Input
                    id="work-duration"
                    type="number"
                    min="1"
                    max="60"
                    value={tempSettings.work_duration}
                    onChange={(e) => setTempSettings({ ...tempSettings, work_duration: parseInt(e.target.value) || 25 })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="short-break">Short Break (minutes)</Label>
                  <Input
                    id="short-break"
                    type="number"
                    min="1"
                    max="30"
                    value={tempSettings.short_break_duration}
                    onChange={(e) => setTempSettings({ ...tempSettings, short_break_duration: parseInt(e.target.value) || 10 })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="long-break">Long Break (minutes)</Label>
                  <Input
                    id="long-break"
                    type="number"
                    min="1"
                    max="60"
                    value={tempSettings.long_break_duration}
                    onChange={(e) => setTempSettings({ ...tempSettings, long_break_duration: parseInt(e.target.value) || 15 })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="sessions-before-long">Sessions Before Long Break</Label>
                  <Input
                    id="sessions-before-long"
                    type="number"
                    min="1"
                    max="10"
                    value={tempSettings.sessions_before_long_break}
                    onChange={(e) => setTempSettings({ ...tempSettings, sessions_before_long_break: parseInt(e.target.value) || 4 })}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="sound-enabled">Sound Alarm</Label>
                  <Button
                    variant={tempSettings.sound_enabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTempSettings({ ...tempSettings, sound_enabled: !tempSettings.sound_enabled })}
                  >
                    {tempSettings.sound_enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </Button>
                </div>
                {tempSettings.sound_enabled && (
                  <div>
                    <Label htmlFor="sound-volume">Volume: {tempSettings.sound_volume}%</Label>
                    <Input
                      id="sound-volume"
                      type="range"
                      min="0"
                      max="100"
                      value={tempSettings.sound_volume}
                      onChange={(e) => setTempSettings({ ...tempSettings, sound_volume: parseInt(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={saveSettings} className="flex-1">
                    Save Settings
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTempSettings(settings);
                      setIsSettingsOpen(false);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6">
          <div className="relative w-64 h-64 mx-auto mb-4">
            <svg className="transform -rotate-90 w-64 h-64">
              <circle
                cx="128"
                cy="128"
                r="120"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted/20"
              />
              <circle
                cx="128"
                cy="128"
                r="120"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 120}`}
                strokeDashoffset={`${2 * Math.PI * 120 * (1 - getProgress() / 100)}`}
                className="text-primary transition-all duration-1000"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl font-display text-primary mb-2">{formatTime(timeLeft)}</div>
                <div className="text-sm text-muted-foreground capitalize">
                  {sessionType === "work" ? "Focus Time" : sessionType === "short_break" ? "Short Break" : "Long Break"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mb-4">
          <Button
            onClick={toggleTimer}
            size="lg"
            className="bg-primary hover:bg-primary/90"
            disabled={isCompleted}
          >
            {isRunning ? (
              <>
                <Pause className="w-5 h-5 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Start
              </>
            )}
          </Button>
          <Button onClick={resetTimer} variant="outline" size="lg">
            <RotateCcw className="w-5 h-5 mr-2" />
            Reset
          </Button>
        </div>

        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            <span>{completedSessions} Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <Coffee className="w-4 h-4 text-primary" />
            <span>Next: Session {completedSessions + 1}</span>
          </div>
        </div>

        {isCompleted && (
          <div className="mt-4 p-4 bg-primary/10 rounded-lg animate-pulse">
            <p className="text-primary font-display">
              {sessionType === "work" ? "🎉 Great work! Time for a break!" : "Ready to get back to work?"}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
