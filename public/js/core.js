// Спільне ядро всіх сторінок: база, сесія й ролі, словники, допоміжні функції, шапка,
// вхід і бокові панелі. Сторінки (journal, assets, reports) імпортують звідси.

const config = window.WORKFLOW_SUPABASE || {};
const configured = Boolean(
  window.supabase &&
    config.url &&
    config.anonKey &&
    !config.url.includes("YOUR_PROJECT_ID") &&
    !config.anonKey.includes("YOUR_SUPABASE")
);

export const db = configured ? window.supabase.createClient(config.url, config.anonKey) : null;

export const state = {
  user: null,
  profile: null,
  records: [],
  equipment: [],
  assets: [],
  areas: []
};

/* ---------- Ролі ---------- */

const PERMISSIONS = {
  admin: { create: true, edit: true, delete: true, admin: true },
  operator: { create: true, edit: true, delete: false, admin: false },
  viewer: { create: false, edit: false, delete: false, admin: false },
  guest: { create: false, edit: false, delete: false, admin: false }
};

const ROLE_LABELS = { admin: "Адміністратор", operator: "Оператор", viewer: "Перегляд", guest: "Гість" };

export function role() {
  return String(state.profile?.role || "guest").trim().toLowerCase();
}

export function can(action) {
  return Boolean((PERMISSIONS[role()] || PERMISSIONS.guest)[action]);
}

// Елементи з data-can="create|edit|delete|admin" показуються лише тим, кому це дозволено
export function applyPermissions(root = document) {
  root.querySelectorAll("[data-can]").forEach((node) => {
    node.hidden = !can(node.dataset.can);
  });
}

/* ---------- Словники ---------- */

export const VARIANTS = ["РЕБ", "РЕР", "АДР", "Спец обладнання", "Запчастини", "Інше"];

// Категорія й дальність є лише в РЕБ і РЕР; режим ("Штора") — лише в РЕБ
export const CATEGORIES = {
  "РЕБ": { directional: "Спрямованої дії", dome: "Купольної дії" },
  "РЕР": { rer: "Засіб РЕР", video: "Перехоплення відео" }
};
export const RANGES = { long: "Дального радіуса", medium: "Ближнього радіуса" };
// Короткі підписи для таблиць, щоб підтип вміщався в один рядок
const CATEGORIES_SHORT = { directional: "спрямована", dome: "купольна", rer: "засіб РЕР", video: "перехоплення відео" };
const RANGES_SHORT = { long: "дальня", medium: "ближня" };
export const MODES = { noise: "Білий шум", curtain: "Штора" };
// "Штора" буває лише спрямованої дії й дального радіуса (так само обмежено в базі)
export const CURTAIN_LOCK = { category: "directional", type: "long" };

export const STATUSES = [
  ["in_formation", "В строю"],
  ["logistics_storage", "Склад логістики"],
  ["company_storage", "Склад роти"],
  ["repair", "Ремонт"],
  ["destroyed", "Знищений"]
];
export const STATUS_LABELS = Object.fromEntries(STATUSES);

export const OWNERSHIP = { company: "Майно роти", regiment: "Майно полка", community: "Майно громади" };

export const ACTIONS = {
  deploy: "Розгортання",
  recover: "Згортання",
  relocate: "Переміщення",
  repair: "Ремонт",
  returned: "Повернення з ремонту",
  maintenance: "Обслуговування",
  destroyed: "Знищено"
};

// Як подія в журналі змінює стан засобу на обліку (обслуговування стан не міняє)
export const ACTION_TO_STATUS = {
  deploy: "in_formation",
  recover: "company_storage",
  relocate: "in_formation",
  repair: "repair",
  returned: "company_storage",
  destroyed: "destroyed"
};

export const HISTORY_ACTIONS = { created: "Створено", updated: "Оновлено", deleted: "Видалено" };

export function hasCategories(variant) {
  return Boolean(CATEGORIES[variant]);
}

// Короткий опис підтипу засобу: "Штора · спрямована · дальня"
export function subtypeLabel(item) {
  if (!hasCategories(item.variant)) return "";
  const parts = [];
  if (item.variant === "РЕБ" && item.jam_mode === "curtain") parts.push(MODES.curtain);
  if (item.category) parts.push(CATEGORIES_SHORT[item.category] || item.category);
  if (item.type) parts.push(RANGES_SHORT[item.type] || item.type);
  const label = parts.join(" · ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/* ---------- Допоміжні ---------- */

export const $ = (id) => document.getElementById(id);

export function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function localISO(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export const todayISO = () => localISO(new Date());

export function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function plural(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function setMessage(target, text, isError = false) {
  if (!target) return;
  target.textContent = text;
  target.classList.toggle("is-error", Boolean(isError && text));
}

const ICON_PATHS = {
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>'
};

export function icon(name, size = 16) {
  return `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

/* ---------- Засоби й журнал ---------- */

const norm = (value) => String(value || "").trim().toLowerCase();

// Засоби на обліку з цією назвою й серійним номером. Номер "Б/Н" спільний для багатьох
// засобів, тому збіг по одному лише номеру не означає конкретний засіб
export function devicesFor(assetName, serial) {
  return state.equipment.filter((item) => item.name === assetName && norm(item.serial_number) === norm(serial));
}

/* ---------- Захист від дублів (дублює унікальні індекси в базі) ---------- */

// "Б/Н" — засоби без номера, їх з однаковою назвою може бути кілька
export const isNoSerial = (serial) => norm(serial) === "б/н";

// Інший засіб на обліку з тими самими назвою й номером
export function duplicateDevice(name, serial, exceptId = "") {
  if (isNoSerial(serial)) return null;
  return (
    state.equipment.find(
      (item) => item.id !== exceptId && norm(item.name) === norm(name) && norm(item.serial_number) === norm(serial)
    ) || null
  );
}

// Та сама подія вже записана: дата, засіб, номер, позиція й дія збігаються
export function duplicateRecord(payload, exceptId = "") {
  return (
    state.records.find(
      (record) =>
        record.id !== exceptId &&
        record.date === payload.date &&
        record.action_type === payload.action_type &&
        norm(record.asset) === norm(payload.asset) &&
        norm(record.serial_number) === norm(payload.serial_number) &&
        norm(record.name) === norm(payload.name)
    ) || null
  );
}

// Відмова бази через унікальний індекс (якщо дубль додав хтось інший щойно)
export const isUniqueViolation = (error) => error?.code === "23505";

// Записи журналу конкретного засобу, від нових до старих
export function deviceRecords(device, records = state.records) {
  return records
    .filter((record) => record.asset === device.name && norm(record.serial_number) === norm(device.serial_number))
    .sort((a, b) => `${b.date} ${b.created_at}`.localeCompare(`${a.date} ${a.created_at}`));
}

/* ---------- Засоби в ремонті ---------- */

// Після стількох днів у ремонті засіб виділяється як "давно в ремонті"
export const REPAIR_OVERDUE_DAYS = 14;

const DAY_MS = 86400000;

// Засоби у стані "Ремонт": з якої дати, скільки днів, звідки забрали. Дата — остання подія
// "Ремонт" у журналі; якщо її немає (стан змінили вручну) — дата останньої зміни картки.
export function repairWatch() {
  const today = parseDate(todayISO());
  return state.equipment
    .filter((device) => device.status === "repair")
    .map((device) => {
      const event = deviceRecords(device).find((record) => record.action_type === "repair") || null;
      const since = event?.date || (device.updated_at || device.created_at || "").slice(0, 10) || null;
      const days = since ? Math.max(0, Math.round((today - parseDate(since)) / DAY_MS)) : null;
      return { device, event, since, days, overdue: days === null || days >= REPAIR_OVERDUE_DAYS };
    })
    .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity));
}

export function daysLabel(days) {
  if (days === null) return "невідомо";
  if (days === 0) return "сьогодні";
  return `${days} ${plural(days, "день", "дні", "днів")}`;
}

// Засоби, чия остання дія — розгортання чи переміщення, тобто ті, що зараз на позиціях
export function deployedNow(records = state.records) {
  const latest = new Map();
  [...records]
    .sort((a, b) => `${a.date} ${a.created_at}`.localeCompare(`${b.date} ${b.created_at}`))
    .forEach((record) => latest.set(`${record.asset}|${norm(record.serial_number)}`, record));
  return [...latest.values()].filter((record) => record.action_type === "deploy" || record.action_type === "relocate");
}

export function actionPill(action) {
  return `<span class="action-pill ${escapeHtml(action)}">${escapeHtml(ACTIONS[action] || action)}</span>`;
}

export function statusPill(status) {
  return `<span class="status-pill ${escapeHtml(status)}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;
}

/* ---------- Завантаження даних ---------- */

async function select(table, columns, order) {
  let query = db.from(table).select(columns);
  for (const [column, ascending] of order) query = query.order(column, { ascending });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export const loaders = {
  records: async () => {
    state.records = await select("workflow_records", "*", [["date", false], ["created_at", false]]);
  },
  equipment: async () => {
    state.equipment = await select("workflow_reb_far", "*", [["name", true]]);
  },
  assets: async () => {
    state.assets = await select("workflow_assets", "id, name, type, category, variant, jam_mode", [["name", true]]);
  },
  areas: async () => {
    state.areas = await select("workflow_areas", "id, name", [["name", true]]);
  }
};

export async function load(...names) {
  await Promise.all(names.map((name) => loaders[name]()));
}

async function loadProfile() {
  const { data } = await db.from("profiles").select("id, role, display_name").eq("id", state.user.id).maybeSingle();
  if (data) {
    state.profile = data;
    return;
  }
  const { data: rpcRole } = await db.rpc("get_my_role");
  state.profile = { id: state.user.id, role: rpcRole || "viewer" };
}

// Позивні авторів для історії змін — лише позивні, без email
export async function loadDisplayNames(ids) {
  const names = new Map();
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return names;
  const { data, error } = await db.rpc("get_display_names", { ids: unique });
  if (!error) (data || []).forEach((row) => names.set(row.id, row.display_name));
  return names;
}

/* ---------- Шапка, вхід, сесія ---------- */

function renderDate() {
  const now = new Date();
  const weekDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNumber = weekDate.getUTCDay() || 7;
  weekDate.setUTCDate(weekDate.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(weekDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((weekDate - yearStart) / 86400000 + 1) / 7);
  const days = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  $("dateBadge").textContent = `${days[now.getDay()]}, ${formatDate(todayISO())} · ${week} тиж.`;
}

function setConnected(isConnected) {
  const status = $("connectionStatus");
  status.textContent = isConnected ? "Онлайн" : "Офлайн";
  status.classList.toggle("online", isConnected);
}

function showSignedOut(message = "") {
  $("authView").hidden = false;
  $("appView").hidden = true;
  $("mainNav").hidden = true;
  $("logoutButton").hidden = true;
  setMessage($("authMessage"), message, Boolean(message));
}

/* ---------- Тема оформлення ---------- */

// Кольори в зразках: фон · картка · акцент (дублюють styles.css лише для показу)
const THEMES = [
  ["graphite", "Графіт", "Приглушений темний", ["#1b1e23", "#2c3139", "#a9c47a"]],
  ["field", "Польова", "Теплий оливковий", ["#22241c", "#33362a", "#d4b562"]],
  ["sand", "Пісок", "Світла, не біла", ["#d6d0c1", "#e6e1d5", "#4b5a22"]],
  ["neon", "Неон", "Попередня тема", ["#0f1012", "#222328", "#c8f031"]]
];
const THEME_KEY = "wf-theme";

function currentTheme() {
  return document.documentElement.dataset.theme || "graphite";
}

function applyTheme(name) {
  if (name === "graphite") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = name;
  try {
    localStorage.setItem(THEME_KEY, name);
  } catch {
    /* без сховища тема діє до перезавантаження */
  }
}

function setupThemeSwitch() {
  const panel = document.querySelector(".user-panel");
  if (!panel || panel.querySelector(".theme-switch")) return;
  const wrap = document.createElement("div");
  wrap.className = "theme-switch";
  wrap.innerHTML = `
    <button class="icon-button" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Тема оформлення" title="Тема оформлення">
      <svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor"/></svg>
    </button>
    <div class="theme-menu" role="menu" aria-label="Тема оформлення" hidden>
      ${THEMES.map(([id, label, hint, colors]) => `
        <button class="theme-option" type="button" role="menuitemradio" data-theme-id="${id}">
          <span class="theme-swatch" aria-hidden="true">${colors.map((c) => `<i style="background:${c}"></i>`).join("")}</span>
          <span>${label}<small>${hint}</small></span>
        </button>`).join("")}
    </div>`;
  panel.insertBefore(wrap, $("logoutButton"));

  const button = wrap.querySelector("button");
  const menu = wrap.querySelector(".theme-menu");
  const options = [...menu.querySelectorAll(".theme-option")];
  const toggle = (open) => {
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if (open) {
      options.forEach((o) => o.setAttribute("aria-checked", String(o.dataset.themeId === currentTheme())));
      (options.find((o) => o.dataset.themeId === currentTheme()) || options[0]).focus();
    }
  };
  button.addEventListener("click", () => toggle(menu.hidden));
  menu.addEventListener("click", (event) => {
    const option = event.target.closest(".theme-option");
    if (!option) return;
    applyTheme(option.dataset.themeId);
    toggle(false);
    button.focus();
  });
  menu.addEventListener("keydown", (event) => {
    const index = options.indexOf(document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      options[(index + step + options.length) % options.length].focus();
    } else if (event.key === "Escape") {
      event.stopPropagation();
      toggle(false);
      button.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (!menu.hidden && !wrap.contains(event.target)) toggle(false);
  });
}

/* ---------- Другий крок входу: код з Google Authenticator ---------- */

// Без підтвердженого коду (рівень сесії aal2) база не віддає жодних даних — див.
// sql/supabase-require-mfa.sql. Сайт лише проводить користувача через цей крок.
function mfaView() {
  let view = $("mfaView");
  if (view) return view;
  $("authView").insertAdjacentHTML(
    "afterend",
    `<section id="mfaView" class="mfa-view" hidden>
      <form id="mfaForm" class="panel mfa-card" novalidate>
        <h2 id="mfaTitle" class="auth-title"></h2>
        <p id="mfaLead" class="mfa-lead"></p>
        <div id="mfaSetup" class="mfa-setup" hidden>
          <ol class="mfa-steps">
            <li>Встановіть на телефон <b>Google Authenticator</b> (Play Маркет / App Store).</li>
            <li>У застосунку натисніть <b>+</b> → <b>Сканувати QR-код</b> і наведіть камеру на код.</li>
            <li>Введіть нижче 6 цифр, які покаже застосунок.</li>
          </ol>
          <img id="mfaQr" class="mfa-qr" alt="QR-код для Google Authenticator" width="200" height="200" />
          <details class="mfa-manual">
            <summary>Не сканується? Ввести ключ вручну</summary>
            <code id="mfaSecret" class="mfa-secret"></code>
          </details>
        </div>
        <label>Код з Google Authenticator
          <input id="mfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" />
        </label>
        <button id="mfaSubmit" class="primary-button" type="submit">Підтвердити</button>
        <p id="mfaMessage" class="message" role="status"></p>
        <button id="mfaLogout" class="ghost-button mfa-logout" type="button">Вийти</button>
      </form>
    </section>`
  );
  return $("mfaView");
}

// Підключений (підтверджений) застосунок або новий — з QR-кодом
async function prepareFactor() {
  const { data, error } = await db.auth.mfa.listFactors();
  if (error) throw error;
  const verified = data?.totp?.[0];
  if (verified) return { factorId: verified.id, enrolled: true };

  // Незавершені спроби підключення (закрили сторінку до введення коду) — прибираємо
  for (const factor of (data?.all || []).filter((item) => item.status !== "verified")) {
    await db.auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data: created, error: enrollError } = await db.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Google Authenticator",
    issuer: "Workflow"
  });
  if (enrollError) throw enrollError;
  return { factorId: created.id, enrolled: false, qr: created.totp.qr_code, secret: created.totp.secret };
}

// true — сесія вже з другим фактором; false — показано крок з кодом
async function requireSecondFactor() {
  const { data: level } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level?.currentLevel === "aal2") return true;

  const view = mfaView();
  $("authView").hidden = true;
  $("appView").hidden = true;
  view.hidden = false;

  let factor;
  try {
    factor = await prepareFactor();
  } catch (error) {
    $("mfaTitle").textContent = "Двофакторний вхід";
    setMessage($("mfaMessage"), `Не вдалося почати перевірку: ${error.message}`, true);
    $("mfaSubmit").disabled = true;
    return false;
  }

  $("mfaTitle").textContent = factor.enrolled ? "Код підтвердження" : "Підключіть Google Authenticator";
  $("mfaLead").textContent = factor.enrolled
    ? "Відкрийте Google Authenticator і введіть 6-значний код для Workflow."
    : "Вхід до журналу — лише з кодом з телефона. Налаштування займе хвилину, робиться один раз.";
  $("mfaSetup").hidden = factor.enrolled;
  if (!factor.enrolled) {
    $("mfaQr").src = factor.qr;
    $("mfaSecret").textContent = factor.secret;
  }
  $("mfaCode").focus();

  $("mfaCode").addEventListener("input", () => {
    $("mfaCode").value = $("mfaCode").value.replace(/\D/g, "").slice(0, 6);
  });
  $("mfaForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = $("mfaCode").value;
    if (code.length !== 6) {
      setMessage($("mfaMessage"), "Введіть 6 цифр з Google Authenticator.", true);
      return;
    }
    $("mfaSubmit").disabled = true;
    const { error } = await db.auth.mfa.challengeAndVerify({ factorId: factor.factorId, code });
    if (error) {
      $("mfaSubmit").disabled = false;
      $("mfaCode").select();
      setMessage($("mfaMessage"), "Код не підійшов. Перевірте, що це код для Workflow, і введіть новий.", true);
      return;
    }
    window.location.reload();
  });
  $("mfaLogout").addEventListener("click", async () => {
    await db.auth.signOut();
    window.location.href = "./index.html";
  });
  return false;
}

// Ініціалізація сторінки: шапка, сесія, права. onReady викликається для користувача, що увійшов
export async function initPage(onReady) {
  renderDate();
  setupThemeSwitch();
  setConnected(Boolean(db));

  $("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!db) return;
    const { error } = await db.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });
    if (error) {
      setMessage($("authMessage"), error.message, true);
      return;
    }
    window.location.reload();
  });

  $("logoutButton").addEventListener("click", async () => {
    await db.auth.signOut();
    window.location.href = "./index.html";
  });

  if (!db) {
    showSignedOut("Додайте URL та anon key у supabase-config.js, потім оновіть сторінку.");
    return;
  }

  const { data } = await db.auth.getSession();
  state.user = data.session?.user || null;
  if (!state.user) {
    showSignedOut();
    return;
  }

  if (!(await requireSecondFactor())) return;

  await loadProfile();
  $("userRole").textContent = ROLE_LABELS[role()] || role();
  $("logoutButton").hidden = false;
  $("authView").hidden = true;
  $("appView").hidden = false;
  $("mainNav").hidden = false;
  applyPermissions();

  try {
    await onReady();
  } catch (error) {
    setMessage($("pageMessage"), `Не вдалося завантажити дані: ${error.message}`, true);
  }
}

/* ---------- Бокові панелі й модальні вікна ---------- */

let openLayer = null;

export function openLayerEl(element) {
  if (openLayer && openLayer !== element) closeLayer();
  element.hidden = false;
  openLayer = element;
  document.body.classList.add("has-layer");
  element.querySelector("[data-autofocus]")?.focus();
}

export function closeLayer() {
  if (!openLayer) return;
  openLayer.hidden = true;
  openLayer.dispatchEvent(new CustomEvent("layer-close"));
  openLayer = null;
  document.body.classList.remove("has-layer");
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-layer]") || event.target.classList.contains("layer")) closeLayer();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && openLayer && !document.querySelector(".dp:not([hidden])")) closeLayer();
});
