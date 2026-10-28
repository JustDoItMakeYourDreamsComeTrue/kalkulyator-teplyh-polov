const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const sandbox = { console: console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "js/data.js"), "utf8"), sandbox, { filename: "data.js" });
vm.runInContext(fs.readFileSync(path.join(root, "js/calc.js"), "utf8"), sandbox, { filename: "calc.js" });
const WF = sandbox.WF;

let failed = 0;
function assert(cond, message) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", message);
  }
}

function approx(a, b, tol) {
  return Math.abs(a - b) <= tol;
}

assert(approx(WF.surfaceFlux(9), 100, 1.5), "поток при 9 К около 100 Вт/м², получилось " + WF.surfaceFlux(9));
assert(WF.surfaceFlux(0) === 0, "нулевой перепад не греет");

const bathOb = [{ name: "Ванна", x: 0.15, y: 0.15, w: 1.7, h: 0.7 }];
assert(approx(WF.freeArea(2.5, 2.2, bathOb), 5.5 - 1.19, 0.02), "площадь ванной за вычетом ванны");

const poor = WF.calculate({
  roomType: "living", length: 5, width: 4, height: 2.7, insulation: "poor",
  above: "heated", below: "heated", covering: "tile", goal: "comfort",
  areaMode: "percent", percent: 100, windows: 3, cityId: "moscow", screed: "no"
});
const good = WF.calculate(Object.assign({}, {
  roomType: "living", length: 5, width: 4, height: 2.7, insulation: "excellent",
  above: "heated", below: "heated", covering: "tile", goal: "comfort",
  areaMode: "percent", percent: 100, windows: 3, cityId: "moscow", screed: "no"
}));
assert(poor.ok && good.ok, "оба варианта утепления считаются");
assert(poor.loss.watts > good.loss.watts * 1.3, "слабое утепление заметно холоднее: " + poor.loss.watts + " vs " + good.loss.watts);

const bath = WF.calculate(WF.EXAMPLES.bath);
assert(bath.ok, "пример ванной считается: " + (bath.errors || []).join("; "));
assert(bath.best && bath.best.type === "mat", "в ванной под плитку выбирается мат, а не " + (bath.best && bath.best.type));
assert(bath.best.brand === "warmehaus", "по умолчанию приоритет WÄRMEHAUS");
assert(approx(bath.best.power, 640, 1), "мат 4 м² × 160 Вт = 640 Вт, получилось " + bath.best.power);
assert(approx(bath.best.specific, 160, 1), "удельная 160");
assert(bath.best.fixedStep === 7, "шаг мата 7 см");
assert(bath.answer && bath.answer.length > 80, "есть связный ответ");
assert(bath.best.steps.length >= 6, "есть порядок укладки");
assert(bath.best.usefulW <= bath.best.power + 1, "в комнату не может прийти больше паспортных ватт");
assert(bath.best.circuits.every(function (c) { return c.sum <= 3200.1; }), "контур не тяжелее 16 А");

function hits(band, ob) {
  return band.x < ob.x + ob.w - 0.02 && band.x + band.w > ob.x + 0.02 &&
    band.y < ob.y + ob.h - 0.02 && band.y + band.h > ob.y + 0.02;
}
const tub = bath.input.obstacles[0];
const overlap = (bath.best.geometry.bands || []).some(function (b) { return hits(b, tub); });
assert(!overlap, "полосы мата не заходят на ванну");
assert(bath.best.geometry.bands.length > 0, "план мата не пустой");

const living = WF.calculate(WF.EXAMPLES.living);
assert(living.ok && living.best && living.best.type === "film", "под ламинат выбирается плёнка, а не " + (living.best && living.best.title));
assert(living.best.specific <= 160, "под ламинат не предлагается жёсткая мощность выше 160");
assert(living.best.power > 500, "плёнка на гостиную не символическая");

const cableCase = WF.calculate({
  roomType: "bath", length: 3.5, width: 2.5, cityId: "moscow", goal: "comfort",
  covering: "tile", system: "auto", brand: "either", screed: "yes",
  areaMode: "obstacles", obstacles: [], insulation: "unknown", below: "heated", above: "heated"
});
const thc = cableCase.options.filter(function (o) { return o.lineId === "gm-thc20"; })[0];
assert(thc, "для 8,75 м² есть секция THC20");
assert(approx(thc.stepCm, 12.5, 0.15), "шаг THC20-70 на 8,75 м² равен 12,5 см, получилось " + (thc && thc.stepCm));
assert(approx(thc.power, 1400, 1), "мощность секции 1400 Вт, получилось " + (thc && thc.power));

const forced = WF.calculate({
  roomType: "bath", length: 2.5, width: 2.2, covering: "tile", system: "film",
  goal: "comfort", areaMode: "percent", percent: 80, cityId: "moscow"
});
assert(forced.ok && forced.best && forced.best.type === "film", "принудительная плёнка считается");
assert(forced.warnings.some(function (w) { return w.text.indexOf("плитк") >= 0; }), "под плитку плёнка помечена как плохой выбор");

const big = WF.calculate({
  roomType: "living", length: 6, width: 5, covering: "tile", goal: "main", screed: "yes",
  insulation: "poor", below: "ground", above: "cold", areaMode: "percent", percent: 100,
  cityId: "moscow", brand: "either", windows: 4
});
assert(big.ok && big.best, "большая комната считается");
assert(big.best.power > 3200, "на 30 м² основного отопления мощность выше одного регулятора, получилось " + big.best.power);
assert(big.best.circuits.length >= 2, "контуры разделены");
assert(big.best.circuits.every(function (c) { return c.sum <= 3200.1; }), "ни один регулятор не перегружен");
assert(big.best.usefulW < big.loss.watts * 1.05 || big.verdict.heatLevel !== "ok" || big.best.usefulW > 0, "полезное тепло посчитано");

const invalid = WF.calculate({ length: 0, width: 2 });
assert(!invalid.ok && invalid.errors.length, "нулевая длина не проходит");

const cableDraw = WF.calculate({
  roomType: "living", length: 4, width: 3, covering: "tile", system: "cable", goal: "comfort",
  screed: "yes", areaMode: "obstacles", obstacles: [{ name: "Шкаф", x: 0.2, y: 0.8, w: 1.2, h: 0.6 }],
  cityId: "minsk", brand: "grandmeyer"
});
assert(cableDraw.ok && cableDraw.best.type === "cable", "принудительный кабель");
assert(cableDraw.best.stepCm >= 7.4 && cableDraw.best.stepCm <= 17.6, "шаг внутри допуска THC20/CAB: " + cableDraw.best.stepCm);
const cabPaths = cableDraw.best.geometry.paths || [];
assert(cabPaths.length > 0, "змейка построена");
let inside = false;
cabPaths.forEach(function (path) {
  path.forEach(function (p) {
    const o = cableDraw.input.obstacles[0];
    if (p.x > o.x + 0.03 && p.x < o.x + o.w - 0.03 && p.y > o.y + 0.03 && p.y < o.y + o.h - 0.03) inside = true;
  });
});
assert(!inside, "витки кабеля не идут сквозь шкаф");
assert(cableDraw.best.geometry.paths.length <= 2, "кабель вокруг шкафа не рвётся на обрезки: " + cableDraw.best.geometry.paths.length);

const kitchen = WF.calculate(WF.EXAMPLES.kitchen);
assert(kitchen.ok && kitchen.best.geometry.paths.length === kitchen.best.pieceCount, "на кухне один целый кабель на контур, путей " + (kitchen.best && kitchen.best.geometry.paths.length));
const plainCable = WF.calculate({
  roomType: "living", length: 3.2, width: 2, covering: "tile", system: "cable", goal: "comfort",
  screed: "yes", areaMode: "obstacles", obstacles: [], cityId: "moscow"
});
assert(plainCable.best.geometry.paths.length === 1, "в пустой комнате кабель одной ниткой");
const sensor = plainCable.best.geometry.sensor;
const stat = plainCable.best.geometry.thermostat;
const along = stat.wall === "left" || stat.wall === "right" ? Math.abs(sensor.y - stat.y) : Math.abs(sensor.x - stat.x);
const depth = stat.wall === "bottom" ? sensor.y - 0 : (stat.wall === "top" ? plainCable.input.width - sensor.y : (stat.wall === "left" ? sensor.x : plainCable.input.length - sensor.x));
assert(along < 0.2, "датчик напротив регулятора, сдвиг " + along);
assert(depth > 0.2 && depth < 0.7, "датчик в 30–50 см от стены регулятора, получилось " + depth);

const lShape = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1.5 }, { x: 2, y: 1.5 }, { x: 2, y: 3 }, { x: 0, y: 3 }];
const custom = WF.calculate({
  length: 4, width: 3, shape: lShape, roomType: "living", covering: "tile", goal: "comfort",
  system: "cable", screed: "yes", areaMode: "obstacles", obstacles: [], cityId: "moscow"
});
assert(custom.ok && custom.roomArea < 11, "Г-образная комната меньше описанного прямоугольника: " + custom.roomArea);
let inNotch = false;
(custom.best.geometry.paths || []).forEach(function (path) {
  path.forEach(function (pt) { if (pt.x > 2.12 && pt.y > 1.62) inNotch = true; });
});
assert(!inNotch, "кабель не заходит в вырезанный угол");

console.log("--- ванная ---");
console.log(bath.best.title, bath.best.power + " Вт", "полезно " + Math.round(bath.best.usefulW), "потери " + Math.round(bath.loss.watts));
console.log(bath.verdict.title, "/", bath.verdict.heatTitle);
console.log("--- гостиная ---");
console.log(living.best.title, Math.round(living.best.power) + " Вт", "удельно " + Math.round(living.best.specific));
console.log("--- кухня ---");
console.log(kitchen.best.title, kitchen.best.power + " Вт", "шаг", kitchen.best.stepCm, "полезно", Math.round(kitchen.best.usefulW), "потери", Math.round(kitchen.loss.watts));
console.log(kitchen.verdict.title);
console.log("--- большая ---");
console.log(big.best.title, big.best.power + " Вт", "контуров", big.best.circuits.length, "полезно", Math.round(big.best.usefulW), "потери", Math.round(big.loss.watts));

if (failed) {
  console.error("Провалов: " + failed);
  process.exit(1);
}
console.log("Все проверки прошли");
