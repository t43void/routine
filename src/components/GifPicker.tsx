import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GifPickerProps {
  onSelectGif: (gifUrl: string) => void;
  onClose: () => void;
}

// Giphy API - using public endpoint
// For production, get a free API key from https://developers.giphy.com/
// Or use Tenor API as fallback (no key required)
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY;
const GIPHY_BASE_URL = "https://api.giphy.com/v1/gifs";
const TENOR_API_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ"; // Public demo key

const GifPicker = ({ onSelectGif, onClose }: GifPickerProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [gifs, setGifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState<any[]>([]);
  const [showTrending, setShowTrending] = useState(true);

  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    try {
      setLoading(true);
      
      // Try Tenor first (more reliable, no API key needed)
      try {
        const response = await fetch(
          `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&client_key=neon-ledger&limit=20`
        );
        if (response.ok) {
          const data = await response.json();
          const formattedGifs = (data.results || []).map((gif: any) => ({
            id: gif.id,
            images: {
              fixed_height: {
                url: gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url,
              },
            },
            title: gif.content_description || "GIF",
          }));
          setTrending(formattedGifs);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.log("Tenor not available, trying Giphy");
      }
      
      // Fallback to Giphy if API key is available
      if (GIPHY_API_KEY && GIPHY_API_KEY !== "YOUR_GIPHY_API_KEY") {
        const response = await fetch(
          `${GIPHY_BASE_URL}/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`
        );
        
        if (response.ok) {
          const data = await response.json();
          setTrending(data.data || []);
          setLoading(false);
          return;
        }
      }
      
      // If both fail, show empty state
      setTrending([]);
    } catch (error) {
      console.error("Error fetching trending GIFs:", error);
      setTrending([]);
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      setShowTrending(true);
      return;
    }

    try {
      setLoading(true);
      setShowTrending(false);
      
      // Try Tenor first (more reliable)
      try {
        const response = await fetch(
          `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&client_key=neon-ledger&limit=20`
        );
        if (response.ok) {
          const data = await response.json();
          const formattedGifs = (data.results || []).map((gif: any) => ({
            id: gif.id,
            images: {
              fixed_height: {
                url: gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url,
              },
            },
            title: gif.content_description || "GIF",
          }));
          setGifs(formattedGifs);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.log("Tenor search failed, trying Giphy");
      }
      
      // Fallback to Giphy if API key is available
      if (GIPHY_API_KEY && GIPHY_API_KEY !== "YOUR_GIPHY_API_KEY") {
        const response = await fetch(
          `${GIPHY_BASE_URL}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`
        );
        
        if (response.ok) {
          const data = await response.json();
          setGifs(data.data || []);
          setLoading(false);
          return;
        }
      }
      
      // If both fail, show empty state
      setGifs([]);
    } catch (error) {
      console.error("Error searching GIFs:", error);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchGifs(searchQuery);
  };

  const handleSelectGif = (gif: any) => {
    const gifUrl = gif.images?.fixed_height?.url || gif.images?.downsized?.url || gif.url;
    if (gifUrl) {
      onSelectGif(gifUrl);
      onClose();
    }
  };

  const displayGifs = showTrending ? trending : gifs;

  return (
    <div className="w-96 bg-card border border-primary/30 rounded-lg p-4 max-h-[500px] flex flex-col">
      <div className="mb-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value.trim()) {
                setShowTrending(true);
              }
            }}
            placeholder="Search GIFs..."
            className="bg-input border-primary/30"
          />
          <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90">
            <Search className="w-4 h-4" />
          </Button>
        </form>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : displayGifs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No GIFs found</p>
            <p className="text-xs mt-2">Try a different search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-2">
            {displayGifs.map((gif) => {
              const gifUrl = gif.images?.fixed_height?.url || gif.images?.downsized?.url || gif.url;
              const previewUrl = gif.images?.fixed_height_small?.url || gifUrl;
              
              return (
                <Card
                  key={gif.id}
                  className="cursor-pointer hover:border-primary transition-colors overflow-hidden"
                  onClick={() => handleSelectGif(gif)}
                >
                  <img
                    src={previewUrl}
                    alt={gif.title || "GIF"}
                    className="w-full h-32 object-cover"
                    loading="lazy"
                  />
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default GifPicker;

