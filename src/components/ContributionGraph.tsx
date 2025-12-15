import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, startOfWeek, eachDayOfInterval, isSameDay, startOfYear, endOfYear, getYear } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { mixColors } from "@/utils/colorMixer";

interface Project {
  id: string;
  name: string;
  color: string;
}

interface DayContribution {
  color: string;
  projects: Array<{ name: string; hours: number; color: string }>;
}

interface Task {
  id: string;
  task_date: string;
  project_id: string;
  project?: Project;
}

interface ContributionGraphProps {
  userId: string;
  isViewingFriend?: boolean;
}

const ContributionGraph = ({ userId, isViewingFriend = false }: ContributionGraphProps) => {
  const [contributions, setContributions] = useState<Map<string, DayContribution>>(new Map());
  const [projects, setProjects] = useState<Map<string, Project>>(new Map());
  const [selectedYear, setSelectedYear] = useState(getYear(new Date()));

  useEffect(() => {
    fetchContributions();
  }, [userId, selectedYear, isViewingFriend]);

  const fetchContributions = async () => {
    // Get the selected year (January 1 to December 31)
    const yearStart = new Date(selectedYear, 0, 1); // January 1
    const yearEnd = new Date(selectedYear, 11, 31); // December 31

    if (isViewingFriend) {
      // Use secure function for friends' contribution graphs
      const { data: graphData, error } = await supabase
        .rpc('get_contribution_graph_data', {
          p_user_id: userId,
          p_year_start: format(yearStart, "yyyy-MM-dd"),
          p_year_end: format(yearEnd, "yyyy-MM-dd")
        });

      if (error) {
        console.error("Error fetching contribution graph:", error);
        setContributions(new Map());
        setProjects(new Map());
        return;
      }

      // Build contributions map from function results
      // Group by date to collect all projects for each day
      const dailyProjects = new Map<string, Array<{ name: string; hours: number; color: string }>>();
      const projectsMap = new Map<string, Project>();
      const colorToProjectMap = new Map<string, { id: string; name: string; color: string }>();

      graphData?.forEach((item) => {
        const dateKey = item.date_key;
        const color = item.color || '#3b82f6';
        const projectName = item.project_name || 'General Work';

        // Create a project entry for this color if it doesn't exist
        if (!colorToProjectMap.has(color)) {
          const projectId = `project-${colorToProjectMap.size}`;
          const project: Project = {
            id: projectId,
            name: projectName,
            color: color,
          };
          colorToProjectMap.set(color, project);
          projectsMap.set(projectId, project);
        }

        // Collect all projects for this day (for color mixing)
        if (!dailyProjects.has(dateKey)) {
          dailyProjects.set(dateKey, []);
        }
        // Use hours from database for proper color mixing
        const hours = typeof item.total_hours === 'number' ? item.total_hours : (item.total_hours ? parseFloat(item.total_hours) : 1);
        dailyProjects.get(dateKey)!.push({
          name: projectName,
          hours: hours,
          color: color,
        });
      });

      // Mix colors for each day
      const contributionsMap = new Map<string, DayContribution>();
      dailyProjects.forEach((projects, dateKey) => {
        if (projects.length > 0) {
          const colorsToMix = projects.map(p => ({ color: p.color, hours: p.hours }));
          const mixedColor = mixColors(colorsToMix);
          contributionsMap.set(dateKey, {
            color: mixedColor,
            projects: projects,
          });
        }
      });

      setProjects(projectsMap);
      setContributions(contributionsMap);
      return;
    }

    // Own profile - use direct queries
    // Fetch daily logs for the current year
    const { data: logs } = await supabase
      .from("daily_logs")
      .select("log_date, hours_worked")
      .eq("user_id", userId)
      .gte("log_date", format(yearStart, "yyyy-MM-dd"))
      .lte("log_date", format(yearEnd, "yyyy-MM-dd"))
      .order("log_date", { ascending: true });

    // Fetch all completed tasks for the current year
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, task_date, project_id, hours, completed")
      .eq("user_id", userId)
      .gte("task_date", format(yearStart, "yyyy-MM-dd"))
      .lte("task_date", format(yearEnd, "yyyy-MM-dd"))
      .eq("completed", true) // Only completed tasks
      .order("task_date", { ascending: true });

    // Get unique project IDs from tasks that actually have projects
    const projectIds = tasks?.filter(t => t.project_id).map(t => t.project_id) || [];
    const uniqueProjectIds = [...new Set(projectIds)];
    
    // Fetch projects only if there are tasks with projects
    let projectsMap = new Map<string, Project>();
    if (uniqueProjectIds.length > 0) {
      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, name, color")
        .in("id", uniqueProjectIds);

      if (projectsData) {
        projectsData.forEach((project) => {
          projectsMap.set(project.id, project);
        });
      }
    }

    // Default project for days with logs/tasks but no project
    const defaultProject: Project = {
      id: 'default',
      name: 'General Work',
      color: '#3b82f6', // Default blue color
    };

    // Build contributions map - only from actual logs and completed tasks
    const contributionsMap = new Map<string, Project>();
    
    // Add days with daily logs (these are actual work days)
    logs?.forEach((log) => {
      if (log.log_date && Number(log.hours_worked) > 0) {
        const dateKey = log.log_date;
        // Only add if no project task exists for this day
        if (!contributionsMap.has(dateKey)) {
          contributionsMap.set(dateKey, {
            color: defaultProject.color,
            projects: [{ name: defaultProject.name, hours: Number(log.hours_worked), color: defaultProject.color }],
          });
        }
      }
    });

    // Process completed tasks - prioritize project colors
    const dailyProjectHours = new Map<string, Map<string, number>>(); // date -> projectId -> hours

    tasks?.forEach((task) => {
      if (task.task_date && task.completed && Number(task.hours || 0) > 0) {
        const dateKey = task.task_date;
        const hours = Number(task.hours || 0);
        
        if (task.project_id) {
          // Task with project - track hours per project per day
          if (!dailyProjectHours.has(dateKey)) {
            dailyProjectHours.set(dateKey, new Map());
          }
          
          const dayProjects = dailyProjectHours.get(dateKey)!;
          const currentHours = dayProjects.get(task.project_id) || 0;
          dayProjects.set(task.project_id, currentHours + hours);
        } else {
          // Task without project - use default only if no log exists
          if (!contributionsMap.has(dateKey)) {
            contributionsMap.set(dateKey, {
              color: defaultProject.color,
              projects: [{ name: defaultProject.name, hours: hours, color: defaultProject.color }],
            });
          } else {
            // Add to existing default project hours
            const existing = contributionsMap.get(dateKey);
            if (existing && existing.projects.length === 1 && existing.projects[0].name === defaultProject.name) {
              existing.projects[0].hours += hours;
            }
          }
        }
      }
    });

    // For each day with project tasks, collect all projects and mix their colors
    dailyProjectHours.forEach((projectHours, dateKey) => {
      const dayProjects: Array<{ name: string; hours: number; color: string }> = [];
      const colorsToMix: Array<{ color: string; hours: number }> = [];
      
      projectHours.forEach((hours, projectId) => {
        const project = projectsMap.get(projectId);
        if (project) {
          dayProjects.push({
            name: project.name,
            hours: hours,
            color: project.color,
          });
          colorsToMix.push({
            color: project.color,
            hours: hours,
          });
        }
      });
      
      if (colorsToMix.length > 0) {
        // Mix colors based on hours worked
        const mixedColor = mixColors(colorsToMix);
        contributionsMap.set(dateKey, {
          color: mixedColor,
          projects: dayProjects,
        });
      }
    });

    // Add default project to projects map only if there are actual contributions
    const hasDefaultContributions = Array.from(contributionsMap.values()).some(
      c => c.projects.some(p => p.name === defaultProject.name)
    );
    if (hasDefaultContributions) {
      projectsMap.set('default', defaultProject);
    }

    setProjects(projectsMap);
    setContributions(contributionsMap);
  };

  // Generate the graph - GitHub style: 7 rows (days of week) x ~53 columns (weeks)
  // Show full calendar year: January 1 to December 31
  const daysPerWeek = 7;
  const today = new Date();
  const yearStart = new Date(selectedYear, 0, 1); // January 1 of selected year
  const yearEnd = new Date(selectedYear, 11, 31); // December 31 of selected year
  
  // Start from the Sunday of the week containing January 1st
  const startOfGraph = startOfWeek(yearStart, { weekStartsOn: 0 }); // Start from Sunday
  const endOfGraph = yearEnd; // End on December 31

  // Generate all days for the full year
  const allDays = eachDayOfInterval({
    start: startOfGraph,
    end: endOfGraph,
  });

  // Group days by week (each week is a column)
  const weeksData: Date[][] = [];
  for (let i = 0; i < allDays.length; i += daysPerWeek) {
    const week = allDays.slice(i, i + daysPerWeek);
    if (week.length > 0) {
      weeksData.push(week);
    }
  }

  // Get contribution level (intensity) for a day
  const getContributionLevel = (date: Date): { contribution: DayContribution | null; level: number } => {
    const dateKey = format(date, "yyyy-MM-dd");
    const contribution = contributions.get(dateKey);
    
    if (!contribution) {
      return { contribution: null, level: 0 };
    }

    // Level 1 for any contribution
    return { contribution, level: 1 };
  };

  // Generate year options (current year and previous 5 years)
  const currentYear = getYear(new Date());
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <Card className="glow-card p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h3 className="text-lg font-display text-primary">Contribution Graph</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedYear(selectedYear - 1)}
            disabled={selectedYear <= currentYear - 5}
            className="h-8 w-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue>{selectedYear}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedYear(selectedYear + 1)}
            disabled={selectedYear >= currentYear}
            className="h-8 w-8"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        <TooltipProvider>
          {weeksData.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {week.map((day, dayIndex) => {
                const { contribution, level } = getContributionLevel(day);
                const isToday = selectedYear === currentYear && isSameDay(day, today);
                const dateKey = format(day, "yyyy-MM-dd");
                const isFuture = day > today || getYear(day) > currentYear;
                
                return (
                  <Tooltip key={`${weekIndex}-${dayIndex}`}>
                    <TooltipTrigger asChild>
                      <div
                        className={`
                          w-3 h-3 rounded-sm cursor-pointer transition-all hover:scale-125 hover:ring-2 hover:ring-primary/50
                          border border-yellow-400/40
                          ${isToday ? 'ring-2 ring-primary' : ''}
                          ${isFuture ? 'opacity-30' : ''}
                        `}
                        style={contribution && !isFuture 
                          ? { backgroundColor: contribution.color, opacity: Math.max(0.3, level * 0.3 + 0.4) }
                          : undefined
                        }
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">
                        {contribution ? (
                          <>
                            <p className="font-semibold">
                              {contribution.projects.length === 1
                                ? contribution.projects[0].name
                                : `${contribution.projects.length} Projects`}
                            </p>
                            {contribution.projects.length > 1 && (
                              <div className="mt-1 space-y-1">
                                {contribution.projects.map((p, idx) => (
                                  <p key={idx} className="text-xs text-muted-foreground">
                                    {p.name}: {p.hours.toFixed(1)}h
                                  </p>
                                ))}
                              </div>
                            )}
                            <p className="text-muted-foreground mt-1">
                              {format(day, "MMM d, yyyy")}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold">No contributions</p>
                            <p className="text-muted-foreground">
                              {format(day, "MMM d, yyyy")}
                            </p>
                          </>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </TooltipProvider>
      </div>
      
      {/* Legend */}
      {projects.size > 0 && (
        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <span className="text-sm text-muted-foreground">Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-muted/20" />
            <div className="w-3 h-3 rounded-sm bg-muted/40" />
            <div className="w-3 h-3 rounded-sm bg-muted/60" />
            <div className="w-3 h-3 rounded-sm bg-muted/80" />
          </div>
          <span className="text-sm text-muted-foreground">More</span>
          <div className="ml-4 flex flex-wrap gap-2">
            {Array.from(projects.values()).map((project) => (
              <div key={project.id} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: project.color }}
                />
                <span className="text-xs text-muted-foreground">{project.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default ContributionGraph;

