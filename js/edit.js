/* Перетаскивание стен, углов и мебели на плане. */
(function (root) {
  const WF = root.WF = root.WF || {};

  function clonePts(pts) {
    return (pts || []).map(function (p) { return { x: p.x, y: p.y }; });
  }

  function cloneItems(list) {
    return (list || []).map(function (o) {
      return { name: o.name, x: o.x, y: o.y, w: o.w, h: o.h };
    });
  }

  function snap(v, fine) {
    const g = fine ? 0.01 : 0.05;
    return Math.round(v / g) * g;
  }

  function areaOf(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s) / 2;
  }

  function segmentsCross(a, b, c, d) {
    function cross(p, q, r) {
      return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    }
    const c1 = cross(a, b, c);
    const c2 = cross(a, b, d);
    const c3 = cross(c, d, a);
    const c4 = cross(c, d, b);
    if (c1 === 0 || c2 === 0 || c3 === 0 || c4 === 0) return false;
    return (c1 > 0) !== (c2 > 0) && (c3 > 0) !== (c4 > 0);
  }

  function selfCross(pts) {
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const adjacent = Math.abs(i - j) <= 1 || (i === 0 && j === n - 1);
        if (adjacent) continue;
        if (segmentsCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
      }
    }
    return false;
  }

  function minEdge(pts) {
    let m = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      m = Math.min(m, Math.hypot(a.x - b.x, a.y - b.y));
    }
    return m;
  }

  function shapeOk(pts) {
    if (!pts || pts.length < 3) return false;
    if (areaOf(pts) < 0.7) return false;
    if (minEdge(pts) < 0.35) return false;
    if (selfCross(pts)) return false;
    return true;
  }

  function bindPlan(api) {
    const host = document.getElementById("livePlan");
    const menu = document.getElementById("menu");
    if (!host || !api) return;
    let drag = null;

    function svgEl() {
      return host.querySelector("svg");
    }

    function toMeter(ev) {
      const el = svgEl();
      if (!el || !el.getScreenCTM) return null;
      const pt = el.createSVGPoint();
      pt.x = ev.clientX;
      pt.y = ev.clientY;
      const ctm = el.getScreenCTM();
      if (!ctm) return null;
      const p = pt.matrixTransform(ctm.inverse());
      const padX = Number(el.dataset.padX);
      const padY = Number(el.dataset.padY);
      const scale = Number(el.dataset.scale);
      const roomH = Number(el.dataset.roomh);
      if (!(scale > 0)) return null;
      return { x: p.x / scale - padX, y: roomH - (p.y / scale - padY) };
    }

    function hideMenu() {
      if (menu) menu.hidden = true;
    }

    function showMenu(ev, rows) {
      if (!menu) return;
      menu.innerHTML = rows.map(function (row, i) {
        return '<button type="button" data-act="' + i + '">' + row.label + "</button>";
      }).join("");
      menu.hidden = false;
      const x = Math.min(ev.clientX, window.innerWidth - 240);
      const y = Math.min(ev.clientY, window.innerHeight - 40 - rows.length * 36);
      menu.style.left = x + "px";
      menu.style.top = y + "px";
      menu.onclick = function (event) {
        const btn = event.target.closest("[data-act]");
        if (!btn) return;
        const row = rows[Number(btn.getAttribute("data-act"))];
        hideMenu();
        if (row && row.run) row.run();
      };
    }

    host.addEventListener("pointerdown", function (ev) {
      if (ev.button !== 0) return;
      const meter = toMeter(ev);
      if (!meter) return;
      const state = api.get();
      const vertex = ev.target.closest("[data-vertex]");
      const edge = ev.target.closest("[data-edge]");
      const resize = ev.target.closest("[data-resize]");
      const obs = ev.target.closest("[data-obs]");
      const wall = ev.target.closest("[data-wall]");
      if (vertex) {
        drag = { kind: "vertex", index: Number(vertex.getAttribute("data-vertex")), start: meter, shape: clonePts(state.shape), moved: false };
        api.select({ kind: "vertex", index: drag.index });
      } else if (resize) {
        drag = { kind: "resize", index: Number(resize.getAttribute("data-resize")), corner: resize.getAttribute("data-corner"), start: meter, items: cloneItems(state.items), moved: false };
        api.select({ kind: "obs", index: drag.index });
      } else if (obs) {
        drag = { kind: "obs", index: Number(obs.getAttribute("data-obs")), start: meter, items: cloneItems(state.items), moved: false };
        api.select({ kind: "obs", index: drag.index });
      } else if (edge) {
        drag = { kind: "edge", index: Number(edge.getAttribute("data-edge")), axis: edge.getAttribute("data-axis"), start: meter, shape: clonePts(state.shape), moved: false };
        api.select({ kind: "room" });
      } else if (wall) {
        drag = { kind: "wall", wall: wall.getAttribute("data-wall"), start: meter, moved: false };
      } else if (ev.target.closest("[data-room]")) {
        api.select(null);
        return;
      } else return;
      hideMenu();
      ev.preventDefault();
    });

    window.addEventListener("pointermove", function (ev) {
      if (!drag) return;
      const meter = toMeter(ev);
      if (!meter) return;
      const fine = ev.shiftKey;
      drag.moved = drag.moved || Math.hypot(meter.x - drag.start.x, meter.y - drag.start.y) > 0.03;
      if (drag.kind === "vertex") {
        const next = clonePts(drag.shape);
        next[drag.index] = { x: snap(meter.x, fine), y: snap(meter.y, fine) };
        if (shapeOk(next)) api.previewShape(next);
      } else if (drag.kind === "edge") {
        const next = clonePts(drag.shape);
        const i = drag.index;
        const j = (i + 1) % next.length;
        const dx = snap(meter.x, fine) - snap(drag.start.x, fine);
        const dy = snap(meter.y, fine) - snap(drag.start.y, fine);
        if (drag.axis === "x") {
          next[i].x = drag.shape[i].x + dx;
          next[j].x = drag.shape[j].x + dx;
        } else if (drag.axis === "y") {
          next[i].y = drag.shape[i].y + dy;
          next[j].y = drag.shape[j].y + dy;
        } else {
          next[i] = { x: drag.shape[i].x + dx, y: drag.shape[i].y + dy };
          next[j] = { x: drag.shape[j].x + dx, y: drag.shape[j].y + dy };
        }
        if (shapeOk(next)) api.previewShape(next);
      } else if (drag.kind === "obs") {
        const src = drag.items[drag.index];
        if (!src) return;
        const dx = snap(meter.x - drag.start.x, fine);
        const dy = snap(meter.y - drag.start.y, fine);
        const list = cloneItems(drag.items);
        list[drag.index] = { name: src.name, x: src.x + dx, y: src.y + dy, w: src.w, h: src.h };
        api.previewItems(list);
      } else if (drag.kind === "resize") {
        const src = drag.items[drag.index];
        if (!src) return;
        const x = src.x;
        const y = src.y;
        const right = src.x + src.w;
        const top = src.y + src.h;
        const px = snap(meter.x, fine);
        const py = snap(meter.y, fine);
        let nx = x;
        let ny = y;
        let nw = src.w;
        let nh = src.h;
        const corner = drag.corner;
        if (corner === "se" || corner === "ne") nw = Math.max(0.3, px - x);
        if (corner === "sw" || corner === "nw") { nx = px; nw = Math.max(0.3, right - px); }
        if (corner === "ne" || corner === "nw") nh = Math.max(0.3, py - y);
        if (corner === "se" || corner === "sw") { ny = py; nh = Math.max(0.3, top - py); }
        const list = cloneItems(drag.items);
        list[drag.index] = { name: src.name, x: nx, y: ny, w: nw, h: nh };
        api.previewItems(list);
      }
    });

    window.addEventListener("pointerup", function () {
      if (!drag) return;
      const finished = drag;
      drag = null;
      if (finished.kind === "wall" && !finished.moved) api.setWall(finished.wall);
      else api.commit();
    });

    host.addEventListener("contextmenu", function (ev) {
      ev.preventDefault();
      const meter = toMeter(ev);
      const vertex = ev.target.closest("[data-vertex]");
      const edge = ev.target.closest("[data-edge]");
      const obs = ev.target.closest("[data-obs]");
      const rows = [];
      if (vertex) {
        const index = Number(vertex.getAttribute("data-vertex"));
        rows.push({ label: "Вырезать угол", run: function () { api.notch(index); } });
        rows.push({ label: "Убрать угол", run: function () { api.removeVertex(index); } });
      } else if (edge) {
        const index = Number(edge.getAttribute("data-edge"));
        rows.push({ label: "Добавить угол", run: function () { api.insertVertex(index, meter); } });
      } else if (obs) {
        const index = Number(obs.getAttribute("data-obs"));
        rows.push({ label: "Удалить предмет", run: function () { api.removeItem(index); } });
      } else if (meter) {
        WF.FURNITURE.forEach(function (item) {
          rows.push({
            label: "Поставить: " + item.name,
            run: function () { api.addItem({ name: item.name, w: item.w, h: item.h, x: meter.x, y: meter.y }); }
          });
        });
      }
      if (rows.length) showMenu(ev, rows);
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Delete" && ev.key !== "Backspace") return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const sel = api.get().selection;
      if (!sel) return;
      if (sel.kind === "obs") api.removeItem(sel.index);
      if (sel.kind === "vertex") api.removeVertex(sel.index);
    });

    document.addEventListener("pointerdown", function (ev) {
      if (menu && !menu.contains(ev.target)) hideMenu();
    });
  }

  WF.bindPlan = bindPlan;
})(typeof window !== "undefined" ? window : globalThis);
