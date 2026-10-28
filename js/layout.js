/* План сверху: x вправо, y вверх. В SVG y переворачивается. */
(function (root) {
  const WF = root.WF = root.WF || {};
  const COLORS = ["#c24d24", "#1f6a8a", "#1f6b45", "#8a5a10", "#6d3b86"];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function polyPoints(pts, X, Y) {
    return pts.map(function (p) { return X(p.x).toFixed(1) + "," + Y(p.y).toFixed(1); }).join(" ");
  }

  function offsetPoly(pts, dist) {
    if (!pts || pts.length < 3) return null;
    const lines = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      lines.push({ px: a.x - dy * dist, py: a.y + dx * dist, dx: dx, dy: dy });
    }
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const A = lines[(i + lines.length - 1) % lines.length];
      const B = lines[i];
      const det = A.dx * B.dy - A.dy * B.dx;
      if (Math.abs(det) < 1e-8) return null;
      const t = ((B.px - A.px) * B.dy - (B.py - A.py) * B.dx) / det;
      const p = { x: A.px + A.dx * t, y: A.py + A.dy * t };
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
      out.push(p);
    }
    return out;
  }

  function cableD(points, X, Y) {
    let d = "M" + X(points[0].x).toFixed(1) + " " + Y(points[0].y).toFixed(1);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const prev = i >= 2 ? points[i - 2] : null;
      const next = i + 1 < points.length ? points[i + 1] : null;
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      const span = Math.max(dx, dy);
      const across = Math.min(dx, dy);
      const prevLen = prev ? Math.hypot(prev.x - a.x, prev.y - a.y) : 0;
      const nextLen = next ? Math.hypot(next.x - b.x, next.y - b.y) : 0;
      if (prev && next && across < 0.04 && span > 0.02 && span < 0.45 && prevLen > span * 1.5 && nextLen > span * 1.5) {
        const vx = a.x - prev.x;
        const vy = a.y - prev.y;
        const vlen = Math.hypot(vx, vy) || 1;
        const bulge = span * 0.85;
        const cx = (a.x + b.x) / 2 + (vx / vlen) * bulge;
        const cy = (a.y + b.y) / 2 + (vy / vlen) * bulge;
        d += " Q" + X(cx).toFixed(1) + " " + Y(cy).toFixed(1) + " " + X(b.x).toFixed(1) + " " + Y(b.y).toFixed(1);
      } else {
        d += " L" + X(b.x).toFixed(1) + " " + Y(b.y).toFixed(1);
      }
    }
    return d;
  }

  function draw(result, options) {
    const opt = options || {};
    if (!result || !result.input || !(result.input.length > 0) || !(result.input.width > 0)) {
      return '<svg viewBox="0 0 640 360" class="plan-svg" role="img" aria-label="План появится после размеров"></svg>';
    }
    const input = result.input;
    const L = input.length;
    const W = input.width;
    const g = result.best ? result.best.geometry : null;
    const roomPoly = (input.shape && input.shape.length >= 3) ? input.shape : [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: L, y: W }, { x: 0, y: W }];
    const padL = 0.48;
    const padR = 0.3;
    const padT = 0.34;
    const padB = 0.66;
    let s = 1120 / (L + padL + padR);
    if ((W + padT + padB) * s > 860) s = 860 / (W + padT + padB);
    const vbW = (L + padL + padR) * s;
    const vbH = (W + padT + padB) * s;
    function X(x) { return (padL + x) * s; }
    function Y(y) { return (padT + (W - y)) * s; }

    const uid = "p" + Math.floor(Math.random() * 1e9).toString(36);
    const parts = [];
    parts.push('<svg class="plan-svg" viewBox="0 0 ' + vbW.toFixed(1) + " " + vbH.toFixed(1) + '" data-pad-x="' + padL + '" data-pad-y="' + padT + '" data-scale="' + s.toFixed(4) + '" data-roomh="' + W + '" role="img" aria-label="План укладки, вид сверху">');
    parts.push("<defs>");
    parts.push('<pattern id="hatch-' + uid + '" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">');
    parts.push('<line x1="0" y1="0" x2="0" y2="8" stroke="#d9cbb8" stroke-width="3"/>');
    parts.push("</pattern>");
    parts.push('<marker id="arrow-' + uid + '" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#241c14"/></marker>');
    parts.push('<clipPath id="room-' + uid + '"><polygon points="' + polyPoints(roomPoly, X, Y) + '"/></clipPath>');
    parts.push("</defs>");
    parts.push('<rect width="100%" height="100%" fill="#fbf6ee"/>');

    for (let x = 0; x <= L + 0.001; x += 0.5) {
      parts.push('<line x1="' + X(x) + '" y1="' + Y(0) + '" x2="' + X(x) + '" y2="' + Y(W) + '" stroke="#f3eadf" stroke-width="1"/>');
    }
    for (let y = 0; y <= W + 0.001; y += 0.5) {
      parts.push('<line x1="' + X(0) + '" y1="' + Y(y) + '" x2="' + X(L) + '" y2="' + Y(y) + '" stroke="#f3eadf" stroke-width="1"/>');
    }

    parts.push('<polygon data-room="1" points="' + polyPoints(roomPoly, X, Y) + '" fill="transparent" stroke="none"/>');
    const inset = offsetPoly(roomPoly, 0.05);
    parts.push('<polygon class="heat" points="' + polyPoints(roomPoly, X, Y) + '" fill="#fffaf3" stroke="none"/>');
    if (inset) {
      parts.push('<polygon class="heat" points="' + polyPoints(roomPoly, X, Y) + '" fill="#f3eadf"/>');
      parts.push('<polygon class="heat" points="' + polyPoints(inset, X, Y) + '" fill="#fffaf3" stroke="#c24d24" stroke-dasharray="7 5" stroke-width="1.4"/>');
      const label = inset[0];
      parts.push('<text class="heat" x="' + (X(label.x) + 6) + '" y="' + (Y(label.y) - 8) + '" font-size="13" fill="#8c3416">отступ 5 см</text>');
    }

    if (g && (Math.abs(g.zone.x) > 0.04 || Math.abs(g.zone.y) > 0.04 || g.zone.w < L - 0.08 || g.zone.h < W - 0.08)) {
      parts.push('<rect class="heat" x="' + X(g.zone.x) + '" y="' + Y(g.zone.y + g.zone.h) + '" width="' + (g.zone.w * s) + '" height="' + (g.zone.h * s) + '" fill="#f8e7df" stroke="#c24d24" stroke-dasharray="5 4" stroke-width="1.5"/>');
    }

    if (g) {
      const stepM = g.stepM || 0.1;
      const stroke = Math.max(3.4, Math.min(8, stepM * s * 0.55));
      (g.bands || []).forEach(function (b) {
        const color = COLORS[((b.circuit || 1) - 1) % COLORS.length];
        parts.push('<rect class="heat" clip-path="url(#room-' + uid + ')" x="' + X(b.x) + '" y="' + Y(b.y + b.h) + '" width="' + Math.max(0, b.w * s) + '" height="' + Math.max(0, b.h * s) + '" fill="' + color + '" fill-opacity="0.22" stroke="' + color + '" stroke-width="1.4" rx="2"/>');
      });
      const circuitCount = {};
      (g.paths || []).forEach(function (path) {
        if (path[0]) circuitCount[path[0].circuit || 1] = 1;
      });
      const many = Object.keys(circuitCount).length > 1;
      (g.paths || []).forEach(function (path) {
        if (path.length < 2) return;
        const color = COLORS[((path[0].circuit || 1) - 1) % COLORS.length];
        const d = cableD(path, X, Y);
        parts.push('<path class="heat" clip-path="url(#room-' + uid + ')" d="' + d + '" fill="none" stroke="' + color + '" stroke-opacity="0.18" stroke-width="' + (stroke + 5) + '" stroke-linejoin="round" stroke-linecap="round"/>');
        parts.push('<path class="heat" clip-path="url(#room-' + uid + ')" d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + stroke.toFixed(1) + '" stroke-linejoin="round" stroke-linecap="round"/>');
        if (many) {
          parts.push('<text class="heat" x="' + (X(path[0].x) + 8) + '" y="' + (Y(path[0].y) - 10) + '" font-size="12" font-weight="700" fill="' + color + '">контур ' + (path[0].circuit || 1) + "</text>");
        }
      });
      (g.obstacles || []).forEach(function (o, index) {
        const selected = opt.selection && opt.selection.kind === "obs" && opt.selection.index === index;
        parts.push('<rect data-obs="' + index + '" clip-path="url(#room-' + uid + ')" x="' + X(o.x) + '" y="' + Y(o.y + o.h) + '" width="' + Math.max(0, o.w * s) + '" height="' + Math.max(0, o.h * s) + '" fill="url(#hatch-' + uid + ')" stroke="' + (selected ? "#c24d24" : "#8a7b6a") + '" stroke-width="' + (selected ? 2.4 : 1.4) + '"/>');
        if (o.w * s > 54 && o.h * s > 18) {
          parts.push('<text class="heat" x="' + (X(o.x) + 8) + '" y="' + (Y(o.y + o.h) + 18) + '" font-size="13" fill="#5c5146">' + esc(o.name) + "</text>");
        }
        if (opt.interactive) {
          const corners = {
            sw: [o.x, o.y],
            se: [o.x + o.w, o.y],
            nw: [o.x, o.y + o.h],
            ne: [o.x + o.w, o.y + o.h]
          };
          Object.keys(corners).forEach(function (name) {
            const c = corners[name];
            parts.push('<circle data-resize="' + index + '" data-corner="' + name + '" cx="' + X(c[0]) + '" cy="' + Y(c[1]) + '" r="7" fill="#fffaf3" stroke="#241c14" stroke-width="1.6"/>');
          });
        }
      });
      if (g.start) {
        parts.push('<circle class="heat" cx="' + X(g.start.x) + '" cy="' + Y(g.start.y) + '" r="5.5" fill="#241c14"/>');
        const startLeft = g.start.x < 0.45;
        parts.push('<text class="heat" x="' + (X(g.start.x) + (startLeft ? -8 : 8)) + '" y="' + (Y(g.start.y) - 8) + '" text-anchor="' + (startLeft ? "end" : "start") + '" font-size="13" font-weight="700" fill="#241c14">старт</text>');
      }
      if (g.thermostat && g.sensor) {
        parts.push('<line class="heat" x1="' + X(g.sensor.x) + '" y1="' + Y(g.sensor.y) + '" x2="' + X(g.thermostat.x) + '" y2="' + Y(g.thermostat.y) + '" stroke="#1f6a8a" stroke-width="1.4" stroke-dasharray="3 3"/>');
      }
      if (g.thermostat && g.start) {
        parts.push('<line class="heat" x1="' + X(g.start.x) + '" y1="' + Y(g.start.y) + '" x2="' + X(g.thermostat.x) + '" y2="' + Y(g.thermostat.y) + '" stroke="#241c14" stroke-width="1.2" stroke-dasharray="4 3"/>');
      }
      if (g.thermostat) {
        const tx = X(g.thermostat.x);
        const ty = Y(g.thermostat.y);
        parts.push('<rect class="heat" x="' + (tx - 16) + '" y="' + (ty - 12) + '" width="32" height="24" rx="5" fill="#241c14"/>');
        parts.push('<text class="heat" x="' + tx + '" y="' + (ty + 4) + '" text-anchor="middle" font-size="11" fill="#fffaf3">t°</text>');
      }
      if (g.sensor) {
        parts.push('<circle class="heat" cx="' + X(g.sensor.x) + '" cy="' + Y(g.sensor.y) + '" r="6" fill="#fbf6ee" stroke="#1f6a8a" stroke-width="2.4"/>');
        const toward = g.thermostat ? (g.sensor.x >= g.thermostat.x ? 1 : -1) : 1;
        parts.push('<text class="heat" x="' + (X(g.sensor.x) + toward * 10) + '" y="' + (Y(g.sensor.y) + 4) + '" text-anchor="' + (toward > 0 ? "start" : "end") + '" font-size="13" fill="#1f6a8a">датчик</text>');
      }
      if (result.best && result.best.type === "mat" && g.bands && g.bands.length) {
        let top = 0;
        g.bands.forEach(function (b) { top = Math.max(top, b.y + b.h); });
        if (W - top > 0.18) {
          parts.push('<text class="heat" x="' + X(L / 2) + '" y="' + Y((top + W) / 2) + '" text-anchor="middle" font-size="13" fill="#8a7b6a">сюда полоса 50 см уже не входит</text>');
        }
      }
    }

    parts.push('<polygon class="heat" points="' + polyPoints(roomPoly, X, Y) + '" fill="none" stroke="#241c14" stroke-width="2.4"/>');

    if (opt.interactive) {
      for (let i = 0; i < roomPoly.length; i++) {
        const a = roomPoly[i];
        const b = roomPoly[(i + 1) % roomPoly.length];
        const axis = Math.abs(a.y - b.y) < 0.04 ? "y" : (Math.abs(a.x - b.x) < 0.04 ? "x" : "free");
        parts.push('<line data-edge="' + i + '" data-axis="' + axis + '" x1="' + X(a.x) + '" y1="' + Y(a.y) + '" x2="' + X(b.x) + '" y2="' + Y(b.y) + '" stroke="transparent" stroke-width="16"/>');
      }
      roomPoly.forEach(function (p, i) {
        const on = opt.selection && opt.selection.kind === "vertex" && opt.selection.index === i;
        parts.push('<circle data-vertex="' + i + '" cx="' + X(p.x) + '" cy="' + Y(p.y) + '" r="8" fill="' + (on ? "#c24d24" : "#fffaf3") + '" stroke="#241c14" stroke-width="2"/>');
      });
      const walls = [
        { id: "bottom", x: L / 2, y: -0.02 },
        { id: "top", x: L / 2, y: W + 0.02 },
        { id: "left", x: -0.02, y: W / 2 },
        { id: "right", x: L + 0.02, y: W / 2 }
      ];
      walls.forEach(function (w) {
        const horizontal = w.id === "bottom" || w.id === "top";
        const x = horizontal ? X(L * 0.22) : (w.id === "left" ? X(0) - 26 : X(L) + 8);
        const y = horizontal ? (w.id === "bottom" ? Y(0) + 8 : Y(W) - 26) : Y(W * 0.78);
        const rw = horizontal ? L * 0.56 * s : 18;
        const rh = horizontal ? 18 : W * 0.56 * s;
        parts.push('<rect data-wall="' + w.id + '" x="' + x + '" y="' + y + '" width="' + rw + '" height="' + rh + '" fill="transparent"/>');
      });
    }

    const yDim = Y(-Math.min(0.5, padB - 20 / s));
    parts.push('<line x1="' + X(0) + '" y1="' + yDim + '" x2="' + X(L) + '" y2="' + yDim + '" stroke="#241c14" stroke-width="1" marker-end="url(#arrow-' + uid + ')"/>');
    parts.push('<line x1="' + X(L) + '" y1="' + yDim + '" x2="' + X(0) + '" y2="' + yDim + '" stroke="#241c14" stroke-width="1" marker-end="url(#arrow-' + uid + ')"/>');
    parts.push('<text x="' + ((X(0) + X(L)) / 2) + '" y="' + (yDim + 18) + '" text-anchor="middle" font-size="14" fill="#241c14">' + esc(WF.ru(L, 2)) + " м</text>");

    const statWall = (g && g.thermostat && g.thermostat.wall) || input.statWall || "bottom";
    const xDim = statWall === "left" ? X(L) + 42 : X(0) - 42;
    const yMid = (Y(0) + Y(W)) / 2;
    parts.push('<text x="' + xDim + '" y="' + yMid + '" text-anchor="middle" font-size="14" fill="#241c14" transform="rotate(-90 ' + xDim + " " + yMid + ')">' + esc(WF.ru(W, 2)) + " м</text>");

    const capY = Y(W) - 10;
    if (result.best && result.best.stepCm) {
      parts.push('<text x="' + X(0) + '" y="' + capY + '" font-size="14" font-weight="700" fill="#c24d24">шаг ' + esc(WF.ru(result.best.stepCm, 1)) + " см</text>");
    } else if (result.best && result.best.type === "mat") {
      parts.push('<text x="' + X(0) + '" y="' + capY + '" font-size="14" font-weight="700" fill="#c24d24">мат, полосы 50 см</text>');
    } else if (result.best && result.best.type === "film") {
      parts.push('<text x="' + X(0) + '" y="' + capY + '" font-size="14" font-weight="700" fill="#1f6a8a">плёнка ' + esc(WF.ru(input.filmWidth * 100, 0)) + " см</text>");
    }

    parts.push("</svg>");
    return parts.join("");
  }

  WF.draw = draw;
})(typeof window !== "undefined" ? window : globalThis);
