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
  filteredRecords: []
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
  authMessage: $("authMessage"),
  formMessage: $("formMessage"),
  connectionStatus: $("connectionStatus"),
  userRole: $("userRole"),
  roleDebug: $("roleDebug"),
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
    await loadRecords();
  }

  renderAuthState();
}

async function loadProfile() {
  setMessage(elements.formMessage, "");
  elements.roleDebug.hidden = true;
  elements.roleDebug.textContent = "";

  const { data, error } = await db
    .from("profiles")
    .select("id, email, role")
    .eq("id", state.user.id)
    .maybeSingle();

  if (!error && data) {
    state.profile = { ...data, role: normalizeRole(data.role) };
    renderRoleDebug("id", data);
    return;
  }

  const { data: rpcRole, error: rpcError } = await db.rpc("get_my_role");
  if (!rpcError && rpcRole) {
    state.profile = {
      id: state.user.id,
      email: state.user.email,
      role: normalizeRole(rpcRole)
    };
    renderRoleDebug("rpc", state.profile);
    return;
  }

  const { data: emailData, error: emailError } = await db
    .from("profiles")
    .select("id, email, role")
    .eq("email", state.user.email)
    .maybeSingle();

  if (!emailError && emailData) {
    state.profile = { ...emailData, role: normalizeRole(emailData.role) };
    renderRoleDebug("email", emailData);
    return;
  }

  state.profile = { role: "viewer", email: state.user.email };
  renderRoleDebug("fallback", {
    id: state.user.id,
    email: state.user.email,
    role: "viewer"
  });
  if (error || emailError) {
    setMessage(
      elements.formMessage,
      `Не вдалося прочитати роль профілю: ${(error || rpcError || emailError).message}`,
      true
    );
  }
}

function renderRoleDebug(source, profile) {
  elements.roleDebug.hidden = false;
  elements.roleDebug.textContent = `${source}: ${profile.email || state.user.email} / ${profile.id || state.user.id}`;
  console.info("Workflow profile", {
    source,
    authUser: { id: state.user.id, email: state.user.email },
    profile
  });
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
              ${canEdit ? `<button class="icon-button" type="button" data-edit="${record.id}">Edit</button>` : ""}
              ${canDelete ? `<button class="icon-button" type="button" data-delete="${record.id}">Del</button>` : ""}
            </div>
          </td>`
        : '<td class="admin-only hidden-for-role"></td>';

      return `<tr>
        <td>${escapeHtml(record.date)}</td>
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
  $("asset").value = record.asset;
  $("name").value = record.name;
  $("serialNumber").value = record.serial_number;
  $("area").value = record.area;
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
  renderAuthState();
});

elements.entryForm.addEventListener("submit", saveRecord);
elements.resetFormButton.addEventListener("click", resetForm);

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
