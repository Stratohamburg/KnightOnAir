import { commons, photo, pioneer } from "./sources";

import type { AircraftTraceStudy } from "./types";

const study: AircraftTraceStudy = {
  source: "https://flyingmachines.ru/Site2/Crafts/Craft25595.htm",
  credit: "R. Keimel · Etrich II Taube，1910 年 4 月",
  image: new URL("../../assets/reference/etrich-taube/taube-ii.webp", import.meta.url).href,
  size: [420, 599],
  panels: [
    {
      label: "Etrich II · 1910 年 4 月俯视", crop: [0, 118, 406, 353],
      traces: [
        ["主翼","M157 213L51 286Q33 305 29 329L6 366L32 376L32 415L56 428Q80 416 104 360L115 350L165 320L201 288L217 278L253 262Q277 244 296 228Q313 217 342 216L376 206L398 194L400 182L395 165L344 145L360 121L299 133Q277 134 263 143Z"],
        ["尾平面","M230 429L253 414L259 381L335 354L357 410L322 441L277 469Z"],
        ["机身","M140 233L159 214L178 207L203 256L221 280L320 408L304 422L201 290L166 252Z"],
      ],
    },
    {
      label: "Etrich II · 侧视", crop: [66, 7, 297, 112],
      traces: [
        ["机身","M79 54L110 52L164 57L293 57L352 58L294 68L169 77L84 81Z"],
        ["主轮","M87 108a10 10 0 1 0 20 0a10 10 0 1 0 -20 0"],
        ["尾舵","M240 56L293 20L353 58L295 78Z"],
      ],
    },
    {
      label: "Etrich II · 正视", crop: [4, 459, 411, 116],
      traces: [
        ["主翼","M10 513L82 505L184 506L300 505L388 505L411 509L393 514L300 513L221 512L163 512L79 515Z"],
        ["桥式支撑","M12 515L40 528L163 534 M220 532L341 526L410 509"],
        ["主轮","M160 544L165 544V572H160Z M216 544H221V571H216Z"],
      ],
    },
    {
      label: "对照稿 · 俯视 · 机头朝下", crop: [0, 172, 700, 485],
      datum: { axis: "x", at: 351, points: [[9,451],[693,454],[45,410],[658,410]] },
      traces: [
        ["主翼","M322 454Q288 446 231 457L179 467Q154 470 130 454L88 428L45 410L13 426L9 451L17 543Q75 568 121 581Q147 590 183 590H309L323 583Z M380 454Q410 446 470 456L522 466Q546 470 568 457L612 426L658 410L677 415L692 429L693 454L686 544Q625 568 577 582Q549 590 516 590H394L381 582Z"],
        ["尾平面","M275 188Q312 177 352 177Q391 178 428 188L442 286L396 287L352 294L305 287H261Z"],
        ["机身","M345 265L356 265L370 480L372 566L358 635L349 646L335 570L334 480Z"],
      ],
      detail: { image: new URL("../../assets/reference/etrich-taube/study.webp", import.meta.url).href, size: [700, 850],
        source: "https://www.the-blueprints.com/blueprints/ww2planes/various/46285/view/etrich_taube/", credit: "图 46285 · 构型对照" },
    },
    {
      label: "对照稿 · 正视", crop: [1, 682, 698, 168],
      datum: { axis: "x", at: 351, points: [[9,730],[693,730],[115,690],[587,690]] },
      traces: [
        ["桥式支撑","M9 730L113 772L308 789 M349 785L588 773L693 730"],
        ["主翼","M9 730L115 690L113 734L308 748L329 757 M374 756L395 747L588 734L587 690L693 731"],
        ["主轮","M305 819L312 820V844H305Z M391 819H397V844H391Z"],
      ],
      detail: { image: new URL("../../assets/reference/etrich-taube/study.webp", import.meta.url).href, size: [700, 850],
        source: "https://www.the-blueprints.com/blueprints/ww2planes/various/46285/view/etrich_taube/", credit: "图 46285 · 构型对照" },
    },
    {
      label: "对照稿 · 侧视 · 机头朝左", crop: [81, 0, 502, 169],
      traces: [
        ["机身","M108 58L159 54L204 48L280 49L464 74L565 78L465 89L208 104L158 100L112 86Z"],
        ["尾舵","M431 77L463 30L566 79L465 126Z"],
        ["主轮","M164 143a20 20 0 1 0 40 0a20 20 0 1 0 -40 0"],
      ],
      detail: { image: new URL("../../assets/reference/etrich-taube/study.webp", import.meta.url).href, size: [700, 850],
        source: "https://www.the-blueprints.com/blueprints/ww2planes/various/46285/view/etrich_taube/", credit: "图 46285 · 构型对照" },
    },
  ],
  readings: [
    "已选 Keimel 图中有明确日期的 Etrich II。原稿正视左翼尖超出扫描边缘，保留该缺口。",
    "对照稿俯视由机鼻、尾柱定 x=351 px。翼尖外缘 x=9、693 px，半展均 342 px；鸟形翼后缘两端高点 y=410、410 px。",
    "对照稿正视桨轴 x=351 px；左右最外端 x=9、693，桥柱顶点 (115,690)、(587,690)。原线及缩放约 2 px，初筛容差 3 px。",
  ],
  pending: "Etrich II 两侧桥柱下有小轮，构型对照稿的桥柱末端不同。需同一 1910 年 4 月构型的完整正视左翼尖与翼肋，才能定稿翼尖高度及翼翘截面。",
};

export default pioneer({
  id: "etrich-taube",
  study,
  frameId: "reference_etrich_taube",
  prototype: "Etrich Taube",
  chineseName: "埃特里希 Taube 鸽式机",
  period: "1910 · 航空萌芽时期",
  role: "鸟形单翼侦察机",
  summary: "鸟形后掠翼、翼下桥式支撑和双方向舵组成高辨识度的早期军用单翼机。",
  structuralNotes: [
    "主翼的后掠和柔和弧线是首要轮廓，翼尖不能改成普通直翼。",
    "翼下桥式支撑、翼尖立柱和张线决定正视轮廓。",
    "机身和尾翼采用传统中心线布局，左右翼面应先独立描读再镜像。",
  ],
  modules: [
    { key: "center", label: "细长机身与座舱", slot: "center", detail: "机鼻、座舱和尾梁" },
    { key: "wing", label: "鸟形后掠主翼", slot: "leftWing", detail: "弧形翼尖、翼翘和桥式支撑" },
    { key: "engine", label: "前置发动机", slot: "nose", detail: "牵引式螺旋桨和外露动力舱" },
    { key: "tail", label: "双方向舵尾翼", slot: "tail", detail: "变形尾平面与双垂直舵面" },
  ],
  threeView: {
    src: study.image,
    alt: "Etrich II Taube 1910 年 4 月三视图",
    source: study.source,
    note: study.credit,
    variant: "Etrich II Taube, April 1910",
    viewCoverage: "俯视 / 正视 / 侧视",
    loading: "pending",
  },
  photos: [
    photo("https://upload.wikimedia.org/wikipedia/commons/4/4b/Etrich_Taube-1.jpg", `${commons}File:Etrich Taube-1.jpg`, "Etrich Taube 侧前方照片", "鸟形翼尖与机鼻"),
    photo("https://upload.wikimedia.org/wikipedia/commons/c/cf/Etrich_Taube-2.jpg", `${commons}File:Etrich Taube-2.jpg`, "Etrich Taube 侧后方照片", "尾翼和翼下支撑"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/e/eb/TMW_ERICH_TAUBE_II_sl.02.jpg/1280px-TMW_ERICH_TAUBE_II_sl.02.jpg", `${commons}File:TMW ERICH TAUBE II sl.02.jpg`, "技术博物馆的 Taube", "座舱、主翼和起落架"),
  ],
});
