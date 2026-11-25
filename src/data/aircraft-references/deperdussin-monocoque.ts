import { commons, photo, pioneer } from "./sources";

import type { AircraftTraceStudy } from "./types";

const study: AircraftTraceStudy = {
  source: "https://flyingmachines.ru/Site2/Crafts/Craft25726.htm",
  credit: "Flight · 1913 年，第 1244 页，160 HP Racing Monocoque",
  image: new URL("../../assets/reference/deperdussin-monocoque/study.webp", import.meta.url).href,
  size: [604, 850],
  panels: [
    {
      label: "侧视 · 机头朝左", crop: [17, 16, 566, 241],
      projection: { view: "side", origin: [301,122], scale: 90.0, angle: 0 },
      traces: [
        ["壳体","M29 121Q34 100 67 96L76 90L168 83L202 81Q222 96 256 86Q252 68 261 70L318 79L359 89L450 97L550 97L550 124L447 138L330 154L209 164L122 166L63 151Q33 150 29 125Z", "skin"],
        ["方向舵","M451 97Q492 78 525 70L567 57Q579 58 571 115L564 129L529 127Z", "skin"],
        ["主轮","M114 222a32 32 0 1 0 64 0a32 32 0 1 0 -64 0", "body"],
      ],
    },
    {
      label: "正视 · 一侧翼尖截断", crop: [119, 202, 482, 249],
      projection: { view: "front", origin: [426,304], scale: 93.1, angle: 0 },
      traces: [
        ["主翼","M127 299L386 296L384 309L137 310Q125 309 127 299Z M464 297L599 294V307H465Z", "skin"],
        ["桨毂整流罩","M395 307a31 31 0 1 0 62 0a31 31 0 1 0 -62 0", "body"],
        ["轮架","M396 344L372 409L480 411L453 340 M372 409L371 439 M479 411L480 439", "strut"],
        ["上部索柱","M400 279V235 M451 278V233","strut"],
        ["上翼承力张线","M173 297L400 235 M305 297L400 235 M451 235L546 294 M451 235L590 275","wire"],
        ["下翼承力张线","M174 310L373 397 M306 310L373 395 M478 397L546 308 M478 397L596 340","wire"],
      ],
    },
    {
      label: "俯视 · 下方翼尖截断", crop: [17, 359, 570, 490],
      projection: { view: "top", origin: [305,669], scale: 94.7, angle: -90 },
      traces: [
        ["主翼","M77 615L95 583V383Q95 364 111 366L225 379Q239 383 239 393V634H79Z M80 702H239V844L95 842V747Z", "skin"],
        ["壳体","M27 664Q31 641 67 639L184 634Q290 631 417 648L527 662V679L416 687Q223 709 78 702Q40 698 27 674Z", "skin"],
        ["座舱","M190 667Q191 650 223 646Q244 643 250 658Q253 684 226 689Q195 688 190 672Z", "opening"],
        ["尾平面","M415 649L481 603Q502 584 528 580L567 576Q578 576 577 591V637Q566 652 530 655L528 682L571 703Q580 706 577 723L576 760Q552 767 512 756L418 689Z", "skin"],
      ],
    },
  ],
  readings: [
    "木质硬壳的外表连续，座舱只画开口。外露索柱、起落架和上下张线各有独立描线，截断处沿用原刊可见范围。",
    "原刊标注机长 20 ft、翼展 21 ft、轮距 4 ft。侧视可定位整流罩、座舱、轮轴和方向舵。",
    "正视右端和俯视下端到达图框。外廓总宽可由标注取得，两翼端不能从这两幅图独立描全。",
  ],
  modelNote: "按 160 hp 竞速型的完整一侧补齐截断翼尖。木壳横截面按俯视半宽与侧视上下缘放样，座舱凹口及桨毂整流罩按照片近似。",
  pending: "需同一 160 hp 竞速型的完整翼尖和壳体横截面。模型制作图只作构造比对。",
};

export default pioneer({
  id: "deperdussin-monocoque",
  study,
  frameId: "reference_deperdussin_monocoque",
  prototype: "Deperdussin Monocoque",
  chineseName: "德佩尔杜辛 Monocoque",
  period: "1913 · 航空萌芽时期",
  role: "流线型竞速单翼机",
  summary: "光滑硬壳机身、低置中翼、大型桨毂整流罩和干净的 U 形起落架构成早期竞速机的极简轮廓。",
  structuralNotes: [
    "机身采用硬壳壳体，侧视和俯视都应保持连续的流线收束。",
    "中翼、前置旋转发动机和大型整流罩是速度型外观的主要标志。",
    "公开资料中常见的是两视或模型图，三视比例需要从技术图和实机照片交叉核对。",
  ],
  modules: [
    { key: "center", label: "硬壳机身", slot: "center", detail: "连续壳体、座舱和尾段" },
    { key: "wing", label: "中置竞速主翼", slot: "leftWing", detail: "平行弦翼面和低阻力翼根" },
    { key: "engine", label: "整流罩与旋转发动机", slot: "nose", detail: "大型桨毂和外露气缸" },
    { key: "tail", label: "细小尾翼", slot: "tail", detail: "低阻力尾平面和方向舵" },
  ],
  threeView: {
    src: study.image,
    alt: "Flight · 1913 年，第 1244 页，160 HP Racing Monocoque参考图",
    source: study.source,
    note: study.credit,
    variant: "1913 Deperdussin 160 hp Gordon Bennett racer",
    viewCoverage: "侧视 / 正视 / 俯视",
    loading: "pending",
  },
  photos: [
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/3/39/Deperdussin_Monocoque.JPG/1280px-Deperdussin_Monocoque.JPG", `${commons}File:Deperdussin Monocoque.JPG`, "Deperdussin Monocoque 展示机", "流线机身与整流罩"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cd/Deperdussin_Monocoque_at_Mus%C3%A9e_de_l%27air_et_de_l%27espace%2C_Le_Bourget%2C_France_%2853371308378%29.jpg/1280px-Deperdussin_Monocoque_at_Mus%C3%A9e_de_l%27air_et_de_l%27espace%2C_Le_Bourget%2C_France_%2853371308378%29.jpg", `${commons}File:Deperdussin Monocoque at Musée de l'air et de l'espace, Le Bourget, France (53371308378).jpg`, "Le Bourget 的 Deperdussin Monocoque", "中翼、座舱和尾段"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f9/Deperdussin_Monocoque_-_rear.JPG/1280px-Deperdussin_Monocoque_-_rear.JPG", `${commons}File:Deperdussin Monocoque - rear.JPG`, "Deperdussin Monocoque 后方", "尾部截面与起落架"),
  ],
});
