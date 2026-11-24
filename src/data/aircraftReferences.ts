import { bodyRadius, sheetLength, sheetSpan, wings } from "./fokkerDr1Sheet";

export interface ReferencePhoto {
  src: string;
  alt: string;
  caption: string;
  credit: string;
  source: string;
}

export interface ReferenceModule {
  key: string;
  label: string;
  slot: string;
  detail: string;
}

export interface ReferenceEvidenceRow {
  module: string;
  decision: string;
  primarySource: "three-view" | "photo" | "reviewer-constraint";
  sourceLocation: string;
  confirmingViews: Array<"front" | "side" | "top">;
  value: string;
  status: "measured" | "photo-supported" | "review-constrained" | "estimate" | "preset-fallback";
  note?: string;
}

export interface ReferencePresetAudit {
  status: "pass" | "conditional";
  checkedPaths: string[];
  selectedFallbacks: Array<{ path: string; reason: string; value: string }>;
}

export interface AircraftReference {
  frameId: string;
  prototype: string;
  chineseName: string;
  period: string;
  role: string;
  match: number;
  matchLabel: string;
  summary: string;
  structuralNotes: string[];
  modules: ReferenceModule[];
  build: {
    quality: string;
    quantity: string;
    headline: string;
    detail: string;
  };
  threeView: {
    src: string;
    alt: string;
    source: string;
    note: string;
    fileName?: string;
    variant?: string;
    viewCoverage?: string;
    dimensions?: string;
    loading?: "verified" | "pending";
  };
  photos: ReferencePhoto[];
  pipeline?: {
    generatedFromApprovedSheet?: boolean;
    envelope: {
      length: number;
      wingspanToLength: number;
      maxFuselageWidthToLength: number;
      maxFuselageHeightToLength: number;
      cockpitStationToLength: number;
      wingRootStationToLength: number;
      tailStationToLength: number;
    };
    architecture: {
      layout: "conventional" | "twinBoom" | "flyingWing";
      fuselage: "tube" | "integratedWing";
      mainCenterline: string;
      secondaryCenterlines: string[];
      wingRelation: "branch" | "parallel" | "vertical" | "longitudinal";
      tailRelation: string;
    };
    edgeRecords: Array<{
      module: string;
      leading: string;
      trailing: string;
      seam: string;
      span: number;
      rootChord: number;
      tipChord?: number;
      sweep: number;
      station: string;
      clearance: string;
    }>;
    evidenceMatrix?: ReferenceEvidenceRow[];
    presetAudit?: ReferencePresetAudit;
    discrepancyLog: Array<{
      view: "front" | "side" | "top";
      mismatch: string;
      classification: "source" | "silhouette" | "topology" | "module" | "assembly" | "camera";
      change: string;
      evidence: string;
    }>;
  };
}

const commons = "https://commons.wikimedia.org/wiki/";

export const AIRCRAFT_REFERENCES: AircraftReference[] = [
  {
    frameId: "heron_09",
    prototype: "Fokker Dr.I",
    chineseName: "福克 Dr.I 三翼机",
    period: "1917 · 第一次世界大战",
    role: "三翼近距格斗",
    match: 92,
    matchLabel: "三翼骨架高度吻合",
    summary: "三层机翼沿同一机身中心线上下叠放，适合把局内爆改的第一层乐趣做成清晰的垂直增殖。",
    structuralNotes: [
      "机身是一条连续的纵向中心线，座舱位于机翼根部之后。",
      "从上到下翼展逐层缩短。下翼贴机身下缘，中翼贴上缘，上翼高出中翼一个机身直径。俯视可沿重叠的前后缘辨认三层翼。",
      "翼组在侧视图中明显前置，最前缘接近螺旋桨盘，并保留可测的净距。下翼下方的双支柱、轮轴和轮子是独立起落架模块。",
      "发动机、同步机枪和尾翼都应保持在中心线附近，避免模型看起来像悬浮的零件集合。",
    ],
    modules: [
      { key: "center", label: "机身中心线", slot: "center", detail: "生命、座舱与核心质量" },
      { key: "wing", label: "三层翼组", slot: "leftWing", detail: "左右翼根同步生成，上下层可插入" },
      { key: "engine", label: "前置发动机", slot: "nose", detail: "牵引式螺旋桨与同步机炮" },
      { key: "landingGear", label: "下翼起落架", slot: "bottom", detail: "双支柱、轮轴和左右轮组" },
      { key: "tail", label: "尾翼组", slot: "tail", detail: "方向稳定和滚转反馈" },
    ],
    build: {
      quality: "提质",
      quantity: "中量",
      headline: "把三翼机变成会转弯的空中陀螺",
      detail: "优先加转向、能量恢复和翼面插槽，再用少量机枪补足近距击落速度。",
    },
    threeView: {
      src: "https://upload.wikimedia.org/wikipedia/commons/5/54/Fokker_Dr.I_dwg.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled",
      alt: "福克 Dr.I 三视图线稿",
      source: `${commons}File:Fokker_Dr.I_dwg.jpg`,
      note: "三翼层高、翼根前后错位和尾段比例以线稿为准。",
      fileName: "Fokker_Dr.I_dwg.jpg",
      variant: "Fokker Dr.I (Dreidecker), 1917 production layout",
      viewCoverage: "front / side / top",
      dimensions: "1204 × 895 px source image",
      loading: "verified",
    },
    photos: [
      {
        src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/66/1917_Fokker_Dr.I_replica_at_Hiller_Aviation_Museum.jpg/960px-1917_Fokker_Dr.I_replica_at_Hiller_Aviation_Museum.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
        alt: "Hiller Aviation Museum 的福克 Dr.I 复制机",
        caption: "三翼上下间距",
        credit: "Wikimedia Commons",
        source: `${commons}File:1917_Fokker_Dr.I_replica_at_Hiller_Aviation_Museum.jpg`,
      },
      {
        src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8f/Fokker_Dr.I_%27Dreidecker%27_triplane_replica_front_view.jpg/960px-Fokker_Dr.I_%27Dreidecker%27_triplane_replica_front_view.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
        alt: "福克 Dr.I 复制机正面",
        caption: "中心线与翼根",
        credit: "Wikimedia Commons",
        source: `${commons}File:Fokker_Dr.I_'Dreidecker'_triplane_replica_front_view.jpg`,
      },
      {
        src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Fokker_Dr.I_D-EFTJ_Hahnweide_2011.jpg/960px-Fokker_Dr.I_D-EFTJ_Hahnweide_2011.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
        alt: "Hahnweide 的福克 Dr.I 复制机",
        caption: "机身尾段比例",
        credit: "Wikimedia Commons",
        source: `${commons}File:Fokker_Dr.I_D-EFTJ_Hahnweide_2011.jpg`,
      },
    ],
    pipeline: {
      generatedFromApprovedSheet: true,
      envelope: {
        length: 1,
        wingspanToLength: sheetSpan / sheetLength,
        maxFuselageWidthToLength: bodyRadius * 2 / sheetLength,
        maxFuselageHeightToLength: bodyRadius * 2 / sheetLength,
        cockpitStationToLength: .5 - 97 / sheetLength,
        wingRootStationToLength: .5 - 74 / sheetLength,
        tailStationToLength: .5 - 175 / sheetLength,
      },
      architecture: {
        layout: "conventional",
        fuselage: "tube",
        mainCenterline: "fuselage",
        secondaryCenterlines: ["left-wing-0..2", "right-wing-0..2", "tail", "landing_gear"],
        wingRelation: "vertical",
        tailRelation: "branch from fuselage",
      },
      edgeRecords: wings.map(w => ({
        module: w.label, leading: "parallel main span", trailing: "local tip outline",
        seam: { lower: "机身下缘", middle: "机身上缘", upper: "支柱托起上翼" }[w.id],
        span: w.span / sheetSpan, rootChord: (w.trailing - w.leading) / sheetLength,
        sweep: 0, station: `距桨盘 ${w.leading}–${w.trailing} · 轴高 ${w.height}`,
        clearance: "图板单位",
      })),
      evidenceMatrix: [
        { module: "three wing layers", decision: "span order and tip coordinates", primarySource: "three-view", sourceLocation: "plan panel, source rows 386/701, 408/680, 420/670", confirmingViews: ["front", "top"], value: "upper 315 px, middle 272 px, lower 250 px", status: "measured", note: "The same named tip pairs drive front and top." },
        { module: "three wing layers", decision: "vertical seams and layer gap", primarySource: "reviewer-constraint", sourceLocation: "front panel body tangencies and accepted review constraint", confirmingViews: ["front", "side"], value: "lower -21, middle +21, upper +63 drawing units", status: "review-constrained", note: "Lower and middle seams follow the circular body edges. Upper is one body height above middle." },
        { module: "three wing layers", decision: "near-rectangular planform", primarySource: "three-view", sourceLocation: "side and plan leading/trailing edges", confirmingViews: ["side", "top"], value: "sweep 0, parallel edges, terminal rounding only", status: "measured" },
        { module: "fuselage", decision: "circular front section", primarySource: "reviewer-constraint", sourceLocation: "front section and side/plan body stations", confirmingViews: ["front", "side", "top"], value: "42-unit diameter at the cowling station", status: "review-constrained", note: "The accepted front circle and independent longitudinal sections define the body." },
        { module: "propeller and engine", decision: "tractor disk station and wing clearance", primarySource: "three-view", sourceLocation: "side wing-group and propeller stations, plan propeller centerline", confirmingViews: ["side", "top"], value: "wing group forward, upper leading edge 25 drawing units aft of the disk", status: "measured" },
        { module: "tail and landing gear", decision: "tail surfaces, struts, axle, and wheels", primarySource: "photo", sourceLocation: "front replica photo and side/rear replica photos", confirmingViews: ["front", "side"], value: "horizontal tail, vertical fin, two struts, axle, two wheels", status: "photo-supported" },
      ],
      presetAudit: {
        status: "pass",
        checkedPaths: ["mainWing", "wing.tierGap", "wing.spanScale", "FUSELAGE_SECTIONS", "generic fuselageGeometry", "generic featurePlate", "symmetry and default layer formulas"],
        selectedFallbacks: [],
      },
      discrepancyLog: [
        { view: "top", mismatch: "旧三维使用独立翼展缩放。", classification: "assembly", change: "本版从确认图板生成上下三层翼、翼尖和尾面。", evidence: "上、中、下翼全展分别对应图板 315、272、250 单位。" },
        { view: "front", mismatch: "旧模板把三层翼视为同一高度，且翼根与机身边缘关系不清。", classification: "silhouette", change: "为下翼、中翼、上翼分别写入 y、根弦、尖弦和 spanScale，并按圆形机身上下缘布置。", evidence: "固定正视图显示 y=-.58、.58、1.74 的机身高度关系。" },
        { view: "side", mismatch: "旧模板翼组偏后，且螺旋桨盘与上翼前缘关系错误。", classification: "topology", change: "将三条翼线前置到 z=1.57/1.76/1.94，并把牵引桨盘固定在发动机前端。", evidence: "上翼前缘距桨盘约 .28，侧视轮廓连续。" },
        { view: "top", mismatch: "旧模板翼根锚点与几何根缘不一致，出现结构偏移。", classification: "assembly", change: "结构翼根使用翼线 station 0，翼尖按实际有效线长定位。", evidence: "左右翼根与机身中心线对齐，三层翼前后缘保持零后掠。" },
        { view: "top", mismatch: "翼面沿全跨度线性收窄，生成了参考中不存在的梯形轮廓。", classification: "silhouette", change: "主体 82% 翼展保持等弦，仅在圆角翼尖处收束。", evidence: "固定俯视图显示主体前缘和后缘平行。" },
        { view: "side", mismatch: "机身前后截面连续收尖，形成细长纺锤形。", classification: "silhouette", change: "改用宽中段、钝机鼻和渐收尾段的专属截面序列。", evidence: "固定侧视图显示短粗机身和宽发动机侧过渡。" },
        { view: "front", mismatch: "二维抽象把中翼放在中心线，并漏画水平尾翼和垂直尾翼。", classification: "topology", change: "下翼对齐机身下缘，中翼对齐机身上缘，上翼上移一个机身高度，并补齐两种尾翼关键线。", evidence: "更新后的二维正视和侧视板同时显示三层翼与两种尾翼。" },
        { view: "top", mismatch: "二维抽象把三层主翼沿纵向分开，误读成三个独立平面。", classification: "module", change: "让三层主翼在俯视图接近重叠，只保留小幅前后站位差。", evidence: "更新后的二维俯视板显示接近重叠的翼组。" },
        { view: "front", mismatch: "二维抽象使用椭圆表示机身截面。", classification: "silhouette", change: "正视改用圆形截面，侧视和俯视继续使用拉长轮廓。", evidence: "更新后的二维正视板显示正圆机身截面。" },
      ],
    },
  },
  {
    frameId: "falcon_13",
    prototype: "Supermarine Spitfire",
    chineseName: "超级马林 Spitfire 喷火",
    period: "1936 · 第二次世界大战",
    role: "单发高机动截击",
    match: 88,
    matchLabel: "单翼与机鼻线吻合",
    summary: "低翼、液冷发动机和椭圆翼是这架机的识别骨架，爆改时应该让翼尖变化保持在同一根主翼中心线上。",
    structuralNotes: [
      "机鼻、座舱、主翼和尾翼沿同一纵向轴线排列。",
      "主翼前缘较圆，不能用两块尖锐的三角板替代椭圆轮廓。",
      "机炮应放在翼内或翼根附近，武器增殖要沿主翼方向排列。",
    ],
    modules: [
      { key: "center", label: "机身中心线", slot: "center", detail: "发动机、座舱、油箱和核心生命" },
      { key: "wing", label: "椭圆主翼", slot: "leftWing", detail: "高速转向的主要升力面" },
      { key: "nose", label: "机鼻动力舱", slot: "nose", detail: "发动机、散热器与前向机炮" },
      { key: "tail", label: "尾翼与方向舵", slot: "tail", detail: "细长尾段维持高速稳定" },
    ],
    build: {
      quality: "提质",
      quantity: "少量",
      headline: "把灵活性变成持续锁定时间",
      detail: "优先增加转向、锁定弧和机炮精度。翼面扩展只加一到两层，避免破坏高速回转。",
    },
    threeView: {
      src: "https://upload.wikimedia.org/wikipedia/commons/9/91/Supermarine_Spitfire_Mk_Vb_3-view.svg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled",
      alt: "Supermarine Spitfire Mk Vb 三视图线稿",
      source: `${commons}File:Supermarine_Spitfire_Mk_Vb_3-view.svg`,
      note: "Mk Vb 的正视、侧视和俯视关系用于校准椭圆翼、座舱、散热器和尾翼站位。",
    },
    photos: [
      {
        src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bc/National_Technical_Museum_Prague_%E2%80%93_Supermarine_Spitfire%2C_left_side.jpg/960px-National_Technical_Museum_Prague_%E2%80%93_Supermarine_Spitfire%2C_left_side.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
        alt: "布拉格国家技术博物馆的 Spitfire 左侧",
        caption: "椭圆主翼",
        credit: "Wikimedia Commons",
        source: `${commons}File:National_Technical_Museum_Prague_–_Supermarine_Spitfire,_left_side.jpg`,
      },
      {
        src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Air_to_air_image_of_a_Spitfire%2C_taken_over_RAF_Coningsby._MOD_45147974.jpg/960px-Air_to_air_image_of_a_Spitfire%2C_taken_over_RAF_Coningsby._MOD_45147974.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
        alt: "飞行中的 Spitfire",
        caption: "翼根到尾翼的比例",
        credit: "Wikimedia Commons",
        source: `${commons}File:Air_to_air_image_of_a_Spitfire,_taken_over_RAF_Coningsby._MOD_45147974.jpg`,
      },
      {
        src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/National_Technical_Museum_Prague_%E2%80%93_Supermarine_Spitfire%2C_right_side.jpg/960px-National_Technical_Museum_Prague_%E2%80%93_Supermarine_Spitfire%2C_right_side.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
        alt: "布拉格国家技术博物馆的 Spitfire 右侧",
        caption: "机鼻和座舱位置",
        credit: "Wikimedia Commons",
        source: `${commons}File:National_Technical_Museum_Prague_–_Supermarine_Spitfire,_right_side.jpg`,
      },
    ],
  },
  {
    frameId: "dragonfly_06",
    prototype: "Mitsubishi A6M Zero",
    chineseName: "三菱 A6M 零式",
    period: "1940 · 第二次世界大战",
    role: "轻量远程格斗",
    match: 74,
    matchLabel: "单翼吻合，翼型需修正",
    summary: "零式的轻量化和大翼面很适合做‘提质’路线。当前生成模型的单翼中心线正确，但机鼻和起落架细节仍是后续几何任务。",
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
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/94/Mitsubishi_A6M_Zero_drawing.svg/1280px-Mitsubishi_A6M_Zero_drawing.svg.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
      alt: "零式三视图线稿",
      source: `${commons}File:Mitsubishi_A6M_Zero_drawing.svg`,
      note: "细长机身、大翼面和圆润翼尖以线稿为准。",
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
  },
  {
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
  },
  {
    frameId: "stingray_16",
    prototype: "Horten Ho 229",
    chineseName: "德国 Horten Ho 229 飞翼",
    period: "1944 · 喷气飞翼实验机",
    role: "飞翼高速攻击",
    match: 58,
    matchLabel: "目标明确，当前模型差异大",
    summary: "飞翼不能继续套用传统机身加尾翼模板。它需要一条短中心舱和连续的翼身融合面，适合做后期的高风险高上限构筑。",
    structuralNotes: [
      "中心舱很短，主要体积沿左右翼面展开。",
      "没有常规尾翼，纵向稳定由翼面后缘和控制面完成。",
      "发动机应嵌入翼根，挂点可以沿翼面成串列线扩张。",
    ],
    modules: [
      { key: "center", label: "短中心舱", slot: "center", detail: "驾驶舱、核心和武器汇聚点" },
      { key: "wing", label: "连续飞翼", slot: "leftWing", detail: "左右翼面就是主要机身" },
      { key: "engine", label: "翼根喷气舱", slot: "leftWing", detail: "发动机嵌入翼根，不挂在翼下" },
      { key: "weapon", label: "翼根武器舱", slot: "nose", detail: "集中火力和高速俯冲" },
    ],
    build: {
      quality: "提量",
      quantity: "高量",
      headline: "让翼面成为整架飞机",
      detail: "解锁飞翼中心线后，把发动机和武器沿翼根串列复制。对称和非对称都应该由同一套挂点规则生成。",
    },
    threeView: {
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Horten_H.IX_line_drawing.svg/1280px-Horten_H.IX_line_drawing.svg.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
      alt: "Horten Ho 229 三视图线稿",
      source: `${commons}File:Horten_H.IX_line_drawing.svg`,
      note: "短中心舱、连续飞翼和翼根发动机位置以线稿为准。",
    },
    photos: [
      {
        src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/67/Horten_Ho_229_Restoration_Hangar_Smithsonian.jpg/960px-Horten_Ho_229_Restoration_Hangar_Smithsonian.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
        alt: "史密森学会修复中的 Horten Ho 229",
        caption: "飞翼连续翼身",
        credit: "Wikimedia Commons",
        source: `${commons}File:Horten_Ho_229_Restoration_Hangar_Smithsonian.jpg`,
      },
      {
        src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/Horten_Ho_229_Restoration_Hangar_Smithsonian_%28cropped%29.jpg/960px-Horten_Ho_229_Restoration_Hangar_Smithsonian_%28cropped%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
        alt: "Horten Ho 229 修复机体局部",
        caption: "中心舱与翼根",
        credit: "Wikimedia Commons",
        source: `${commons}File:Horten_Ho_229_Restoration_Hangar_Smithsonian_(cropped).jpg`,
      },
      {
        src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/67/Horten_Ho_229_Restoration_Hangar_Smithsonian.jpg/960px-Horten_Ho_229_Restoration_Hangar_Smithsonian.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
        alt: "Horten Ho 229 飞翼结构",
        caption: "翼面挂点方向",
        credit: "Wikimedia Commons",
        source: `${commons}File:Horten_Ho_229_Restoration_Hangar_Smithsonian.jpg`,
      },
    ],
  },
];

export const aircraftReferenceByFrameId = (frameId: string) =>
  AIRCRAFT_REFERENCES.find((reference) => reference.frameId === frameId) ?? AIRCRAFT_REFERENCES[0];
