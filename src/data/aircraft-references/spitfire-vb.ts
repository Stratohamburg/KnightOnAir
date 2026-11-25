import { spitfireVbSheet } from "../pistonFighterSheets";
import { fighterReviewPipeline } from "./fighterReviewPipeline";
import type { AircraftReference } from "./types";
import { commons } from "./sources";

export default {
  id: "spitfire-vb",
  era: "ww2",
  frameId: "falcon_13",
  pipeline: fighterReviewPipeline(spitfireVbSheet, {
    length: 1, wingspanToLength: 460 / 390, maxFuselageWidthToLength: 42 / 390,
    maxFuselageHeightToLength: 65 / 390, cockpitStationToLength: 157 / 390,
    wingRootStationToLength: 79 / 390, tailStationToLength: 328 / 390,
  }),
  prototype: "Supermarine Spitfire Mk Vb",
  chineseName: "超级马林 喷火 Mk Vb",
  period: "1941 · 第二次世界大战",
  role: "单发高机动截击",
  match: null,
  matchLabel: "已生成三维外形",
  summary: "低翼、液冷发动机和椭圆翼是这架机的识别骨架，爆改时应该让翼尖变化保持在同一根主翼中心线上。",
  structuralNotes: [
    "机鼻、座舱、主翼和尾翼沿同一纵向轴线排列。",
    "主翼前缘较圆，不能用两块尖锐的三角板替代椭圆轮廓。",
    "机炮应放在翼内或翼根附近，武器增殖要沿主翼方向排列。",
  ],
  modules: [
    { key: "center", label: "机身中心线", slot: "center", detail: "发动机、座舱、油箱和核心生命" },
    { key: "wing", label: "椭圆主翼", slot: "leftWing", detail: "高速转向的主要升力面" },
    { key: "nose", label: "机鼻动力舱", slot: "nose", detail: "液冷发动机罩、排气口和桨毂" },
    { key: "tail", label: "尾翼与方向舵", slot: "tail", detail: "细长尾段维持高速稳定" },
  ],
  build: {
    quality: "提质",
    quantity: "少量",
    headline: "把灵活性变成持续锁定时间",
    detail: "优先增加转向、锁定弧和机炮精度。翼面扩展只加一到两层，避免破坏高速回转。",
  },
  threeView: {
    src: new URL("../../assets/reference/spitfire-vb/plan.png", import.meta.url).href,
    alt: "喷火 Mk Vb 标准椭圆翼俯视原图裁切",
    source: `${commons}File:Supermarine_Spitfire_Mk_Vb_3-view.svg`,
    note: "Marek Cel 绘制的 Mk Vb 俯视图。审核板另配准同型号的迎头正视图。",
  },
  photos: [
    {
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/33/Spitfire_F_VB_BM597.jpg/960px-Spitfire_F_VB_BM597.jpg",
      alt: "喷火 Mk Vb BM597 左侧实机，舱盖打开，起落架放下",
      caption: "BM597 · 左翼下空速管、桨毂与展开的主轮",
      credit: "Kogo · Wikimedia Commons",
      source: `${commons}File:Spitfire_F_VB_BM597.jpg`,
    },
  ],
} satisfies AircraftReference;
