// Update this page (the content is just a fallback if you fail to update the page)

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Zap } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-primary text-2xl font-display">Loading...</div>
    </div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 cyber-grid">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10"></div>
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <div className="mb-8">
          <Zap className="w-20 h-20 mx-auto text-primary animate-glow mb-4" />
          <h1 className="text-5xl md:text-7xl font-display neon-text mb-4 tracking-wider animate-pulse">Lotus Routine</h1>
          <div className="neon-line mx-auto w-64 mb-8"></div>
          <p className="text-xl md:text-2xl text-muted-foreground mb-4 animate-fade-in">Your Accountability Hub</p>
        </div>
        <Button onClick={() => navigate("/auth")} size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6">
          Enter the Grid
        </Button>
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glow-card p-6 animate-slide-up hover:scale-105 transition-all duration-300 animate-float">
            <h3 className="font-display text-xl text-primary mb-2 animate-fade-in">Track Progress</h3>
            <p className="text-muted-foreground animate-fade-in-delay">Log your daily hours</p>
          </div>
          <div className="glow-card p-6 animate-slide-up hover:scale-105 transition-all duration-300 animate-float" style={{ animationDelay: '0.1s' }}>
            <h3 className="font-display text-xl text-secondary mb-2 animate-fade-in">Compete</h3>
            <p className="text-muted-foreground animate-fade-in-delay">Battle on the leaderboard</p>
          </div>
          <div className="glow-card p-6 animate-slide-up hover:scale-105 transition-all duration-300 animate-float" style={{ animationDelay: '0.2s' }}>
            <h3 className="font-display text-xl text-accent mb-2 animate-fade-in">Earn Badges</h3>
            <p className="text-muted-foreground animate-fade-in-delay">Unlock achievements</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
