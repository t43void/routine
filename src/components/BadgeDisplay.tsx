import { Award, Sun, Moon, Zap, Target, Trophy, Star, Flame } from "lucide-react";

type BadgeType = "bronze" | "silver" | "gold" | "samurai" | "warrior" | "early_bird" | "night_owl" | "marathoner" | "sprinter" | "streak_master" | "first_achievement" | "achievement_collector" | "dedicated" | "unstoppable";

interface BadgeDisplayProps {
  type: BadgeType;
  earned?: boolean;
}

const badgeConfig: Record<BadgeType, { name: string; description: string; icon: React.ElementType; color: string; glow: string }> = {
  bronze: { name: "Bronze", description: "10h", icon: Award, color: "text-orange-400", glow: "shadow-orange-400/50" },
  silver: { name: "Silver", description: "50h", icon: Award, color: "text-gray-300", glow: "shadow-gray-300/50" },
  gold: { name: "Gold", description: "150h", icon: Award, color: "text-yellow-400", glow: "shadow-yellow-400/50" },
  samurai: { name: "Samurai", description: "300h", icon: Award, color: "text-primary", glow: "shadow-primary/50" },
  warrior: { name: "Warrior", description: "500h", icon: Award, color: "text-secondary", glow: "shadow-secondary/50" },
  early_bird: { name: "Early Bird", description: "Log before 8 AM", icon: Sun, color: "text-yellow-300", glow: "shadow-yellow-300/50" },
  night_owl: { name: "Night Owl", description: "Log after 10 PM", icon: Moon, color: "text-indigo-400", glow: "shadow-indigo-400/50" },
  marathoner: { name: "Marathoner", description: "8+ hours/day", icon: Zap, color: "text-blue-400", glow: "shadow-blue-400/50" },
  sprinter: { name: "Sprinter", description: "Quick & focused", icon: Target, color: "text-green-400", glow: "shadow-green-400/50" },
  streak_master: { name: "Streak Master", description: "7 days in a row", icon: Flame, color: "text-red-400", glow: "shadow-red-400/50" },
  first_achievement: { name: "First Step", description: "First achievement", icon: Star, color: "text-purple-400", glow: "shadow-purple-400/50" },
  achievement_collector: { name: "Collector", description: "10+ achievements", icon: Trophy, color: "text-pink-400", glow: "shadow-pink-400/50" },
  dedicated: { name: "Dedicated", description: "30 days active", icon: Star, color: "text-cyan-400", glow: "shadow-cyan-400/50" },
  unstoppable: { name: "Unstoppable", description: "100 days active", icon: Flame, color: "text-orange-500", glow: "shadow-orange-500/50" },
};

const BadgeDisplay = ({ type, earned = false }: BadgeDisplayProps) => {
  const config = badgeConfig[type];
  const Icon = config.icon;

  return (
    <div className={`flex flex-col items-center p-4 rounded-lg border transition-all duration-500 ${
      earned
        ? 'border-primary/50 bg-card hover:border-primary hover:shadow-lg hover:scale-110 animate-badge-glow'
        : 'border-muted/30 bg-card/50 opacity-50 hover:opacity-70'
    }`}>
      <Icon
        className={`w-12 h-12 transition-all duration-500 ${earned ? config.color : 'text-muted'} ${
          earned ? `drop-shadow-[0_0_12px] ${config.glow} animate-bounce-slow` : ''
        }`}
      />
      <h3 className={`font-display text-sm mt-2 ${earned ? config.color : 'text-muted'}`}>
        {config.name}
      </h3>
      <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
    </div>
  );
};

export default BadgeDisplay;
