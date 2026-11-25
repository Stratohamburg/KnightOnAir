import { commons, photo, pioneer } from "./sources";

import type { AircraftTraceStudy } from "./types";

const study: AircraftTraceStudy = {
  source: "https://flyingmachines.ru/Site2/Crafts/Craft25520.htm",
  credit: "М. Маслов《Русские самолеты Первой Мировой》· 第 130 页，首架原型",
  image: new URL("../../assets/reference/ilya-muromets/study.webp", import.meta.url).href,
  size: [930, 178],
  panels: [
    {
      label: "首架原型 · 侧视，机头朝左", crop: [0, 2, 927, 168],
      projection: { view: "side", origin: [464,88], scale: 48.0, angle: 0 },
      traces: [
        ["客舱与后机身","M104 89Q110 49 133 42L195 44L232 54L811 74L905 90L904 110L813 116L420 130H132Q109 126 105 117Z", "skin"],
        ["上翼","M130 16Q151 0 201 14L224 22L263 37L235 34L192 20Z", "skin"],
        ["尾舵","M830 26Q827 10 843 11L901 11Q922 12 920 40L919 70L906 100L868 119L831 112Z", "skin"],
        ["滑橇","M9 156Q20 166 49 161H182L178 165L41 166Q15 169 9 156Z", "strut"],
        ["客舱窗列","M215 71H239V99H215Z M254 71H277V99H254Z M291 71H314V99H291Z M330 71H353V99H330Z", "opening"],
        ["前部翼间撑杆","M143 20L130 116 M202 22L188 122","strut"],
        ["前部翼间交叉张线","M143 21L188 120 M131 116L202 22","wire"],
        ["中部翼架撑杆","M425 35L422 156 M485 29L490 155","strut"],
        ["中部翼架张线","M425 35L488 156 M423 155L484 30","wire"],
        ["尾部斜撑","M782 75L819 46 M785 76L820 54","strut"],
      ],
    },
    {
      label: "迎面结构照片 · 中央客舱与四处发动机架", crop: [9,5,492,185],
      traces: [
        ["翼间立柱","M30 41L26 127 M68 37L64 127 M132 27L135 124 M160 24L162 124 M205 22V123 M267 22L270 122 M311 21L310 120 M335 19L340 118 M401 16L407 112 M432 17L445 113","strut"],
        ["翼间张线","M68 66L130 67 M67 88L132 89 M162 71L203 70 M268 69L311 67 M338 65L402 63","wire"],
        ["四处外露动力安装","M26 116L31 95L45 95L53 115 M132 115L136 88L150 87L158 114 M311 113L315 86L330 83L337 110 M411 107L417 82L426 81L435 106","body"],
        ["客舱风挡","M210 69L235 67V95H210Z M240 67H263V95H240Z","opening"],
      ],
      detail: { image: new URL("../../assets/reference/ilya-muromets/forward-rig.webp", import.meta.url).href, size: [511,197],
        source: "https://flyingmachines.ru/Images7/02-Bombers/Other/Sikorsky_IM-3.jpg", credit: "Обухович、Никифоров · 同系装配照片，未注明机号" },
    },
  ],
  readings: [
    "封闭客舱保留外皮、窗列与舱门；翼间撑杆和斜索单独可见。侧投影重合的远侧索线按可见区间记录。",
    "首架原型侧图可读出机鼻滑橇、窗列、舱门和后机身的站位。以首窗与后机身上缘配准侧视。",
    "首架原型历史照片可辨四发和前部翼面，但这张侧图将左右发动机重叠，另附迎面照片用于辨认发动机和支架；该照片未注明机号，首架原型的横向站位仍需原图。",
  ],
  modelNote: "采用首架陆上原型侧视的封闭客舱、窗列、前后滑橇和中部小翼。尾柱与最后一排舷窗之间的机身截面按侧视渐缩。四个桨轴横距、上视翼尖弧线和尾舵间距按历史照近似。",
  pending: "1913 年首架陆上原型需完整正、俯视图，核定四个桨轴和前部翼面。后期军用系列的站位不可移用。",
};

export default pioneer({
  id: "ilya-muromets",
  study,
  frameId: "reference_ilya_muromets",
  prototype: "Sikorsky Ilya Muromets",
  chineseName: "西科尔斯基 Ilya Muromets",
  period: "1913 · 航空萌芽时期末段",
  role: "四发客运原型机",
  summary: "封闭式大型机身、四台发动机和宽厚双翼构成早期重型飞机的完整轮廓。",
  structuralNotes: [
    "四台发动机沿主翼前缘分布，发动机数量和间距是远距离识别重点。",
    "机身拥有封闭客舱和较高的驾驶舱，体量不能缩成普通双发轰炸机。",
    "S-22 早期客运构型与后续军用型有差异，原型板先锁定 1913 年 S-22。",
  ],
  modules: [
    { key: "center", label: "封闭式大型机身", slot: "center", detail: "驾驶舱、客舱和内部载荷" },
    { key: "wing", label: "厚重双翼", slot: "leftWing", detail: "主翼、支柱和多发动机挂点" },
    { key: "engine", label: "四台翼上发动机", slot: "leftWing", detail: "发动机、桨盘和独立损伤区" },
    { key: "tail", label: "大型尾翼", slot: "tail", detail: "宽尾平面与垂直稳定面" },
  ],
  threeView: {
    src: study.image,
    alt: "М. Маслов《Русские самолеты Первой Мировой》· 第 130 页，首架原型参考图",
    source: study.source,
    note: study.credit,
    variant: "Sikorsky S-22 Ilya Muromets 1913 early configuration",
    viewCoverage: "首架原型",
    loading: "pending",
  },
  photos: [
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Ilya_Muromets_at_Central_Air_Force_Museum_-_130513_-_Vasters_2186_%288911084051%29.jpg/1280px-Ilya_Muromets_at_Central_Air_Force_Museum_-_130513_-_Vasters_2186_%288911084051%29.jpg", `${commons}File:Ilya Muromets at Central Air Force Museum - 130513 - Vasters 2186 (8911084051).jpg`, "中央空军博物馆的 Ilya Muromets 复制机", "四台发动机与大型机身"),
    photo("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/Riesenflugzeug_Ilja_Muromez.jpg/1280px-Riesenflugzeug_Ilja_Muromez.jpg", `${commons}File:Riesenflugzeug Ilja Muromez.jpg`, "Ilya Muromets 大型机历史图", "封闭机身和多发动机布局"),
    photo("https://upload.wikimedia.org/wikipedia/commons/6/69/14082007-Illya-Muromec-1.jpg", `${commons}File:14082007-Illya-Muromec-1.jpg`, "Ilya Muromets S-23 展示机", "机身舱段与尾翼体量"),
  ],
});
