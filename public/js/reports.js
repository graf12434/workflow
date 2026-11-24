// Звіти: друк засобів за категоріями й станом та журналу подій за період.
// Перед друком видно, скільки рядків потрапить у звіт.
import {
  state, $, initPage, load, escapeHtml, formatDate, parseDate, plural, setMessage,
  VARIANTS, STATUSES, STATUS_LABELS, OWNERSHIP, ACTIONS, subtypeLabel, statusPill, actionPill
} from "./core.js";

const kit = () => window.PrintKit;

/* ---------- Звіт по засобах ---------- */

function selectedVariants() {
  return [...document.querySelectorAll("[data-variant]:checked")].map((box) => box.value);
}

function equipmentRows() {
  const variants = selectedVariants();
  const status = $("equipmentStatus").value;
  return state.equipment.filter(
    (item) => variants.includes(item.variant) && (!status || item.status === status)
  );
}

function renderEquipmentReport() {
  $("variantTiles").innerHTML = VARIANTS.map((variant) => {
    const count = state.equipment.filter((item) => item.variant === variant).length;
    return `<label class="check-tile"><input type="checkbox" data-variant value="${escapeHtml(variant)}" checked />
      <span>${escapeHtml(variant)}</span><b>${count}</b></label>`;
  }).join("");
  updateEquipmentPreview();
}

const SAMPLE_ROWS = 6;

// Перші рядки звіту: видно, що саме піде на друк
function renderSample(list, rows, render) {
  const shown = rows.slice(0, SAMPLE_ROWS).map(render);
  if (rows.length > SAMPLE_ROWS) shown.push(`<li class="sample-more">і ще ${rows.length - SAMPLE_ROWS}</li>`);
  list.innerHTML = shown.length ? shown.join("") : '<li class="sample-more">Немає рядків для звіту</li>';
}

function updateEquipmentPreview() {
  const rows = equipmentRows();
  const count = rows.length;
  renderSample($("equipmentSample"), rows, (item) => `
    <li class="sample-row">
      <span class="sample-main"><b>${escapeHtml(item.name)}</b><span>${escapeHtml(item.variant)} · № ${escapeHtml(item.serial_number)}</span></span>
      ${statusPill(item.status)}
    </li>`);
  $("equipmentPreview").textContent = `У звіт потрапить ${count} ${plural(count, "засіб", "засоби", "засобів")}`;
  $("printEquipment").disabled = !count;
  const boxes = [...document.querySelectorAll("[data-variant]")];
  $("variantsAll").checked = boxes.every((box) => box.checked);
}

function printEquipment() {
  const rows = equipmentRows();
  const status = $("equipmentStatus").value;
  const sections = selectedVariants()
    .map((variant) => {
      const items = rows.filter((item) => item.variant === variant);
      if (!items.length) return "";
      const body = items
        .map(
          (item) => `<tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.serial_number)}</td>
            <td>${escapeHtml(subtypeLabel(item))}</td>
            <td>${escapeHtml(OWNERSHIP[item.ownership] || item.ownership)}</td>
            <td>${kit().badge(`status-${item.status}`, escapeHtml(STATUS_LABELS[item.status] || item.status))}</td>
            <td>${escapeHtml(item.note || "")}</td>
          </tr>`
        )
        .join("");
      return `<h2>${escapeHtml(variant)} (${items.length})</h2>
        <table><thead><tr><th>Назва</th><th>Серійний №</th><th>Підтип</th><th>Належність</th><th>Стан</th><th>Примітка</th></tr></thead>
        <tbody>${body}</tbody></table>`;
    })
    .join("");

  const scope = status ? ` · Стан: ${STATUS_LABELS[status]}` : "";
  printDocument("Звіт по засобах", `Засобів: ${rows.length}${scope}`, sections);
}

/* ---------- Звіт по журналу ---------- */

function journalRows() {
  const from = $("journalFrom").value ? parseDate($("journalFrom").value) : null;
  const to = $("journalTo").value ? parseDate($("journalTo").value) : null;
  const action = $("journalAction").value;
  return state.records.filter((record) => {
    const date = parseDate(record.date);
    return (!from || date >= from) && (!to || date <= to) && (!action || record.action_type === action);
  });
}

function updateJournalPreview() {
  const fromValue = $("journalFrom").value;
  const toValue = $("journalTo").value;
  if (fromValue && toValue && fromValue > toValue) {
    setMessage($("journalPreview"), "Дата «з» пізніша за дату «по».", true);
    $("printJournal").disabled = true;
    return;
  }
  const rows = journalRows();
  const count = rows.length;
  renderSample($("journalSample"), rows, (record) => `
    <li class="sample-row">
      <span class="sample-main"><b>${escapeHtml(record.asset)}</b><span>${formatDate(record.date)} · ${escapeHtml(record.area)}</span></span>
      ${actionPill(record.action_type)}
    </li>`);
  setMessage($("journalPreview"), `У звіт потрапить ${count} ${plural(count, "подія", "події", "подій")}`);
  $("printJournal").disabled = !count;
}

function printJournal() {
  const rows = journalRows();
  const fromValue = $("journalFrom").value;
  const toValue = $("journalTo").value;
  const period = fromValue || toValue
    ? `Період: ${fromValue ? formatDate(fromValue) : "…"} – ${toValue ? formatDate(toValue) : "…"}`
    : "Період: увесь журнал";
  const action = $("journalAction").value;

  const body = rows
    .map(
      (record) => `<tr>
        <td>${formatDate(record.date)}</td>
        <td>${escapeHtml(record.asset)}</td>
        <td>${escapeHtml(record.serial_number)}</td>
        <td>${escapeHtml(record.name)}</td>
        <td>${escapeHtml(record.area)}</td>
        <td>${kit().badge(`action-${record.action_type}`, escapeHtml(ACTIONS[record.action_type] || record.action_type))}</td>
        <td>${escapeHtml(record.note || "")}</td>
      </tr>`
    )
    .join("");

  printDocument(
    "Звіт по журналу подій",
    `${period}${action ? ` · Дія: ${ACTIONS[action]}` : ""} · Подій: ${rows.length}`,
    `<table><thead><tr><th>Дата</th><th>Засіб</th><th>Серійний №</th><th>Позиція</th><th>Район</th><th>Дія</th><th>Примітка</th></tr></thead>
      <tbody>${body}</tbody></table>`
  );
}

/* ---------- Друк ---------- */

function printDocument(title, meta, content) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    setMessage($("pageMessage"), "Дозвольте спливаючі вікна в браузері, щоб сформувати звіт.", true);
    return;
  }
  const generated = `Сформовано: ${new Date().toLocaleString("uk-UA")}`;
  printWindow.document.write(`<!doctype html><html lang="uk"><head><meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title><style>${kit().styles}</style></head><body>
    ${kit().header(escapeHtml(title), `${escapeHtml(generated)}<br />${escapeHtml(meta)}`)}
    ${content}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

/* ---------- Події сторінки ---------- */

$("equipmentStatus").innerHTML =
  '<option value="">Усі стани</option>' +
  STATUSES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
$("journalAction").innerHTML =
  '<option value="">Усі дії</option>' +
  Object.entries(ACTIONS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("");

$("variantTiles").addEventListener("change", updateEquipmentPreview);
$("equipmentStatus").addEventListener("change", updateEquipmentPreview);
$("variantsAll").addEventListener("change", () => {
  document.querySelectorAll("[data-variant]").forEach((box) => {
    box.checked = $("variantsAll").checked;
  });
  updateEquipmentPreview();
});
["journalFrom", "journalTo", "journalAction"].forEach((id) => $(id).addEventListener("input", updateJournalPreview));
$("printEquipment").addEventListener("click", printEquipment);
$("printJournal").addEventListener("click", printJournal);

initPage(async () => {
  await load("equipment", "records");
  renderEquipmentReport();
  updateJournalPreview();
});
