import React, { useEffect, useRef, useState } from "react";
import type {
  Project,
  ProjectSource,
  UploadProgress,
  WorkspaceAdapter,
} from "../contracts";
import {
  clearRecording,
  recoverRecording,
  stageRecording,
} from "./recording-store";
import {
  errorMessage,
  formatBytes,
  formatDuration,
  MAX_BROWSER_RECORDING_BYTES,
  publicWebsite,
  validateVideo,
} from "./flow-utils";
import "./features.css";

interface Props {
  source: ProjectSource;
  adapter: WorkspaceAdapter;
  onCreated: (project: Project) => void;
  onClose: () => void;
  notify: (message: string, error?: boolean) => void;
}

export function CreateProject({
  source,
  adapter,
  onCreated,
  onClose,
  notify,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null),
    recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null);
  const controller = useRef<AbortController | null>(null),
    created = useRef<Project | null>(null),
    mounted = useRef(true);
  const recordingStarted = useRef(0),
    elapsedBeforePause = useRef(0);
  const [name, setName] = useState(""),
    [url, setUrl] = useState(""),
    [file, setFile] = useState<File | null>(null);
  const [mobile, setMobile] = useState(true),
    [obs, setObs] = useState(false),
    [busy, setBusy] = useState(false);
  const [requestingCapture, setRequestingCapture] = useState(false);
  const [preparingPreview, setPreparingPreview] = useState(false);
  const [recording, setRecording] = useState<
    "idle" | "recording" | "paused" | "staging" | "staged"
  >("idle");
  const [elapsed, setElapsed] = useState(0),
    [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState(""),
    [recoverySaved, setRecoverySaved] = useState(false),
    [localUrl, setLocalUrl] = useState("");
  const [storageChecked, setStorageChecked] = useState(source !== "screen");
  const activeRecording =
    recording === "recording" ||
    recording === "paused" ||
    recording === "staging";
  const title =
    source === "web"
      ? "Analyze website"
      : source === "screen"
        ? "Record screen"
        : "Upload recording";
  const label = source === "web" ? "Analyze website" : "Create Walkthrough";
  const screenSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof MediaRecorder !== "undefined";

  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    dialog.current
      ?.querySelector<HTMLInputElement>("input:not([type=checkbox])")
      ?.focus();
    if (source === "screen")
      recoverRecording()
        .then((saved) => {
          if (saved && mounted.current) {
            setFile(saved);
            setRecording("staged");
            setRecoverySaved(true);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (mounted.current) setStorageChecked(true);
        });
    return () => {
      mounted.current = false;
      controller.current?.abort();
      if (recorder.current && recorder.current.state !== "inactive")
        recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    if (!file || source !== "screen") {
      setLocalUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setLocalUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, source]);

  useEffect(() => {
    if (recording !== "recording") return;
    const timer = setInterval(
      () =>
        setElapsed(
          (elapsedBeforePause.current + Date.now() - recordingStarted.current) /
            1000,
        ),
      250,
    );
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (
      !activeRecording &&
      !busy &&
      !(source === "screen" && file && !recoverySaved)
    )
      return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [activeRecording, busy, source, file, recoverySaved]);

  function close() {
    if (activeRecording) {
      setError(
        "Stop the recording before closing. Your recording will be saved for recovery.",
      );
      return;
    }
    if (busy) {
      setError(
        preparingPreview || progress?.phase === "verifying"
          ? "Wait for the import to finish before closing."
          : source === "web"
            ? "Wait for website capture to start before closing."
            : "Pause the upload before closing.",
      );
      return;
    }
    if (
      source === "screen" &&
      file &&
      !recoverySaved &&
      !window.confirm(
        "A recovery copy could not be stored in this browser. Download your recording before closing. Close and discard the unsaved recording?",
      )
    )
      return;
    onClose();
  }

  async function startRecording() {
    if (requestingCapture) return;
    if (!screenSupported) {
      setError(
        "Screen recording is unavailable in this browser. Use a desktop browser with screen sharing, or upload a recording from the Vistralo desktop app.",
      );
      return;
    }
    setRequestingCapture(true);
    setError("");
    try {
      const selected = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      if (!mounted.current) {
        selected.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = selected;
      const mimeType = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const capture = new MediaRecorder(
          selected,
          mimeType ? { mimeType } : undefined,
        ),
        chunks: Blob[] = [];
      let total = 0;
      recorder.current = capture;
      elapsedBeforePause.current = 0;
      recordingStarted.current = Date.now();
      setElapsed(0);
      setRecoverySaved(false);
      capture.ondataavailable = (event) => {
        if (event.data.size) {
          chunks.push(event.data);
          total += event.data.size;
        }
        if (
          total >= MAX_BROWSER_RECORDING_BYTES &&
          capture.state !== "inactive"
        ) {
          setError(
            "The 1 GB browser recording limit was reached. Your captured video is ready to save.",
          );
          capture.stop();
        }
      };
      capture.onerror = () => {
        setError(
          "The browser stopped recording unexpectedly. Save any captured video below.",
        );
        if (capture.state !== "inactive") capture.stop();
      };
      capture.onstop = async () => {
        selected.getTracks().forEach((track) => track.stop());
        const extension = capture.mimeType.includes("mp4") ? "mp4" : "webm";
        const video = new File(
          chunks,
          `Screen recording ${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`,
          { type: capture.mimeType || "video/webm" },
        );
        if (!video.size) {
          if (mounted.current) {
            setRecording("idle");
            setError(
              "No video was captured. Choose a screen or window and try again.",
            );
          }
          return;
        }
        if (mounted.current) {
          setFile(video);
          setRecording("staging");
        }
        try {
          await stageRecording(video);
          if (mounted.current) setRecoverySaved(true);
        } catch {
          if (mounted.current)
            setError(
              "The recording is ready, but browser recovery storage is full or unavailable. Download a copy before closing this page.",
            );
        } finally {
          if (mounted.current) setRecording("staged");
        }
      };
      selected.getVideoTracks()[0]?.addEventListener(
        "ended",
        () => {
          if (capture.state !== "inactive") capture.stop();
        },
        { once: true },
      );
      capture.start(1000);
      setRecording("recording");
    } catch (failure) {
      stream.current?.getTracks().forEach((track) => track.stop());
      setError(
        failure instanceof DOMException && failure.name === "NotAllowedError"
          ? "Screen sharing was not allowed. Choose Record screen to try again."
          : errorMessage(failure),
      );
    } finally {
      if (mounted.current) setRequestingCapture(false);
    }
  }

  function togglePause() {
    const capture = recorder.current;
    if (!capture) return;
    if (capture.state === "recording") {
      elapsedBeforePause.current += Date.now() - recordingStarted.current;
      capture.pause();
      setRecording("paused");
    } else if (capture.state === "paused") {
      recordingStarted.current = Date.now();
      capture.resume();
      setRecording("recording");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || activeRecording) return;
    setError("");
    setBusy(true);
    try {
      const sourceUrl = source === "web" ? publicWebsite(url) : undefined;
      if (source !== "web") {
        if (!file) throw new Error("Choose or record a video first.");
        validateVideo(file);
      }
      const projectName = (
        name.trim() ||
        (sourceUrl
          ? `${new URL(sourceUrl).hostname} design review`
          : file?.name.replace(/\.[^.]+$/, "") || "Screen recording")
      ).slice(0, 120);
      if (adapter.mode === "cloud" && file && file.size > 50 * 1024 * 1024) throw new Error("This cloud workspace accepts recordings up to 50 MB.");
      const project =
        created.current ??
        (await adapter.create({
          name: projectName,
          source,
          type: source === "web" ? "brief" : "walkthrough",
          url: sourceUrl,
        }));
      created.current = project;
      if (source === "web") {
        await adapter.rpc("walkthrough", {
          id: project.id,
          url: sourceUrl,
          obs,
          pages: [],
          viewports: [
            { width: 1440, height: 900 },
            ...(mobile ? [{ width: 390, height: 844 }] : []),
          ],
        });
        notify(
          adapter.mode === "demo"
            ? "Demo website analysis started. This is a local simulation."
            : "Website analysis started. You can leave this page while it runs.",
        );
      } else {
        controller.current = new AbortController();
        const uploaded = await adapter.upload(project.id, file!, {
          signal: controller.current.signal,
          onProgress: setProgress,
        });
        if (source === "screen") await clearRecording().catch(() => {});
        let previewReady = true;
        if (adapter.mode === "server") {
          setPreparingPreview(true);
          const derived = await Promise.allSettled([
            adapter.rpc("mediaInfo", { id: project.id, file: uploaded.file }),
            adapter.rpc("thumbnail", { id: project.id }),
          ]);
          previewReady = derived.every(
            (result) => result.status === "fulfilled",
          );
          setPreparingPreview(false);
        }
        notify(
          adapter.mode === "demo"
            ? "Recording saved in this browser demo."
            : previewReady
              ? "Recording uploaded and its source checksum verified."
              : "Recording uploaded and verified. Its preview is not ready yet; you can open and download the source.",
        );
      }
      let refreshed = project;
      try {
        refreshed = (await adapter.project(project.id)).project;
      } catch {
        /* The successful job still exists when a subsequent refresh fails. */
      }
      onCreated(refreshed);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      if (mounted.current) {
        setBusy(false);
        setProgress(null);
        setPreparingPreview(false);
      }
    }
  }

  const progressLabel = preparingPreview
    ? "Preparing preview"
    : progress?.phase === "hashing"
      ? "Checking source"
      : progress?.phase === "verifying"
        ? "Verifying source"
        : "Uploading";
  return (
    <dialog
      ref={dialog}
      className="flow-dialog"
      aria-labelledby="create-title"
      aria-describedby="create-description"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <form onSubmit={submit} className="flow-stack">
        <header className="flow-heading">
          <h2 id="create-title">{title}</h2>
          <button
            className="button button-ghost"
            type="button"
            onClick={close}
            aria-label="Close create project"
          >
            Close
          </button>
        </header>
        <p id="create-description" className="flow-muted">
          {source === "web"
            ? "Capture a public website as a Visual brief with screenshots and observed behavior."
            : source === "screen"
              ? "Choose a screen, window or tab. Save the captured video as a Walkthrough."
              : "Turn an existing video into a Walkthrough."}
        </p>
        {adapter.mode === "demo" && (
          <p className="flow-notice">
            Demo workspace: projects and uploads stay in this browser. Website
            analysis is simulated. Connect the server for real website capture
            and rendering.
          </p>
        )}
        <label className="flow-field">
          Project name <span className="flow-muted">(optional)</span>
          <input
            className="field"
            autoFocus
            value={name}
            maxLength={120}
            placeholder={
              source === "web"
                ? "Website design review"
                : "Untitled Walkthrough"
            }
            onChange={(event) => setName(event.target.value)}
            disabled={busy || !!created.current}
          />
        </label>
        {source === "web" ? (
          <>
            <label className="flow-field">
              Website URL
              <input
                className="field"
                type="url"
                inputMode="url"
                required
                value={url}
                placeholder="https://example.com"
                onChange={(event) => setUrl(event.target.value)}
                disabled={busy}
                aria-describedby="website-help"
              />
            </label>
            <p id="website-help" className="flow-caption flow-muted">
              Public pages only. Sign-in screens and sites that block automated
              access may not be captured. No paid AI analysis runs in this flow.
            </p>
            <label className="flow-check">
              <input
                type="checkbox"
                checked={mobile}
                onChange={(event) => setMobile(event.target.checked)}
                disabled={busy}
              />{" "}
              Include mobile viewport
            </label>
            {adapter.capabilities.obs && (
              <label className="flow-check">
                <input
                  type="checkbox"
                  checked={obs}
                  onChange={(event) => setObs(event.target.checked)}
                  disabled={busy}
                />{" "}
                Record the website with server OBS
              </label>
            )}
          </>
        ) : source === "upload" ? (
          <>
            <label className="flow-dropzone">
              Choose a recording
              <input
                className="field"
                type="file"
                accept="video/mp4,video/webm,video/quicktime,.mkv,.mp4,.webm,.mov"
                disabled={busy || !adapter.capabilities.upload}
                onChange={(event) => {
                  setError("");
                  const next = event.target.files?.[0] ?? null;
                  try {
                    if (next) validateVideo(next);
                    setFile(next);
                  } catch (failure) {
                    setFile(null);
                    setError(errorMessage(failure));
                  }
                }}
                aria-describedby="upload-help"
              />
            </label>
            <p id="upload-help" className="flow-caption flow-muted">
              MP4, WebM, MOV or MKV. Maximum {adapter.mode === "cloud" ? "50 MB" : "20 GB"}. {adapter.mode === "cloud" ? "Keep this page open until verification completes." : "Interrupted uploads can resume when you select the same file for the same project."}
            </p>
            {!adapter.capabilities.upload && (
              <p className="flow-notice">
                Uploads are unavailable in this connection. Connect to the
                Vistralo server to upload a recording.
              </p>
            )}
          </>
        ) : (
          <section className="flow-recorder" aria-label="Screen recording">
            {recording === "idle" && (
              <>
                <p className="flow-muted">
                  Browser screen capture imports a video into your project. The
                  Vistralo desktop app uses OBS for native recording.
                </p>
                <p className="flow-caption flow-muted">
                  Keep this page open while recording. Tab or system audio is
                  captured only when your browser and chosen source support it.
                  Maximum browser capture: 1 GB.
                </p>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={startRecording}
                  disabled={
                    requestingCapture ||
                    !screenSupported ||
                    !storageChecked ||
                    !adapter.capabilities.upload
                  }
                >
                  {requestingCapture ? "Choose a source…" : "Record screen"}
                </button>
                {!screenSupported && (
                  <p className="flow-notice">
                    Screen sharing needs a supported desktop browser on a secure
                    connection. You can upload a video recorded with Vistralo
                    desktop instead.
                  </p>
                )}
              </>
            )}
            {(recording === "recording" || recording === "paused") && (
              <>
                <p className="flow-recording-time">
                  <span>{recording === "paused" ? "Paused" : "Recording"}</span>
                  <time>{formatDuration(elapsed)}</time>
                </p>
                <div className="flow-actions">
                  <button
                    type="button"
                    className="button"
                    onClick={togglePause}
                  >
                    {recording === "paused" ? "Resume" : "Pause"}
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => {
                      if (recorder.current?.state !== "inactive")
                        recorder.current?.stop();
                    }}
                  >
                    Stop recording
                  </button>
                </div>
              </>
            )}
            {recording === "staging" && <p>Saving a browser recovery copy…</p>}
            {recording === "staged" && (
              <>
                <p>
                  {recoverySaved
                    ? "Your recording is saved for recovery in this browser."
                    : "Download a recovery copy before closing this page."}
                </p>
                {localUrl && (
                  <video
                    className="flow-recording-preview"
                    src={localUrl}
                    controls
                    playsInline
                    preload="metadata"
                    aria-label="Preview captured recording"
                  />
                )}
                <div className="flow-actions">
                  {localUrl && (
                    <a className="button" href={localUrl} download={file?.name}>
                      Download recording
                    </a>
                  )}
                  <button
                    type="button"
                    className="button button-ghost"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Discard this captured recording and start again? Download a copy first if you want to keep it.",
                        )
                      )
                        return;
                      await clearRecording().catch(() => {});
                      setFile(null);
                      setRecording("idle");
                      setRecoverySaved(false);
                      setError("");
                    }}
                  >
                    Discard and start again
                  </button>
                </div>
              </>
            )}
          </section>
        )}
        {file && (
          <p className="flow-caption flow-file-summary">
            {file.name} · {formatBytes(file.size)}
          </p>
        )}
        {busy && (
          <div className="flow-stack flow-progress">
            <label htmlFor="create-progress">
              {progress
                ? `${progressLabel}${progress.phase === "verifying" ? "…" : `: ${progress.percent}%`}`
                : source === "web"
                  ? "Starting website analysis…"
                  : "Creating project…"}
            </label>
            <progress
              id="create-progress"
              max={100}
              {...(progress && progress.phase !== "verifying"
                ? { value: progress.percent }
                : {})}
            />
            {source !== "web" &&
              progress &&
              progress.phase !== "verifying" &&
              !preparingPreview && (
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => controller.current?.abort()}
                >
                  Pause upload
                </button>
              )}
          </div>
        )}
        {error && (
          <p className="flow-error" role="alert">
            {error}
          </p>
        )}
        <footer className="flow-actions flow-actions-end">
          <button
            className="button"
            type="button"
            onClick={close}
            disabled={busy || activeRecording}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={
              busy ||
              activeRecording ||
              (source !== "web" && (!file || !adapter.capabilities.upload))
            }
          >
            {created.current && error ? "Try again" : label}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
