import { cloudConfigured, cloud } from "./cloud";
import { CloudLogin } from "./features/CloudLogin";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createAdapter, readDemoShare } from "./adapters";
import type {
  AppMode,
  Project,
  ProjectSource,
  ShareLink,
  WorkspaceAdapter,
} from "./contracts";
import { Icon } from "./components/Icon";
import {
  Dialog,
  NavigationProgress,
  Menu,
  TextDialog,
  ToolButton,
  type MenuAction,
} from "./components/Primitives";
import { Projects } from "./features/Projects";
import { States } from "./features/States";
import { CreateProject } from "./features/CreateProject";
import { ProjectDetail } from "./features/ProjectDetail";
import { copyText, isTyping } from "./utils";
const docsUrl =
  "https://github.com/Rezx100/obs-companion/blob/codex/vistralo-web-app/deployment-source/vistralo/docs/WEB-APP.md";
const getMode = (): AppMode =>
  location.hash.startsWith("#demo") ||
  document
    .querySelector('meta[name="vistralo-mode"]')
    ?.getAttribute("content") === "demo"
    ? "demo"
    : cloudConfigured ? "cloud" : window.vistralo
      ? "desktop"
      : "server";
function route() {
  return location.hash
    .replace(/^#(?:demo\/?)?/, "")
    .split("/")
    .filter(Boolean);
}
function RailRow({
  icon,
  label,
  onClick,
  active = false,
  children,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      className={`rail-row tooltip-host ${active ? "active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <span className="rail-icon">
        <Icon name={icon} size={16} />
      </span>
      <span className="rail-label">{label}</span>
      {children}
      <span className="tooltip" role="tooltip">
        {label}
      </span>
    </button>
  );
}
function ShareDialog({
  projects,
  adapter,
  onClose,
  notify,
}: {
  projects: Project[];
  adapter: WorkspaceAdapter;
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const [links, setLinks] = useState<Array<ShareLink & { name: string }>>([]),
    [days, setDays] = useState<1 | 7 | 30>(7),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all(
      projects.map(async (p) =>
        (await adapter.shares(p.id)).map((l) => ({ ...l, name: p.name })),
      ),
    )
      .then((all) => setLinks(all.flat()))
      .catch((e) => setError(e.message));
  }, []);
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const next: Array<ShareLink & { name: string }> = [];
      for (const p of projects)
        next.push({ ...(await adapter.share(p.id, days)), name: p.name });
      setLinks((v) => [...v, ...next]);
      notify(
        `${next.length} share ${next.length === 1 ? "link" : "links"} created`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        projects.length === 1
          ? `Share ${projects[0].name}`
          : `Share ${projects.length} projects`
      }
      onClose={onClose}
    >
      <p>
        Anyone with a link can view the completed output until it expires or you
        revoke it. The selected video or visual brief is shared. Other files and
        job history stay private.
      </p>
      {adapter.mode === "demo" && (
        <p className="notice">
          Demo links work only in this browser. Sign in to your studio to create
          a link others can open.
        </p>
      )}
      <label className="field">
        Link expires after
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value) as 1 | 7 | 30)}
        >
          <option value="1">1 day</option>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
        </select>
      </label>
      <button
        className="button button-primary"
        disabled={busy || !adapter.capabilities.share}
        onClick={generate}
      >
        {busy ? "Creating…" : "Create read-only link"}
      </button>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="share-links">
        {links.map((l) => (
          <div className="share-link" key={l.id}>
            <strong>{l.name}</strong>
            {l.path || l.url ? (
              <>
                <input
                  readOnly
                  aria-label={`Share link for ${l.name}`}
                  value={l.url || new URL(l.path!, location.origin).href}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  className="button"
                  onClick={() =>
                    copyText(l.url || new URL(l.path!, location.origin).href)
                      .then(() => notify("Link copied"))
                      .catch((e) => setError(e.message))
                  }
                >
                  <Icon name="copy" />
                  Copy link
                </button>
              </>
            ) : (
              <span>Existing link · token is shown only when created</span>
            )}
            <small>
              {l.revoked
                ? "Revoked"
                : l.expiresAt
                  ? `Expires ${new Date(l.expiresAt).toLocaleString()}`
                  : "Local demo link"}
            </small>
            <button
              className="button button-ghost danger-text"
              disabled={l.revoked}
              onClick={async () => {
                try {
                  await adapter.revoke(l.id);
                  setLinks((v) =>
                    v.map((x) => (x.id === l.id ? { ...x, revoked: true } : x)),
                  );
                  notify("Share link revoked");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Revoke
            </button>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
function SharedPage({ demoId }: { demoId?: string }) {
  const [data, setData] = useState<any>(),
    [error, setError] = useState("");
  useEffect(() => {
    if (demoId) {
      readDemoShare(demoId)
        .then(setData)
        .catch((e) => setError(e.message));
      return;
    }
    fetch(`${location.pathname.replace(/\/$/, "")}/data`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw Error(result.error || "This link is unavailable");
        setData(result);
      })
      .catch((e) => setError(e.message));
  }, [demoId]);
  const media = (file: string) =>
    `${location.pathname.replace(/\/$/, "")}/media?${new URLSearchParams({ file })}`;
  const poster = data?.thumbnail
    ? demoId
      ? data.thumbnail
      : media(data.thumbnail.file || data.thumbnail)
    : undefined;
  const video = data?.video
    ? demoId
      ? data.video
      : media(data.video)
    : undefined;
  const downloads = data
    ? demoId
      ? data.files.filter((file: any) =>
          /\.(mp4|webm|mov|mkv|md|pdf)$/i.test(file.file),
        )
      : [data.video, data.briefFile]
          .filter(Boolean)
          .map((file: string) => ({ file, url: `${media(file)}&download=1` }))
    : [];
  return (
    <main className="shared-page">
      <a className="shared-brand" href="/">
        Vistralo
      </a>
      {error ? (
        <>
          <h1>Link unavailable</h1>
          <p>{error}</p>
        </>
      ) : data ? (
        <>
          <h1>{data.project?.name || data.name || "Shared project"}</h1>
          <p>
            {demoId
              ? "Read-only demo link · This browser only"
              : "Read-only shared project"}
          </p>
          {video ? (
            <div className="shared-file">
              <video controls preload="metadata" src={video} poster={poster} />
            </div>
          ) : poster ? (
            <div className="shared-file">
              <img src={poster} alt="Project preview" />
            </div>
          ) : null}
          {data.brief && <pre className="brief-text">{data.brief}</pre>}
          {downloads.map((file: any) => (
            <div className="shared-file" key={file.file}>
              <a href={file.url} download className="button">
                Download {file.file.split("/").pop()}
              </a>
            </div>
          ))}
        </>
      ) : (
        <>
          <h1>Opening shared project</h1>
          <p>Loading…</p>
        </>
      )}
    </main>
  );
}
export default function App() {
  const [mode, setMode] = useState<AppMode>(getMode),
    [path, setPath] = useState(route),
    [projects, setProjects] = useState<Project[]>([]),
    [loading, setLoading] = useState(true),
    [authenticated, setAuthenticated] = useState(false),
    [error, setError] = useState(""),
    [collapsed, setCollapsed] = useState(
      () => localStorage.getItem("vistralo-rail") === "collapsed",
    ),
    [drawer, setDrawer] = useState(false),
    [mobileNavigation, setMobileNavigation] = useState(
      () => window.matchMedia("(max-width: 767px)").matches,
    ),
    [menu, setMenu] = useState(""),
    [modal, setModal] = useState(""),
    [source, setSource] = useState<ProjectSource | null>(null),
    [share, setShare] = useState<Project[] | null>(null),
    [edit, setEdit] = useState<{ kind: string; projects: Project[] } | null>(
      null,
    ),
    [deleting, setDeleting] = useState<string[] | null>(null),
    [message, setMessage] = useState(""),
    [undo, setUndo] = useState<string[] | null>(null),
    [theme, setTheme] = useState(
      () => localStorage.getItem("vistralo-theme") || "dark",
    ),
    [locale, setLocale] = useState(
      () => localStorage.getItem("vistralo-locale") || "en",
    ),
    [direction, setDirection] = useState(
      () => localStorage.getItem("vistralo-direction") || "ltr",
    ),
    [profile, setProfile] = useState({
      name: "Rezan Ferdous",
      email: "",
      workspace: "Rezan’s workspace",
    }),
    [health, setHealth] = useState("");
  const adapter = useMemo(() => createAdapter(mode), [mode]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const previousStatuses = useRef<Record<string, string>>({});
  const navigationRef = useRef<HTMLElement>(null);
  const drawerReturnFocus = useRef<HTMLElement | null>(null);
  const notify = useCallback((s: string) => {
    setMessage(s);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const rows = await adapter.list();
      const changed = rows.filter(
        (p) =>
          previousStatuses.current[p.id] &&
          previousStatuses.current[p.id] !== p.status,
      );
      if (changed.length)
        notify(
          changed
            .map(
              (p) =>
                `${p.name}: ${p.status === "processing" ? "processing" : p.status}`,
            )
            .join(". "),
        );
      previousStatuses.current = Object.fromEntries(
        rows.map((p) => [p.id, p.status]),
      );
      setProjects(rows);
      setAuthenticated(true);
      setError("");
      return rows;
    } catch (e) {
      setError((e as Error).message);
      if (/sign in|session|401|unauthorized/i.test((e as Error).message))
        setAuthenticated(false);
      return [];
    } finally {
      setLoading(false);
    }
  }, [adapter]);
  useEffect(() => {
    const onHash = () => {
      setPath(route());
      const next = getMode();
      if (next !== mode) {
        setMode(next);
        setProjects([]);
        setLoading(true);
        setAuthenticated(false);
      }
      setDrawer(false);
      setMenu("");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [mode]);
  useEffect(() => {
    const subscription = mode === "cloud" ? cloud?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") { setAuthenticated(false); setProjects([]); }
    }) : undefined;
    return () => subscription?.data.subscription.unsubscribe();
  }, [mode]);
  useEffect(() => {
    refresh();
    adapter
      .settings()
      .then((s) => {
        setProfile((p) => ({
          ...p,
          name: String(s.displayName || p.name),
          email: String(s.email || p.email),
          workspace: String(s.name || p.workspace),
        }));
      })
      .catch(() => {});
    const interval = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !document.querySelector("dialog[open]")
      )
        refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [refresh, adapter]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    localStorage.setItem("vistralo-theme", theme);
    localStorage.setItem("vistralo-locale", locale);
    localStorage.setItem("vistralo-direction", direction);
  }, [theme, locale, direction]);
  useEffect(() => {
    localStorage.setItem("vistralo-rail", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);
  useEffect(() => {
    if ((mode === "server" || mode === "cloud") && !authenticated) {
      setDrawer(false);
      setMenu("");
    }
  }, [mode, authenticated]);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const change = () => {
      const wasInNavigation = navigationRef.current?.contains(
        document.activeElement,
      );
      setMobileNavigation(query.matches);
      setDrawer(false);
      setMenu("");
      if (query.matches && wasInNavigation)
        requestAnimationFrame(() =>
          document.getElementById("navigation-trigger")?.focus(),
        );
    };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!mobileNavigation || !drawer) return;
    const navigation = navigationRef.current;
    if (!navigation) return;
    const focusable = () =>
      Array.from(
        navigation.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.closest("[inert]") &&
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== "hidden",
      );
    const focusStart = () =>
      (
        navigation.querySelector<HTMLElement>(
          'button[aria-label="Close navigation"]',
        ) ||
        focusable()[0] ||
        navigation
      ).focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focusStart();
    const key = (event: KeyboardEvent) => {
      // A native modal opened from navigation owns focus until it closes.
      if (document.querySelector("dialog[open]")) return;
      // The drawer owns keyboard interaction; background window shortcuts must
      // not select projects or open search/create controls behind it.
      event.stopPropagation();
      if (
        event.key === "Escape" ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b")
      ) {
        event.preventDefault();
        setMenu("");
        setDrawer(false);
      } else if (event.key === "Tab") {
        const targets = focusable();
        const first = targets[0],
          last = targets[targets.length - 1];
        if (!first) {
          event.preventDefault();
          navigation.focus();
        } else if (
          !navigation.contains(document.activeElement) ||
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    const containFocus = (event: FocusEvent) => {
      if (
        !document.querySelector("dialog[open]") &&
        !navigation.contains(event.target as Node)
      )
        focusStart();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("focusin", containFocus);
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => {
        if (
          !window.matchMedia("(max-width: 767px)").matches ||
          document.querySelector("dialog[open]")
        )
          return;
        const target = drawerReturnFocus.current;
        if (target?.isConnected && !target.closest("[inert]")) target.focus();
        else document.getElementById("navigation-trigger")?.focus();
      });
    };
  }, [mobileNavigation, drawer]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (isTyping(e.target) || document.querySelector("dialog[open]")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (mobileNavigation) {
          if (!drawer)
            drawerReturnFocus.current = document.activeElement as HTMLElement;
          setDrawer((value) => !value);
          setMenu("");
        } else setCollapsed((v) => !v);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [mobileNavigation, drawer]);
  function go(to: string) {
    location.hash = (mode === "demo" ? "demo/" : "") + to;
  }
  function open(p: Project) {
    adapter
      .update(p.id, { lastOpened: new Date().toISOString() })
      .catch(() => {});
    go("project/" + p.id);
  }
  async function run(fn: () => Promise<any>, success?: string) {
    try {
      await fn();
      if (success) notify(success);
      await refresh();
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function download(p: Project) {
    const detail = await adapter.project(p.id);
    const file =
      detail.project.data.output?.file ||
      detail.project.video ||
      detail.files.find((f) => /\.md$/.test(f.file))?.file;
    if (!file)
      throw Error(
        "No completed output to download yet. Open the project to finish it.",
      );
    const a = document.createElement("a");
    a.href = adapter.media(p.id, file, true);
    a.download = "";
    document.body.append(a);
    a.click();
    a.remove();
  }
  async function trash(ids: string[]) {
    await adapter.trash(ids);
    setUndo(ids);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setUndo(null), 8000);
    notify(
      `${ids.length} ${ids.length === 1 ? "project" : "projects"} moved to Trash`,
    );
    await refresh();
  }
  async function bulk(action: string, ids: string[]) {
    const items = projects.filter((p) => ids.includes(p.id));
    try {
      if (action === "trash") await trash(ids);
      if (action === "restore") {
        await adapter.restore(ids);
        notify(`${ids.length} projects restored`);
        await refresh();
      }
      if (action === "delete") setDeleting(ids);
      if (action === "share") setShare(items);
      if (action === "copy") {
        await copyText(
          items
            .map(
              (p) =>
                new URL(
                  `#${mode === "demo" ? "demo/" : ""}project/${p.id}`,
                  location.href,
                ).href,
            )
            .join("\n"),
        );
        notify("Project links copied. Studio sign-in is required.");
      }
      if (action === "move") setEdit({ kind: "move", projects: items });
      if (action === "download") {
        for (const p of items) await download(p);
        notify(`${items.length} downloads requested`);
      }
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function actions(p: Project): MenuAction[] {
    if (p.trashed)
      return [
        {
          label: "Restore",
          icon: "restore",
          onClick: () => run(() => adapter.restore([p.id]), "Project restored"),
        },
        {
          label: "Delete permanently",
          icon: "trash",
          danger: true,
          onClick: () => setDeleting([p.id]),
        },
      ];
    const normal: MenuAction[] = [
      { label: "Open", icon: "projects", onClick: () => open(p) },
      {
        label: "Share",
        icon: "people",
        disabled: !adapter.capabilities.share,
        onClick: () => setShare([p]),
      },
      {
        label: "Copy link",
        icon: "link",
        onClick: () =>
          run(
            () =>
              copyText(
                new URL(
                  `#${mode === "demo" ? "demo/" : ""}project/${p.id}`,
                  location.href,
                ).href,
              ),
            "Project link copied. Studio sign-in is required.",
          ),
      },
      {
        label: "Rename",
        icon: "edit",
        separator: true,
        onClick: () => setEdit({ kind: "rename", projects: [p] }),
      },
      {
        label: p.pinned ? "Unpin" : "Pin",
        icon: "pin",
        onClick: () =>
          run(
            () => adapter.update(p.id, { pinned: !p.pinned }),
            p.pinned ? "Project unpinned" : "Project pinned",
          ),
      },
      {
        label: "Duplicate",
        icon: "copy",
        onClick: () => run(() => adapter.duplicate(p.id), "Project duplicated"),
      },
      {
        label: "Move to",
        icon: "folder",
        onClick: () => setEdit({ kind: "move", projects: [p] }),
      },
      ...(p.type === "walkthrough"
        ? [
            {
              label: "Download",
              icon: "download",
              disabled: !p.video && !p.data.output?.file,
              onClick: () => run(() => download(p), "Download requested"),
            },
          ]
        : []),
      {
        label: "Delete",
        icon: "trash",
        separator: true,
        danger: true,
        onClick: () => run(() => trash([p.id])),
      },
    ];
    if (
      p.status === "processing" ||
      p.status === "uploading" ||
      p.status === "queued"
    )
      normal.splice(1, 0, {
        label: "Cancel",
        icon: "close",
        onClick: () =>
          run(
            () => adapter.rpc("cancel", { id: p.id }),
            "Cancellation requested",
          ),
      });
    if (p.status === "failed")
      normal.splice(
        1,
        0,
        {
          label: "Retry",
          icon: "restore",
          onClick: () =>
            p.source === "web" && p.url
              ? run(
                  () => adapter.rpc("walkthrough", { id: p.id, url: p.url }),
                  "Website analysis restarted",
                )
              : open(p),
        },
        {
          label: "Remove",
          icon: "trash",
          onClick: () => run(() => trash([p.id])),
        },
      );
    return normal;
  }
  if (location.pathname.startsWith("/share/")) return <SharedPage />;
  if (mode === "demo" && path[0] === "share")
    return <SharedPage demoId={path[1]} />;
  if (mode === "cloud" && (!authenticated || new URLSearchParams(location.search).get("recovery") === "1"))
    return <CloudLogin onReady={async () => { await refresh(); const s = await adapter.settings(); setProfile(p => ({...p,name:String(s.displayName),email:String(s.email),workspace:String(s.name)})); }} />;
  if (!authenticated && mode === "server")
    return (
      <main className="login-page">
        <div className="login-card">
          <img
            src={
              theme === "dark"
                ? "/assets/brand/emblem-light.svg"
                : "/assets/brand/emblem-dark.svg"
            }
            alt=""
            width="32"
            height="32"
          />
          <h1>Sign in to Vistralo</h1>
          <p>Open your private studio with its access token.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setLoading(true);
              try {
                await adapter.login(String(f.get("token")));
                (e.target as HTMLFormElement).reset();
                await refresh();
              } catch (e) {
                setError((e as Error).message);
                setLoading(false);
              }
            }}
          >
            <label className="field">
              Studio access token
              <input
                autoComplete="off"
                type="password"
                name="token"
                required
                minLength={32}
              />
            </label>
            {error && !/sign in/i.test(error) && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <button className="button button-primary" disabled={loading}>
              {loading ? "Connecting…" : "Open studio"}
            </button>
          </form>
          <button
            className="button button-ghost"
            onClick={() => {
              location.hash = "demo/projects";
            }}
          >
            Explore the demo
          </button>
          <p className="caption">
            Your studio token stays out of browser storage. Demo projects are
            stored in this browser.
          </p>
        </div>
      </main>
    );
  const current = projects.find((p) => p.id === path[1]),
    view = path[0] || "projects";
  const visible = projects.filter((p) => !p.trashed),
    pinned = visible.filter((p) => p.pinned).slice(0, 5),
    recent = visible
      .filter((p) => p.lastOpened)
      .sort((a, b) => String(b.lastOpened).localeCompare(String(a.lastOpened)))
      .slice(0, 5);
  const navLabels =
    locale === "de"
      ? ["Projekte", "Mit mir geteilt", "Papierkorb"]
      : ["Projects", "Shared with me", "Trash"];
  return (
    <div
      className={`app-shell ${collapsed ? "rail-collapsed" : ""} ${drawer ? "drawer-open" : ""}`}
    >
      <a
        className="skip-link"
        inert={mobileNavigation && drawer}
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.querySelector<HTMLElement>("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <button
        className="drawer-scrim"
        aria-label="Close navigation"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => {
          setDrawer(false);
          setMenu("");
        }}
      />
      <aside
        ref={navigationRef}
        id="workspace-navigation"
        className="rail"
        aria-label="Workspace navigation"
        role={mobileNavigation && drawer ? "dialog" : undefined}
        aria-modal={mobileNavigation && drawer ? true : undefined}
        aria-hidden={mobileNavigation && !drawer ? true : undefined}
        inert={mobileNavigation && !drawer}
        tabIndex={-1}
      >
        <div className="rail-header">
          <a
            className="brand"
            href={`#${mode === "demo" ? "demo/" : ""}projects`}
            aria-label="Vistralo projects"
          >
            <img
              src={
                theme === "dark"
                  ? "/assets/brand/emblem-light.svg"
                  : "/assets/brand/emblem-dark.svg"
              }
              alt=""
              width="24"
              height="24"
            />
            <span>vistralo</span>
          </a>
          <ToolButton
            icon={mobileNavigation ? "close" : "sidebar"}
            label={
              mobileNavigation
                ? "Close navigation"
                : `${collapsed ? "Expand" : "Collapse"} sidebar  Ctrl+B`
            }
            aria-expanded={mobileNavigation ? undefined : !collapsed}
            onClick={() => {
              if (mobileNavigation) {
                setDrawer(false);
                setMenu("");
              } else setCollapsed(!collapsed);
            }}
          />
        </div>
        <div className="workspace-switcher menu-anchor">
          <button
            className="workspace-button tooltip-host"
            aria-haspopup="menu"
            aria-expanded={menu === "workspace"}
            onClick={() => setMenu(menu === "workspace" ? "" : "workspace")}
          >
            <span className="workspace-avatar">
              {profile.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span className="workspace-copy">
              <strong>{profile.workspace}</strong>
              <small>Free plan</small>
            </span>
            <Icon name="chevronDown" size={16} />
            <span className="tooltip" role="tooltip">
              {profile.workspace}
            </span>
          </button>
          {menu === "workspace" && (
            <Menu
              align="start"
              onClose={() => setMenu("")}
              items={[
                {
                  label: profile.workspace,
                  icon: "check",
                  onClick: () => go("projects"),
                },
                {
                  label: "Workspace settings",
                  icon: "settings",
                  onClick: () => setModal("settings"),
                },
                ...(mode === "demo"
                  ? [
                      {
                        label: "Reset demo workspace",
                        icon: "restore",
                        onClick: () => setModal("reset"),
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </div>
        <nav className="primary-nav" aria-label="Main navigation">
          {["projects", "shared", "trash"].map((v, i) => (
            <RailRow
              key={v}
              icon={["projects", "people", "trash"][i]}
              label={navLabels[i]}
              active={view === v}
              onClick={() => go(v)}
            />
          ))}
        </nav>
        <div className="rail-projects">
          <section>
            <h2>Pinned</h2>
            {pinned.map((p) => (
              <RailRow
                key={p.id}
                icon="pin"
                label={p.name}
                onClick={() => open(p)}
              />
            ))}
            {!pinned.length && (
              <p className="rail-empty">Pin projects for quick access</p>
            )}
          </section>
          <section>
            <h2>Recent</h2>
            {recent.map((p) => (
              <RailRow
                key={p.id}
                icon={p.type === "brief" ? "document" : "video"}
                label={p.name}
                onClick={() => open(p)}
              />
            ))}
            {!recent.length && (
              <p className="rail-empty">Projects you open appear here</p>
            )}
          </section>
        </div>
        <div className="rail-footer">
          <div className="menu-anchor">
            <RailRow
              icon="help"
              label="Help"
              onClick={() => setMenu(menu === "help" ? "" : "help")}
            />
            {menu === "help" && (
              <Menu
                align="start"
                onClose={() => setMenu("")}
                items={[
                  {
                    label: "Documentation",
                    icon: "external",
                    onClick: () =>
                      window.open(docsUrl, "_blank", "noopener,noreferrer"),
                  },
                  {
                    label: "Keyboard shortcuts",
                    icon: "keyboard",
                    key: "?",
                    onClick: () => setModal("shortcuts"),
                  },
                  {
                    label: "What's new",
                    icon: "document",
                    onClick: () => setModal("whatsnew"),
                  },
                  {
                    label: "Contact support",
                    icon: "mail",
                    onClick: () => setModal("support"),
                  },
                ]}
              />
            )}
          </div>
          <RailRow
            icon="settings"
            label="Settings"
            onClick={() => setModal("settings")}
          />
          <div className="account-divider" />
          <div className="menu-anchor">
            <button
              className="account-row tooltip-host"
              aria-haspopup="menu"
              aria-expanded={menu === "account"}
              onClick={() => setMenu(menu === "account" ? "" : "account")}
            >
              <span className="account-avatar">
                {profile.name
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span>
                <strong>{profile.name}</strong>
                <small>
                  {profile.email ||
                    (mode === "demo"
                      ? "Demo · This browser"
                      : "Private studio")}
                </small>
              </span>
              <Icon name="chevronDown" size={16} />
              <span className="tooltip" role="tooltip">
                {profile.name} · {profile.email || "Private studio"}
              </span>
            </button>
            {menu === "account" && (
              <Menu
                align="start"
                onClose={() => setMenu("")}
                items={[
                  {
                    label: "Profile",
                    icon: "people",
                    onClick: () => setModal("profile"),
                  },
                  {
                    label: "Preferences",
                    icon: "settings",
                    onClick: () => setModal("settings"),
                  },
                  {
                    label: "Sign out",
                    icon: "logout",
                    separator: true,
                    onClick: () =>
                      run(async () => {
                        await adapter.logout();
                        if (mode === "demo") {
                          location.hash = "projects";
                          location.reload();
                        } else {
                          setAuthenticated(false);
                          setProjects([]);
                        }
                      }),
                  },
                ]}
              />
            )}
          </div>
        </div>
      </aside>
      <div className="content-shell" inert={mobileNavigation && drawer}>
        <div className="mobile-navigation">
          <ToolButton
            id="navigation-trigger"
            icon="sidebar"
            label="Open navigation"
            aria-expanded={drawer}
            aria-controls="workspace-navigation"
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
              drawerReturnFocus.current = event.currentTarget;
              setDrawer(true);
            }}
          />
          <span>Vistralo</span>
          {mode === "demo" && <small>Demo</small>}
        </div>
        <main id="main-content" tabIndex={-1}>
          <NavigationProgress pending={loading} />
          {error && authenticated && (
            <div className="notice error-message">
              <span>{error}</span>
              <button className="button" onClick={refresh}>
                Retry connection
              </button>
            </div>
          )}
          {view === "states" && mode === "demo" ? (
            <States adapter={adapter} projects={projects} notify={notify} />
          ) : view === "project" ? (
            current ? (
              <ProjectDetail
                key={current.id}
                project={current}
                adapter={adapter}
                onBack={() => go("projects")}
                onChanged={() => refresh()}
                notify={notify}
              />
            ) : loading ? (
              <p>Opening project…</p>
            ) : (
              <section className="empty-state">
                <h1>Project unavailable</h1>
                <p>
                  It may have been deleted or this link belongs to another
                  studio.
                </p>
                <button className="button" onClick={() => go("projects")}>
                  Back to projects
                </button>
              </section>
            )
          ) : (
            <Projects
              projects={projects}
              view={view === "states" ? "projects" : view}
              adapter={adapter}
              locale={locale}
              create={setSource}
              onOpen={open}
              actions={actions}
              onShare={(p) => setShare([p])}
              bulk={bulk}
              loading={loading}
              onShortcuts={() => setModal("shortcuts")}
            />
          )}
        </main>
      </div>
      <div
        className="live-status sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {message}
      </div>
      {message && (
        <div className="toast" inert={mobileNavigation && drawer}>
          <span>{message}</span>
          {undo && (
            <button
              className="button button-ghost"
              onClick={() =>
                run(async () => {
                  await adapter.restore(undo);
                  setUndo(null);
                }, "Projects restored")
              }
            >
              Undo
            </button>
          )}
          <ToolButton
            icon="close"
            label="Dismiss notification"
            onClick={() => setMessage("")}
          />
        </div>
      )}
      {source && (
        <CreateProject
          source={source}
          adapter={adapter}
          onClose={() => setSource(null)}
          notify={notify}
          onCreated={(p) => {
            setSource(null);
            refresh();
            open(p);
          }}
        />
      )}
      {share && (
        <ShareDialog
          projects={share}
          adapter={adapter}
          onClose={() => {
            setShare(null);
            refresh();
          }}
          notify={notify}
        />
      )}{" "}
      {edit && (
        <TextDialog
          title={edit.kind === "rename" ? "Rename project" : "Move projects"}
          label={edit.kind === "rename" ? "Project name" : "Folder name"}
          initial={
            edit.kind === "rename"
              ? edit.projects[0].name
              : edit.projects[0].folder || ""
          }
          description={
            edit.kind === "move"
              ? "Organize projects with a folder name. Search includes folder names."
              : undefined
          }
          onClose={() => setEdit(null)}
          onSubmit={async (value) => {
            for (const p of edit.projects)
              await adapter.update(
                p.id,
                edit.kind === "rename" ? { name: value } : { folder: value },
              );
            notify(
              edit.kind === "rename" ? "Project renamed" : "Projects moved",
            );
            await refresh();
          }}
        />
      )}
      {deleting && (
        <Dialog
          title="Permanently delete projects?"
          onClose={() => setDeleting(null)}
        >
          <p>
            This permanently deletes {deleting.length} trashed{" "}
            {deleting.length === 1 ? "project" : "projects"} and their files.
            This cannot be undone.
          </p>
          <div className="dialog-actions">
            <button className="button" onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button
              className="button button-danger"
              onClick={() =>
                run(async () => {
                  await adapter.remove(deleting);
                  setDeleting(null);
                }, "Projects permanently deleted")
              }
            >
              Delete permanently
            </button>
          </div>
        </Dialog>
      )}
      {modal && (
        <Dialog
          title={
            modal === "settings"
              ? "Preferences"
              : modal === "profile"
                ? "Profile"
                : modal === "shortcuts"
                  ? "Keyboard shortcuts"
                  : modal === "support"
                    ? "Contact support"
                    : modal === "reset"
                      ? "Reset demo workspace?"
                      : "What’s new"
          }
          onClose={() => setModal("")}
        >
          {modal === "shortcuts" ? (
            <dl className="shortcut-list">
              {[
                ["Ctrl / ⌘ K or /", "Search projects"],
                ["N", "New project"],
                ["Ctrl / ⌘ B", "Collapse sidebar"],
                ["Ctrl / ⌘ A", "Select visible projects"],
                ["Esc", "Clear selection / close menu"],
                ["Arrow keys", "Move between projects"],
                ["Enter", "Open focused project"],
                ["Space", "Select focused project"],
                ["?", "Keyboard shortcuts"],
              ].map(([key, label]) => (
                <React.Fragment key={key}>
                  <dt>
                    <kbd>{key}</kbd>
                  </dt>
                  <dd>{label}</dd>
                </React.Fragment>
              ))}
            </dl>
          ) : modal === "settings" ? (
            <>
              <label className="field">
                Appearance
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>
              <label className="field">
                Language preview
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="de">Deutsch — navigation preview</option>
                </select>
              </label>
              <label className="field">
                Text direction
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                >
                  <option value="ltr">Left to right</option>
                  <option value="rtl">Right to left</option>
                </select>
              </label>
              <p className="caption">
                Dates use your device’s time zone. Reduced motion and high
                contrast follow your system preferences.
              </p>
              <button
                className="button"
                onClick={() =>
                  run(async () => {
                    const value = await adapter.rpc("check");
                    setHealth(JSON.stringify(value, null, 2));
                  })
                }
              >
                Check studio connection
              </button>
              {health && <pre>{health}</pre>}
              <p className="caption">
                {mode === "demo"
                  ? "Demo mode. Changes stay in this browser."
                  : mode === "desktop"
                    ? "Connected to the Vistralo desktop bridge."
                    : mode === "cloud" ? "Connected to your Vistralo cloud workspace. Access is managed by your administrator." : "Connected to your private studio. Public accounts and team invitations are not configured."}
              </p>
            </>
          ) : modal === "profile" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await adapter.settings({
                    name: profile.workspace,
                    displayName: profile.name,
                    email: profile.email,
                  });
                  setModal("");
                }, "Profile saved");
              }}
            >
              <label className="field">
                Name
                <input
                  required
                  value={profile.name}
                  onChange={(e) =>
                    setProfile({ ...profile, name: e.target.value })
                  }
                />
              </label>
              <label className="field">
                Email
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) =>
                    setProfile({ ...profile, email: e.target.value })
                  }
                />
              </label>
              <label className="field">
                Workspace name
                <input
                  required
                  value={profile.workspace}
                  onChange={(e) =>
                    setProfile({ ...profile, workspace: e.target.value })
                  }
                />
              </label>
              <p className="caption">
                These are workspace display details. They do not create a
                customer account or change studio access.
              </p>
              <button className="button button-primary">Save profile</button>
            </form>
          ) : modal === "support" ? (
            <>
              <p>Contact Dynamix LTD for Vistralo support.</p>
              <a href="mailto:contact@vistralo.com" className="button">
                contact@vistralo.com
              </a>
              <p className="caption">
                Include the action that failed and the error message. Keep
                access tokens and private recordings out of your message.
              </p>
            </>
          ) : modal === "reset" ? (
            <>
              <p>
                This removes this browser’s demo changes and restores the eight
                fictional projects.
              </p>
              <button
                className="button button-danger"
                onClick={() =>
                  run(async () => {
                    await adapter.rpc("resetDemo");
                    setModal("");
                  }, "Demo reset")
                }
              >
                Reset demo
              </button>
            </>
          ) : (
            <>
              <p>
                A redesigned Projects workspace with search, filters, selection,
                Trash, persistent project management, resumable uploads, visual
                briefs, editing and read-only share links.
              </p>
              <a
                className="button"
                href={docsUrl}
                target="_blank"
                rel="noreferrer"
              >
                Read documentation <Icon name="external" />
              </a>
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}
