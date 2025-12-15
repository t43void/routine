import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

const PRESET_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#ef4444", // red
  "#f97316", // orange
  "#84cc16", // lime
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#a855f7", // violet
];

export const ColorPicker = ({ color, onChange }: ColorPickerProps) => {
  const [customColor, setCustomColor] = useState(color);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 border-primary/30"
        >
          <div
            className="w-5 h-5 rounded border border-primary/30"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm">{color.toUpperCase()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 bg-card border-primary/30">
        <div className="space-y-4">
          <div>
            <Label className="text-sm mb-2 block">Preset Colors</Label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => {
                    onChange(presetColor);
                    setCustomColor(presetColor);
                  }}
                  className={`w-8 h-8 rounded border-2 transition-all ${
                    color === presetColor
                      ? "border-primary scale-110"
                      : "border-muted/30 hover:border-primary/50"
                  }`}
                  style={{ backgroundColor: presetColor }}
                  title={presetColor}
                />
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="custom-color" className="text-sm mb-2 block">
              Custom Color
            </Label>
            <div className="flex gap-2">
              <Input
                id="custom-color"
                type="color"
                value={customColor}
                onChange={(e) => {
                  const newColor = e.target.value;
                  setCustomColor(newColor);
                  onChange(newColor);
                }}
                className="h-10 w-20 cursor-pointer"
              />
              <Input
                type="text"
                value={customColor}
                onChange={(e) => {
                  const newColor = e.target.value;
                  setCustomColor(newColor);
                  if (/^#[0-9A-F]{6}$/i.test(newColor)) {
                    onChange(newColor);
                  }
                }}
                placeholder="#000000"
                className="flex-1 font-mono text-sm"
                pattern="^#[0-9A-F]{6}$"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
