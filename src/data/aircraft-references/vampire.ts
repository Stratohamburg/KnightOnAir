import type { AircraftReference } from "./types";
import { commons } from "./sources";

export default {
  id: "vampire",
  era: "earlyJet",
  frameId: "wasp_04",
  prototype: "de Havilland Vampire",
  chineseName: "德·哈维兰 Vampire 吸血鬼",
  period: "1943 · 早期喷气时代",
  role: "轻型喷气截击",
  match: 66,
  matchLabel: "轻型比例吻合，喷气结构待补",
  summary: "吸血鬼的关键不是把螺旋桨换成火焰，而是把发动机、进气道和双尾梁放到中心线两侧的真实位置。",
  structuralNotes: [
    "发动机位于机身中心段，进气道从翼根前方进入。",
    "双尾梁是识别重点，尾翼不应继续作为普通单尾杆处理。",
    "喷气推进器的出口要沿纵向中心线，火焰和尾迹从这里脱离。",
  ],
  modules: [
    { key: "center", label: "中央座舱", slot: "center", detail: "座舱、机炮和核心系统" },
    { key: "engine", label: "机身中段发动机", slot: "center", detail: "进气道与喷口共享纵向轴线" },
    { key: "wing", label: "后掠主翼", slot: "leftWing", detail: "左右翼根承接进气道" },
    { key: "tail", label: "双尾梁", slot: "tail", detail: "两条平行尾梁与高置尾翼" },
  ],
  build: {
    quality: "提质",
    quantity: "少量",
    headline: "先把喷气骨架立住，再谈堆量",
    detail: "高速、加速度和能量恢复是第一优先级。双尾梁、串列翼和进气道属于后期解锁件。",
  },
  threeView: {
    src: "https://upload.wikimedia.org/wikipedia/commons/0/00/De_Havilland_Vampire_FB5_3-view_silhouette.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled",
    alt: "Vampire 三视图剪影",
    source: `${commons}File:De_Havilland_Vampire_FB5_3-view_silhouette.jpg`,
    note: "双尾梁、中央座舱、喷气进气道和尾翼高度以三视图为准。",
  },
  photos: [
    {
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/London_RAF_Museum_Hendon_De_Havilland_F3_Vampire_02.jpg/960px-London_RAF_Museum_Hendon_De_Havilland_F3_Vampire_02.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
      alt: "英国皇家空军博物馆的 Vampire F3",
      caption: "双尾梁与主翼",
      credit: "Wikimedia Commons",
      source: `${commons}File:London_RAF_Museum_Hendon_De_Havilland_F3_Vampire_02.jpg`,
    },
    {
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/De_Havilland_Vampire_%288920318016%29.jpg/960px-De_Havilland_Vampire_%288920318016%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
      alt: "德·哈维兰 Vampire",
      caption: "喷气机鼻与进气道",
      credit: "Wikimedia Commons",
      source: `${commons}File:De_Havilland_Vampire_(8920318016).jpg`,
    },
    {
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/De_Havilland_Vampire_T11.jpg/960px-De_Havilland_Vampire_T11.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
      alt: "Vampire T11",
      caption: "尾翼高度与尾梁间距",
      credit: "Wikimedia Commons",
      source: `${commons}File:De_Havilland_Vampire_T11.jpg`,
    },
  ],
} satisfies AircraftReference;
