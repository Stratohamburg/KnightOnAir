import { zero21Sheet } from "../pistonFighterSheets";
import { fighterReviewPipeline } from "./fighterReviewPipeline";
import type { AircraftReference } from "./types";
import { commons } from "./sources";

export default {
  id: "a6m2-21",
  era: "ww2",
  frameId: "dragonfly_06",
  pipeline: fighterReviewPipeline(zero21Sheet, {
    length: 1, wingspanToLength: 460 / 351, maxFuselageWidthToLength: 45 / 351,
    maxFuselageHeightToLength: 63 / 351, cockpitStationToLength: 116 / 351,
    wingRootStationToLength: 67 / 351, tailStationToLength: 260 / 351,
  }),
  prototype: "Mitsubishi A6M2 Model 21 Zero",
  chineseName: "三菱 零式 A6M2 二一型",
  period: "1940 · 第二次世界大战",
  role: "轻量远程格斗",
  match: null,
  matchLabel: "已生成三维外形",
  summary: "二一型的圆形发动机罩、分格舱盖和可折叠圆翼尖可在三视图中逐项核对。图板按翼尖展开状态核对。",
  structuralNotes: [
    "主翼仍以机身中心线为基准，翼根向前靠近座舱。",
    "细长机身和较大的翼面形成低速盘旋优势，改装时翼展收益高于单纯堆发动机。",
    "外置武器应沿翼根到翼尖的同一条支线分布，避免随机悬挂。",
  ],
  modules: [
    { key: "center", label: "细长机身", slot: "center", detail: "轻量化核心与长航程能量池" },
    { key: "wing", label: "大翼面主翼", slot: "leftWing", detail: "低速转向和翼下挂点" },
    { key: "engine", label: "单发机鼻", slot: "nose", detail: "风冷发动机与螺旋桨" },
    { key: "weapon", label: "翼根机炮", slot: "leftWing", detail: "少量高质量火力" },
  ],
  build: {
    quality: "提质",
    quantity: "中量",
    headline: "用翼面换来最舒服的盘旋",
    detail: "先补能量、转向和锁定，再延长翼尖。数量型挂点会让轻量优势快速被质量拖垮。",
  },
  threeView: {
    src: new URL("../../assets/reference/a6m2-21/plan.png", import.meta.url).href,
    alt: "零式 A6M2 机翼展开的俯视原图裁切",
    source: `${commons}File:Mitsubishi_A6M_Zero_drawing.svg`,
    note: "Kaboldy 的 A6M2 俯视图（CC BY-SA 3.0，旋转、裁切并配准）。二一型另以制造号 500 的照片核对。",
  },
  photos: [
    {
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/21/Mitsubishi_A6M2_Zero%2C_National_Museum_of_the_US_Air_Force%2C_Dayton%2C_Ohio%2C_USA._%2829979056677%29.jpg/960px-Mitsubishi_A6M2_Zero%2C_National_Museum_of_the_US_Air_Force%2C_Dayton%2C_Ohio%2C_USA._%2829979056677%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
      alt: "美国空军博物馆的三菱 A6M2 零式",
      caption: "翼面与机身细长比",
      credit: "Wikimedia Commons",
      source: `${commons}File:Mitsubishi_A6M2_Zero,_National_Museum_of_the_US_Air_Force,_Dayton,_Ohio,_USA._(29979056677).jpg`,
    },
    {
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/A6M2_Model_21_Zero_MfrNo_500-_side_view-_port.jpg/960px-A6M2_Model_21_Zero_MfrNo_500-_side_view-_port.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
      alt: "A6M2 零式侧视",
      caption: "中心线与座舱站位",
      credit: "Wikimedia Commons",
      source: `${commons}File:A6M2_Model_21_Zero_MfrNo_500-_side_view-_port.jpg`,
    },
    {
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c2/A6M2_Model_21_Zero_MfrNo_500-_starboard_front_3-4_view.jpg/960px-A6M2_Model_21_Zero_MfrNo_500-_starboard_front_3-4_view.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
      alt: "A6M2 零式三分之四正面",
      caption: "机鼻和翼根过渡",
      credit: "Wikimedia Commons",
      source: `${commons}File:A6M2_Model_21_Zero_MfrNo_500-_starboard_front_3-4_view.jpg`,
    },
  ],
} satisfies AircraftReference;
