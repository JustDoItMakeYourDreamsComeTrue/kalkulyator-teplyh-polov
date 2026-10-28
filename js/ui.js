(function () {
  const KEY = "wf-calc-v2";
  const TYPE = { mat: "Мат", cable: "Кабель", film: "Плёнка" };
  let forceLine = null;
  let timer = 0;
  let shape = null;
  let items = [];
  let selection = null;
  let silent = false;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function ru(n, d) { return WF.ru(n, d); }

  function optionList(select, items, value, label) {
    select.innerHTML = items.map(function (item) {
      return '<option value="' + esc(value(item)) + '">' + esc(label(item)) + "</option>";
    }).join("");
  }

  function radio(name) {
    const el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : "";
  }

  function setRadio(name, value) {
    const el = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (el) el.checked = true;
  }

  function currentShape() {
    if (shape && shape.length >= 3) return shape.map(function (p) { return { x: Number(p.x), y: Number(p.y) }; });
    const L = Number(document.getElementById("length").value) || 0;
    const W = Number(document.getElementById("width").value) || 0;
    return WF.rectShape(L, W);
  }

  function readForm() {
    return {
      roomType: document.getElementById("roomType").value,
      cityId: document.getElementById("cityId").value,
      outdoor: document.getElementById("outdoor").value,
      length: document.getElementById("length").value,
      width: document.getElementById("width").value,
      height: document.getElementById("height").value,
      goal: radio("goal"),
      areaMode: radio("areaMode"),
      percent: document.getElementById("percent").value,
      obstacles: items.map(function (o) { return { name: o.name, x: o.x, y: o.y, w: o.w, h: o.h }; }),
      shape: currentShape(),
      covering: radio("covering"),
      system: radio("system"),
      brand: radio("brand"),
      above: document.getElementById("above").value,
      below: document.getElementById("below").value,
      exposure: document.getElementById("exposure").value,
      insulation: document.getElementById("insulation").value,
      underlay: document.getElementById("underlay").value,
      windows: document.getElementById("windows").value,
      screed: document.getElementById("screed").value,
      voltage: document.getElementById("voltage").value,
      tariff: document.getElementById("tariff").value,
      statWall: document.getElementById("statWall").value,
      filmWidth: document.getElementById("filmWidth").value,
      indoor: document.getElementById("indoor").value,
      forceLine: forceLine
    };
  }

  function renderChips() {
    const box = document.getElementById("obsChips");
    if (!box) return;
    if (!items.length) {
      box.innerHTML = '<p class="hint">На плане пусто. Кнопки над планом или правая кнопка мыши ставят ванну, шкаф и гарнитур.</p>';
      return;
    }
    box.innerHTML = items.map(function (o, i) {
      const on = selection && selection.kind === "obs" && selection.index === i;
      return '<button type="button" class="chip' + (on ? " on" : "") + '" data-chip="' + i + '">' + esc(o.name) + " " + ru(o.w, 2) + "×" + ru(o.h, 2) + "</button>";
    }).join("");
  }

  function syncInspector() {
    const box = document.getElementById("inspector");
    if (!box) return;
    const obs = selection && selection.kind === "obs" ? items[selection.index] : null;
    if (!obs) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    document.getElementById("inspName").textContent = obs.name;
    const w = document.getElementById("inspW");
    const h = document.getElementById("inspH");
    if (document.activeElement !== w) w.value = obs.w;
    if (document.activeElement !== h) h.value = obs.h;
  }

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  function normalizeOrigin() {
    if (!shape || shape.length < 3) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    shape.forEach(function (p) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
    shape = shape.map(function (p) { return { x: round2(p.x - minX), y: round2(p.y - minY) }; });
    items = items.map(function (o) {
      return { name: o.name, x: round2(o.x - minX), y: round2(o.y - minY), w: o.w, h: o.h };
    });
    silent = true;
    document.getElementById("length").value = Math.max(0.8, round2(maxX - minX)).toFixed(2);
    document.getElementById("width").value = Math.max(0.8, round2(maxY - minY)).toFixed(2);
    silent = false;
  }

  function applySizeFromInputs() {
    const L = Number(document.getElementById("length").value);
    const W = Number(document.getElementById("width").value);
    if (!(L >= 0.8) || !(W >= 0.8)) return;
    const prev = currentShape();
    let maxX = 0;
    let maxY = 0;
    prev.forEach(function (p) {
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
    shape = WF.isRectangle(prev, maxX, maxY) ? WF.rectShape(L, W) : WF.scaleShape(prev, L, W);
  }

  function writeForm(data) {
    document.getElementById("roomType").value = data.roomType || "living";
    document.getElementById("cityId").value = data.cityId || "moscow";
    document.getElementById("outdoor").value = data.outdoor || "";
    document.getElementById("length").value = data.length;
    document.getElementById("width").value = data.width;
    document.getElementById("height").value = data.height || 2.7;
    setRadio("goal", data.goal || "comfort");
    setRadio("areaMode", data.areaMode || "obstacles");
    document.getElementById("percent").value = data.percent || 80;
    document.getElementById("percentRange").value = data.percent || 80;
    setRadio("covering", data.covering || "tile");
    setRadio("system", data.system || "auto");
    setRadio("brand", data.brand || "warmehaus");
    document.getElementById("above").value = data.above || "heated";
    document.getElementById("below").value = data.below || "heated";
    document.getElementById("exposure").value = data.exposure || "one";
    document.getElementById("insulation").value = data.insulation || "unknown";
    document.getElementById("underlay").value = data.underlay || "unknown";
    document.getElementById("windows").value = data.windows || "";
    document.getElementById("screed").value = data.screed || "unknown";
    document.getElementById("voltage").value = String(data.voltage || 230);
    document.getElementById("tariff").value = data.tariff || "";
    document.getElementById("statWall").value = data.statWall || "bottom";
    document.getElementById("filmWidth").value = String(data.filmWidth || 0.5);
    document.getElementById("indoor").value = data.indoor || "";
    items = (data.obstacles || []).map(function (o) {
      return { name: o.name || "Предмет", x: Number(o.x) || 0, y: Number(o.y) || 0, w: Number(o.w) || 0.6, h: Number(o.h) || 0.6 };
    });
    shape = data.shape && data.shape.length >= 3 ? data.shape.map(function (p) { return { x: Number(p.x), y: Number(p.y) }; }) : null;
    selection = null;
    document.getElementById("form").dataset.area = data.areaMode || "obstacles";
    syncCityPlaceholder();
    renderChips();
  }

  function syncCityPlaceholder() {
    const city = WF.CITIES.filter(function (c) { return c.id === document.getElementById("cityId").value; })[0];
    document.getElementById("outdoor").placeholder = city ? String(city.outdoor) : "из города";
  }

  function money(kwh, tariff) {
    if (!tariff || !kwh) return "";
    return " · около " + ru(kwh * tariff, 0) + " ₽";
  }

  function warningsHtml(list) {
    if (!list || !list.length) return "";
    return '<div class="warn-list">' + list.map(function (w) {
      return '<p class="' + esc(w.level) + '">' + esc(w.text) + "</p>";
    }).join("") + "</div>";
  }

  function piecesTable(best) {
    const rows = best.pieces.map(function (p) {
      const size = p.length ? ru(p.length, 1) + " м" : (p.area ? ru(p.area, 2) + " м²" : "—");
      const ohm = p.resistance ? ru(p.resistance, 0) + " Ом" : "по паспорту";
      return "<tr><td>" + esc(p.name) + "</td><td>" + ru(p.qty, 0) + "</td><td>" + ru(p.power, 0) + "</td><td>" + size + "</td><td>" + ru(p.amps, 1) + " А</td><td>" + ohm + "</td></tr>";
    }).join("");
    return "<table><thead><tr><th>Секция</th><th>Шт</th><th>Вт</th><th>Размер</th><th>Ток</th><th>Ориентир R</th></tr></thead><tbody>" + rows + "</tbody></table>";
  }

  function reportHtml(result) {
    if (!result.ok) {
      return "<h2>Проверьте размеры</h2>" + (result.errors || []).map(function (e) {
        return '<p class="bad">' + esc(e) + "</p>";
      }).join("");
    }
    if (!result.best) {
      return "<h2>Секцию подобрать не вышло</h2>" + warningsHtml(result.warnings);
    }
    const b = result.best;
    const v = result.verdict;
    const stepMetric = b.stepCm
      ? ru(b.stepCm, 1) + " см"
      : (b.type === "mat" ? ru(b.fixedStep, 0) + " см" : ru(result.input.filmWidth * 100, 0) + " см");
    const stepLabel = b.type === "cable" ? "Шаг кабеля" : (b.type === "mat" ? "Шаг на мате" : "Ширина полосы");
    const force = result.input.forceLine
      ? '<div class="force-note"><span>Сейчас на экране не автоматический совет, а вариант, который вы открыли ниже.</span><button class="text-btn" type="button" id="clearForce">Вернуть рекомендацию</button></div>'
      : "";
    const alts = (result.alternatives || []).map(function (a) {
      return '<article class="alt"><p class="kicker">' + esc(a.brandName) + " · " + esc(TYPE[a.type] || "") + "</p><h3>" + esc(a.title) + "</h3><p>" + esc(a.whyNot) + "</p><p><b>" + ru(a.power, 0) + " Вт</b> · " + ru(a.specific, 0) + " Вт/м²" + (a.stepCm ? " · шаг " + ru(a.stepCm, 1) + " см" : "") + "</p><button type=\"button\" data-line=\"" + esc(a.lineId) + "\">Показать этот вариант</button></article>";
    }).join("");
    const energy = b.energy;
    const tariff = result.input.tariff;
    const energyHtml = result.input.goal === "main"
      ? "<p>За сезон комнате нужно около <b>" + ru(energy.heatKwh, 0) + " кВт·ч</b> тепла. Пол снимет с розетки примерно <b>" + ru(energy.electricKwh, 0) + " кВт·ч</b>" + money(energy.electricKwh, tariff) + ", если закрывает свою долю потерь. Это не счёт, а порядок цифр: градусо-сутки и доля тепла вверх взяты укрупнённо.</p>"
      : "<p>В режиме «просто тёплый пол» секция не работает сутками. Грубая прикидка: 8 часов в день, 200 дней, термостат держит пол включённым около половины этого времени. Выходит около <b>" + ru(energy.comfortKwh, 0) + " кВт·ч</b> за сезон" + money(energy.comfortKwh, tariff) + ".</p><p>Если всё же оставить пол одним отоплением, ориентир другой: комнате нужно около " + ru(energy.heatKwh, 0) + " кВт·ч тепла за сезон, а пол электрически взял бы около " + ru(energy.electricKwh, 0) + " кВт·ч" + money(energy.electricKwh, tariff) + " — и только в ту часть морозов, которую он вообще тянет.</p>";

    return force +
      warningsHtml(result.warnings) +
      '<p class="answer">' + esc(result.answer) + "</p>" +
      '<div class="split"><article class="verdict ' + v.level + '"><div class="kicker">Главный вывод</div><h3>' + esc(v.title) + "</h3><p>" + esc(v.lead) + "</p></article>" +
      '<article class="verdict ' + v.heatLevel + '"><div class="kicker">' + esc(v.heatTitle) + "</div><h3>" + (v.ratio >= 1 ? "Хватит" : (v.ratio >= 0.8 ? "На грани" : "Не хватит")) + "</h3><p>" + esc(v.heatLine) + "</p></article></div>" +
      '<div class="toolbar"><button class="solid" type="button" id="printBtn">Печать</button><button class="ghost" type="button" id="downloadBtn">Скачать текст</button></div>' +
      '<div class="metrics">' +
      metric("Площадь укладки", ru(result.area, 2) + " м²", "из " + ru(result.roomArea, 2) + " м² комнаты") +
      metric("Паспорт", ru(b.power, 0) + " Вт", ru(b.specific, 0) + " Вт/м² на нагревателе") +
      metric("Придёт в комнату", ru(b.usefulW, 0) + " Вт", "после предела покрытия и потерь вниз") +
      metric("Теплопотери", ru(result.loss.watts, 0) + " Вт", "при " + ru(result.loss.outdoor, 0) + " °C на улице") +
      metric(stepLabel, stepMetric, b.pieceCount > 1 ? ru(b.pieceCount, 0) + " контура" : "один контур") +
      metric("Ток", ru(b.power / 230, 1) + " А", "автомат C" + b.feeder.breaker + ", медь " + ru(b.feeder.mm2, 1) + " мм²") +
      "</div>" +
      '<div id="reportPlan">' + WF.draw(result) + "</div>" +
      '<p class="note">' + esc(b.direction) + "</p>" +
      "<h2>Что купить</h2>" + piecesTable(b) +
      (b.tapeM ? "<p>Монтажной ленты около " + ru(b.tapeM, 0) + " м: полосы через каждые 0,5 м поперёк витков.</p>" : "") +
      "<p>" + esc(b.thermostat) + "</p>" +
      "<p>" + esc(b.electric) + ".</p>" +
      "<h2>Почему так</h2><p>" + esc(b.why) + "</p><p>" + esc(b.blurb) + "</p>" +
      '<div class="cols"><div class="panel"><h3>Плюсы</h3><ul class="pro">' + b.pros.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul></div>' +
      '<div class="panel"><h3>Минусы</h3><ul class="con">' + b.cons.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></div></div>" +
      "<h2>Как класть</h2><ol class=\"steps\">" + b.steps.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ol>" +
      "<h2>Пирог пола снизу вверх</h2><ol class=\"layers\">" + b.layers.map(function (layer) {
        return "<li><b>" + esc(layer.t) + ".</b> " + esc(layer.d) + "</li>";
      }).join("") + "</ol>" +
      "<h2>Другие рабочие варианты</h2><div class=\"alts\">" + alts + "</div>" +
      "<h2>Электричество за сезон</h2>" + energyHtml +
      "<details class=\"method\"><summary>Откуда цифры</summary>" +
      result.method.map(function (line) { return "<p><b>" + esc(line.name) + ".</b> " + esc(line.text) + "</p>"; }).join("") +
      "<p><b>Что принято в расчёте.</b></p><ul>" + result.assumptions.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" +
      "<p>Это предварительный выбор секции, не проект отопления и не замена паспорта изделия. Перед укладкой сопротивление сверяют с биркой на бухте.</p></details>";
  }

  function metric(label, value, note) {
    return '<div class="metric"><span>' + esc(label) + "</span><b>" + esc(value) + "</b><span>" + esc(note) + "</span></div>";
  }

  function plainText(result) {
    if (!result || !result.best) return "Нет расчёта";
    const b = result.best;
    const lines = [];
    lines.push("Калькулятор тёплого пола WÄRMEHAUS / Grand Meyer");
    lines.push("");
    lines.push(result.answer);
    lines.push("");
    lines.push("Комната: " + result.room.name + ", " + ru(result.input.length, 2) + " × " + ru(result.input.width, 2) + " м");
    lines.push("Укладка: " + ru(result.area, 2) + " м²");
    lines.push("Система: " + b.title);
    lines.push("Паспорт: " + ru(b.power, 0) + " Вт, в комнату около " + ru(b.usefulW, 0) + " Вт, потери " + ru(result.loss.watts, 0) + " Вт");
    if (b.stepCm) lines.push("Шаг: " + ru(b.stepCm, 1) + " см");
    lines.push("");
    lines.push(b.direction);
    lines.push("");
    lines.push("Покупка:");
    b.pieces.forEach(function (p) {
      lines.push("- " + p.qty + " × " + p.name + ", " + ru(p.power, 0) + " Вт" + (p.resistance ? ", ориентир " + ru(p.resistance, 0) + " Ом" : ""));
    });
    lines.push(b.thermostat);
    lines.push(b.electric);
    lines.push("");
    lines.push("Укладка:");
    b.steps.forEach(function (s, i) { lines.push((i + 1) + ". " + s); });
    lines.push("");
    lines.push("Пирог:");
    b.layers.forEach(function (layer, i) { lines.push((i + 1) + ". " + layer.t + " — " + layer.d); });
    lines.push("");
    lines.push("Плюсы:");
    b.pros.forEach(function (s) { lines.push("- " + s); });
    lines.push("Минусы:");
    b.cons.forEach(function (s) { lines.push("- " + s); });
    return lines.join("\n");
  }

  function render(planOnly) {
    const input = readForm();
    document.getElementById("form").dataset.area = input.areaMode || "obstacles";
    const result = WF.calculate(input);
    document.getElementById("livePlan").innerHTML = WF.draw(result, { interactive: true, selection: selection });
    syncInspector();
    renderChips();
    const line = document.getElementById("liveLine");
    const dock = document.getElementById("dock");
    if (!result.ok) {
      line.textContent = result.errors[0];
      dock.hidden = true;
    } else if (!result.best) {
      line.textContent = "Нет подходящей секции";
      dock.hidden = true;
    } else {
      line.textContent = result.best.title + " · " + WF.ru(result.best.power, 0) + " Вт";
      dock.hidden = false;
      dock.textContent = result.best.title + " · " + WF.ru(result.best.power, 0) + " Вт · смотреть ответ";
    }
    if (planOnly === true) {
      try { localStorage.setItem(KEY, JSON.stringify(readForm())); } catch (e) { /* частный режим */ }
      return;
    }
    document.getElementById("report").innerHTML = reportHtml(result);
    const printBtn = document.getElementById("printBtn");
    const downloadBtn = document.getElementById("downloadBtn");
    const clearForce = document.getElementById("clearForce");
    if (printBtn) printBtn.addEventListener("click", function () { window.print(); });
    if (downloadBtn) downloadBtn.addEventListener("click", function () {
      const blob = new Blob([plainText(result)], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "teplyj-pol.txt";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    if (clearForce) clearForce.addEventListener("click", function () {
      forceLine = null;
      render();
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-line]"), function (btn) {
      btn.addEventListener("click", function () {
        forceLine = btn.getAttribute("data-line");
        render();
        document.getElementById("report").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    try { localStorage.setItem(KEY, JSON.stringify(readForm())); } catch (e) { /* частный режим */ }
  }

  function schedule(clearForce) {
    if (clearForce) forceLine = null;
    window.clearTimeout(timer);
    timer = window.setTimeout(render, 40);
  }

  function useObstacles() {
    setRadio("areaMode", "obstacles");
    document.getElementById("form").dataset.area = "obstacles";
  }

  function addFurniture(item) {
    useObstacles();
    const L = Number(document.getElementById("length").value) || 1;
    const W = Number(document.getElementById("width").value) || 1;
    const w = Math.min(item.w, Math.max(0.3, L - 0.2));
    const h = Math.min(item.h, Math.max(0.3, W - 0.2));
    let x = item.x;
    let y = item.y;
    if (x + w > L) x = Math.max(0.05, L - w - 0.05);
    if (y + h > W) y = Math.max(0.05, W - h - 0.05);
    items.push({ name: item.name, x: round2(x), y: round2(y), w: w, h: h });
    selection = { kind: "obs", index: items.length - 1 };
    forceLine = null;
    render();
  }

  function removeItem(index) {
    items.splice(index, 1);
    selection = null;
    forceLine = null;
    render();
  }

  function onInspector() {
    if (!selection || selection.kind !== "obs" || !items[selection.index]) return;
    const obs = items[selection.index];
    const w = Number(document.getElementById("inspW").value);
    const h = Number(document.getElementById("inspH").value);
    if (w >= 0.3) obs.w = w;
    if (h >= 0.3) obs.h = h;
    forceLine = null;
    render(true);
  }

  function setShape(next) {
    shape = next;
    normalizeOrigin();
    forceLine = null;
    render();
  }

  const planApi = {
    get: function () {
      return { shape: currentShape(), items: items, selection: selection };
    },
    select: function (sel) {
      selection = sel;
      render(true);
    },
    previewShape: function (pts) {
      shape = pts;
      let maxX = 0.8;
      let maxY = 0.8;
      pts.forEach(function (p) {
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      silent = true;
      document.getElementById("length").value = round2(Math.max(0.8, maxX)).toFixed(2);
      document.getElementById("width").value = round2(Math.max(0.8, maxY)).toFixed(2);
      silent = false;
      render(true);
    },
    previewItems: function (list) {
      items = list;
      render(true);
    },
    commit: function () {
      normalizeOrigin();
      forceLine = null;
      render();
    },
    setWall: function (wall) {
      document.getElementById("statWall").value = wall;
      forceLine = null;
      render();
    },
    addItem: function (item) { addFurniture(item); },
    removeItem: removeItem,
    removeVertex: function (index) {
      const pts = currentShape();
      if (pts.length <= 3) return;
      pts.splice(index, 1);
      selection = null;
      setShape(pts);
    },
    insertVertex: function (edge, point) {
      const pts = currentShape();
      if (!point || pts.length >= 16) return;
      const a = pts[edge];
      const b = pts[(edge + 1) % pts.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2;
      t = Math.min(0.85, Math.max(0.15, t));
      pts.splice(edge + 1, 0, { x: round2(a.x + dx * t), y: round2(a.y + dy * t) });
      selection = { kind: "vertex", index: edge + 1 };
      setShape(pts);
    },
    notch: function (index) {
      const pts = currentShape();
      const n = pts.length;
      if (n < 3 || n > 14) return;
      const c = pts[index];
      const p = pts[(index - 1 + n) % n];
      const nx = pts[(index + 1) % n];
      const a = { x: round2(c.x + (p.x - c.x) * 0.42), y: round2(c.y + (p.y - c.y) * 0.42) };
      const b = { x: round2(c.x + (nx.x - c.x) * 0.42), y: round2(c.y + (nx.y - c.y) * 0.42) };
      const inner = { x: round2(a.x + (b.x - c.x)), y: round2(a.y + (b.y - c.y)) };
      const next = pts.slice(0, index).concat([a, inner, b], pts.slice(index + 1));
      selection = null;
      setShape(next);
    }
  };

  function boot() {
    optionList(document.getElementById("roomType"), Object.keys(WF.ROOMS), function (id) { return id; }, function (id) { return WF.ROOMS[id].name; });
    optionList(document.getElementById("cityId"), WF.CITIES, function (c) { return c.id; }, function (c) { return c.name + " (" + c.outdoor + " °C)"; });
    document.getElementById("coverings").innerHTML = Object.keys(WF.COVERINGS).map(function (id) {
      const c = WF.COVERINGS[id];
      return '<label class="pick"><input type="radio" name="covering" value="' + id + '"><span>' + esc(c.short) + "</span></label>";
    }).join("");
    document.getElementById("examples").innerHTML =
      '<button type="button" data-example="bath">Ванная, плитка</button>' +
      '<button type="button" data-example="living">Гостиная, ламинат</button>' +
      '<button type="button" data-example="kitchen">Кухня, отопление</button>';

    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem("wf-calc-v1") || "null"); } catch (e) { stored = null; }
    if (stored && stored.length) {
      forceLine = stored.forceLine || null;
      writeForm(stored);
    } else {
      writeForm(WF.EXAMPLES.bath);
    }

    document.getElementById("palette").innerHTML = WF.FURNITURE.map(function (item, i) {
      return '<button type="button" data-palette="' + i + '">' + esc(item.name) + "</button>";
    }).join("");

    document.getElementById("form").addEventListener("input", function (event) {
      if (silent) return;
      if (event.target && event.target.id === "percent") {
        document.getElementById("percentRange").value = event.target.value;
      }
      if (event.target && (event.target.id === "length" || event.target.id === "width")) applySizeFromInputs();
      schedule(true);
    });
    document.getElementById("form").addEventListener("change", function (event) {
      if (silent) return;
      if (event.target && event.target.name === "areaMode") {
        document.getElementById("form").dataset.area = radio("areaMode");
      }
      if (event.target && event.target.id === "cityId") syncCityPlaceholder();
      schedule(true);
    });
    document.getElementById("percentRange").addEventListener("input", function () {
      document.getElementById("percent").value = this.value;
      schedule(true);
    });
    document.getElementById("obsChips").addEventListener("click", function (event) {
      const btn = event.target.closest("[data-chip]");
      if (!btn) return;
      selection = { kind: "obs", index: Number(btn.getAttribute("data-chip")) };
      render(true);
    });
    document.getElementById("palette").addEventListener("click", function (event) {
      const btn = event.target.closest("[data-palette]");
      if (!btn) return;
      const preset = WF.FURNITURE[Number(btn.getAttribute("data-palette"))];
      if (!preset) return;
      addFurniture({ name: preset.name, w: preset.w, h: preset.h, x: 0.2 + (items.length % 3) * 0.15, y: 0.2 });
    });
    document.getElementById("inspW").addEventListener("input", onInspector);
    document.getElementById("inspH").addEventListener("input", onInspector);
    document.getElementById("inspDel").addEventListener("click", function () {
      if (selection && selection.kind === "obs") removeItem(selection.index);
    });
    document.getElementById("examples").addEventListener("click", function (event) {
      const id = event.target.getAttribute("data-example");
      if (!id || !WF.EXAMPLES[id]) return;
      forceLine = null;
      writeForm(WF.EXAMPLES[id]);
      render();
      document.getElementById("report").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("dock").addEventListener("click", function () {
      document.getElementById("report").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("form").addEventListener("submit", function (event) { event.preventDefault(); });
    if (WF.bindPlan) WF.bindPlan(planApi);
    render();
  }

  boot();
})();
