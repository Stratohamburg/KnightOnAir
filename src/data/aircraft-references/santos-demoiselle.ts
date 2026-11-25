import { commons, photo, pioneer } from "./sources";

import type { AircraftTraceStudy } from "./types";

const study: AircraftTraceStudy = {
  source: "https://flyingmachines.ru/Site2/Crafts/Craft28341.htm",
  credit: "Flight · 1909 年，第 598 页，No. 20",
  image: new URL("../../assets/reference/santos-demoiselle/study.webp", import.meta.url).href,
  size: [638, 850],
  panels: [
    {
      label: "俯视 · 机头朝左", crop: [58, 306, 543, 477],
      projection: { view: "top", origin: [329,546], scale: 83.43, angle: -90 },
      datum: { axis: "y", at: 546, points: [[72,317],[72,775]] },
      traces: [
        ["主翼","M71 317L236 316L234 450L235 641L234 776L72 775L72 641H93V450H71Z", "skin"],
        ["整体尾舵","M465 509L499 464L544 483L590 545L543 605L500 628L464 580L497 546Z", "skin"],
        ["牵引桨","M80 463Q91 461 84 537L86 612Q85 630 77 625L76 552Z", "body"],
        ["竹纵梁","M235 531L499 545L235 561 M235 547L499 546","strut"],
        ["尾舵操纵索","M355 542L499 465 M355 551L499 628","wire"],
      ],
    },
    {
      label: "侧视 · 机头朝左", crop: [57, 30, 548, 214],
      projection: { view: "side", origin: [331,161], scale: 85, angle: 0 },
      traces: [
        ["主翼","M88 118Q144 113 235 146L231 172Q170 146 88 131Z", "skin"],
        ["整体尾舵","M468 141L503 127L550 142L590 171L542 204L505 221L467 203L501 176Z", "skin"],
        ["主轮","M97 216a23 23 0 1 0 46 0a23 23 0 1 0 -46 0", "body"],
        ["竹纵梁及撑杆","M96 132L501 164 M126 216L501 178 M209 144L208 208 M286 150V202 M359 156V194 M437 160V186","strut"],
        ["桁架交叉张线","M208 208L286 151L359 194L437 162 M209 145L286 201L359 156L437 185","wire"],
        ["尾舵操纵索","M214 201L437 113L501 129 M209 142L437 232L503 220","wire"],
      ],
    },
    {
      label: "正视 · Flight 第 615 页", crop: [0, 0, 930, 380],
      datum: { axis: "x", at: 457, points: [[4,83],[926,81]] },
      traces: [
        ["主翼","M4 83Q140 77 274 88L277 99L451 121L634 100L636 89Q801 76 926 81L905 124Q833 111 724 138L512 181L455 198L316 164Q170 142 24 163Z", "skin"],
        ["牵引桨","M296 174Q301 155 431 102L461 78Q531 9 611 4Q632 7 605 27L480 88L450 112Q348 191 302 184Z", "body"],
        ["轮架撑杆","M454 122L414 329 M458 123L506 329 M423 328L464 301L500 329","strut"],
        ["翼下张线","M99 156L401 355 M828 119L520 355 M274 100L401 261 M634 99L508 268","wire"],
      ],
      detail: { image: new URL("../../assets/reference/santos-demoiselle/detail.webp", import.meta.url).href, size: [930, 380],
        source: "https://flyingmachines.ru/Images7/Flight/1909/615-1.jpg", credit: "Flight · 1909 年，第 615 页，迎面结构图" },
    },
    {
      label: "尾枢细图 · 整体俯仰与偏航", crop: [0, 30, 524, 522],
      traces: [
        ["整体尾舵","M114 111L233 45L371 85L508 164L482 234L391 301L279 289L228 393L110 358L186 281L108 253L237 224Z", "skin"],
        ["双轴接头","M397 367L418 362L422 480L415 495L405 490Z M321 432L419 454L466 449L476 456L473 462L418 468L323 444Z", "body"],
      ],
      detail: { image: new URL("../../assets/reference/santos-demoiselle/demo-tail.webp", import.meta.url).href, size: [528, 556],
        source: "https://flyingmachines.ru/Images7/Flight/1909/615-2.jpg", credit: "Flight · 1909 年，第 615 页，尾舵和双轴接头" },
    },
    {
      label: "翼肋比对 · 原刊标弦长 7 ft", crop: [317, 266, 280, 62],
      traces: [
        ["展出机翼肋","M327 293Q356 277 386 280Q445 276 512 293L579 319Q510 304 449 296Q383 286 327 295Z", "body"],
      ],
      detail: { image: new URL("../../assets/reference/santos-demoiselle/demo-ribs.webp", import.meta.url).href, size: [624, 850],
        source: "https://flyingmachines.ru/Images7/Flight/1910/273-1.jpg", credit: "Flight · 1910 年，第 273 页，展出机翼型" },
    },
  ],
  readings: [
    "翼面与整体尾舵蒙布，尾部三根竹纵梁外露。按工作图分别描出桁架内的斜拉线及通往尾舵的操纵索。",
    "第 598 页标注机长 20 ft、翼展 18 ft。俯视桨轴与尾枢定 y=546 px，翼尖 y=317、775 px，半展读数各 229 px。原线约 2 px，含定位误差取 4 px。",
    "第 615 页正视写生中，桨毂 x≈457 px，翼端 x≈4、926 px。原刊以虚线绘轮位，姿态及投影比例需用有尺寸的横剖图复核。",
  ],
  modelNote: "主翼采用 No.20 图的弦长和前缘缺口，展出机翼肋只约束弯度方向。展向抬升按正视写生近似，尾舵围绕工作图的双轴接头装配。",
  pending: "尾枢细图已定位双轴。1910 年展出机翼肋弦长 7 ft，而 No.20 原图为 6 ft 5 in。需核定该翼型能否用于所选 No.20，并复核正视写生的投影误差。",
};

export default pioneer({
  id: "santos-demoiselle",
  study,
  frameId: "reference_santos_demoiselle",
  prototype: "Santos-Dumont Demoiselle",
  chineseName: "桑托斯·杜蒙 Demoiselle",
  period: "1907–1909 · 航空萌芽时期",
  role: "轻型开放式单翼机",
  summary: "高翼、竹制开放桁架、翼前缘发动机和十字尾翼组成的轻型单翼机。",
  structuralNotes: [
    "三根主要竹制纵梁和开放式机身是机体识别骨架。",
    "发动机位于机翼前缘附近，飞行员座位在主翼下方和主轮之间。",
    "No.19、No.20 和后续版本的前置升降面与发动机位置不同，需要先锁定变体。",
  ],
  modules: [
    { key: "center", label: "竹制开放机身", slot: "center", detail: "三根纵梁、座椅和主轮" },
    { key: "wing", label: "高置主翼", slot: "leftWing", detail: "细薄翼面与翼翘控制" },
    { key: "engine", label: "翼前缘发动机", slot: "nose", detail: "发动机、散热器和前置螺旋桨" },
    { key: "tail", label: "十字尾翼", slot: "tail", detail: "单尾梁末端的方向与俯仰控制" },
  ],
  threeView: {
    src: study.image,
    alt: "Flight · 1909 年，第 598 页，No. 20参考图",
    source: study.source,
    note: study.credit,
    variant: "Demoiselle No.20 working drawing",
    viewCoverage: "俯视 / 侧视 / 正视",
    loading: "pending",
  },
  photos: [
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Santos-Dumont_Demoiselle_Type_20_at_Mus%C3%A9e_de_l%27air_et_de_l%27espace%2C_Le_Bourget%2C_France_%2853370599741%29.jpg/1280px-Santos-Dumont_Demoiselle_Type_20_at_Mus%C3%A9e_de_l%27air_et_de_l%27espace%2C_Le_Bourget%2C_France_%2853370599741%29.jpg", `${commons}File:Santos-Dumont Demoiselle Type 20 at Musée de l'air et de l'espace, Le Bourget, France (53370599741).jpg`, "Le Bourget 的 Demoiselle Type 20", "开放桁架与高翼"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/4/48/Santos-Dumont_Demoiselle_Type_20_at_Mus%C3%A9e_de_l%27air_et_de_l%27espace%2C_Le_Bourget%2C_France_%2853370912624%29.jpg/1280px-Santos-Dumont_Demoiselle_Type_20_at_Mus%C3%A9e_de_l%27air_et_de_l%27espace%2C_Le_Bourget%2C_France_%2853370912624%29.jpg", `${commons}File:Santos-Dumont Demoiselle Type 20 at Musée de l'air et de l'espace, Le Bourget, France (53370912624).jpg`, "Demoiselle Type 20 侧前方", "发动机与座舱站位"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1f/Demoiselle_voando_nos_arredores_de_Paris_-_1-13800-0000-0000%2C_Acervo_do_Museu_Paulista_da_USP.jpg/1280px-Demoiselle_voando_nos_arredores_de_Paris_-_1-13800-0000-0000%2C_Acervo_do_Museu_Paulista_da_USP.jpg", `${commons}File:Demoiselle voando nos arredores de Paris - 1-13800-0000-0000, Acervo do Museu Paulista da USP.jpg`, "Demoiselle 飞行历史照片", "飞行姿态与翼面比例"),
  ],
});
