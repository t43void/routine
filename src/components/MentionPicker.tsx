import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";

interface MentionPickerProps {
  members: Array<{
    user_id: string;
    username: string;
    avatar_url: string | null;
  }>;
  onSelect: (userId: string, username: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const MentionPicker = ({ members, onSelect, position, onClose }: MentionPickerProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < members.length - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (members[selectedIndex]) {
          onSelect(members[selectedIndex].user_id, members[selectedIndex].username);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [members, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    // Scroll selected item into view
    const selectedElement = pickerRef.current?.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  if (members.length === 0) {
    return null;
  }

  return (
    <Card
      ref={pickerRef}
      className="absolute z-50 w-64 max-h-48 overflow-y-auto bg-card border-primary/30 shadow-lg"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="p-1">
        {members.map((member, index) => (
          <div
            key={member.user_id}
            onClick={() => onSelect(member.user_id, member.username)}
            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
              index === selectedIndex
                ? "bg-primary/20 hover:bg-primary/30"
                : "hover:bg-primary/10"
            }`}
          >
            <Avatar className="w-8 h-8 border border-primary/30">
              <AvatarImage src={member.avatar_url || undefined} alt={member.username} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs">
                {member.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground">{member.username}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default MentionPicker;

