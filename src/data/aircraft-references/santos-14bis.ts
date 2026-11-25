import { commons, photo, pioneer } from "./sources";

import type { AircraftTraceStudy } from "./types";

const study: AircraftTraceStudy = {
  source: "https://commons.wikimedia.org/wiki/File:14_bis_de_Santos-Dumont,_ouvrage_de_Rankine_Kennedy.png",
  credit: "Rankine Kennedy · 图 26",
  image: new URL("../../assets/reference/santos-14bis/study.webp", import.meta.url).href,
  size: [930, 341],
  panels: [
    {
      label: "透视结构图 · 机头朝右", crop: [16, 69, 873, 246],
      traces: [
        ["前置盒翼","M650 169L853 119L878 237L824 259L678 292Z M799 133L825 258", "skin"],
        ["驾驶篮","M403 174L432 179L430 240L406 243Z", "body"],
        ["主轮","M398 286Q396 269 407 269Q422 268 418 286Q414 307 402 302Z M423 283Q424 264 434 269Q444 275 440 289Q435 303 428 295Z", "body"],
        ["近翼上下面蒙布","M137 79L405 166L352 190L334 188L335 140L244 162L243 111L181 139L134 132Z M31 223L131 195L405 249L303 269Z","skin"],
        ["近翼盒格竖壁","M37 112L137 79L131 195L31 223Z M240 162L335 139L330 237L239 219Z","skin"],
        ["远翼上层蒙布","M435 166L620 107L589 129L570 140L566 130L510 155L506 141L454 174Z","skin"],
        ["外格副翼","M132 135L183 139L229 160L235 168L221 176L175 175L132 159Z M568 148L596 142L615 143L610 150L575 162Z","skin"],
        ["中央覆布梁","M428 186L653 184L665 237L429 235Z","skin"],
        ["驾驶篮下撑架","M350 190L348 234L406 246 M350 193L405 180 M371 193L368 243 M353 223L405 238 M393 202L393 241","strut"],
      ],
    },
    {
      label: "翼下撑杆及张线 · 外格副翼构型", crop: [83,201,562,246],
      traces: [
        ["翼下立杆","M540 382L540 438 M144 285L143 367","strut"],
        ["翼下张线","M469 399L540 439L602 394 M105 281L143 367L160 301","wire"],
      ],
      detail: { image: new URL("../../assets/reference/santos-14bis/wing-stays.webp", import.meta.url).href, size: [706,472],
        source: "https://flyingmachines.ru/Images7/Putnam/RAF/33-1.jpg", credit: "Putnam · 外格副翼与翼下张线历史照片" },
    },
  ],
  readings: [
    "箱式主翼的蒙布分布在上面、下面和各竖壁，格口保持贯通。照片中翼下竖杆的底端接向两侧斜索；透视图未给出副翼操纵索在驾驶篮内的路径。",
    "图 26 可辨前置盒翼、分格翼壁、驾驶篮和主轮；可见舵面突出在外侧盒格中。透视缩短使左右半展不可比。",
    "1906 年 10 月照片可核对中央框架与盒翼；已选构型带外格副翼，副翼的安装阶段须与 11 月资料对读。",
  ],
  modelNote: "按 11 月外格副翼构型保留每侧三个开放翼格和前盒舵。翼格上反、各壁弦向错位、副翼轴和篮内接头受透视缩短影响，按工作图和历史照近似。",
  pending: "图 26 为透视图。需带外格副翼的 1906 年 11 月构型正交图，才能量测翼尖、外倾角和副翼转轴。",
};

export default pioneer({
  id: "santos-14bis",
  study,
  frameId: "reference_santos_14bis",
  prototype: "Santos-Dumont 14-bis",
  chineseName: "桑托斯·杜蒙 14-bis",
  period: "1906 · 航空萌芽时期",
  role: "鸭式双翼原型机",
  summary: "前置盒式鸭翼、后置发动机和开放式 Hargrave 单元组成的实验性双翼机。",
  structuralNotes: [
    "机头盒式升降面、后置推进桨和站立式驾驶位置必须保留。",
    "主翼由多个箱式单元组成，正视需记录明显的翼间垂向间隔。",
    "公开工程图包含不同试飞构型，最终建模前需要锁定带外侧副翼的版本。",
  ],
  modules: [
    { key: "center", label: "中央框架与驾驶位", slot: "center", detail: "竹木中心框架和站立式驾驶员" },
    { key: "wing", label: "Hargrave 箱式主翼", slot: "leftWing", detail: "多单元双翼和翼间支柱" },
    { key: "engine", label: "后置发动机与推进桨", slot: "tail", detail: "发动机、桨盘和尾部传动" },
    { key: "tail", label: "前置盒式鸭翼", slot: "nose", detail: "俯仰和偏航控制面" },
  ],
  threeView: {
    src: study.image,
    alt: "Rankine Kennedy · 图 26参考图",
    source: study.source,
    note: study.credit,
    variant: "14-bis with external-cell ailerons, Rankine Kennedy drawing",
    viewCoverage: "透视结构图",
    loading: "pending",
  },
  photos: [
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/14-bis_de_Alberto_Santos_Dumont.jpg/960px-14-bis_de_Alberto_Santos_Dumont.jpg", `${commons}File:14-bis de Alberto Santos Dumont.jpg`, "14-bis 历史照片", "前翼、主翼和后置发动机"),
    photo("https://upload.wikimedia.org/wikipedia/commons/4/4e/14_bis_%281906-11-12%29.jpg", `${commons}File:14 bis (1906-11-12).jpg`, "1906 年 14-bis 飞行照片", "试飞构型与支撑索"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8a/14-bis_pousado_no_solo_-_1-13435-0000-0000%2C_Acervo_do_Museu_Paulista_da_USP.jpg/960px-14-bis_pousado_no_solo_-_1-13435-0000-0000%2C_Acervo_do_Museu_Paulista_da_USP.jpg", `${commons}File:14-bis pousado no solo - 1-13435-0000-0000, Acervo do Museu Paulista da USP.jpg`, "14-bis 地面照片", "起落架与中心框架"),
  ],
});
