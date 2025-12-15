import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, CheckCircle2, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";

interface Project {
  id: string;
  name: string;
  color: string;
  archived: boolean;
}

interface Task {
  id: string;
  name: string;
  description: string | null;
  project_id: string | null;
  daily_log_id: string | null;
  task_date: string;
  hours: number;
  completed: boolean;
  project?: Project;
}

interface TasksManagerProps {
  date: string; // YYYY-MM-DD format
  dailyLogId?: string;
  onTasksChange?: () => void;
}

export const TasksManager = ({ date, dailyLogId, onTasksChange }: TasksManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskName, setTaskName] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskHours, setTaskHours] = useState("0");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("none");

  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchProjects();
    }
  }, [user, date, dailyLogId]);

  const fetchProjects = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching projects:", error);
    } else {
      setProjects(data || []);
    }
  };

  const fetchTasks = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("tasks")
      .select(`
        *,
        project:projects(*)
      `)
      .eq("user_id", user.id)
      .eq("task_date", date)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive",
      });
    } else {
      setTasks(data || []);
    }
  };

  const handleCreateTask = async () => {
    if (!user || !taskName.trim()) return;

    try {
      const taskData: any = {
        user_id: user.id,
        name: taskName.trim(),
        description: taskDescription.trim() || null,
        task_date: date,
        hours: parseFloat(taskHours) || 0,
        project_id: selectedProjectId === "none" ? null : selectedProjectId,
        daily_log_id: dailyLogId || null,
      };

      const { error } = await supabase.from("tasks").insert(taskData);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Task created successfully",
      });
      setIsDialogOpen(false);
      resetForm();
      fetchTasks();
      onTasksChange?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create task",
        variant: "destructive",
      });
    }
  };

  const handleEditTask = async () => {
    if (!editingTask || !taskName.trim()) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          name: taskName.trim(),
          description: taskDescription.trim() || null,
          hours: parseFloat(taskHours) || 0,
          project_id: selectedProjectId === "none" ? null : selectedProjectId,
        })
        .eq("id", editingTask.id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Task updated successfully",
      });
      setIsDialogOpen(false);
      setEditingTask(null);
      resetForm();
      fetchTasks();
      onTasksChange?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update task",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) {
      return;
    }

    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);

      if (error) throw error;

      toast({
        title: "Deleted!",
        description: "Task has been removed",
      });
      fetchTasks();
      onTasksChange?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const handleToggleComplete = async (task: Task) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ completed: !task.completed })
        .eq("id", task.id);

      if (error) throw error;

      fetchTasks();
      onTasksChange?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setTaskName(task.name);
    setTaskDescription(task.description || "");
    setTaskHours(task.hours.toString());
    setSelectedProjectId(task.project_id || "none");
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingTask(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setTaskName("");
    setTaskDescription("");
    setTaskHours("0");
    setSelectedProjectId("none");
  };

  const totalHours = tasks.reduce((sum, task) => sum + Number(task.hours), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-display text-primary">Tasks</h3>
          <p className="text-xs text-muted-foreground">
            {format(new Date(date), "MMMM d, yyyy")} • Total: {totalHours.toFixed(1)}h
          </p>
        </div>
        <Button onClick={openCreateDialog} size="sm" className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <Card className="p-4 text-center border-primary/30 bg-card">
            <p className="text-sm text-muted-foreground">No tasks for this day. Add your first task!</p>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card
              key={task.id}
              className={`p-3 border-primary/30 bg-card ${
                task.completed ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1">
                  <button
                    onClick={() => handleToggleComplete(task)}
                    className="mt-0.5"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {task.project && (
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: task.project.color }}
                          title={task.project.name}
                        />
                      )}
                      <span
                        className={`font-medium ${
                          task.completed ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {task.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Number(task.hours).toFixed(1)}h
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(task)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTask(task.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-primary/30">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">
              {editingTask ? "Edit Task" : "Add Task"}
            </DialogTitle>
            <DialogDescription>
              {editingTask
                ? "Update your task details"
                : "Add a new task for this day"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-name">Task Name</Label>
              <Input
                id="task-name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="e.g., Fix login bug"
                className="bg-input border-primary/30"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description (Optional)</Label>
              <Textarea
                id="task-description"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Add details about this task..."
                className="bg-input border-primary/30 min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-hours">Hours</Label>
                <Input
                  id="task-hours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={taskHours}
                  onChange={(e) => setTaskHours(e.target.value)}
                  className="bg-input border-primary/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-project">Project</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="bg-input border-primary/30">
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          {project.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingTask(null);
                  resetForm();
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={editingTask ? handleEditTask : handleCreateTask}
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={!taskName.trim()}
              >
                {editingTask ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

