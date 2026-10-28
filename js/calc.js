/* Предварительный расчёт электрического тёплого пола.
   Теплопотери — упрощённый баланс для выбора секции, не энергетический паспорт.
   Поток с поверхности — формула EN 1264: q = 8,92·(ΔT)^1,1.
   Шаг кабеля — как у производителей: h(см) = 100·S / L. */
(function (root) {
  const WF = root.WF = root.WF || {};
  const D = WF;

  function ru(n, digits) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "—";
    const d = digits == null ? 0 : digits;
    const s = v.toFixed(d);
    const parts = s.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return d ? parts[0] + "," + parts[1] : parts[0];
  }

  function num(v, fallback) {
    if (v == null || v === "") return fallback;
    const n = Number(String(v).replace(",", ".").replace(/\s/g, ""));
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(n, a, b) {
    return Math.min(b, Math.max(a, n));
  }

  function cityById(id) {
    for (let i = 0; i < D.CITIES.length; i++) if (D.CITIES[i].id === id) return D.CITIES[i];
    return D.CITIES[0];
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function overlaps(list) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) if (rectsOverlap(list[i], list[j])) return true;
    }
    return false;
  }

  function clipObstacle(o, L, W) {
    const x0 = clamp(o.x, 0, L);
    const y0 = clamp(o.y, 0, W);
    const x1 = clamp(o.x + o.w, 0, L);
    const y1 = clamp(o.y + o.h, 0, W);
    return { name: o.name || "Предмет", x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
  }

  function gridArea(L, W, obstacles) {
    const cell = 0.025;
    let free = 0;
    for (let x = 0; x < L; x += cell) {
      for (let y = 0; y < W; y += cell) {
        const cx = x + cell / 2;
        const cy = y + cell / 2;
        let hit = false;
        for (let i = 0; i < obstacles.length; i++) {
          const o = obstacles[i];
          if (cx >= o.x && cx <= o.x + o.w && cy >= o.y && cy <= o.y + o.h) { hit = true; break; }
        }
        if (!hit) free += Math.min(cell, L - x) * Math.min(cell, W - y);
      }
    }
    return free;
  }

  function freeArea(L, W, obstacles) {
    const list = obstacles || [];
    if (!list.length) return L * W;
    if (overlaps(list)) return gridArea(L, W, list);
    let occ = 0;
    for (let i = 0; i < list.length; i++) occ += list[i].w * list[i].h;
    return Math.max(0, L * W - occ);
  }

  function rectShape(L, W) {
    return [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: L, y: W }, { x: 0, y: W }];
  }

  function polygonArea(pts) {
    let s = 0;
    if (!pts) return 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      s += a.x * b.y - b.x * a.y;
    }
    return s / 2;
  }

  function ensureCCW(pts) {
    return polygonArea(pts) < 0 ? pts.slice().reverse() : pts.slice();
  }

  function cleanShape(src, L, W) {
    if (!(L > 0) || !(W > 0)) return [];
    if (!Array.isArray(src) || src.length < 3) return rectShape(L, W);
    const pts = [];
    for (let i = 0; i < src.length && pts.length < 24; i++) {
      const x = num(src[i] && src[i].x, NaN);
      const y = num(src[i] && src[i].y, NaN);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const q = { x: clamp(x, -8, Math.max(L, 0) + 8), y: clamp(y, -8, Math.max(W, 0) + 8) };
      const prev = pts[pts.length - 1];
      if (prev && Math.hypot(prev.x - q.x, prev.y - q.y) < 0.04) continue;
      pts.push(q);
    }
    if (pts.length >= 2 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.04) pts.pop();
    if (pts.length < 3) return rectShape(L, W);
    return ensureCCW(pts);
  }

  function isRectangle(pts, L, W) {
    if (!pts || pts.length !== 4 || !(L > 0) || !(W > 0)) return !pts || pts.length === 0;
    const seen = {};
    for (let i = 0; i < 4; i++) {
      const px = Math.abs(pts[i].x) <= 0.045 ? 0 : (Math.abs(pts[i].x - L) <= 0.045 ? 1 : -1);
      const py = Math.abs(pts[i].y) <= 0.045 ? 0 : (Math.abs(pts[i].y - W) <= 0.045 ? 1 : -1);
      if (px < 0 || py < 0) return false;
      const key = px + "," + py;
      if (seen[key]) return false;
      seen[key] = 1;
    }
    return true;
  }

  function axisRect(pts) {
    if (!pts || pts.length !== 4) return false;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    pts.forEach(function (p) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });
    return pts.every(function (p) {
      const onX = Math.abs(p.x - minX) <= 0.045 || Math.abs(p.x - maxX) <= 0.045;
      const onY = Math.abs(p.y - minY) <= 0.045 || Math.abs(p.y - maxY) <= 0.045;
      return onX && onY;
    });
  }

  function polyFree(pts, obstacles) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    pts.forEach(function (p) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });
    const cell = 0.03;
    let free = 0;
    for (let x = minX; x < maxX - 1e-6; x += cell) {
      for (let y = minY; y < maxY - 1e-6; y += cell) {
        const cx = x + cell / 2;
        const cy = y + cell / 2;
        if (!pointInPoly(cx, cy, pts)) continue;
        let blocked = false;
        for (let i = 0; i < obstacles.length; i++) {
          const o = obstacles[i];
          if (cx >= o.x && cx <= o.x + o.w && cy >= o.y && cy <= o.y + o.h) { blocked = true; break; }
        }
        if (!blocked) free += cell * cell;
      }
    }
    return free;
  }

  function clipBands(bands, poly) {
    const out = [];
    (bands || []).forEach(function (b) {
      const slices = Math.max(1, Math.ceil(b.h / 0.25 - 1e-6));
      const sh = b.h / slices;
      for (let i = 0; i < slices; i++) {
        const y0 = b.y + i * sh;
        polySpans(poly, y0 + sh / 2).forEach(function (seg) {
          const a = Math.max(b.x, seg[0]);
          const c = Math.min(b.x + b.w, seg[1]);
          if (c - a >= 0.36 && sh >= 0.18) out.push({ x: a, y: y0, w: c - a, h: sh, circuit: b.circuit });
        });
      }
    });
    return out;
  }

  function pointInPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const yi = pts[i].y;
      const yj = pts[j].y;
      if ((yi > y) === (yj > y)) continue;
      const xCross = (pts[j].x - pts[i].x) * (y - yi) / ((yj - yi) || 1e-12) + pts[i].x;
      if (x < xCross) inside = !inside;
    }
    return inside;
  }

  function segmentInPoly(a, b, poly) {
    if (!poly || poly.length < 3) return true;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      if (!pointInPoly(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, poly)) return false;
    }
    return true;
  }

  function closestOnPath(p, path) {
    let bestD = Infinity;
    let best = null;
    let bestI = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const q = { x: a.x + dx * t, y: a.y + dy * t };
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < bestD) {
        bestD = d;
        best = q;
        bestI = i;
      }
    }
    return { q: best, d: bestD, i: bestI };
  }

  function stitchPaths(paths, obstacles, poly, stepM) {
    const limit = Math.max(0.45, stepM * 2.4);
    let list = paths.filter(function (p) { return p.length >= 4; });
    let guard = 0;
    while (list.length > 1 && guard++ < 8) {
      let best = null;
      for (let i = 0; i < list.length; i++) {
        for (let j = 0; j < list.length; j++) {
          if (i === j) continue;
          const end = list[i][list[i].length - 1];
          const hit = closestOnPath(end, list[j]);
          if (!hit.q || hit.d > limit) continue;
          if (segmentHits(end, hit.q, obstacles, 0.03)) continue;
          if (!segmentInPoly(end, hit.q, poly)) continue;
          if (!best || hit.d < best.d) best = { i: i, j: j, hit: hit };
        }
      }
      if (!best) break;
      const a = list[best.i];
      const b = list[best.j];
      const end = a[a.length - 1];
      const q = best.hit.q;
      const forward = b.slice(best.hit.i + 1);
      const backward = b.slice(0, best.hit.i + 1).reverse();
      const main = forward.length >= backward.length ? forward : backward;
      const rest = forward.length >= backward.length ? backward : forward;
      const merged = a.slice();
      if (Math.hypot(end.x - q.x, end.y - q.y) > 0.015) merged.push({ x: q.x, y: q.y });
      main.forEach(function (pt) { merged.push({ x: pt.x, y: pt.y }); });
      const next = [];
      list.forEach(function (p, idx) {
        if (idx !== best.i && idx !== best.j) next.push(p);
      });
      next.push(merged);
      if (rest.length >= 6) next.push(rest);
      if (next.length >= list.length) break;
      list = next;
    }
    return list.filter(function (p) { return p.length >= 6; });
  }

  function polySpans(poly, y) {
    const xs = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (Math.abs(a.y - b.y) < 1e-9) continue;
      const lo = Math.min(a.y, b.y);
      const hi = Math.max(a.y, b.y);
      if (y < lo || y >= hi) continue;
      const t = (y - a.y) / (b.y - a.y);
      xs.push(a.x + (b.x - a.x) * t);
    }
    xs.sort(function (a, b) { return a - b; });
    const spans = [];
    for (let i = 0; i + 1 < xs.length; i += 2) {
      if (xs[i + 1] - xs[i] > 0.08) spans.push([xs[i], xs[i + 1]]);
    }
    return spans;
  }

  function scaleShape(pts, L, W) {
    if (!pts || pts.length < 3) return rectShape(L, W);
    let maxX = 0;
    let maxY = 0;
    pts.forEach(function (p) {
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
    if (!(maxX > 0) || !(maxY > 0)) return rectShape(L, W);
    return pts.map(function (p) { return { x: p.x / maxX * L, y: p.y / maxY * W }; });
  }

  function surfaceFlux(delta) {
    if (!(delta > 0)) return 0;
    return 8.92 * Math.pow(delta, 1.1);
  }

  function etaOf(underlay, below) {
    if (underlay === "xps50") return 0.92;
    if (underlay === "xps20") return 0.86;
    if (underlay === "foil") return 0.75;
    if (underlay === "none") return below === "heated" ? 0.68 : 0.55;
    return below === "heated" ? 0.72 : 0.6;
  }

  function voltageFactor(voltage, selfReg) {
    const k = clamp(voltage, 200, 240) / 230;
    return selfReg ? (0.55 + 0.45 * k) : (k * k);
  }

  function normalize(raw) {
    const src = raw || {};
    const city = cityById(src.cityId || "moscow");
    const room = D.ROOMS[src.roomType] ? src.roomType : "living";
    const covering = D.COVERINGS[src.covering] ? src.covering : "tile";
    const length = num(src.length, 0);
    const width = num(src.width, 0);
    const obstacles = [];
    (src.obstacles || []).forEach(function (o) {
      const item = clipObstacle({
        name: o.name,
        x: num(o.x, 0),
        y: num(o.y, 0),
        w: num(o.w, 0),
        h: num(o.h, 0)
      }, Math.max(length, 0), Math.max(width, 0));
      if (item.w >= 0.15 && item.h >= 0.15) obstacles.push(item);
    });
    const outdoor = src.outdoor === "" || src.outdoor == null ? city.outdoor : num(src.outdoor, city.outdoor);
    return {
      roomType: room,
      cityId: city.id,
      cityName: city.name,
      outdoor: outdoor,
      hdd: city.hdd,
      length: length,
      width: width,
      height: clamp(num(src.height, 2.7), 2.2, 6),
      above: src.above || (room === "balcony" ? "cold" : "heated"),
      below: src.below || (room === "balcony" ? "outdoor" : "heated"),
      insulation: D.U[src.insulation] ? src.insulation : "unknown",
      underlay: src.underlay || "unknown",
      windows: src.windows === "" || src.windows == null ? null : Math.max(0, num(src.windows, 0)),
      goal: src.goal === "main" ? "main" : "comfort",
      covering: covering,
      system: ["mat", "cable", "film"].indexOf(src.system) >= 0 ? src.system : "auto",
      brand: src.brand === "grandmeyer" || src.brand === "either" ? src.brand : "warmehaus",
      screed: src.screed === "yes" || src.screed === "no" ? src.screed : "unknown",
      exposure: ["two", "all", "none"].indexOf(src.exposure) >= 0 ? src.exposure : (room === "balcony" ? "all" : "one"),
      areaMode: src.areaMode === "percent" ? "percent" : "obstacles",
      percent: clamp(num(src.percent, 80), 10, 100),
      obstacles: obstacles,
      voltage: Math.abs(num(src.voltage, 230) - 220) < Math.abs(num(src.voltage, 230) - 230) ? 220 : 230,
      tariff: src.tariff === "" || src.tariff == null ? null : Math.max(0, num(src.tariff, 0)),
      statWall: ["top", "left", "right"].indexOf(src.statWall) >= 0 ? src.statWall : "bottom",
      shape: cleanShape(src.shape, length, width),
      filmWidth: Number(src.filmWidth) === 1 ? 1 : 0.5,
      indoor: src.indoor === "" || src.indoor == null ? null : clamp(num(src.indoor, 20), 10, 30),
      forceLine: src.forceLine || null
    };
  }

  function heatLoss(input) {
    const room = D.ROOMS[input.roomType];
    const U = D.U[input.insulation];
    const air = input.indoor == null ? room.air : input.indoor;
    const outdoor = input.outdoor;
    const dT = Math.max(0, air - outdoor);
    const L = input.length;
    const W = input.width;
    const H = input.height;
    const rectRoom = isRectangle(input.shape, L, W);
    const A = rectRoom ? L * W : Math.abs(polygonArea(input.shape));
    const V = A * H;
    let peri = 2 * (L + W);
    if (!rectRoom && input.shape && input.shape.length) {
      peri = 0;
      for (let i = 0; i < input.shape.length; i++) {
        const a = input.shape[i];
        const b = input.shape[(i + 1) % input.shape.length];
        peri += Math.hypot(a.x - b.x, a.y - b.y);
      }
    }
    const wallGross = peri * H;
    const exposure = input.exposure;
    let externalGross;
    if (exposure === "all" || input.roomType === "balcony") externalGross = wallGross;
    else if (exposure === "two") externalGross = (L + W) * H;
    else if (exposure === "none") externalGross = 0;
    else externalGross = (rectRoom ? Math.max(L, W) : peri / 4) * H;
    const winDefault = exposure === "none" ? 0 : Math.max(exposure === "none" ? 0 : 0.15, Math.min(externalGross * 0.55, A * room.win));
    const windows = input.windows == null ? winDefault : input.windows;
    const win = clamp(windows, 0, Math.max(0.2, externalGross * 0.85));
    const wall = Math.max(0, externalGross - win);
    const aboveCold = input.above === "cold" || input.roomType === "balcony";
    const aboveUnknown = input.above === "unknown";
    const qAbove = aboveCold ? U.ceiling * dT : U.ceiling * (aboveUnknown ? dT * 0.35 : 3);
    let qBelow;
    if (input.below === "ground" || input.below === "outdoor" || input.roomType === "balcony") qBelow = U.floor * dT;
    else if (input.below === "unheated") qBelow = U.floor * dT * 0.6;
    else if (input.below === "unknown") qBelow = U.floor * 4;
    else qBelow = U.floor * 3;
    const trans = U.wall * wall * dT + U.window * win * dT + qAbove * A + qBelow * A;
    const n = (exposure === "all" || input.roomType === "balcony") ? room.n : Math.min(room.n, 0.4);
    const vent = 0.34 * n * V * dT;
    const watts = (trans + vent) * 1.1;
    let hdd = input.hdd;
    let hddEstimated = false;
    if (hdd == null) {
      hdd = Math.max(600, Math.round((18 - outdoor) * 190));
      hddEstimated = true;
    }
    return {
      watts: watts,
      transmission: trans,
      ventilation: vent,
      delta: dT,
      volume: V,
      windows: win,
      windowsAssumed: input.windows == null,
      airChange: n,
      exposure: exposure,
      air: air,
      outdoor: outdoor,
      hdd: hdd,
      hddEstimated: hddEstimated,
      wall: wall,
      uName: U.name
    };
  }

  function targetDensity(input, loss, area, eta, covering) {
    const table = input.goal === "main" ? D.MAIN_Q : D.COMFORT_Q;
    let q = table[input.roomType] || 140;
    if (input.insulation === "poor") q += 15;
    if (input.insulation === "excellent" || input.insulation === "good") q -= 10;
    if (input.below === "ground" || input.below === "outdoor" || input.below === "unheated") q += 15;
    if (input.goal === "main" && area > 0) {
      const need = loss.watts / (area * Math.max(eta, 0.55));
      q = Math.max(q, need);
    }
    const floorMin = input.goal === "main" ? 110 : 90;
    return clamp(q, floorMin, covering.hardMaxQ);
  }

  function zoneOf(input, area) {
    const roomPoly = input.shape && input.shape.length >= 3 ? input.shape : rectShape(input.length, input.width);
    if (input.areaMode === "percent") {
      const scale = Math.sqrt(input.percent / 100);
      const w = input.length * scale;
      const h = input.width * scale;
      const x = (input.length - w) / 2;
      const y = (input.width - h) / 2;
      return {
        rect: { x: x, y: y, w: w, h: h },
        obstacles: [],
        area: area,
        poly: rectShape(w, h).map(function (p) { return { x: p.x + x, y: p.y + y }; })
      };
    }
    return {
      rect: { x: 0, y: 0, w: input.length, h: input.width },
      obstacles: input.obstacles,
      area: area,
      poly: roomPoly
    };
  }

  function subtractIntervals(x0, x1, y0, y1, obstacles, pad) {
    let parts = [[x0, x1]];
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      const oy0 = o.y - pad;
      const oy1 = o.y + o.h + pad;
      if (oy1 <= y0 || oy0 >= y1) continue;
      const ox0 = o.x - pad;
      const ox1 = o.x + o.w + pad;
      const next = [];
      for (let p = 0; p < parts.length; p++) {
        const a = parts[p][0];
        const b = parts[p][1];
        if (ox1 <= a || ox0 >= b) { next.push(parts[p]); continue; }
        if (ox0 > a + 0.12) next.push([a, Math.min(b, ox0)]);
        if (ox1 < b - 0.12) next.push([Math.max(a, ox1), b]);
      }
      parts = next.filter(function (seg) { return seg[1] - seg[0] > 0.18; });
    }
    return parts;
  }

  function transposeRect(r) { return { x: r.y, y: r.x, w: r.h, h: r.w }; }
  function transposeOb(o) { return { name: o.name, x: o.y, y: o.x, w: o.h, h: o.w }; }
  function transposePt(p) { return { x: p.y, y: p.x }; }

  function stripsAlongX(rect, obstacles, stripW, gap, cut, maxLen, pad) {
    const margin = 0.05;
    const yStart = rect.y + margin;
    const yEnd = rect.y + rect.h - margin;
    const xStart = rect.x + margin;
    const xEnd = rect.x + rect.w - margin;
    const bands = [];
    if (stripW < 0.05 || xEnd - xStart < 0.2 || yEnd - yStart < stripW * 0.8) return bands;
    for (let y = yStart; y + stripW <= yEnd + 0.03; y += stripW + gap) {
      const segs = subtractIntervals(xStart, xEnd, y, y + stripW, obstacles, pad);
      for (let s = 0; s < segs.length; s++) {
        const a = segs[s][0];
        const b = segs[s][1];
        if (!cut) {
          bands.push({ x: a, y: y, w: b - a, h: stripW });
          continue;
        }
        let x = a;
        while (x + cut <= b + 0.001) {
          let len = Math.min(maxLen, b - x);
          len = Math.floor((len + 0.001) / cut) * cut;
          if (len < cut - 0.001) break;
          bands.push({ x: x, y: y, w: len, h: stripW });
          x += len;
        }
      }
    }
    return bands;
  }

  function orientBands(bands, along) {
    if (along !== "y") return bands;
    return bands.map(function (b) { return { x: b.y, y: b.x, w: b.h, h: b.w, circuit: b.circuit }; });
  }

  function makeStrips(rect, obstacles, stripW, gap, cut, maxLen, pad, along) {
    if (along === "y") {
      const raw = stripsAlongX(transposeRect(rect), obstacles.map(transposeOb), stripW, gap, cut, maxLen, pad);
      return orientBands(raw, "y");
    }
    return stripsAlongX(rect, obstacles, stripW, gap, cut, maxLen, pad);
  }

  function coverStrips(rect, obstacles, stripW, pad, edgeGap) {
    const margin = edgeGap == null ? 0.05 : edgeGap;
    const y0 = rect.y + margin;
    const y1 = rect.y + rect.h - margin;
    const x0 = rect.x + margin;
    const x1 = rect.x + rect.w - margin;
    const marks = [y0, y1];
    obstacles.forEach(function (o) {
      marks.push(clamp(o.y - pad, y0, y1), clamp(o.y + o.h + pad, y0, y1));
    });
    marks.sort(function (a, b) { return a - b; });
    const lines = [];
    marks.forEach(function (y) {
      if (!lines.length || y - lines[lines.length - 1] > 0.04) lines.push(y);
    });
    const bands = [];
    for (let i = 0; i < lines.length - 1; i++) {
      const yStart = lines[i];
      const yEnd = lines[i + 1];
      const space = yEnd - yStart;
      if (space < 0.18) continue;
      const full = Math.floor((space + 0.001) / stripW);
      const rem = space - full * stripW;
      const endsOnObstacle = yEnd < y1 - 0.03;
      let y = yStart;
      if (endsOnObstacle && full >= 1 && rem > 0.08) y = yEnd - full * stripW;
      while (yEnd - y > 0.18) {
        const h = Math.min(stripW, yEnd - y);
        if (h < stripW - 0.04) break;
        const segs = subtractIntervals(x0, x1, y + 0.001, y + h - 0.001, obstacles, 0);
        for (let s = 0; s < segs.length; s++) {
          const w = segs[s][1] - segs[s][0];
          if (w < 0.4) continue;
          bands.push({ x: segs[s][0], y: y, w: w, h: h });
        }
        y += h;
      }
    }
    return bands;
  }

  function bandArea(list) {
    let s = 0;
    for (let i = 0; i < list.length; i++) s += list[i].w * list[i].h;
    return s;
  }

  function sortFromWall(bands, wall) {
    const arr = bands.slice();
    arr.sort(function (a, b) {
      if (wall === "top") return (b.y - a.y) || (a.x - b.x);
      if (wall === "left") return (a.x - b.x) || (a.y - b.y);
      if (wall === "right") return (b.x - a.x) || (a.y - b.y);
      return (a.y - b.y) || (a.x - b.x);
    });
    return arr;
  }

  function trimBands(bands, areaNeeded) {
    const out = [];
    let acc = 0;
    for (let i = 0; i < bands.length && acc < areaNeeded - 0.02; i++) {
      const b = bands[i];
      const a = b.w * b.h;
      if (acc + a <= areaNeeded + 0.04) {
        out.push({ x: b.x, y: b.y, w: b.w, h: b.h });
        acc += a;
      } else {
        const remain = areaNeeded - acc;
        if (remain > 0.08 && b.h > 0) out.push({ x: b.x, y: b.y, w: remain / b.h, h: b.h });
        break;
      }
    }
    return out;
  }

  function segmentHits(a, b, obstacles, pad) {
    const steps = 8;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      for (let k = 0; k < obstacles.length; k++) {
        const o = obstacles[k];
        if (x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad) return true;
      }
    }
    return false;
  }

  function snake(rect, obstacles, stepM, forceAlong, poly) {
    const along = forceAlong || (rect.w >= rect.h ? "x" : "y");
    if (along === "y") {
      const swapped = snake(
        transposeRect(rect),
        obstacles.map(transposeOb),
        stepM,
        "x",
        poly ? poly.map(transposePt) : null
      );
      return {
        along: "y",
        paths: swapped.paths.map(function (path) { return path.map(transposePt); })
      };
    }
    const rowGap = Math.max(0.05, stepM / 2);
    const turn = stepM * 0.82;
    const endGap = 0.05 + turn;
    const y0 = rect.y + rowGap;
    const y1 = rect.y + rect.h - rowGap;
    if (y1 < y0 || rect.w < 0.3) return { along: "x", paths: [] };
    const rows = [];
    for (let y = y0; y <= y1 + 0.001; y += stepM) {
      const yy = Math.min(y, y1);
      if (rows.length && yy - rows[rows.length - 1].y < stepM * 0.62) continue;
      let spans = poly ? polySpans(poly, yy) : [[rect.x, rect.x + rect.w]];
      const clipped = [];
      spans.forEach(function (seg) {
        const a = Math.max(seg[0], rect.x) + endGap;
        const b = Math.min(seg[1], rect.x + rect.w) - endGap;
        if (b - a > 0.22) clipped.push([a, b]);
      });
      let segs = [];
      clipped.forEach(function (seg) {
        subtractIntervals(seg[0], seg[1], yy - 0.002, yy + 0.002, obstacles, 0.05).forEach(function (part) {
          if (part[1] - part[0] > 0.22) segs.push(part);
        });
      });
      if (segs.length) rows.push({ y: yy, segs: segs });
      if (rows.length > 420) break;
    }

    function orientSeg(seg, preferRight, from) {
      let startX = preferRight ? seg[0] : seg[1];
      let endX = preferRight ? seg[1] : seg[0];
      if (from) {
        const dStart = Math.abs(from.x - seg[0]);
        const dEnd = Math.abs(from.x - seg[1]);
        if (dEnd + 0.02 < dStart) {
          startX = seg[1];
          endX = seg[0];
        } else if (dStart + 0.02 < dEnd) {
          startX = seg[0];
          endX = seg[1];
        }
      }
      return [startX, endX];
    }

    function canJoin(from, x, y) {
      if (!from) return true;
      const dest = { x: x, y: y };
      const jump = Math.hypot(from.x - dest.x, from.y - dest.y);
      if (jump > Math.max(0.55, stepM * 3)) return false;
      return !segmentHits(from, dest, obstacles, 0.03);
    }

    function trace(source, preferRight) {
      const path = [];
      const used = source.map(function () { return -1; });
      let pref = preferRight;
      for (let r = 0; r < source.length; r++) {
        const row = source[r];
        const from = path.length ? path[path.length - 1] : null;
        let best = -1;
        let bestJump = Infinity;
        let bestPair = null;
        for (let i = 0; i < row.segs.length; i++) {
          const pair = orientSeg(row.segs[i], pref, from);
          if (!canJoin(from, pair[0], row.y)) continue;
          const jump = from ? Math.hypot(from.x - pair[0], from.y - row.y) : 0;
          if (jump < bestJump) {
            best = i;
            bestJump = jump;
            bestPair = pair;
          }
        }
        if (best < 0) break;
        used[r] = best;
        path.push({ x: bestPair[0], y: row.y }, { x: bestPair[1], y: row.y });
        pref = bestPair[1] < bestPair[0];
      }
      return { path: path, used: used };
    }

    function withoutUsed(source, used) {
      const next = [];
      source.forEach(function (row, r) {
        const segs = row.segs.filter(function (_, i) { return i !== used[r]; });
        if (segs.length) next.push({ y: row.y, segs: segs });
      });
      return next;
    }

    const paths = [];
    let pending = rows;
    while (pending.length) {
      const right = trace(pending, true);
      const left = trace(pending, false);
      const best = left.path.length > right.path.length ? left : right;
      if (best.path.length < 4 && best.path.length < 2) break;
      if (best.path.length >= 4) paths.push(best.path);
      else if (best.path.length >= 2 && pending.length === 1) break;
      const next = withoutUsed(pending, best.used);
      if (next.length === pending.length) break;
      pending = next;
    }
    return { along: "x", paths: stitchPaths(paths, obstacles, poly, stepM) };
  }

  function wallDist(pt, wall, rect) {
    if (wall === "bottom") return pt.y - rect.y;
    if (wall === "top") return rect.y + rect.h - pt.y;
    if (wall === "left") return pt.x - rect.x;
    return rect.x + rect.w - pt.x;
  }

  function orientPaths(paths, rect, wall) {
    if (!paths.length || !paths[0].length) return paths;
    const first = paths[0][0];
    const lastPath = paths[paths.length - 1];
    const last = lastPath[lastPath.length - 1];
    if (wallDist(last, wall, rect) + 0.08 < wallDist(first, wall, rect)) {
      return paths.map(function (p) { return p.slice().reverse(); }).reverse();
    }
    return paths;
  }

  function splitRect(rect, n, along) {
    const parts = [];
    if (n <= 1) return [rect];
    if (along === "x") {
      const h = rect.h / n;
      for (let i = 0; i < n; i++) parts.push({ x: rect.x, y: rect.y + i * h, w: rect.w, h: h });
    } else {
      const w = rect.w / n;
      for (let i = 0; i < n; i++) parts.push({ x: rect.x + i * w, y: rect.y, w: w, h: rect.h });
    }
    return parts;
  }

  function inward(rect, wall, dist) {
    if (wall === "bottom") return { x: rect.x + rect.w / 2, y: rect.y + dist };
    if (wall === "top") return { x: rect.x + rect.w / 2, y: rect.y + rect.h - dist };
    if (wall === "left") return { x: rect.x + dist, y: rect.y + rect.h / 2 };
    return { x: rect.x + rect.w - dist, y: rect.y + rect.h / 2 };
  }

  function inRect(p, rect, inset) {
    return p.x > rect.x + inset && p.x < rect.x + rect.w - inset && p.y > rect.y + inset && p.y < rect.y + rect.h - inset;
  }

  function inObstacle(p, obstacles, pad) {
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (p.x > o.x - pad && p.x < o.x + o.w + pad && p.y > o.y - pad && p.y < o.y + o.h + pad) return true;
    }
    return false;
  }

  function placeSensor(room, wall, obstacles, poly) {
    const stat = thermostatPoint(room, wall, obstacles, poly);
    const shifts = [0, 0.16, -0.16, 0.34, -0.34, 0.55, -0.55, 0.8, -0.8, 1.1, -1.1, 1.4, -1.4];
    for (let dist = 0.3; dist <= 0.52; dist += 0.04) {
      for (let s = 0; s < shifts.length; s++) {
        const p = inward(room, wall, dist);
        if (wall === "left" || wall === "right") p.y = clamp(stat.y + shifts[s], room.y + 0.18, room.y + room.h - 0.18);
        else p.x = clamp(stat.x + shifts[s], room.x + 0.18, room.x + room.w - 0.18);
        if (poly && poly.length >= 3 && !pointInPoly(p.x, p.y, poly)) continue;
        if (!inRect(p, room, 0.12)) continue;
        if (inObstacle(p, obstacles, 0.08)) continue;
        return p;
      }
    }
    const fallback = inward(room, wall, 0.4);
    if (wall === "left" || wall === "right") fallback.y = clamp(stat.y, room.y + 0.2, room.y + room.h - 0.2);
    else fallback.x = clamp(stat.x, room.x + 0.2, room.x + room.w - 0.2);
    return fallback;
  }

  function onBand(p, bands) {
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      if (p.x >= b.x + 0.05 && p.x <= b.x + b.w - 0.05 && p.y >= b.y + 0.05 && p.y <= b.y + b.h - 0.05) return true;
    }
    return false;
  }

  function seatSensor(sensor, stat, bands, wall) {
    if (!bands.length || onBand(sensor, bands)) return sensor;
    const horizontal = wall === "bottom" || wall === "top";
    let best = null;
    let bestScore = Infinity;
    bands.forEach(function (b) {
      if (b.w < 0.22 || b.h < 0.22) return;
      const cx = clamp(horizontal ? stat.x : sensor.x, b.x + 0.08, b.x + b.w - 0.08);
      const cy = clamp(horizontal ? sensor.y : stat.y, b.y + 0.08, b.y + b.h - 0.08);
      const along = horizontal ? Math.abs(cx - stat.x) : Math.abs(cy - stat.y);
      const into = horizontal ? Math.abs(cy - sensor.y) : Math.abs(cx - sensor.x);
      const score = along * 5 + into;
      if (score < bestScore) {
        bestScore = score;
        best = { x: cx, y: cy };
      }
    });
    return best || sensor;
  }

  function thermostatPoint(rect, wall, obstacles, poly) {
    const out = 0.32;
    const horizontal = wall === "bottom" || wall === "top";
    const mid = horizontal ? rect.x + rect.w / 2 : rect.y + rect.h / 2;
    const limit0 = horizontal ? rect.x + 0.28 : rect.y + 0.28;
    const limit1 = horizontal ? rect.x + rect.w - 0.28 : rect.y + rect.h - 0.28;
    const shifts = [0, 0.25, -0.25, 0.5, -0.5, 0.8, -0.8, 1.15, -1.15, 1.5, -1.5];
    let along = clamp(mid, limit0, limit1);
    for (let i = 0; i < shifts.length; i++) {
      const trial = clamp(mid + shifts[i], limit0, limit1);
      const probe = inward(rect, wall, 0.35);
      if (horizontal) probe.x = trial;
      else probe.y = trial;
      if (!inRect(probe, rect, 0.08)) continue;
      if (poly && poly.length >= 3 && !pointInPoly(probe.x, probe.y, poly)) continue;
      if (obstacles && inObstacle(probe, obstacles, 0.06)) continue;
      along = trial;
      break;
    }
    if (wall === "bottom") return { x: along, y: rect.y - out, wall: wall };
    if (wall === "top") return { x: along, y: rect.y + rect.h + out, wall: wall };
    if (wall === "left") return { x: rect.x - out, y: along, wall: wall };
    return { x: rect.x + rect.w + out, y: along, wall: wall };
  }

  function maxStripLen(specific, width) {
    const aPerM = specific * width / 230;
    const byCurrent = aPerM > 0 ? 8 / aPerM : 8;
    const cap = width >= 0.9 ? 8 : 10;
    return Math.max(1, Math.floor(Math.min(cap, byCurrent) / 0.25) * 0.25);
  }

  function rankPacks(packs, area) {
    packs.sort(function (a, b) {
      const aGap = area - a.covered;
      const bGap = area - b.covered;
      const similar = Math.abs(aGap - bGap) < 0.35;
      if (similar && a.n !== b.n) return a.n - b.n;
      if (b.covered !== a.covered) return b.covered - a.covered;
      return a.n - b.n;
    });
    return packs[0] || null;
  }

  function matPacks(products, area) {
    const items = products.slice().sort(function (a, b) { return a.area - b.area; });
    const packs = [];
    function push(arr) {
      let covered = 0;
      let power = 0;
      for (let i = 0; i < arr.length; i++) { covered += arr[i].area; power += arr[i].power; }
      if (covered > area + 0.05) return;
      if (covered < Math.min(area * 0.72, area - 0.05) && covered < area - 0.4) return;
      if (covered < 0.4) return;
      packs.push({ products: arr.slice(), covered: covered, power: power, n: arr.length });
    }
    for (let i = 0; i < items.length; i++) push([items[i]]);
    for (let i = 0; i < items.length; i++) {
      for (let j = i; j < items.length; j++) push([items[i], items[j]]);
    }
    const largest = items.length ? items[items.length - 1].area : 0;
    if (area > largest + 0.15) {
      for (let i = 0; i < items.length; i++) {
        for (let j = i; j < items.length; j++) {
          for (let k = j; k < items.length; k++) push([items[i], items[j], items[k]]);
        }
      }
    }
    return rankPacks(packs, area);
  }

  function collapsePieces(pieces) {
    const out = [];
    pieces.forEach(function (p) {
      const found = out.filter(function (x) { return x.sku === p.sku && x.power === p.power; })[0];
      if (found) found.qty += 1;
      else out.push({
        sku: p.sku,
        name: p.name,
        qty: 1,
        power: p.power,
        area: p.area,
        length: p.length
      });
    });
    return out;
  }

  function packCircuits(loads) {
    const items = loads.slice().sort(function (a, b) { return b - a; });
    const bins = [];
    items.forEach(function (w) {
      let bin = null;
      for (let i = 0; i < bins.length; i++) {
        if (bins[i].sum + w <= D.CIRCUIT_LIMIT_W + 0.1) { bin = bins[i]; break; }
      }
      if (!bin) {
        bin = { sum: 0, loads: [] };
        bins.push(bin);
      }
      bin.sum += w;
      bin.loads.push(w);
    });
    return bins;
  }

  function feederFor(watts) {
    const amps = watts / 230;
    if (watts <= 2000) return { mm2: 1.5, breaker: 10, amps: amps };
    if (watts <= 3600) return { mm2: 2.5, breaker: 16, amps: amps };
    if (watts <= 5700) return { mm2: 4, breaker: 25, amps: amps };
    return { mm2: 6, breaker: 32, amps: amps };
  }

  function baseOption(line, extra) {
    return {
      lineId: line.id,
      type: line.kind,
      brand: line.brand,
      brandName: line.brandName,
      title: line.title,
      blurb: line.blurb,
      pros: (line.pros || []).slice(),
      cons: (line.cons || []).slice(),
      needsScreed: !!line.needsScreed,
      selfReg: !!line.selfReg,
      coldLead: line.coldLead || 0,
      fixedStep: line.stepCm || null,
      badFit: false,
      overSoft: false
    };
  }

  function filmAllowed(line, input, covering) {
    const onTile = covering.id === "tile" || covering.id === "porcelain";
    if (onTile && input.system !== "film" && input.forceLine !== line.id) return false;
    const density = line.selfReg ? line.specificRun : line.specificCold;
    if (density > covering.hardMaxQ + 0.5) return false;
    return true;
  }

  function buildMat(line, ctx) {
    if (line.specific > ctx.covering.hardMaxQ + 0.5) return null;
    const pack = matPacks(line.products, ctx.area);
    if (!pack) return null;
    const opt = baseOption(line);
    opt.products = pack.products;
    opt.covered = pack.covered;
    opt.power = pack.power;
    opt.powerRun = pack.power;
    opt.specific = line.specific;
    opt.pieceCount = pack.n;
    opt.overSoft = line.specific > ctx.covering.softMaxQ + 0.5;
    return opt;
  }

  function buildCable(line, ctx) {
    let best = null;
    const maxN = Math.min(6, Math.max(1, Math.ceil(ctx.area / 1.2)));
    for (let n = 1; n <= maxN; n++) {
      const part = ctx.area / n;
      for (let i = 0; i < line.products.length; i++) {
        const section = line.products[i];
        const step = (part * 100) / section.length;
        if (step < line.stepMin - 0.05 || step > line.stepMax + 0.05) continue;
        const q = section.power / part;
        if (q > ctx.covering.hardMaxQ + 1 || q < 80) continue;
        const inner = Math.abs(q - ctx.targetQ) + (n - 1) * 10;
        if (!best || inner < best.inner) {
          const products = [];
          for (let k = 0; k < n; k++) products.push(section);
          best = {
            inner: inner,
            products: products,
            stepCm: step,
            specific: (section.power * n) / ctx.area,
            power: section.power * n,
            n: n
          };
        }
      }
    }
    if (!best) return null;
    const opt = baseOption(line);
    opt.products = best.products;
    opt.covered = ctx.area;
    opt.power = best.power;
    opt.powerRun = best.power;
    opt.specific = best.specific;
    opt.stepCm = best.stepCm;
    opt.pieceCount = best.n;
    opt.overSoft = best.specific > ctx.covering.softMaxQ + 0.5;
    let tape = Math.round(best.stepCm / line.stepGrid) * line.stepGrid;
    tape = clamp(tape, line.stepMin, line.stepMax);
    opt.tapeCm = tape;
    return opt;
  }

  function buildFilm(line, ctx) {
    if (!filmAllowed(line, ctx.input, ctx.covering)) return null;
    const along = ctx.zone.rect.w >= ctx.zone.rect.h ? "x" : "y";
    const maxLen = maxStripLen(line.specificCold, ctx.input.filmWidth);
    const bands = makeStrips(ctx.zone.rect, ctx.zone.obstacles, ctx.input.filmWidth, 0.02, 0.25, maxLen, 0.04, along);
    const covered = bandArea(bands);
    if (covered < Math.min(0.45, ctx.area * 0.35)) return null;
    const opt = baseOption(line);
    opt.covered = covered;
    opt.power = covered * line.specificCold;
    opt.powerRun = covered * line.specificRun;
    opt.specific = line.specificRun;
    opt.filmBands = bands;
    opt.along = along;
    opt.maxStrip = maxLen;
    opt.overSoft = line.specificRun > ctx.covering.softMaxQ + 0.5;
    const onTile = ctx.covering.id === "tile" || ctx.covering.id === "porcelain";
    opt.badFit = onTile || (ctx.room.wet && line.kind === "film");
    const pieceArea = Math.min(covered, D.CIRCUIT_LIMIT_W / line.specificCold);
    const n = Math.max(1, Math.ceil(covered / pieceArea - 1e-6));
    const products = [];
    for (let i = 0; i < n; i++) {
      const area = covered / n;
      products.push({
        sku: line.id + "-cut",
        name: line.title + ", " + ru(area, 2) + " м²",
        area: area,
        power: area * line.specificCold,
        length: null
      });
    }
    opt.products = products;
    opt.pieceCount = n;
    return opt;
  }

  function finishOption(opt, ctx) {
    const v = voltageFactor(ctx.input.voltage, opt.selfReg);
    opt.voltageFactor = v;
    opt.powerAtVoltage = opt.powerRun * v;
    const qUp = Math.min(ctx.qSurface, opt.specific * ctx.eta * v);
    opt.usefulW = qUp * opt.covered;
    opt.surfaceLimited = opt.specific * ctx.eta * v > ctx.qSurface + 3;
    opt.zoneArea = ctx.area;
    const loads = opt.products.map(function (p) { return p.power; });
    opt.circuits = packCircuits(loads);
    opt.feeder = feederFor(opt.power);
    opt.pieces = collapsePieces(opt.products);
    opt.pieces.forEach(function (p) {
      p.resistance = opt.selfReg ? null : (230 * 230) / p.power;
      p.amps = p.power / 230;
    });
    if (opt.overSoft) opt.cons = opt.cons.concat(["Для этого покрытия мощность на верхней границе. Предел температуры на регуляторе обязателен."]);
    if (opt.surfaceLimited) opt.cons = opt.cons.concat(["В комнату придёт меньше паспортных ватт: пол упрётся в допустимую температуру поверхности."]);
    if (opt.pieceCount > 1) opt.cons = opt.cons.concat(["Несколько контуров: у каждого свой холодный конец и свой датчик, если контуров больше, чем тянет один регулятор."]);
    if (opt.needsScreed && ctx.input.screed === "no") opt.cons = opt.cons.concat(["Производитель закладывает стяжку не меньше 3 см. Для ремонта без подъёма пола этот кабель не подходит."]);
    const gap = ctx.area - opt.covered;
    if (opt.type === "mat" && gap > 0.25) {
      opt.cons = opt.cons.concat(["Свободными останутся около " + ru(gap, 2) + " м²: готовый мат меньше зоны, кабель на нём не наращивают."]);
    }
    return opt;
  }

  function scoreOption(opt, ctx) {
    let s = 100;
    s -= Math.abs(opt.specific - ctx.targetQ) * 0.45;
    const cover = ctx.area > 0 ? opt.covered / ctx.area : 0;
    s -= (1 - Math.min(1, cover)) * 70;
    s -= Math.max(0, opt.pieceCount - 1) * 6;
    if (ctx.input.brand === opt.brand) s += 8;
    if (ctx.input.brand === "either" && opt.brand === "warmehaus") s += 3;
    if (ctx.input.goal === "main") {
      const gap = ctx.loss.watts - opt.usefulW;
      if (gap > 0) s -= Math.min(45, gap / 25);
      else s += 8;
    } else if (opt.specific > ctx.targetQ) {
      s -= (opt.specific - ctx.targetQ) * 0.25;
    }
    if (opt.type === "mat" && opt.pieceCount === 1 && cover >= 0.9 && ctx.covering.prefers === "mat") s += 14;
    if (opt.type === "film" && ctx.covering.prefers === "film") s += 18;
    if (ctx.covering.prefers === "film" && opt.type !== "film") {
      s -= ctx.input.screed === "yes" ? 14 : 26;
    }
    if (opt.type === "cable" && ctx.input.obstacles.length >= 2) s += 10;
    if (opt.selfReg && ctx.input.goal === "comfort") s += 6;
    if (opt.needsScreed && ctx.input.screed === "no") s -= 30;
    else if (opt.needsScreed && ctx.input.screed === "unknown") s -= 12;
    else if (opt.needsScreed && ctx.input.screed === "yes") s += 6;
    if (opt.type === "film" && ctx.room.wet) s -= 38;
    if (opt.overSoft) s -= 12;
    if (opt.badFit) s -= 25;
    if (ctx.input.system !== "auto" && opt.type !== ctx.input.system) s -= 400;
    if (ctx.input.forceLine && opt.lineId === ctx.input.forceLine) s += 1000;
    opt.score = s;
    return s;
  }

  function wallName(wall, grammatical) {
    const map = {
      bottom: ["нижней", "нижнюю"],
      top: ["верхней", "верхнюю"],
      left: ["левой", "левую"],
      right: ["правой", "правую"]
    };
    return map[wall][grammatical || 0];
  }

  function limitTemp(input, covering, loss) {
    if ((input.roomType === "bath" || D.ROOMS[input.roomType].wet) && covering.surfaceWet) return covering.surfaceWet;
    return covering.surface;
  }

  function thermostatText(opt, input, limitC) {
    const n = opt.circuits.length;
    let model;
    if (opt.brand === "grandmeyer") {
      model = input.goal === "main"
        ? "Grand Meyer HW-500 (пол и воздух, расписание). Для простого комфорта хватает MST-1, для управления с телефона — W350."
        : "Grand Meyer MST-1 с датчиком пола. Расписание нужно — берите HW-500.";
    } else {
      model = input.goal === "main"
        ? "программируемый терморегулятор WÄRMEHAUS с датчиком пола и воздуха."
        : "терморегулятор WÄRMEHAUS с выносным датчиком пола.";
    }
    return (n === 1 ? "Один регулятор: " : ru(n, 0) + " регулятора: ") + model + " Коммутация до 16 А. Предел пола выставьте на " + ru(limitC, 0) + " °C. Регулятор другой марки тоже подойдёт, если у него есть выносной датчик пола и он держит этот ток.";
  }

  function shoppingSentence(opt) {
    const bits = opt.pieces.map(function (p) {
      const qty = p.qty > 1 ? ru(p.qty, 0) + " × " : "";
      const size = p.length ? ru(p.length, 1) + " м, " + ru(p.power, 0) + " Вт" : (p.area ? ru(p.area, 2) + " м², " + ru(p.power, 0) + " Вт" : ru(p.power, 0) + " Вт");
      return qty + p.name + " (" + size + ")";
    });
    return bits.join("; ");
  }

  function electricSentence(opt, limitC) {
    const amps = opt.power / 230;
    const n = opt.circuits.length;
    let s = "паспорт " + ru(opt.power, 0) + " Вт, ток " + ru(amps, 1) + " А";
    if (n === 1) {
      s += ", автомат C" + opt.feeder.breaker + ", медь " + ru(opt.feeder.mm2, 1) + " мм²";
    } else {
      s += ", " + ru(n, 0) + " линии, на каждую автомат не выше C16 и медь 2,5 мм², пока контур до 3,2 кВт";
    }
    s += ", УЗО 30 мА тип A, предел пола " + ru(limitC, 0) + " °C";
    return s;
  }

  function tapeMeters(rect, along) {
    if (along === "y") return (Math.floor(rect.h / 0.5) + 1) * rect.w;
    return (Math.floor(rect.w / 0.5) + 1) * rect.h;
  }

  function buildGeometry(opt, ctx) {
    const room = { x: 0, y: 0, w: ctx.input.length, h: ctx.input.width };
    const zone = ctx.zone.rect;
    const poly = ctx.zone.poly;
    const obstacles = ctx.zone.obstacles;
    const wall = ctx.input.statWall;
    let paths = [];
    let bands = [];
    let along = zone.w >= zone.h ? "x" : "y";
    if (opt.type === "cable" && opt.stepCm) {
      const stepM = opt.stepCm / 100;
      const parts = splitRect(zone, opt.pieceCount, along);
      parts.forEach(function (part, index) {
        const sn = snake(part, obstacles, stepM, along, poly);
        const oriented = orientPaths(sn.paths, part, wall);
        oriented.forEach(function (path) {
          if (path.length < 2) return;
          paths.push(path.map(function (p) { return { x: p.x, y: p.y, circuit: index + 1 }; }));
        });
      });
    } else if (opt.type === "mat") {
      if (zone.h > zone.w) {
        along = "y";
        const raw = coverStrips(transposeRect(zone), obstacles.map(transposeOb), 0.5, 0.05);
        bands = trimBands(sortFromWall(orientBands(raw, "y"), wall), opt.covered);
      } else {
        along = "x";
        bands = trimBands(sortFromWall(coverStrips(zone, obstacles, 0.5, 0.05), wall), opt.covered);
      }
    } else if (opt.type === "film") {
      along = opt.along || along;
      bands = sortFromWall(opt.filmBands || [], wall);
    }
    if (poly && !axisRect(poly)) bands = clipBands(bands, poly);
    let acc = 0;
    const pieceAreas = opt.products.map(function (p) { return p.area || (p.length ? ctx.area / opt.pieceCount : opt.covered); });
    let pi = 0;
    let left = pieceAreas[0] || opt.covered;
    bands = bands.map(function (b) {
      const band = { x: b.x, y: b.y, w: b.w, h: b.h, circuit: pi + 1 };
      acc += b.w * b.h;
      left -= b.w * b.h;
      if (left <= 0.08 && pi < pieceAreas.length - 1) {
        pi += 1;
        left = pieceAreas[pi];
      }
      return band;
    });
    const stat = thermostatPoint(room, wall, ctx.input.obstacles || [], poly);
    const sensor = seatSensor(placeSensor(room, wall, ctx.input.obstacles || [], poly), stat, bands, wall);
    let start = null;
    if (paths.length && paths[0].length) start = { x: paths[0][0].x, y: paths[0][0].y };
    else if (bands.length) {
      let bestD = Infinity;
      bands.forEach(function (b) {
        [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].forEach(function (c) {
          const d = Math.hypot(c[0] - stat.x, c[1] - stat.y);
          if (d < bestD) {
            bestD = d;
            start = { x: c[0], y: c[1] };
          }
        });
      });
    }
    return {
      room: room,
      zone: zone,
      poly: poly,
      gap: 0.05,
      obstacles: ctx.input.areaMode === "obstacles" ? ctx.input.obstacles : [],
      paths: paths,
      bands: bands,
      along: along,
      stepM: opt.stepCm ? opt.stepCm / 100 : (opt.fixedStep ? opt.fixedStep / 100 : null),
      sensor: sensor,
      thermostat: stat,
      start: start,
      kind: opt.type
    };
  }

  function layersFor(opt, input, covering) {
    const coldBelow = input.below !== "heated";
    if (opt.type === "film") {
      const layers = [
        { t: "Ровное основание", d: "Стяжка или настил без ям и мусора. Плёнка не должна висеть над пустотой." },
        { t: "Подложка под инфракрасную плёнку", d: "Отражающая, с лавсановым покрытием, 3 мм. Голую алюминиевую фольгу не кладите: она может замкнуть медные шины." },
        { t: opt.title, d: "Полосы шириной " + ru(input.filmWidth * 100, 0) + " см, не внахлёст. Резать только по линии отреза, шаг 25 см. До стены около 5 см, между полосами около 2 см." },
        { t: "Полиэтилен", d: "Сплошным полотном поверх плёнки, с нахлёстом. Он закрывает контакты от влаги и стяжки." }
      ];
      if (covering.hardLayer) layers.push({ t: "Жёсткий лист", d: "ГВЛ или фанера 6–8 мм. Линолеум и ковролин на плёнку напрямую не кладут." });
      layers.push({ t: covering.name, d: covering.note });
      return layers;
    }
    if (opt.needsScreed) {
      const xps = coldBelow ? "XPS 50 мм" : "XPS 20–30 мм";
      return [
        { t: "Плита", d: "Несущее основание, убранное от мусора." },
        { t: xps, d: coldBelow ? "Снизу холод. Этот слой экономит больше, чем спор о бренде кабеля." : "Даже над тёплой квартирой тонкий XPS уменьшает прогрев плиты. Если высоту жалко — можно без него, расход вырастет." },
        { t: "Плёнка и монтажная лента", d: "По утеплителю — разделительная плёнка. Ленту кладут поперёк будущих витков, примерно через каждые 0,5 м." },
        { t: opt.title, d: "Кабель в зажимах ленты, без пересечений. Муфта холодного конца лежит на полу, не в стене." },
        { t: "Стяжка минимум 3 см", d: "Над кабелем THC20 производитель указывает не меньше 3 см. Пока стяжка не набрала прочность, пол не включают. Ориентир для цемента — 28 суток." },
        { t: covering.name, d: covering.note }
      ];
    }
    const layers = [
      { t: "Готовая стяжка", d: "Обеспылить и загрунтовать. Клей по пыли не держит кабель." }
    ];
    if (coldBelow) {
      layers.push({ t: "Сначала утеплитель, если можно поднять пол", d: "XPS 30–50 мм и тонкая стяжка поверх. Клей и мат прямо на пенопласт не кладут: пол будет гулять." });
    } else {
      layers.push({ t: "Без толстого утеплителя", d: "Снизу тёплое помещение, уровень поднимать не нужно. Часть тепла уйдёт в перекрытие — для комфортного пола это обычная плата." });
    }
    layers.push({
      t: opt.title,
      d: opt.type === "mat"
        ? "Полосы сетки 50 см. Сетку режут и разворачивают, кабель не режут. Шаг на мате " + ru(opt.fixedStep, 0) + " см."
        : "Тонкий кабель в клее или в неглубокой штробе без воздушных карманов. Шаг держат постоянным."
    });
    layers.push({ t: "Клей или нивелир", d: "Закрыть кабель целиком, обычно 5–10 мм над жилой. Пустот под плиткой не оставлять." });
    layers.push({ t: covering.name, d: covering.note });
    return layers;
  }

  function stepsFor(opt, input, geometry, limitC) {
    const wall = wallName(input.statWall, 0);
    const steps = [];
    const blocked = input.areaMode === "obstacles" && input.obstacles.length
      ? input.obstacles.map(function (o) { return o.name.toLowerCase(); }).join(", ")
      : "";
    steps.push(blocked
      ? "Нарисуйте на полу зону обогрева. Не заходите под предметы без ножек: " + blocked + ". От стен и от этой мебели оставьте около 5 см."
      : "Нарисуйте на полу зону обогрева. От стен оставьте около 5 см. Под мебель без ножек нагреватель не заводите.");
    steps.push("Терморегулятор поставьте на " + wall + " стене, на высоте выключателя, в подрозетник. От него вниз — штроба под холодный конец и под гофру датчика. Рядом не должно быть стояка, духовки и сквозняка из двери: иначе датчик воздуха будет врать.");
    if (opt.type === "cable") {
      steps.push("Начинайте укладку от " + wall + " стены, с угла, куда выйдет штроба. " + (geometry.along === "x"
        ? "Витки ведите вдоль длинной стороны, по горизонтали на плане."
        : "Витки ведите вдоль длинной стороны, по вертикали на плане.") + " Шаг " + ru(opt.stepCm, 1) + " см между центрами жил.");
      if (Math.abs(opt.stepCm - opt.tapeCm) >= 0.4) {
        steps.push("Расчётный шаг " + ru(opt.stepCm, 1) + " см. Ближняя риска монтажной ленты — " + ru(opt.tapeCm, 1) + " см. Если на риске кабель не заканчивается ровно у края зоны, последний промежуток сделайте чуть иным. Кабель не подрезайте и не оставляйте бухтой.");
      } else {
        steps.push("Шаг совпадает с риской ленты " + ru(opt.tapeCm, 1) + " см. Держите его одинаковым на всей зоне, иначе появятся тёплые и холодные полосы.");
      }
      if (opt.pieceCount > 1) steps.push("Зона делится на " + ru(opt.pieceCount, 0) + " равные части, в каждой своя секция. Контуры не пересекайте и не заводите кабель из одной части в другую.");
    } else if (opt.type === "mat") {
      steps.push("Раскатайте мат от " + wall + " стены полосами по 50 см. Дошли до стены или до препятствия — режьте только сетку, разворачивайте полотно. Кабель, муфту и концевик не резать.");
      steps.push("Фабричный шаг кабеля на этом мате " + ru(opt.fixedStep, 0) + " см. Не растягивайте сетку, чтобы «дотянуть» до большей площади.");
    } else {
      steps.push("Разложите полосы плёнки шириной " + ru(input.filmWidth * 100, 0) + " см от " + wall + " стены. Длинная сторона полосы — вдоль длинной стороны комнаты. Одна полоса не длиннее " + ru(opt.maxStrip, 1) + " м, дальше шину не грузят, режут и подключают параллельно.");
      steps.push("Резать только по светлой линии отреза, кратно 25 см. Шины на срезе изолировать, контакты поставить на медную шину и обжать. Полосы соединяют параллельно, не последовательно.");
    }
    steps.push("Датчик пола кладут в гофре с заглушкой, между первыми витками, в 30–50 см от стены с регулятором и напротив него. Не по центру комнаты: гофра должна коротко дойти до подрозетника, чтобы датчик можно было вынуть. Не под ковёр, не вплотную к кабелю и не под мебель.");
    if (opt.coldLead) steps.push("Холодный конец " + ru(opt.coldLead, 1) + " м. Муфта остаётся на полу в зоне обогрева. В стену уходит только холодный провод. Если длины не хватает до регулятора, его наращивают обычным медным проводом, греющую часть не трогают.");
    steps.push("До заливки и после неё измерьте сопротивление каждого контура и сравните с паспортом. Ориентир по закону Ома на " + ru(input.voltage, 0) + " В указан в списке секций. Включите секцию на минуту, убедитесь, что греет, и снова выключите.");
    steps.push("Не включайте пол, пока клей или стяжка не наберут прочность. На регуляторе сразу поставьте предел " + ru(limitC, 0) + " °C. Питание — отдельная линия с УЗО 30 мА. Кабель на полу не пересекать, не укорачивать и не укладывать вплотную ближе допуска производителя.");
    if (opt.pieceCount > 1 && opt.circuits.length > 1) {
      steps.push("На один терморегулятор — не больше 3,2 кВт и 16 А. Здесь контуры разведены на " + ru(opt.circuits.length, 0) + " регулятора. У каждой зоны свой датчик пола.");
    }
    return steps;
  }

  function directionText(opt, input, geometry) {
    const wall = wallName(input.statWall, 0);
    if (opt.type === "cable") {
      return "Кладите кабель змейкой от " + wall + " стены. " + (geometry.along === "x"
        ? "Витки идут по горизонтали плана, шаг отмеряется по вертикали."
        : "Витки идут по вертикали плана, шаг отмеряется по горизонтали.") + " Старт — у штробы терморегулятора, дальше разворот у края зоны.";
    }
    if (opt.type === "mat") {
      return "Раскатайте мат от " + wall + " стены полосами 50 см и обойдите мебель поворотом сетки. Начинайте так, чтобы муфта оказалась у штробы.";
    }
    return "Полосы плёнки кладите от " + wall + " стены. Не накрывайте ими мебель без ножек и не заводите под стены.";
  }

  function whyText(opt, ctx) {
    const covering = ctx.covering;
    const goal = ctx.input.goal === "main" ? "основного отопления" : "комфортного подогрева";
    if (opt.type === "film") {
      return "Под " + (covering.under || covering.short.toLowerCase()) + " для " + goal + " лучше сухая плёнка: пол не заливают, а температуру держат датчиком на " + ru(ctx.limitC, 0) + " °C.";
    }
    if (opt.type === "mat") {
      return "Под " + (covering.under || covering.short.toLowerCase()) + " для " + goal + " удобнее мат: шаг уже ровный, стяжка не нужна, площадь попадает в готовый кусок.";
    }
    if (opt.needsScreed) {
      return "Под " + (covering.under || covering.short.toLowerCase()) + " при заливке стяжки кабель " + opt.title + " точнее попадает в нужные ватты за счёт шага.";
    }
    return "Под " + (covering.under || covering.short.toLowerCase()) + " кабель лучше мата: зону неудобно закрыть одним готовым полотном, а шагом набирается нужная мощность.";
  }

  function energyFor(opt, ctx) {
    const loss = ctx.loss.watts;
    const dT = Math.max(1, ctx.loss.delta);
    const H = loss / dT;
    const heatKwh = H * ctx.loss.hdd * 24 / 1000;
    const seasonalShare = Math.min(1, opt.usefulW / Math.max(loss * 0.62, 1));
    const electric = heatKwh * seasonalShare / Math.max(ctx.eta, 0.5);
    const comfort = opt.powerAtVoltage * 8 * 200 * 0.45 / 1000;
    const tariff = ctx.input.tariff;
    return {
      heatKwh: heatKwh,
      electricKwh: electric,
      comfortKwh: comfort,
      seasonalShare: seasonalShare,
      costMain: tariff ? electric * tariff : null,
      costComfort: tariff ? comfort * tariff : null
    };
  }

  function present(opt, ctx) {
    const limitC = ctx.limitC;
    opt.layers = layersFor(opt, ctx.input, ctx.covering);
    opt.geometry = buildGeometry(opt, ctx);
    opt.steps = stepsFor(opt, ctx.input, opt.geometry, limitC);
    opt.direction = directionText(opt, ctx.input, opt.geometry);
    opt.why = whyText(opt, ctx);
    opt.thermostat = thermostatText(opt, ctx.input, limitC);
    opt.shopping = shoppingSentence(opt);
    opt.electric = electricSentence(opt, limitC);
    opt.limitC = limitC;
    opt.energy = energyFor(opt, ctx);
    opt.tapeM = opt.type === "cable" ? tapeMeters(ctx.zone.rect, opt.geometry.along) : 0;
    if (opt.surfaceLimited) {
      opt.pros = opt.pros.concat(["Запас паспортной мощности даёт быстрый прогрев, а температуру всё равно держит регулятор."]);
    }
    return opt;
  }

  function verdict(useful, loss, air, outdoor, surfaceLimited, goal) {
    const ratio = loss > 50 ? useful / loss : 1;
    const H = loss / Math.max(1, air - outdoor);
    const tBal = air - useful / Math.max(H, 0.01);
    const missing = Math.max(0, loss - useful);
    let level;
    let heatLine;
    if (ratio >= 1) {
      level = "ok";
      heatLine = "В расчётный холод (" + ru(outdoor, 0) + " °C) такой пол перекрывает теплопотери этой комнаты.";
    } else if (ratio >= 0.8) {
      level = "warn";
      heatLine = "Как единственное отопление пол на грани: в расчётный холод не хватает около " + ru(missing, 0) + " Вт. Один он тянет примерно до " + ru(tBal, 0) + " °C на улице.";
    } else {
      level = "bad";
      heatLine = "Как единственное отопление не хватит. В расчётный холод не хватает около " + ru(missing, 0) + " Вт. Пол закроет комнату примерно до " + ru(tBal, 0) + " °C на улице, дальше нужен второй источник или более тёплые стены и окна.";
    }
    if (surfaceLimited) {
      heatLine += " Регулятор упрётся в предел температуры покрытия раньше, чем секция выйдет на паспорт, поэтому в комнату придёт не вся мощность с коробки.";
    }
    if (goal === "comfort") {
      return {
        level: "ok",
        title: "Пол будет тёплым",
        lead: "Этой мощности достаточно, чтобы поверхность стала комфортной. Радиаторы этот расчёт не отменяет.",
        heatLevel: level,
        heatTitle: ratio >= 1 ? "Если убрать другие отопители" : "Хватит ли отопить комнату только полом",
        heatLine: heatLine,
        tBal: tBal,
        ratio: ratio,
        missing: missing
      };
    }
    const title = ratio >= 1 ? "Мощности хватит отопить помещение" : (ratio >= 0.8 ? "Отопить можно только впритык" : "Одним полом помещение не отопить");
    const lead = ratio >= 1
      ? "Полезного тепла с этой укладки хватает, чтобы комната держала заданный воздух без второго отопителя."
      : (ratio >= 0.8
        ? "Пол почти закрывает теплопотери, но в самый холод запаса нет."
        : "Этой укладки мало, чтобы комната зимой жила только за счёт пола.");
    return {
      level: level,
      title: title,
      lead: lead,
      heatLevel: level,
      heatTitle: "Тепловой баланс",
      heatLine: heatLine,
      tBal: tBal,
      ratio: ratio,
      missing: missing
    };
  }

  function whyNot(alt, best, goal) {
    if (alt.needsScreed && !best.needsScreed) return "Нужна стяжка, основной вариант без неё.";
    if (!alt.needsScreed && best.needsScreed) return "Тонкий монтаж, но в нужные ватты попадает хуже.";
    if (goal === "main" && alt.usefulW + 80 < best.usefulW) return "В комнату придёт меньше тепла.";
    if (goal === "comfort" && alt.specific > best.specific + 20) return "Мощность выше, чем нужно для комфорта.";
    if (alt.pieceCount > best.pieceCount) return "Больше отдельных контуров.";
    if (alt.brand !== best.brand) return "Та же задача, другая марка.";
    return "Запасной способ, если основной не подойдёт по монтажу.";
  }

  function methodLines(ctx, best) {
    const loss = ctx.loss;
    const lines = [
      { name: "Площадь", text: "Комната " + ru(ctx.input.length, 2) + " × " + ru(ctx.input.width, 2) + " м = " + ru(ctx.roomArea, 2) + " м². К укладке " + ru(ctx.area, 2) + " м²: под мебель без ножек кабель не кладут." },
      { name: "Теплопотери", text: "Q = 1,1 × (ограждения + 0,34 × n × V × ΔT) = " + ru(loss.watts, 0) + " Вт. ΔT = " + ru(loss.delta, 0) + " °C, объём " + ru(loss.volume, 1) + " м³, окна " + ru(loss.windows, 1) + " м², n = " + ru(loss.airChange, 1) + ". Утепление: " + loss.uName + "." },
      { name: "Поверхность", text: "q = 8,92 × (t_пола − t_воздуха)^1,1 = " + ru(ctx.qSurface, 0) + " Вт/м² при пределе " + ru(ctx.limitC, 0) + " °C и воздухе " + ru(loss.air, 0) + " °C. Выше этого пол в комнату стабильно не отдаёт." },
      { name: "Доля вверх", text: "Из ватт секции в комнату уходит около " + ru(ctx.eta * 100, 0) + " %. Остальное греет перекрытие. Доля зависит от утеплителя под нагревателем." }
    ];
    if (best && best.stepCm) {
      lines.push({ name: "Шаг", text: "h = 100 × S / L = " + ru(best.stepCm, 1) + " см. S — площадь контура, L — длина нагревательного кабеля, не холодного конца." });
    }
    return lines;
  }

  function assumptions(input, loss) {
    const list = [];
    if (input.insulation === "unknown") list.push("Утепление стен не задано, взят средний дом. Если дом старый или, наоборот, новый, отметьте это: ответ про отопление сдвинется.");
    if (loss.windowsAssumed) list.push("Площадь окон не задана, взята типичная доля для такого помещения (" + ru(loss.windows, 1) + " м²).");
    if (input.underlay === "unknown") list.push("Слой под нагревателем не выбран. Для комфорта над тёплой квартирой можно без XPS, для холодного низа утеплитель нужен.");
    if (loss.hddEstimated) list.push("Для своего города градусо-сутки оценены грубо, деньги за сезон тоже ориентировочные.");
    if (input.height === 2.7) list.push("Высота потолка 2,7 м, если не меняли поле.");
    const exposureText = { one: "одна наружная стена, как у обычной комнаты в квартире", two: "две наружные стены, угловая комната", all: "все стены наружные", none: "наружных стен нет, помещение внутри контура" };
    list.push("Ограждение: " + (exposureText[input.exposure] || exposureText.one) + ". Внутренние перегородки к соседям в потери не входят.");
    list.push("Расчётная улица " + input.cityName + ": " + ru(input.outdoor, 0) + " °C. Это ориентир холодной пятидневки, не прогноз на завтра.");
    list.push("Каталог — открытые карты WÄRMEHAUS и Grand Meyer. Перед покупкой сверьте артикул и сопротивление с паспортом бухты.");
    return list;
  }

  function extraWarnings(input, covering, loss, area) {
    const w = [];
    if (covering.id === "carpet") w.push({ level: "bad", text: "Ковролин глушит тепло. Толстый лучше убрать. Тонкий всё равно даст меньше тепла в комнату, чем плитка или ламинат." });
    if (covering.id === "parquet") w.push({ level: "warn", text: "Штучный паркет легко рассыхается. Держите предел 27 °C и не гонитесь за высокой мощностью. Бук и клён для тёплого пола — плохая пара." });
    if (covering.hardLayer) w.push({ level: "warn", text: "Между плёнкой и мягким покрытием нужен жёсткий лист, иначе каблуки и ножки продавят нагреватель." });
    if (D.ROOMS[input.roomType].wet && covering.lock) w.push({ level: "warn", text: "Замковое покрытие в ванной боится воды. Плёнку не кладут в зоне, куда попадает душ." });
    if ((input.below === "ground" || input.below === "outdoor" || input.below === "unheated") && input.underlay !== "xps50" && input.underlay !== "xps20") {
      w.push({ level: "warn", text: "Снизу холодный контур, а утеплителя под полом нет. Без XPS 30–50 мм заметная часть электричества уйдёт вниз. Это важнее, чем выбор между двумя матами." });
    }
    if (input.voltage === 220) w.push({ level: "warn", text: "Секции в каталоге указаны на 230 В. При 220 В резистивный пол отдаст около 91% паспортных ватт. Автомат оставлен по паспорту, с запасом." });
    if (input.system === "film" && (covering.id === "tile" || covering.id === "porcelain")) {
      w.push({ level: "bad", text: "Под плитку плёнку не рекомендуем: клей с ней не работает, шины не любят щёлочь и влагу. Ниже основной ответ всё равно просчитан для плёнки, потому что вы её выбрали. Для работы лучше мат или кабель." });
    }
    if (area < 0.8) w.push({ level: "warn", text: "Зона обогрева очень маленькая. Готовые секции начинаются примерно от 0,5 м², шаг может не попасть в допуск." });
    if (input.areaMode === "obstacles" && overlaps(input.obstacles)) w.push({ level: "warn", text: "Предметы на плане накладываются. Площадь посчитана без двойного вычета, но картинку лучше поправить." });
    return w;
  }

  function leadAnswer(best, vrd) {
    return [
      best.why,
      "В работу: " + best.shopping + ".",
      best.direction,
      best.type === "cable"
        ? "Шаг " + ru(best.stepCm, 1) + " см."
        : (best.type === "mat" ? "Шаг на мате " + ru(best.fixedStep, 0) + " см, отдельно его не считают." : "Плёнку режут только по заводской линии."),
      vrd.lead,
      vrd.heatLine !== vrd.lead ? vrd.heatLine : "",
      "Электрика: " + best.electric + "."
    ].filter(Boolean).join(" ");
  }

  function calculate(raw) {
    const input = normalize(raw);
    const errors = [];
    if (!(input.length >= 0.8 && input.length <= 40)) errors.push("Длина комнаты нужна от 0,8 до 40 м.");
    if (!(input.width >= 0.8 && input.width <= 40)) errors.push("Ширина комнаты нужна от 0,8 до 40 м.");
    if (errors.length) return { ok: false, errors: errors, warnings: [], input: input, best: null };

    const roomArea = isRectangle(input.shape, input.length, input.width)
      ? input.length * input.width
      : Math.abs(polygonArea(input.shape));
    const area = input.areaMode === "percent"
      ? roomArea * input.percent / 100
      : (isRectangle(input.shape, input.length, input.width)
        ? freeArea(input.length, input.width, input.obstacles)
        : polyFree(input.shape, input.obstacles));
    if (area < 0.35) {
      return { ok: false, errors: ["Свободной площади меньше 0,35 м². Уменьшите мебель или увеличьте комнату."], warnings: [], input: input, best: null, roomArea: roomArea, area: area };
    }

    const covering = D.COVERINGS[input.covering];
    const room = D.ROOMS[input.roomType];
    const loss = heatLoss(input);
    const limitC = limitTemp(input, covering, loss);
    const qSurface = surfaceFlux(limitC - loss.air);
    const eta = etaOf(input.underlay, input.below);
    const targetQ = targetDensity(input, loss, area, eta, covering);
    const zone = zoneOf(input, area);
    const ctx = {
      input: input,
      covering: covering,
      room: room,
      loss: loss,
      area: area,
      roomArea: roomArea,
      qSurface: qSurface,
      eta: eta,
      targetQ: targetQ,
      zone: zone,
      limitC: limitC
    };

    let options = [];
    D.LINES.forEach(function (line) {
      let opt = null;
      if (line.kind === "mat") opt = buildMat(line, ctx);
      else if (line.kind === "cable") opt = buildCable(line, ctx);
      else opt = buildFilm(line, ctx);
      if (!opt) return;
      finishOption(opt, ctx);
      scoreOption(opt, ctx);
      options.push(opt);
    });
    options.sort(function (a, b) { return b.score - a.score; });

    const warnings = extraWarnings(input, covering, loss, area);
    if (input.system !== "auto" && options.length && options[0].type !== input.system) {
      warnings.unshift({ level: "warn", text: "Выбранный тип под эти вводные не проходит ограничения покрытия или шаг. Показан ближайший рабочий вариант." });
    }

    if (!options.length) {
      return {
        ok: true,
        best: null,
        alternatives: [],
        options: [],
        errors: [],
        warnings: warnings.concat([{ level: "bad", text: "В каталоге нет секции, которая закрывает эту площадь в допустимом шаге и мощности. Разбейте комнату на две зоны или смените покрытие." }]),
        input: input,
        roomArea: roomArea,
        area: area,
        loss: loss,
        targetQ: targetQ,
        covering: covering,
        room: room,
        qSurface: qSurface,
        eta: eta,
        limitC: limitC,
        method: methodLines(ctx, null),
        assumptions: assumptions(input, loss)
      };
    }

    const best = present(options[0], ctx);
    const vrd = verdict(best.usefulW, loss.watts, loss.air, loss.outdoor, best.surfaceLimited, input.goal);
    const alternatives = options.slice(1, 4).map(function (alt) {
      return {
        lineId: alt.lineId,
        type: alt.type,
        brand: alt.brand,
        brandName: alt.brandName,
        title: alt.title,
        blurb: alt.blurb,
        power: alt.power,
        specific: alt.specific,
        stepCm: alt.stepCm || null,
        fixedStep: alt.fixedStep,
        pieceCount: alt.pieceCount,
        usefulW: alt.usefulW,
        covered: alt.covered,
        pros: alt.pros.slice(0, 3),
        cons: alt.cons.slice(0, 3),
        shopping: shoppingSentence(alt),
        whyNot: whyNot(alt, best, input.goal),
        needsScreed: alt.needsScreed
      };
    });
    if (best.brand === "warmehaus") {
      const gm = options.filter(function (o) { return o.brand === "grandmeyer" && o !== options[0]; })[0];
      if (gm && alternatives.length && !alternatives.some(function (a) { return a.lineId === gm.lineId; })) {
        alternatives[alternatives.length - 1] = {
          lineId: gm.lineId, type: gm.type, brand: gm.brand, brandName: gm.brandName, title: gm.title,
          blurb: gm.blurb, power: gm.power, specific: gm.specific, stepCm: gm.stepCm || null,
          fixedStep: gm.fixedStep, pieceCount: gm.pieceCount, usefulW: gm.usefulW, covered: gm.covered,
          pros: gm.pros.slice(0, 3), cons: gm.cons.slice(0, 3), shopping: shoppingSentence(gm),
          whyNot: "Лучший вариант Grand Meyer в этом каталоге, если WÄRMEHAUS не берут.",
          needsScreed: gm.needsScreed
        };
      }
    }

    return {
      ok: true,
      errors: [],
      warnings: warnings,
      input: input,
      roomArea: roomArea,
      area: area,
      loss: loss,
      targetQ: targetQ,
      covering: covering,
      room: room,
      qSurface: qSurface,
      eta: eta,
      limitC: limitC,
      verdict: vrd,
      answer: leadAnswer(best, vrd),
      best: best,
      alternatives: alternatives,
      options: options.map(function (o) {
        return {
          lineId: o.lineId, type: o.type, brand: o.brand, score: o.score, power: o.power,
          specific: o.specific, stepCm: o.stepCm || null, pieceCount: o.pieceCount, usefulW: o.usefulW,
          covered: o.covered, circuits: o.circuits.length
        };
      }),
      method: methodLines(ctx, best),
      assumptions: assumptions(input, loss)
    };
  }

  WF.ru = ru;
  WF.freeArea = freeArea;
  WF.surfaceFlux = surfaceFlux;
  WF.calculate = calculate;
  WF.normalize = normalize;
  WF.rectShape = rectShape;
  WF.isRectangle = isRectangle;
  WF.scaleShape = scaleShape;
  WF.polygonArea = polygonArea;
  WF.pointInPoly = pointInPoly;
})(typeof window !== "undefined" ? window : globalThis);
