import { NavigationProgress } from "../components/Primitives";
import React, { useEffect, useRef, useState } from "react";
import type {
  Project,
  ProjectDetail as ProjectInfo,
  UploadProgress,
  WorkspaceAdapter,
} from "../contracts";
import { Icon } from "../components/Icon";
import { uuid } from "../id";
import {
  buildClipPlan,
  downloadText,
  errorMessage,
  formatBytes,
  formatDuration,
  publicWebsite,
  safeFilename,
  validateVideo,
} from "./flow-utils";
import "./features.css";

interface Props {
  project: Project;
  adapter: WorkspaceAdapter;
  onBack: () => void;
  onChanged: (project?: Project) => void;
  notify: (message: string, error?: boolean) => void;
}
type Tab = "overview" | "editor" | "brief" | "files";
type Clip = { key: string; start: string; end: string };
const clip = (start = "0", end = ""): Clip => ({ key: uuid(), start, end });
const isVideo = (file: string) => /\.(mp4|webm|mov|mkv)$/i.test(file);

function MarkdownPreview({ text }: { text: string }) {
  // Text is rendered as React nodes, never as untrusted HTML or executable links.
  return (
    <div className="flow-markdown">
      {text.split("\n").map((line, index) => {
        if (/^#{1,2} /.test(line))
          return <h3 key={index}>{line.replace(/^#+ /, "")}</h3>;
        if (/^#{3,6} /.test(line))
          return <h4 key={index}>{line.replace(/^#+ /, "")}</h4>;
        if (/^- /.test(line))
          return (
            <p className="flow-markdown-bullet" key={index}>
              {line.slice(2)}
            </p>
          );
        return line.trim() ? (
          <p key={index}>{line}</p>
        ) : (
          <div className="flow-markdown-break" key={index} />
        );
      })}
    </div>
  );
}

export function ProjectDetail({
  project: initial,
  adapter,
  onBack,
  onChanged,
  notify,
}: Props) {
  const [info, setInfo] = useState<ProjectInfo | null>(null),
    [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const [brief, setBrief] = useState(""),
    [briefDirty, setBriefDirty] = useState(false),
    [briefMode, setBriefMode] = useState<"edit" | "preview">("preview");
  const [source, setSource] = useState(""),
    [duration, setDuration] = useState<number | null>(null),
    [durationError, setDurationError] = useState("");
  const [clips, setClips] = useState<Clip[]>([clip()]),
    [planDirty, setPlanDirty] = useState(false),
    [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState(initial.url || ""),
    [mediaError, setMediaError] = useState("");
  const dirtyBrief = useRef(false),
    dirtyPlan = useRef(false),
    uploadController = useRef<AbortController | null>(null),
    version = useRef(0);
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]),
    briefFile = useRef("");
  const project = info?.project ?? initial,
    files = info?.files ?? [];
  const active = ["processing", "queued"].includes(project.status),
    processing = active || !!busy;
  const output = project.data.output?.file as string | undefined;
  const original = (project.data.sources?.screen?.file ||
    project.video ||
    project.data.video ||
    project.data.master) as string | undefined;
  const previewFile = output || original;
  const videoFiles = files.filter((file) => isVideo(file.file));
  const tabs: { id: Tab; name: string }[] = [
    { id: "overview", name: "Overview" },
    ...(project.type === "walkthrough" || original
      ? [{ id: "editor" as Tab, name: "Editor" }]
      : []),
    { id: "brief", name: "Visual brief" },
    { id: "files", name: `Files${files.length ? ` (${files.length})` : ""}` },
  ];

  async function refresh(initialLoad = false) {
    const requestVersion = ++version.current;
    if (initialLoad) setLoading(true);
    try {
      const next = await adapter.project(initial.id);
      if (requestVersion !== version.current) return;
      setInfo(next);
      const plan = next.project.data.editPlan;
      if (!dirtyPlan.current && plan?.source) {
        setSource(plan.source);
        setClips(
          plan.clips.map((part: any) =>
            clip(String(part.start), String(part.end)),
          ),
        );
      } else if (!dirtyPlan.current)
        setSource(
          next.project.data.sources?.screen?.file ||
            next.project.video ||
            next.project.data.video ||
            next.project.data.master ||
            "",
        );
      if (!dirtyBrief.current) {
        const file = next.files.find((item) =>
          /(?:visual|implementation)-brief\.md$/i.test(item.file),
        )?.file;
        briefFile.current = file || "";
        if (typeof next.brief === "string") setBrief(next.brief);
        else if (file) {
          const text = await adapter.readText(initial.id, file);
          if (requestVersion === version.current && !dirtyBrief.current)
            setBrief(text);
        }
      }
      setError("");
    } catch (failure) {
      if (requestVersion === version.current) setError(errorMessage(failure));
    } finally {
      if (requestVersion === version.current) setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(true);
    return () => {
      ++version.current;
      uploadController.current?.abort();
    };
  }, [initial.id, adapter]);
  useEffect(() => {
    if (info && initial.updated !== info.project.updated) void refresh();
  }, [initial.updated]);
  useEffect(() => {
    if (!active) return;
    const poll = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    const timer = setInterval(poll, 2500);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [active, initial.id, adapter]);
  useEffect(() => {
    if (!source) {
      setDuration(null);
      return;
    }
    let cancelled = false;
    setDuration(null);
    setDurationError("");
    adapter
      .rpc("mediaInfo", { id: project.id, file: source })
      .then((result) => {
        const measured = Number(
          result.duration ??
            result.format?.duration ??
            result.media?.format?.duration,
        );
        if (!cancelled) {
          if (Number.isFinite(measured) && measured > 0) {
            setDuration(measured);
            setClips((current) =>
              current.length === 1 && !current[0].end
                ? [{ ...current[0], end: String(measured) }]
                : current,
            );
          } else
            setDurationError(
              "This file has no finite duration. Choose another source before creating a trim plan.",
            );
        }
      })
      .catch((failure) => {
        if (!cancelled) setDurationError(errorMessage(failure));
      });
    return () => {
      cancelled = true;
    };
  }, [source, project.id, adapter]);
  useEffect(() => {
    if (!briefDirty && !planDirty && !uploadProgress) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [briefDirty, planDirty, uploadProgress]);

  async function action(
    label: string,
    run: () => Promise<unknown>,
    message: string | (() => string),
  ) {
    if (busy) return;
    setBusy(label);
    setError("");
    try {
      await run();
      await refresh();
      onChanged();
      notify(typeof message === "function" ? message() : message);
    } catch (failure) {
      const message = errorMessage(failure);
      setError(message);
      notify(message, true);
    } finally {
      setBusy("");
    }
  }

  function back() {
    if (uploadProgress) {
      setError("Pause the upload before leaving this project.");
      return;
    }
    if (
      (briefDirty || planDirty) &&
      !window.confirm("Leave this project and discard unsaved edits?")
    )
      return;
    onBack();
  }

  function updateClips(next: Clip[]) {
    setClips(next);
    dirtyPlan.current = true;
    setPlanDirty(true);
  }
  async function savePlan(render = false) {
    await action(
      render ? "Rendering" : "Saving plan",
      async () => {
        const next = buildClipPlan(source, duration, clips);
        await adapter.rpc("plan", { id: project.id, plan: next });
        dirtyPlan.current = false;
        setPlanDirty(false);
        if (render)
          await adapter.rpc("process", { id: project.id, action: "render" });
      },
      render
        ? "Rendering started. The source recording is preserved."
        : "Trim plan saved.",
    );
  }

  async function uploadVideo(file: File) {
    let previewReady = true;
    await action(
      "Uploading",
      async () => {
        validateVideo(file);
        uploadController.current = new AbortController();
        try {
          const result = await adapter.upload(project.id, file, {
            signal: uploadController.current.signal,
            onProgress: setUploadProgress,
          });
          dirtyPlan.current = false;
          setPlanDirty(false);
          if (adapter.mode === "server") {
            const derived = await Promise.allSettled([
              adapter.rpc("mediaInfo", { id: project.id, file: result.file }),
              adapter.rpc("thumbnail", { id: project.id }),
            ]);
            previewReady = derived.every((item) => item.status === "fulfilled");
          }
        } finally {
          setUploadProgress(null);
        }
      },
      () =>
        adapter.mode === "demo"
          ? "Video saved in this browser demo."
          : previewReady
            ? "Video uploaded and source checksum verified."
            : "Video uploaded and verified. Preview preparation is unavailable; download the source from Files.",
    );
  }

  function tabKey(event: React.KeyboardEvent, index: number) {
    let next = index;
    const rtl = document.documentElement.dir === "rtl";
    if (event.key === "ArrowRight")
      next = (index + (rtl ? tabs.length - 1 : 1)) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index + (rtl ? 1 : tabs.length - 1)) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setTab(tabs[next].id);
    tabButtons.current[next]?.focus();
  }

  const sessions = info?.evidence?.sessions ?? [];
  const frames = sessions
    .flatMap((session: any) => {
      const all = session.frames ?? [];
      const stride = Math.max(1, Math.floor(all.length / 6));
      return all
        .filter((_: unknown, index: number) => index % stride === 0)
        .slice(0, 6)
        .map((frame: any) => ({
          ...frame,
          title: session.title || session.url,
          viewport: session.viewport,
        }));
    })
    .slice(0, 18);
  const download = (file: string, label: string) => (
    <a className="button" href={adapter.media(project.id, file, true)} download>
      {label}
    </a>
  );

  return (
    <div className="project-detail flow-stack">
      <header className="flow-detail-heading">
        <div className="flow-stack">
          <nav className="flow-breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li>
                <button className="button button-ghost" onClick={back}>
                  Projects
                </button>
              </li>
              <li aria-current="page">
                <Icon name="chevronRight" size={16} />
                <span>{project.name}</span>
              </li>
            </ol>
          </nav>
          <h1>{project.name}</h1>
          <p className="flow-muted">
            {project.type === "brief" ? "Visual brief" : "Walkthrough"} ·{" "}
            {project.source === "web"
              ? project.sourceLabel || project.url || "Website"
              : project.source === "screen"
                ? "Screen recording"
                : "Uploaded recording"}{" "}
            ·{" "}
            {project.status === "processing"
              ? "Processing"
              : project.status === "failed"
                ? "Needs attention"
                : project.status === "ready"
                  ? "Ready"
                  : "Draft"}
          </p>
        </div>
        <div className="flow-actions">
          {output && download(output, "Download output")}
          {!output && original && download(original, "Download source")}
        </div>
      </header>
      {adapter.mode === "demo" && (
        <p className="flow-notice">
          Demo workspace. Sample evidence is illustrative; website analysis is a
          local simulation. Video rendering needs a connected server. Uploaded
          videos stay in this browser.
        </p>
      )}
      {error && (
        <p className="flow-error" role="alert">
          {error}
          <button
            className="button button-ghost"
            onClick={() => void refresh()}
            disabled={!!busy}
          >
            Refresh project
          </button>
        </p>
      )}
      {project.error && (
        <div className="flow-error">
          <p>{project.error}</p>
          <div className="flow-actions">
            {project.source === "web" && project.url && (
              <button
                className="button"
                disabled={processing}
                onClick={() =>
                  void action(
                    "Retrying capture",
                    () =>
                      adapter.rpc("walkthrough", {
                        id: project.id,
                        url: project.url,
                        viewports: [{ width: 1440, height: 900 }],
                      }),
                    "Website capture restarted.",
                  )
                }
              >
                Retry website capture
              </button>
            )}
            {project.data.editPlan && (
              <button
                className="button"
                disabled={processing}
                onClick={() =>
                  void action(
                    "Retrying render",
                    () =>
                      adapter.rpc("process", {
                        id: project.id,
                        action: "render",
                      }),
                    "Rendering restarted.",
                  )
                }
              >
                Retry render
              </button>
            )}
            {adapter.capabilities.obs &&
              files.some((item) => /^masters\/.*\.mkv$/i.test(item.file)) && (
                <button
                  className="button"
                  disabled={processing}
                  onClick={() =>
                    void action(
                      "Recovering",
                      () => adapter.rpc("recover", { id: project.id }),
                      "OBS recovery started. Source masters are preserved.",
                    )
                  }
                >
                  Recover OBS recording
                </button>
              )}
          </div>
        </div>
      )}
      {active && (
        <section className="flow-job" aria-label="Project processing">
          <div>
            <strong>
              {project.source === "web" ? "Analyzing site" : "Processing video"}
            </strong>
            <p className="flow-caption flow-muted">
              {info?.progress?.detail ||
                info?.progress?.stage ||
                (adapter.mode === "demo"
                  ? project.data.simulationState ||
                    "A local demo simulation is in progress. No website is being captured."
                  : "The job continues on the server when you leave this page.")}
            </p>
          </div>
          <progress aria-label="Processing project" />
          <button
            className="button"
            disabled={!!busy}
            onClick={() =>
              void action(
                "Cancelling",
                () => adapter.rpc("cancel", { id: project.id }),
                "Cancellation requested. Source files are preserved.",
              )
            }
          >
            Cancel job
          </button>
        </section>
      )}
      <div className="flow-tabs" role="tablist" aria-label="Project sections">
        {tabs.map((item, index) => (
          <button
            ref={(element) => {
              tabButtons.current[index] = element;
            }}
            key={item.id}
            id={`project-tab-${item.id}`}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`project-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => tabKey(event, index)}
          >
            {item.name}
          </button>
        ))}
      </div>
      {tabs
        .filter((item) => item.id !== tab)
        .map((item) => (
          <section
            key={item.id}
            id={`project-panel-${item.id}`}
            role="tabpanel"
            aria-labelledby={`project-tab-${item.id}`}
            hidden
          />
        ))}
      <NavigationProgress pending={loading && !info} />
      {loading && !info ? (
        <div className="flow-panel flow-stack" aria-busy="true">
          <div className="flow-skeleton" />
          <p>Loading project…</p>
        </div>
      ) : (
        <section
          className="flow-panel flow-stack"
          role="tabpanel"
          id={`project-panel-${tab}`}
          aria-labelledby={`project-tab-${tab}`}
          tabIndex={0}
        >
          {tab === "overview" && (
            <>
              {previewFile ? (
                <div className="flow-video">
                  <video
                    key={previewFile}
                    src={adapter.media(project.id, previewFile)}
                    poster={project.thumbnail}
                    controls
                    playsInline
                    preload="metadata"
                    onError={() =>
                      setMediaError(
                        "This browser cannot play this video format. Download the source or create an MP4 preview.",
                      )
                    }
                    onLoadedData={() => setMediaError("")}
                    aria-label={`${project.name} recording`}
                  />
                  {mediaError && <p className="flow-notice">{mediaError}</p>}
                  {project.data.sampleVideoNotice && (
                    <p className="flow-caption flow-muted">
                      {project.data.sampleVideoNotice}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flow-empty">
                  <h2>
                    {active
                      ? "Your project is being prepared"
                      : project.type === "brief"
                        ? "Start with website evidence"
                        : "Add a recording to get started"}
                  </h2>
                  <p className="flow-muted">
                    {active
                      ? "Captured evidence and media will appear here as the job completes."
                      : project.type === "brief"
                        ? "Capture a public URL to collect screenshots, observed behavior and an editable Visual brief."
                        : "Upload your source video to review, trim and export a Walkthrough."}
                  </p>
                </div>
              )}
              {previewFile && (
                <div className="flow-actions">
                  {original && download(original, "Download source")}
                  {output && download(output, "Download output")}
                  {original && !output && (
                    <button
                      className="button"
                      disabled={processing}
                      onClick={() =>
                        void action(
                          "Creating MP4",
                          () =>
                            adapter.rpc("process", {
                              id: project.id,
                              action: "remux",
                            }),
                          adapter.mode === "demo"
                            ? "Demo processing simulated; no MP4 was produced."
                            : "Creating an MP4 preview. The source file is preserved.",
                        )
                      }
                    >
                      Create MP4 preview
                    </button>
                  )}
                </div>
              )}
              {!active && !original && project.source !== "web" && (
                <label className="flow-dropzone">
                  Upload source video
                  <input
                    className="field"
                    type="file"
                    accept=".mp4,.webm,.mov,.mkv"
                    disabled={processing || !adapter.capabilities.upload}
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      if (selected) void uploadVideo(selected);
                      event.target.value = "";
                    }}
                  />
                  <span className="flow-caption flow-muted">
                    MP4, WebM, MOV or MKV, up to 20 GB.
                  </span>
                </label>
              )}
              {!active && !info?.evidence && project.source === "web" && (
                <form
                  className="flow-stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void action(
                      "Starting capture",
                      async () => {
                        const url = publicWebsite(websiteUrl);
                        await adapter.update(project.id, { url });
                        await adapter.rpc("walkthrough", {
                          id: project.id,
                          url,
                          viewports: [{ width: 1440, height: 900 }],
                        });
                      },
                      adapter.mode === "demo"
                        ? "Demo capture simulation started."
                        : "Website capture started.",
                    );
                  }}
                >
                  <label className="flow-field">
                    Website URL
                    <input
                      type="url"
                      className="field"
                      required
                      value={websiteUrl}
                      onChange={(event) => setWebsiteUrl(event.target.value)}
                      placeholder="https://example.com"
                      disabled={processing}
                    />
                  </label>
                  <div>
                    <button
                      className="button button-primary"
                      disabled={processing}
                    >
                      Analyze website
                    </button>
                  </div>
                </form>
              )}
              {uploadProgress && (
                <div className="flow-stack">
                  <label htmlFor="detail-upload">
                    {uploadProgress.phase === "hashing"
                      ? "Checking source"
                      : uploadProgress.phase === "verifying"
                        ? "Verifying source"
                        : "Uploading"}
                    : {uploadProgress.percent}%
                  </label>
                  <progress
                    id="detail-upload"
                    max={100}
                    value={uploadProgress.percent}
                  />
                  {uploadProgress.phase !== "verifying" && (
                    <button
                      className="button"
                      onClick={() => uploadController.current?.abort()}
                    >
                      Pause upload
                    </button>
                  )}
                </div>
              )}
              {frames.length > 0 && (
                <section className="flow-stack">
                  <h2>Captured references</h2>
                  <div className="flow-evidence-grid">
                    {frames.map((frame: any) => (
                      <a
                        className="flow-evidence"
                        key={frame.file}
                        href={adapter.media(project.id, frame.file, true)}
                        download
                      >
                        <img
                          src={adapter.media(project.id, frame.file)}
                          alt={`${frame.title}, captured at ${(frame.at / 1000).toFixed(1)} seconds`}
                          loading="lazy"
                          decoding="async"
                        />
                        <span>
                          {frame.viewport?.width} × {frame.viewport?.height} ·{" "}
                          {(frame.at / 1000).toFixed(1)}s
                        </span>
                      </a>
                    ))}
                  </div>
                </section>
              )}
              {info?.evidence && (
                <section className="flow-stack">
                  <h2>Capture details</h2>
                  <dl className="flow-metadata">
                    <div>
                      <dt>Source</dt>
                      <dd>{info.evidence.url || project.url}</dd>
                    </div>
                    <div>
                      <dt>Captured</dt>
                      <dd>
                        {info.evidence.created
                          ? new Intl.DateTimeFormat(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(new Date(info.evidence.created))
                          : "Not recorded"}
                      </dd>
                    </div>
                    <div>
                      <dt>Coverage</dt>
                      <dd>
                        {info.evidence.coverage?.filter(
                          (item: any) => item.state === "captured",
                        ).length ?? 0}{" "}
                        captured interactions,{" "}
                        {info.evidence.coverage?.filter(
                          (item: any) => item.state === "blocked",
                        ).length ?? 0}{" "}
                        blocked
                      </dd>
                    </div>
                  </dl>
                  {sessions.some((session: any) => session.error) && (
                    <p className="flow-error">
                      Some pages could not be captured:{" "}
                      {sessions
                        .filter((session: any) => session.error)
                        .map((session: any) => session.error)
                        .join("; ")}
                    </p>
                  )}
                  <details>
                    <summary>Scope and limitations</summary>
                    <ul>
                      {(info.evidence.limits || []).map(
                        (limit: string, index: number) => (
                          <li key={index}>{limit}</li>
                        ),
                      )}
                    </ul>
                  </details>
                </section>
              )}
            </>
          )}
          {tab === "editor" && (
            <>
              <div>
                <h2>Trim your Walkthrough</h2>
                <p className="flow-muted">
                  Choose the parts to keep in chronological order. Rendering
                  creates a new output and preserves your source.
                </p>
              </div>
              {source && (
                <video
                  className="flow-edit-video"
                  src={adapter.media(project.id, source)}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label="Trim source recording"
                />
              )}
              <label className="flow-field">
                Source recording
                <select
                  className="field"
                  value={source}
                  disabled={processing}
                  onChange={(event) => {
                    setSource(event.target.value);
                    updateClips([clip()]);
                  }}
                >
                  {!source && <option value="">Choose a source</option>}
                  {[
                    ...new Set([
                      ...videoFiles.map((item) => item.file),
                      ...(source ? [source] : []),
                    ]),
                  ].map((file) => (
                    <option value={file} key={file}>
                      {file}
                    </option>
                  ))}
                </select>
              </label>
              {duration ? (
                <p className="flow-caption flow-muted">
                  Source duration: {formatDuration(duration)} (
                  {duration.toFixed(3)} seconds)
                </p>
              ) : (
                <p className="flow-caption flow-muted">
                  {durationError ||
                    (source
                      ? "Checking source duration…"
                      : "Upload a recording in Overview to enable editing.")}
                </p>
              )}
              <div className="flow-stack">
                {clips.map((part, index) => (
                  <fieldset
                    className="flow-clip"
                    key={part.key}
                    disabled={processing || !duration}
                  >
                    <legend>Clip {index + 1}</legend>
                    <label className="flow-field">
                      Start (seconds)
                      <input
                        className="field"
                        type="number"
                        min="0"
                        max={duration ?? undefined}
                        step="0.001"
                        value={part.start}
                        onChange={(event) =>
                          updateClips(
                            clips.map((item) =>
                              item.key === part.key
                                ? { ...item, start: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="flow-field">
                      End (seconds)
                      <input
                        className="field"
                        type="number"
                        min="0"
                        max={duration ?? undefined}
                        step="0.001"
                        value={part.end}
                        onChange={(event) =>
                          updateClips(
                            clips.map((item) =>
                              item.key === part.key
                                ? { ...item, end: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      className="button button-ghost"
                      disabled={clips.length === 1}
                      onClick={() =>
                        updateClips(
                          clips.filter((item) => item.key !== part.key),
                        )
                      }
                      aria-label={`Remove clip ${index + 1}`}
                    >
                      Remove
                    </button>
                  </fieldset>
                ))}
              </div>
              <div className="flow-actions">
                <button
                  className="button"
                  disabled={processing || !duration || clips.length >= 100}
                  onClick={() => updateClips([...clips, clip()])}
                >
                  Add clip
                </button>
                <button
                  className="button"
                  disabled={processing || !duration}
                  onClick={() => void savePlan()}
                >
                  Save trim plan
                </button>
                <button
                  className="button button-primary"
                  disabled={processing || !duration}
                  onClick={() => void savePlan(true)}
                >
                  Save and render
                </button>
              </div>
              <details className="flow-stack">
                <summary>Import a timed transcript</summary>
                <p className="flow-caption flow-muted">
                  Import a JSON array of words, or an object with a words array.
                  Each word needs text, start and end fields in seconds. Review
                  the resulting cuts before rendering. Maximum 2 MB.
                </p>
                <input
                  className="field"
                  type="file"
                  accept=".json,application/json"
                  disabled={processing || !source || !duration}
                  aria-label="Import transcript JSON"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    void action(
                      "Importing transcript",
                      async () => {
                        if (file.size > 2_000_000)
                          throw new Error("Transcript must be under 2 MB.");
                        const parsed = JSON.parse(await file.text()),
                          words = Array.isArray(parsed) ? parsed : parsed.words;
                        if (
                          !Array.isArray(words) ||
                          !words.length ||
                          words.length > 50000 ||
                          words.some(
                            (word) =>
                              !word ||
                              typeof word.text !== "string" ||
                              !Number.isFinite(word.start) ||
                              !Number.isFinite(word.end) ||
                              word.start < 0 ||
                              word.end <= word.start ||
                              (duration && word.end > duration + 0.001),
                          )
                        )
                          throw new Error(
                            "Every transcript word needs text and valid start/end seconds within the source duration.",
                          );
                        await adapter.rpc("transcript", {
                          id: project.id,
                          source,
                          words,
                        });
                        dirtyPlan.current = false;
                        setPlanDirty(false);
                      },
                      "Transcript imported. Review the proposed trim plan before rendering.",
                    );
                  }}
                />
              </details>
            </>
          )}
          {tab === "brief" && (
            <>
              <header className="flow-heading">
                <div>
                  <h2>Visual brief</h2>
                  <p className="flow-muted">
                    Review observed evidence and add your implementation notes.
                  </p>
                </div>
                <div className="flow-actions">
                  <button
                    className="button"
                    aria-pressed={briefMode === "edit"}
                    onClick={() =>
                      setBriefMode(briefMode === "edit" ? "preview" : "edit")
                    }
                  >
                    {briefMode === "edit" ? "Preview" : "Edit brief"}
                  </button>
                  <button
                    className="button"
                    disabled={!brief.trim()}
                    onClick={() =>
                      downloadText(brief, `${safeFilename(project.name)}.md`)
                    }
                  >
                    Download brief
                  </button>
                </div>
              </header>
              {!brief.trim() && briefMode === "preview" ? (
                <div className="flow-empty">
                  <h3>
                    {active
                      ? "Your brief is being prepared"
                      : "Add a project brief"}
                  </h3>
                  <p className="flow-muted">
                    {active
                      ? "The generated evidence report will appear after website capture finishes."
                      : "Write a brief from your reviewed evidence. No AI interpretation has been requested."}
                  </p>
                  <button
                    className="button"
                    onClick={() => {
                      setBrief(
                        `# ${project.name}\n\n## Overview\n\n## Observations\n\n## Implementation notes\n`,
                      );
                      dirtyBrief.current = true;
                      setBriefDirty(true);
                      setBriefMode("edit");
                    }}
                    disabled={processing}
                  >
                    Start a brief
                  </button>
                </div>
              ) : briefMode === "edit" ? (
                <label className="flow-field">
                  Brief in Markdown
                  <textarea
                    className="field flow-brief-editor"
                    value={brief}
                    maxLength={500000}
                    onChange={(event) => {
                      setBrief(event.target.value);
                      dirtyBrief.current = true;
                      setBriefDirty(true);
                    }}
                    disabled={processing}
                    spellCheck
                  />
                </label>
              ) : (
                <MarkdownPreview text={brief} />
              )}
              {briefMode === "edit" && (
                <div className="flow-actions">
                  <button
                    className="button button-primary"
                    disabled={processing || !briefDirty}
                    onClick={() =>
                      void action(
                        "Saving brief",
                        async () => {
                          await adapter.rpc("briefSave", {
                            id: project.id,
                            text: brief,
                          });
                          dirtyBrief.current = false;
                          setBriefDirty(false);
                        },
                        "Visual brief saved.",
                      )
                    }
                  >
                    Save brief
                  </button>
                  {briefDirty && (
                    <span className="flow-caption flow-muted">
                      Unsaved changes
                    </span>
                  )}
                </div>
              )}
            </>
          )}
          {tab === "files" && (
            <>
              <div>
                <h2>Project files</h2>
                <p className="flow-muted">
                  Source masters, captured evidence and exported outputs.
                </p>
              </div>
              {files.length ? (
                <div className="flow-table-wrap">
                  <table className="flow-files">
                    <thead>
                      <tr>
                        <th scope="col">File</th>
                        <th scope="col">Size</th>
                        <th scope="col">
                          <span className="sr-only">Download</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((file) => (
                        <tr key={file.file}>
                          <th scope="row">{file.file}</th>
                          <td>{formatBytes(file.size)}</td>
                          <td>
                            <a
                              className="button button-ghost"
                              href={adapter.media(project.id, file.file, true)}
                              download
                              aria-label={`Download ${file.file}`}
                            >
                              Download
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flow-empty">
                  <h3>No files yet</h3>
                  <p className="flow-muted">
                    Uploaded recordings and captured website evidence will
                    appear here.
                  </p>
                </div>
              )}
              {!!info?.events.length && (
                <details>
                  <summary>Recent project activity</summary>
                  <ol className="flow-activity">
                    {info.events
                      .slice(-12)
                      .reverse()
                      .map((event: any, index) => (
                        <li key={event.id || index}>
                          <strong>
                            {String(
                              event.kind ||
                                event.type ||
                                event.name ||
                                "Project updated",
                            ).replace(/-/g, " ")}
                          </strong>
                          {(event.at || event.created) && (
                            <time dateTime={event.at || event.created}>
                              {new Date(
                                event.at || event.created,
                              ).toLocaleString()}
                            </time>
                          )}
                          {event.data?.error && (
                            <p className="flow-error">{event.data.error}</p>
                          )}
                        </li>
                      ))}
                  </ol>
                </details>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
