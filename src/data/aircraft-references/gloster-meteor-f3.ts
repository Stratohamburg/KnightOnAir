import { meteorF3Drawing, meteorF3Id } from "../meteorF3Sheet";
import { meteorLength, meteorSpan } from "../meteorF3ModelSheet";
import type { AircraftReference } from "./types";
import { commons } from "./sources";

const meteorRear = "Ground_crew_refuelling_a_Gloster_Meteor_F_Mk_III_of_No._616_Squadron_RAF_at_Manston,_Kent,_4_January_1945._CL2922.jpg";

export default {
  id: "gloster-meteor-f3",
  era: "earlyJet",
  frameId: meteorF3Id,
  prototype: "Gloster Meteor F.3",
  chineseName: "格洛斯特流星 F.3",
  period: "1944 · 早期喷气式飞机",
  role: "双发喷气机",
  match: null,
  matchLabel: "校验模型已生成",
  summary: "早期短舱构型。正视可核对环形进气唇口，侧视和俯视可核对短舱与主翼的接合及高置尾翼。",
  structuralNotes: [
    "内翼与外翼分别接入短舱。两侧翼线和圆形进气口按已审核的中心线镜像。",
    "校验模型采用俯视短舱站位 77–173，起落架收起。图板可对照原图读数。",
    "圆唇后逐站采用俯视宽与侧视高，翼面接至短舱外皮。",
    "实机尾部照片可确认两个短舱各有一个独立出口。",
  ],
  modules: [
    { key: "center", label: "机身与座舱罩", slot: "center", detail: "机头、座舱罩和收窄的尾段" },
    { key: "wing", label: "主翼", slot: "leftWing", detail: "内翼与外翼分别从短舱两侧接出" },
    { key: "engine", label: "双发动机短舱", slot: "leftWing", detail: "正视可见左右进气唇口，侧视与俯视保留各自轮廓" },
    { key: "tail", label: "尾翼", slot: "tail", detail: "高置水平尾翼与圆顶垂尾" },
  ],
  threeView: {
    src: meteorF3Drawing.src,
    source: meteorF3Drawing.source,
    alt: "Gloster G.41D Meteor F.3 正视、侧视和俯视线稿",
    note: "G.41D F.3 公开预览，500 × 374 像素。原图可与左侧轮廓叠合。",
  },
  pipeline: {
    generatedFromApprovedSheet: true,
    envelope: {
      length: meteorLength, wingspanToLength: meteorSpan / meteorLength,
      maxFuselageWidthToLength: 31.5 / 301, maxFuselageHeightToLength: 36 / 301,
      cockpitStationToLength: 58.4 / 301, wingRootStationToLength: 81.5 / 301, tailStationToLength: 261 / 301,
    },
    architecture: {
      layout: "conventional", fuselage: "tube", mainCenterline: "机身中心线",
      secondaryCenterlines: ["左主翼", "右主翼"], wingRelation: "branch", tailRelation: "单垂尾与高置水平尾翼",
    },
    edgeRecords: [
      { module: "主翼", leading: "内翼前缘到圆翼尖", trailing: "外翼后缘与圆角翼根", seam: "短舱两侧分别接翼",
        span: 311 / 301, rootChord: 96.5 / 301, sweep: 29.5 / 301, station: "翼根约 82–178", clearance: "进气口在主翼前缘之前" },
      { module: "短舱", leading: "圆形唇口", trailing: "收束至各自喷口", seam: "内翼与外翼在短舱相接",
        span: 110 / 301, rootChord: 96 / 301, sweep: 0, station: "俯视 77–173", clearance: "双侧开口与出气面独立" },
      { module: "高置平尾", leading: "向后扫掠并转入圆翼尖", trailing: "接回垂尾", seam: "平尾穿过垂尾两侧",
        span: 112 / 301, rootChord: 40 / 301, sweep: 23 / 301, station: "俯视 261–301", clearance: "平尾高于短舱和主翼" },
    ],
    evidenceMatrix: [
      { module: "机身与座舱", decision: "可见宽度和侧面轮廓", primarySource: "three-view", sourceLocation: "俯视宽度与侧视可见上下缘",
        confirmingViews: ["front", "side", "top"], value: "镜像校正后的可见边和站位", status: "measured" },
      { module: "机身与座舱", decision: "机腹遮挡段与各站截面", primarySource: "reviewer-constraint", sourceLocation: "侧视遮挡段与正视总体轮廓",
        confirmingViews: ["front", "side"], value: "遮挡的机腹在已知断面间平顺过渡", status: "review-constrained" },
      { module: "短舱", decision: "进气端与喷口站位、壳体截面", primarySource: "reviewer-constraint", sourceLocation: "正视进气口、两张 F.3 图的侧视与俯视",
        confirmingViews: ["front", "side", "top"], value: "采用俯视 77–173，圆唇后按各站宽高收束", status: "review-constrained" },
      { module: "主翼与尾翼", decision: "翼型、翼舱交界与平尾根部", primarySource: "reviewer-constraint", sourceLocation: "俯视描点、正视翼线与侧视投影",
        confirmingViews: ["front", "side", "top"], value: "正视限定厚度，翼根接至短舱壳体，平尾根前缘取俯视 261", status: "review-constrained" },
    ],
    discrepancyLog: [
      { view: "front", mismatch: "原图双侧读数有偏差", classification: "source", change: "H5 使用已认可的左右镜像轮廓",
        evidence: "原图对照保留双侧描点与读数" },
      { view: "side", mismatch: "侧视与俯视进气端站位相差约 13", classification: "source", change: "按确认的俯视站位生成，保留两视图读数",
        evidence: "主图约 64 / 77，F Mk.III 补充图约 73" },
    ],
  },
  photos: [
    {
      src: "https://upload.wikimedia.org/wikipedia/commons/c/c8/Gloster_Meteor_Mk_III_ExCC.jpg",
      source: `${commons}File:Gloster_Meteor_Mk_III_ExCC.jpg`,
      alt: "飞行中的流星 F.3 前斜视照片",
      caption: "进气唇口与翼舱接合",
      credit: "Wikimedia Commons",
    },
    {
      src: `https://upload.wikimedia.org/wikipedia/commons/a/a3/${encodeURIComponent(meteorRear)}`,
      source: `${commons}File:${meteorRear}`,
      alt: "1945 年在曼斯顿的 RAF 流星 F.3 EE236 后斜视照片",
      caption: "短舱喷口、尾翼与起落架",
      credit: "Imperial War Museums · CL 2922",
    },
  ],
} satisfies AircraftReference;
