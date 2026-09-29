// Власний календар українською замість системного: браузерний не стилізується і бере мову з ОС.
// Оригінальний input[type="date"] лишається джерелом значення (YYYY-MM-DD) і лише ховається,
// тому скрипти сторінок читають і пишуть .value як раніше.
(function () {
  const MONTHS = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
  const MONTHS_GENITIVE = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
  const MONTHS_SHORT = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];
  const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
  const YEARS_PER_PAGE = 12;

  const calendarIcon =
    '<svg class="date-field-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>';
  const chevron = (d) =>
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

  const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const fromISO = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  };
  const sameDay = (a, b) =>
    Boolean(a && b) && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

  // Зсув на місяці без "перескоку": 31 січня + 1 місяць = 28/29 лютого, а не 3 березня
  function addMonths(date, delta) {
    const target = new Date(date.getFullYear(), date.getMonth() + delta, 1);
    target.setDate(Math.min(date.getDate(), daysInMonth(target.getFullYear(), target.getMonth())));
    return target;
  }

  const popup = document.createElement("div");
  popup.className = "dp";
  popup.hidden = true;
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Вибір дати");
  popup.innerHTML = `
    <div class="dp-head">
      <button class="dp-nav" type="button" data-step="-1">${chevron("m15 18-6-6 6-6")}</button>
      <button class="dp-title" type="button"></button>
      <button class="dp-nav" type="button" data-step="1">${chevron("m9 18 6-6-6-6")}</button>
    </div>
    <div class="dp-body"></div>
    <div class="dp-foot">
      <button class="dp-link" type="button" data-action="clear">Очистити</button>
      <button class="dp-link dp-link-accent" type="button" data-action="today">Сьогодні</button>
    </div>`;
  document.body.append(popup);

  const titleButton = popup.querySelector(".dp-title");
  const body = popup.querySelector(".dp-body");
  const [prevButton, nextButton] = popup.querySelectorAll(".dp-nav");
  const clearButton = popup.querySelector('[data-action="clear"]');

  // current: { input, trigger, view: "days" | "months" | "years", cursor: Date }
  let current = null;

  function render() {
    const { input, view, cursor } = current;
    const selected = fromISO(input.value);
    const today = new Date();
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    let html = "";

    popup.dataset.view = view;

    if (view === "days") {
      titleButton.textContent = `${MONTHS[month]} ${year}`;
      titleButton.setAttribute("aria-label", `${MONTHS[month]} ${year}, обрати місяць`);
      prevButton.setAttribute("aria-label", "Попередній місяць");
      nextButton.setAttribute("aria-label", "Наступний місяць");

      html += WEEKDAYS.map((day, index) => `<span class="dp-weekday${index > 4 ? " is-weekend" : ""}">${day}</span>`).join("");

      const offset = (new Date(year, month, 1).getDay() + 6) % 7;
      const start = new Date(year, month, 1 - offset);
      for (let i = 0; i < 42; i += 1) {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const classes = ["dp-cell", "dp-day"];
        if (date.getMonth() !== month) classes.push("is-outside");
        if ((i % 7) > 4) classes.push("is-weekend");
        if (sameDay(date, today)) classes.push("is-today");
        if (sameDay(date, selected)) classes.push("is-selected");
        const focus = sameDay(date, cursor);
        html += `<button class="${classes.join(" ")}" type="button" data-value="${toISO(date)}" tabindex="${focus ? 0 : -1}"
          aria-label="${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}"${sameDay(date, selected) ? ' aria-pressed="true"' : ""}>${date.getDate()}</button>`;
      }
    } else if (view === "months") {
      titleButton.textContent = String(year);
      titleButton.setAttribute("aria-label", `${year}, обрати рік`);
      prevButton.setAttribute("aria-label", "Попередній рік");
      nextButton.setAttribute("aria-label", "Наступний рік");

      html = MONTHS_SHORT.map((name, index) => {
        const classes = ["dp-cell", "dp-month"];
        if (year === today.getFullYear() && index === today.getMonth()) classes.push("is-today");
        if (selected && year === selected.getFullYear() && index === selected.getMonth()) classes.push("is-selected");
        return `<button class="${classes.join(" ")}" type="button" data-month="${index}" tabindex="${index === month ? 0 : -1}" aria-label="${MONTHS[index]} ${year}">${name}</button>`;
      }).join("");
    } else {
      const first = year - (year % YEARS_PER_PAGE);
      titleButton.textContent = `${first} – ${first + YEARS_PER_PAGE - 1}`;
      titleButton.removeAttribute("aria-label");
      prevButton.setAttribute("aria-label", "Попередні роки");
      nextButton.setAttribute("aria-label", "Наступні роки");

      for (let value = first; value < first + YEARS_PER_PAGE; value += 1) {
        const classes = ["dp-cell", "dp-year"];
        if (value === today.getFullYear()) classes.push("is-today");
        if (selected && value === selected.getFullYear()) classes.push("is-selected");
        html += `<button class="${classes.join(" ")}" type="button" data-year="${value}" tabindex="${value === year ? 0 : -1}">${value}</button>`;
      }
    }

    titleButton.disabled = view === "years";
    body.innerHTML = html;
  }

  function focusCursor() {
    body.querySelector('[tabindex="0"]')?.focus();
  }

  function position() {
    const rect = current.trigger.getBoundingClientRect();
    const width = popup.offsetWidth;
    const height = popup.offsetHeight;
    const margin = 8;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const fitsBelow = rect.bottom + 6 + height <= viewportHeight - margin;
    const top = fitsBelow || rect.top - 6 - height < margin ? rect.bottom + 6 : rect.top - 6 - height;
    const left = Math.min(Math.max(rect.left, margin), viewportWidth - width - margin);

    popup.style.top = `${Math.max(top, margin)}px`;
    popup.style.left = `${left}px`;
    popup.classList.toggle("is-above", top < rect.top);
  }

  function open(input, trigger) {
    if (current?.input === input) return close(true);
    current = { input, trigger, view: "days", cursor: fromISO(input.value) || new Date() };
    clearButton.hidden = input.required;
    render();
    popup.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    trigger.closest(".date-field").classList.add("is-open");
    position();
    focusCursor();
  }

  function close(returnFocus) {
    if (!current) return;
    const { trigger } = current;
    popup.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    trigger.closest(".date-field").classList.remove("is-open");
    current = null;
    if (returnFocus) trigger.focus();
  }

  function commit(value) {
    const { input } = current;
    close(true);
    if (input.value === value) return;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function shift(step) {
    const { view, cursor } = current;
    if (view === "days") current.cursor = addMonths(cursor, step);
    else if (view === "months") current.cursor = addMonths(cursor, step * 12);
    else current.cursor = addMonths(cursor, step * 12 * YEARS_PER_PAGE);
    render();
  }

  // Стрілки рухають курсор по сітці: у днях — 7 колонок, у місяцях і роках — 3
  function moveCursor(key, shiftKey) {
    const { view, cursor } = current;
    const columns = view === "days" ? 7 : 3;
    const deltas = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };

    if (view === "days") {
      if (key in deltas) current.cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + deltas[key]);
      else if (key === "Home") current.cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - ((cursor.getDay() + 6) % 7));
      else if (key === "End") current.cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + (6 - ((cursor.getDay() + 6) % 7)));
      else if (key === "PageUp") current.cursor = addMonths(cursor, shiftKey ? -12 : -1);
      else if (key === "PageDown") current.cursor = addMonths(cursor, shiftKey ? 12 : 1);
      else return false;
    } else if (key in deltas) {
      current.cursor = addMonths(cursor, deltas[key] * (view === "months" ? 1 : 12));
    } else {
      return false;
    }

    render();
    focusCursor();
    return true;
  }

  titleButton.addEventListener("click", () => {
    current.view = current.view === "days" ? "months" : "years";
    render();
    focusCursor();
  });

  prevButton.addEventListener("click", () => shift(-1));
  nextButton.addEventListener("click", () => shift(1));

  body.addEventListener("click", (event) => {
    const cell = event.target.closest(".dp-cell");
    if (!cell) return;

    if (cell.dataset.value) {
      commit(cell.dataset.value);
    } else if (cell.dataset.month) {
      const month = Number(cell.dataset.month);
      const { cursor } = current;
      current.cursor = new Date(cursor.getFullYear(), month, Math.min(cursor.getDate(), daysInMonth(cursor.getFullYear(), month)));
      current.view = "days";
      render();
      focusCursor();
    } else if (cell.dataset.year) {
      const year = Number(cell.dataset.year);
      const { cursor } = current;
      current.cursor = new Date(year, cursor.getMonth(), Math.min(cursor.getDate(), daysInMonth(year, cursor.getMonth())));
      current.view = "months";
      render();
      focusCursor();
    }
  });

  popup.querySelector(".dp-foot").addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "clear") commit("");
    if (action === "today") commit(toISO(new Date()));
  });

  popup.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (current.view !== "days") {
        current.view = current.view === "years" ? "months" : "days";
        render();
        focusCursor();
      } else {
        close(true);
      }
      return;
    }

    if (event.target.closest(".dp-body") && moveCursor(event.key, event.shiftKey)) {
      event.preventDefault();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!current || popup.contains(event.target) || current.trigger.contains(event.target)) return;
    close(false);
  });

  popup.addEventListener("focusout", (event) => {
    if (current && event.relatedTarget && !popup.contains(event.relatedTarget) && event.relatedTarget !== current.trigger) {
      close(false);
    }
  });

  window.addEventListener("resize", () => current && position());
  document.addEventListener("scroll", () => current && position(), true);

  function enhance(input) {
    const field = document.createElement("div");
    field.className = "date-field";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "date-field-trigger";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = `<span class="date-field-text"></span>${calendarIcon}`;
    if (input.placeholder && !input.closest("label")) trigger.setAttribute("aria-label", input.placeholder);

    const text = trigger.querySelector(".date-field-text");
    const placeholder = input.placeholder || "дд.мм.рррр";

    const sync = () => {
      const date = fromISO(input.value);
      text.textContent = date ? `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}` : placeholder;
      field.classList.toggle("is-empty", !date);
    };

    input.before(field);
    field.append(trigger, input);
    input.classList.add("date-field-native");
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");

    Object.defineProperty(input, "value", {
      configurable: true,
      get() {
        return nativeValue.get.call(this);
      },
      set(value) {
        nativeValue.set.call(this, value);
        sync();
      }
    });

    input.addEventListener("input", sync);
    input.addEventListener("change", sync);
    input.form?.addEventListener("reset", () => setTimeout(sync));
    // Якщо браузер сфокусує приховане поле (незаповнене обов'язкове), відкриваємо календар замість нього
    input.addEventListener("focus", () => open(input, trigger));
    trigger.addEventListener("click", () => open(input, trigger));

    sync();
  }

  document.querySelectorAll('input[type="date"]').forEach(enhance);
})();
