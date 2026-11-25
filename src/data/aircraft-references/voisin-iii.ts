import { commons, photo, pioneer } from "./sources";

import type { AircraftTraceStudy } from "./types";

const study: AircraftTraceStudy = {
  source: "https://www.the-blueprints.com/blueprints/ww1planes/ww1-france/20259/view/voisin_3/",
  credit: "Voisin 3 · 图 20259",
  image: new URL("../../assets/reference/voisin-iii/study.webp", import.meta.url).href,
  size: [700, 530],
  panels: [
    {
      label: "正视", crop: [12, 27, 560, 132],
      datum: { axis: "x", at: 293, points: [[23,59],[566,63],[41,112],[543,113]] },
      traces: [
        ["上翼","M22 60L24 52L563 53L566 65L23 62Z"],
        ["下翼","M41 113L43 103L541 104L543 114Z"],
        ["短舱","M275 80Q293 55 309 81L313 122H271Z"],
        ["主轮","M263 130H269V153H263Z M315 130H321V153H315Z"],
      ],
    },
    {
      label: "俯视 · 机头朝上", crop: [154, 135, 544, 366],
      datum: { axis: "x", at: 427, points: [[160,243],[692,237],[164,301],[691,293]] },
      traces: [
        ["上翼","M160 243L692 237L695 291L691 293L582 289L270 293L164 301Q159 301 160 293Z"],
        ["短舱","M414 157L440 157L444 207L447 242L443 289L432 309L419 291L409 242Z"],
        ["尾梁","M327 291L400 454 M367 291L427 458 M489 290L430 458 M528 290L456 453"],
        ["尾平面","M326 455L529 452L537 489L321 491Z"],
      ],
    },
    {
      label: "侧视 · 机头朝左", crop: [1, 330, 344, 128],
      traces: [
        ["短舱","M28 398L71 375L83 391L148 390L161 412L56 419L26 413Z"],
        ["推进桨","M167 343L170 348L170 425L167 432L165 385Z"],
        ["尾梁","M166 363L314 364 M168 409L314 405"],
        ["方向舵","M312 338L338 337L341 421Q328 430 313 425Z"],
      ],
    },
  ],
  readings: [
    "正视由短舱与桅杆定 x=293 px。上翼端 x=23、566，半展 270、273 px；下翼端 x=41、543，半展 252、250 px。原线约 3 px，加定位误差取 5 px。",
    "俯视短舱中心约 x=427 px。上翼前缘端点 y=243、237 px，后缘外端 y=301、293；两条边一起倾斜，需配准后复测。",
  ],
  pending: "需确认 LA 的中立姿态和两层翼的错位量，复核带倾斜的俯视图与尾梁接点。",
};

export default pioneer({
  id: "voisin-iii",
  study,
  frameId: "reference_voisin_iii",
  prototype: "Voisin III",
  chineseName: "福瓦辛 III",
  period: "1914 · 航空萌芽时期末段",
  role: "推进式双座侦察轰炸机",
  summary: "中央短舱、后置推进发动机、开放式双翼和尾梁框架组成早期侦察轰炸机轮廓。",
  structuralNotes: [
    "推进桨位于短舱后方，飞行员和观察员沿中心线前后排列。",
    "轻型钢管框架和双侧尾梁需要与当前盒风筝双翼机区分开。",
    "观察员武器、炸弹和照相设备属于可选模块，先锁定基础 Voisin III 构型。",
  ],
  modules: [
    { key: "center", label: "中央双座短舱", slot: "center", detail: "飞行员、观察员和载荷" },
    { key: "wing", label: "开放式双翼", slot: "leftWing", detail: "上下翼、翼间支柱和张线" },
    { key: "engine", label: "后置推进发动机", slot: "tail", detail: "发动机和推进桨盘" },
    { key: "tail", label: "双侧尾梁", slot: "tail", detail: "尾梁、尾翼和观察员后方空间" },
  ],
  threeView: {
    src: study.image,
    alt: "Voisin 3 · 图 20259参考图",
    source: study.source,
    note: study.credit,
    variant: "Voisin Type LA III / Voisin III",
    viewCoverage: "正视 / 俯视 / 侧视",
    loading: "pending",
  },
  photos: [
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7a/Replica_Voisin_III_%28unmarked%29_%289731007851%29.jpg/1280px-Replica_Voisin_III_%28unmarked%29_%289731007851%29.jpg", `${commons}File:Replica Voisin III (unmarked) (9731007851).jpg`, "Voisin III 复制机", "双翼、短舱和尾梁"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Replica_Voisin_III_%E2%80%93_Monino_museum%2C_Russia_%2839113079342%29.jpg/1280px-Replica_Voisin_III_%E2%80%93_Monino_museum%2C_Russia_%2839113079342%29.jpg", `${commons}File:Replica Voisin III – Monino museum, Russia (39113079342).jpg`, "Monino 博物馆的 Voisin III 复制机", "侧面结构和观察员位置"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Voisin_III_LAS_%28identity_unknown%29_%2834082705603%29.jpg/1280px-Voisin_III_LAS_%28identity_unknown%29_%2834082705603%29.jpg", `${commons}File:Voisin III LAS (identity unknown) (34082705603).jpg`, "Voisin III LAS 实机照片", "推进发动机与尾梁关系"),
  ],
});
