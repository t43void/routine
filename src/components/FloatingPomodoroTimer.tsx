import { usePomodoro } from "@/contexts/PomodoroContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const getSessionEmoji = (sessionType: "work" | "short_break" | "long_break"): string => {
  if (sessionType === "work") return "🍅";
  if (sessionType === "short_break") return "☕";
  return "🌴";
};

export const FloatingPomodoroTimer = () => {
  const { timeLeft, isRunning, sessionType, startTimer, pauseTimer, resetTimer } = usePomodoro();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMinimized, setIsMinimized] = useState(true);

  // Don't show on dashboard (full timer is there) or auth pages
  if (location.pathname === "/dashboard" || location.pathname === "/" || location.pathname === "/auth") {
    return null;
  }

  // Don't show if timer is at default and not running
  if (!isRunning && timeLeft === 25 * 60 && sessionType === "work") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className={`glow-card border-primary/30 transition-all duration-300 ${
        isMinimized ? 'p-2' : 'p-4'
      }`}>
        {isMinimized ? (
          <div className="flex items-center gap-2">
            <span className="text-lg">{getSessionEmoji(sessionType)}</span>
            <span className="text-sm font-mono text-primary">{formatTime(timeLeft)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsMinimized(false)}
            >
              <span className="text-xs">▼</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getSessionEmoji(sessionType)}</span>
                <span className="text-lg font-mono text-primary">{formatTime(timeLeft)}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsMinimized(true)}
              >
                <span className="text-xs">▲</span>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={isRunning ? pauseTimer : startTimer}
                className="flex-1"
              >
                {isRunning ? (
                  <>
                    <Pause className="w-3 h-3 mr-1" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 mr-1" />
                    Start
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetTimer}
                className="flex-1"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="flex-1"
              >
                View
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

