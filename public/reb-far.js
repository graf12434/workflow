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
  assets: []
};

const roles = {
  admin: { canCreate: true, canEdit: true, canDelete: true },
  operator: { canCreate: true, canEdit: true, canDelete: false },
  viewer: { canCreate: false, canEdit: false, canDelete: false },
  guest: { canCreate: false, canEdit: false, canDelete: false }
};

const ownershipLabels = { company: "Майно роти", regiment: "Майно полка" };
const statusLabels = {
  ready: "Боєготовий",
  not_ready: "Небоєготовий",
  repair: "Ремонт",
  destroyed: "Знищений"
};

const $ = (id) => document.getElementById(id);

const elements = {
  rebFarView: $("rebFarView"),
  noAccessView: $("noAccessView"),
  noAccessMessage: $("noAccessMessage"),
  entryForm: $("entryForm"),
  logoutButton: $("logoutButton"),
  backToJournalButton: $("backToJournalButton"),
  resetFormButton: $("resetFormButton"),
  nameSelect: $("name"),
  formMessage: $("formMessage"),
  connectionStatus: $("connectionStatus"),
  userRole: $("userRole"),
  recordsBody: $("recordsBody"),
  nameFilter: $("nameFilter"),
  ownershipFilter: $("ownershipFilter"),
  statusFilter: $("statusFilter"),
  filteredTotal: $("filteredTotal")
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

function setMessage(target, text, isError = false) {
  target.textContent = text;
  target.style.color = isError ? "var(--red)" : "var(--khaki)";
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

function ownershipFilterValue() {
  return elements.ownershipFilter.value || "all";
}

function statusFilterValue() {
  return elements.statusFilter.value || "all";
}

async function loadSession() {
  if (!db) {
    setConnected(false);
    showNoAccess("Додайте URL та anon key у supabase-config.js, потім оновіть сторінку.");
    return;
  }

  setConnected(true);
  const { data } = await db.auth.getSession();
  state.user = data.session?.user || null;

  if (!state.user) {
    showNoAccess("Увійдіть у систему на головній сторінці, щоб переглянути цю сторінку.");
    return;
  }

  await loadProfile();
  elements.rebFarView.hidden = false;
  elements.noAccessView.hidden = true;
  elements.logoutButton.hidden = false;
  elements.userRole.textContent = roleName();
  renderPermissions();
  await loadAssets();
  await loadRecords();
}

async function loadAssets() {
  const { data, error } = await db
    .from("workflow_assets")
    .select("id, name")
    .eq("type", "long")
    .order("name");

  if (error) {
    setMessage(elements.formMessage, error.message, true);
    return;
  }

  state.assets = data || [];
  renderNameOptions(elements.nameSelect.value);
}

function renderNameOptions(selectedValue = "") {
  const options = [`<option value="" disabled ${selectedValue ? "" : "selected"}>Оберіть назву</option>`].concat(
    state.assets.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`)
  );

  elements.nameSelect.innerHTML = options.join("");
  if (selectedValue) elements.nameSelect.value = selectedValue;
}

function ensureNameOption(value) {
  if (!value) return;
  const exists = [...elements.nameSelect.options].some((option) => option.value === value);
  if (exists) return;

  const option = document.createElement("option");
  option.value = value;
  option.textContent = value;
  elements.nameSelect.append(option);
}

function showNoAccess(text) {
  elements.rebFarView.hidden = true;
  elements.noAccessView.hidden = false;
  setMessage(elements.noAccessMessage, text, true);
}

async function loadProfile() {
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
    state.profile = { id: state.user.id, email: state.user.email, role: normalizeRole(rpcRole) };
    return;
  }

  state.profile = { role: "viewer", email: state.user.email };
}

function renderPermissions() {
  const { canCreate, canEdit, canDelete } = permissions();
  elements.entryForm.classList.toggle("hidden-for-role", !canCreate);
  document.querySelectorAll(".admin-only").forEach((node) => {
    node.classList.toggle("hidden-for-role", !canEdit && !canDelete);
  });
}

async function loadRecords() {
  const { data, error } = await db
    .from("workflow_reb_far")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    setMessage(elements.formMessage, error.message, true);
    return;
  }

  state.records = data || [];
  renderNameFilterOptions();
  applyFilters();
}

function renderNameFilterOptions() {
  const selected = elements.nameFilter.value;
  const names = [...new Set(state.records.map((record) => record.name))].sort((a, b) =>
    a.localeCompare(b, "uk")
  );

  elements.nameFilter.innerHTML = ['<option value="">Усі назви</option>']
    .concat(names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`))
    .join("");

  if (names.includes(selected)) elements.nameFilter.value = selected;
}

function applyFilters() {
  const name = elements.nameFilter.value;
  const ownership = ownershipFilterValue();
  const status = statusFilterValue();

  state.filteredRecords = state.records.filter((record) => {
    return (
      (!name || record.name === name) &&
      (ownership === "all" || record.ownership === ownership) &&
      (status === "all" || record.status === status)
    );
  });

  renderRecords();
}

function renderRecords() {
  const { canEdit, canDelete } = permissions();
  elements.filteredTotal.textContent = state.filteredRecords.length;

  if (!state.filteredRecords.length) {
    elements.recordsBody.innerHTML = '<tr><td colspan="6" class="empty-state">Немає записів</td></tr>';
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
        <td>${escapeHtml(record.name)}</td>
        <td>${escapeHtml(record.serial_number)}</td>
        <td>${escapeHtml(ownershipLabels[record.ownership] || record.ownership)}</td>
        <td><span class="status-pill ${record.status}">${escapeHtml(statusLabels[record.status] || record.status)}</span></td>
        <td>${escapeHtml(record.note || "")}</td>
        ${actions}
      </tr>`;
    })
    .join("");

  renderPermissions();
}

function collectFormData() {
  return {
    name: $("name").value.trim(),
    serial_number: $("serialNumber").value.trim(),
    ownership: $("ownership").value,
    status: $("status").value,
    note: $("note").value.trim() || null,
    created_by: state.user.id
  };
}

function resetForm() {
  elements.entryForm.reset();
  $("recordId").value = "";
  renderNameOptions();
  $("saveButton").textContent = "Зберегти засіб";
  setMessage(elements.formMessage, "");
}

async function saveRecord(event) {
  event.preventDefault();

  if (!permissions().canCreate) {
    setMessage(elements.formMessage, "Недостатньо прав для додавання засобів.", true);
    return;
  }

  const id = $("recordId").value;
  const payload = collectFormData();
  const query = id
    ? db.from("workflow_reb_far").update(payload).eq("id", id)
    : db.from("workflow_reb_far").insert(payload);
  const { error } = await query;

  if (error) {
    setMessage(elements.formMessage, error.message, true);
    return;
  }

  setMessage(elements.formMessage, id ? "Засіб оновлено." : "Засіб збережено.");
  resetForm();
  await loadRecords();
}

function editRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;

  $("recordId").value = record.id;
  ensureNameOption(record.name);
  $("name").value = record.name;
  $("serialNumber").value = record.serial_number;
  $("ownership").value = record.ownership;
  $("status").value = record.status;
  $("note").value = record.note || "";
  $("saveButton").textContent = "Оновити засіб";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteRecord(id) {
  if (!permissions().canDelete) return;
  const confirmed = window.confirm("Видалити засіб?");
  if (!confirmed) return;

  const { error } = await db.from("workflow_reb_far").delete().eq("id", id);
  if (error) {
    setMessage(elements.formMessage, error.message, true);
    return;
  }

  await loadRecords();
}

elements.entryForm.addEventListener("submit", saveRecord);
elements.resetFormButton.addEventListener("click", resetForm);

elements.logoutButton.addEventListener("click", async () => {
  await db.auth.signOut();
  window.location.href = "./index.html";
});

elements.backToJournalButton.addEventListener("click", () => {
  window.location.href = "./index.html";
});

elements.nameFilter.addEventListener("change", applyFilters);
elements.ownershipFilter.addEventListener("change", applyFilters);
elements.statusFilter.addEventListener("change", applyFilters);

elements.recordsBody.addEventListener("click", (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;

  if (editId) editRecord(editId);
  if (deleteId) deleteRecord(deleteId);
});

loadSession();
