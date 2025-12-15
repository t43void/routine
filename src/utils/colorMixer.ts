/**
 * Converts a hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Converts RGB to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

/**
 * Mixes multiple colors based on their weights (hours worked)
 * Colors are blended proportionally to the hours worked on each project
 */
export function mixColors(
  colors: Array<{ color: string; hours: number }>
): string {
  if (colors.length === 0) {
    return "#3b82f6"; // Default blue
  }

  if (colors.length === 1) {
    return colors[0].color;
  }

  // Calculate total hours for normalization
  const totalHours = colors.reduce((sum, item) => sum + item.hours, 0);
  if (totalHours === 0) {
    return colors[0].color;
  }

  // Convert all colors to RGB and calculate weighted average
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;

  for (const item of colors) {
    const rgb = hexToRgb(item.color);
    if (rgb) {
      const weight = item.hours / totalHours;
      totalR += rgb.r * weight;
      totalG += rgb.g * weight;
      totalB += rgb.b * weight;
    }
  }

  return rgbToHex(totalR, totalG, totalB);
}

