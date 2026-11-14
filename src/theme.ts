import source from "../design-tokens.json?raw";
const tokens = JSON.parse(source) as {
  radius: Record<string, number>;
  dark: Record<string, number[]>;
  white: Record<string, number[]>;
};
type Appearance = "dark" | "white";
const key = "loom:appearance";
function apply(appearance: Appearance) {
  const root = document.documentElement;
  root.dataset.theme = appearance;
  root.style.colorScheme = appearance === "white" ? "light" : "dark";
  for (const [name, rgb] of Object.entries(tokens[appearance])) {
    root.style.setProperty(`--theme-${name}`, `rgb(${rgb.join(" ")})`);
    root.style.setProperty(`--theme-${name}-rgb`, rgb.join(" "));
  }
  for (const [name, radius] of Object.entries(tokens.radius)) {
    root.style.setProperty(`--radius-${name}`, `${radius}px`);
  }
  document.querySelectorAll<HTMLButtonElement>("[data-appearance]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.appearance === appearance));
  });
}
let appearance: Appearance = "dark";
try { if (localStorage.getItem(key) === "white") appearance = "white"; } catch { /* Appearance works without persistence. */ }
apply(appearance);
document.querySelectorAll<HTMLButtonElement>("[data-appearance]").forEach(button => {
  button.addEventListener("click", () => {
    appearance = button.dataset.appearance as Appearance;
    apply(appearance);
    try { localStorage.setItem(key, appearance); } catch { /* Keep the chosen appearance for this window. */ }
  });
});
window.addEventListener("storage", event => {
  if (event.key === key) apply(event.newValue === "white" ? "white" : "dark");
});

const header = document.querySelector<HTMLElement>(".topbar");
if (header) new ResizeObserver(() => {
  document.documentElement.style.setProperty("--header-offset", `${header.getBoundingClientRect().height}px`);
}).observe(header);
