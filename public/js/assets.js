// Засоби: усі засоби обліку в одній таблиці з вкладками типів і фільтрами,
// картка засобу з історією подій, форма додавання й редагування.
import {
  db, state, $, can, initPage, load, applyPermissions, escapeHtml, formatDate, plural, icon,
  setMessage, VARIANTS, CATEGORIES, RANGES, MODES, CURTAIN_LOCK, STATUSES, STATUS_LABELS, OWNERSHIP,
  hasCategories, subtypeLabel, deviceRecords, actionPill, statusPill, openLayerEl, closeLayer,
  duplicateDevice, isUniqueViolation
} from "./core.js";
import { openEventForm } from "./event-form.js";

const params = new URLSearchParams(window.location.search);
const view = {
  type: VARIANTS.includes(params.get("type")) ? params.get("type") : "",
  deviceId: null
};

const filters = {
  search: $("assetSearch"),
  mode: $("modeFilter"),
  category: $("categoryFilter"),
  range: $("rangeFilter"),
  status: $("statusFilter"),
  ownership: $("ownershipFilter")
};

const options = (entries, first) =>
  `<option value="">${first}</option>` +
  entries.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");

filters.mode.innerHTML = options(Object.entries(MODES), "Усі режими");
filters.range.innerHTML = options(Object.entries(RANGES), "Будь-яка дальність");
filters.status.innerHTML = options(STATUSES, "Усі стани");
filters.ownership.innerHTML = options(Object.entries(OWNERSHIP), "Будь-яка належність");
if (STATUS_LABELS[params.get("status")]) filters.status.value = params.get("status");

/* ---------- Таблиця ---------- */

function renderTabs() {
  const tabs = [["", "Усі", state.equipment.length]].concat(
    VARIANTS.map((variant) => [variant, variant, state.equipment.filter((item) => item.variant === variant).length])
  );
  $("typeTabs").innerHTML = tabs
    .map(
      ([value, label, count]) => `
      <button class="type-tab${view.type === value ? " is-current" : ""}" type="button" data-type="${escapeHtml(value)}"
        aria-pressed="${view.type === value}">${escapeHtml(label)}<span class="type-tab-count">${count}</span></button>`
    )
    .join("");
}

// Режим, категорія й дальність мають сенс лише для РЕБ і РЕР
function renderSubtypeFilters() {
  const withCategories = hasCategories(view.type);
  filters.mode.hidden = view.type !== "РЕБ";
  filters.category.hidden = !withCategories;
  filters.range.hidden = !withCategories;
  if (withCategories) {
    const current = filters.category.value;
    filters.category.innerHTML = options(Object.entries(CATEGORIES[view.type]), "Усі категорії");
    if (CATEGORIES[view.type][current]) filters.category.value = current;
  }
  if (!withCategories) filters.category.value = filters.range.value = "";
  if (view.type !== "РЕБ") filters.mode.value = "";
}

function filteredDevices() {
  const query = filters.search.value.trim().toLowerCase();
  return state.equipment.filter((item) => {
    const text = [item.name, item.serial_number, item.note].join(" ").toLowerCase();
    return (
      (!view.type || item.variant === view.type) &&
      (!query || text.includes(query)) &&
      (!filters.mode.value || (item.jam_mode || "noise") === filters.mode.value) &&
      (!filters.category.value || item.category === filters.category.value) &&
      (!filters.range.value || item.type === filters.range.value) &&
      (!filters.status.value || item.status === filters.status.value) &&
      (!filters.ownership.value || item.ownership === filters.ownership.value)
    );
  });
}

function lastEventCell(device) {
  const last = deviceRecords(device)[0];
  if (!last) return '<span class="cell-muted">—</span>';
  return `<span class="last-event">${actionPill(last.action_type)}<span>${formatDate(last.date)} · ${escapeHtml(last.area)}</span></span>`;
}

function renderTable() {
  const rows = filteredDevices();
  const scope = state.equipment.filter((item) => !view.type || item.variant === view.type).length;
  $("assetsCount").textContent = rows.length === scope ? `${scope}` : `${rows.length} з ${scope}`;
  $("assetsTitle").textContent = view.type || "Усі засоби";

  if (!rows.length) {
    $("assetsBody").innerHTML = `<tr><td colspan="7" class="empty-state">${scope ? "Нічого не знайдено за цими фільтрами" : "Засобів цього типу ще немає"}</td></tr>`;
    return;
  }

  $("assetsBody").innerHTML = rows
    .map((item) => {
      const subtype = subtypeLabel(item);
      return `<tr class="row-link" data-id="${item.id}" tabindex="0">
        <td class="cell-strong">${escapeHtml(item.name)}</td>
        <td class="cell-id">${escapeHtml(item.serial_number)}</td>
        <td><span class="cell-type">${escapeHtml(item.variant)}</span>${subtype ? `<span class="cell-sub">${escapeHtml(subtype)}</span>` : ""}</td>
        <td>${statusPill(item.status)}</td>
        <td>${escapeHtml(OWNERSHIP[item.ownership] || item.ownership)}</td>
        <td>${lastEventCell(item)}</td>
        <td class="note-cell" title="${escapeHtml(item.note || "")}">${escapeHtml(item.note || "")}</td>
      </tr>`;
    })
    .join("");
}

function renderSummary() {
  const total = state.equipment.length;
  const inService = state.equipment.filter((item) => item.status === "in_formation").length;
  const inRepair = state.equipment.filter((item) => item.status === "repair").length;
  $("assetsSummary").textContent = `${total} на обліку · ${inService} в строю · ${inRepair} у ремонті`;
}

function render() {
  renderSummary();
  renderTabs();
  renderSubtypeFilters();
  renderTable();
}

/* ---------- Картка засобу ---------- */

function showPane(name) {
  $("deviceCard").hidden = name !== "card";
  $("deviceForm").hidden = name !== "form";
  $("deviceFormFoot").hidden = name !== "form";
}

function openCard(id) {
  const device = state.equipment.find((item) => item.id === id);
  if (!device) return;
  view.deviceId = id;
  const events = deviceRecords(device);
  const subtype = subtypeLabel(device);

  $("deviceTitle").textContent = device.name;
  $("deviceCard").innerHTML = `
    <dl class="facts">
      <div><dt>Серійний №</dt><dd class="cell-id">${escapeHtml(device.serial_number)}</dd></div>
      <div><dt>Стан</dt><dd>${statusPill(device.status)}</dd></div>
      <div><dt>Тип</dt><dd>${escapeHtml(device.variant)}${subtype ? ` · ${escapeHtml(subtype)}` : ""}</dd></div>
      <div><dt>Належність</dt><dd>${escapeHtml(OWNERSHIP[device.ownership] || device.ownership)}</dd></div>
      ${device.note ? `<div class="facts-wide"><dt>Примітка</dt><dd>${escapeHtml(device.note)}</dd></div>` : ""}
    </dl>
    <div class="card-actions">
      <button class="primary-button" type="button" data-card="event" data-can="create">Нова подія</button>
      <button class="ghost-button" type="button" data-card="edit" data-can="edit">Редагувати</button>
      <button class="ghost-button danger-text" type="button" data-card="delete" data-can="delete">Видалити</button>
    </div>
    <section class="timeline-section" aria-labelledby="timelineTitle">
      <h3 id="timelineTitle">Історія <span class="panel-meta">${events.length} ${plural(events.length, "подія", "події", "подій")}</span></h3>
      ${events.length ? `<ol class="timeline">${events
        .map(
          (record) => `
          <li class="timeline-item">
            <div class="timeline-head">${actionPill(record.action_type)}<time>${formatDate(record.date)}</time></div>
            <div class="timeline-body">${escapeHtml(record.area)} · ${escapeHtml(record.name)}</div>
            ${record.note ? `<p class="timeline-note">${escapeHtml(record.note)}</p>` : ""}
          </li>`
        )
        .join("")}</ol>` : '<p class="stat-empty">Подій із цим засобом у журналі ще немає.</p>'}
    </section>`;
  applyPermissions($("deviceCard"));
  showPane("card");
  openLayerEl($("deviceLayer"));
  window.history.replaceState(null, "", `?device=${encodeURIComponent(id)}`);
}

$("deviceLayer").addEventListener("layer-close", () => {
  view.deviceId = null;
  window.history.replaceState(null, "", view.type ? `?type=${encodeURIComponent(view.type)}` : window.location.pathname);
});

$("deviceCard").addEventListener("click", async (event) => {
  const action = event.target.closest("[data-card]")?.dataset.card;
  const device = state.equipment.find((item) => item.id === view.deviceId);
  if (!action || !device) return;

  if (action === "event") {
    openEventForm({
      device,
      saved: (text) => {
        setMessage($("pageMessage"), text);
        render();
        openCard(device.id);
      }
    });
  }
  if (action === "edit") openForm(device);
  if (action === "delete") {
    if (!window.confirm(`Видалити засіб «${device.name}», № ${device.serial_number}? Записи в журналі лишаться.`)) return;
    const { error } = await db.from("workflow_reb_far").delete().eq("id", device.id);
    if (error) {
      setMessage($("pageMessage"), error.message, true);
      return;
    }
    await load("equipment");
    closeLayer();
    setMessage($("pageMessage"), "Засіб видалено.");
    render();
  }
});

/* ---------- Форма засобу ---------- */

const form = {
  id: $("deviceId"),
  variant: $("deviceVariant"),
  mode: $("deviceMode"),
  category: $("deviceCategory"),
  range: $("deviceRange"),
  name: $("deviceName"),
  serial: $("deviceSerial"),
  ownership: $("deviceOwnership"),
  status: $("deviceStatus"),
  note: $("deviceNote")
};

form.variant.innerHTML = VARIANTS.map((variant) => `<option value="${variant}">${variant}</option>`).join("");
form.mode.innerHTML = Object.entries(MODES).map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
form.range.innerHTML = Object.entries(RANGES).map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
form.ownership.innerHTML = Object.entries(OWNERSHIP).map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
form.status.innerHTML = STATUSES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");

// Поточний підтип із форми: для РЕБ/РЕР — режим, категорія, дальність; для решти — без них
function formSubtype() {
  const variant = form.variant.value;
  if (!hasCategories(variant)) return { variant, category: null, type: "long", jam_mode: "noise" };
  const curtain = variant === "РЕБ" && form.mode.value === "curtain";
  return {
    variant,
    category: curtain ? CURTAIN_LOCK.category : form.category.value,
    type: curtain ? CURTAIN_LOCK.type : form.range.value,
    jam_mode: variant === "РЕБ" ? form.mode.value : "noise"
  };
}

function renderFormSubtype() {
  const variant = form.variant.value;
  const withCategories = hasCategories(variant);
  $("deviceModeField").hidden = variant !== "РЕБ";
  $("deviceCategoryField").hidden = !withCategories;
  $("deviceRangeField").hidden = !withCategories;

  if (withCategories) {
    const current = form.category.value;
    form.category.innerHTML = Object.entries(CATEGORIES[variant])
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join("");
    if (CATEGORIES[variant][current]) form.category.value = current;
  }

  const curtain = variant === "РЕБ" && form.mode.value === "curtain";
  if (curtain) {
    form.category.value = CURTAIN_LOCK.category;
    form.range.value = CURTAIN_LOCK.type;
  }
  form.category.disabled = curtain;
  form.range.disabled = curtain;
}

// Назви з довідника, що підходять під обраний тип і підтип
function matchingAssetNames() {
  const subtype = formSubtype();
  return state.assets
    .filter((item) => {
      if (item.variant !== subtype.variant) return false;
      if (!hasCategories(subtype.variant)) return true;
      return (
        item.category === subtype.category &&
        item.type === subtype.type &&
        (subtype.variant !== "РЕБ" || (item.jam_mode || "noise") === subtype.jam_mode)
      );
    })
    .map((item) => item.name);
}

function renderNameOptions(selected = form.name.value) {
  const names = matchingAssetNames();
  if (selected && !names.includes(selected)) names.unshift(selected);
  form.name.innerHTML = `<option value="" disabled>${names.length ? "Оберіть назву" : "Немає назв — додайте"}</option>${names
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("")}`;
  form.name.value = names.includes(selected) ? selected : "";
}

function openForm(device = null) {
  setMessage($("deviceMessage"), "");
  $("deviceTitle").textContent = device ? "Редагування засобу" : "Новий засіб";
  $("deviceSave").textContent = device ? "Зберегти зміни" : "Додати засіб";
  form.id.value = device?.id || "";
  form.variant.value = device?.variant || view.type || "РЕБ";
  form.mode.value = device?.jam_mode || "noise";
  renderFormSubtype();
  if (device?.category) form.category.value = device.category;
  form.range.value = device?.type || "long";
  renderFormSubtype();
  renderNameOptions(device?.name || "");
  form.serial.value = device?.serial_number || "";
  form.ownership.value = device?.ownership || "company";
  form.status.value = device?.status || "in_formation";
  form.note.value = device?.note || "";
  showPane("form");
  openLayerEl($("deviceLayer"));
  (device ? form.serial : form.variant).focus();
}

[form.variant, form.mode, form.category, form.range].forEach((select) =>
  select.addEventListener("change", () => {
    renderFormSubtype();
    renderNameOptions();
  })
);

// Довідник назв веде лише адміністратор
$("addAssetName").addEventListener("click", async () => {
  const name = window.prompt("Нова назва засобу:")?.trim();
  if (!name) return;
  const { error } = await db.from("workflow_assets").insert({ name, ...formSubtype(), created_by: state.user.id });
  if (error) {
    setMessage($("deviceMessage"), error.message, true);
    return;
  }
  await load("assets");
  renderNameOptions(name);
});

$("renameAssetName").addEventListener("click", async () => {
  const asset = state.assets.find((item) => item.name === form.name.value);
  if (!asset) {
    setMessage($("deviceMessage"), "Спершу оберіть назву зі списку.", true);
    return;
  }
  const name = window.prompt("Нова назва для «" + asset.name + "»:", asset.name)?.trim();
  if (!name || name === asset.name) return;
  const { data, error } = await db.from("workflow_assets").update({ name }).eq("id", asset.id).select();
  if (error || !data?.length) {
    setMessage($("deviceMessage"), error?.message || "Немає прав на перейменування.", true);
    return;
  }
  await load("assets");
  renderNameOptions(name);
});

$("deviceForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = $("deviceMessage");
  const payload = {
    ...formSubtype(),
    name: form.name.value,
    serial_number: form.serial.value.trim(),
    ownership: form.ownership.value,
    status: form.status.value,
    note: form.note.value.trim() || null
  };
  if (!payload.name || !payload.serial_number) {
    setMessage(message, payload.name ? "Вкажіть серійний № (або «Б/Н»)." : "Оберіть назву засобу.", true);
    return;
  }

  const id = form.id.value;
  const twin = duplicateDevice(payload.name, payload.serial_number, id);
  if (twin) {
    setMessage(message, `«${twin.name}» № ${twin.serial_number} уже є на обліку (${twin.variant}).`, true);
    return;
  }

  $("deviceSave").disabled = true;
  const { data, error } = id
    ? await db.from("workflow_reb_far").update(payload).eq("id", id).select("id")
    : await db.from("workflow_reb_far").insert({ ...payload, created_by: state.user.id }).select("id");
  $("deviceSave").disabled = false;

  if (error) {
    setMessage(
      message,
      isUniqueViolation(error) ? "Засіб з такими назвою й номером уже є на обліку. Оновіть сторінку." : error.message,
      true
    );
    return;
  }
  await load("equipment");
  setMessage($("pageMessage"), id ? "Засіб оновлено." : "Засіб додано.");
  render();
  openCard(data?.[0]?.id || id);
});

/* ---------- Друк ---------- */

function printList() {
  const rows = filteredDevices();
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    setMessage($("pageMessage"), "Дозвольте спливаючі вікна в браузері, щоб сформувати PDF.", true);
    return;
  }
  const title = `Засоби: ${view.type || "усі"}`;
  const body = rows.length
    ? rows
        .map(
          (item) => `<tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.serial_number)}</td>
            <td>${escapeHtml(item.variant)}${subtypeLabel(item) ? ` · ${escapeHtml(subtypeLabel(item))}` : ""}</td>
            <td>${escapeHtml(OWNERSHIP[item.ownership] || item.ownership)}</td>
            <td>${window.PrintKit.badge(`status-${item.status}`, escapeHtml(STATUS_LABELS[item.status] || item.status))}</td>
            <td>${escapeHtml(item.note || "")}</td>
          </tr>`
        )
        .join("")
    : '<tr><td colspan="6">Немає засобів</td></tr>';

  printWindow.document.write(`<!doctype html><html lang="uk"><head><meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title><style>${window.PrintKit.styles}</style></head><body>
    ${window.PrintKit.header(escapeHtml(title), `Сформовано: ${escapeHtml(new Date().toLocaleString("uk-UA"))} · Засобів: ${rows.length}`)}
    <table><thead><tr><th>Назва</th><th>Серійний №</th><th>Тип</th><th>Належність</th><th>Стан</th><th>Примітка</th></tr></thead>
    <tbody>${body}</tbody></table></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

/* ---------- Події сторінки ---------- */

$("typeTabs").addEventListener("click", (event) => {
  const tab = event.target.closest("[data-type]");
  if (!tab) return;
  view.type = tab.dataset.type;
  window.history.replaceState(null, "", view.type ? `?type=${encodeURIComponent(view.type)}` : window.location.pathname);
  render();
});

Object.values(filters).forEach((input) => input.addEventListener("input", renderTable));

$("assetsBody").addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (row) openCard(row.dataset.id);
});
$("assetsBody").addEventListener("keydown", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (row && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    openCard(row.dataset.id);
  }
});

$("newDeviceButton").addEventListener("click", () => openForm());
$("deviceCancel").addEventListener("click", () => (form.id.value ? openCard(form.id.value) : closeLayer()));
$("pdfButton").addEventListener("click", printList);

initPage(async () => {
  await load("equipment", "records", "assets", "areas");
  render();
  const deviceId = params.get("device");
  if (deviceId) openCard(deviceId);
});
