import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, MessageCircle } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

interface MessageNotificationProps {
  message: {
    id: string;
    sender_id: string;
    sender_username?: string;
    sender_avatar?: string | null;
    message_text?: string | null;
    message_type: 'text' | 'sticker' | 'gif';
    created_at: string;
    isGroupMessage?: boolean;
    groupId?: string;
    groupName?: string;
  };
  onClose: () => void;
}

const MessageNotification = ({ message, onClose }: MessageNotificationProps) => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Auto-hide after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClick = () => {
    if (message.isGroupMessage && message.groupId) {
      navigate(`/chat/group/${message.groupId}`);
    } else {
      navigate(`/chat/${message.sender_id}`);
    }
    onClose();
  };

  const getMessagePreview = () => {
    if (message.message_type === 'gif') {
      return '🎬 GIF';
    } else if (message.message_type === 'sticker') {
      return '😊 Sticker';
    } else {
      return message.message_text || 'New message';
    }
  };

  if (!isVisible) return null;

  return (
    <Card className="fixed top-4 right-4 z-50 w-80 md:w-96 bg-card border-primary/30 shadow-lg animate-in slide-in-from-right duration-300">
      <div className="p-4 flex items-start gap-3">
        <Avatar className="w-10 h-10 border-2 border-primary/30 flex-shrink-0">
          <AvatarImage src={message.sender_avatar || undefined} alt={message.sender_username} />
          <AvatarFallback className="bg-primary/20 text-primary font-display">
            {message.sender_username?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-display text-sm font-semibold text-foreground truncate">
              {message.isGroupMessage ? message.groupName : message.sender_username}
            </h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(false);
                setTimeout(onClose, 300);
              }}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
            {getMessagePreview()}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
            <Button
              size="sm"
              onClick={handleClick}
              className="h-7 text-xs bg-primary hover:bg-primary/90"
            >
              <MessageCircle className="w-3 h-3 mr-1" />
              Open Chat
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default MessageNotification;

