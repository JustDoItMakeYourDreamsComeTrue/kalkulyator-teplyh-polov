/* Каталог и нормы для предварительного расчёта.
   Мощности секций — по открытым картам WÄRMEHAUS и каталогу Grand Meyer.
   Это не замена паспорту конкретной бухты: перед укладкой сверяют сопротивление. */
(function (root) {
  const WF = root.WF = root.WF || {};

  function matLine(spec) {
    const products = spec.areas.map(function (area) {
      const power = Math.round(spec.specific * area);
      return {
        sku: spec.skuPrefix + "-" + String(area).replace(".", ""),
        name: spec.title + " " + area + " м²",
        area: area,
        power: power,
        length: null
      };
    });
    return Object.assign({
      kind: "mat",
      width: 0.5,
      needsScreed: false,
      selfReg: false,
      coldLead: spec.coldLead,
      stepCm: spec.stepCm
    }, spec, { products: products });
  }

  function cableLine(spec) {
    const products = spec.sections.map(function (pair) {
      return {
        sku: spec.skuPrefix + "-" + String(pair[0]).replace(".", ""),
        name: spec.title + " " + pair[0] + " м",
        area: null,
        power: pair[1],
        length: pair[0]
      };
    });
    return Object.assign({
      kind: "cable",
      selfReg: false
    }, spec, { products: products });
  }

  const LINES = [
    matLine({
      id: "wh-mat-160",
      brand: "warmehaus",
      brandName: "WÄRMEHAUS",
      title: "WÄRMEHAUS MAT 160",
      specific: 160,
      stepCm: 7,
      coldLead: 3.5,
      thickness: "кабель 3 мм, мат около 3 мм",
      skuPrefix: "MAT160",
      areas: [0.5, 0.7, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10, 12, 15],
      blurb: "Тонкий мат на сетке 50 см, шаг кабеля 7 см. Кладётся в плиточный клей без толстой стяжки.",
      pros: [
        "Быстрый монтаж: сетку режут и разворачивают, кабель уже разложен",
        "Толщина около 3 мм — пол почти не поднимается",
        "160 Вт/м² хватает для комфортного подогрева плитки и санузла"
      ],
      cons: [
        "Мощность на метр зафиксирована, шаг не меняется",
        "Площадь мата нельзя увеличить, лишний кабель некуда деть",
        "На ломаном контуре много поворотов сетки"
      ]
    }),
    matLine({
      id: "wh-mat-200",
      brand: "warmehaus",
      brandName: "WÄRMEHAUS",
      title: "WÄRMEHAUS MAT 200",
      specific: 200,
      stepCm: 7,
      coldLead: 3.5,
      thickness: "кабель 3 мм",
      skuPrefix: "MAT200",
      areas: [0.7, 1, 1.2, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10],
      blurb: "Тот же тонкий мат, но 200 Вт/м². Имеет смысл на холодном полу, лоджии и там, где пол — основной обогрев.",
      pros: [
        "Выше мощность при той же толщине, быстрее прогревает плитку",
        "Подходит для лоджии и первого этажа лучше, чем мат 160",
        "Монтаж в слой клея, без стяжки 5 см"
      ],
      cons: [
        "Под ламинат и дерево 200 Вт/м² уже слишком много",
        "На хорошо утеплённой квартире для комфорта это избыточно и дороже в работе",
        "Площадь нужно попасть в готовый типоразмер"
      ]
    }),
    cableLine({
      id: "wh-cab-17",
      brand: "warmehaus",
      brandName: "WÄRMEHAUS",
      title: "WÄRMEHAUS CAB 17W Thin",
      specific: null,
      stepMin: 5,
      stepMax: 14,
      stepGrid: 2.5,
      coldLead: 3.5,
      needsScreed: false,
      diameter: "3 мм",
      skuPrefix: "CAB17",
      sections: [
        [5.5, 80], [27, 400], [44, 640], [53.5, 800], [75, 1120],
        [79, 1280], [92, 1440], [100.1, 1600], [128.7, 1920], [155, 2400]
      ],
      blurb: "Тонкий двужильный кабель. Шаг 5–14 см задаёт мощность примерно от 100 до 280 Вт/м². Можно класть в клей или в неглубокую штробу. В карточках поставки мощность секции ниже, чем 17 Вт × длина, расчёт идёт по ваттам секции.",
      pros: [
        "Любой шаг в допуске — мощность подстраивается под комнату",
        "Удобно обходить ванну, трапецию и ниши",
        "Тонкий, можно без толстой стяжки"
      ],
      cons: [
        "Шаг нужно держать руками, ошибка видна полосами тепла",
        "Монтаж дольше, чем у мата",
        "Линейка в открытых карточках не сплошная: между длинами бывают скачки"
      ]
    }),
    cableLine({
      id: "wh-cab-20",
      brand: "warmehaus",
      brandName: "WÄRMEHAUS",
      title: "WÄRMEHAUS CAB 20W",
      specific: null,
      stepMin: 7.5,
      stepMax: 15,
      stepGrid: 2.5,
      coldLead: 3.5,
      needsScreed: true,
      diameter: "кабель в стяжку",
      skuPrefix: "CAB20",
      sections: [[44, 880], [140, 2800]],
      blurb: "Кабель около 20 Вт/м. В открытом доступе подтверждены не все длины, поэтому на промежуточную площадь чаще попадает CAB 17W или Grand Meyer THC20.",
      pros: [
        "Выше погонная мощность — реже витки при той же мощности на метр",
        "Нормальный выбор, если всё равно заливается стяжка"
      ],
      cons: [
        "Мало подтверждённых длин в открытых карточках",
        "Нужна стяжка, пол поднимается",
        "Для ремонта «на клей» этот кабель не берут"
      ]
    }),
    {
      id: "wh-film-eco",
      brand: "warmehaus",
      brandName: "WÄRMEHAUS",
      title: "WÄRMEHAUS ThermoFilm EcoPower",
      kind: "film",
      specific: 150,
      specificRun: 150,
      specificCold: 150,
      selfReg: false,
      needsScreed: false,
      coldLead: 0,
      blurb: "Инфракрасная плёнка 150 Вт/м². Сухой монтаж под ламинат, паркетную доску и линолеум через жёсткий слой.",
      pros: [
        "Пол не заливают, покрытие можно класть сразу",
        "150 Вт/м² — спокойная мощность для ламината при пределе 27 °C",
        "Греет быстро, термостат часто выключает плёнку"
      ],
      cons: [
        "Не для плитки и не для мокрой зоны",
        "Нужны клипсы, изоляция шин и ровное основание",
        "Под ковром и толстой подложкой почти не греет"
      ]
    },
    {
      id: "wh-film-self",
      brand: "warmehaus",
      brandName: "WÄRMEHAUS",
      title: "WÄRMEHAUS SelfReg",
      kind: "film",
      specific: 180,
      specificRun: 150,
      specificCold: 220,
      selfReg: true,
      needsScreed: false,
      coldLead: 0,
      blurb: "Саморегулирующаяся плёнка: на холодном полу около 220 Вт/м², по мере нагрева мощность падает примерно к 140 Вт/м².",
      pros: [
        "Сама снижает мощность, когда пол уже тёплый — так меньше перерасход",
        "Меньше риск местного перегрева, если на пол всё же встал лёгкий предмет",
        "Сухой монтаж, без стяжки"
      ],
      cons: [
        "Пиковый ток при включении выше, чем у EcoPower — автомат считают по холоду",
        "Дороже обычной плёнки",
        "Под плитку и в душевую не кладут"
      ]
    },
    {
      id: "wh-film-hp",
      brand: "warmehaus",
      brandName: "WÄRMEHAUS",
      title: "WÄRMEHAUS ThermoFilm High Power",
      kind: "film",
      specific: 220,
      specificRun: 220,
      specificCold: 220,
      selfReg: false,
      needsScreed: false,
      coldLead: 0,
      blurb: "Плёнка 220 Вт/м². Для холодных сухих помещений, где покрытие выдерживает такую мощность и стоит предел температуры.",
      pros: [
        "Быстрый прогрев лоджии и холодной комнаты",
        "Сухой монтаж"
      ],
      cons: [
        "Для ламината и дерева пиковая мощность высоковата",
        "Без рабочего термостата легко перегреть покрытие",
        "Не для плитки и влажных зон"
      ]
    },
    cableLine({
      id: "gm-thc20",
      brand: "grandmeyer",
      brandName: "Grand Meyer",
      title: "Grand Meyer THC20",
      specific: null,
      stepMin: 7.5,
      stepMax: 17.5,
      stepGrid: 2.5,
      coldLead: 3,
      needsScreed: true,
      diameter: "5 мм",
      bendCm: 6,
      skuPrefix: "THC20",
      sections: [
        [10, 200], [15, 300], [23, 460], [32, 640], [45, 900], [57, 1140],
        [70, 1400], [85, 1700], [98, 1960], [115, 2300], [160, 3200]
      ],
      blurb: "Двужильный кабель 20 Вт/м. В каталоге шаг 7,5 / 10 / 12,5 / 15 / 17,5 см даёт примерно 267 / 200 / 160 / 133 / 114 Вт/м². Стяжка над кабелем не меньше 3 см.",
      pros: [
        "Ровная сетка длин и честный шаг по монтажной ленте 2,5 см",
        "Хорошо попадает в нужные ватты на метр за счёт шага",
        "До 3200 Вт одной секцией — как раз под регулятор 16 А"
      ],
      cons: [
        "Нужна стяжка минимум 3 см, для готового ремонта это часто неприемлемо",
        "Диаметр 5 мм и радиус изгиба 6 см — не тонкий мат",
        "Ближе 7,5 см витки не кладут"
      ]
    }),
    matLine({
      id: "gm-thm200",
      brand: "grandmeyer",
      brandName: "Grand Meyer",
      title: "Grand Meyer THM200",
      specific: 200,
      stepCm: 10,
      coldLead: 3,
      thickness: "кабель 3,6 мм, мат 3,8 мм",
      skuPrefix: "THM200",
      areas: [0.75, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14],
      blurb: "Мат 200 Вт/м², сетка 50 см, клей или тонкий слой. В каталоге нет каждого «половинного» размера.",
      pros: [
        "200 Вт/м² для холодных комнат и основного обогрева под плиткой",
        "Тонкий мат, без стяжки 5 см",
        "Есть крупные куски до 14 м²"
      ],
      cons: [
        "Нет 2,5 и 3,5 м² — на такую площадь лучше кабель или два меньших мата",
        "200 Вт/м² не для деревянного покрытия",
        "Холодный конец 3 м: муфта должна остаться на полу у штробы"
      ]
    }),
    matLine({
      id: "gm-econg170",
      brand: "grandmeyer",
      brandName: "Grand Meyer",
      title: "Grand Meyer EcoNG170",
      specific: 170,
      stepCm: 10,
      coldLead: 3,
      thickness: "около 3,8 мм",
      skuPrefix: "EcoNG170",
      areas: [1, 1.5, 2, 2.5, 3.5, 4.5, 5.5, 6.5, 7, 8, 9, 11, 13, 15],
      blurb: "Мат 170 Вт/м² серии Heat'n'Warm. Компромисс между комфортом и основным обогревом.",
      pros: [
        "170 Вт/м² часто попадает между «слишком слабо» и «слишком жарко»",
        "Тонкий монтаж в клей",
        "Крупные маты до 15 м²"
      ],
      cons: [
        "Шаг площадей неровный: 3, 4, 5 и 6 м² в линейке нет",
        "Под дерево всё ещё высоковато без жёсткого ограничения температуры"
      ]
    }),
    matLine({
      id: "gm-econg150",
      brand: "grandmeyer",
      brandName: "Grand Meyer",
      title: "Grand Meyer EcoNG150",
      specific: 150,
      stepCm: 10,
      coldLead: 3,
      thickness: "около 3,8 мм",
      skuPrefix: "EcoNG150",
      areas: [1, 1.5, 2, 2.5, 3.5, 4.5, 5.5, 6.5, 7, 8, 9, 11, 13, 15],
      blurb: "Мат 150 Вт/м² для комфортного подогрева. Те же площади, что у EcoNG170.",
      pros: [
        "Спокойная мощность для комфорта, расход ниже, чем у 200 Вт/м²",
        "Тонкий мат под плитку",
        "Меньше шансов упереться в перегрев покрытия"
      ],
      cons: [
        "Как основное отопление на холодном полу обычно не тянет",
        "Нет части промежуточных площадей",
        "Под ламинат мат в клей — мокрый процесс, плёнка проще"
      ]
    })
  ];

  WF.LINES = LINES;
  WF.LINE_BY_ID = {};
  LINES.forEach(function (line) { WF.LINE_BY_ID[line.id] = line; });

  WF.COVERINGS = {
    tile: {
      id: "tile", name: "Керамическая плитка", short: "Плитка", under: "плитку",
      softMaxQ: 200, hardMaxQ: 220, surface: 29, surfaceWet: 31,
      prefers: "mat", wetOk: true,
      note: "Плитка хорошо проводит тепло. Под неё кладут мат или кабель, не плёнку."
    },
    porcelain: {
      id: "porcelain", name: "Керамогранит", short: "Керамогранит", under: "керамогранит",
      softMaxQ: 200, hardMaxQ: 220, surface: 29, surfaceWet: 31,
      prefers: "mat", wetOk: true,
      note: "Ведёт себя как плитка. Плёнка под ним не держит клей и не любит щёлочь."
    },
    laminate: {
      id: "laminate", name: "Ламинат", short: "Ламинат", under: "ламинат",
      softMaxQ: 150, hardMaxQ: 160, surface: 27, surfaceWet: 27,
      prefers: "film", wetOk: false, lock: true,
      note: "Нужна маркировка «тёплый пол» и предел поверхности 27 °C. Толщина обычно до 10 мм, подложка не толще 3 мм."
    },
    engwood: {
      id: "engwood", name: "Паркетная доска", short: "Паркетная доска", under: "паркетную доску",
      softMaxQ: 130, hardMaxQ: 150, surface: 27, surfaceWet: 27,
      prefers: "film", wetOk: false, lock: true,
      note: "Инженерная и трёхслойная доска совместима с тёплым полом только при пределе 27 °C. Бук и клён лучше не брать."
    },
    parquet: {
      id: "parquet", name: "Штучный паркет", short: "Паркет", under: "паркет",
      softMaxQ: 100, hardMaxQ: 140, surface: 27, surfaceWet: 27,
      prefers: "film", wetOk: false, lock: true,
      note: "Массив легко рассыхается. Если пол уже выбран, мощность держат низкой, а термостат ограничивают 27 °C."
    },
    spc: {
      id: "spc", name: "Кварцвинил и SPC", short: "Кварцвинил", under: "кварцвинил",
      softMaxQ: 150, hardMaxQ: 160, surface: 27, surfaceWet: 27,
      prefers: "film", wetOk: false, lock: true,
      note: "Плавающий SPC кладут как ламинат, на плёнку. Клеевой LVT иногда допускает мат — смотрите паспорт покрытия."
    },
    linoleum: {
      id: "linoleum", name: "Линолеум", short: "Линолеум", under: "линолеум",
      softMaxQ: 130, hardMaxQ: 160, surface: 27, surfaceWet: 27,
      prefers: "film", wetOk: false, hardLayer: true,
      note: "Без войлочной основы. Между плёнкой и линолеумом нужен жёсткий лист: ГВЛ или фанера 6–8 мм."
    },
    carpet: {
      id: "carpet", name: "Ковролин", short: "Ковролин", under: "ковролин",
      softMaxQ: 100, hardMaxQ: 130, surface: 27, surfaceWet: 27,
      prefers: "film", wetOk: false, hardLayer: true,
      note: "Ткань сама работает как утеплитель. Толстый ковёр с тёплым полом почти не греет. Если оставляете — только тонкий."
    }
  };

  WF.ROOMS = {
    bath: { name: "Ванная", air: 25, n: 0.8, win: 0.04, wet: true },
    kitchen: { name: "Кухня", air: 20, n: 0.6, win: 0.15, wet: false },
    living: { name: "Гостиная", air: 21, n: 0.5, win: 0.18, wet: false },
    bedroom: { name: "Спальня", air: 20, n: 0.4, win: 0.15, wet: false },
    nursery: { name: "Детская", air: 22, n: 0.5, win: 0.16, wet: false },
    hall: { name: "Прихожая", air: 18, n: 0.4, win: 0.02, wet: false },
    balcony: { name: "Лоджия или балкон", air: 18, n: 0.4, win: 0.35, wet: false },
    other: { name: "Другое помещение", air: 20, n: 0.5, win: 0.15, wet: false }
  };

  WF.CITIES = [
    { id: "moscow", name: "Москва", outdoor: -26, hdd: 4600 },
    { id: "spb", name: "Санкт-Петербург", outdoor: -24, hdd: 4400 },
    { id: "kazan", name: "Казань", outdoor: -31, hdd: 5200 },
    { id: "ekb", name: "Екатеринбург", outdoor: -32, hdd: 5400 },
    { id: "nsk", name: "Новосибирск", outdoor: -37, hdd: 6200 },
    { id: "krd", name: "Краснодар", outdoor: -19, hdd: 2500 },
    { id: "sochi", name: "Сочи", outdoor: -3, hdd: 1100 },
    { id: "minsk", name: "Минск", outdoor: -25, hdd: 3900 },
    { id: "kld", name: "Калининград", outdoor: -19, hdd: 3400 },
    { id: "vvo", name: "Владивосток", outdoor: -24, hdd: 4100 },
    { id: "yakutsk", name: "Якутск", outdoor: -52, hdd: 10200 },
    { id: "custom", name: "Свой город", outdoor: -25, hdd: null }
  ];

  WF.U = {
    unknown: { wall: 0.6, window: 1.7, ceiling: 0.4, floor: 0.45, name: "не указано, взято среднее" },
    poor: { wall: 1.1, window: 2.7, ceiling: 0.9, floor: 0.9, name: "слабое утепление" },
    average: { wall: 0.55, window: 1.6, ceiling: 0.35, floor: 0.45, name: "обычный дом" },
    good: { wall: 0.32, window: 1.2, ceiling: 0.22, floor: 0.28, name: "хорошее утепление" },
    excellent: { wall: 0.18, window: 0.85, ceiling: 0.15, floor: 0.18, name: "современный тёплый контур" }
  };

  WF.COMFORT_Q = { bath: 160, kitchen: 140, living: 120, bedroom: 110, nursery: 110, hall: 130, balcony: 180, other: 130 };
  WF.MAIN_Q = { bath: 190, kitchen: 180, living: 170, bedroom: 160, nursery: 160, hall: 160, balcony: 210, other: 170 };

  WF.PRESETS = {
    bath: {
      name: "Ванна 1,7×0,7",
      w: 1.7,
      h: 0.7
    }
  };

  WF.FURNITURE = [
    { name: "Ванна", w: 1.7, h: 0.7 },
    { name: "Душевой поддон", w: 0.9, h: 0.9 },
    { name: "Шкаф", w: 1.2, h: 0.6 },
    { name: "Кухонный гарнитур", w: 2.4, h: 0.6 },
    { name: "Диван без ножек", w: 2.0, h: 0.9 },
    { name: "Тумба", w: 0.8, h: 0.45 },
    { name: "Стиральная машина", w: 0.6, h: 0.6 },
    { name: "Инсталляция", w: 0.45, h: 0.7 }
  ];

  WF.EXAMPLES = {
    bath: {
      roomType: "bath", cityId: "moscow", length: 2.5, width: 2.2, height: 2.7,
      above: "heated", below: "heated", insulation: "unknown", underlay: "unknown",
      windows: "", goal: "comfort", covering: "tile", system: "auto", brand: "warmehaus",
      screed: "no", areaMode: "obstacles", percent: 80, voltage: 230, tariff: "",
      statWall: "bottom", filmWidth: 0.5, indoor: "",
      obstacles: [{ name: "Ванна", x: 0.15, y: 0.15, w: 1.7, h: 0.7 }]
    },
    living: {
      roomType: "living", cityId: "moscow", length: 5.2, width: 3.8, height: 2.7,
      above: "heated", below: "heated", insulation: "average", underlay: "foil",
      windows: "", goal: "comfort", covering: "laminate", system: "auto", brand: "warmehaus",
      screed: "no", areaMode: "obstacles", percent: 75, voltage: 230, tariff: "",
      statWall: "bottom", filmWidth: 0.5, indoor: "",
      obstacles: [
        { name: "Шкаф", x: 0.1, y: 2.9, w: 1.6, h: 0.6 }
      ]
    },
    kitchen: {
      roomType: "kitchen", cityId: "moscow", length: 4.2, width: 3.1, height: 2.7,
      above: "heated", below: "ground", insulation: "average", underlay: "xps50",
      windows: "2.4", goal: "main", covering: "porcelain", system: "auto", brand: "warmehaus",
      screed: "yes", areaMode: "obstacles", percent: 70, voltage: 230, tariff: "6",
      statWall: "left", filmWidth: 0.5, indoor: "",
      obstacles: [{ name: "Кухонный гарнитур", x: 0.1, y: 0.1, w: 2.6, h: 0.6 }]
    }
  };

  WF.CIRCUIT_LIMIT_W = 3200;
  WF.STAT_LIMIT_A = 16;
})(typeof window !== "undefined" ? window : globalThis);
