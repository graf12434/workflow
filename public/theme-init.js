// Тема оформлення до першого малювання сторінки (без спалаху іншої теми).
// Окремим файлом, а не вбудованим скриптом: політика безпеки (CSP) дозволяє лише файли сайту.
try {
  var savedTheme = localStorage.getItem("wf-theme") || "machinarium";
  if (savedTheme !== "graphite") document.documentElement.dataset.theme = savedTheme;
} catch (error) {
  document.documentElement.dataset.theme = "machinarium";
}
