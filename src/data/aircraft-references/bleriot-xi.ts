import { commons, photo, pioneer } from "./sources";

import type { AircraftTraceStudy } from "./types";

const study: AircraftTraceStudy = {
  source: "https://www.the-blueprints.com/blueprints/ww1planes/ww1-france/42121/view/bleriot_xi_la_manche/",
  credit: "Blériot XI La Manche · 图 42121",
  image: new URL("../../assets/reference/bleriot-xi/study.webp", import.meta.url).href,
  size: [583, 850],
  panels: [
    {
      label: "俯视 · 机头朝上", crop: [0, 0, 580, 477],
      datum: { axis: "x", at: 287, points: [[5,75],[571,75]] },
      traces: [
        ["主翼","M264 35H44Q17 37 8 60Q0 79 11 110L30 146Q44 166 63 165H264Z M312 34L533 35Q562 38 570 69Q576 90 553 130Q535 161 513 165H312Z"],
        ["机身","M265 23L309 23L310 165L296 375L289 445H283L275 377L264 164Z"],
        ["尾平面","M184 381L389 380Q423 393 391 435L184 437Q153 404 184 381Z"],
      ],
    },
    {
      label: "正视 · 原稿翼尖有高差", crop: [16, 493, 566, 173],
      datum: { axis: "x", at: 304, points: [[31,516],[575,530]] },
      traces: [
        ["主翼","M30 516Q43 513 89 518L254 535L304 541L356 535L548 530Q586 527 578 541Q569 555 542 561L355 565L302 565L250 564L68 546Q37 538 30 522Z"],
        ["主轮","M253 570L251 660L257 660L259 571Z M350 566L348 659L354 660L356 572Z"],
        ["翼上支柱","M255 537L304 499L353 536"],
      ],
    },
    {
      label: "侧视 · 机头朝左", crop: [0, 671, 480, 176],
      traces: [
        ["机身","M20 721Q26 705 54 704L117 715L436 740L437 757L23 763Z"],
        ["方向舵","M432 715Q435 706 446 707L465 709L466 752Q466 759 460 759H433Z"],
        ["主轮","M28 816a23 23 0 1 0 46 0a23 23 0 1 0 -46 0"],
        ["尾轮","M312 798a17 17 0 1 0 34 0a17 17 0 1 0 -34 0"],
      ],
    },
  ],
  readings: [
    "俯视以桨毂和尾柱定 x=287 px，左右翼尖 x=5、571 px，半展 282、284 px。缩放线宽约 2 px，加配准误差取 4 px。",
    "正视轮底 y≈660、661 px；翼尖外缘最高点约 y=516、530 px，相差 14 px。此图有翼翘或制图差异，尚不能定为实机不对称。",
  ],
  pending: "需同一海峡型中立翼翘状态的正视证据，核定前视翼尖高差及翼根截面。",
};

export default pioneer({
  id: "bleriot-xi",
  study,
  frameId: "reference_bleriot_xi",
  prototype: "Blériot XI",
  chineseName: "布莱里奥 XI",
  period: "1909 · 航空萌芽时期",
  role: "牵引式单翼侦察机",
  summary: "牵引式单翼、外露三缸扇形发动机、翼上支柱和细长尾段构成英吉利海峡飞行的代表性轮廓。",
  structuralNotes: [
    "发动机位于机头，螺旋桨为牵引式，机翼后方是开放式座舱。",
    "主翼由中央支柱和张线支撑，侧视不能简化成无支撑单翼。",
    "翼翘控制和尾部起落架需要与主翼支撑系统分开记录。",
  ],
  modules: [
    { key: "center", label: "细长机身与座舱", slot: "center", detail: "开放座舱和尾段纵梁" },
    { key: "wing", label: "高置主翼", slot: "leftWing", detail: "翼翘控制、支柱和张线" },
    { key: "engine", label: "机头三缸扇形发动机", slot: "nose", detail: "牵引桨盘和外露气缸" },
    { key: "tail", label: "尾翼与尾轮", slot: "tail", detail: "水平尾翼、方向舵和尾部支点" },
  ],
  threeView: {
    src: study.image,
    alt: "Blériot XI La Manche · 图 42121参考图",
    source: study.source,
    note: study.credit,
    variant: "Blériot XI cross-Channel configuration",
    viewCoverage: "俯视 / 正视 / 侧视",
    loading: "pending",
  },
  photos: [
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/Replica_Bl%C3%A9riot_XI_at_Volandia_museum._25-3-2023.jpg/1280px-Replica_Bl%C3%A9riot_XI_at_Volandia_museum._25-3-2023.jpg", `${commons}File:Replica Blériot XI at Volandia museum. 25-3-2023.jpg`, "Volandia 博物馆的 Blériot XI 复制机", "机头发动机和翼上支柱"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/Replica_Bl%C3%A9riot_XI_at_Volandia_museum._25-3-2023_-_54277766696.jpg/1280px-Replica_Bl%C3%A9riot_XI_at_Volandia_museum._25-3-2023_-_54277766696.jpg", `${commons}File:Replica Blériot XI at Volandia museum. 25-3-2023 - 54277766696.jpg`, "Blériot XI 复制机侧前方", "座舱与尾段比例"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Bl%C3%A9riot_XI.svg/1280px-Bl%C3%A9riot_XI.svg.png", `${commons}File:Blériot XI.svg`, "Blériot XI 结构线稿", "主翼和尾翼关系"),
  ],
});
