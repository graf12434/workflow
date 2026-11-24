// Бокова панель "Подія": новий запис у журналі або редагування наявного.
// Використовується на сторінці журналу й у картці засобу.
import {
  db, state, $, can, applyPermissions, escapeHtml, setMessage, todayISO, icon, load,
  VARIANTS, ACTIONS, ACTION_TO_STATUS, subtypeLabel, devicesFor, deviceRecords,
  statusPill, openLayerEl, closeLayer, duplicateRecord, isUniqueViolation, formatDate
} from "./core.js";

const actionOptions = Object.entries(ACTIONS)
  .map(([value, label]) => `<option value="${value}">${label}</option>`)
  .join("");

document.body.insertAdjacentHTML(
  "beforeend",
  `<div class="layer" id="eventLayer" hidden>
    <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="eventTitle">
      <header class="drawer-head">
        <h2 id="eventTitle">Нова подія</h2>
        <button class="icon-button" type="button" data-close-layer aria-label="Закрити">${icon("close")}</button>
      </header>
      <form id="eventForm" class="drawer-body form-grid" novalidate>
        <input id="eventId" type="hidden" />
        <label>Дата<input id="eventDate" type="date" required /></label>
        <label>Дія<select id="eventAction" required>${actionOptions}</select></label>
        <label class="wide">Засіб<select id="eventAsset" required data-autofocus></select></label>
        <label>Серійний №<input id="eventSerial" list="eventSerials" autocomplete="off" required /></label>
        <datalist id="eventSerials"></datalist>
        <label>Назва позиції<input id="eventName" autocomplete="off" required /></label>
        <div id="eventDevice" class="wide device-hint" hidden></div>
        <label class="wide">Район
          <span class="field-row">
            <select id="eventArea" required></select>
            <button id="eventAddArea" class="icon-button" type="button" data-can="admin" aria-label="Додати район" title="Додати район">${icon("plus")}</button>
          </span>
        </label>
        <label class="wide">Примітка<textarea id="eventNote" rows="3" placeholder="Умови, відповідальний, що змінилось"></textarea></label>
      </form>
      <footer class="drawer-foot">
        <p id="eventMessage" class="message" role="status"></p>
        <button id="eventSave" class="primary-button" type="submit" form="eventForm">Зберегти подію</button>
      </footer>
    </aside>
  </div>`
);

const layer = $("eventLayer");
const form = $("eventForm");
const fields = {
  id: $("eventId"),
  date: $("eventDate"),
  action: $("eventAction"),
  asset: $("eventAsset"),
  serial: $("eventSerial"),
  name: $("eventName"),
  area: $("eventArea"),
  note: $("eventNote")
};
window.DatePicker?.enhance(fields.date);
applyPermissions(layer);

let onSaved = () => {};

const variantOf = (assetName) => state.assets.find((item) => item.name === assetName)?.variant || null;
const needsDevice = (assetName) => ["РЕБ", "РЕР"].includes(variantOf(assetName));

function renderAssetOptions(selected = "") {
  const groups = [...VARIANTS, null].map((variant) => {
    const names = state.assets.filter((item) => (item.variant || null) === variant).map((item) => item.name);
    if (!names.length) return "";
    const options = names
      .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
      .join("");
    return `<optgroup label="${escapeHtml(variant || "Інші назви")}">${options}</optgroup>`;
  });

  // Назва з давнього запису, якої вже немає в довіднику, все одно має відобразитись
  const known = state.assets.some((item) => item.name === selected);
  const extra = selected && !known ? `<option value="${escapeHtml(selected)}">${escapeHtml(selected)}</option>` : "";
  fields.asset.innerHTML = `<option value="" disabled>Оберіть засіб</option>${extra}${groups.join("")}`;
  fields.asset.value = selected;
}

function renderAreaOptions(selected = "") {
  const names = state.areas.map((item) => item.name);
  if (selected && !names.includes(selected)) names.unshift(selected);
  fields.area.innerHTML = `<option value="" disabled>Оберіть район</option>${names
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("")}`;
  fields.area.value = selected;
}

function renderSerialHints() {
  const serials = state.equipment
    .filter((item) => item.name === fields.asset.value)
    .map((item) => item.serial_number);
  $("eventSerials").innerHTML = [...new Set(serials)]
    .map((serial) => `<option value="${escapeHtml(serial)}"></option>`)
    .join("");
}

// Підказка під полями: який засіб на обліку відповідає назві й номеру
function renderDeviceHint() {
  const hint = $("eventDevice");
  const asset = fields.asset.value;
  const serial = fields.serial.value.trim();
  if (!asset || !serial) {
    hint.hidden = true;
    return null;
  }

  const matches = devicesFor(asset, serial);
  hint.hidden = false;
  hint.classList.toggle("is-warning", matches.length !== 1 && needsDevice(asset));

  if (matches.length === 1) {
    const device = matches[0];
    const subtype = subtypeLabel(device);
    const notInRepair = fields.action.value === "returned" && device.status !== "repair";
    hint.classList.toggle("is-warning", notInRepair);
    hint.innerHTML = `На обліку: ${statusPill(device.status)} <span>${escapeHtml(device.variant)}${subtype ? ` · ${escapeHtml(subtype)}` : ""}</span>${notInRepair ? "<span>— засіб не в ремонті</span>" : ""}`;
    return device;
  }

  if (matches.length > 1) {
    hint.textContent = `На обліку ${matches.length} засоби з цим номером — стан засобу не оновиться автоматично.`;
  } else if (needsDevice(asset)) {
    hint.textContent = "Такого засобу немає на обліку. Спершу додайте його в розділі «Засоби».";
  } else {
    hint.textContent = "Засіб не на обліку — подія збережеться лише в журналі.";
  }
  return null;
}

// Для відомого засобу підставляємо позицію й район з його останньої події, якщо поля порожні
function prefillFromHistory(device) {
  const last = device && deviceRecords(device)[0];
  if (!last) return;
  if (!fields.name.value.trim()) fields.name.value = last.name || "";
  if (!fields.area.value && last.area) renderAreaOptions(last.area);
}

fields.action.addEventListener("change", renderDeviceHint);

fields.asset.addEventListener("change", () => {
  renderSerialHints();
  prefillFromHistory(renderDeviceHint());
});

// Номер, що однозначно вказує на засіб, сам підставляє назву засобу
fields.serial.addEventListener("input", () => {
  const serial = fields.serial.value.trim().toLowerCase();
  if (serial) {
    let matches = state.equipment.filter((item) => String(item.serial_number).trim().toLowerCase() === serial);
    if (fields.asset.value) {
      const sameAsset = matches.filter((item) => item.name === fields.asset.value);
      if (sameAsset.length || matches.length > 1) matches = sameAsset;
    }
    if (matches.length === 1 && fields.asset.value !== matches[0].name) {
      renderAssetOptions(matches[0].name);
      renderSerialHints();
    }
  }
  prefillFromHistory(renderDeviceHint());
});

$("eventAddArea").addEventListener("click", async () => {
  const name = window.prompt("Назва нового району:")?.trim();
  if (!name) return;
  const { error } = await db.from("workflow_areas").insert({ name, created_by: state.user.id });
  if (error) {
    setMessage($("eventMessage"), error.message, true);
    return;
  }
  await load("areas");
  renderAreaOptions(name);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = $("eventMessage");
  if (!can("create")) return;

  const payload = {
    date: fields.date.value,
    asset: fields.asset.value,
    name: fields.name.value.trim(),
    serial_number: fields.serial.value.trim(),
    area: fields.area.value,
    action_type: fields.action.value,
    note: fields.note.value.trim() || null
  };

  const missing = [
    [payload.date, "дату"],
    [payload.asset, "засіб"],
    [payload.serial_number, "серійний №"],
    [payload.name, "назву позиції"],
    [payload.area, "район"]
  ].find(([value]) => !value);
  if (missing) {
    setMessage(message, `Вкажіть ${missing[1]}.`, true);
    return;
  }

  const matches = devicesFor(payload.asset, payload.serial_number);
  if (needsDevice(payload.asset) && !matches.length) {
    setMessage(message, "Такого засобу немає на обліку. Спершу додайте його в розділі «Засоби».", true);
    return;
  }

  const id = fields.id.value;
  if (duplicateRecord(payload, id)) {
    setMessage(
      message,
      `Така подія вже є в журналі: ${formatDate(payload.date)}, ${ACTIONS[payload.action_type] || payload.action_type}, позиція ${payload.name}.`,
      true
    );
    return;
  }

  $("eventSave").disabled = true;
  const { error } = id
    ? await db.from("workflow_records").update(payload).eq("id", id)
    : await db.from("workflow_records").insert({ ...payload, created_by: state.user.id });

  if (error) {
    $("eventSave").disabled = false;
    setMessage(
      message,
      isUniqueViolation(error) ? "Така подія вже є в журналі. Оновіть сторінку." : error.message,
      true
    );
    return;
  }

  const newStatus = ACTION_TO_STATUS[payload.action_type];
  if (matches.length === 1 && newStatus && matches[0].status !== newStatus) {
    await db.from("workflow_reb_far").update({ status: newStatus }).eq("id", matches[0].id);
  }

  await load("records", "equipment");
  $("eventSave").disabled = false;
  closeLayer();
  onSaved(id ? "Запис оновлено." : "Подію збережено.");
});

// record — редагування наявного запису; device — нова подія для конкретного засобу
export function openEventForm({ record = null, device = null, action = "", saved = () => {} } = {}) {
  onSaved = saved;
  form.reset();
  setMessage($("eventMessage"), "");
  $("eventTitle").textContent = record ? "Редагування запису" : "Нова подія";
  $("eventSave").textContent = record ? "Оновити запис" : "Зберегти подію";

  fields.id.value = record?.id || "";
  fields.date.value = record?.date || todayISO();
  fields.action.value = record?.action_type || action || "deploy";
  renderAssetOptions(record?.asset || device?.name || "");
  renderAreaOptions(record?.area || "");
  fields.serial.value = record?.serial_number || device?.serial_number || "";
  fields.name.value = record?.name || "";
  fields.note.value = record?.note || "";

  renderSerialHints();
  const matched = renderDeviceHint();
  if (!record) prefillFromHistory(matched);
  openLayerEl(layer);
}
