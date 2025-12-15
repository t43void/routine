import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ColorPicker } from "@/components/ColorPicker";
import { Plus, Edit2, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Project {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  created_at: string;
}

export const ProjectsManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectColor, setProjectColor] = useState("#3b82f6");

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching projects:", error);
      toast({
        title: "Error",
        description: "Failed to load projects",
        variant: "destructive",
      });
    } else {
      setProjects(data || []);
    }
  };

  const handleCreateProject = async () => {
    if (!user || !projectName.trim()) return;

    try {
      const { error } = await supabase.from("projects").insert({
        user_id: user.id,
        name: projectName.trim(),
        color: projectColor,
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Project created successfully",
      });
      setIsDialogOpen(false);
      setProjectName("");
      setProjectColor("#3b82f6");
      fetchProjects();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create project",
        variant: "destructive",
      });
    }
  };

  const handleEditProject = async () => {
    if (!editingProject || !projectName.trim()) return;

    try {
      const { error } = await supabase
        .from("projects")
        .update({
          name: projectName.trim(),
          color: projectColor,
        })
        .eq("id", editingProject.id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Project updated successfully",
      });
      setIsDialogOpen(false);
      setEditingProject(null);
      setProjectName("");
      setProjectColor("#3b82f6");
      fetchProjects();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update project",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project? This will also remove all associated tasks.")) {
      return;
    }

    try {
      const { error } = await supabase.from("projects").delete().eq("id", projectId);

      if (error) throw error;

      toast({
        title: "Deleted!",
        description: "Project has been removed",
      });
      fetchProjects();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete project",
        variant: "destructive",
      });
    }
  };

  const handleToggleArchive = async (project: Project) => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({ archived: !project.archived })
        .eq("id", project.id);

      if (error) throw error;

      toast({
        title: project.archived ? "Restored!" : "Archived!",
        description: `Project ${project.archived ? "restored" : "archived"} successfully`,
      });
      fetchProjects();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update project",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setProjectName(project.name);
    setProjectColor(project.color);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProject(null);
    setProjectName("");
    setProjectColor("#3b82f6");
    setIsDialogOpen(true);
  };

  const activeProjects = projects.filter((p) => !p.archived);
  const archivedProjects = projects.filter((p) => p.archived);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-display text-primary">Projects</h3>
        <Button onClick={openCreateDialog} size="sm" className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      <div className="space-y-3">
        {activeProjects.length === 0 && archivedProjects.length === 0 ? (
          <Card className="p-6 text-center border-primary/30 bg-card">
            <p className="text-muted-foreground">No projects yet. Create your first project!</p>
          </Card>
        ) : (
          <>
            {activeProjects.map((project) => (
              <Card
                key={project.id}
                className="p-3 border-primary/30 bg-card flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="font-medium">{project.name}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(project)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleArchive(project)}
                  >
                    <Archive className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteProject(project.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}

            {archivedProjects.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Archived</h4>
                {archivedProjects.map((project) => (
                  <Card
                    key={project.id}
                    className="p-3 border-primary/30 bg-card/50 flex items-center justify-between opacity-60"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="font-medium">{project.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleArchive(project)}
                      >
                        <ArchiveRestore className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProject(project.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-primary/30">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">
              {editingProject ? "Edit Project" : "Create Project"}
            </DialogTitle>
            <DialogDescription>
              {editingProject
                ? "Update your project details"
                : "Create a new project to organize your tasks"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., Web Development"
                className="bg-input border-primary/30"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Project Color</Label>
              <ColorPicker color={projectColor} onChange={setProjectColor} />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingProject(null);
                  setProjectName("");
                  setProjectColor("#3b82f6");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={editingProject ? handleEditProject : handleCreateProject}
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={!projectName.trim()}
              >
                {editingProject ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

