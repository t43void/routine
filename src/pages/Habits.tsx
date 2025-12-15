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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Check, 
  X, 
  Edit, 
  Trash2, 
  Target,
  Calendar,
  TrendingUp,
  Flame,
  Archive,
  ArchiveRestore
} from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays, subDays } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Habit {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  target_days: number;
  archived: boolean;
  created_at: string;
}

interface HabitCompletion {
  id: string;
  habit_id: string;
  completion_date: string;
  notes: string | null;
}

const Habits = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
    icon: "🎯",
    target_days: 7,
  });

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchHabits();
      fetchCompletions();
    }
  }, [user, currentWeek]);

  const fetchHabits = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHabits(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch habits",
        variant: "destructive",
      });
    }
  };

  const fetchCompletions = async () => {
    if (!user || habits.length === 0) return;
    try {
      const { data, error } = await supabase
        .from("habit_completions")
        .select("*")
        .in("habit_id", habits.map(h => h.id))
        .gte("completion_date", format(weekStart, "yyyy-MM-dd"))
        .lte("completion_date", format(weekEnd, "yyyy-MM-dd"));

      if (error) throw error;
      setCompletions(data || []);
    } catch (error: any) {
      // Silently handle errors
    }
  };

  useEffect(() => {
    if (habits.length > 0) {
      fetchCompletions();
    }
  }, [habits, weekStart, weekEnd]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingHabit) {
        const { error } = await supabase
          .from("habits")
          .update({
            name: formData.name,
            description: formData.description || null,
            color: formData.color,
            icon: formData.icon || null,
            target_days: formData.target_days,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingHabit.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Habit updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("habits")
          .insert({
            user_id: user.id,
            name: formData.name,
            description: formData.description || null,
            color: formData.color,
            icon: formData.icon || null,
            target_days: formData.target_days,
          });

        if (error) throw error;
        toast({
          title: "Success",
          description: "Habit created successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingHabit(null);
      setFormData({
        name: "",
        description: "",
        color: "#3b82f6",
        icon: "🎯",
        target_days: 7,
      });
      fetchHabits();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save habit",
        variant: "destructive",
      });
    }
  };

  const toggleCompletion = async (habitId: string, date: Date) => {
    if (!user) return;
    const dateStr = format(date, "yyyy-MM-dd");
    const existing = completions.find(
      c => c.habit_id === habitId && c.completion_date === dateStr
    );

    try {
      if (existing) {
        const { error } = await supabase
          .from("habit_completions")
          .delete()
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("habit_completions")
          .insert({
            habit_id: habitId,
            completion_date: dateStr,
          });

        if (error) throw error;
      }

      fetchCompletions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update completion",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (habitId: string) => {
    if (!confirm("Are you sure you want to delete this habit?")) return;

    try {
      const { error } = await supabase
        .from("habits")
        .delete()
        .eq("id", habitId);

      if (error) throw error;
      toast({
        title: "Success",
        description: "Habit deleted successfully",
      });
      fetchHabits();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete habit",
        variant: "destructive",
      });
    }
  };

  const handleArchive = async (habitId: string, archived: boolean) => {
    try {
      const { error } = await supabase
        .from("habits")
        .update({ archived: !archived })
        .eq("id", habitId);

      if (error) throw error;
      fetchHabits();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update habit",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (habit: Habit) => {
    setEditingHabit(habit);
    setFormData({
      name: habit.name,
      description: habit.description || "",
      color: habit.color,
      icon: habit.icon || "🎯",
      target_days: habit.target_days,
    });
    setIsDialogOpen(true);
  };

  const getCompletionCount = (habitId: string): number => {
    return completions.filter(
      c => c.habit_id === habitId &&
      c.completion_date >= format(weekStart, "yyyy-MM-dd") &&
      c.completion_date <= format(weekEnd, "yyyy-MM-dd")
    ).length;
  };

  const getCompletionRate = (habit: Habit): number => {
    const count = getCompletionCount(habit.id);
    return habit.target_days > 0 ? (count / habit.target_days) * 100 : 0;
  };

  const isCompleted = (habitId: string, date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");
    return completions.some(
      c => c.habit_id === habitId && c.completion_date === dateStr
    );
  };

  const activeHabits = habits.filter(h => !h.archived);
  const archivedHabits = habits.filter(h => h.archived);

  if (loading) return null;

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-16 md:pt-0 md:ml-[var(--sidebar-width,5rem)] p-4 sm:p-6 transition-all duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-display mb-2 neon-text">Habit Tracker</h1>
              <p className="text-sm text-muted-foreground">Build consistency, one day at a time</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeek(subDays(currentWeek, 7))}
              >
                ← Prev
              </Button>
              <div className="text-center min-w-[200px]">
                <p className="text-sm font-display text-primary">
                  {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
                disabled={format(currentWeek, "yyyy-MM-dd") >= format(new Date(), "yyyy-MM-dd")}
              >
                Next →
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingHabit(null);
                    setFormData({
                      name: "",
                      description: "",
                      color: "#3b82f6",
                      icon: "🎯",
                      target_days: 7,
                    });
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Habit
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-primary/30">
                  <DialogHeader>
                    <DialogTitle className="font-display text-primary">
                      {editingHabit ? "Edit Habit" : "Create New Habit"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingHabit ? "Update your habit details" : "Create a new habit to track daily"}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Habit Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="bg-input border-primary/30"
                        placeholder="e.g., Exercise, Read, Meditate"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="bg-input border-primary/30"
                        placeholder="Optional description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="icon">Icon (Emoji)</Label>
                        <Input
                          id="icon"
                          value={formData.icon}
                          onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                          className="bg-input border-primary/30"
                          placeholder="🎯"
                          maxLength={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="color">Color</Label>
                        <Input
                          id="color"
                          type="color"
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          className="bg-input border-primary/30 h-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="target_days">Target Days Per Week</Label>
                      <Select
                        value={formData.target_days.toString()}
                        onValueChange={(v) => setFormData({ ...formData, target_days: parseInt(v) })}
                      >
                        <SelectTrigger id="target_days" className="bg-input border-primary/30">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7].map(days => (
                            <SelectItem key={days} value={days.toString()}>
                              {days} {days === 1 ? "day" : "days"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsDialogOpen(false);
                          setEditingHabit(null);
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                        {editingHabit ? "Update" : "Create"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {activeHabits.length === 0 ? (
            <Card className="glow-card p-12 text-center">
              <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-display text-primary mb-2">No Habits Yet</h3>
              <p className="text-muted-foreground mb-4">
                Start building better habits by creating your first one!
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Habit
              </Button>
            </Card>
          ) : (
            <div className="space-y-6">
              {activeHabits.map((habit) => {
                const completionCount = getCompletionCount(habit.id);
                const completionRate = getCompletionRate(habit);
                
                // Calculate streak
                let streak = 0;
                const today = new Date();
                let checkDate = new Date(today);
                while (true) {
                  const dateStr = format(checkDate, "yyyy-MM-dd");
                  const isCompleted = completions.some(
                    c => c.habit_id === habit.id && c.completion_date === dateStr
                  );
                  if (isCompleted) {
                    streak++;
                    checkDate = subDays(checkDate, 1);
                  } else {
                    break;
                  }
                }

                return (
                  <Card key={habit.id} className="glow-card p-4 sm:p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                          style={{ backgroundColor: `${habit.color}20` }}
                        >
                          {habit.icon || "🎯"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-display text-primary mb-1">{habit.name}</h3>
                          {habit.description && (
                            <p className="text-sm text-muted-foreground">{habit.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              {completionCount}/{habit.target_days} days
                            </span>
                            {streak > 0 && (
                              <span className="flex items-center gap-1 text-orange-400">
                                <Flame className="w-3 h-3" />
                                {streak} day streak
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {completionRate.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(habit)}
                          className="h-8 w-8"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleArchive(habit.id, habit.archived)}
                          className="h-8 w-8"
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(habit.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-muted-foreground">Weekly Progress</span>
                        <span className="text-xs font-display text-primary">
                          {completionRate.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(completionRate, 100)}%`,
                            backgroundColor: habit.color,
                          }}
                        />
                      </div>
                    </div>

                    {/* Week Grid */}
                    <div className="grid grid-cols-7 gap-2">
                      {weekDays.map((day, idx) => {
                        const completed = isCompleted(habit.id, day);
                        const isToday = isSameDay(day, new Date());
                        const isPast = day < new Date() && !isSameDay(day, new Date());

                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              if (isPast || isToday) {
                                toggleCompletion(habit.id, day);
                              }
                            }}
                            disabled={!isPast && !isToday}
                            className={`
                              aspect-square rounded-lg border-2 transition-all
                              ${completed
                                ? `border-[${habit.color}] bg-[${habit.color}]20`
                                : "border-muted/30 hover:border-primary/50"
                              }
                              ${isToday ? "ring-2 ring-primary/50" : ""}
                              ${!isPast && !isToday ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:scale-105"}
                            `}
                            style={{
                              borderColor: completed ? habit.color : undefined,
                              backgroundColor: completed ? `${habit.color}20` : undefined,
                            }}
                          >
                            <div className="flex flex-col items-center justify-center h-full">
                              <span className="text-[10px] text-muted-foreground mb-1">
                                {format(day, "EEE")}
                              </span>
                              <span className={`text-xs font-display ${isToday ? "text-primary font-bold" : ""}`}>
                                {format(day, "d")}
                              </span>
                              {completed && (
                                <Check className="w-4 h-4 mt-1" style={{ color: habit.color }} />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {archivedHabits.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-display text-primary mb-4">Archived Habits</h2>
              <div className="space-y-3">
                {archivedHabits.map((habit) => (
                  <Card key={habit.id} className="p-4 opacity-60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                          style={{ backgroundColor: `${habit.color}20` }}
                        >
                          {habit.icon || "🎯"}
                        </div>
                        <div>
                          <h3 className="font-display">{habit.name}</h3>
                          <p className="text-xs text-muted-foreground">Archived</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleArchive(habit.id, habit.archived)}
                        className="h-8 w-8"
                      >
                        <ArchiveRestore className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Habits;

