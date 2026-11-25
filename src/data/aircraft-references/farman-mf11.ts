import { commons, photo, pioneer } from "./sources";

import type { AircraftTraceStudy } from "./types";

const study: AircraftTraceStudy = {
  source: "https://www.the-blueprints.com/blueprints/ww2planes/various/61165/view/farman_mf_11/",
  credit: "Farman MF.11 · MF 193 涂装，图 61165",
  image: new URL("../../assets/reference/farman-mf11/study.webp", import.meta.url).href,
  size: [608, 850],
  panels: [
    {
      label: "左向侧视 · MF 193", crop: [60, 0, 548, 211],
      projection: { view: "side", origin: [308,104], scale: 61.0, angle: 0 },
      traces: [
        ["短舱","M83 97Q84 78 105 66L117 54L132 67L216 70L234 86L232 109L92 116Q83 113 83 97Z", "skin"],
        ["推进桨","M276 9L279 9L280 155L277 160L273 110Z", "body"],
        ["尾梁","M238 37L577 90 M238 138L579 90", "strut"],
        ["方向舵","M561 35L581 26Q592 24 593 35L590 76L576 84L558 82Z", "skin"],
        ["主轮","M168 188a20 20 0 1 0 40 0a20 20 0 1 0 -40 0", "body"],
        ["尾梁立柱","M336 52V122 M429 69V109 M514 80V98","strut"],
        ["尾梁交叉张线","M239 38L336 122L429 69L514 98 M240 136L336 52L429 109L514 80","wire"],
      ],
    },
    {
      label: "斜置平面图 · 中央短舱与双翼", crop: [0, 169, 342, 465],
      projection: { view: "top", origin: [185,371], scale: 30.0, angle: -116.4 },
      traces: [
        ["主翼","M3 205Q0 194 12 188L50 173L266 607L227 626Q209 632 204 616Z", "skin"],
        ["短舱","M65 430Q59 438 74 440L160 395L152 382Z", "skin"],
        ["尾平面","M229 259L268 241L341 387L308 404Q297 407 291 396Z", "skin"],
        ["尾梁","M81 365L232 289 M117 449L288 370", "strut"],
        ["尾架横撑","M159 331L204 419 M203 309L248 399","strut"],
        ["尾架对角张线","M115 353L203 419L242 289 M159 331L287 379 M114 308L203 309","wire"],
      ],
    },
    {
      label: "正视 · 年鉴双翼及轮架", crop: [6, 198, 722, 169],
      projection: { view: "front", origin: [372,267], scale: 44.46, angle: 0.85 },
      datum: { axis: "x", at: 372, points: [[10,212],[728,222]] },
      traces: [
        ["上翼","M11 211L358 216L716 222L728 222V227L352 222L12 217Z", "skin"],
        ["下翼","M109 297L353 301L635 307L636 313L110 303Z", "skin"],
        ["短舱","M351 261Q355 246 372 245Q390 247 393 263V302L381 311L363 311L353 305Z", "skin"],
        ["轮架","M355 305L283 345L310 346L365 311 M382 310L435 348L462 349L390 303", "strut"],
        ["翼间支柱","M49 217L132 298V219 M224 220V299 M296 222V301 M449 223V304 M521 223V305 M614 225V306L701 227","strut"],
        ["翼间交叉拉线","M132 218L224 298L296 220 M132 298L224 219L296 300 M450 223L521 306L613 225 M450 303L521 224L614 307","wire"],
      ],
      detail: { image: new URL("../../assets/reference/farman-mf11/mf-janes.webp", import.meta.url).href, size: [732, 850],
        source: "https://flyingmachines.ru/Images7/03-Front-1/Janes/Farman_MF11-p.jpg", credit: "Jane’s All the World’s Aircraft 1919 · M. Farman S-11" },
    },
    {
      label: "短舱剖面 · 站位见侧视", crop: [29, 222, 309, 120],
      traces: [
        ["前舱截面","M41 312L41 291Q44 276 54 274Q64 275 68 290V312Z", "body"],
        ["后舱截面","M99 313V289L103 281L114 283L126 280L137 289L138 313Z", "body"],
      ],
      detail: { image: new URL("../../assets/reference/farman-mf11/mf-front.webp", import.meta.url).href, size: [596, 850],
        source: "https://flyingmachines.ru/Images7/03-Front-1/32-Farman_MF11.gif", credit: "В. Кондратьев · MF.11 短舱横截面 A–A、B–B" },
    },
  ],
  readings: [
    "MF 193 的有色短舱包住乘员，后部尾梁各格由纵梁、立柱和交叉张线围成，推进桨平面与尾梁分开。",
    "侧视推进桨叶沿 x≈277 px，尾舵前缘 x≈560 px；以主轮胎外径约 40 px 作为图内比对量。",
    "年鉴正视的短舱中线约 x=372 px，上翼尖 x=10、728 px，半展 362、356 px。轮轴与翼面一起向右下倾斜，约 6 px 的差值超过 4 px 初筛容差（原线约 2 px，加配准误差）。",
  ],
  modelNote: "主翼按年鉴校正纸面倾斜。MF 193 侧视和年鉴剖面控制短舱外形，舱口深度、双尾舵横距与轮架前后接头近似。",
  pending: "年鉴补足正视，截面图给出 A–A、B–B。需核对 MF 193 与年鉴机的短舱开口、尾舵和轮架安装是否一致，再配准倾斜图纸。",
};

export default pioneer({
  id: "farman-mf11",
  study,
  frameId: "reference_farman_mf11",
  prototype: "Farman MF.11 Shorthorn",
  chineseName: "莫里斯·法曼 MF.11 短角",
  period: "1913 · 航空萌芽时期末段",
  role: "推进式双座侦察轰炸机",
  summary: "推进式双翼、前置观察员舱、后置发动机和短尾梁组成早期侦察轰炸机的清晰轮廓。",
  structuralNotes: [
    "观察员位于机头前方，飞行员在主翼前后之间，发动机和推进桨位于后方。",
    "短尾梁和开放式座舱是 MF.11 与普通牵引式双翼机的主要区别。",
    "MF.11 与 Longhorn、Shorthorn 版本存在尾梁和方向舵差异，原型板先固定 Shorthorn。",
  ],
  modules: [
    { key: "center", label: "双座中央短舱", slot: "center", detail: "前置观察员和后置飞行员" },
    { key: "wing", label: "推进式双翼", slot: "leftWing", detail: "上下翼、支柱和张线" },
    { key: "engine", label: "后置发动机与推进桨", slot: "tail", detail: "发动机舱和桨盘" },
    { key: "tail", label: "短尾梁与尾翼", slot: "tail", detail: "尾梁、垂尾和方向舵" },
  ],
  threeView: {
    src: study.image,
    alt: "Farman MF.11 · MF 193 涂装，图 61165参考图",
    source: study.source,
    note: study.credit,
    variant: "Maurice Farman MF.11 Shorthorn",
    viewCoverage: "左向侧视 / 斜置平面图",
    loading: "pending",
  },
  photos: [
    photo("https://upload.wikimedia.org/wikipedia/commons/c/c1/Farman_MF.11_%28SDASM_Archives_00076859%29.jpg", `${commons}File:Farman MF.11 (SDASM Archives 00076859).jpg`, "Farman MF.11 历史照片", "前置观察员与推进桨"),
    photo("https://upload.wikimedia.org/wikipedia/commons/9/99/Farman_MF_11_Italia.jpg", `${commons}File:Farman MF 11 Italia.jpg`, "意大利空军 Farman MF.11", "双翼和短尾梁"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cd/Farman_Shorthorn_MF11.jpg/1280px-Farman_Shorthorn_MF11.jpg", `${commons}File:Farman Shorthorn MF11.jpg`, "Farman Shorthorn 展示机", "后置发动机与座舱"),
  ],
});
