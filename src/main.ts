import "./style.css";
import { referenceRequested } from "./app/debugVisibility";
const root = document.querySelector<HTMLElement>("#app")!;
if (import.meta.env.DEV && new URLSearchParams(location.search).has("environmentTest")) {
  void import("./rendering/EnvironmentAcceptance").then(({ mountEnvironmentAcceptance }) => mountEnvironmentAcceptance(root));
} else if (referenceRequested(location.search, location.hash)) {
  void import("./app/DebugWorkbench").then(({ DebugWorkbench }) => {
    const workbench = new DebugWorkbench(root);
    if (import.meta.env.DEV) Object.assign(window, { __koaWorkbench: workbench });
  });
} else {
  void import("./app/GameApp").then(({ GameApp }) => new GameApp(root));
}
