// Журнал подій: зведення, таблиця подій з фільтрами, де стоять засоби, роботи за тиждень.
import {
  db, state, $, can, initPage, load, escapeHtml, formatDate, parseDate, localISO, plural, icon,
  setMessage, ACTIONS, HISTORY_ACTIONS, devicesFor, deployedNow, actionPill, loadDisplayNames,
  openLayerEl, repairWatch, daysLabel, REPAIR_OVERDUE_DAYS
} from "./core.js";
import { openEventForm } from "./event-form.js";

const WEEKDAYS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const AREAS_SHOWN = 6;

const filters = {
  search: $("searchInput"),
  action: $("actionFilter"),
  from: $("fromDate"),
  to: $("toDate")
};

filters.action.insertAdjacentHTML(
  "beforeend",
  Object.entries(ACTIONS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")
);

function filteredRecords() {
  const query = filters.search.value.trim().toLowerCase();
  const action = filters.action.value;
  const from = filters.from.value ? parseDate(filters.from.value) : null;
  const to = filters.to.value ? parseDate(filters.to.value) : null;

  return state.records.filter((record) => {
    const date = parseDate(record.date);
    const text = [record.asset, record.name, record.serial_number, record.area, record.note].join(" ").toLowerCase();
    return (
      (!query || text.includes(query)) &&
      (!action || record.action_type === action) &&
      (!from || date >= from) &&
      (!to || date <= to)
    );
  });
}

/* ---------- Зведення ---------- */

function weekStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (6 - index));
    const key = localISO(date);
    return { date, key, count: state.records.filter((record) => record.date === key).length };
  });
  const keys = new Set(days.map((day) => day.key));
  const weekRecords = state.records.filter((record) => keys.has(record.date));

  const prevStart = new Date(today);
  prevStart.setDate(prevStart.getDate() - 13);
  const prevEnd = new Date(today);
  prevEnd.setDate(prevEnd.getDate() - 7);
  const prevCount = state.records.filter((record) => {
    const date = parseDate(record.date);
    return date >= prevStart && date <= prevEnd;
  }).length;

  return { days, weekRecords, prevCount };
}

function renderSummary() {
  const equipment = state.equipment;
  const inService = equipment.filter((item) => item.status === "in_formation").length;
  const inRepair = equipment.filter((item) => item.status === "repair").length;
  const deployed = deployedNow();
  const areaCount = new Set(deployed.map((record) => record.area)).size;
  const { days, weekRecords, prevCount } = weekStats();
  const diff = weekRecords.length - prevCount;

  $("kpiTotal").textContent = equipment.length;
  $("kpiTotalSub").textContent = `${inRepair} у ремонті`;
  $("kpiInService").textContent = inService;
  $("kpiInServiceSub").textContent = equipment.length
    ? `${Math.round((inService / equipment.length) * 100)}% засобів`
    : "немає засобів";
  $("kpiDeployed").textContent = deployed.length;
  $("kpiDeployedSub").textContent = areaCount
    ? `у ${areaCount} ${plural(areaCount, "районі", "районах", "районах")}`
    : "жоден не розгорнутий";
  $("kpiWeek").textContent = weekRecords.length;
  $("kpiWeekSub").innerHTML = diff
    ? `<b>${diff > 0 ? "+" : "−"}${Math.abs(diff)}</b> до попередніх 7 днів (${prevCount})`
    : `як і попередні 7 днів (${prevCount})`;

  const last = state.records[0];
  $("journalSummary").textContent = last
    ? `${state.records.length} ${plural(state.records.length, "запис", "записи", "записів")} · останній ${formatDate(last.date)}, ${last.asset} — ${last.area}`
    : "Записів ще немає";

  renderAreas(deployed);
  renderWeek(days, weekRecords);
}

function renderAreas(deployed) {
  const byArea = [...deployed.reduce((map, record) => {
    const area = record.area || "—";
    return map.set(area, (map.get(area) || 0) + 1);
  }, new Map()).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "uk"));

  $("areasMeta").textContent = deployed.length
    ? `${deployed.length} ${plural(deployed.length, "засіб", "засоби", "засобів")}`
    : "";

  if (!byArea.length) {
    $("deployAreas").innerHTML = '<li class="stat-empty">Жоден засіб зараз не розгорнутий</li>';
    return;
  }

  const shown = byArea.slice(0, AREAS_SHOWN);
  const rest = byArea.slice(AREAS_SHOWN);
  const max = shown[0][1];
  const rows = shown.map(
    ([area, count]) => `
      <li class="deploy-area">
        <span class="deploy-area-name" title="${escapeHtml(area)}">${escapeHtml(area)}</span>
        <b>${count}</b>
        <span class="deploy-area-bar"><span style="--value: ${(count / max) * 100}%"></span></span>
      </li>`
  );
  if (rest.length) {
    const restCount = rest.reduce((sum, [, count]) => sum + count, 0);
    rows.push(`
      <li class="deploy-area deploy-area--rest">
        <span class="deploy-area-name">Ще ${rest.length} ${plural(rest.length, "район", "райони", "районів")}</span>
        <b>${restCount}</b>
      </li>`);
  }
  $("deployAreas").innerHTML = rows.join("");
}

function renderWeek(days, weekRecords) {
  $("weekMeta").textContent = `${weekRecords.length} ${plural(weekRecords.length, "подія", "події", "подій")}`;
  const max = Math.max(1, ...days.map((day) => day.count));
  $("activityChart").innerHTML = days
    .map(
      (day, index) => `
      <div class="activity-col${index === 6 ? " is-today" : ""}${day.count ? "" : " is-empty"}" title="${formatDate(day.key)}: ${day.count}">
        <span class="activity-value">${day.count}</span>
        <span class="activity-bar" style="--value: ${day.count / max}"></span>
        <span class="activity-day">${WEEKDAYS[day.date.getDay()]}</span>
      </div>`
    )
    .join("");

  const counts = Object.keys(ACTIONS)
    .map((key) => [key, weekRecords.filter((record) => record.action_type === key).length])
    .filter(([, count]) => count);
  $("actionChips").innerHTML = counts.length
    ? counts.map(([key, count]) => `<span class="action-pill ${key}">${ACTIONS[key]} · ${count}</span>`).join("")
    : '<span class="stat-empty">Немає робіт за тиждень</span>';
}

/* ---------- Таблиця ---------- */

function serialCell(record) {
  const matches = devicesFor(record.asset, record.serial_number);
  const serial = escapeHtml(record.serial_number);
  return matches.length === 1
    ? `<a class="cell-link" href="./assets.html?device=${encodeURIComponent(matches[0].id)}" title="Картка засобу">${serial}</a>`
    : serial;
}

function renderRecords() {
  const rows = filteredRecords();
  const total = state.records.length;
  $("journalCount").textContent = rows.length === total ? `${total}` : `${rows.length} з ${total}`;

  if (!rows.length) {
    $("recordsBody").innerHTML = `<tr><td colspan="6" class="empty-state">${total ? "Нічого не знайдено за цими фільтрами" : "Записів ще немає"}</td></tr>`;
    return;
  }

  $("recordsBody").innerHTML = rows
    .map(
      (record) => `<tr>
        <td class="num">${formatDate(record.date)}</td>
        <td class="cell-asset"><span class="cell-strong">${escapeHtml(record.asset)}</span><span class="cell-sub">№ ${serialCell(record)}</span></td>
        <td><span class="cell-type">${escapeHtml(record.name)}</span><span class="cell-sub">${escapeHtml(record.area)}</span></td>
        <td>${actionPill(record.action_type)}</td>
        <td class="note-cell" title="${escapeHtml(record.note || "")}">${escapeHtml(record.note || "")}</td>
        <td class="col-actions">
          <div class="row-actions">
            ${can("edit") ? `<button class="icon-button" type="button" title="Редагувати" aria-label="Редагувати" data-edit="${record.id}">${icon("edit")}</button>` : ""}
            <button class="icon-button" type="button" title="Історія змін" aria-label="Історія змін" data-history="${record.id}">${icon("info")}</button>
            ${can("delete") ? `<button class="icon-button danger" type="button" title="Видалити" aria-label="Видалити" data-delete="${record.id}">${icon("close")}</button>` : ""}
          </div>
        </td>
      </tr>`
    )
    .join("");
}

// Засоби в ремонті — перед очима, щоб не забути відмітити повернення
function renderRepairs() {
  const items = repairWatch();
  $("repairWatch").hidden = !items.length;
  if (!items.length) return;
  const overdue = items.filter((item) => item.overdue).length;
  $("repairMeta").textContent = overdue
    ? `${items.length} · ${overdue} довше ${REPAIR_OVERDUE_DAYS} днів`
    : `${items.length}`;
  $("repairList").innerHTML = items
    .map(({ device, event, since, days, overdue: late }) => {
      const where = event ? [event.name, event.area].filter(Boolean).map(escapeHtml).join(" · ") : "";
      const details = [
        `№ ${escapeHtml(device.serial_number)}`,
        since ? `з ${formatDate(since)}` : "",
        where || (event ? "" : "без події в журналі")
      ].filter(Boolean).join(" · ");
      const count = since
        ? `<b>${days}</b><small>${plural(days, "день", "дні", "днів")}</small>`
        : "<b>?</b><small>днів</small>";
      return `<li class="repair-item${late ? " is-overdue" : ""}" title="${escapeHtml(device.name)} — ${since ? daysLabel(days) : "дата невідома"} у ремонті">
        <span class="repair-count">${count}</span>
        <span class="repair-main">
          <a class="repair-name" href="./assets.html?device=${encodeURIComponent(device.id)}">${escapeHtml(device.name)}</a>
          <span class="repair-sub">${details}</span>
        </span>
        ${can("create") ? `<button class="ghost-button repair-return" type="button" data-return="${device.id}" title="Засіб повернувся: подія «Повернення з ремонту», стан — склад роти">Повернуто</button>` : ""}
      </li>`;
    })
    .join("");
}

function render() {
  renderRepairs();
  renderSummary();
  renderRecords();
}

/* ---------- Дії ---------- */

function saved(text) {
  setMessage($("pageMessage"), text);
  render();
}

async function deleteRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record || !window.confirm(`Видалити запис ${formatDate(record.date)} · ${record.asset} · ${record.area}?`)) return;
  const { error } = await db.from("workflow_records").delete().eq("id", id);
  if (error) {
    setMessage($("pageMessage"), error.message, true);
    return;
  }
  await load("records");
  saved("Запис видалено.");
}

async function openHistory(id) {
  const list = $("historyList");
  list.innerHTML = '<p class="empty-state">Завантаження…</p>';
  openLayerEl($("historyLayer"));

  const { data, error } = await db
    .from("workflow_records_history")
    .select("action, changed_at, changed_by")
    .eq("record_id", id)
    .order("changed_at", { ascending: true });

  if (error || !data?.length) {
    list.innerHTML = `<p class="empty-state">${escapeHtml(error ? error.message : "Історію не знайдено.")}</p>`;
    return;
  }

  const names = await loadDisplayNames(data.map((entry) => entry.changed_by));
  list.innerHTML = data
    .map((entry) => {
      const who = entry.changed_by ? names.get(entry.changed_by) || "Користувач без позивного" : "Невідомий користувач";
      return `
        <div class="history-entry">
          <div class="history-entry-head">
            <span class="action-pill ${entry.action}">${escapeHtml(HISTORY_ACTIONS[entry.action] || entry.action)}</span>
            <time>${escapeHtml(new Date(entry.changed_at).toLocaleString("uk-UA"))}</time>
          </div>
          <div class="history-entry-user">${escapeHtml(who)}</div>
        </div>`;
    })
    .join("");
}

$("recordsBody").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const { edit, history, delete: remove } = button.dataset;
  if (edit) openEventForm({ record: state.records.find((item) => item.id === edit), saved });
  if (history) openHistory(history);
  if (remove) deleteRecord(remove);
});

$("repairList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-return]");
  if (!button) return;
  const device = state.equipment.find((item) => item.id === button.dataset.return);
  if (device) openEventForm({ device, action: "returned", saved });
});

$("newEventButton").addEventListener("click", () => openEventForm({ saved }));
Object.values(filters).forEach((input) => input.addEventListener("input", renderRecords));

initPage(async () => {
  await load("records", "equipment", "assets", "areas");
  render();
});
