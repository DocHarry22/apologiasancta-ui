/**
 * Score color utility for Apologia Sancta Live Quiz
 * Maps score delta to a color gradient from red (0) to green (max)
 */

/** 
 * Maximum possible points in the scoring system.
 * Change this value when the scoring system changes.
 */
export const MAX_SCORE_POINTS = 30;

/**
 * Converts a score value to a CSS color string.
 * Creates a gradient:
 * - 0 points = Red (#ef4444)
 * - mid points = Amber (#f59e0b)
 * - max points = Green (#22c55e)
 * 
 * @param points - The score/delta value
 * @param maxPoints - Maximum possible points (defaults to MAX_SCORE_POINTS)
 * @returns CSS color string (hex)
 */
export function scoreToColor(points: number, maxPoints: number = MAX_SCORE_POINTS): string {
  // Clamp ratio between 0 and 1
  const ratio = Math.max(0, Math.min(1, points / maxPoints));
  
  // Define color stops: red -> amber -> green
  // Red: #ef4444, Amber: #f59e0b, Green: #22c55e
  const red = { r: 239, g: 68, b: 68 };
  const amber = { r: 245, g: 158, b: 11 };
  const green = { r: 34, g: 197, b: 94 };
  
  let r: number, g: number, b: number;
  
  if (ratio <= 0.5) {
    // Red to Amber (0 to 0.5)
    const t = ratio * 2; // normalize to 0-1
    r = Math.round(red.r + (amber.r - red.r) * t);
    g = Math.round(red.g + (amber.g - red.g) * t);
    b = Math.round(red.b + (amber.b - red.b) * t);
  } else {
    // Amber to Green (0.5 to 1)
    const t = (ratio - 0.5) * 2; // normalize to 0-1
    r = Math.round(amber.r + (green.r - amber.r) * t);
    g = Math.round(amber.g + (green.g - amber.g) * t);
    b = Math.round(amber.b + (green.b - amber.b) * t);
  }
  
  // Convert to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Gets a Tailwind-compatible color class based on score ratio.
 * Use this when you need static classes rather than dynamic colors.
 * 
 * @param points - The score/delta value
 * @param maxPoints - Maximum possible points
 * @returns Tailwind color class name
 */
export function scoreToColorClass(points: number, maxPoints: number = MAX_SCORE_POINTS): string {
  const ratio = Math.max(0, Math.min(1, points / maxPoints));
  
  if (ratio === 0) return 'text-red-500';
  if (ratio < 0.25) return 'text-red-400';
  if (ratio < 0.4) return 'text-orange-500';
  if (ratio < 0.6) return 'text-amber-500';
  if (ratio < 0.75) return 'text-yellow-500';
  if (ratio < 0.9) return 'text-lime-500';
  return 'text-green-500';
}
