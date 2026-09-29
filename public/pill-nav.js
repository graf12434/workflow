// Pill-навігація: індикатор ковзає за курсором і повертається до пункту поточної сторінки.
// Пункти ховаються/показуються скриптами сторінок (атрибут hidden), тому позиція
// перераховується при кожній такій зміні.
document.querySelectorAll("[data-pill-nav]").forEach((nav) => {
  const links = [...nav.querySelectorAll(".pill-nav-link")];
  const active = links.find((link) => link.classList.contains("is-active")) || links[0];
  if (!active) return;

  const moveTo = (link) => {
    nav.style.setProperty("--x", `${link.offsetLeft}px`);
    nav.style.setProperty("--w", `${link.offsetWidth}px`);
    links.forEach((item) => item.classList.toggle("is-current", item === link));
  };

  const reset = () => moveTo(active);

  // Меню з одним видимим пунктом ховається; на вузькому екрані активний пункт прокручується у видиму зону
  const refresh = () => {
    nav.classList.toggle("is-solo", links.filter((link) => !link.hidden).length < 2);
    reset();
    if (nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    }
  };

  links.forEach((link) => {
    link.addEventListener("mouseenter", () => moveTo(link));
    link.addEventListener("focus", () => moveTo(link));
  });

  nav.addEventListener("mouseleave", reset);
  nav.addEventListener("focusout", (event) => {
    if (!nav.contains(event.relatedTarget)) reset();
  });
  window.addEventListener("resize", reset);
  document.fonts?.ready.then(refresh);
  new MutationObserver(refresh).observe(nav, { attributes: true, subtree: true, attributeFilter: ["hidden"] });

  refresh();
  requestAnimationFrame(() => nav.classList.add("is-ready"));
});
