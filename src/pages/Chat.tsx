import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Send, Smile, ArrowLeft, Users, Trash2, Image, Menu, X, Reply, X as XIcon } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import GifPicker from "@/components/GifPicker";
import MessageNotification from "@/components/MessageNotification";
import MentionPicker from "@/components/MentionPicker";
import {
  encryptMessage,
  decryptMessage,
  generateSessionKey,
  generateGroupKey,
  generateGroupKeyOld,
  isEncrypted,
  formatEncryptedMessage,
  parseEncryptedMessage,
} from "@/utils/encryption";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string | null;
  sticker_id: string | null;
  gif_url: string | null;
  message_type: 'text' | 'sticker' | 'gif';
  read: boolean;
  created_at: string;
  reply_to: string | null;
  sender_username?: string;
  sender_avatar?: string | null;
  replied_message?: Message | null; // The message being replied to
}

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  unread_count: number;
  last_message?: string;
  last_message_time?: string;
}

// Telegram-style sticker emojis
const STICKERS = [
  { id: 'happy', emoji: '😊', name: 'Happy' },
  { id: 'love', emoji: '❤️', name: 'Love' },
  { id: 'fire', emoji: '🔥', name: 'Fire' },
  { id: 'thumbsup', emoji: '👍', name: 'Thumbs Up' },
  { id: 'clap', emoji: '👏', name: 'Clap' },
  { id: 'party', emoji: '🎉', name: 'Party' },
  { id: 'rocket', emoji: '🚀', name: 'Rocket' },
  { id: 'star', emoji: '⭐', name: 'Star' },
  { id: 'trophy', emoji: '🏆', name: 'Trophy' },
  { id: 'muscle', emoji: '💪', name: 'Muscle' },
  { id: '100', emoji: '💯', name: '100' },
  { id: 'lightning', emoji: '⚡', name: 'Lightning' },
  { id: 'check', emoji: '✅', name: 'Check' },
  { id: 'wow', emoji: '😮', name: 'Wow' },
  { id: 'cool', emoji: '😎', name: 'Cool' },
  { id: 'thinking', emoji: '🤔', name: 'Thinking' },
  { id: 'laugh', emoji: '😂', name: 'Laugh' },
  { id: 'heart_eyes', emoji: '😍', name: 'Heart Eyes' },
  { id: 'pray', emoji: '🙏', name: 'Pray' },
  { id: 'highfive', emoji: '🙌', name: 'High Five' },
  { id: 'dance', emoji: '💃', name: 'Dance' },
  { id: 'sleep', emoji: '😴', name: 'Sleep' },
  { id: 'coffee', emoji: '☕', name: 'Coffee' },
  { id: 'pizza', emoji: '🍕', name: 'Pizza' },
  { id: 'cake', emoji: '🎂', name: 'Cake' },
  { id: 'beer', emoji: '🍺', name: 'Beer' },
  { id: 'tada', emoji: '🎊', name: 'Tada' },
  { id: 'confetti', emoji: '🎈', name: 'Confetti' },
  { id: 'gift', emoji: '🎁', name: 'Gift' },
  { id: 'medal', emoji: '🥇', name: 'Medal' },
];

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  message_text: string | null;
  sticker_id: string | null;
  gif_url: string | null;
  message_type: 'text' | 'sticker' | 'gif';
  mentions?: string[] | null;
  reply_to: string | null;
  created_at: string;
  sender_username?: string;
  sender_avatar?: string | null;
  replied_message?: GroupMessage | null; // The message being replied to
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  invite_code: string | null;
  member_count?: number;
}

const Chat = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { friendId, groupId } = useParams<{ friendId?: string; groupId?: string }>();
  const { toast } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isStickerPickerOpen, setIsStickerPickerOpen] = useState(false);
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [notification, setNotification] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionPickerPosition, setMentionPickerPosition] = useState({ top: 0, left: 0 });
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Cache encryption keys for faster message sending
  const encryptionKeyCache = useRef<Map<string, CryptoKey>>(new Map());
  // Reply functionality
  const [replyingTo, setReplyingTo] = useState<Message | GroupMessage | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Play notification sound
  const playNotificationSound = () => {
    try {
      // Create audio context for beep sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // Higher pitch
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error("Error playing notification sound:", error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFriends();
      
      // Set up global message listener for notifications
      const channel = supabase
        .channel(`global-messages:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`,
          },
          async (payload: any) => {
            // Only show notification if not viewing this chat
            if (selectedFriend?.id !== payload.new.sender_id) {
              const message = await fetchMessageWithSender(payload.new.id);
              if (message) {
                playNotificationSound();
                // Show encrypted indicator in notification preview
                const previewText = message.message_text && isEncrypted(payload.new.message_text || '')
                  ? '🔒 Encrypted message'
                  : message.message_text || 'New message';
                setNotification({
                  ...message,
                  message_text: previewText,
                  isGroupMessage: false,
                });
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'group_messages',
          },
          async (payload: any) => {
            // Check if user is a member of this group
            const groupId = payload.new.group_id;
            
            if (groupId) {
              const { data: group } = await supabase
                .from("groups")
                .select("id, name")
                .eq("id", groupId)
                .single();
              
              // Only show notification if not viewing this group chat
              if (selectedGroup?.id !== groupId) {
                const { data: memberCheck } = await supabase
                  .from("group_members")
                  .select("user_id")
                  .eq("group_id", groupId)
                  .eq("user_id", user.id)
                  .maybeSingle();
                
                if (memberCheck && payload.new.sender_id !== user.id) {
                  const message = await fetchGroupMessageWithSender(payload.new.id);
                  if (message && group) {
                    playNotificationSound();
                    // Show encrypted indicator in notification preview
                    const previewText = message.message_text && isEncrypted(payload.new.message_text || '')
                      ? '🔒 Encrypted message'
                      : message.message_text || 'New message';
                    setNotification({
                      ...message,
                      message_text: previewText,
                      isGroupMessage: true,
                      groupId: group.id,
                      groupName: group.name,
                    });
                  }
                }
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, selectedFriend?.id, selectedGroup?.id]);

  useEffect(() => {
    if (groupId && user) {
      // Handle group chat
      if (selectedGroup?.id !== groupId) {
        setGroupMessages([]);
        setMessages([]);
        setSelectedFriend(null);
        fetchGroup(groupId);
        fetchGroupMessages(groupId);
        setIsSidebarOpen(false); // Close sidebar on mobile
      }
    } else if (friendId && user && friends.length > 0) {
      // Handle direct chat
      const friend = friends.find(f => f.id === friendId);
      if (friend && friend.id !== selectedFriend?.id) {
        // Reset messages when switching to a different friend
        setMessages([]);
        setGroupMessages([]);
        setSelectedGroup(null);
        setSelectedFriend(friend);
        fetchMessages(friendId);
        markMessagesAsRead(friendId);
      }
    } else if (!friendId && !groupId) {
      setSelectedFriend(null);
      setSelectedGroup(null);
      setMessages([]);
      setGroupMessages([]);
    }
  }, [friendId, groupId, friends, user, selectedFriend?.id, selectedGroup?.id]);

  useEffect(() => {
    if (selectedGroup && user) {
      // Set up real-time subscription for group messages
      const channelName = `group-chat:${selectedGroup.id}`;
      
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'group_messages',
            filter: `group_id=eq.${selectedGroup.id}`,
          },
          async (payload: any) => {
            // Only process if this message is for the currently selected group
            if (payload.new.group_id === selectedGroup.id) {
              const newMessage = await fetchGroupMessageWithSender(payload.new.id);
              if (newMessage) {
                // Play sound if message is from someone else
                if (newMessage.sender_id !== user.id) {
                  playNotificationSound();
                }
                setGroupMessages(prev => {
                  // Avoid duplicates
                  if (prev.some(m => m.id === newMessage.id)) return prev;
                  return [...prev, newMessage];
                });
                scrollToBottom();
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else if (selectedFriend && user) {
      // Set up real-time subscription for direct messages
      const channelName = `chat:${selectedFriend.id}:${user.id}`;
      
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `sender_id=eq.${selectedFriend.id},receiver_id=eq.${user.id}`,
          },
          async (payload: any) => {
            // Only process if this message is for the currently selected friend
            if (payload.new.receiver_id === user.id && payload.new.sender_id === selectedFriend.id) {
              const newMessage = await fetchMessageWithSender(payload.new.id);
              if (newMessage) {
                // Play sound for new messages from friend
                if (newMessage.sender_id !== user.id) {
                  playNotificationSound();
                }
                setMessages(prev => {
                  // Avoid duplicates
                  if (prev.some(m => m.id === newMessage.id)) return prev;
                  return [...prev, newMessage];
                });
                markMessagesAsRead(selectedFriend.id);
                scrollToBottom();
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `sender_id=eq.${user.id},receiver_id=eq.${selectedFriend.id}`,
          },
          async (payload: any) => {
            // Only process if this message is for the currently selected friend
            if (payload.new.sender_id === user.id && payload.new.receiver_id === selectedFriend.id) {
              const newMessage = await fetchMessageWithSender(payload.new.id);
              if (newMessage) {
                setMessages(prev => {
                  // Avoid duplicates
                  if (prev.some(m => m.id === newMessage.id)) return prev;
                  return [...prev, newMessage];
                });
                scrollToBottom();
              }
            }
          }
        )
        .subscribe();

      return () => {
        // Clean up subscription when switching friends or unmounting
        supabase.removeChannel(channel);
      };
    }
  }, [selectedFriend?.id, selectedGroup?.id, user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, groupMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchFriends = async () => {
    if (!user) return;

    // Get all friends
    const { data: friendships } = await supabase
      .from("friendships")
      .select("*")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq("status", "accepted");

    if (!friendships || friendships.length === 0) {
      setFriends([]);
      return;
    }

    const friendIds = friendships.map(f => 
      f.user_id === user.id ? f.friend_id : f.user_id
    );

    // Get friend profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", friendIds);

    // Get unread counts and last messages
    const friendsWithData = await Promise.all(
      (profiles || []).map(async (profile) => {
        // Get unread count
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("receiver_id", user.id)
          .eq("sender_id", profile.id)
          .eq("read", false);

        // Get last message
        const { data: lastMessage } = await supabase
          .from("messages")
          .select("message_text, sticker_id, gif_url, message_type, created_at")
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${user.id})`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let lastMessageText = '';
        if (lastMessage) {
          if (lastMessage.message_type === 'gif') {
            lastMessageText = '🎬 GIF';
          } else if (lastMessage.message_type === 'sticker') {
            lastMessageText = STICKERS.find(s => s.id === lastMessage.sticker_id)?.emoji || 'Sticker';
          } else {
            // Check if message is encrypted
            if (lastMessage.message_text && isEncrypted(lastMessage.message_text)) {
              lastMessageText = '🔒 Encrypted message';
            } else {
              lastMessageText = lastMessage.message_text || '';
            }
          }
        }

        return {
          id: profile.id,
          username: profile.username,
          avatar_url: profile.avatar_url,
          unread_count: count || 0,
          last_message: lastMessageText,
          last_message_time: lastMessage?.created_at,
        };
      })
    );

    // Sort by last message time (most recent first)
    friendsWithData.sort((a, b) => {
      if (!a.last_message_time && !b.last_message_time) return 0;
      if (!a.last_message_time) return 1;
      if (!b.last_message_time) return -1;
      return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
    });

    setFriends(friendsWithData);
  };

  const fetchMessages = async (targetFriendId: string) => {
    if (!user) return;

    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetFriendId}),and(sender_id.eq.${targetFriendId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true })
      .limit(100);

    if (data) {
      // Get sender usernames and avatars
      const userIds = [...new Set(data.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Decrypt messages
      const encryptionKey = await generateSessionKey(user.id, targetFriendId);
      const messagesWithSenders = await Promise.all(
        data.map(async (msg) => {
          // Decrypt message if encrypted (only if it's actually encrypted)
          let decryptedMessage = msg.message_text;
          if (msg.message_text && typeof msg.message_text === 'string' && isEncrypted(msg.message_text)) {
            try {
              const encryptedData = parseEncryptedMessage(msg.message_text);
              if (encryptedData) {
                decryptedMessage = await decryptMessage(
                  encryptedData.encrypted,
                  encryptedData.iv,
                  encryptionKey
                );
              }
            } catch (error) {
              // Try with reversed key order as fallback
              try {
                const encryptedData = parseEncryptedMessage(msg.message_text);
                if (encryptedData) {
                  const fallbackKey = await generateSessionKey(targetFriendId, user.id);
                  decryptedMessage = await decryptMessage(
                    encryptedData.encrypted,
                    encryptedData.iv,
                    fallbackKey
                  );
                }
              } catch (fallbackError) {
                // If decryption fails, show error message but don't break the UI
                decryptedMessage = "🔒 Unable to decrypt message";
              }
            }
          }

          // Decrypt GIF URL if encrypted (only if it's actually encrypted)
          let decryptedGifUrl = msg.gif_url;
          if (msg.gif_url && typeof msg.gif_url === 'string' && isEncrypted(msg.gif_url)) {
            try {
              const encryptedData = parseEncryptedMessage(msg.gif_url);
              if (encryptedData) {
                decryptedGifUrl = await decryptMessage(
                  encryptedData.encrypted,
                  encryptedData.iv,
                  encryptionKey
                );
              }
            } catch (error) {
              // Try with reversed key order as fallback
              try {
                const encryptedData = parseEncryptedMessage(msg.gif_url);
                if (encryptedData) {
                  const fallbackKey = await generateSessionKey(targetFriendId, user.id);
                  decryptedGifUrl = await decryptMessage(
                    encryptedData.encrypted,
                    encryptedData.iv,
                    fallbackKey
                  );
                }
              } catch (fallbackError) {
                // If decryption fails, keep original (might be unencrypted old message)
                decryptedGifUrl = msg.gif_url;
              }
            }
          }

          return {
            ...msg,
            message_text: decryptedMessage,
            gif_url: decryptedGifUrl,
            sender_username: profilesMap.get(msg.sender_id)?.username || "Unknown",
            sender_avatar: profilesMap.get(msg.sender_id)?.avatar_url || null,
            replied_message: null, // Will be populated below
          };
        })
      );

      // Fetch replied messages
      const replyIds = messagesWithSenders.filter(m => m.reply_to).map(m => m.reply_to!);
      if (replyIds.length > 0) {
        const { data: repliedMessages } = await supabase
          .from("messages")
          .select("*")
          .in("id", replyIds);

        if (repliedMessages) {
          const repliedMap = new Map(await Promise.all(repliedMessages.map(async (rm) => {
            let decryptedText = rm.message_text;
            if (rm.message_text && isEncrypted(rm.message_text)) {
              try {
                const encryptedData = parseEncryptedMessage(rm.message_text);
                if (encryptedData) {
                  const otherUserId = rm.sender_id === user.id ? rm.receiver_id : rm.sender_id;
                  const key = await generateSessionKey(user.id, otherUserId);
                  decryptedText = await decryptMessage(
                    encryptedData.encrypted,
                    encryptedData.iv,
                    key
                  );
                }
              } catch (error) {
                // Silently handle decryption errors for replied messages
              }
            }
            return [rm.id, {
              ...rm,
              message_text: decryptedText,
              sender_username: profilesMap.get(rm.sender_id)?.username || "Unknown",
              sender_avatar: profilesMap.get(rm.sender_id)?.avatar_url || null,
            }];
          })));

          // Attach replied messages
          messagesWithSenders.forEach(msg => {
            if (msg.reply_to) {
              msg.replied_message = repliedMap.get(msg.reply_to) || null;
            }
          });
        }
      }

      setMessages(messagesWithSenders);
    }
  };

  const fetchMessageWithSender = async (messageId: string): Promise<Message | null> => {
    if (!user) return null;

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("id", messageId)
      .single();

    if (data) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", data.sender_id)
        .single();

      // Decrypt message if encrypted
      let decryptedMessage = data.message_text;
      const otherUserId = data.sender_id === user.id ? data.receiver_id : data.sender_id;
      const encryptionKey = await generateSessionKey(user.id, otherUserId);

      if (data.message_text && isEncrypted(data.message_text)) {
        try {
          const encryptedData = parseEncryptedMessage(data.message_text);
          if (encryptedData) {
            decryptedMessage = await decryptMessage(
              encryptedData.encrypted,
              encryptedData.iv,
              encryptionKey
            );
          }
        } catch (error) {
          // Try to decrypt with reversed user IDs as fallback (for old messages)
          try {
            const encryptedData = parseEncryptedMessage(data.message_text);
            if (encryptedData) {
              const fallbackKey = await generateSessionKey(otherUserId, user.id);
              decryptedMessage = await decryptMessage(
                encryptedData.encrypted,
                encryptedData.iv,
                fallbackKey
              );
            }
          } catch (fallbackError) {
            decryptedMessage = "🔒 Unable to decrypt message";
          }
        }
      }

      // Decrypt GIF URL if encrypted
      let decryptedGifUrl = data.gif_url;
      if (data.gif_url && isEncrypted(data.gif_url)) {
        try {
          const encryptedData = parseEncryptedMessage(data.gif_url);
          if (encryptedData) {
            decryptedGifUrl = await decryptMessage(
              encryptedData.encrypted,
              encryptedData.iv,
              encryptionKey
            );
          }
        } catch (error) {
          // Try with reversed key order as fallback
          try {
            const encryptedData = parseEncryptedMessage(data.gif_url);
            if (encryptedData) {
              const fallbackKey = await generateSessionKey(otherUserId, user.id);
              decryptedGifUrl = await decryptMessage(
                encryptedData.encrypted,
                encryptedData.iv,
                fallbackKey
              );
            }
          } catch (fallbackError) {
            decryptedGifUrl = null;
          }
        }
      }

      return {
        ...data,
        message_text: decryptedMessage,
        gif_url: decryptedGifUrl,
        sender_username: profile?.username || "Unknown",
        sender_avatar: profile?.avatar_url || null,
      };
    }
    return null;
  };

  const markMessagesAsRead = async (senderId: string) => {
    if (!user) return;

    await supabase
      .from("messages")
      .update({ read: true })
      .eq("receiver_id", user.id)
      .eq("sender_id", senderId)
      .eq("read", false);

    // Update unread count in friends list
    setFriends(prev => prev.map(f => 
      f.id === senderId ? { ...f, unread_count: 0 } : f
    ));
  };

  const fetchGroup = async (targetGroupId: string) => {
    if (!user) return;

    const { data: group } = await supabase
      .from("groups")
      .select("*")
      .eq("id", targetGroupId)
      .single();

    if (group) {
      const { count } = await supabase
        .from("group_members")
        .select("*", { count: "exact", head: true })
        .eq("group_id", group.id);

      setSelectedGroup({
        ...group,
        member_count: count || 0,
      });

      // Fetch group members
      const { data: members } = await supabase
        .from("group_members")
        .select("user_id, role")
        .eq("group_id", group.id);

      if (members && members.length > 0) {
        // Get user profiles
        const userIds = members.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", userIds);

        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

        setGroupMembers(members.map((m: any) => {
          const profile = profilesMap.get(m.user_id);
          return {
            user_id: m.user_id,
            role: m.role,
            username: profile?.username || "Unknown",
            avatar_url: profile?.avatar_url || null,
          };
        }));
      }
    }
  };

  const fetchGroupMessages = async (targetGroupId: string) => {
    if (!user) return;

    const { data } = await supabase
      .from("group_messages")
      .select("*")
      .eq("group_id", targetGroupId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (data) {
      // Get sender usernames and avatars
      const userIds = [...new Set(data.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Decrypt messages
      const encryptionKey = await generateGroupKey(targetGroupId);
      const messagesWithSenders = await Promise.all(
        data.map(async (msg) => {
          // Decrypt message if encrypted
          let decryptedMessage = msg.message_text;
          if (msg.message_text && typeof msg.message_text === 'string' && isEncrypted(msg.message_text)) {
            try {
              const encryptedData = parseEncryptedMessage(msg.message_text);
              if (encryptedData) {
                try {
                  decryptedMessage = await decryptMessage(
                    encryptedData.encrypted,
                    encryptedData.iv,
                    encryptionKey
                  );
                } catch (error) {
                  // Fallback: try with old key format (for backward compatibility)
                  // Try with sender's ID first (who encrypted it), then current user's ID
                  let fallbackSuccess = false;
                  
                  // Try with sender's ID
                  try {
                    const oldKey = await generateGroupKeyOld(targetGroupId, msg.sender_id);
                    decryptedMessage = await decryptMessage(
                      encryptedData.encrypted,
                      encryptedData.iv,
                      oldKey
                    );
                    fallbackSuccess = true;
                  } catch (fallbackError1) {
                    // Try with current user's ID (in case they encrypted it themselves)
                    if (!fallbackSuccess && user) {
                      try {
                        const oldKey = await generateGroupKeyOld(targetGroupId, user.id);
                        decryptedMessage = await decryptMessage(
                          encryptedData.encrypted,
                          encryptedData.iv,
                          oldKey
                        );
                        fallbackSuccess = true;
                      } catch (fallbackError2) {
                        decryptedMessage = "🔒 Unable to decrypt message";
                      }
                    } else {
                      decryptedMessage = "🔒 Unable to decrypt message";
                    }
                  }
                }
              }
            } catch (error) {
              decryptedMessage = "🔒 Unable to decrypt message";
            }
          }

          // Decrypt GIF URL if encrypted
          let decryptedGifUrl = msg.gif_url;
          if (msg.gif_url && typeof msg.gif_url === 'string' && isEncrypted(msg.gif_url)) {
            try {
              const encryptedData = parseEncryptedMessage(msg.gif_url);
              if (encryptedData) {
                try {
                  decryptedGifUrl = await decryptMessage(
                    encryptedData.encrypted,
                    encryptedData.iv,
                    encryptionKey
                  );
                } catch (error) {
                  // Fallback: try with old key format (for backward compatibility)
                  // Try with sender's ID first (who encrypted it), then current user's ID
                  let fallbackSuccess = false;
                  
                  // Try with sender's ID
                  try {
                    const oldKey = await generateGroupKeyOld(targetGroupId, msg.sender_id);
                    decryptedGifUrl = await decryptMessage(
                      encryptedData.encrypted,
                      encryptedData.iv,
                      oldKey
                    );
                    fallbackSuccess = true;
                  } catch (fallbackError1) {
                    // Try with current user's ID (in case they encrypted it themselves)
                    if (!fallbackSuccess && user) {
                      try {
                        const oldKey = await generateGroupKeyOld(targetGroupId, user.id);
                        decryptedGifUrl = await decryptMessage(
                          encryptedData.encrypted,
                          encryptedData.iv,
                          oldKey
                        );
                        fallbackSuccess = true;
                      } catch (fallbackError2) {
                        decryptedGifUrl = null;
                      }
                    } else {
                      decryptedGifUrl = null;
                    }
                  }
                }
              }
            } catch (error) {
              decryptedGifUrl = null;
            }
          }

          return {
            ...msg,
            message_text: decryptedMessage,
            gif_url: decryptedGifUrl,
            sender_username: profilesMap.get(msg.sender_id)?.username || "Unknown",
            sender_avatar: profilesMap.get(msg.sender_id)?.avatar_url || null,
            replied_message: null, // Will be populated below
          };
        })
      );

      // Fetch replied messages
      const replyIds = messagesWithSenders.filter(m => m.reply_to).map(m => m.reply_to!);
      if (replyIds.length > 0) {
        const { data: repliedMessages } = await supabase
          .from("group_messages")
          .select("*")
          .in("id", replyIds);

        if (repliedMessages) {
          const repliedMap = new Map(await Promise.all(repliedMessages.map(async (rm) => {
            let decryptedText = rm.message_text;
            if (rm.message_text && isEncrypted(rm.message_text)) {
              try {
                const encryptedData = parseEncryptedMessage(rm.message_text);
                if (encryptedData) {
                  const key = await generateGroupKey(targetGroupId);
                  decryptedText = await decryptMessage(
                    encryptedData.encrypted,
                    encryptedData.iv,
                    key
                  );
                }
              } catch (error) {
                // Silently handle decryption errors for replied messages
              }
            }
            return [rm.id, {
              ...rm,
              message_text: decryptedText,
              sender_username: profilesMap.get(rm.sender_id)?.username || "Unknown",
              sender_avatar: profilesMap.get(rm.sender_id)?.avatar_url || null,
            }];
          })));

          // Attach replied messages
          messagesWithSenders.forEach(msg => {
            if (msg.reply_to) {
              msg.replied_message = repliedMap.get(msg.reply_to) || null;
            }
          });
        }
      }

      setGroupMessages(messagesWithSenders);
    }
  };

  const fetchGroupMessageWithSender = async (messageId: string): Promise<GroupMessage | null> => {
    if (!user) return null;

    const { data } = await supabase
      .from("group_messages")
      .select("*")
      .eq("id", messageId)
      .single();

    if (data) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", data.sender_id)
        .single();

      // Decrypt message if encrypted
      const encryptionKey = await generateGroupKey(data.group_id);
      let decryptedMessage = data.message_text;
      if (data.message_text && typeof data.message_text === 'string' && isEncrypted(data.message_text)) {
        try {
          const encryptedData = parseEncryptedMessage(data.message_text);
          if (encryptedData) {
            try {
              decryptedMessage = await decryptMessage(
                encryptedData.encrypted,
                encryptedData.iv,
                encryptionKey
              );
            } catch (error) {
              // Fallback: try with old key format (for backward compatibility)
              // Try with sender's ID first (who encrypted it), then current user's ID
              let fallbackSuccess = false;
              
              // Try with sender's ID
              try {
                const oldKey = await generateGroupKeyOld(data.group_id, data.sender_id);
                decryptedMessage = await decryptMessage(
                  encryptedData.encrypted,
                  encryptedData.iv,
                  oldKey
                );
                fallbackSuccess = true;
              } catch (fallbackError1) {
                // Try with current user's ID (in case they encrypted it themselves)
                if (!fallbackSuccess && user) {
                  try {
                    const oldKey = await generateGroupKeyOld(data.group_id, user.id);
                    decryptedMessage = await decryptMessage(
                      encryptedData.encrypted,
                      encryptedData.iv,
                      oldKey
                    );
                    fallbackSuccess = true;
                  } catch (fallbackError2) {
                    decryptedMessage = "🔒 Unable to decrypt message";
                  }
                } else {
                  decryptedMessage = "🔒 Unable to decrypt message";
                }
              }
            }
          }
        } catch (error) {
          decryptedMessage = "🔒 Unable to decrypt message";
        }
      }

      // Decrypt GIF URL if encrypted
      let decryptedGifUrl = data.gif_url;
      if (data.gif_url && typeof data.gif_url === 'string' && isEncrypted(data.gif_url)) {
        try {
          const encryptedData = parseEncryptedMessage(data.gif_url);
          if (encryptedData) {
            try {
              decryptedGifUrl = await decryptMessage(
                encryptedData.encrypted,
                encryptedData.iv,
                encryptionKey
              );
            } catch (error) {
              // Fallback: try with old key format (for backward compatibility)
              // Try with sender's ID first (who encrypted it), then current user's ID
              let fallbackSuccess = false;
              
              // Try with sender's ID
              try {
                const oldKey = await generateGroupKeyOld(data.group_id, data.sender_id);
                decryptedGifUrl = await decryptMessage(
                  encryptedData.encrypted,
                  encryptedData.iv,
                  oldKey
                );
                fallbackSuccess = true;
              } catch (fallbackError1) {
                // Try with current user's ID (in case they encrypted it themselves)
                if (!fallbackSuccess && user) {
                  try {
                    const oldKey = await generateGroupKeyOld(data.group_id, user.id);
                    decryptedGifUrl = await decryptMessage(
                      encryptedData.encrypted,
                      encryptedData.iv,
                      oldKey
                    );
                    fallbackSuccess = true;
                  } catch (fallbackError2) {
                    decryptedGifUrl = null;
                  }
                } else {
                  decryptedGifUrl = null;
                }
              }
            }
          }
        } catch (error) {
          decryptedGifUrl = null;
        }
      }

      return {
        ...data,
        message_text: decryptedMessage,
        gif_url: decryptedGifUrl,
        sender_username: profile?.username || "Unknown",
        sender_avatar: profile?.avatar_url || null,
      };
    }
    return null;
  };

  // Get or generate cached encryption key
  const getCachedGroupKey = async (groupId: string): Promise<CryptoKey> => {
    const cacheKey = `group:${groupId}`;
    if (encryptionKeyCache.current.has(cacheKey)) {
      return encryptionKeyCache.current.get(cacheKey)!;
    }
    const key = await generateGroupKey(groupId);
    encryptionKeyCache.current.set(cacheKey, key);
    return key;
  };

  const getCachedSessionKey = async (userId: string, friendId: string): Promise<CryptoKey> => {
    const cacheKey = `session:${userId}:${friendId}`;
    if (encryptionKeyCache.current.has(cacheKey)) {
      return encryptionKeyCache.current.get(cacheKey)!;
    }
    const key = await generateSessionKey(userId, friendId);
    encryptionKeyCache.current.set(cacheKey, key);
    return key;
  };

  const sendMessage = async (text?: string, stickerId?: string, gifUrl?: string) => {
    if (!user) return;

    // Get user profile once (we'll reuse it)
    const getProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .single();
      return data;
    };

    if (selectedGroup) {
      // Send group message
      const messageType = gifUrl ? 'gif' : stickerId ? 'sticker' : 'text';
      // Capture replyingTo before clearing it
      const currentReplyingTo = replyingTo && 'group_id' in replyingTo ? replyingTo : null;
      const messageData: any = {
        group_id: selectedGroup.id,
        sender_id: user.id,
        message_type: messageType,
        reply_to: currentReplyingTo ? currentReplyingTo.id : null,
      };

      let plainText = text?.trim() || '';
      let mentions: string[] = [];

      if (gifUrl) {
        // Encrypt GIF URL for security
        try {
          const encryptionKey = await getCachedGroupKey(selectedGroup.id);
          const { encrypted, iv } = await encryptMessage(gifUrl, encryptionKey);
          messageData.gif_url = formatEncryptedMessage(encrypted, iv);
        } catch (error) {
          console.error("GIF encryption error:", error);
          toast({
            title: "Encryption Error",
            description: "Failed to encrypt GIF URL. Sending unencrypted.",
            variant: "destructive",
          });
          messageData.gif_url = gifUrl;
        }
      } else if (stickerId) {
        // Stickers are just IDs, no encryption needed
        messageData.sticker_id = stickerId;
      } else if (plainText) {
        // Parse mentions from message
        const mentionRegex = /@(\w+)/g;
        let match;
        while ((match = mentionRegex.exec(plainText)) !== null) {
          const mentionedMember = groupMembers.find(m => m.username === match[1]);
          if (mentionedMember) {
            mentions.push(mentionedMember.user_id);
          }
        }
        
        if (mentions.length > 0) {
          messageData.mentions = mentions;
        }
        
        // Encrypt text message (use cached key for speed)
        try {
          const encryptionKey = await getCachedGroupKey(selectedGroup.id);
          const { encrypted, iv } = await encryptMessage(plainText, encryptionKey);
          messageData.message_text = formatEncryptedMessage(encrypted, iv);
        } catch (error) {
          console.error("Encryption error:", error);
          toast({
            title: "Encryption Error",
            description: "Failed to encrypt message. Sending unencrypted.",
            variant: "destructive",
          });
          messageData.message_text = plainText;
        }
      } else {
        return;
      }

      // Optimistically add message to UI immediately
      const profile = await getProfile();
      const optimisticMessage: GroupMessage = {
        id: `temp-${Date.now()}`,
        group_id: selectedGroup.id,
        sender_id: user.id,
        message_text: plainText,
        sticker_id: stickerId || null,
        gif_url: gifUrl || null, // Store plain URL for optimistic UI, will be replaced with encrypted version
        message_type: messageType,
        mentions: mentions.length > 0 ? mentions : null,
        reply_to: currentReplyingTo ? currentReplyingTo.id : null,
        created_at: new Date().toISOString(),
        sender_username: profile?.username || "You",
        sender_avatar: profile?.avatar_url || null,
        replied_message: currentReplyingTo,
      };

      setGroupMessages(prev => [...prev, optimisticMessage]);
      setMessageText("");
      setIsStickerPickerOpen(false);
      setIsGifPickerOpen(false);
      setReplyingTo(null); // Clear reply after sending

      // Send message and notifications in parallel
      const [insertResult, profileData] = await Promise.all([
        supabase
          .from("group_messages")
          .insert(messageData)
          .select()
          .single(),
        profile || getProfile(),
      ]);

      if (insertResult.error) {
        // Remove optimistic message on error
        setGroupMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
        toast({
          title: "Error",
          description: "Failed to send message",
          variant: "destructive",
        });
        return;
      }

      // Replace optimistic message with real one (decrypt GIF URL if needed)
      let decryptedGifUrl = insertResult.data.gif_url;
      if (insertResult.data.gif_url && isEncrypted(insertResult.data.gif_url)) {
        try {
          const encryptedData = parseEncryptedMessage(insertResult.data.gif_url);
          if (encryptedData) {
            const encryptionKey = await getCachedGroupKey(selectedGroup.id);
            decryptedGifUrl = await decryptMessage(
              encryptedData.encrypted,
              encryptedData.iv,
              encryptionKey
            );
          }
        } catch (error) {
          decryptedGifUrl = insertResult.data.gif_url;
        }
      }

      // Fetch replied message if this is a reply
      let repliedMessage: GroupMessage | null = null;
      if (insertResult.data.reply_to && currentReplyingTo) {
        repliedMessage = currentReplyingTo;
      } else if (insertResult.data.reply_to) {
        // Fetch from database if we don't have it in state
        const { data: repliedMsg } = await supabase
          .from("group_messages")
          .select("*")
          .eq("id", insertResult.data.reply_to)
          .single();
        if (repliedMsg) {
          // Decrypt if needed
          let decryptedReplyText = repliedMsg.message_text;
          if (repliedMsg.message_text && isEncrypted(repliedMsg.message_text)) {
            try {
              const encryptedData = parseEncryptedMessage(repliedMsg.message_text);
              if (encryptedData) {
                const encryptionKey = await getCachedGroupKey(selectedGroup.id);
                decryptedReplyText = await decryptMessage(
                  encryptedData.encrypted,
                  encryptedData.iv,
                  encryptionKey
                );
              }
            } catch (error) {
              // Silently handle decryption errors for replied messages
            }
          }
          // Fetch sender profile
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", repliedMsg.sender_id)
            .single();
          repliedMessage = {
            ...repliedMsg,
            message_text: decryptedReplyText,
            sender_username: senderProfile?.username || "Unknown",
            sender_avatar: senderProfile?.avatar_url || null,
          };
        }
      }

      const realMessage: GroupMessage = {
        ...insertResult.data,
        message_text: plainText, // We already have the plaintext, no need to decrypt
        gif_url: decryptedGifUrl, // Use decrypted GIF URL
        sender_username: profileData?.username || "You",
        sender_avatar: profileData?.avatar_url || null,
        replied_message: repliedMessage,
      };

      setGroupMessages(prev => 
        prev.map(m => m.id === optimisticMessage.id ? realMessage : m)
      );

      // Send notifications to mentioned users (async, don't wait)
      if (insertResult.data.mentions && insertResult.data.mentions.length > 0 && profileData) {
        Promise.all(
          insertResult.data.mentions
            .filter((id: string) => id !== user.id)
            .map((mentionedUserId: string) =>
              supabase.from("notifications").insert({
                user_id: mentionedUserId,
                notification_type: "mention",
                title: "You were mentioned",
                message: `${profileData.username || "Someone"} mentioned you in ${selectedGroup.name}`,
                from_user_id: user.id,
              })
            )
        ).catch(console.error);
      }
    } else if (selectedFriend) {
      // Send direct message
      const messageType = gifUrl ? 'gif' : stickerId ? 'sticker' : 'text';
      // Capture replyingTo before clearing it
      const currentReplyingTo = replyingTo && !('group_id' in replyingTo) ? replyingTo : null;
      const messageData: any = {
        sender_id: user.id,
        receiver_id: selectedFriend.id,
        message_type: messageType,
        reply_to: currentReplyingTo ? currentReplyingTo.id : null,
      };

      const plainText = text?.trim() || '';

      if (gifUrl) {
        // Encrypt GIF URL for security
        try {
          const encryptionKey = await getCachedSessionKey(user.id, selectedFriend.id);
          const { encrypted, iv } = await encryptMessage(gifUrl, encryptionKey);
          messageData.gif_url = formatEncryptedMessage(encrypted, iv);
        } catch (error) {
          console.error("GIF encryption error:", error);
          toast({
            title: "Encryption Error",
            description: "Failed to encrypt GIF URL. Sending unencrypted.",
            variant: "destructive",
          });
          messageData.gif_url = gifUrl;
        }
      } else if (stickerId) {
        // Stickers are just IDs, no encryption needed
        messageData.sticker_id = stickerId;
      } else if (plainText) {
        // Encrypt text message (use cached key for speed)
        try {
          const encryptionKey = await getCachedSessionKey(user.id, selectedFriend.id);
          const { encrypted, iv } = await encryptMessage(plainText, encryptionKey);
          messageData.message_text = formatEncryptedMessage(encrypted, iv);
        } catch (error) {
          console.error("Encryption error:", error);
          toast({
            title: "Encryption Error",
            description: "Failed to encrypt message. Sending unencrypted.",
            variant: "destructive",
          });
          messageData.message_text = plainText;
        }
      } else {
        return;
      }

      // Optimistically add message to UI immediately
      const profile = await getProfile();
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        sender_id: user.id,
        receiver_id: selectedFriend.id,
        message_text: plainText,
        sticker_id: stickerId || null,
        gif_url: gifUrl || null, // Store plain URL for optimistic UI, will be replaced with encrypted version
        message_type: messageType,
        read: false,
        reply_to: currentReplyingTo ? currentReplyingTo.id : null,
        created_at: new Date().toISOString(),
        sender_username: profile?.username || "You",
        sender_avatar: profile?.avatar_url || null,
        replied_message: currentReplyingTo,
      };

      setMessages(prev => [...prev, optimisticMessage]);
      setMessageText("");
      setIsStickerPickerOpen(false);
      setIsGifPickerOpen(false);
      setReplyingTo(null); // Clear reply after sending

      // Send message and refresh friends list in parallel
      const [insertResult, profileData] = await Promise.all([
        supabase
          .from("messages")
          .insert(messageData)
          .select()
          .single(),
        profile || getProfile(),
      ]);

      if (insertResult.error) {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
        toast({
          title: "Error",
          description: "Failed to send message",
          variant: "destructive",
        });
        return;
      }

      // Replace optimistic message with real one (decrypt GIF URL if needed)
      let decryptedGifUrl = insertResult.data.gif_url;
      if (insertResult.data.gif_url && isEncrypted(insertResult.data.gif_url)) {
        try {
          const encryptedData = parseEncryptedMessage(insertResult.data.gif_url);
          if (encryptedData) {
            const encryptionKey = await getCachedSessionKey(user.id, selectedFriend.id);
            decryptedGifUrl = await decryptMessage(
              encryptedData.encrypted,
              encryptedData.iv,
              encryptionKey
            );
          }
        } catch (error) {
          decryptedGifUrl = insertResult.data.gif_url;
        }
      }

      // Fetch replied message if this is a reply
      let repliedMessage: Message | null = null;
      if (insertResult.data.reply_to && currentReplyingTo) {
        repliedMessage = currentReplyingTo;
      } else if (insertResult.data.reply_to) {
        // Fetch from database if we don't have it in state
        const { data: repliedMsg } = await supabase
          .from("messages")
          .select("*")
          .eq("id", insertResult.data.reply_to)
          .single();
        if (repliedMsg) {
          // Decrypt if needed
          let decryptedReplyText = repliedMsg.message_text;
          if (repliedMsg.message_text && isEncrypted(repliedMsg.message_text)) {
            try {
              const encryptedData = parseEncryptedMessage(repliedMsg.message_text);
              if (encryptedData) {
                const otherUserId = repliedMsg.sender_id === user.id ? repliedMsg.receiver_id : repliedMsg.sender_id;
                const encryptionKey = await getCachedSessionKey(user.id, otherUserId);
                decryptedReplyText = await decryptMessage(
                  encryptedData.encrypted,
                  encryptedData.iv,
                  encryptionKey
                );
              }
            } catch (error) {
              // Silently handle decryption errors for replied messages
            }
          }
          // Fetch sender profile
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", repliedMsg.sender_id)
            .single();
          repliedMessage = {
            ...repliedMsg,
            message_text: decryptedReplyText,
            sender_username: senderProfile?.username || "Unknown",
            sender_avatar: senderProfile?.avatar_url || null,
          };
        }
      }

      const realMessage: Message = {
        ...insertResult.data,
        message_text: plainText, // We already have the plaintext, no need to decrypt
        gif_url: decryptedGifUrl, // Use decrypted GIF URL
        sender_username: profileData?.username || "You",
        sender_avatar: profileData?.avatar_url || null,
        replied_message: repliedMessage,
      };

      setMessages(prev => 
        prev.map(m => m.id === optimisticMessage.id ? realMessage : m)
      );

      // Refresh friends list asynchronously (don't wait)
      fetchFriends().catch(console.error);
    }
  };

  const handleSelectGif = (gifUrl: string) => {
    sendMessage(undefined, undefined, gifUrl);
  };

  const handleSendSticker = (stickerId: string) => {
    sendMessage(undefined, stickerId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim()) {
      sendMessage(messageText);
    }
  };

  const handleDeleteMessage = async (messageId: string, isGroupMessage: boolean) => {
    if (!user) return;

    if (!confirm("Are you sure you want to delete this message?")) {
      return;
    }

    try {
      if (isGroupMessage) {
        const { error } = await supabase
          .from("group_messages")
          .delete()
          .eq("id", messageId)
          .eq("sender_id", user.id);

        if (error) throw error;

        setGroupMessages(prev => prev.filter(m => m.id !== messageId));
      } else {
        const { error } = await supabase
          .from("messages")
          .delete()
          .eq("id", messageId)
          .eq("sender_id", user.id);

        if (error) throw error;

        setMessages(prev => prev.filter(m => m.id !== messageId));
      }

      toast({
        title: "Message deleted",
        description: "Your message has been deleted",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete message",
        variant: "destructive",
      });
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen">
      <Navigation />
      {/* Message Notification */}
      {notification && (
        <MessageNotification
          message={notification}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="pt-16 md:pt-0 md:ml-[var(--sidebar-width,5rem)] transition-all duration-300">
        <div className="flex h-[calc(100vh-4rem)] md:h-screen relative">
          {/* Mobile Sidebar Overlay */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}
          
          {/* Friends Sidebar */}
          <div className={`
            absolute md:relative z-50 md:z-auto
            w-80 md:w-80 h-full
            border-r border-primary/30 bg-card flex flex-col
            transform transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}>
            {/* Mobile Header with Close Button */}
            <div className="p-4 border-b border-primary/30 flex items-center justify-between md:hidden">
              <h2 className="text-xl font-display text-primary flex items-center gap-2">
                <Users className="w-5 h-5" />
                Chats
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-4 border-b border-primary/30 hidden md:block">
              <h2 className="text-xl font-display text-primary flex items-center gap-2">
                <Users className="w-5 h-5" />
                Friends Chat
              </h2>
            </div>
            <ScrollArea className="flex-1">
              {friends.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground mb-4">No friends to chat with yet</p>
                  <Button onClick={() => navigate("/friends")} variant="outline">
                    Add Friends
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-primary/10">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      onClick={() => {
                        navigate(`/chat/${friend.id}`);
                        setSelectedFriend(friend);
                        fetchMessages(friend.id);
                        markMessagesAsRead(friend.id);
                        setIsSidebarOpen(false); // Close sidebar on mobile when selecting friend
                      }}
                      className={`p-4 cursor-pointer hover:bg-primary/10 transition-colors ${
                        selectedFriend?.id === friend.id ? 'bg-primary/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="w-12 h-12 border-2 border-primary/30">
                            <AvatarImage src={friend.avatar_url || undefined} alt={friend.username} />
                            <AvatarFallback className="bg-primary/20 text-primary font-display">
                              {friend.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {friend.unread_count > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-secondary text-white text-xs flex items-center justify-center font-bold">
                              {friend.unread_count > 9 ? '9+' : friend.unread_count}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-display text-foreground truncate">{friend.username}</h3>
                            {friend.last_message_time && (
                              <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                                {formatDistanceToNow(new Date(friend.last_message_time), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {friend.last_message || "No messages yet"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col bg-card">
            {selectedGroup ? (
              <>
                {/* Group Chat Header */}
                <div className="p-4 border-b border-primary/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsSidebarOpen(true)}
                      className="md:hidden"
                    >
                      <Menu className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        navigate("/groups");
                        setSelectedGroup(null);
                      }}
                      className="hidden md:flex"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display text-foreground">{selectedGroup.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedGroup.member_count} {selectedGroup.member_count === 1 ? 'member' : 'members'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Group Messages */}
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-4">
                  {groupMessages.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    groupMessages.map((message) => {
                      const isOwn = message.sender_id === user?.id;
                      return (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                        >
                          {!isOwn && (
                            <Avatar className="w-8 h-8 border border-primary/30 flex-shrink-0">
                              <AvatarImage src={message.sender_avatar || undefined} alt={message.sender_username} />
                              <AvatarFallback className="bg-primary/20 text-primary text-xs font-display">
                                {message.sender_username?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%] group/message`}>
                            {!isOwn && (
                              <span className="text-xs text-muted-foreground mb-1">{message.sender_username}</span>
                            )}
                            <div className="flex items-center gap-2 group-hover/message:gap-2">
                              <div
                                className={`rounded-lg p-3 ${
                                  isOwn
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-foreground'
                                }`}
                              >
                                {/* Reply preview */}
                                {message.reply_to && message.replied_message && (
                                  <div className={`mb-2 pb-2 border-l-2 ${
                                    isOwn ? 'border-primary-foreground/30' : 'border-primary/30'
                                  } pl-2 text-xs opacity-80`}>
                                    <div className="font-semibold">
                                      {message.replied_message.sender_username || 'Unknown'}
                                    </div>
                                    <div className="truncate max-w-[200px]">
                                      {message.replied_message.message_type === 'sticker' 
                                        ? 'Sticker'
                                        : message.replied_message.message_type === 'gif'
                                        ? 'GIF'
                                        : message.replied_message.message_text || 'Message'}
                                    </div>
                                  </div>
                                )}
                                {message.message_type === 'gif' ? (
                                  <img
                                    src={message.gif_url || ''}
                                    alt="GIF"
                                    className="max-w-full max-h-64 rounded"
                                    loading="lazy"
                                  />
                                ) : message.message_type === 'sticker' ? (
                                  <div className="text-4xl">
                                    {STICKERS.find(s => s.id === message.sticker_id)?.emoji || '😊'}
                                  </div>
                                ) : (
                                  <p className="whitespace-pre-wrap break-words">
                                    {message.message_text?.split(/(@\w+)|(https?:\/\/[^\s]+)/g).map((part, idx) => {
                                      if (!part) return null;
                                      
                                      // Handle mentions
                                      if (part.startsWith('@')) {
                                        const username = part.substring(1);
                                        const mentionedMember = groupMembers.find(m => m.username === username);
                                        if (mentionedMember) {
                                          return (
                                            <span
                                              key={idx}
                                              className="font-semibold text-yellow-400 bg-yellow-400/20 px-1 rounded cursor-pointer hover:bg-yellow-400/30"
                                              onClick={() => navigate(`/profile/${mentionedMember.user_id}`)}
                                            >
                                              {part}
                                            </span>
                                          );
                                        }
                                      }
                                      
                                      // Handle URLs
                                      if (part.match(/^https?:\/\/.+/)) {
                                        return (
                                          <a
                                            key={idx}
                                            href={part}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:text-blue-300 underline break-all"
                                            onClick={(e) => {
                                              // Allow right-click to copy
                                              e.stopPropagation();
                                            }}
                                            onContextMenu={(e) => {
                                              e.preventDefault();
                                              navigator.clipboard.writeText(part);
                                              toast({
                                                title: "Copied!",
                                                description: "Link copied to clipboard",
                                              });
                                            }}
                                          >
                                            {part}
                                          </a>
                                        );
                                      }
                                      
                                      return <span key={idx}>{part}</span>;
                                    })}
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover/message:opacity-100 transition-opacity flex-shrink-0"
                                onClick={() => setReplyingTo(message)}
                                title="Reply"
                              >
                                <Reply className="w-4 h-4" />
                              </Button>
                              {isOwn && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover/message:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                                  onClick={() => handleDeleteMessage(message.id, true)}
                                  title="Delete message"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground mt-1">
                              {format(new Date(message.created_at), "h:mm a")}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                </ScrollArea>
              </>
            ) : selectedFriend ? (
              <>
                {/* Direct Chat Header */}
                <div className="p-4 border-b border-primary/30 flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSidebarOpen(true)}
                    className="md:hidden"
                  >
                    <Menu className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      navigate("/chat");
                      setSelectedFriend(null);
                    }}
                    className="hidden md:flex"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <Avatar className="w-10 h-10 border-2 border-primary/30">
                    <AvatarImage src={selectedFriend.avatar_url || undefined} alt={selectedFriend.username} />
                    <AvatarFallback className="bg-primary/20 text-primary font-display">
                      {selectedFriend.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-display text-foreground">{selectedFriend.username}</h3>
                    <p className="text-xs text-muted-foreground">Friend</p>
                  </div>
                </div>

                {/* Direct Messages */}
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isOwn = message.sender_id === user?.id;
                      return (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                        >
                          {!isOwn && (
                            <Avatar className="w-8 h-8 border border-primary/30 flex-shrink-0">
                              <AvatarImage src={message.sender_avatar || undefined} alt={message.sender_username} />
                              <AvatarFallback className="bg-primary/20 text-primary text-xs font-display">
                                {message.sender_username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%] group/message`}>
                            {!isOwn && (
                              <span className="text-xs text-muted-foreground mb-1">{message.sender_username}</span>
                            )}
                            <div className="flex items-center gap-2 group-hover/message:gap-2">
                              <div
                                className={`rounded-lg p-3 ${
                                  isOwn
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-foreground'
                                }`}
                              >
                                {/* Reply preview */}
                                {message.reply_to && message.replied_message && (
                                  <div className={`mb-2 pb-2 border-l-2 ${
                                    isOwn ? 'border-primary-foreground/30' : 'border-primary/30'
                                  } pl-2 text-xs opacity-80`}>
                                    <div className="font-semibold">
                                      {message.replied_message.sender_username || 'Unknown'}
                                    </div>
                                    <div className="truncate max-w-[200px]">
                                      {message.replied_message.message_type === 'sticker' 
                                        ? 'Sticker'
                                        : message.replied_message.message_type === 'gif'
                                        ? 'GIF'
                                        : message.replied_message.message_text || 'Message'}
                                    </div>
                                  </div>
                                )}
                                {message.message_type === 'gif' ? (
                                  <img
                                    src={message.gif_url || ''}
                                    alt="GIF"
                                    className="max-w-full max-h-64 rounded"
                                    loading="lazy"
                                  />
                                ) : message.message_type === 'sticker' ? (
                                  <div className="text-4xl">
                                    {STICKERS.find(s => s.id === message.sticker_id)?.emoji || '😊'}
                                  </div>
                                ) : (
                                  <p className="whitespace-pre-wrap break-words">
                                    {message.message_text?.split(/(@\w+)|(https?:\/\/[^\s]+)/g).map((part, idx) => {
                                      if (!part) return null;
                                      
                                      // Handle mentions
                                      if (part.startsWith('@')) {
                                        const username = part.substring(1);
                                        const mentionedMember = groupMembers.find(m => m.username === username);
                                        if (mentionedMember) {
                                          return (
                                            <span
                                              key={idx}
                                              className="font-semibold text-yellow-400 bg-yellow-400/20 px-1 rounded cursor-pointer hover:bg-yellow-400/30"
                                              onClick={() => navigate(`/profile/${mentionedMember.user_id}`)}
                                            >
                                              {part}
                                            </span>
                                          );
                                        }
                                      }
                                      
                                      // Handle URLs
                                      if (part.match(/^https?:\/\/.+/)) {
                                        return (
                                          <a
                                            key={idx}
                                            href={part}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:text-blue-300 underline break-all"
                                            onClick={(e) => {
                                              // Allow right-click to copy
                                              e.stopPropagation();
                                            }}
                                            onContextMenu={(e) => {
                                              e.preventDefault();
                                              navigator.clipboard.writeText(part);
                                              toast({
                                                title: "Copied!",
                                                description: "Link copied to clipboard",
                                              });
                                            }}
                                          >
                                            {part}
                                          </a>
                                        );
                                      }
                                      
                                      return <span key={idx}>{part}</span>;
                                    })}
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover/message:opacity-100 transition-opacity flex-shrink-0"
                                onClick={() => setReplyingTo(message)}
                                title="Reply"
                              >
                                <Reply className="w-4 h-4" />
                              </Button>
                              {isOwn && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover/message:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                                  onClick={() => handleDeleteMessage(message.id, false)}
                                  title="Delete message"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground mt-1">
                              {format(new Date(message.created_at), "h:mm a")}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center p-4">
                  {/* Mobile Menu Button */}
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setIsSidebarOpen(true)}
                    className="md:hidden mb-4"
                  >
                    <Menu className="w-5 h-5 mr-2" />
                    Open Chats
                  </Button>
                  <Users className="w-24 h-24 text-muted-foreground mx-auto mb-4 opacity-50 hidden md:block" />
                  <h3 className="text-xl md:text-2xl font-display text-primary mb-2">Select a friend or group to chat</h3>
                  <p className="text-muted-foreground text-sm md:text-base">Choose from the sidebar or visit Groups to join a group</p>
                </div>
              </div>
            )}

            {/* Message Input - shown for both direct and group chats */}
            {(selectedFriend || selectedGroup) && (
              <div className="p-4 border-t border-primary/30">
                {/* Reply Preview */}
                {replyingTo && (
                  <div className="mb-2 p-2 bg-primary/10 border-l-2 border-primary rounded flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">
                        Replying to {replyingTo.sender_username || 'Unknown'}
                      </div>
                      <div className="text-sm truncate">
                        {replyingTo.message_type === 'sticker' 
                          ? 'Sticker'
                          : replyingTo.message_type === 'gif'
                          ? 'GIF'
                          : replyingTo.message_text || 'Message'}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => setReplyingTo(null)}
                    >
                      <XIcon className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Popover open={isStickerPickerOpen} onOpenChange={setIsStickerPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="icon" className="flex-shrink-0">
                        <Smile className="w-5 h-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 bg-card border-primary/30">
                      <div className="grid grid-cols-6 gap-2">
                        {STICKERS.map((sticker) => (
                          <button
                            key={sticker.id}
                            type="button"
                            onClick={() => handleSendSticker(sticker.id)}
                            className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-2xl"
                            title={sticker.name}
                          >
                            {sticker.emoji}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Popover open={isGifPickerOpen} onOpenChange={setIsGifPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="icon" className="flex-shrink-0">
                        <Image className="w-5 h-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-96 bg-card border-primary/30 p-0" align="start">
                      <GifPicker
                        onSelectGif={handleSelectGif}
                        onClose={() => setIsGifPickerOpen(false)}
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="flex-1 relative">
                    <Input
                      ref={messageInputRef}
                      value={messageText}
                      onChange={(e) => {
                        const value = e.target.value;
                        setMessageText(value);
                        
                        // Check for @ mention in group chats
                        if (selectedGroup) {
                          const cursorPosition = e.target.selectionStart || 0;
                          const textBeforeCursor = value.substring(0, cursorPosition);
                          const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                          
                          if (lastAtIndex !== -1) {
                            const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
                            // Check if there's a space or we're at the end
                            if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
                              const query = textAfterAt.toLowerCase();
                              setMentionQuery(query);
                              setMentionStartIndex(lastAtIndex);
                              
                              // Calculate position for mention picker
                              const input = e.target;
                              const rect = input.getBoundingClientRect();
                              setMentionPickerPosition({
                                top: rect.top - 200, // Position above input
                                left: rect.left,
                              });
                              setShowMentionPicker(true);
                            } else {
                              setShowMentionPicker(false);
                            }
                          } else {
                            setShowMentionPicker(false);
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (showMentionPicker && (e.key === "Enter" || e.key === "Tab")) {
                          // Let MentionPicker handle it
                          return;
                        }
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                      placeholder={selectedGroup ? "Type a message... (use @ to mention)" : "Type a message..."}
                      className="flex-1 bg-input border-primary/30"
                    />
                    {showMentionPicker && selectedGroup && (
                      <MentionPicker
                        members={groupMembers
                          .filter(m => 
                            m.username.toLowerCase().includes(mentionQuery) &&
                            m.user_id !== user?.id
                          )
                          .slice(0, 10)}
                        onSelect={(userId, username) => {
                          if (mentionStartIndex !== -1) {
                            const beforeMention = messageText.substring(0, mentionStartIndex);
                            const afterMention = messageText.substring(
                              mentionStartIndex + 1 + mentionQuery.length
                            );
                            const newText = `${beforeMention}@${username} ${afterMention}`;
                            setMessageText(newText);
                            setShowMentionPicker(false);
                            setMentionQuery("");
                            setMentionStartIndex(-1);
                            // Focus back on input
                            setTimeout(() => {
                              messageInputRef.current?.focus();
                              const cursorPos = beforeMention.length + username.length + 2;
                              messageInputRef.current?.setSelectionRange(cursorPos, cursorPos);
                            }, 0);
                          }
                        }}
                        onClose={() => {
                          setShowMentionPicker(false);
                          setMentionQuery("");
                          setMentionStartIndex(-1);
                        }}
                        position={mentionPickerPosition}
                      />
                    )}
                  </div>
                  <Button type="submit" className="bg-primary hover:bg-primary/90 flex-shrink-0">
                    <Send className="w-5 h-5" />
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;

