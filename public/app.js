const config = window.WORKFLOW_SUPABASE || {};
const supabaseReady = Boolean(
  window.supabase &&
    config.url &&
    config.anonKey &&
    !config.url.includes("YOUR_PROJECT_ID") &&
    !config.anonKey.includes("YOUR_SUPABASE")
);

const db = supabaseReady ? window.supabase.createClient(config.url, config.anonKey) : null;

const state = {
  user: null,
  profile: null,
  records: [],
  filteredRecords: [],
  assets: [],
  areas: []
};

const roles = {
  admin: { canCreate: true, canEdit: true, canDelete: true },
  operator: { canCreate: true, canEdit: true, canDelete: false },
  viewer: { canCreate: false, canEdit: false, canDelete: false },
  guest: { canCreate: false, canEdit: false, canDelete: false }
};

const $ = (id) => document.getElementById(id);

const elements = {
  authView: $("authView"),
  dashboardView: $("dashboardView"),
  loginForm: $("loginForm"),
  entryForm: $("entryForm"),
  logoutButton: $("logoutButton"),
  resetFormButton: $("resetFormButton"),
  assetSelect: $("asset"),
  addAssetButton: $("addAssetButton"),
  areaSelect: $("area"),
  addAreaButton: $("addAreaButton"),
  rebMenu: $("rebMenu"),
  rebMenuButton: $("rebMenuButton"),
  rebMenuList: $("rebMenuList"),
  assetModal: $("assetModal"),
  assetForm: $("assetForm"),
  cancelAssetButton: $("cancelAssetButton"),
  assetModalMessage: $("assetModalMessage"),
  authMessage: $("authMessage"),
  formMessage: $("formMessage"),
  connectionStatus: $("connectionStatus"),
  userRole: $("userRole"),
  recordsBody: $("recordsBody"),
  searchInput: $("searchInput"),
  actionFilter: $("actionFilter"),
  fromDate: $("fromDate"),
  toDate: $("toDate")
};

function roleName() {
  return normalizeRole(state.profile?.role || "guest");
}

function permissions() {
  return roles[roleName()] || roles.guest;
}

function normalizeRole(role) {
  return String(role || "guest").trim().toLowerCase();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

function setMessage(target, text, isError = false) {
  target.textContent = text;
  target.style.color = isError ? "var(--red)" : "var(--khaki)";
}

function actionLabel(actionType) {
  return actionType === "deploy" ? "Розгортання" : "Згортання";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setConnected(isConnected) {
  elements.connectionStatus.textContent = isConnected ? "Online" : "Offline";
  elements.connectionStatus.classList.toggle("online", isConnected);
  elements.connectionStatus.classList.toggle("offline", !isConnected);
}

async function loadSession() {
  if (!db) {
    setConnected(false);
    setMessage(
      elements.authMessage,
      "Додайте URL та anon key у supabase-config.js, потім оновіть сторінку.",
      true
    );
    return;
  }

  setConnected(true);
  const { data } = await db.auth.getSession();
  state.user = data.session?.user || null;

  if (state.user) {
    await loadProfile();
    await loadAssets();
    await loadAreas();
    await loadRecords();
  }

  renderAuthState();
}

async function loadProfile() {
  setMessage(elements.formMessage, "");

  const { data, error } = await db
    .from("profiles")
    .select("id, email, role")
    .eq("id", state.user.id)
    .maybeSingle();

  if (!error && data) {
    state.profile = { ...data, role: normalizeRole(data.role) };
    return;
  }

  const { data: rpcRole, error: rpcError } = await db.rpc("get_my_role");
  if (!rpcError && rpcRole) {
    state.profile = {
      id: state.user.id,
      email: state.user.email,
      role: normalizeRole(rpcRole)
    };
    return;
  }

  const { data: emailData, error: emailError } = await db
    .from("profiles")
    .select("id, email, role")
    .eq("email", state.user.email)
    .maybeSingle();

  if (!emailError && emailData) {
    state.profile = { ...emailData, role: normalizeRole(emailData.role) };
    return;
  }

  state.profile = { role: "viewer", email: state.user.email };
  if (error || emailError) {
    setMessage(
      elements.formMessage,
      `Не вдалося прочитати роль профілю: ${(error || rpcError || emailError).message}`,
      true
    );
  }
}

async function loadRecords() {
  const { data, error } = await db
    .from("workflow_records")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    setMessage(elements.formMessage, error.message, true);
    return;
  }

  state.records = data || [];
  applyFilters();
}

async function loadAssets() {
  const { data, error } = await db.from("workflow_assets").select("id, name, type, variant").order("name");

  if (error) {
    setMessage(elements.formMessage, error.message, true);
    return;
  }

  state.assets = data || [];
  renderAssetOptions(elements.assetSelect.value);
}

function renderAssetOptions(selectedValue = "") {
  const options = [`<option value="" disabled ${selectedValue ? "" : "selected"}>Оберіть засіб</option>`].concat(
    state.assets.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`)
  );

  elements.assetSelect.innerHTML = options.join("");
  if (selectedValue) elements.assetSelect.value = selectedValue;
  updateAssetTitle();
}

function updateAssetTitle() {
  const selected = elements.assetSelect.options[elements.assetSelect.selectedIndex];
  elements.assetSelect.title = selected?.value ? selected.textContent : "";
}

async function loadAreas() {
  const { data, error } = await db.from("workflow_areas").select("id, name").order("name");

  if (error) {
    setMessage(elements.formMessage, error.message, true);
    return;
  }

  state.areas = data || [];
  renderAreaOptions(elements.areaSelect.value);
}

function renderAreaOptions(selectedValue = "") {
  const options = [`<option value="" disabled ${selectedValue ? "" : "selected"}>Оберіть район</option>`].concat(
    state.areas.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`)
  );

  elements.areaSelect.innerHTML = options.join("");
  if (selectedValue) elements.areaSelect.value = selectedValue;
  updateAreaTitle();
}

function ensureAreaOption(value) {
  if (!value) return;
  const exists = [...elements.areaSelect.options].some((option) => option.value === value);
  if (exists) return;

  const option = document.createElement("option");
  option.value = value;
  option.textContent = value;
  elements.areaSelect.append(option);
}

function updateAreaTitle() {
  const selected = elements.areaSelect.options[elements.areaSelect.selectedIndex];
  elements.areaSelect.title = selected?.value ? selected.textContent : "";
}

function ensureAssetOption(value) {
  if (!value) return;
  const exists = [...elements.assetSelect.options].some((option) => option.value === value);
  if (exists) return;

  const option = document.createElement("option");
  option.value = value;
  option.textContent = value;
  elements.assetSelect.append(option);
}

function renderAuthState() {
  const signedIn = Boolean(state.user);
  elements.authView.hidden = signedIn;
  elements.dashboardView.hidden = !signedIn;
  elements.logoutButton.hidden = !signedIn;
  elements.userRole.textContent = roleName();
  $("recordDate").value ||= todayISO();
  renderPermissions();
}

function renderPermissions() {
  const { canCreate, canEdit, canDelete } = permissions();
  elements.entryForm.classList.toggle("hidden-for-role", !canCreate);
  elements.addAssetButton.hidden = roleName() !== "admin";
  elements.addAreaButton.hidden = roleName() !== "admin";
  elements.rebMenu.hidden = !canCreate;
  if (!canCreate) closeRebMenu();
  document.querySelectorAll(".admin-only").forEach((node) => {
    node.classList.toggle("hidden-for-role", !canEdit && !canDelete);
  });
}

function applyFilters() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const action = elements.actionFilter.value;
  const from = elements.fromDate.value ? parseDate(elements.fromDate.value) : null;
  const to = elements.toDate.value ? parseDate(elements.toDate.value) : null;

  state.filteredRecords = state.records.filter((record) => {
    const recordDate = parseDate(record.date);
    const searchable = [
      record.asset,
      record.name,
      record.serial_number,
      record.area,
      record.note
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!query || searchable.includes(query)) &&
      (!action || record.action_type === action) &&
      (!from || recordDate >= from) &&
      (!to || recordDate <= to)
    );
  });

  renderDashboard();
}

function countByPeriod(records, predicate) {
  const selected = records.filter(predicate);
  return {
    total: selected.length,
    deploy: selected.filter((record) => record.action_type === "deploy").length,
    recover: selected.filter((record) => record.action_type === "recover").length
  };
}

function setPeriodMetric(prefix, data) {
  $(`${prefix}Total`).textContent = data.total;
  $(`${prefix}Deploy`).textContent = data.deploy;
  $(`${prefix}Recover`).textContent = data.recover;
}

function activeSerialCount(records) {
  const latestBySerial = new Map();

  [...records]
    .sort((a, b) => `${a.date} ${a.created_at}`.localeCompare(`${b.date} ${b.created_at}`))
    .forEach((record) => {
      latestBySerial.set(record.serial_number.toLowerCase(), record.action_type);
    });

  return [...latestBySerial.values()].filter((action) => action === "deploy").length;
}

function mostFrequent(records, key) {
  const counts = records.reduce((map, record) => {
    const value = record[key] || "-";
    map.set(value, (map.get(value) || 0) + 1);
    return map;
  }, new Map());

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
}

function renderDashboard() {
  const now = new Date();
  const today = todayISO();
  const weekStart = startOfWeek(now);
  const month = now.getMonth();
  const year = now.getFullYear();

  setPeriodMetric(
    "day",
    countByPeriod(state.records, (record) => record.date === today)
  );
  setPeriodMetric(
    "week",
    countByPeriod(state.records, (record) => parseDate(record.date) >= weekStart)
  );
  setPeriodMetric(
    "month",
    countByPeriod(state.records, (record) => {
      const date = parseDate(record.date);
      return date.getMonth() === month && date.getFullYear() === year;
    })
  );
  setPeriodMetric("all", countByPeriod(state.records, () => true));

  $("activeTotal").textContent = activeSerialCount(state.records);
  $("topArea").textContent = mostFrequent(state.filteredRecords, "area");
  $("topAsset").textContent = mostFrequent(state.filteredRecords, "asset");
  $("filteredTotal").textContent = state.filteredRecords.length;

  renderRecords();
}

function renderRecords() {
  const { canEdit, canDelete } = permissions();

  if (!state.filteredRecords.length) {
    elements.recordsBody.innerHTML = '<tr><td colspan="8" class="empty-state">Немає записів</td></tr>';
    return;
  }

  elements.recordsBody.innerHTML = state.filteredRecords
    .map((record) => {
      const actions = canEdit || canDelete
        ? `<td class="admin-only">
            <div class="row-actions">
              ${canEdit ? `<button class="icon-button" type="button" title="Редагувати" data-edit="${record.id}">&#9998;</button>` : ""}
              ${canDelete ? `<button class="icon-button danger" type="button" title="Видалити" data-delete="${record.id}">&#10005;</button>` : ""}
            </div>
          </td>`
        : '<td class="admin-only hidden-for-role"></td>';

      return `<tr>
        <td>${escapeHtml(formatDate(record.date))}</td>
        <td>${escapeHtml(record.asset)}</td>
        <td>${escapeHtml(record.name)}</td>
        <td>${escapeHtml(record.serial_number)}</td>
        <td>${escapeHtml(record.area)}</td>
        <td><span class="action-pill ${record.action_type}">${actionLabel(record.action_type)}</span></td>
        <td>${escapeHtml(record.note || "")}</td>
        ${actions}
      </tr>`;
    })
    .join("");

  renderPermissions();
}

function collectFormData() {
  return {
    date: $("recordDate").value,
    asset: $("asset").value.trim(),
    name: $("name").value.trim(),
    serial_number: $("serialNumber").value.trim(),
    area: $("area").value.trim(),
    action_type: $("actionType").value,
    note: $("note").value.trim() || null,
    created_by: state.user.id
  };
}

function resetForm() {
  elements.entryForm.reset();
  $("recordId").value = "";
  $("recordDate").value = todayISO();
  $("saveButton").textContent = "Зберегти запис";
  setMessage(elements.formMessage, "");
  updateAssetTitle();
  updateAreaTitle();
}

async function saveRecord(event) {
  event.preventDefault();

  if (!permissions().canCreate) {
    setMessage(elements.formMessage, "Недостатньо прав для створення записів.", true);
    return;
  }

  const id = $("recordId").value;
  const payload = collectFormData();
  const query = id
    ? db.from("workflow_records").update(payload).eq("id", id)
    : db.from("workflow_records").insert(payload);
  const { error } = await query;

  if (error) {
    setMessage(elements.formMessage, error.message, true);
    return;
  }

  setMessage(elements.formMessage, id ? "Запис оновлено." : "Запис збережено.");
  resetForm();
  await loadRecords();
}

function editRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;

  $("recordId").value = record.id;
  $("recordDate").value = record.date;
  ensureAssetOption(record.asset);
  $("asset").value = record.asset;
  updateAssetTitle();
  ensureAreaOption(record.area);
  $("area").value = record.area;
  updateAreaTitle();
  $("name").value = record.name;
  $("serialNumber").value = record.serial_number;
  $("actionType").value = record.action_type;
  $("note").value = record.note || "";
  $("saveButton").textContent = "Оновити запис";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteRecord(id) {
  if (!permissions().canDelete) return;
  const confirmed = window.confirm("Видалити запис?");
  if (!confirmed) return;

  const { error } = await db.from("workflow_records").delete().eq("id", id);
  if (error) {
    setMessage(elements.formMessage, error.message, true);
    return;
  }

  await loadRecords();
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!db) {
    setMessage(elements.authMessage, "Supabase ще не налаштовано.", true);
    return;
  }

  const { error } = await db.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });

  if (error) {
    setMessage(elements.authMessage, error.message, true);
    return;
  }

  setMessage(elements.authMessage, "");
  await loadSession();
});

elements.logoutButton.addEventListener("click", async () => {
  await db.auth.signOut();
  state.user = null;
  state.profile = null;
  state.records = [];
  state.assets = [];
  state.areas = [];
  renderAssetOptions();
  renderAreaOptions();
  renderAuthState();
});

elements.entryForm.addEventListener("submit", saveRecord);
elements.resetFormButton.addEventListener("click", resetForm);

function openAssetModal() {
  $("assetName").value = "";
  $("assetType").value = "";
  $("assetVariant").value = "";
  setMessage(elements.assetModalMessage, "");
  elements.assetModal.hidden = false;
  $("assetName").focus();
}

function closeAssetModal() {
  elements.assetModal.hidden = true;
}

elements.addAssetButton.addEventListener("click", openAssetModal);
elements.cancelAssetButton.addEventListener("click", closeAssetModal);

elements.assetModal.addEventListener("click", (event) => {
  if (event.target === elements.assetModal) closeAssetModal();
});

elements.assetForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("assetName").value.trim();
  if (!name) return;
  const type = $("assetType").value || null;
  const variant = $("assetVariant").value || null;

  const { error } = await db.from("workflow_assets").insert({ name, type, variant, created_by: state.user.id });
  if (error) {
    setMessage(elements.assetModalMessage, error.message, true);
    return;
  }

  closeAssetModal();
  await loadAssets();
  elements.assetSelect.value = name;
  updateAssetTitle();
});

elements.assetSelect.addEventListener("change", updateAssetTitle);

elements.addAreaButton.addEventListener("click", async () => {
  const input = window.prompt("Назва нового району:");
  const name = input?.trim();
  if (!name) return;

  const { error } = await db.from("workflow_areas").insert({ name, created_by: state.user.id });
  if (error) {
    setMessage(elements.formMessage, error.message, true);
    return;
  }

  await loadAreas();
  elements.areaSelect.value = name;
  updateAreaTitle();
});

elements.areaSelect.addEventListener("change", updateAreaTitle);

function openRebMenu() {
  elements.rebMenuList.hidden = false;
  elements.rebMenuButton.setAttribute("aria-expanded", "true");
}

function closeRebMenu() {
  elements.rebMenuList.hidden = true;
  elements.rebMenuButton.setAttribute("aria-expanded", "false");
}

elements.rebMenuButton.addEventListener("click", (event) => {
  event.stopPropagation();
  if (elements.rebMenuList.hidden) {
    openRebMenu();
  } else {
    closeRebMenu();
  }
});

elements.rebMenuList.addEventListener("click", (event) => {
  const item = event.target.closest(".nav-menu-item");
  if (!item) return;
  closeRebMenu();
  if (item.dataset.category === "far") window.location.href = "./reb-far.html";
});

document.addEventListener("click", (event) => {
  if (!elements.rebMenuList.hidden && !elements.rebMenu.contains(event.target)) {
    closeRebMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeRebMenu();
    closeAssetModal();
  }
});

[elements.searchInput, elements.actionFilter, elements.fromDate, elements.toDate].forEach((element) => {
  element.addEventListener("input", applyFilters);
});

elements.recordsBody.addEventListener("click", (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;

  if (editId) editRecord(editId);
  if (deleteId) deleteRecord(deleteId);
});

loadSession();
