"use client";

import * as React from "react";

/**
 * Runs inside the editor's preview iframe. Turns section clicks into
 * `halyard:select` messages for the parent editor, highlights the selected
 * section, and scrolls to it when the editor asks. Only talks to the same
 * origin and only when actually framed.
 */
export function PreviewBridge() {
  React.useEffect(() => {
    if (window.parent === window) return;
    const origin = window.location.origin;
    const root = document.querySelector<HTMLElement>(".st-root");
    if (!root) return;
    root.classList.add("st-editing");

    const select = (id: string | null) => {
      root.querySelectorAll<HTMLElement>(".st-section.is-selected").forEach((el) => el.classList.remove("is-selected"));
      if (!id) return;
      const el = root.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(id)}"]`);
      el?.classList.add("is-selected");
      return el;
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const section = target.closest<HTMLElement>("[data-section-id]");
      if (!section) return;
      // Links and buttons still work with a modifier; a plain click selects.
      if (!event.metaKey && !event.ctrlKey) event.preventDefault();
      select(section.dataset.sectionId ?? null);
      window.parent.postMessage({ type: "halyard:select", id: section.dataset.sectionId }, origin);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || !event.data || typeof event.data !== "object") return;
      if (event.data.type === "halyard:highlight") {
        const el = select(event.data.id ?? null);
        if (el && event.data.scroll) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "halyard:ready" }, origin);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("message", onMessage);
      root.classList.remove("st-editing");
    };
  }, []);
  return null;
}
