(() => {
  "use strict";

  const storageKey = "shtab-prototype-v1";
  const demoProfile = { age: "25", height: "180", weight: "78", experience: "beginner", goal: "fitness", days: "3", minutes: "45", equipment: "dumbbells" };
  const minutesOptions = [20, 30, 45, 60];
  const equipmentNames = { dumbbells: "Гантели", gym: "Тренажёрный зал", bodyweight: "Собственный вес" };
  const exerciseOptions = {
    dumbbells: [
      ["Присед с гантелью", 10],
      ["Жим гантелей лёжа", 8],
      ["Тяга гантели в наклоне", 10]
    ],
    gym: [
      ["Жим ногами", 30],
      ["Жим гантелей лёжа", 8],
      ["Тяга верхнего блока", 20]
    ],
    bodyweight: [
      ["Присед без веса", 0],
      ["Отжимания", 0],
      ["Подъём рук лёжа", 0]
    ]
  };
  const agents = [
    { name: "Тренер", initial: "Т", body: "Собирает план под цель, опыт и доступный инвентарь." },
    { name: "Напарник", initial: "Н", body: "Ведёт по тренировке и записывает подходы." },
    { name: "Аналитик", initial: "А", body: "Показывает, что изменилось по записям в журнале." }
  ];
  const views = ["today", "profile", "workout", "progress"];
  const profileForm = document.querySelector("#profile-form");
  const status = document.querySelector("#status");
  const dialog = document.querySelector("#dialog");
  const heroAction = document.querySelector("#hero-action");
  const todayContent = document.querySelector("#today-content");
  const todayView = document.querySelector("#view-today");
  const dateLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
  const dayLabel = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });

  let selectedView = "today";
  let timerTick;
  let fillingDemo = false;
  let storageAvailable = true;
  const defaults = { profile: null, override: null, workout: null, history: [], demo: false };
  let state = { ...defaults };
  try {
    const data = JSON.parse(localStorage.getItem(storageKey));
    if (data && Array.isArray(data.history)) state = { ...defaults, ...data };
  } catch {
    storageAvailable = false;
  }

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      storageAvailable = false;
    }
  }

  function announce(message) {
    status.textContent = message + (storageAvailable ? "" : " Запись останется в памяти до закрытия страницы.");
  }

  function node(tag, className, ...children) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    for (const child of children) {
      if (child !== undefined && child !== null) element.append(child);
    }
    return element;
  }

  function button(label, action, style = "secondary") {
    const element = node("button", "button " + style, label);
    element.type = "button";
    element.addEventListener("click", action);
    return element;
  }

  function routeLink(label, route, style = "secondary") {
    const link = node("a", "button " + style, label);
    link.href = "#" + route;
    return link;
  }

  function sectionLabel(text, heading, description) {
    return node("div", "view-heading",
      node("p", "eyebrow", text),
      node("h1", "", heading),
      node("p", "muted", description));
  }

  function panel(className, ...children) {
    return node("section", "panel " + className, ...children);
  }

  function note(label, text) {
    return panel("agent-note", node("p", "eyebrow", label), node("p", "", text));
  }

  function formatCount(number, words) {
    const last = number % 10;
    const lastTwo = number % 100;
    const word = lastTwo >= 11 && lastTwo <= 14 ? words[2] : last === 1 ? words[0] : last >= 2 && last <= 4 ? words[1] : words[2];
    return number + " " + word;
  }

  const exerciseCount = number => formatCount(number, ["упражнение", "упражнения", "упражнений"]);
  const setCount = number => formatCount(number, ["подход", "подхода", "подходов"]);

  function sessionPlan() {
    const minutes = Number(state.override?.minutes ?? state.profile?.minutes);
    const equipment = state.override?.equipment ?? state.profile?.equipment;
    const planMinutes = minutesOptions.includes(minutes) ? minutes : 45;
    const planEquipment = Object.hasOwn(equipmentNames, equipment) ? equipment : "dumbbells";
    const exercises = exerciseOptions[planEquipment]
      .slice(0, planMinutes === 20 ? 2 : 3)
      .map(([name, demoWeight]) => ({ name, demoWeight, sets: 3, reps: 10, rest: 60 }));
    return { name: "Всё тело", minutes: planMinutes, equipment: planEquipment, exercises };
  }

  function renderTeam() {
    document.querySelector("#agent-grid").replaceChildren(...agents.map(agent =>
      node("article", "agent-card",
        node("span", "agent-badge", agent.initial), node("h3", "", agent.name),
        node("p", "agent-body", agent.body))));
  }

  function renderToday() {
    const showingPlan = Boolean(state.profile);
    const hero = heroAction.closest(".hero");
    if (hero) hero.hidden = showingPlan;
    todayView.classList.toggle("has-plan", showingPlan);
    todayView.setAttribute("aria-labelledby", showingPlan ? "plan-heading" : "today-heading");
    todayContent.replaceChildren();
    if (!showingPlan) return;

    const plan = state.workout?.plan ?? sessionPlan();
    const summary = plan.minutes + " минут · " + exerciseCount(plan.exercises.length) + " · " + equipmentNames[plan.equipment];
    const titleCard = panel("plan-card",
      node("p", "eyebrow", "По плану"),
      node("h2", "", plan.name),
      node("p", "muted", summary),
      node("div", "actions",
        button(state.workout ? "Продолжить тренировку" : "Начать тренировку", startWorkout, "primary"),
        state.workout ? null : button("Пересобрать тренировку", openPlanDialog)));
    const entries = node("ul", "inline-list", ...plan.exercises.map(exercise =>
      node("li", "",
        node("div", "", node("strong", "", exercise.name), node("p", "muted", "Отдых " + exercise.rest + " сек")),
        node("span", "", exercise.sets + " × " + exercise.reps))));
    const exerciseList = panel("exercise-list", node("h2", "", "Упражнения"), entries);
    const coachNote = state.override
      ? (plan.minutes === 20 ? "Сократил занятие до двух упражнений. Подходы, которые ты запишешь, останутся в журнале." : "План обновлён с учётом доступного времени и инвентаря.")
      : "На сегодня " + exerciseCount(plan.exercises.length) + ". Условия занятия можно изменить.";
    const grid = node("div", "workout-grid",
      node("div", "content-stack", titleCard, exerciseList, note("Тренер", coachNote)));
    const heading = sectionLabel("План тренировок", "Сегодня", "Программа и журнал в одном месте.");
    heading.querySelector("h1").id = "plan-heading";
    todayContent.append(heading, grid);
  }

  function fillProfile(values) {
    for (const [name, value] of Object.entries(values || {})) {
      const input = profileForm.elements.namedItem(name);
      if (input) input.value = value;
    }
  }

  function profileData() {
    return Object.fromEntries(new FormData(profileForm));
  }

  profileForm.addEventListener("submit", event => {
    event.preventDefault();
    state.profile = profileData();
    state.demo ||= fillingDemo;
    state.override = null;
    fillingDemo = false;
    persist();
    announce("Профиль сохранён. План готов.");
    goTo("today");
  });

  document.querySelector("#demo-profile").addEventListener("click", () => {
    fillingDemo = true;
    fillProfile(demoProfile);
    announce("Поля заполнены примером. Сохрани профиль, чтобы открыть план.");
  });

  function selectField(title, name, items, selected) {
    const select = node("select", "");
    select.name = name;
    for (const [value, text] of items) {
      const option = node("option", "", text);
      option.value = value;
      select.append(option);
    }
    select.value = selected;
    return node("label", "", title, select);
  }

  function openPlanDialog() {
    const plan = sessionPlan();
    const title = node("h2", "", "Пересобрать тренировку");
    title.id = "dialog-title";
    const form = node("form", "",
      title,
      node("p", "muted", "Укажи время и инвентарь для следующего занятия."),
      node("div", "field-grid",
        selectField("Время занятия", "minutes", minutesOptions.map(time => [time, time + " минут"]), 20),
        selectField("Инвентарь", "equipment", Object.entries(equipmentNames), plan.equipment)));
    const apply = node("button", "button primary", "Применить");
    apply.type = "submit";
    form.append(node("div", "dialog-actions", apply, button("Отмена", () => dialog.close())));
    form.addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(form);
      state.override = { minutes: Number(data.get("minutes")), equipment: data.get("equipment") };
      persist();
      dialog.close();
      renderToday();
      focusHeading();
      announce("План обновлён. Время занятия " + state.override.minutes + " минут.");
    });
    dialog.replaceChildren(form);
    dialog.showModal();
  }

  function startWorkout() {
    if (!state.workout) {
      state.workout = {
        plan: sessionPlan(),
        index: 0,
        startedAt: Date.now(),
        restUntil: null,
        entries: {}
      };
      persist();
    }
    goTo("workout");
  }

  function inputForRow(id, label, value, max, step) {
    const input = node("input", "set-input");
    input.type = "number";
    input.id = id;
    input.setAttribute("aria-label", label);
    input.min = step === "1" ? "1" : "0";
    input.max = max;
    input.step = step;
    input.inputMode = step === "1" ? "numeric" : "decimal";
    input.required = true;
    input.value = value;
    return input;
  }

  function renderSet(workout, exercise, index, row) {
    const key = index + ":" + row;
    const existing = workout.entries[key];
    const defaults = state.demo ? exercise.demoWeight : workout.plan.equipment === "bodyweight" ? 0 : "";
    const weight = inputForRow("weight-" + row, "Вес, кг, подход " + (row + 1), existing?.weight ?? defaults, "500", "0.1");
    const reps = inputForRow("reps-" + row, "Повторы, подход " + (row + 1), existing?.reps ?? exercise.reps, "100", "1");
    const action = node("button", "button secondary", existing ? "Готово" : "Записать");
    action.type = "submit";
    const form = node("form", "set-row", node("span", "set-tag", String(row + 1)), weight, reps, action);
    if (existing) {
      form.classList.add("is-saved");
      action.setAttribute("aria-label", "Обновить подход " + (row + 1));
    } else action.setAttribute("aria-label", "Записать подход " + (row + 1));

    form.addEventListener("submit", event => {
      event.preventDefault();
      workout.entries[key] = { name: exercise.name, weight: Number(weight.value), reps: Number(reps.value) };
      workout.restUntil = Date.now() + exercise.rest * 1000;
      persist();
      form.classList.add("is-saved");
      action.textContent = "Готово";
      action.setAttribute("aria-label", "Обновить подход " + (row + 1));
      updateTimer();
      announce("Подход " + (row + 1) + " записан.");
    });
    return form;
  }

  function updateTimer() {
    const value = document.querySelector("#timer-value");
    const caption = document.querySelector("#timer-caption");
    if (!value || !caption || !state.workout) return;
    const until = state.workout.restUntil;
    const rest = state.workout.plan.exercises[state.workout.index].rest;
    const seconds = until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : rest;
    const display = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
    if (value.textContent !== display) value.textContent = display;
    const message = !until ? "Запиши подход, чтобы запустить таймер." : seconds ? "Таймер запустился после записи подхода." : "Время отдыха закончилось.";
    if (caption.textContent !== message) caption.textContent = message;
  }

  function renderWorkout() {
    const content = document.querySelector("#workout-content");
    const subtitle = document.querySelector("#workout-subtitle");
    const workout = state.workout;
    if (!workout) {
      subtitle.textContent = "";
      content.replaceChildren(panel("empty-state", node("h2", "", "Тренировка ещё не началась"),
        routeLink(state.profile ? "Открыть план" : "Настроить профиль", state.profile ? "today" : "profile", "primary")));
      return;
    }
    const { plan, index } = workout;
    const exercise = plan.exercises[index];
    subtitle.textContent = plan.name + " · " + plan.minutes + " минут";
    const active = panel("exercise-card",
      node("p", "eyebrow", "Упражнение " + (index + 1) + " из " + plan.exercises.length),
      node("h2", "", exercise.name), node("p", "muted", exercise.sets + " подхода по " + exercise.reps + " повторов"));
    const table = node("div", "set-table",
      node("div", "set-row set-head", ...["Подход", "Вес, кг", "Повторы", ""].map(label => node("span", "", label))));
    for (let row = 0; row < exercise.sets; row++) table.append(renderSet(workout, exercise, index, row));
    const setPanel = panel("sets-panel", node("h2", "", "Подходы"), table);
    const actions = node("div", "actions");
    if (index > 0) actions.append(button("Предыдущее упражнение", () => changeExercise(-1)));
    if (index < plan.exercises.length - 1) actions.append(button("Следующее упражнение", () => changeExercise(1)));
    actions.append(button("Завершить тренировку", finishWorkout, "primary"));
    const value = node("p", "timer-value");
    value.id = "timer-value";
    const timerCaption = node("p", "muted");
    timerCaption.id = "timer-caption";
    const timer = panel("timer", node("p", "eyebrow", "Таймер отдыха"), value, timerCaption);
    content.replaceChildren(node("div", "workout-grid", node("div", "content-stack", active, setPanel, actions), timer));
    updateTimer();
  }

  function changeExercise(delta) {
    state.workout.index += delta;
    persist();
    renderWorkout();
    document.querySelector(".exercise-card h2").setAttribute("tabindex", "-1");
    document.querySelector(".exercise-card h2").focus();
  }

  function finishWorkout() {
    const workout = state.workout;
    const entries = Object.values(workout.entries);
    if (!entries.length) {
      announce("Запиши хотя бы один подход, чтобы сохранить тренировку.");
      document.querySelector("#weight-0")?.focus();
      return;
    }
    state.history.unshift({
      name: workout.plan.name,
      date: Date.now(),
      sets: entries.length,
      minutes: Math.max(1, Math.round((Date.now() - workout.startedAt) / 60000)),
      entries
    });
    state.workout = null;
    state.override = null;
    persist();
    announce("Тренировка сохранена. Записано " + setCount(entries.length) + ".");
    goTo("progress");
  }

  function dateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  function examples() {
    return [
      { name: "Всё тело", sets: 6, minutes: 33, date: +dateDaysAgo(1) },
      { name: "Силовая", sets: 9, minutes: 42, date: +dateDaysAgo(3) },
      { name: "Всё тело", sets: 7, minutes: 33, date: +dateDaysAgo(5) }
    ].map(entry => ({ ...entry, example: true }));
  }

  function makeChart(rows, hint) {
    const dates = Array.from({ length: 7 }, (_, index) => dateDaysAgo(6 - index));
    const values = dates.map(date => rows
      .filter(row => new Date(row.date).toDateString() === date.toDateString())
      .reduce((sum, row) => sum + row.sets, 0));
    const max = Math.max(1, ...values);
    const columns = values.map((count, index) => {
      const label = dayLabel.format(dates[index]);
      const bar = node("span", "chart-bar" + (count ? "" : " is-zero"));
      bar.style.setProperty("--bar-height", count / max * 100 + "%");
      bar.setAttribute("aria-hidden", "true");
      const column = node("li", "chart-column",
        node("span", "chart-value", String(count)), node("span", "chart-track", bar), node("span", "", label));
      column.setAttribute("aria-label", label + ": " + setCount(count));
      return column;
    });
    return panel("chart-panel", node("h2", "", "Подходы по дням"), node("p", "muted", hint),
      node("ol", "chart-bars", ...columns));
  }

  function renderProgress() {
    const showExamples = state.demo || !state.history.length;
    const rows = showExamples ? [...state.history, ...examples()] : state.history;
    const summary = [
      ["Тренировки", rows.length],
      ["Подходы", rows.reduce((sum, row) => sum + row.sets, 0)],
      ["Время", rows.reduce((sum, row) => sum + row.minutes, 0) + " мин"]
    ];
    const metrics = node("div", "progress-grid", ...summary.map(([name, value]) =>
      panel("metric-card", node("p", "muted", name), node("strong", "", String(value)))));
    const history = panel("history-panel", node("h2", "", "История"),
      node("ul", "history-list", ...rows.map(row => node("li", "history-row",
        node("strong", "", row.name),
        node("p", "muted", dateLabel.format(row.date) + " · " + setCount(row.sets) + (row.example ? " · пример" : ""))))));
    let message = "Жим гантелей: 12 кг × 10 повторений вместо 12 кг × 8 на прошлом занятии. Это пример сравнения.";
    const entry = state.history[0]?.entries?.[0];
    if (entry) message = "В последней тренировке записано " + setCount(state.history[0].sets) + ". Первый подход: " + entry.name + ", " + entry.weight + " кг × " + entry.reps + ".";
    const hint = showExamples ? "Последние 7 дней · в графике есть примеры" : "Последние 7 дней";
    document.querySelector("#progress-content").replaceChildren(
      metrics, node("div", "progress-detail-grid", makeChart(rows, hint), history), note("Аналитик", message));
  }

  function goTo(view) {
    if (location.hash === "#" + view) renderRoute(true);
    else location.hash = view;
  }

  function focusHeading() {
    const heading = document.querySelector("#view-" + selectedView + " h1:not([hidden])");
    const hero = heading?.closest(".hero");
    const visibleHeading = hero?.hidden ? todayContent.querySelector("h1") : heading;
    if (!visibleHeading) return;
    visibleHeading.setAttribute("tabindex", "-1");
    visibleHeading.focus({ preventScroll: true });
  }

  function renderRoute(moveFocus = false) {
    const requested = location.hash.slice(1);
    if (requested === "main" || requested === "team") return;
    selectedView = views.includes(requested) ? requested : "today";
    if (dialog.open) dialog.close();
    for (const view of views) document.querySelector("#view-" + view).hidden = view !== selectedView;
    for (const link of document.querySelectorAll("[data-nav]")) {
      const current = link.dataset.nav === selectedView || (link.dataset.nav === "today" && selectedView === "workout");
      if (current) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    clearInterval(timerTick);
    if (selectedView === "today") renderToday();
    if (selectedView === "profile" && state.profile) fillProfile(state.profile);
    if (selectedView === "workout") {
      renderWorkout();
      if (state.workout) timerTick = setInterval(updateTimer, 250);
    }
    if (selectedView === "progress") renderProgress();
    if (moveFocus) {
      window.scrollTo(0, 0);
      focusHeading();
    }
  }

  renderTeam();
  window.addEventListener("hashchange", () => renderRoute(true));
  renderRoute();
})();
