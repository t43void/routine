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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay, isToday } from "date-fns";
import ReactMarkdown from "react-markdown";
import { TrendingUp, Trash2 } from "lucide-react";
import { validateHours, validateText, MAX_LENGTHS, rateLimiters } from "@/utils/validation";
import { TasksManager } from "@/components/TasksManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DailyLog {
  id?: string;
  log_date: string;
  hours_worked: number;
  description: string;
}

const Calendar = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [dailyGoal, setDailyGoal] = useState<number | null>(null);
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [tasksChanged, setTasksChanged] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchLogs();
    fetchDailyGoal();
  }, [user, currentDate, tasksChanged]);

  const fetchDailyGoal = async () => {
    if (!user) return;
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("daily_goals")
        .select("target_hours")
        .eq("user_id", user.id)
        .eq("goal_date", today)
        .maybeSingle();
      
      if (data && !error) {
        setDailyGoal(data.target_hours);
      } else {
        setDailyGoal(null);
      }
    } catch (error) {
      console.error("Error fetching daily goal:", error);
      setDailyGoal(null);
    }
  };

  const setDailyGoalHandler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDate) return;

    try {
      const goalDate = format(selectedDate, "yyyy-MM-dd");
      const targetHours = parseFloat(goalInput);

      const { error } = await supabase.from("daily_goals").upsert({
        user_id: user.id,
        goal_date: goalDate,
        target_hours: targetHours,
        completed: false,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Goal set!",
          description: "You've got this! 💪",
        });
        setIsGoalDialogOpen(false);
        setGoalInput("");
        fetchDailyGoal();
      }
    } catch (error: any) {
      console.error("Error setting daily goal:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to set goal",
        variant: "destructive",
      });
    }
  };

  const fetchLogs = async () => {
    if (!user) return;

    const start = format(startOfMonth(currentDate), "yyyy-MM-dd");
    const end = format(endOfMonth(currentDate), "yyyy-MM-dd");

    const { data } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("log_date", start)
      .lte("log_date", end);

    setLogs(data || []);
  };

  const handleDayClick = async (date: Date) => {
    setSelectedDate(date);
    const logDate = format(date, "yyyy-MM-dd");
    const existingLog = logs.find((log) =>
      isSameDay(new Date(log.log_date), date)
    );
    
    // Calculate Pomodoro hours for this date
    let pomodoroHours = 0;
    if (user) {
      const { data: sessions } = await supabase
        .from("pomodoro_sessions")
        .select("duration")
        .eq("user_id", user.id)
        .eq("session_type", "work")
        .eq("completed", true)
        .gte("created_at", `${logDate}T00:00:00`)
        .lt("created_at", `${logDate}T23:59:59`);
      
      if (sessions) {
        pomodoroHours = sessions.reduce((sum, session) => sum + (session.duration / 3600), 0);
      }
    }
    
    if (existingLog) {
      // Use Pomodoro hours if available, otherwise use log hours
      setHours(pomodoroHours > 0 ? pomodoroHours.toFixed(2) : existingLog.hours_worked.toString());
      setDescription(existingLog.description);
    } else {
      // Auto-populate hours from Pomodoro if available
      setHours(pomodoroHours > 0 ? pomodoroHours.toFixed(2) : "");
      setDescription("");
    }
    setIsDialogOpen(true);
  };

  const handleSetGoal = (date: Date) => {
    setSelectedDate(date);
    const today = format(new Date(), "yyyy-MM-dd");
    const selected = format(date, "yyyy-MM-dd");
    
    // Fetch existing goal for this date
    supabase
      .from("daily_goals")
      .select("target_hours")
      .eq("user_id", user?.id)
      .eq("goal_date", selected)
      .single()
      .then(({ data }) => {
        if (data) {
          setGoalInput(data.target_hours.toString());
        } else {
          setGoalInput("");
        }
        setIsGoalDialogOpen(true);
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDate) return;

    // Rate limiting (per session)
    if (!rateLimiters.logCreation.isAllowed()) {
      toast({
        title: "Too many requests",
        description: "Please wait before logging again.",
        variant: "destructive",
      });
      return;
    }

    // Validate hours
    const hoursValidation = validateHours(hours);
    if (!hoursValidation.valid || hoursValidation.value === null) {
      toast({
        title: "Invalid input",
        description: hoursValidation.error || "Please enter valid hours.",
        variant: "destructive",
      });
      return;
    }

    const logDate = format(selectedDate, "yyyy-MM-dd");
    const existingLog = logs.find((log) => log.log_date === logDate);
    const today = format(new Date(), "yyyy-MM-dd");
    
    // Check if there are Pomodoro sessions for today
    let hasPomodoroSessions = false;
    if (logDate === today && user) {
      const { data: sessions } = await supabase
        .from("pomodoro_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("session_type", "work")
        .eq("completed", true)
        .gte("created_at", `${logDate}T00:00:00`)
        .lt("created_at", `${logDate}T23:59:59`)
        .limit(1);
      hasPomodoroSessions = (sessions?.length ?? 0) > 0;
    }
    
    // Description is optional if Pomodoro sessions exist (hours are auto-calculated)
    // But we always need at least an empty string for the database constraint
    const descriptionValidation = validateText(description, "Description", MAX_LENGTHS.DESCRIPTION, !hasPomodoroSessions);
    if (!descriptionValidation.valid) {
      toast({
        title: "Invalid input",
        description: descriptionValidation.error || "Please enter a valid description.",
        variant: "destructive",
      });
      return;
    }
    
    // Ensure description is never null (database constraint requires NOT NULL)
    const finalDescription = descriptionValidation.value || "";
    
    // For today, recalculate hours from Pomodoro sessions if they exist
    let finalHours = hoursValidation.value;
    
    if (logDate === today && user) {
      const { data: sessions } = await supabase
        .from("pomodoro_sessions")
        .select("duration")
        .eq("user_id", user.id)
        .eq("session_type", "work")
        .eq("completed", true)
        .gte("created_at", `${logDate}T00:00:00`)
        .lt("created_at", `${logDate}T23:59:59`);
      
      if (sessions && sessions.length > 0) {
        const pomodoroHours = sessions.reduce((sum, session) => sum + (session.duration / 3600), 0);
        // Use Pomodoro hours if user hasn't manually changed it significantly
        // Allow small adjustments (within 0.1 hours)
        if (Math.abs(pomodoroHours - hoursValidation.value) < 0.1) {
          finalHours = pomodoroHours;
        }
      }
    }
    
    const logData: any = {
      user_id: user.id,
      log_date: logDate,
      hours_worked: finalHours,
      description: finalDescription,
    };
    
    try {
      let error;
      if (existingLog?.id) {
        // Update existing log
        const { error: updateError } = await supabase
          .from("daily_logs")
          .update({
            hours_worked: logData.hours_worked,
            description: logData.description,
          })
          .eq("id", existingLog.id)
          .eq("user_id", user.id); // Extra safety check
        error = updateError;
      } else {
        // Insert new log
        const { error: insertError } = await supabase
          .from("daily_logs")
          .insert(logData);
        error = insertError;
      }

      if (error) {
        console.error("Daily log error:", error);
        toast({
          title: "Error",
          description: error.message || "Unable to save log. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success!",
          description: "Activity logged successfully",
        });
        setIsDialogOpen(false);
        fetchLogs();
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLog = async () => {
    if (!user || !selectedDate) return;
    
    const logDate = format(selectedDate, "yyyy-MM-dd");
    const existingLog = logs.find((log) => log.log_date === logDate);
    
    if (!existingLog?.id) {
      toast({
        title: "Error",
        description: "No log found to delete.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("daily_logs")
        .delete()
        .eq("id", existingLog.id);

      if (error) {
        toast({
          title: "Error",
          description: "Unable to delete log. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Deleted!",
          description: "Log has been removed.",
        });
        setIsDialogOpen(false);
        setHours("");
        setDescription("");
        fetchLogs();
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Get the day of the week for the first day of the month (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfWeek = getDay(monthStart);
  
  // Create empty cells for days before the first day of the month
  const emptyCells = Array.from({ length: firstDayOfWeek }, (_, i) => i);

  const getLogForDate = (date: Date) => {
    return logs.find((log) => isSameDay(new Date(log.log_date), date));
  };

  if (loading) return null;

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-16 md:pt-0 md:ml-[var(--sidebar-width,5rem)] p-4 sm:p-6 transition-all duration-300">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-display mb-1 neon-text">Activity Calendar</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Track your daily progress</p>
            </div>
            {isToday(new Date()) && dailyGoal && (
              <Card className="p-2 sm:p-3 bg-primary/10 border-primary/30 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Today's Goal</p>
                    <p className="text-sm sm:text-base font-display text-primary">{dailyGoal}h</p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          <Card className="glow-card p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-2 sm:mb-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newDate = new Date(currentDate);
                  newDate.setMonth(newDate.getMonth() - 1);
                  setCurrentDate(newDate);
                }}
              >
                Previous
              </Button>
              <h2 className="text-base sm:text-lg font-display text-primary text-center">
                {format(currentDate, "MMMM yyyy")}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newDate = new Date(currentDate);
                  newDate.setMonth(newDate.getMonth() + 1);
                  setCurrentDate(newDate);
                }}
              >
                Next
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center font-display text-primary text-[10px] sm:text-xs p-0.5 sm:p-1">
                  {day}
                </div>
              ))}

              {/* Empty cells to align first day of month with correct day of week */}
              {emptyCells.map((_, idx) => (
                <div key={`empty-${idx}`} className="aspect-square" />
              ))}

              {days.map((day, idx) => {
                const log = getLogForDate(day);
                const hasLog = !!log;

                return (
                  <div key={idx} className="relative group">
                    <button
                      onClick={() => handleDayClick(day)}
                      className={`
                        w-full aspect-square p-0.5 sm:p-1 rounded border transition-all duration-300
                        ${hasLog
                          ? "border-primary bg-primary/20 hover:bg-primary/30 animate-glow"
                          : "border-muted/30 hover:border-primary/50 hover:bg-card"
                        }
                        ${!isSameMonth(day, currentDate) ? "opacity-30" : ""}
                      `}
                    >
                      <div className="text-[10px] sm:text-xs">{format(day, "d")}</div>
                      {hasLog && (
                        <div className="text-[8px] sm:text-[10px] text-primary mt-0.5 truncate">{log.hours_worked}h</div>
                      )}
                    </button>
                    {isSameMonth(day, currentDate) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetGoal(day);
                        }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-secondary/20 hover:bg-secondary/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        title="Set daily goal"
                      >
                        <TrendingUp className="w-2.5 h-2.5 text-secondary" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="bg-card border-primary/30 max-w-3xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="font-display text-primary">
                  Log Activity - {selectedDate && format(selectedDate, "MMMM d, yyyy")}
                </DialogTitle>
                <DialogDescription>
                  Add tasks, projects, or a daily summary for this date
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 pr-4">
              <Tabs defaultValue="tasks" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="tasks">Tasks & Projects</TabsTrigger>
                  <TabsTrigger value="summary">Daily Summary</TabsTrigger>
                </TabsList>
                <TabsContent value="tasks" className="space-y-4 mt-4">
                  {selectedDate && (
                    <TasksManager
                      date={format(selectedDate, "yyyy-MM-dd")}
                      dailyLogId={(() => {
                        const logDate = format(selectedDate, "yyyy-MM-dd");
                        const existingLog = logs.find((log) => log.log_date === logDate);
                        return existingLog?.id;
                      })()}
                      onTasksChange={() => {
                        setTasksChanged((prev) => prev + 1);
                        fetchLogs();
                      }}
                    />
                  )}
                </TabsContent>
                <TabsContent value="summary" className="space-y-4 mt-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="hours">Hours Worked</Label>
                      <Input
                        id="hours"
                        type="number"
                        step="0.5"
                        min="0"
                        max="24"
                        value={hours}
                        onChange={(e) => setHours(e.target.value)}
                        required
                        className="bg-input border-primary/30"
                      />
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const logDate = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
                          const today = format(new Date(), "yyyy-MM-dd");
                          if (logDate === today) {
                            return "Hours are automatically calculated from your Pomodoro sessions. You can adjust if needed.";
                          }
                          return "This is your total hours for the day. Tasks can have individual hours too.";
                        })()}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">
                        Description (Markdown supported)
                        {(() => {
                          const logDate = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
                          const today = format(new Date(), "yyyy-MM-dd");
                          return logDate === today ? " (Optional - hours auto-calculated from Pomodoro)" : "";
                        })()}
                      </Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required={(() => {
                          const logDate = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
                          const today = format(new Date(), "yyyy-MM-dd");
                          return logDate !== today;
                        })()}
                        maxLength={MAX_LENGTHS.DESCRIPTION}
                        className="bg-input border-primary/30 min-h-[100px]"
                        placeholder="What did you accomplish today?

You can use **bold**, *italic*, lists, etc."
                      />
                      <p className="text-xs text-muted-foreground">
                        {description.length} / {MAX_LENGTHS.DESCRIPTION} characters
                      </p>
                      {description && (
                        <div className="mt-2 p-3 bg-muted/30 rounded-lg border border-primary/20">
                          <Label className="text-xs text-muted-foreground mb-2 block">Preview:</Label>
                          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                            <ReactMarkdown>{description}</ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {(() => {
                        const logDate = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
                        const existingLog = logs.find((log) => log.log_date === logDate);
                        return existingLog?.id ? (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDeleteLog}
                            className="flex-1"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        ) : null;
                      })()}
                      <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                        {(() => {
                          const logDate = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
                          const existingLog = logs.find((log) => log.log_date === logDate);
                          return existingLog?.id ? "Update Log" : "Save Log";
                        })()}
                      </Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {/* Daily Goal Dialog */}
          <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary">
                  Set Daily Goal - {selectedDate && format(selectedDate, "MMMM d, yyyy")}
                </DialogTitle>
                <DialogDescription>
                  Set your target hours for this day
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={setDailyGoalHandler} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="goal-hours">Target Hours</Label>
                  <Input
                    id="goal-hours"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    required
                    placeholder="e.g., 8"
                    className="bg-input border-primary/30"
                  />
                  <p className="text-xs text-muted-foreground">Set a target for how many hours you want to work this day</p>
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
                  Set Goal
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
