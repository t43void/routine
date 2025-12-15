import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Timer, 
  Folder, 
  CheckSquare, 
  Users, 
  Trophy, 
  Target, 
  Award, 
  Settings, 
  Zap,
  Sparkles,
  Rocket,
  Star,
  Coffee,
  TrendingUp,
  Flag,
  BarChart3,
  MessageCircle,
  UserCircle
} from "lucide-react";

const Documentation = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Calendar,
      title: "Daily Logging & Goals",
      emoji: "📅",
      description: "Track your daily progress and hours worked",
      details: [
        "Click any date on the calendar to log your activity",
        "Add hours worked and a description of what you accomplished",
        "Set daily hour targets for specific dates",
        "Use Markdown formatting for rich text descriptions",
        "Hours are automatically calculated from Pomodoro sessions! 🍅",
        "Track tasks and projects within each day's log"
      ]
    },
    {
      icon: Timer,
      title: "Pomodoro Timer",
      emoji: "🍅",
      description: "Stay focused with customizable work sessions",
      details: [
        "Start a work session (default: 25 minutes)",
        "Take breaks between sessions (10 min short, 15 min long)",
        "Customize durations in settings",
        "Hours automatically sync to your daily log!",
        "Enable sound alarms for session completion"
      ]
    },
    {
      icon: Folder,
      title: "Projects",
      emoji: "🎨",
      description: "Organize your work with colorful projects",
      details: [
        "Create projects with custom colors (like Clockify!)",
        "Each project has its own unique color identifier",
        "Archive projects you're no longer working on",
        "Projects help you track what you're working on"
      ]
    },
    {
      icon: CheckSquare,
      title: "Tasks",
      emoji: "✅",
      description: "Break down your day into manageable tasks",
      details: [
        "Add multiple tasks per day",
        "Link tasks to projects for better organization",
        "Track hours per task",
        "Mark tasks as complete when done",
        "See total hours for all tasks in a day"
      ]
    },
    {
      icon: Users,
      title: "Friends & Social",
      emoji: "👥",
      description: "Connect with friends and see their progress",
      details: [
        "Send friend requests to other users",
        "See friends' activities in your dashboard feed",
        "View friends' stats and progress",
        "Share your Pomodoro activities (toggle in Settings → Privacy)",
        "Get motivated by seeing what others are accomplishing!"
      ]
    },
    {
      icon: Trophy,
      title: "Leaderboard",
      emoji: "🏆",
      description: "Compete with the community",
      details: [
        "See who's logged the most hours",
        "Check your ranking among all users",
        "Climb the ranks by staying consistent",
        "Top performers get bragging rights! 💪"
      ]
    },
    {
      icon: Target,
      title: "Challenges",
      emoji: "🎯",
      description: "Join or create challenges with friends",
      details: [
        "Create weekly, daily, or total hour challenges",
        "Invite friends to participate",
        "Track progress in real-time",
        "Win challenges and earn recognition"
      ]
    },
    {
      icon: Award,
      title: "Badges & Achievements",
      emoji: "🎖️",
      description: "Earn rewards for your dedication",
      details: [
        "Earn badges for milestones (Bronze, Silver, Gold, Samurai, Warrior)",
        "Get time-based badges (Early Bird, Night Owl, Marathoner)",
        "Achieve streak milestones",
        "Collect achievements for your accomplishments",
        "Show off your progress with your badge collection!"
      ]
    },
    {
      icon: TrendingUp,
      title: "Streaks",
      emoji: "🔥",
      description: "Build consistency with daily streaks",
      details: [
        "Log hours daily to build your streak",
        "Track your current and longest streak",
        "Earn the Streak Master badge at 7 days",
        "Keep the fire burning! 🔥"
      ]
    },
    {
      icon: CheckSquare,
      title: "Habit Tracker",
      emoji: "✅",
      description: "Build consistency with daily habit tracking",
      details: [
        "Create habits with custom colors and icons",
        "Set target days per week (1-7 days)",
        "Mark completions on a weekly calendar view",
        "Track streaks and completion rates",
        "Visual progress bars show your consistency",
        "Archive habits you're no longer working on"
      ]
    },
    {
      icon: Flag,
      title: "Goals & Milestones",
      emoji: "🎯",
      description: "Set and track long-term goals with milestones",
      details: [
        "Create goals with deadlines and target values",
        "Track progress with visual progress bars",
        "Add milestones to break goals into smaller steps",
        "Automatic milestone completion when targets are reached",
        "Categorize goals (work, health, learning, etc.)",
        "Pause, complete, or cancel goals as needed",
        "View completed goals to celebrate achievements"
      ]
    },
    {
      icon: BarChart3,
      title: "Analytics & Weekly Review",
      emoji: "📊",
      description: "Get insights into your productivity patterns",
      details: [
        "Compare your progress with friends",
        "See rankings and leaderboards",
        "Weekly review with automatic insights",
        "Best day analysis and productivity trends",
        "Week-over-week comparisons",
        "Integration with Pomodoro and habit data",
        "Smart recommendations for improvement"
      ]
    },
    {
      icon: MessageCircle,
      title: "Chat & Messaging",
      emoji: "💬",
      description: "Connect and communicate with friends",
      details: [
        "Send encrypted messages to friends",
        "Group chats for team collaboration",
        "Reply to specific messages",
        "Send stickers and GIFs",
        "Mention users in group chats",
        "Real-time message updates",
        "Unread message notifications"
      ]
    },
    {
      icon: UserCircle,
      title: "Groups",
      emoji: "👥",
      description: "Create and join groups for collaboration",
      details: [
        "Create public or private groups",
        "Invite friends with invite codes",
        "Group messaging and announcements",
        "Share progress with your team",
        "Collaborate on challenges together"
      ]
    },
    {
      icon: Settings,
      title: "Settings & Privacy",
      emoji: "⚙️",
      description: "Customize your experience",
      details: [
        "Update your username and profile",
        "Change password and security settings",
        "Control Pomodoro activity sharing (Privacy tab)",
        "Customize Pomodoro timer settings",
        "Reset data if needed (use with caution!)"
      ]
    }
  ];

  const quickStartSteps = [
    {
      step: 1,
      title: "Log Your First Day",
      description: "Click on today's date in the Calendar and log your hours!",
      action: () => navigate("/calendar")
    },
    {
      step: 2,
      title: "Try the Pomodoro Timer",
      description: "Start a work session on the Dashboard and watch your hours auto-calculate!",
      action: () => navigate("/dashboard")
    },
    {
      step: 3,
      title: "Create a Habit",
      description: "Build consistency by creating your first habit to track daily!",
      action: () => navigate("/habits")
    },
    {
      step: 4,
      title: "Set a Goal",
      description: "Define a long-term goal with milestones to track your progress!",
      action: () => navigate("/goals")
    },
    {
      step: 5,
      title: "Add Friends",
      description: "Connect with others and see their progress in your activity feed!",
      action: () => navigate("/friends")
    }
  ];

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-16 md:pt-0 md:ml-[var(--sidebar-width,5rem)] p-4 sm:p-6 lg:p-8 transition-all duration-300">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Sparkles className="w-12 h-12 text-primary animate-pulse" />
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-display neon-text">
                Welcome to Lotus Routine!
              </h1>
              <Rocket className="w-12 h-12 text-secondary animate-bounce" />
            </div>
            <p className="text-xl sm:text-2xl text-muted-foreground mb-6">
              Your Ultimate Accountability Hub 🚀
            </p>
            <p className="text-lg text-foreground max-w-3xl mx-auto">
              Track your progress, compete with friends, build lasting habits, and become the best version of yourself. 
              Let's dive into how everything works!
            </p>
          </div>

          {/* Quick Start */}
          <Card className="glow-card p-6 sm:p-8 mb-8 border-primary/30">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="w-8 h-8 text-primary" />
              <h2 className="text-3xl font-display text-primary">Quick Start Guide</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickStartSteps.map((item) => (
                <Card
                  key={item.step}
                  className="p-4 border-primary/30 bg-card/50 hover:bg-card transition-colors cursor-pointer"
                  onClick={item.action}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-display text-lg">{item.step}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display text-primary text-lg mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>

          {/* Features Grid */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <Star className="w-8 h-8 text-secondary" />
              <h2 className="text-3xl font-display text-primary">Features Explained</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={index}
                    className="glow-card p-6 border-primary/30 hover:border-primary/50 transition-all hover:scale-105"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-display text-primary flex items-center gap-2">
                          {feature.emoji} {feature.title}
                        </h3>
                      </div>
                    </div>
                    <p className="text-muted-foreground mb-4">{feature.description}</p>
                    <ul className="space-y-2">
                      {feature.details.map((detail, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Pro Tips */}
          <Card className="glow-card p-6 sm:p-8 mb-8 border-secondary/30">
            <div className="flex items-center gap-3 mb-6">
              <Coffee className="w-8 h-8 text-secondary" />
              <h2 className="text-3xl font-display text-secondary">Pro Tips 💡</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                  <h4 className="font-display text-primary mb-2">🍅 Pomodoro Power</h4>
                  <p className="text-sm text-muted-foreground">
                    Use the Pomodoro timer throughout the day, and your hours will automatically 
                    calculate! Just add your description at the end of the day.
                  </p>
                </div>
                <div className="p-4 bg-secondary/10 rounded-lg border border-secondary/30">
                  <h4 className="font-display text-secondary mb-2">🎨 Color Your World</h4>
                  <p className="text-sm text-muted-foreground">
                    Create projects with distinct colors to quickly identify what you're working on. 
                    It's like having a visual workspace!
                  </p>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                  <h4 className="font-display text-primary mb-2">✅ Task Breakdown</h4>
                  <p className="text-sm text-muted-foreground">
                    Break your day into tasks and link them to projects. This helps you see exactly 
                    where your time goes!
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-secondary/10 rounded-lg border border-secondary/30">
                  <h4 className="font-display text-secondary mb-2">🔥 Keep the Streak</h4>
                  <p className="text-sm text-muted-foreground">
                    Log something every day to build your streak. Even 30 minutes counts! 
                    Consistency is key to building habits.
                  </p>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                  <h4 className="font-display text-primary mb-2">👥 Social Accountability</h4>
                  <p className="text-sm text-muted-foreground">
                    Add friends and share your Pomodoro activities. Seeing others work hard 
                    motivates you to do the same!
                  </p>
                </div>
                <div className="p-4 bg-secondary/10 rounded-lg border border-secondary/30">
                  <h4 className="font-display text-secondary mb-2">📝 Markdown Magic</h4>
                  <p className="text-sm text-muted-foreground">
                    Use Markdown in your daily descriptions! Add **bold**, *italic*, lists, 
                    and more to make your logs more engaging.
                  </p>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                  <h4 className="font-display text-primary mb-2">✅ Habit Stacking</h4>
                  <p className="text-sm text-muted-foreground">
                    Create habits that complement each other. Track multiple habits daily 
                    and watch your consistency grow!
                  </p>
                </div>
                <div className="p-4 bg-secondary/10 rounded-lg border border-secondary/30">
                  <h4 className="font-display text-secondary mb-2">🎯 Goal Breakdown</h4>
                  <p className="text-sm text-muted-foreground">
                    Break big goals into milestones. Each milestone completed brings you 
                    closer to your ultimate objective!
                  </p>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                  <h4 className="font-display text-primary mb-2">📊 Weekly Reviews</h4>
                  <p className="text-sm text-muted-foreground">
                    Check your Analytics page weekly for insights. See your best days, 
                    track improvements, and get personalized recommendations!
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Workflow Example */}
          <Card className="glow-card p-6 sm:p-8 mb-8 border-primary/30">
            <div className="flex items-center gap-3 mb-6">
              <Rocket className="w-8 h-8 text-primary" />
              <h2 className="text-3xl font-display text-primary">A Day in the Life 🎬</h2>
            </div>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-display">1</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-display text-primary mb-2">Morning: Start Your Day</h4>
                  <p className="text-muted-foreground">
                    Open the Pomodoro timer and start your first work session. 
                    Set your focus, work for 25 minutes, then take a break. Repeat!
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-display">2</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-display text-primary mb-2">Throughout the Day</h4>
                  <p className="text-muted-foreground">
                    Add tasks to your daily log, link them to projects, and keep completing Pomodoro sessions. 
                    Your hours are automatically tracked!
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-display">3</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-display text-primary mb-2">End of Day</h4>
                  <p className="text-muted-foreground">
                    Open the Calendar, click today's date, and add a description of what you accomplished. 
                    Your hours are already calculated from your Pomodoro sessions! 🎉
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-display">4</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-display text-primary mb-2">Track Habits & Goals</h4>
                  <p className="text-muted-foreground">
                    Mark your daily habits complete, update your goal progress, and watch your 
                    consistency grow. Small daily actions lead to big achievements! 🎯
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-display">5</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-display text-primary mb-2">Stay Connected</h4>
                  <p className="text-muted-foreground">
                    Check your friends' activities, see your rank on the leaderboard, celebrate 
                    your badges and achievements, and review your weekly insights. You're building something amazing! ✨
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Call to Action */}
          <Card className="glow-card p-8 text-center border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/10">
            <h2 className="text-3xl font-display text-primary mb-4">
              Ready to Level Up? 🚀
            </h2>
            <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
              You've got all the tools you need to build amazing habits and track your progress. 
              Start logging, stay consistent, and watch yourself grow!
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button
                onClick={() => navigate("/dashboard")}
                className="bg-primary hover:bg-primary/90"
                size="lg"
              >
                <Zap className="w-5 h-5 mr-2" />
                Go to Dashboard
              </Button>
              <Button
                onClick={() => navigate("/calendar")}
                variant="outline"
                size="lg"
                className="border-primary/30"
              >
                <Calendar className="w-5 h-5 mr-2" />
                View Calendar
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Documentation;

