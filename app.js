
(() => {
  const cfg = window.AG_MAP_CONFIG;
  const mapImage = document.getElementById("mapImage");
  const markers = document.getElementById("markers");
  const statusFilter = document.getElementById("statusFilter");
  const spaceSearch = document.getElementById("spaceSearch");
  const dialog = document.getElementById("spaceDialog");
  const dialogContent = document.getElementById("dialogContent");
  const lastUpdated = document.getElementById("lastUpdated");

  mapImage.src = cfg.mapImage;
  let spaceData = [];

  const demoData = Object.keys(cfg.spaces).map(n => ({
    space: Number(n),
    status: Number(n) % 7 === 0 ? "Occupied" : Number(n) % 11 === 0 ? "Reserved" : "Available",
    size: Number(n) >= 86 && Number(n) <= 93 ? "Pull-through" : "Standard",
    price: Number(n) >= 86 && Number(n) <= 93 ? 150 : 100,
    type: Number(n) >= 86 && Number(n) <= 93 ? "Premium / pull-through" : "RV, trailer, or vehicle",
    publicNotes: "",
    inquiryUrl: ""
  }));

  function normalize(row) {
    return {
      space: Number(row.space ?? row.Space ?? row["Space Number"]),
      status: String(row.status ?? row.Status ?? "Unavailable").trim(),
      size: row.size ?? row.Size ?? "",
      price: row.price ?? row.Price ?? "",
      type: row.type ?? row.Type ?? "",
      publicNotes: row.publicNotes ?? row["Public Notes"] ?? "",
      inquiryUrl: row.inquiryUrl ?? row["Inquiry URL"] ?? ""
    };
  }

  async function loadData() {
    try {
      if (!cfg.sheetApiUrl) {
        spaceData = demoData;
        lastUpdated.textContent = "Preview mode - add your Apps Script URL in map-config.js";
      } else {
        const res = await fetch(cfg.sheetApiUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`Sheet API returned ${res.status}`);
        const payload = await res.json();
        const rows = Array.isArray(payload) ? payload : payload.spaces;
        spaceData = rows.map(normalize);
        lastUpdated.textContent = `Availability updated ${new Date(payload.updated || Date.now()).toLocaleString()}`;
      }
      render();
    } catch (err) {
      console.error(err);
      spaceData = demoData;
      lastUpdated.textContent = "Could not reach Google Sheet - showing preview data";
      render();
    }
  }

  function render() {
    markers.innerHTML = "";
    const bySpace = new Map(spaceData.map(row => [row.space, row]));
    Object.entries(cfg.spaces).forEach(([number, pos]) => {
      const n = Number(number);
      const row = bySpace.get(n) || { space: n, status: "Unavailable" };
      const statusCfg = cfg.statuses[row.status] || cfg.statuses.Unavailable;
      const btn = document.createElement("button");
      btn.className = `space-marker ${statusCfg.className}`;
      btn.style.left = `${pos.x}%`;
      btn.style.top = `${pos.y}%`;
      btn.title = `Space ${n}: ${row.status}`;
      btn.setAttribute("aria-label", `Space ${n}, ${row.status}`);
      btn.dataset.space = String(n);
      btn.dataset.status = row.status;
      btn.addEventListener("click", () => showSpace(row));
      markers.appendChild(btn);
    });
    applyFilters();
  }

  function applyFilters() {
    const selected = statusFilter.value;
    const search = Number(spaceSearch.value);
    document.querySelectorAll(".space-marker").forEach(el => {
      const statusMismatch = selected !== "All" && el.dataset.status !== selected;
      el.classList.toggle("is-hidden", statusMismatch);
      el.classList.toggle("is-match", Boolean(search) && Number(el.dataset.space) === search);
    });
  }

  function money(value) {
    if (value === "" || value == null) return "Contact us";
    const n = Number(String(value).replace(/[$,]/g, ""));
    return Number.isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD" }) + "/month" : value;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[ch]));
  }

  function showSpace(row) {
    const statusCfg = cfg.statuses[row.status] || cfg.statuses.Unavailable;
    const canReserve = row.status === "Available";
    dialogContent.innerHTML = `
      <span class="status-pill ${statusCfg.className}">${esc(row.status)}</span>
      <h2>Space ${esc(row.space)}</h2>
      <dl class="detail-grid">
        <dt>Size</dt><dd>${esc(row.size || "Contact us")}</dd>
        <dt>Type</dt><dd>${esc(row.type || "Vehicle storage")}</dd>
        <dt>Rate</dt><dd>${esc(money(row.price))}</dd>
        ${row.publicNotes ? `<dt>Notes</dt><dd>${esc(row.publicNotes)}</dd>` : ""}
      </dl>
      ${canReserve
        ? `<a class="reserve-link" href="${esc(row.inquiryUrl || "#contact")}">Ask about Space ${esc(row.space)}</a>`
        : `<p class="notice">This space is currently ${esc(row.status.toLowerCase())}. Please choose an available space or contact AG Properties.</p>`}
    `;
    dialog.showModal();
  }

  document.getElementById("dialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
  statusFilter.addEventListener("change", applyFilters);
  spaceSearch.addEventListener("input", applyFilters);

  loadData();
  setInterval(loadData, Math.max(1, cfg.refreshMinutes) * 60 * 1000);
})();
