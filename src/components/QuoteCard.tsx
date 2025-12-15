import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface Quote {
  quote: string;
  author: string;
}

const QuoteCard = () => {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    const fetchQuotes = async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("quote, author");

      if (data && !error) {
        setAllQuotes(data);
        const randomQuote = data[Math.floor(Math.random() * data.length)];
        setQuote(randomQuote);
      }
    };

    fetchQuotes();
  }, []);

  useEffect(() => {
    if (allQuotes.length === 0) return;

    const changeQuote = () => {
      const randomQuote = allQuotes[Math.floor(Math.random() * allQuotes.length)];
      setQuote(randomQuote);
    };

    // Change quote every 30 minutes (1800000 ms)
    const interval = setInterval(changeQuote, 1800000);

    return () => clearInterval(interval);
  }, [allQuotes]);

  if (!quote) return null;

  return (
    <Card className="glow-card p-6 relative overflow-hidden animate-slide-up hover:scale-105 transition-transform duration-300">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl animate-pulse-slow"></div>
      <div className="relative z-10">
        <Sparkles className="w-8 h-8 text-primary mb-4 animate-pulse-slow animate-spin-slow" />
        <blockquote className="text-lg md:text-xl font-medium mb-4 text-foreground animate-fade-in">
          "{quote.quote}"
        </blockquote>
        <p className="text-secondary font-display text-sm animate-fade-in-delay">— {quote.author}</p>
      </div>
    </Card>
  );
};

export default QuoteCard;
