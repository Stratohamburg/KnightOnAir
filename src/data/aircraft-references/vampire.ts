import type { AircraftReference, AircraftTraceStudy } from "./types";
import { commons, photo } from "./sources";
import { fb5Frame, fb5HalfSpan, fb5Length, fb5Unit } from "../vampireFb5Sheet";

const study: AircraftTraceStudy = {
  source: `${commons}File:De_Havilland_Vampire_FB5_3-view_silhouette.jpg`,
  credit: "The Observer’s Book of Aircraft（1952）· HMSO 识别剪影",
  image: new URL("../../assets/reference/vampire-fb5/observer-1952.jpg", import.meta.url).href,
  size: [936, 1216],
  panels: [
    {
      label: "正视 · 翼根进气口与垂尾", crop: [50, 12, 850, 180],
      projection: { view: "front", origin: [481.5,126], scale: 822 / (2 * fb5HalfSpan * fb5Unit) },
      datum: { axis: "x", at: 481.5, points: [[63,111],[885,109],[376,83],[585,83],[119,146],[883,149]] },
      traces: [
        ["中央机身", "M438 111Q439 93 458 89L467 101Q480 94 500 103L506 90Q526 96 525 114L525 144Q521 166 501 174Q483 182 462 174Q438 166 436 143Z", "body"],
        ["座舱罩", "M459 100Q461 68 480 68Q498 68 503 98L499 105Q481 95 467 105Z", "skin"],
        ["主翼", "M436 107L386 111L65 108L63 112L200 123L375 135L437 145Z M526 107L580 112L885 106L885 110L731 123L585 134L525 145Z", "skin"],
        ["进气口", "M392 118Q405 114 427 115Q434 126 426 136Q404 132 392 125Z M536 115Q553 113 570 119L570 125L537 136Q530 129 536 115Z", "opening"],
        ["垂尾", "M374 73L374 37L375 24L377 26L379 72Z M582 72L582 25L585 23L588 72Z", "skin"],
        ["平尾", "M385 79H461L458 86H385Z M503 79H577V86H506Z", "skin"],
        ["翼下细杆（位置待核）", "M119 117L119 146 M878 111L883 149", "wire"],
      ],
    },
    {
      label: "侧视 · 机头朝左，起落架收起", crop: [133, 977, 682, 178],
      projection: { view: "side", origin: [472,1087], scale: 656 / fb5Frame.length },
      traces: [
        ["中央机身", "M144 1101Q149 1080 201 1066L328 1040Q405 1039 510 1062L568 1092L568 1105Q515 1128 373 1137Q220 1143 163 1127Q142 1121 144 1101Z", "body"],
        ["座舱罩", "M202 1066Q225 1043 245 1030Q254 1023 280 1028Q311 1029 331 1042L302 1049L246 1061Z", "skin"],
        ["主翼", "M296 1078Q317 1067 395 1068Q449 1069 511 1088L468 1096Q367 1109 307 1099Q281 1094 296 1078Z", "skin"],
        ["进气口", "M296 1080L304 1077L311 1096Q289 1093 296 1080Z", "opening"],
        ["尾梁", "M321 1086Q379 1071 507 1063L703 1051L799 1047Q803 1064 780 1069L573 1092L467 1098L337 1095Z", "body"],
        ["垂尾", "M726 1036Q749 1004 766 990Q785 978 796 1011Q801 1026 800 1044Z", "skin"],
        ["平尾", "M701 1043Q706 1034 728 1036L799 1044L774 1049L717 1051Q697 1050 701 1043Z", "skin"],
        ["中央喷口", "M569 1092L574 1090L574 1107L569 1106Z", "opening"],
      ],
    },
    {
      label: "俯视 · 座舱与双尾梁间开口", crop: [6, 24, 263, 209],
      projection: { view: "top", origin: [137.5,30 + fb5Length / 2], scale: 1 / fb5Unit },
      detail: {
        image: new URL("../../assets/reference/vampire-fb5/goebel.png", import.meta.url).href,
        size: [501,254], source: `${commons}File:De_Havilland_Vampire_FB.5_three-view_silhouette.png`,
        credit: "Greg Goebel · FB.5 识别图（公有领域）",
      },
      datum: { axis: "x", at: 137.5, points: [[13,111],[262,111],[106,190],[168,190]] },
      traces: [
        ["主翼", "M121 71L110 80L19 98Q13 99 13 104L13 117Q13 122 18 123L103 140L125 147L139 139L150 146L171 140L258 122Q262 121 262 117V103Q262 99 258 98L165 81L153 73Z", "skin"],
        ["中央机身", "M137 30Q131 30 127 47L121 74L123 140L132 158H143L151 140L153 74L149 49Q144 30 137 30Z", "body"],
        ["座舱罩", "M137 54Q131 55 132 73Q132 83 138 82Q144 82 143 73Q144 59 137 54Z", "skin"],
        ["尾梁", "M103 139L110 141L108 224L105 227Z M165 141L172 139L169 227L166 225Z", "body"],
        ["平尾", "M108 202H166V217H108Z", "skin"],
        ["升降舵", "M110 217H165V227H110Z", "skin"],
      ],
    },
    {
      label: "腹面补图 · 翼尖、副翼和双尾梁独立描点", crop: [50,255,849,680],
      datum: { axis: "x", at: 481, points: [[64,497],[881,505],[376,730],[582.5,730],[376,919],[582,919]] },
      traces: [
        ["主翼", "M434 424L387 438L70 495Q61 495 63 511L65 547L70 565L143 580L251 599L449 654L454 660L435 540Z M528 424L578 440L875 501Q884 503 883 518L882 554L877 573L705 601L507 654L504 660L523 542Z", "skin"],
        ["中央机身", "M482 269Q458 274 446 334Q430 398 434 500Q433 573 452 656Q459 686 465 689L494 689Q505 673 515 608Q528 542 527 444Q528 358 511 312Q502 280 488 270Z", "body"],
        ["尾梁", "M376 501Q384 500 387 591L387 730L384 867Q384 916 374 920Q368 917 368 883L366 702L365 618Q365 529 376 501Z M584 505Q591 504 594 614L593 731L590 839L588 910L583 919Q576 917 575 886L572 669Q569 556 584 505Z", "body"],
        ["平尾", "M386 836H572V880H386Z", "skin"],
        ["升降舵", "M393 881H561V911H393Z", "skin"],
        ["副翼", "M71 551L253 577V598L144 580L71 565Z M705 580L876 558V573L705 601Z", "skin"],
        ["襟翼", "M307 584L433 603Q440 607 437 629L432 635L307 613Z M527 604L650 587V615L531 635Q521 637 523 622Z", "skin"],
        ["中央喷口", "M464 689Q479 685 497 689L492 695L470 696Z", "opening"],
      ],
    },
  ],
  readings: [
    "1952 年原图的中幅可见轮舱盖，按腹面登记。俯视座舱和两梁间的空隙由 Goebel 的 FB.5 图补足。",
    "原图正视以座舱中心 x≈481.5 为基准。左右翼尖距基准约 419 和 404 px，尾梁中心距约 106 和 104 px。俯视补图以座舱中心 x≈137.5 为基准，两侧翼尖均约 125 px。",
    "原图正视的两根细杆分别在 x≈119 和 878。补图的细杆位置也有差异，装配位置待核。侧视仅有一侧尾梁投影。",
  ],
  pending: "",
  modelNote: "按审核约束，主翼取俯视对称轮廓，翼下细杆依 1952 年正视各自定位。中央机身及双尾梁按同站位宽高取圆角截面，翼根进气口做凹腔，起落架收起。",
};

export default {
  id: "vampire", frameId: "vampire-fb5", legacyFrameId: "wasp_04", era: "earlyJet",
  prototype: "de Havilland Vampire FB.5", chineseName: "德·哈维兰 吸血鬼 FB.5",
  period: "战后 · 早期喷气时代", role: "单座喷气战斗轰炸机",
  match: null, matchLabel: "校验模型已生成",
  summary: "单座、截短翼尖。两侧翼根进气，中央机身向后排气，平尾横跨两根尾梁。",
  structuralNotes: ["VZ304 的后斜视照片可见尾梁与垂尾的连接，以及平尾在两梁之间的高度。"],
  modules: [
    { key: "center", label: "中央机身与座舱罩", slot: "center", detail: "单座机头与短机身" },
    { key: "engine", label: "中央发动机", slot: "center", detail: "左右翼根进气口与单个尾喷口" },
    { key: "wing", label: "主翼", slot: "leftWing", detail: "截短翼尖、外侧副翼与内侧襟翼" },
    { key: "tail", label: "双尾梁与尾翼", slot: "tail", detail: "每梁一片垂尾，平尾连接两梁" },
  ],
  threeView: {
    src: study.image, source: study.source, alt: "FB.5 正视、腹面和侧视剪影",
    variant: "DH.100 Vampire FB.5", note: "1952 年识别图；图板另附同改型的俯视剪影。", loading: "verified",
  },
  photos: [
    photo(new URL("../../assets/reference/vampire-fb5/vz304.webp", import.meta.url).href,
      `${commons}File:1983_at_Duxford_Vampire_FB.5_VZ304.jpg`, "达克斯福德展出的 FB.5 VZ304 后斜视",
      "双垂尾、平尾与翼梁接合，1983 年摄", "Anidaat · CC BY-SA 4.0 · 已缩放转码"),
  ],
  study,
  pipeline: {
    generatedFromApprovedSheet: true,
    envelope: {length:fb5Frame.length,wingspanToLength:fb5Frame.wingspan/fb5Frame.length,
      maxFuselageWidthToLength:28.2/197,maxFuselageHeightToLength:29.6/197,cockpitStationToLength:34/197,
      wingRootStationToLength:43/197,tailStationToLength:172/197},
    architecture: {layout:"twinBoom",fuselage:"tube",mainCenterline:"中央机身与喷口",
      secondaryCenterlines:["左尾梁","右尾梁"],wingRelation:"branch",tailRelation:"平尾横跨两梁"},
    edgeRecords: [{module:"截尖主翼",leading:"外段连续后掠",trailing:"外段向翼尖收束",seam:"根部接入进气壳",
      span:249/197,rootChord:74/197,sweep:31/197,station:"翼根约 43–117",clearance:"保留双进气口"}],
    evidenceMatrix: [
      {module:"主翼与翼下细杆",decision:"对称翼与分别定位的细杆",primarySource:"reviewer-constraint",
        sourceLocation:"Goebel 俯视与 1952 年原图正视",confirmingViews:["front","top"],value:"翼展 249，细杆依原图 x=119、878",status:"review-constrained"},
      {module:"机身、双尾梁与进气口",decision:"收轮，圆角截面与短凹腔",primarySource:"reviewer-constraint",
        sourceLocation:"1952 年侧视与腹面，VZ304 后斜视",confirmingViews:["front","side","top"],value:"逐站放样，保留中央喷口与两梁间开口",status:"review-constrained"},
    ],
    discrepancyLog:[{view:"front",mismatch:"原图左右半翼宽差约 15 px",classification:"source",
      change:"依俯视对称重建，保留正视原图对照",evidence:"同改型俯视图左右翼尖等距"}],
  },
} satisfies AircraftReference;
