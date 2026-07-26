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
  el.querySelector('[data-act="open"]').onclick = () => insyncown.openPath(pair.localPath);
  el.querySelector('[data-act="sync"]').onclick = async () => {
    await insyncown.syncNow(pair.id);
    await refresh();
  };
  el.querySelector('[data-act="resync"]').onclick = async () => {
    const ok = confirm(
      "Resync rebuilds the bisync baseline. Continue only if you understand both sides may be reconciled.",
    );
    if (!ok) return;
    await insyncown.resyncPair(pair.id);
    await refresh();
  };
  el.querySelector('[data-act="toggle"]').onclick = async () => {
    await insyncown.setPairEnabled(pair.id, !pair.enabled);
    await refresh();
  };
  el.querySelector('[data-act="remove"]').onclick = async () => {
    if (!confirm(`Remove sync pair “${pair.name}”? Local files are kept.`)) return;
    await insyncown.removePair(pair.id);
    await refresh();
  };
  return el;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function refresh() {
  try {
    const status = await insyncown.getStatus();
    const run = $("runState");
    run.textContent = status.runState;
    run.className = `pill ${status.runState === "running" ? "ok" : status.runState}`;
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
      "Daemon not reachable. Start it with: npm run start:daemon";
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
  $("btnPause").onclick = async () => {
    await insyncown.pause();
    await refresh();
  };
  $("btnResume").onclick = async () => {
    await insyncown.resume();
    await refresh();
  };
  $("btnSyncAll").onclick = async () => {
    await insyncown.syncNow();
    await refresh();
  };
  $("btnConnect").onclick = async () => {
    const r = await insyncown.startAuth();
    alert(r.message);
    await refresh();
  };
  $("btnRefreshAuth").onclick = () => refresh();
  $("btnSaveOauth").onclick = async () => {
    await insyncown.configureAuth($("clientId").value.trim(), $("clientSecret").value.trim());
    alert("OAuth client saved. Click Connect Google Drive next.");
  };
  $("btnAddPair").onclick = () => $("addPairCard").classList.remove("hidden");
  $("btnCancelPair").onclick = () => $("addPairCard").classList.add("hidden");
  $("btnBrowseLocal").onclick = async () => {
    const path = await insyncown.pickLocalFolder();
    if (path) $("localPath").value = path;
  };
  $("btnBrowseRemote").onclick = () => loadRemoteRoot();
  $("btnCreatePair").onclick = async () => {
    const name = $("pairName").value.trim();
    const localPath = $("localPath").value.trim();
    const remotePath = $("remotePath").value.trim();
    if (!name || !localPath || !remotePath) {
      alert("Name, local path, and remote path are required.");
      return;
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
  };

  void insyncown.getAppInfo().then((info) => {
    $("appInfo").textContent = `${info.name} ${info.version} · daemon ${info.daemonUrl}`;
  });
}

wire();
void refresh();
setInterval(() => void refresh(), 10_000);
