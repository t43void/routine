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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Target, 
  Edit, 
  Trash2, 
  CheckCircle2,
  Circle,
  TrendingUp,
  Calendar,
  Flag,
  Award,
  Play,
  Pause,
  X
} from "lucide-react";
import { format, isPast, isToday, differenceInDays } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  target_value: number;
  current_value: number;
  unit: string;
  deadline: string | null;
  color: string;
  icon: string | null;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  created_at: string;
  completed_at: string | null;
}

interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  target_value: number;
  completed: boolean;
  completed_at: string | null;
  order_index: number;
}

const Goals = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMilestoneDialogOpen, setIsMilestoneDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "work",
    target_value: "",
    current_value: "",
    unit: "hours",
    deadline: "",
    color: "#3b82f6",
    icon: "🎯",
  });
  const [milestoneForm, setMilestoneForm] = useState({
    title: "",
    target_value: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchGoals();
    }
  }, [user]);

  useEffect(() => {
    if (selectedGoal) {
      fetchMilestones(selectedGoal.id);
    }
  }, [selectedGoal]);

  const fetchGoals = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch goals",
        variant: "destructive",
      });
    }
  };

  const fetchMilestones = async (goalId: string) => {
    try {
      const { data, error } = await supabase
        .from("goal_milestones")
        .select("*")
        .eq("goal_id", goalId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setMilestones(data || []);
    } catch (error: any) {
      // Silently handle errors
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingGoal) {
        const { error } = await supabase
          .from("goals")
          .update({
            title: formData.title,
            description: formData.description || null,
            category: formData.category || null,
            target_value: parseFloat(formData.target_value) || 0,
            current_value: parseFloat(formData.current_value) || 0,
            unit: formData.unit,
            deadline: formData.deadline || null,
            color: formData.color,
            icon: formData.icon || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingGoal.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Goal updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("goals")
          .insert({
            user_id: user.id,
            title: formData.title,
            description: formData.description || null,
            category: formData.category || null,
            target_value: parseFloat(formData.target_value) || 0,
            current_value: parseFloat(formData.current_value) || 0,
            unit: formData.unit,
            deadline: formData.deadline || null,
            color: formData.color,
            icon: formData.icon || null,
            status: 'active',
          });

        if (error) throw error;
        toast({
          title: "Success",
          description: "Goal created successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingGoal(null);
      resetForm();
      fetchGoals();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save goal",
        variant: "destructive",
      });
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;

    try {
      const maxOrder = milestones.length > 0 
        ? Math.max(...milestones.map(m => m.order_index))
        : -1;

      const { error } = await supabase
        .from("goal_milestones")
        .insert({
          goal_id: selectedGoal.id,
          title: milestoneForm.title,
          target_value: parseFloat(milestoneForm.target_value) || 0,
          order_index: maxOrder + 1,
        });

      if (error) throw error;
      toast({
        title: "Success",
        description: "Milestone added successfully",
      });
      setIsMilestoneDialogOpen(false);
      setMilestoneForm({ title: "", target_value: "" });
      fetchMilestones(selectedGoal.id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add milestone",
        variant: "destructive",
      });
    }
  };

  const handleUpdateProgress = async (goalId: string, newValue: number) => {
    try {
      const goal = goals.find(g => g.id === goalId);
      if (!goal) return;

      const updatedValue = Math.max(0, Math.min(newValue, goal.target_value));
      const isCompleted = updatedValue >= goal.target_value && goal.status === 'active';

      const { error } = await supabase
        .from("goals")
        .update({
          current_value: updatedValue,
          status: isCompleted ? 'completed' : goal.status,
          completed_at: isCompleted ? new Date().toISOString() : goal.completed_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", goalId);

      if (error) throw error;

      // Check and update milestones
      if (isCompleted) {
        const incompleteMilestones = milestones
          .filter(m => m.goal_id === goalId && !m.completed && m.target_value <= updatedValue);
        
        for (const milestone of incompleteMilestones) {
          await supabase
            .from("goal_milestones")
            .update({
              completed: true,
              completed_at: new Date().toISOString(),
            })
            .eq("id", milestone.id);
        }
      }

      fetchGoals();
      if (selectedGoal?.id === goalId) {
        fetchMilestones(goalId);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update progress",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (goalId: string, newStatus: Goal['status']) => {
    try {
      const { error } = await supabase
        .from("goals")
        .update({
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", goalId);

      if (error) throw error;
      fetchGoals();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (goalId: string) => {
    if (!confirm("Are you sure you want to delete this goal?")) return;

    try {
      const { error } = await supabase
        .from("goals")
        .delete()
        .eq("id", goalId);

      if (error) throw error;
      toast({
        title: "Success",
        description: "Goal deleted successfully",
      });
      if (selectedGoal?.id === goalId) {
        setSelectedGoal(null);
      }
      fetchGoals();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete goal",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      description: goal.description || "",
      category: goal.category || "work",
      target_value: goal.target_value.toString(),
      current_value: goal.current_value.toString(),
      unit: goal.unit,
      deadline: goal.deadline || "",
      color: goal.color,
      icon: goal.icon || "🎯",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "work",
      target_value: "",
      current_value: "",
      unit: "hours",
      deadline: "",
      color: "#3b82f6",
      icon: "🎯",
    });
  };

  const getProgressPercentage = (goal: Goal): number => {
    if (goal.target_value === 0) return 0;
    return Math.min((goal.current_value / goal.target_value) * 100, 100);
  };

  const getDaysRemaining = (deadline: string | null): number | null => {
    if (!deadline) return null;
    const deadlineDate = new Date(deadline);
    return differenceInDays(deadlineDate, new Date());
  };

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const pausedGoals = goals.filter(g => g.status === 'paused');

  if (loading) return null;

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-16 md:pt-0 md:ml-[var(--sidebar-width,5rem)] p-4 sm:p-6 transition-all duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-display mb-2 neon-text">Goals & Milestones</h1>
              <p className="text-sm text-muted-foreground">Set long-term goals and track your progress</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingGoal(null);
                  resetForm();
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Goal
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-primary/30 max-w-2xl max-h-[90vh]">
                <ScrollArea className="max-h-[85vh] pr-4">
                  <DialogHeader>
                    <DialogTitle className="font-display text-primary">
                      {editingGoal ? "Edit Goal" : "Create New Goal"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingGoal ? "Update your goal details and milestones" : "Set a new long-term goal with milestones"}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Goal Title *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                        className="bg-input border-primary/30"
                        placeholder="e.g., Complete 100 hours of coding"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="bg-input border-primary/30"
                        placeholder="What do you want to achieve?"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select
                          value={formData.category}
                          onValueChange={(v) => setFormData({ ...formData, category: v })}
                        >
                          <SelectTrigger id="category" className="bg-input border-primary/30">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="work">Work</SelectItem>
                            <SelectItem value="health">Health</SelectItem>
                            <SelectItem value="learning">Learning</SelectItem>
                            <SelectItem value="personal">Personal</SelectItem>
                            <SelectItem value="fitness">Fitness</SelectItem>
                            <SelectItem value="creative">Creative</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="unit">Unit</Label>
                        <Select
                          value={formData.unit}
                          onValueChange={(v) => setFormData({ ...formData, unit: v })}
                        >
                          <SelectTrigger id="unit" className="bg-input border-primary/30">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hours">Hours</SelectItem>
                            <SelectItem value="days">Days</SelectItem>
                            <SelectItem value="items">Items</SelectItem>
                            <SelectItem value="percent">Percent</SelectItem>
                            <SelectItem value="books">Books</SelectItem>
                            <SelectItem value="projects">Projects</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="target_value">Target Value *</Label>
                        <Input
                          id="target_value"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.target_value}
                          onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                          required
                          className="bg-input border-primary/30"
                          placeholder="100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="current_value">Current Value</Label>
                        <Input
                          id="current_value"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.current_value}
                          onChange={(e) => setFormData({ ...formData, current_value: e.target.value })}
                          className="bg-input border-primary/30"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="deadline">Deadline</Label>
                        <Input
                          id="deadline"
                          type="date"
                          value={formData.deadline}
                          onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                          className="bg-input border-primary/30"
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
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsDialogOpen(false);
                          setEditingGoal(null);
                          resetForm();
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                        {editingGoal ? "Update" : "Create"}
                      </Button>
                    </div>
                  </form>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>

          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active">Active ({activeGoals.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedGoals.length})</TabsTrigger>
              <TabsTrigger value="paused">Paused ({pausedGoals.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4 mt-6">
              {activeGoals.length === 0 ? (
                <Card className="glow-card p-12 text-center">
                  <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-display text-primary mb-2">No Active Goals</h3>
                  <p className="text-muted-foreground mb-4">
                    Set your first goal to start tracking your long-term progress!
                  </p>
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Goal
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {activeGoals.map((goal) => {
                    const progress = getProgressPercentage(goal);
                    const daysRemaining = getDaysRemaining(goal.deadline);

                    return (
                      <Card key={goal.id} className="glow-card p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3 flex-1">
                            <div
                              className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                              style={{ backgroundColor: `${goal.color}20` }}
                            >
                              {goal.icon || "🎯"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-display text-primary mb-1">{goal.title}</h3>
                              {goal.description && (
                                <p className="text-sm text-muted-foreground">{goal.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                {goal.category && (
                                  <span className="px-2 py-1 rounded bg-primary/10 text-primary">
                                    {goal.category}
                                  </span>
                                )}
                                {goal.deadline && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {daysRemaining !== null && (
                                      daysRemaining < 0 ? (
                                        <span className="text-red-400">Overdue</span>
                                      ) : daysRemaining === 0 ? (
                                        <span className="text-orange-400">Due today</span>
                                      ) : (
                                        <span>{daysRemaining} days left</span>
                                      )
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedGoal(goal);
                                setIsMilestoneDialogOpen(true);
                              }}
                              className="h-8 w-8"
                              title="Add Milestone"
                            >
                              <Flag className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(goal)}
                              className="h-8 w-8"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStatusChange(goal.id, 'paused')}
                              className="h-8 w-8"
                              title="Pause"
                            >
                              <Pause className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(goal.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-muted-foreground">Progress</span>
                            <span className="text-sm font-display text-primary">
                              {goal.current_value.toFixed(1)} / {goal.target_value.toFixed(1)} {goal.unit}
                            </span>
                          </div>
                          <div className="w-full bg-muted/30 rounded-full h-3 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${progress}%`,
                                backgroundColor: goal.color,
                              }}
                            />
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-muted-foreground">{progress.toFixed(0)}%</span>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUpdateProgress(goal.id, goal.current_value - 1)}
                                className="h-6 w-6 p-0"
                              >
                                <span className="text-xs">-</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUpdateProgress(goal.id, goal.current_value + 1)}
                                className="h-6 w-6 p-0"
                              >
                                <span className="text-xs">+</span>
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Milestones Preview */}
                        {milestones.filter(m => m.goal_id === goal.id).length > 0 && (
                          <div className="mt-4 pt-4 border-t border-primary/20">
                            <div className="flex items-center gap-2 mb-2">
                              <Award className="w-4 h-4 text-primary" />
                              <span className="text-xs font-display text-primary">Milestones</span>
                            </div>
                            <div className="space-y-1">
                              {milestones
                                .filter(m => m.goal_id === goal.id)
                                .slice(0, 3)
                                .map((milestone) => (
                                  <div key={milestone.id} className="flex items-center gap-2 text-xs">
                                    {milestone.completed ? (
                                      <CheckCircle2 className="w-3 h-3 text-green-400" />
                                    ) : (
                                      <Circle className="w-3 h-3 text-muted-foreground" />
                                    )}
                                    <span className={milestone.completed ? "line-through text-muted-foreground" : ""}>
                                      {milestone.title} ({milestone.target_value} {goal.unit})
                                    </span>
                                  </div>
                                ))}
                              {milestones.filter(m => m.goal_id === goal.id).length > 3 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedGoal(goal)}
                                  className="text-xs h-6"
                                >
                                  View all {milestones.filter(m => m.goal_id === goal.id).length} milestones
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4 mt-6">
              {completedGoals.length === 0 ? (
                <Card className="glow-card p-12 text-center">
                  <Award className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-display text-primary mb-2">No Completed Goals Yet</h3>
                  <p className="text-muted-foreground">Complete your first goal to see it here!</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {completedGoals.map((goal) => (
                    <Card key={goal.id} className="glow-card p-6 opacity-75">
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                          style={{ backgroundColor: `${goal.color}20` }}
                        >
                          {goal.icon || "🎯"}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-display text-primary">{goal.title}</h3>
                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                          </div>
                          {goal.completed_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Completed on {format(new Date(goal.completed_at), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStatusChange(goal.id, 'active')}
                            className="h-8 w-8"
                            title="Reactivate"
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(goal.id)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="w-full bg-muted/30 rounded-full h-2">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: "100%",
                            backgroundColor: goal.color,
                          }}
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="paused" className="space-y-4 mt-6">
              {pausedGoals.length === 0 ? (
                <Card className="glow-card p-12 text-center">
                  <Pause className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-display text-primary mb-2">No Paused Goals</h3>
                  <p className="text-muted-foreground">Paused goals will appear here</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {pausedGoals.map((goal) => (
                    <Card key={goal.id} className="glow-card p-6 opacity-60">
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                          style={{ backgroundColor: `${goal.color}20` }}
                        >
                          {goal.icon || "🎯"}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-display text-primary">{goal.title}</h3>
                          <p className="text-xs text-muted-foreground mt-1">Paused</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStatusChange(goal.id, 'active')}
                            className="h-8 w-8"
                            title="Resume"
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(goal.id)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Milestone Dialog */}
          <Dialog open={isMilestoneDialogOpen} onOpenChange={setIsMilestoneDialogOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary">
                  Add Milestone - {selectedGoal?.title}
                </DialogTitle>
                <DialogDescription>
                  Add a milestone to track progress toward your goal
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddMilestone} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="milestone_title">Milestone Title *</Label>
                  <Input
                    id="milestone_title"
                    value={milestoneForm.title}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                    required
                    className="bg-input border-primary/30"
                    placeholder="e.g., Reach 25 hours"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="milestone_target">Target Value *</Label>
                  <Input
                    id="milestone_target"
                    type="number"
                    step="0.01"
                    min="0"
                    value={milestoneForm.target_value}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, target_value: e.target.value })}
                    required
                    className="bg-input border-primary/30"
                    placeholder="25"
                  />
                  <p className="text-xs text-muted-foreground">
                    When progress reaches this value, the milestone will be marked complete
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsMilestoneDialogOpen(false);
                      setMilestoneForm({ title: "", target_value: "" });
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                    Add Milestone
                  </Button>
                </div>
              </form>

              {selectedGoal && milestones.filter(m => m.goal_id === selectedGoal.id).length > 0 && (
                <div className="mt-6 pt-6 border-t border-primary/20">
                  <h4 className="font-display text-primary mb-3">Existing Milestones</h4>
                  <ScrollArea className="h-48">
                    <div className="space-y-2 pr-4">
                      {milestones
                        .filter(m => m.goal_id === selectedGoal.id)
                        .map((milestone) => (
                          <div
                            key={milestone.id}
                            className={`p-3 rounded-lg border ${
                              milestone.completed
                                ? "bg-green-500/10 border-green-500/30"
                                : "bg-muted/20 border-primary/20"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {milestone.completed ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                                ) : (
                                  <Circle className="w-4 h-4 text-muted-foreground" />
                                )}
                                <span className={milestone.completed ? "line-through text-muted-foreground" : ""}>
                                  {milestone.title}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {milestone.target_value} {selectedGoal.unit}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default Goals;

