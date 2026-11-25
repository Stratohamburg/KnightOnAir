import { commons, photo, pioneer } from "./sources";

import type { AircraftTraceStudy } from "./types";

// Symmetric main wings retain the measured total span; the source image and
// datum points retain the original starboard extension for comparison.
const planWing = "M433 148 Q320 149 240 150 L163 151 L111 152 Q82 154 66 164 Q48 177 39 199 L34 216 L34 258 Q34 278 51 278 L433 278 L815 278 Q832 278 832 258 L832 216 L827 199 Q818 177 800 164 Q784 154 755 152 L703 151 L626 150 Q546 149 433 148Z";
const frontUpperWing = "M440 527 Q252 526 43 546 Q43 552 67 556 Q248 546 440 546 Q632 546 813 556 Q837 552 837 546 Q628 526 440 527Z";
const frontLowerWing = "M440 650 Q240 648 43 665 Q48 676 80 676 Q265 666 440 669 Q615 666 800 676 Q832 676 837 665 Q640 648 440 650Z";

const study: AircraftTraceStudy = {
  source: "https://www.wright-brothers.org/Information_Desk/Just_the_Facts/Airplanes/Flyer_I.htm",
  credit: "Wright Brothers Aeroplane Company · Flyer I 三视图",
  image: new URL("../../assets/reference/wright-flyer-1903/study.webp", import.meta.url).href,
  size: [858, 1000],
  panels: [
    {
      label: "俯视 · 机头朝下，实机右侧在图左", crop: [19, 18, 817, 429],
      datum: { axis: "x", at: 433, points: [[30,221],[829,249],[332,135],[537,134]] },
      traces: [
        ["主翼", planWing],
        ["前升降舵","M318 414Q336 389 365 385L507 384Q534 387 554 413Q542 431 512 435L364 436Q337 435 318 416Z"],
        ["后方向舵","M418 26L447 26V61H418Z"],
        ["滑橇","M385 277L388 386H393L391 277Z M479 278L477 385H483L487 278Z"],
        ["桨轴","M329 133L336 133V148H329Z M534 131L540 131V147H534Z"],
      ],
    },
    {
      label: "正视 · 实机右侧在图左", crop: [28, 500, 814, 195],
      datum: { axis: "x", at: 440, points: [[38,549],[834,545],[337,589],[544,589]] },
      traces: [
        ["上翼", frontUpperWing],
        ["下翼", frontLowerWing],
        ["支柱","M53 550L54 663 M170 549L171 655 M277 540L278 650 M597 541L596 650 M702 546L703 656 M815 549V660"],
        ["桨轴","M330 589a7 7 0 1 0 14 0a7 7 0 1 0 -14 0 M537 589a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"],
      ],
    },
    {
      label: "侧视 · 机头朝左", crop: [214, 751, 444, 215],
      traces: [
        ["前升降舵","M224 861Q247 856 276 861L276 865L227 866Z M225 897Q252 892 274 896V900L224 901Z"],
        ["主翼","M390 791Q423 783 459 791L529 805L525 809L457 797Q418 788 392 797Z M391 913Q424 905 456 914L528 929L528 933L456 920Q422 913 392 918Z"],
        ["滑橇","M242 879L247 937Q248 949 260 949L467 949V954H256Q240 952 241 941Z"],
        ["推进桨","M534 765Q537 760 541 765L543 933Q540 941 535 933Z"],
        ["后方向舵","M620 808Q635 810 647 815V946L619 950Z"],
      ],
    },
    {
      label: "下翼中央 · 迎面观察", crop: [145, 200, 530, 222],
      traces: [
        ["发动机","M206 307L260 278L347 277L352 293L404 301L394 335L328 344L269 366L236 359Z"],
        ["俯卧驾驶位","M458 284L524 247L578 236L620 240L624 264L605 287L599 309L630 339L641 348L618 359L577 337L554 351L548 382L528 393L514 379L516 345L458 329Z"],
      ],
      detail: { image: new URL("../../assets/reference/wright-flyer-1903/detail.webp", import.meta.url).href, size: [723, 621],
        source: "https://flyingmachines.ru/Images7/Putnam/Pioneers/92-2.jpg", credit: "P. Jarrett · EAA 博物馆复制机，右发与左驾驶位" },
    },
    {
      label: "下翼俯视 · 上翼透明", crop: [331, 119, 284, 162],
      datum: { axis: "x", at: 475, points: [[448,231],[507,246],[370,128],[580,128]] },
      traces: [
        ["发动机","M432 219L457 219L464 224L464 249L457 252L431 252Z"],
        ["驾驶托架","M477 243L485 242L485 226L489 226V242H525V226H529V243H536V250H477Z"],
        ["桨轴","M365 129L374 129V210H365Z M577 129L583 129V210H577Z"],
        ["传动链","M366 211L439 205L447 212L368 213 M453 208L580 209L580 214L454 211"],
      ],
      detail: { image: new URL("../../assets/reference/wright-flyer-1903/open-plan.webp", import.meta.url).href, size: [950,453],
        source: "https://www.wright-brothers.org/Information_Desk/Help_with_Homework/Wright_Plans/Wright_Plans_images/1903_Flyer_Drawings/1903-Wright-Flyer-I-Top-View-Isometric-top-surfaces-transparent.jpg", credit: "Nick Engler · Flyer I 正交俯视，透明上翼" },
    },
    {
      label: "主翼剖面 · Kelley 图板 1", crop: [599,17,308,105],
      traces: [
        ["主翼翼肋","M610 50Q646 40 702 44Q768 47 816 56L899 73L883 74L811 61Q749 54 702 54Q649 50 610 56Z"],
      ],
      detail: { image: new URL("../../assets/reference/wright-flyer-1903/plate1.webp", import.meta.url).href, size: [950,737],
        source: "https://www.wright-brothers.org/Information_Desk/Help_with_Homework/Wright_Plans/Wright_Plans_images/1903_Flyer_Blueprints_Plate_1.jpg", credit: "Herb Kelley · Flyer I，图板 1 翼肋及中央传动" },
    },
  ],
  readings: [
    "用户已确认首飞布局：俯卧驾驶位在机体左侧，发动机在右侧，左传动链交叉。",
    "用户选定主翼左右对称。保留机体总翼展 12.29 m，左右半展各 6.145 m。俯、正视的有色轮廓采用对称方案，叠加原稿和圆点显示历史读数。",
    "俯视由尾舵、前翼支架定 x≈433 px。图左、右主翼端为 x=30、829 px，半展 403、396 px，差 7 px。全展 799 px 对应 12.29 m，差值约 10.8 cm。线宽 2 px 加基准定位不确定性，取 4 px。",
    "正视由中央滑橇和前翼支架定 x≈440 px。图左、右翼尖 x=38、834 px，半展 402、394 px，差 8 px，与俯视方向一致。型号说明给出的实机右翼加长量为 4 in（10.16 cm）。",
    "透明上翼图的基准 x=475 px，发动机外壳中心 x≈448，驾驶托架横梁中心 x≈507；全展 835 px，折合发动机右偏约 0.40 m、托架左偏约 0.47 m。外壳中心与曲轴分开记录。",
    "Kelley 图板 1 给出主翼弦长 6 ft 6 in，最大弯度位置距前缘 2 ft 3 in；中央下翼另有去除蒙布的传动详图。",
  ],
  pending: "主翼与中央安装布局已定。前置双层升降舵的铰接点、后方双方向舵的转轴和操纵索连接尚待与装配图配准。",
};

export default pioneer({
  id: "wright-flyer-1903",
  study,
  frameId: "reference_wright_flyer_1903",
  prototype: "Wright Flyer",
  chineseName: "莱特 Flyer 1903",
  period: "1903 · 航空萌芽时期",
  role: "动力飞行原型机",
  summary: "前翼鸭式双翼机，双推进螺旋桨位于机翼后方，飞行员俯卧在下翼上。",
  structuralNotes: [
    "前翼鸭式升降面和双推进螺旋桨是首要识别特征。",
    "机翼、支柱和翼翘控制索组成开放式骨架，不能用封闭机身替代。",
    "正视和俯视需要分别记录左右翼尖、前翼和后翼的独立读数。",
  ],
  modules: [
    { key: "center", label: "中心滑橇与驾驶位", slot: "center", detail: "驾驶员、发动机和主承力框架" },
    { key: "wing", label: "上下主翼", slot: "leftWing", detail: "左右翼、翼翘控制和支柱" },
    { key: "engine", label: "右置发动机与双推进桨", slot: "tail", detail: "推进桨盘和链传动位置" },
    { key: "tail", label: "前翼鸭式升降面", slot: "nose", detail: "前置俯仰控制面" },
  ],
  threeView: {
    src: study.image,
    alt: "Wright Brothers Aeroplane Company · Flyer I 三视图参考图",
    source: study.source,
    note: study.credit,
    variant: "Wright Flyer 1903 first powered flight configuration",
    viewCoverage: "front / side / top / center installation / rib",
    loading: "pending",
  },
  photos: [
    photo(new URL("../../assets/reference/wright-flyer-1903/detail.webp", import.meta.url).href, "https://flyingmachines.ru/Site2/Crafts/Craft28770.htm", "复原机发动机与俯卧驾驶位", "下翼两侧安装位置 · EAA 博物馆复制机", "P. Jarrett《Pioneer Aircraft》"),
    photo("https://upload.wikimedia.org/wikipedia/commons/4/4c/Wright_Flyer_AN0231034.jpg", `${commons}File:Wright Flyer AN0231034.jpg`, "Wright Flyer 1903 展示机", "开放式骨架与驾驶位"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/0/01/Wright_Flyer_HAM_02.JPG/1280px-Wright_Flyer_HAM_02.JPG", `${commons}File:Wright Flyer HAM 02.JPG`, "Wright Flyer 展示机侧前方", "双推进桨和前翼"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Wright_flyer_propeller_1903_%2824419233125%29.jpg/1280px-Wright_flyer_propeller_1903_%2824419233125%29.jpg", `${commons}File:Wright flyer propeller 1903 (24419233125).jpg`, "Wright Flyer 推进桨细节", "桨盘、链条和发动机关系"),
  ],
});
