export interface AppMenuAction {
  label: string;
  run: () => void | Promise<void>;
  disabled?: () => boolean;
  checked?: () => boolean;
  radio?: boolean;
  description?: string;
}

export interface AppMenuGroup {
  label: string;
  items: (AppMenuAction | "separator")[];
}

/** A shared application menubar with mouse and keyboard navigation. */
export function installAppMenu(root: HTMLElement, groups: AppMenuGroup[]) {
  let openIndex = -1;
  const triggers: HTMLButtonElement[] = [];
  const panels: HTMLElement[] = [];
  const status = document.createElement("span");
  status.className = "app-menu-status";
  status.setAttribute("role", "status");
  status.hidden = true;
  root.setAttribute("role", "menubar");
  root.setAttribute("aria-label", "Application");

  function close(restoreFocus = false) {
    const previous = openIndex;
    openIndex = -1;
    panels.forEach((panel) => panel.hidden = true);
    triggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
    if (restoreFocus && previous >= 0) triggers[previous].focus();
  }

  function enabledItems(panel: HTMLElement) {
    return [...panel.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
  }

  function open(index: number, focus: "first" | "last" | false = false) {
    close();
    status.hidden = true;
    openIndex = (index + groups.length) % groups.length;
    const group = groups[openIndex];
    const panel = panels[openIndex];
    panel.replaceChildren();
    for (const item of group.items) {
      if (item === "separator") {
        const separator = document.createElement("div");
        separator.setAttribute("role", "separator");
        panel.append(separator);
        continue;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.tabIndex = -1;
      button.disabled = item.disabled?.() ?? false;
      button.setAttribute("role", item.radio ? "menuitemradio" : item.checked ? "menuitemcheckbox" : "menuitem");
      if (item.checked) button.setAttribute("aria-checked", String(item.checked()));
      button.textContent = item.label;
      if (item.description) button.title = item.description;
      button.addEventListener("click", async () => {
        close();
        status.hidden = true;
        try {
          await item.run();
        } catch (error) {
          status.textContent = error instanceof Error ? error.message : String(error);
          status.hidden = false;
        }
      });
      panel.append(button);
    }
    panel.hidden = false;
    triggers[openIndex].setAttribute("aria-expanded", "true");
    const items = enabledItems(panel);
    if (focus) (focus === "first" ? items[0] : items.at(-1))?.focus();
  }

  groups.forEach((group, index) => {
    const container = document.createElement("div");
    container.className = "app-menu-group";
    container.setAttribute("role", "none");
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "app-menu-trigger";
    trigger.textContent = group.label;
    trigger.tabIndex = index === 0 ? 0 : -1;
    trigger.setAttribute("role", "menuitem");
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", `app-menu-panel-${index}`);
    const panel = document.createElement("div");
    panel.id = `app-menu-panel-${index}`;
    panel.className = "app-menu-panel";
    panel.setAttribute("role", "menu");
    panel.setAttribute("aria-label", group.label);
    panel.hidden = true;
    triggers.push(trigger);
    panels.push(panel);
    trigger.addEventListener("focus", () => {
      triggers.forEach((other) => other.tabIndex = other === trigger ? 0 : -1);
    });
    trigger.addEventListener("click", (event) => openIndex === index ? close() : open(index, event.detail === 0 ? "first" : false));
    trigger.addEventListener("pointerenter", () => {
      if (openIndex >= 0 && openIndex !== index) open(index);
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        open(index, event.key === "ArrowDown" ? "first" : "last");
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const next = (index + (event.key === "ArrowRight" ? 1 : -1) + groups.length) % groups.length;
        triggers[next].focus();
        if (openIndex >= 0) open(next);
      }
    });
    panel.addEventListener("keydown", (event) => {
      const items = enabledItems(panel);
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        open(index + (event.key === "ArrowRight" ? 1 : -1), "first");
      }
    });
    container.append(trigger, panel);
    root.append(container);
  });
  root.append(status);
  document.addEventListener("keydown", (event) => {
    if (event.key === "F10" && !event.shiftKey) {
      event.preventDefault();
      triggers[0]?.focus();
    } else if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      const index = groups.findIndex((group) => group.label[0].toLowerCase() === event.key.toLowerCase());
      if (index >= 0) {
        event.preventDefault();
        open(index, "first");
      }
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Node && !root.contains(event.target)) close();
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openIndex >= 0) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") close();
  });
  root.addEventListener("focusout", (event) => {
    if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) close();
  });
  return { close };
}

/** Keep the text-field selection when opening the Edit menu takes focus. */
export function textEditingActions(): AppMenuAction[] {
  let target: HTMLInputElement | HTMLTextAreaElement | null = null;
  document.addEventListener("focusin", (event) => {
    const element = event.target;
    if (element instanceof HTMLTextAreaElement ||
      (element instanceof HTMLInputElement && ["text", "search", "url", "tel"].includes(element.type))) {
      target = element;
    }
  });
  const available = () => target?.isConnected && target.offsetParent !== null && !target.disabled;
  const selected = () => target?.selectionStart !== target?.selectionEnd;
  return ["Undo", "Redo", "Cut", "Copy", "Paste", "Select all"].map((label) => ({
    label,
    disabled: () => !available() || (label !== "Copy" && label !== "Select all" && target!.readOnly)
      || ((label === "Copy" || label === "Cut") && !selected()),
    run: async () => {
      if (!available()) return;
      const field = target!;
      field.focus();
      if (label === "Select all") { field.select(); return; }
      const command = label.toLowerCase();
      // execCommand uses the webview's editing history and preserves undo.
      const execute = (name: string, value?: string) => {
        try { return document.execCommand(name, false, value); }
        catch { return false; }
      };
      if (execute(command)) return;
      if (label === "Copy" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0));
        return;
      }
      if (label === "Paste" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (execute("insertText", text)) return;
      }
      throw new Error(`${label} is unavailable here. Use the text field’s keyboard shortcut.`);
    },
  }));
}
