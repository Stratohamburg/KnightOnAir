import type { FighterSheet } from "../pistonFighterSheets";
import type { AircraftReference } from "./types";

export function fighterReviewPipeline(sheet: FighterSheet, envelope: NonNullable<AircraftReference["pipeline"]>["envelope"]): AircraftReference["pipeline"] {
  const rows = sheet.readings.plan;
  const [tip, leading, trailing] = rows[0];
  const [root, rootLeading, rootTrailing] = rows[rows.length - 1];
  return {
    generatedFromApprovedSheet: true,
    envelope,
    architecture: {
      layout: "conventional", fuselage: "tube", mainCenterline: "桨毂至尾端",
      secondaryCenterlines: ["左翼", "右翼"], wingRelation: "branch", tailRelation: "后机身承载平尾与垂尾",
    },
    edgeRecords: [{
      module: "主翼外露段", leading: "俯视前缘左右独立取点", trailing: "后缘含中立副翼",
      seam: "内端读数位于翼身整流过渡外侧", span: root - tip, rootChord: rootTrailing - rootLeading,
      sweep: Math.atan2(leading - rootLeading,root - tip) * 180 / Math.PI,
      station: `内端前后缘 ${rootLeading}–${rootTrailing}，翼尖 ${(leading + trailing) / 2}`,
      clearance: "图板全翼展 460，后掠角以度计",
    }],
    evidenceMatrix: [
      { module: "主翼", decision: "分别描读两侧主翼外露段", primarySource: "three-view",
        sourceLocation: sheet.source, confirmingViews: ["top","front"], value: "全翼展 460 图板单位",
        status: "measured" },
      { module: "翼下设备", decision: sheet.acceptedAsymmetry, primarySource: "reviewer-constraint",
        sourceLocation: "用户确认按原机保留冷却器和单侧空速管", confirmingViews: sheet.asymmetryViews,
        value: sheet.acceptedAsymmetry, status: "review-constrained" },
      { module: "外形截面与接合线", decision: sheet.sectionDecision,
        primarySource: "reviewer-constraint", sourceLocation: "用户确认按图板截面与接合线约束生成三维外形", confirmingViews: ["front","side","top"],
        value: sheet.sectionDecision, status: "review-constrained" },
    ],
    discrepancyLog: [{
      view: "top", mismatch: "旧评分缺少专属图板和实网格叠合记录", classification: "source",
      change: "用本机型原图配准和双侧描线重新核对", evidence: "左右读数见图板，三维匹配度尚未测量",
    }],
  };
}
