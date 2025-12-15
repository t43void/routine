import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Flame, Trophy, Zap, XCircle, Frown, AlertCircle, Droplet, AlertTriangle } from "lucide-react";

interface StreakDisplayProps {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: string;
}

const StreakDisplay = ({ currentStreak, longestStreak, lastActivityDate }: StreakDisplayProps) => {
  const [showCelebration, setShowCelebration] = useState(false);
  const [showStreakLoss, setShowStreakLoss] = useState(false);
  const [previousStreak, setPreviousStreak] = useState(currentStreak);

  // Funny messages for streak loss
  const streakLossMessages = [
    { emoji: "💀", message: "RIP your streak! It was fun while it lasted...", icon: XCircle },
    { emoji: "😭", message: "The streak has left the chat. Time to start over!", icon: Frown },
    { emoji: "🤦", message: "Oops! Your streak went on vacation without you.", icon: AlertCircle },
    { emoji: "😅", message: "Well, that happened. Back to day 1 we go!", icon: Droplet },
    { emoji: "💔", message: "Streak broken! Your consistency is crying.", icon: AlertTriangle },
    { emoji: "🔥💧", message: "The fire has been extinguished. Time to reignite!", icon: Flame },
  ];

  // Milestone celebrations
  const milestones = [7, 14, 30, 50, 100, 365];
  const milestoneMessages: Record<number, string> = {
    7: "🔥 Week Warrior! You're on fire!",
    14: "🔥🔥 Two weeks strong! Unstoppable!",
    30: "🔥🔥🔥 MONTH MASTER! You're a legend!",
    50: "🔥🔥🔥🔥 50 DAYS?! You're a machine!",
    100: "🔥🔥🔥🔥🔥 CENTURY CLUB! Absolute beast!",
    365: "🔥🔥🔥🔥🔥🔥 YEAR CHAMPION! You've achieved the impossible!",
  };

  useEffect(() => {
    // Check for milestone celebration
    if (currentStreak > previousStreak && milestones.includes(currentStreak)) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 5000);
    }

    // Check for streak loss
    if (currentStreak < previousStreak && previousStreak > 0) {
      setShowStreakLoss(true);
      setTimeout(() => setShowStreakLoss(false), 6000);
    }

    setPreviousStreak(currentStreak);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStreak]);

  // Get streak health indicator
  const getStreakHealth = () => {
    if (currentStreak === 0) return { color: "text-gray-400", glow: "", message: "No streak yet" };
    if (currentStreak < 3) return { color: "text-orange-300", glow: "shadow-orange-400/30", message: "Getting started!" };
    if (currentStreak < 7) return { color: "text-orange-400", glow: "shadow-orange-400/50", message: "Building momentum!" };
    if (currentStreak < 30) return { color: "text-orange-500", glow: "shadow-orange-500/60", message: "On fire!" };
    return { color: "text-red-500", glow: "shadow-red-500/70", message: "UNSTOPPABLE!" };
  };

  const health = getStreakHealth();
  const lossMessage = streakLossMessages[Math.floor(Math.random() * streakLossMessages.length)];

  // Check if streak is at risk (no activity today)
  const isAtRisk = lastActivityDate && new Date(lastActivityDate).toDateString() !== new Date().toDateString();

  return (
    <>
      <Card className="glow-card p-4 sm:p-6 animate-slide-up hover:scale-105 transition-all duration-300 animate-float relative overflow-hidden">
        {/* Celebration overlay */}
        {showCelebration && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center z-50 animate-fade-in">
            <div className="text-center p-4">
              <div className="text-4xl sm:text-6xl mb-2 sm:mb-4 animate-bounce-slow">🎉</div>
              <p className="text-lg sm:text-2xl font-display text-primary neon-text">
                {milestoneMessages[currentStreak] || "Milestone reached!"}
              </p>
            </div>
          </div>
        )}

        {/* Streak loss overlay */}
        {showStreakLoss && (
          <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center z-50 animate-fade-in">
            <div className="text-center p-4 sm:p-6">
              <div className="text-4xl sm:text-6xl mb-2 sm:mb-4 animate-bounce-slow">{lossMessage.emoji}</div>
              <p className="text-base sm:text-xl font-display text-destructive mb-2">{lossMessage.message}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Your previous streak: {previousStreak} days 🔥
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 sm:gap-4 relative z-10">
          <div className={`p-2 sm:p-3 bg-orange-500/20 rounded-lg animate-pulse-slow ${health.glow} flex-shrink-0`}>
            <Flame className={`w-6 h-6 sm:w-8 sm:h-8 ${health.color} animate-bounce-slow`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <p className="text-muted-foreground text-xs sm:text-sm">Current Streak</p>
              {isAtRisk && (
                <span className="text-[10px] sm:text-xs bg-yellow-500/20 text-yellow-400 px-1.5 sm:px-2 py-0.5 rounded animate-pulse">
                  ⚠️ At Risk
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1 sm:gap-2">
              <p className={`text-2xl sm:text-4xl font-display ${health.color} animate-fade-in`}>
                {currentStreak}
              </p>
              <span className="text-xl sm:text-2xl">🔥</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground ml-1 sm:ml-2">days</span>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{health.message}</p>
          </div>
        </div>

        {/* Streak progress bar */}
        {currentStreak > 0 && (
          <div className="mt-4 pt-4 border-t border-primary/20">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-muted-foreground">Longest Streak</span>
              <span className="text-xs font-display text-accent">
                <Trophy className="w-3 h-3 inline mr-1" />
                {longestStreak} days
              </span>
            </div>
            <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full bg-gradient-to-r from-orange-400 to-red-500 ${
                  currentStreak >= longestStreak ? "animate-pulse-slow" : ""
                }`}
                style={{ width: `${Math.min((currentStreak / Math.max(longestStreak, 1)) * 100, 100)}%` }}
              />
            </div>
            {currentStreak === longestStreak && currentStreak > 0 && (
              <p className="text-xs text-accent mt-1 animate-pulse-slow">
                🏆 Personal Best!
              </p>
            )}
          </div>
        )}

        {/* Next milestone indicator */}
        {currentStreak > 0 && (
          <div className="mt-3 pt-3 border-t border-primary/10">
            {(() => {
              const nextMilestone = milestones.find(m => m > currentStreak);
              if (nextMilestone) {
                const progress = (currentStreak / nextMilestone) * 100;
                return (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-muted-foreground">Next Milestone</span>
                      <span className="text-xs font-display text-primary">
                        {nextMilestone} days {milestoneMessages[nextMilestone] ? "🎯" : ""}
                      </span>
                    </div>
                    <div className="w-full bg-muted/20 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full transition-all duration-500 rounded-full bg-gradient-to-r from-primary to-secondary"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              }
              return (
                <p className="text-xs text-accent text-center animate-pulse-slow">
                  <Zap className="w-3 h-3 inline mr-1" />
                  You've hit all milestones! Keep going! 🔥
                </p>
              );
            })()}
          </div>
        )}
      </Card>
    </>
  );
};

export default StreakDisplay;

