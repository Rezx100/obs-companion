import type { Project } from "./contracts";
export const sourceText = (p: Project) =>
  p.sourceLabel ||
  (p.url
    ? new URL(p.url).hostname.replace(/^www\./, "")
    : p.source === "screen"
      ? "Screen recording"
      : p.source === "upload"
        ? "Uploaded video"
        : "Website");
export const typeText = (p: Project) =>
  p.type === "brief" ? "Visual brief" : "Walkthrough";
export function durationText(s = 0) {
  s = Math.floor(s);
  return s >= 3600
    ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
    : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
export const durationLabel = (s = 0) =>
  `${Math.floor(s / 3600) ? Math.floor(s / 3600) + " hours " : ""}${Math.floor(s / 60) % 60} minutes ${Math.floor(s) % 60} seconds`;
export function relativeTime(date: string, locale = "en") {
  const delta = (new Date(date).getTime() - Date.now()) / 1000;
  const fmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, n] of [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ] as const)
    if (Math.abs(delta) >= n) return fmt.format(Math.round(delta / n), unit);
  return fmt.format(Math.round(delta), "second");
}
export const absoluteTime = (date: string, locale = "en") =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "long",
  }).format(new Date(date));
export const statusText = (p: Project) =>
  ({
    ready: "Ready",
    draft: "Draft",
    queued: "Queued",
    processing: p.type === "brief" ? "Analyzing site" : "Processing video",
    uploading: `Uploading ${p.progress || 0}%`,
    failed: p.type === "brief" ? "Couldn't analyze" : "Upload failed",
  })[p.status];
export const statusIcon = (p: Project) =>
  ({
    ready: "check",
    draft: "edit",
    queued: "clock",
    processing: "spinner",
    uploading: "upload",
    failed: "warning",
  })[p.status];
export const accessText = (p: Project) =>
  ({
    private: "Only you",
    workspace: "Workspace",
    link: "Anyone with the link",
  })[p.access];
export const accessIcon = (p: Project) =>
  ({ private: "lock", workspace: "people", link: "link" })[p.access];
export function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    !!target.closest('input,textarea,select,[contenteditable="true"]')
  );
}
export async function copyText(text: string) {
  if (!navigator.clipboard)
    throw Error(
      "Clipboard is unavailable. Select and copy the link shown in the dialog.",
    );
  await navigator.clipboard.writeText(text);
}
