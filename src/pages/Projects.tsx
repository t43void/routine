import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import { ProjectsManager } from "@/components/ProjectsManager";
import { Card } from "@/components/ui/card";

const Projects = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) return null;

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-16 md:pt-0 md:ml-[var(--sidebar-width,5rem)] p-4 sm:p-6 lg:p-8 transition-all duration-300">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display mb-2 neon-text">
              Projects
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Organize your work with projects. Each project has its own color for easy identification.
            </p>
          </div>

          <Card className="glow-card p-4 sm:p-6">
            <ProjectsManager />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Projects;
