import "./style.css";
import { GameApp } from "./app/GameApp";
import { ReferenceApp } from "./app/ReferenceApp";
const root = document.querySelector<HTMLElement>("#app")!;
if (import.meta.env.DEV && new URLSearchParams(location.search).has("environmentTest")) {
  void import("./rendering/EnvironmentAcceptance").then(({ mountEnvironmentAcceptance }) => mountEnvironmentAcceptance(root));
} else if (new URLSearchParams(location.search).has("reference") || location.hash === "#reference") {
  new ReferenceApp(root);
} else {
  new GameApp(root);
}
