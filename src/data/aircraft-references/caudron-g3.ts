import { commons, photo, pioneer } from "./sources";

import type { AircraftTraceStudy } from "./types";

const study: AircraftTraceStudy = {
  source: "https://www.the-blueprints.com/blueprints/ww1planes/ww1-france/46172/view/caudron_g-iii/",
  credit: "Caudron G-III · 图 46172",
  image: new URL("../../assets/reference/caudron-g3/study.webp", import.meta.url).href,
  size: [814, 850],
  panels: [
    {
      label: "侧视 · 机头朝左", crop: [162, 0, 445, 199],
      traces: [
        ["短舱","M202 55L269 54L295 61Q305 77 319 75L334 64L377 77L377 106L324 123L222 127L207 116Z"],
        ["尾梁","M228 34L553 114 M227 181L552 149"],
        ["方向舵","M529 105Q549 45 594 32V102L556 112Z"],
        ["主轮","M203 174a22 22 0 1 0 44 0a22 22 0 1 0 -44 0"],
      ],
    },
    {
      label: "俯视 · 机头朝下", crop: [0, 190, 814, 447],
      datum: { axis: "x", at: 406, points: [[3,504],[809,503],[309,242],[501,242]] },
      traces: [
        ["主翼","M3 504Q17 495 35 477L54 472L128 474L215 473L303 474L368 473L378 508L382 517L431 516L442 472L505 474L589 473L680 474L759 472L779 477L795 492L809 503L798 566Q797 573 790 573H20Q16 573 15 565Z"],
        ["尾平面","M269 199L290 194L329 197L369 195L383 216L428 216L443 195L481 196L519 194L542 199V266L270 267Z"],
        ["短舱","M396 437Q404 423 415 436L430 474L432 508Q428 519 405 525Q381 521 378 509L382 475Z"],
        ["尾梁","M309 242L310 618 M501 242L500 618"],
      ],
    },
    {
      label: "正视", crop: [5, 645, 804, 205],
      datum: { axis: "x", at: 406, points: [[11,698],[805,698]] },
      traces: [
        ["上翼","M11 698Q18 681 95 681L315 680L706 680Q788 681 805 698L779 707L685 705L565 704L423 705L272 704L151 703L37 708Z"],
        ["下翼","M178 775L635 773L639 786L179 789Z"],
        ["短舱","M376 717Q406 683 435 720V774Q434 806 407 810Q379 807 376 777Z"],
        ["主轮","M290 804L297 801L300 840L293 845Z M516 803L523 802L525 840L518 844Z"],
      ],
    },
  ],
  readings: [
    "俯视以短舱和桨毂定 x=406 px；主翼最外端 x=3、809 px，各距 403 px。尾梁中心 x=309、501 px，相距中面 97、95 px。",
    "正视桨轴 x=406 px，上翼尖 x=11、805 px，半展 395、399 px。线宽约 2 px，加端点与配准误差取 4 px。",
  ],
  pending: "需确定图中 G.3 具体动力安装及与其配套的下翼根、翼翘或副翼边界，核对短舱横截面。",
};

export default pioneer({
  id: "caudron-g3",
  study,
  frameId: "reference_caudron_g3",
  prototype: "Caudron G.3",
  chineseName: "高德隆 G.3",
  period: "1914 · 航空萌芽时期末段",
  role: "推进式侦察训练机",
  summary: "中央短舱、单发动机推进布局、半双翼和开放式尾梁桁架组成细长的侦察机轮廓。",
  structuralNotes: [
    "中央短舱位于机翼之间，发动机在短舱前端，尾梁从短舱后方展开。",
    "上、下翼面积不同，半双翼关系必须在正视和俯视同时保留。",
    "尾梁是主要识别结构，不能把它合并成普通单尾杆。",
  ],
  modules: [
    { key: "center", label: "中央乘员短舱", slot: "center", detail: "飞行员、观察员和前置发动机" },
    { key: "wing", label: "半双翼翼组", slot: "leftWing", detail: "上翼、下翼和翼间支柱" },
    { key: "engine", label: "短舱前置发动机", slot: "nose", detail: "推进螺旋桨与发动机舱" },
    { key: "tail", label: "开放式尾梁", slot: "tail", detail: "双侧尾梁和尾翼连接" },
  ],
  threeView: {
    src: study.image,
    alt: "Caudron G-III · 图 46172参考图",
    source: study.source,
    note: study.credit,
    variant: "Caudron G.3 reconnaissance and trainer layout",
    viewCoverage: "侧视 / 俯视 / 正视",
    loading: "pending",
  },
  photos: [
    photo("https://upload.wikimedia.org/wikipedia/commons/7/79/Cesare_Cervetti_con_un_aereo_Caudron_G_3%2C_1916.jpg", `${commons}File:Cesare Cervetti con un aereo Caudron G 3, 1916.jpg`, "Caudron G.3 历史照片", "中央短舱和尾梁"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Caudron_G.3_coloured_drawing.jpg/1280px-Caudron_G.3_coloured_drawing.jpg", `${commons}File:Caudron G.3 coloured drawing.jpg`, "Caudron G.3 彩色技术图", "半双翼和发动机位置"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/Typen_feindl._Flugzeuge._Zweck_der_Aufnahme_war%2C_die_Herstellung_von_Diapositiven_f%C3%BCr_den_Fliegervortrag._%28BildID_15499679%29.jpg/1280px-Typen_feindl._Flugzeuge._Zweck_der_Aufnahme_war%2C_die_Herstellung_von_Diapositiven_f%C3%BCr_den_Fliegervortrag._%28BildID_15499679%29.jpg", `${commons}File:Typen feindl. Flugzeuge. Zweck der Aufnahme war, die Herstellung von Diapositiven für den Fliegervortrag. (BildID 15499679).jpg`, "早期军用飞机类型照片", "尾梁和观察机舱对照"),
  ],
});
