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
      projection: { view: "top", origin: [287,237], scale: 72.66, angle: 0 },
      datum: { axis: "x", at: 287, points: [[5,75],[571,75]] },
      traces: [
        ["主翼","M264 35H44Q17 37 8 60Q0 79 11 110L30 146Q44 166 63 165H264Z M312 34L533 35Q562 38 570 69Q576 90 553 130Q535 161 513 165H312Z", "skin"],
        ["尾平面","M184 381L389 380Q423 393 391 435L184 437Q153 404 184 381Z", "skin"],
        ["前舱外缘","M265 23L309 23L310 164L265 164Z","opening"],
        ["尾架纵梁与横撑","M265 164L280 382L284 444 M309 164L295 382L290 444 M269 209H305 M272 259H303 M275 310H299 M277 359H296","strut"],
        ["尾架交叉张线","M265 164L305 209L272 259L299 310L277 359L293 384 M309 164L269 209L303 259L275 310L296 359L281 384","wire"],
      ],
    },
    {
      label: "正视 · 中立翼形与原稿测点", crop: [16, 493, 566, 173],
      projection: { view: "front", origin: [304,545], scale: 70.6, angle: 0 },
      datum: { axis: "x", at: 304, points: [[31,516],[575,530]] },
      traces: [
        ["主轮","M253 570L251 660L257 660L259 571Z M350 566L348 659L354 660L356 572Z", "body"],
        ["翼上支柱","M255 537L304 499L353 536", "strut"],
        ["中立主翼蒙布","M29 523Q30 519 56 521L140 525L251 534L259 534L259 564L149 559L70 552Q45 550 31 532Z M579 523Q578 519 552 521L468 525L357 534L349 534L349 564L459 559L538 552Q563 550 577 532Z","skin"],
        ["翼上张线","M304 499L138 523 M304 499L201 528 M304 499L241 531 M304 499L367 531 M304 499L407 528 M304 499L470 523","wire"],
        ["翼下张线","M304 615L106 535 M304 615L189 542 M304 615L419 542 M304 615L502 535","wire"],
        ["下部索架","M254 563L304 615L352 563","strut"],
      ],
    },
    {
      label: "侧视 · 机头朝左", crop: [0, 671, 480, 176],
      projection: { view: "side", origin: [233,727], scale: 72.3, angle: 0 },
      traces: [
        ["方向舵","M432 715Q435 706 446 707L465 709L466 752Q466 759 460 759H433Z", "skin"],
        ["前段侧蒙布","M23 721Q34 708 54 706Q78 704 116 714L116 761L23 763Z","skin"],
        ["后段外露纵梁与立柱","M116 715L164 718L212 721L263 725L308 729L357 732L400 736L437 740 M116 762L165 762L211 762L262 760L309 760L357 759L400 758L437 757 M165 718V762 M212 721V762 M263 725V760 M309 729V760 M357 732V759 M400 736V758","strut"],
        ["尾架交叉张线","M116 715L165 762L212 721L263 760L309 729L357 759L400 736L437 757 M116 762L165 718L212 762L263 725L309 760L357 732L400 758L437 740","wire"],
        ["主轮与辐条","M29 818a22 22 0 1 0 44 0a22 22 0 1 0 -44 0 M31 811L71 825 M34 831L68 805 M44 797L58 839 M43 839L59 797 M30 824L72 812","strut"],
        ["尾轮与辐条","M312 799a16 16 0 1 0 32 0a16 16 0 1 0 -32 0 M315 791L341 808 M316 808L340 790 M328 783V815","strut"],
        ["主轮与尾轮撑杆","M22 750L28 802L50 818L30 764 M263 762L328 797L358 759 M308 761L328 797","strut"],
        ["上部索架","M52 716L53 679L117 679V716","strut"],
        ["索架张线","M53 679L116 715 M117 679L54 711","wire"],
      ],
    },
    {
      label: "海峡机 · 伦敦展览正面照", crop: [432,143,422,122],
      traces: [
        ["翼面上缘","M442 173L512 176L589 179 M673 180L751 177L843 175","opening"],
        ["主轮轴线","M591 242L668 243","strut"],
      ],
      detail: { image: new URL("../../assets/reference/bleriot-xi/channel-front.webp", import.meta.url).href, size: [856,278],
        source: "https://flyingmachines.ru/Images7/Flight/1910/181-1.jpg", credit: "Flight · 1910 年，第 181 页，横渡后伦敦展览明信片（右图）" },
    },
  ],
  readings: [
    "俯视以桨毂和尾柱定 x=287 px，左右翼尖 x=5、571 px，半展 282、284 px。缩放线宽约 2 px，加配准误差取 4 px。",
    "同期照片右幅，图左、右翼尖上缘约 y=173、175 px（约 2–3 px 的印刷与定位误差）；跟轮轴一起看只呈小幅倾斜。此照片用于判断默认形态，不能反推原稿当时的操纵量。",
    "正视轮底 y≈660、661 px；翼尖外缘最高点约 y=516、530 px，相差 14 px。《Flight》1909 年的 No.11 操纵说明记载两翼可差动扭转。横渡后伦敦展览的同机正面照片（1910 年，第 181 页）显示两翼尖接近等高。中立图板以桨轴中面 x=304 px 配对两侧翼缘，取两翼尖约 y=523 px 的对称轮廓，保留两侧浅上反；14 px 原读数留在底图。原稿是否特意表现翼翘，现有说明不足以判定。",
  ],
  modelNote: "两翼按海峡机同期照片取等高的中立翼尖，保留浅上反。翼根剖面由侧视弯度近似，翼翘索的外露段延伸至后索架，滑轮内部走线省略。",
  pending: "中立翼尖已按海峡机照片校正。仍需海峡机翼根横截面与翼翘索经过后桅的具体连接。",
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
    photo(new URL("../../assets/reference/bleriot-xi/channel-front.webp", import.meta.url).href, "https://flyingmachines.ru/Images7/Flight/1910/181-1.jpg", "海峡机在伦敦展出的后侧与正面照片", "右图对照左右翼端与轮轴；明信片翻印有透视误差", "Flight，1910 年，第 181 页"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/Replica_Bl%C3%A9riot_XI_at_Volandia_museum._25-3-2023.jpg/1280px-Replica_Bl%C3%A9riot_XI_at_Volandia_museum._25-3-2023.jpg", `${commons}File:Replica Blériot XI at Volandia museum. 25-3-2023.jpg`, "Volandia 博物馆的 Blériot XI 复制机", "机头发动机和翼上支柱"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/Replica_Bl%C3%A9riot_XI_at_Volandia_museum._25-3-2023_-_54277766696.jpg/1280px-Replica_Bl%C3%A9riot_XI_at_Volandia_museum._25-3-2023_-_54277766696.jpg", `${commons}File:Replica Blériot XI at Volandia museum. 25-3-2023 - 54277766696.jpg`, "Blériot XI 复制机侧前方", "座舱与尾段比例"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Bl%C3%A9riot_XI.svg/1280px-Bl%C3%A9riot_XI.svg.png", `${commons}File:Blériot XI.svg`, "Blériot XI 结构线稿", "主翼和尾翼关系"),
  ],
});
