import { expect, it } from "vitest";
import source from "../design-tokens.json?raw";

function luminance(rgb: number[]) {
  return rgb.map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

it("keeps essential text readable on both themes, including selected controls", () => {
  const tokens = JSON.parse(source);
  for (const theme of ["white", "dark"]) {
    for (const foreground of ["text", "second", "muted", "activity-ink", "attention-ink", "success-ink", "error-ink"]) {
      for (const background of ["deep", "reading", "surface", "control", "hover", "selection", "elevated"]) {
        const a = luminance(tokens[theme][foreground]);
        const b = luminance(tokens[theme][background]);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        expect(ratio, `${theme}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});
