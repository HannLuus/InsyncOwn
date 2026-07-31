/* global insyncown */

const $ = (id) => document.getElementById(id);

function statusClass(status) {
  return `status-${status}`;
}

function formatPair(pair) {
  const el = document.createElement("div");
  el.className = "pair";
  el.innerHTML = `
    <div>
      <h3>${escapeHtml(pair.name)}
        <span class="${statusClass(pair.status)}">· ${escapeHtml(pair.status)}</span>
      </h3>
      <div class="meta">Local: ${escapeHtml(pair.localPath)}</div>
      <div class="meta">Remote: ${escapeHtml(pair.remotePath)}</div>
      <div class="meta">Last sync: ${escapeHtml(pair.lastSyncAt ?? "never")}
        ${pair.resynced ? "" : " · needs first resync"}</div>
      ${
        pair.lastError
          ? `<div class="meta error">${escapeHtml(pair.lastError).slice(0, 280)}</div>`
          : ""
      }
    </div>
    <div class="actions">
      <button type="button" data-act="open">Open</button>
      <button type="button" class="secondary" data-act="sync">Sync</button>
      <button type="button" class="secondary" data-act="resync">Resync</button>
      <button type="button" class="secondary" data-act="toggle">
        ${pair.enabled ? "Disable" : "Enable"}
      </button>
      <button type="button" class="danger" data-act="remove">Remove</button>
    </div>
  `;
  el.querySelector('[data-act="open"]').onclick = () =>
    withBusy(el.querySelector('[data-act="open"]'), async () => {
      await insyncown.openPath(pair.localPath);
    });
  el.querySelector('[data-act="sync"]').onclick = () =>
    withBusy(el.querySelector('[data-act="sync"]'), async () => {
      await insyncown.syncNow(pair.id);
      await refresh();
    });
  el.querySelector('[data-act="resync"]').onclick = () =>
    withBusy(el.querySelector('[data-act="resync"]'), async () => {
      const ok = confirm(
        "Resync rebuilds the bisync baseline. Continue only if you understand both sides may be reconciled.",
      );
      if (!ok) return;
      await insyncown.resyncPair(pair.id);
      await refresh();
    });
  el.querySelector('[data-act="toggle"]').onclick = () =>
    withBusy(el.querySelector('[data-act="toggle"]'), async () => {
      await insyncown.setPairEnabled(pair.id, !pair.enabled);
      await refresh();
    });
  el.querySelector('[data-act="remove"]').onclick = () =>
    withBusy(el.querySelector('[data-act="remove"]'), async () => {
      if (!confirm(`Remove sync pair “${pair.name}”? Local files are kept.`)) return;
      await insyncown.removePair(pair.id);
      await refresh();
    });
  return el;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setActionFeedback(msg) {
  $("globalError").textContent = msg;
}

async function withBusy(btn, fn) {
  if (!window.insyncown) {
    setActionFeedback("UI bridge missing (preload failed). Restart InsyncOwn.");
    return;
  }
  const el = typeof btn === "string" ? $(btn) : btn;
  const prev = el ? el.textContent : "";
  if (el) {
    el.disabled = true;
    el.textContent = "Working…";
  }
  try {
    await fn();
    setActionFeedback("");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setActionFeedback(msg);
    console.error(msg);
  } finally {
    if (el) {
      el.disabled = false;
      el.textContent = prev;
    }
  }
}

async function refresh() {
  if (!window.insyncown) {
    $("runState").textContent = "broken";
    $("runState").className = "pill error";
    $("authMessage").textContent =
      "Preload bridge missing — restart the app from the project (npm run start:desktop).";
    $("authMessage").className = "error";
    return;
  }
  try {
    const status = await insyncown.getStatus();
    const run = $("runState");
    run.textContent = status.runState;
    run.className = `pill ${status.runState === "running" ? "ok" : status.runState}`;
    // Always clear prior UI/transport errors on a successful refresh
    $("globalError").textContent = status.lastGlobalError ?? "";
    const about = status.account.about;
    $("quotaLine").textContent = about
      ? `Quota — used ${about.used ?? "?"} / total ${about.total ?? "?"} (free ${about.free ?? "?"})`
      : status.account.configured
        ? "Connected (quota unavailable)"
        : "";
    const auth = await insyncown.authStatus();
    $("authMessage").textContent = auth.message;
    $("authMessage").className = auth.configured ? "status-ok" : "error";

    if (status.network) {
      $("proxyUrl").value = status.network.proxyUrl ?? "";
      $("noProxy").value = status.network.noProxy ?? "127.0.0.1,localhost";
      $("networkStatus").textContent = status.network.proxyUrl
        ? `Active: ${status.network.proxyUrl}`
        : "No proxy — sync uses your normal network route.";
    }

    const pairs = $("pairs");
    pairs.innerHTML = "";
    if (!status.pairs.length) {
      pairs.innerHTML = `<p class="muted">No sync pairs yet. Add a Drive folder to sync locally.</p>`;
    } else {
      for (const pair of status.pairs) pairs.appendChild(formatPair(pair));
    }
  } catch (err) {
    $("runState").textContent = "offline";
    $("runState").className = "pill error";
    $("globalError").textContent =
      err instanceof Error ? err.message : String(err);
    $("authMessage").textContent =
      "Daemon not reachable. Start it with: systemctl --user start insyncown-daemon";
  }
}

async function loadRemoteRoot() {
  const list = $("remoteList");
  list.innerHTML = `<span class="muted">Loading…</span>`;
  try {
    const folders = await insyncown.listRemoteFolders("");
    list.innerHTML = "";
    if (!folders.length) {
      list.innerHTML = `<span class="muted">No folders found at Drive root.</span>`;
      return;
    }
    for (const f of folders) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = f.name;
      b.onclick = () => {
        $("remotePath").value = f.path;
        if (!$("pairName").value) $("pairName").value = f.name;
      };
      list.appendChild(b);
    }
  } catch (err) {
    list.innerHTML = `<span class="error">${escapeHtml(
      err instanceof Error ? err.message : String(err),
    )}</span>`;
  }
}

function wire() {
  $("btnPause").onclick = () =>
    withBusy("btnPause", async () => {
      await insyncown.pause();
      await refresh();
    });
  $("btnResume").onclick = () =>
    withBusy("btnResume", async () => {
      await insyncown.resume();
      await refresh();
    });
  $("btnSyncAll").onclick = () =>
    withBusy("btnSyncAll", async () => {
      await insyncown.syncNow();
      await refresh();
    });
  $("btnConnect").onclick = () =>
    withBusy("btnConnect", async () => {
      const r = await insyncown.startAuth();
      setActionFeedback(
        r.authUrl
          ? `${r.message} URL: ${r.authUrl}`
          : r.message,
      );
      await refresh();
    });
  $("btnImportRclone").onclick = () =>
    withBusy("btnImportRclone", async () => {
      const r = await insyncown.importExistingRcloneAuth();
      setActionFeedback(r.message);
      await refresh();
    });
  $("btnRefreshAuth").onclick = () =>
    withBusy("btnRefreshAuth", async () => {
      await refresh();
    });
  $("btnSaveOauth").onclick = () =>
    withBusy("btnSaveOauth", async () => {
      await insyncown.configureAuth(
        $("clientId").value.trim(),
        $("clientSecret").value.trim(),
      );
      setActionFeedback("OAuth client saved. Click Connect Google Drive next.");
    });
  $("btnSaveProxy").onclick = () =>
    withBusy("btnSaveProxy", async () => {
      const r = await insyncown.setNetworkSettings({
        proxyUrl: $("proxyUrl").value.trim() || null,
        noProxy: $("noProxy").value.trim() || "127.0.0.1,localhost",
      });
      $("networkStatus").textContent = r.message ?? "Proxy saved.";
      setActionFeedback(r.message ?? "Proxy saved.");
      await refresh();
    });
  $("btnClearProxy").onclick = () =>
    withBusy("btnClearProxy", async () => {
      $("proxyUrl").value = "";
      const r = await insyncown.setNetworkSettings({
        proxyUrl: null,
        noProxy: $("noProxy").value.trim() || "127.0.0.1,localhost",
      });
      $("networkStatus").textContent = r.message ?? "Proxy cleared.";
      await refresh();
    });
  $("btnTestNetwork").onclick = () =>
    withBusy("btnTestNetwork", async () => {
      const r = await insyncown.testNetwork();
      $("networkStatus").textContent = r.message;
      $("networkStatus").className = r.ok ? "status-ok" : "error";
    });
  $("btnAddPair").onclick = () => $("addPairCard").classList.remove("hidden");
  $("btnCancelPair").onclick = () => $("addPairCard").classList.add("hidden");
  $("btnBrowseLocal").onclick = () =>
    withBusy("btnBrowseLocal", async () => {
      const path = await insyncown.pickLocalFolder();
      if (path) $("localPath").value = path;
    });
  $("btnBrowseRemote").onclick = () =>
    withBusy("btnBrowseRemote", async () => {
      await loadRemoteRoot();
    });
  $("btnCreatePair").onclick = () =>
    withBusy("btnCreatePair", async () => {
      const name = $("pairName").value.trim();
      const localPath = $("localPath").value.trim();
      const remotePath = $("remotePath").value.trim();
      if (!name || !localPath || !remotePath) {
        throw new Error("Name, local path, and remote path are required.");
      }
      await insyncown.addPair({
        name,
        localPath,
        remotePath,
        runResync: $("runResync").checked,
      });
      $("addPairCard").classList.add("hidden");
      $("pairName").value = "";
      $("localPath").value = "";
      $("remotePath").value = "";
      await refresh();
    });

  if (window.insyncown) {
    void insyncown.getAppInfo().then((info) => {
      $("appInfo").textContent = `${info.name} ${info.version} · daemon ${info.daemonUrl}`;
    });
  } else {
    $("appInfo").textContent = "Preload bridge missing";
  }
}

wire();
void refresh();
setInterval(() => void refresh(), 10_000);
