import { clamp } from "../../services/Random";

export type ButtonSize = "xs" | "sm" | "md" | "lg";
export type ButtonVariant = "primary" | "secondary" | "ghost";

export function button(action: string, content: string, css = "", attributes = "") {
  return `<button type="button" data-action="${action}" class="${css}" ${attributes}>${content}</button>`;
}

export function actionButton(
  action: string,
  content: string,
  options: {
    size?: ButtonSize;
    variant?: ButtonVariant;
    block?: boolean;
    extraClass?: string;
    attributes?: string;
  } = {},
) {
  const { size = "sm", variant = "secondary", block = false, extraClass = "", attributes = "" } = options;
  const classes = ["btn", `btn-${size}`, `btn-${variant}`, block ? "btn-block" : "", extraClass]
    .filter(Boolean)
    .join(" ");
  return button(action, content, classes, attributes);
}

export function dialog(label: string, content: string, extraClass = "") {
  return `<div class="modal-scrim"><section class="modal ${extraClass}" role="dialog" aria-modal="true" aria-label="${label}">${content}</section></div>`;
}

export function meter(css: string, id = "") {
  return `<div class="${css}"><i${id ? ` id="${id}"` : ""}></i></div>`;
}

export function setMeter(fill: HTMLElement, value: number) {
  fill.style.width = `${clamp(value) * 100}%`;
}

export class NodePool<T> {
  private readonly active = new Map<number, T>();
  private readonly free: T[] = [];
  private created = 0;

  constructor(
    private readonly capacity: number,
    private readonly create: () => T,
    private readonly setVisible: (node: T, visible: boolean) => void,
  ) {}

  update<U extends { id: number }>(values: readonly U[], render: (node: T, value: U) => void) {
    const current = values.slice(0, this.capacity);
    const ids = new Set(current.map(({ id }) => id));
    for (const [id, node] of this.active) {
      if (ids.has(id)) continue;
      this.setVisible(node, false);
      this.active.delete(id);
      this.free.push(node);
    }
    for (const value of current) {
      let node = this.active.get(value.id);
      if (!node) {
        node = this.free.pop();
        if (!node) {
          node = this.create();
          this.created++;
        }
        this.active.set(value.id, node);
        this.setVisible(node, true);
      }
      render(node, value);
    }
  }

  get diagnostics() {
    return { capacity: this.capacity, active: this.active.size, created: this.created };
  }
}
