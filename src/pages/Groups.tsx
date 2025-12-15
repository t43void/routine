import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Plus, Users, Lock, Globe, MessageCircle, Copy, Check, Trash2, UserX, Edit, Pencil } from "lucide-react";
import { format } from "date-fns";

interface Group {
  id: string;
  name: string;
  description: string | null;
  creator_id: string;
  is_private: boolean;
  invite_code: string | null;
  created_at: string;
  member_count?: number;
  creator_username?: string;
  creator_avatar?: string | null;
  is_member?: boolean;
  role?: 'admin' | 'member';
}

const Groups = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { inviteCode: urlInviteCode } = useParams<{ inviteCode?: string }>();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchGroups();
      fetchMyGroups();
      
      // Handle invite code from URL
      if (urlInviteCode) {
        setInviteCode(urlInviteCode.toUpperCase());
        setIsJoinDialogOpen(true);
      }
    }
  }, [user, urlInviteCode]);

  const fetchGroups = async () => {
    if (!user) return;

    // Fetch public groups
    const { data: publicGroups } = await supabase
      .from("groups")
      .select("*")
      .eq("is_private", false)
      .order("created_at", { ascending: false });

    if (!publicGroups || publicGroups.length === 0) {
      setGroups([]);
      return;
    }

    // Get creator IDs
    const creatorIds = [...new Set(publicGroups.map(g => g.creator_id))];
    const { data: creators } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", creatorIds);

    const creatorsMap = new Map(creators?.map(c => [c.id, c]) || []);

    const groupsWithMembers = await Promise.all(
      publicGroups.map(async (group: any) => {
        const { count } = await supabase
          .from("group_members")
          .select("*", { count: "exact", head: true })
          .eq("group_id", group.id);

        const { data: membership } = await supabase
          .from("group_members")
          .select("role")
          .eq("group_id", group.id)
          .eq("user_id", user.id)
          .maybeSingle();

        const creator = creatorsMap.get(group.creator_id);

        return {
          ...group,
          member_count: count || 0,
          creator_username: creator?.username || "Unknown",
          creator_avatar: creator?.avatar_url || null,
          is_member: !!membership,
          role: membership?.role || null,
        };
      })
    );

    setGroups(groupsWithMembers);
  };

  const fetchMyGroups = async () => {
    if (!user) return;

    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id, role")
      .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) {
      setMyGroups([]);
      return;
    }

    // Get group IDs
    const groupIds = memberships.map(m => m.group_id);
    const { data: groups } = await supabase
      .from("groups")
      .select("*")
      .in("id", groupIds);

    if (!groups) {
      setMyGroups([]);
      return;
    }

    // Get creator IDs
    const creatorIds = [...new Set(groups.map(g => g.creator_id))];
    const { data: creators } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", creatorIds);

    const creatorsMap = new Map(creators?.map(c => [c.id, c]) || []);
    const membershipsMap = new Map(memberships.map(m => [m.group_id, m]));

    const groupsWithMembers = await Promise.all(
      groups.map(async (group: any) => {
        const { count } = await supabase
          .from("group_members")
          .select("*", { count: "exact", head: true })
          .eq("group_id", group.id);

        const membership = membershipsMap.get(group.id);
        const creator = creatorsMap.get(group.creator_id);

        return {
          ...group,
          member_count: count || 0,
          creator_username: creator?.username || "Unknown",
          creator_avatar: creator?.avatar_url || null,
          is_member: true,
          role: membership?.role || null,
        };
      })
    );

    setMyGroups(groupsWithMembers);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupName.trim()) return;

    try {
      let inviteCodeValue = null;
      if (isPrivate) {
        // Generate invite code for private groups
        const { data: codeData, error: codeError } = await supabase.rpc('generate_invite_code');
        if (codeError || !codeData) {
          // Fallback: generate a simple 8-character code
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let code = '';
          for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          inviteCodeValue = code;
        } else {
          inviteCodeValue = String(codeData).trim().toUpperCase();
          // Ensure it's at least 8 characters
          if (inviteCodeValue.length < 8) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            while (inviteCodeValue.length < 8) {
              inviteCodeValue += chars.charAt(Math.floor(Math.random() * chars.length));
            }
          }
        }
      }

      const { data: group, error } = await supabase
        .from("groups")
        .insert({
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          creator_id: user.id,
          is_private: isPrivate,
          invite_code: inviteCodeValue,
        })
        .select()
        .single();

      if (error) {
        console.error("Group creation error:", error);
        throw error;
      }

      // Add creator as admin member
      await supabase.from("group_members").insert({
        group_id: group.id,
        user_id: user.id,
        role: 'admin',
      });

      toast({
        title: "Success!",
        description: "Group created successfully",
      });

      setIsCreateDialogOpen(false);
      setGroupName("");
      setGroupDescription("");
      setIsPrivate(false);
      fetchGroups();
      fetchMyGroups();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create group",
        variant: "destructive",
      });
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("group_members").insert({
        group_id: groupId,
        user_id: user.id,
        role: 'member',
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Joined group successfully",
      });

      fetchGroups();
      fetchMyGroups();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to join group",
        variant: "destructive",
      });
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inviteCode.trim()) return;

    try {
      // Find group by invite code
      const { data: group, error: findError } = await supabase
        .from("groups")
        .select("id")
        .eq("invite_code", inviteCode.trim().toUpperCase())
        .single();

      if (findError || !group) {
        toast({
          title: "Error",
          description: "Invalid invite code",
          variant: "destructive",
        });
        return;
      }

      // Join the group
      const { error: joinError } = await supabase.from("group_members").insert({
        group_id: group.id,
        user_id: user.id,
        role: 'member',
      });

      if (joinError) throw joinError;

      toast({
        title: "Success!",
        description: "Joined group successfully",
      });

      setIsJoinDialogOpen(false);
      setInviteCode("");
      fetchGroups();
      fetchMyGroups();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to join group",
        variant: "destructive",
      });
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!user) return;

    if (!confirm("Are you sure you want to leave this group?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Left group",
        description: "You've left the group",
      });

      fetchGroups();
      fetchMyGroups();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to leave group",
        variant: "destructive",
      });
    }
  };

  const copyInviteLink = (code: string | null | undefined) => {
    if (!code || code.trim().length === 0) {
      toast({
        title: "Error",
        description: "No invite code available for this group",
        variant: "destructive",
      });
      return;
    }
    
    const cleanCode = code.trim().toUpperCase();
    // Copy just the code, not the full URL
    navigator.clipboard.writeText(cleanCode);
    setCopiedCode(cleanCode);
    toast({
      title: "Copied!",
      description: `Invite code "${cleanCode}" copied to clipboard`,
    });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || "");
    setIsPrivate(group.is_private);
    setIsEditDialogOpen(true);
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingGroup || !groupName.trim()) return;

    try {
      let inviteCodeValue = editingGroup.invite_code;
      
      // If changing to private and no invite code exists, generate one
      if (isPrivate && (!inviteCodeValue || inviteCodeValue.trim().length === 0)) {
        const { data: codeData, error: codeError } = await supabase.rpc('generate_invite_code');
        if (codeError || !codeData) {
          // Fallback: generate a simple 8-character code
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let code = '';
          for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          inviteCodeValue = code;
        } else {
          inviteCodeValue = String(codeData).trim().toUpperCase();
          // Ensure it's at least 8 characters
          if (inviteCodeValue.length < 8) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            while (inviteCodeValue.length < 8) {
              inviteCodeValue += chars.charAt(Math.floor(Math.random() * chars.length));
            }
          }
        }
      } else if (!isPrivate) {
        // If changing to public, remove invite code
        inviteCodeValue = null;
      }

      const { error } = await supabase
        .from("groups")
        .update({
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          is_private: isPrivate,
          invite_code: inviteCodeValue,
        })
        .eq("id", editingGroup.id)
        .eq("creator_id", user.id);

      if (error) {
        console.error("Group update error:", error);
        throw error;
      }

      toast({
        title: "Success!",
        description: "Group updated successfully",
      });

      setIsEditDialogOpen(false);
      setEditingGroup(null);
      setGroupName("");
      setGroupDescription("");
      setIsPrivate(false);
      fetchGroups();
      fetchMyGroups();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update group",
        variant: "destructive",
      });
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!user) return;

    if (!confirm("Are you sure you want to delete this group? This action cannot be undone and will remove all messages and members.")) {
      return;
    }

    try {
      // First delete all group members
      await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId);

      // Then delete all group messages
      await supabase
        .from("group_messages")
        .delete()
        .eq("group_id", groupId);

      // Finally delete the group
      const { error } = await supabase
        .from("groups")
        .delete()
        .eq("id", groupId)
        .eq("creator_id", user.id);

      if (error) {
        console.error("Group deletion error:", error);
        throw error;
      }

      toast({
        title: "Group deleted",
        description: "The group has been deleted successfully",
      });

      fetchGroups();
      fetchMyGroups();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete group",
        variant: "destructive",
      });
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-16 md:pt-0 md:ml-[var(--sidebar-width,5rem)] p-4 sm:p-6 lg:p-8 transition-all duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-display mb-2 neon-text">
                Groups
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Create or join groups to chat with multiple friends
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setIsJoinDialogOpen(true)}
                variant="outline"
                className="border-primary/30"
              >
                Join by Code
              </Button>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Group
              </Button>
            </div>
          </div>

          {/* My Groups */}
          {myGroups.length > 0 && (
            <Card className="glow-card p-6 mb-8">
              <h2 className="text-xl font-display text-primary mb-4">My Groups ({myGroups.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myGroups.map((group) => (
                  <Card
                    key={group.id}
                    className="p-4 border-primary/30 hover:border-primary/50 transition-all cursor-pointer"
                    onClick={() => navigate(`/chat/group/${group.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                          {group.is_private ? (
                            <Lock className="w-6 h-6 text-primary" />
                          ) : (
                            <Globe className="w-6 h-6 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display text-lg truncate">{group.name}</h3>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                          </p>
                        </div>
                      </div>
                      {group.role === 'admin' && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">Zen</span>
                      )}
                    </div>
                    {group.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{group.description}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/chat/group/${group.id}`);
                        }}
                        className="flex-1 bg-primary hover:bg-primary/90"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Chat
                      </Button>
                      {group.is_private && group.invite_code && group.invite_code.trim().length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyInviteLink(group.invite_code);
                          }}
                          title="Copy invite link"
                        >
                          {copiedCode === group.invite_code ? (
                            <Check className="w-4 h-4 text-primary" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      {group.creator_id === user?.id && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditGroup(group);
                            }}
                            className="text-primary hover:text-primary hover:bg-primary/10"
                            title="Edit group"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGroup(group.id);
                            }}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Delete group"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {group.creator_id !== user?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLeaveGroup(group.id);
                          }}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Leave group"
                        >
                          <UserX className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {/* Public Groups */}
          <Card className="glow-card p-6">
            <h2 className="text-xl font-display text-primary mb-4">Public Groups</h2>
            {groups.length === 0 ? (
              <div className="text-center py-12">
                <Globe className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">No public groups yet. Create the first one!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map((group) => (
                  <Card
                    key={group.id}
                    className="p-4 border-primary/30 hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <Globe className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display text-lg truncate">{group.name}</h3>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                          </p>
                        </div>
                      </div>
                    </div>
                    {group.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{group.description}</p>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <Avatar className="w-6 h-6 border border-primary/30">
                        <AvatarImage src={group.creator_avatar || undefined} alt={group.creator_username} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs font-display">
                          {group.creator_username?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">Created by {group.creator_username}</span>
                    </div>
                    {group.is_member ? (
                      <Button
                        size="sm"
                        onClick={() => navigate(`/chat/group/${group.id}`)}
                        className="w-full bg-primary hover:bg-primary/90"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Open Chat
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleJoinGroup(group.id)}
                        variant="outline"
                        className="w-full border-primary/30"
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Join Group
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </Card>

          {/* Create Group Dialog */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary">Create Group</DialogTitle>
                <DialogDescription>
                  Create a new group for friends to chat together
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="group-name">Group Name</Label>
                  <Input
                    id="group-name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g., Study Group"
                    className="bg-input border-primary/30"
                    required
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group-description">Description (Optional)</Label>
                  <Textarea
                    id="group-description"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="What's this group about?"
                    className="bg-input border-primary/30 min-h-[80px]"
                    maxLength={500}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border border-primary/30 rounded-lg">
                  <div className="flex-1">
                    <Label htmlFor="is-private" className="text-base">Private Group</Label>
                    <p className="text-xs text-muted-foreground">
                      Private groups require an invite code to join
                    </p>
                  </div>
                  <Switch
                    id="is-private"
                    checked={isPrivate}
                    onCheckedChange={setIsPrivate}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      setGroupName("");
                      setGroupDescription("");
                      setIsPrivate(false);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                    Create Group
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Join by Code Dialog */}
          <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary">Join Group by Invite Code</DialogTitle>
                <DialogDescription>
                  Enter the invite code to join a private group
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleJoinByCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-code">Invite Code</Label>
                  <Input
                    id="invite-code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Enter 8-character code"
                    className="bg-input border-primary/30 font-mono"
                    required
                    maxLength={8}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsJoinDialogOpen(false);
                      setInviteCode("");
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                    Join Group
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Group Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="bg-card border-primary/30">
              <DialogHeader>
                <DialogTitle className="font-display text-primary">Edit Group</DialogTitle>
                <DialogDescription>
                  Update your group details
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateGroup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-group-name">Group Name</Label>
                  <Input
                    id="edit-group-name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g., Study Group"
                    className="bg-input border-primary/30"
                    required
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-group-description">Description (Optional)</Label>
                  <Textarea
                    id="edit-group-description"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="What's this group about?"
                    className="bg-input border-primary/30 min-h-[80px]"
                    maxLength={500}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border border-primary/30 rounded-lg">
                  <div className="flex-1">
                    <Label htmlFor="edit-is-private" className="text-base">Private Group</Label>
                    <p className="text-xs text-muted-foreground">
                      Private groups require an invite code to join
                    </p>
                  </div>
                  <Switch
                    id="edit-is-private"
                    checked={isPrivate}
                    onCheckedChange={setIsPrivate}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setEditingGroup(null);
                      setGroupName("");
                      setGroupDescription("");
                      setIsPrivate(false);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                    Update Group
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default Groups;

