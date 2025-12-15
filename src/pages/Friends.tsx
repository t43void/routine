import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { UserPlus, Users, UserCheck, UserX, Search, Trophy, Zap, Flame, MessageCircle } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  status: 'pending' | 'accepted' | 'blocked';
  is_requester: boolean;
  total_hours: number;
  current_streak: number;
  badges_count: number;
}

const Friends = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchPendingRequests();
    }
  }, [user]);

  const fetchFriends = async () => {
    if (!user) return;

    // Fetch accepted friendships
    const { data: friendships } = await supabase
      .from("friendships")
      .select("*")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq("status", "accepted");

    if (!friendships) return;

    const friendIds = friendships.map(f => 
      f.user_id === user.id ? f.friend_id : f.user_id
    );

    if (friendIds.length === 0) {
      setFriends([]);
      return;
    }

    // Fetch friend profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", friendIds);

    // Fetch friend stats using secure function
    const friendsWithStats = await Promise.all(
      (profiles || []).map(async (profile) => {
        // Use secure function to get public stats only
        const { data: statsArray, error } = await supabase
          .rpc('get_user_public_stats', { p_user_id: profile.id });

        if (error) {
          console.error('Error calling get_user_public_stats:', {
            error,
            userId: profile.id,
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          // Fallback to zero values if function fails
          return {
            id: profile.id,
            username: profile.username,
            avatar_url: profile.avatar_url,
            status: 'accepted' as const,
            is_requester: false,
            total_hours: 0,
            current_streak: 0,
            badges_count: 0,
          };
        }

        // Extract stats from response array
        const stats = (statsArray && statsArray.length > 0) ? statsArray[0] : null;

        return {
          id: profile.id,
          username: profile.username,
          avatar_url: profile.avatar_url,
          status: 'accepted' as const,
          is_requester: false,
          total_hours: Number(stats?.total_hours || 0),
          current_streak: stats?.current_streak || 0,
          badges_count: Number(stats?.badges_count || 0),
        };
      })
    );

    setFriends(friendsWithStats);
  };

  const fetchPendingRequests = async () => {
    if (!user) return;

    const { data: requests } = await supabase
      .from("friendships")
      .select("user_id, friend_id, status")
      .eq("friend_id", user.id)
      .eq("status", "pending");

    if (requests && requests.length > 0) {
      const requesterIds = requests.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", requesterIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      setPendingRequests(requests.map(r => {
        const profile = profilesMap.get(r.user_id);
        return {
          id: r.user_id,
          username: profile?.username || "Unknown",
          avatar_url: profile?.avatar_url || null,
          status: 'pending' as const,
          is_requester: false,
          total_hours: 0,
          current_streak: 0,
          badges_count: 0,
        };
      }));
    } else {
      setPendingRequests([]);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;

    const { data } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .ilike("username", `%${searchQuery}%`)
      .neq("id", user?.id)
      .limit(10);

    setSearchResults(data || []);
  };

  const sendFriendRequest = async (friendId: string) => {
    if (!user) return;

    // Check if friendship already exists in either direction
    const { data: existing } = await supabase
      .from("friendships")
      .select("*")
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);

    if (existing && existing.length > 0) {
      const existingFriendship = existing[0];
      if (existingFriendship.status === 'accepted') {
        toast({
          title: "Already friends",
          description: "You are already friends with this user",
          variant: "default",
        });
      } else if (existingFriendship.status === 'pending') {
        if (existingFriendship.user_id === user.id) {
          toast({
            title: "Request pending",
            description: "You already sent a friend request to this user",
            variant: "default",
          });
        } else {
          toast({
            title: "Request exists",
            description: "This user has already sent you a friend request. Please check pending requests.",
            variant: "default",
          });
        }
      }
      return;
    }

    const { error } = await supabase
      .from("friendships")
      .insert({
        user_id: user.id,
        friend_id: friendId,
        status: "pending",
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message.includes('duplicate') 
          ? "Friend request already exists"
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Friend request sent!",
        description: "Your friend will be notified",
      });
      searchUsers();
    }
  };

  const acceptFriendRequest = async (friendId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("friendships")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("friend_id", user.id)
      .eq("user_id", friendId)
      .eq("status", "pending");

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Friend request accepted!",
      });
      fetchFriends();
      fetchPendingRequests();
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("friendships")
      .delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Friend removed",
      });
      fetchFriends();
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-16 md:pt-0 md:ml-[var(--sidebar-width,5rem)] p-4 sm:p-6 lg:p-8 transition-all duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-display mb-2 neon-text animate-fade-in">Friends</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Connect and compete with your accountability partners</p>
            </div>
            <Button
              onClick={() => setIsSearchOpen(true)}
              className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Friend
            </Button>
          </div>

          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <Card className="glow-card p-4 sm:p-6 mb-4 sm:mb-6 animate-slide-up">
              <h2 className="text-lg sm:text-xl font-display text-primary mb-4">Pending Requests</h2>
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <Card key={request.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12 border-2 border-primary/30">
                        <AvatarImage src={request.avatar_url || undefined} alt={request.username} />
                        <AvatarFallback className="bg-primary/20 text-primary font-display">
                          {request.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-display text-lg">{request.username}</h3>
                        <p className="text-sm text-muted-foreground">Wants to be your friend</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => acceptFriendRequest(request.id)}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <UserCheck className="w-4 h-4 mr-2" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeFriend(request.id)}
                      >
                        <UserX className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {/* Friends List */}
          <Card className="glow-card p-6 animate-slide-up">
            <h2 className="text-xl font-display text-primary mb-4">Your Friends ({friends.length})</h2>
            {friends.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {friends.map((friend) => (
                  <Card
                    key={friend.id}
                    className="p-4 hover:scale-105 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <Avatar 
                        className="w-12 h-12 border-2 border-primary/30 cursor-pointer"
                        onClick={() => navigate(`/profile/${friend.id}`)}
                      >
                        <AvatarImage src={friend.avatar_url || undefined} alt={friend.username} />
                        <AvatarFallback className="bg-primary/20 text-primary font-display">
                          {friend.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 cursor-pointer" onClick={() => navigate(`/profile/${friend.id}`)}>
                        <h3 className="font-display text-lg">{friend.username}</h3>
                        <p className="text-xs text-muted-foreground">Friend</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/chat/${friend.id}`)}
                        className="flex-shrink-0"
                        title="Start chat"
                      >
                        <MessageCircle className="w-5 h-5 text-primary" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <Zap className="w-4 h-4 text-primary mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Hours</p>
                        <p className="text-sm font-display text-primary">{friend.total_hours.toFixed(0)}</p>
                      </div>
                      <div>
                        <Flame className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Streak</p>
                        <p className="text-sm font-display text-orange-400">{friend.current_streak}</p>
                      </div>
                      <div>
                        <Trophy className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Badges</p>
                        <p className="text-sm font-display text-yellow-400">{friend.badges_count}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground mb-4">No friends yet. Add some to start competing!</p>
                <Button onClick={() => setIsSearchOpen(true)} className="bg-primary hover:bg-primary/90">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Your First Friend
                </Button>
              </div>
            )}
          </Card>

          {/* Search Dialog */}
          <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary">Find Friends</DialogTitle>
                <DialogDescription>
                  Search for users by username to add them as friends
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search by username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
                    className="bg-input border-primary/30"
                  />
                  <Button onClick={searchUsers} className="bg-primary hover:bg-primary/90">
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
                <ScrollArea className="h-64">
                  <div className="space-y-2 pr-4">
                  {searchResults.map((result) => (
                    <Card key={result.id} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border-2 border-primary/30">
                          <AvatarImage src={result.avatar_url || undefined} alt={result.username} />
                          <AvatarFallback className="bg-primary/20 text-primary font-display text-sm">
                            {result.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-display">{result.username}</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => sendFriendRequest(result.id)}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add
                      </Button>
                    </Card>
                  ))}
                </div>
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default Friends;

