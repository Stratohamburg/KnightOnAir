import "./style.css";
import { GameApp } from "./app/GameApp";
const root = document.querySelector<HTMLElement>("#app")!;
if (import.meta.env.DEV && new URLSearchParams(location.search).has("environmentTest")) {
  void import("./rendering/EnvironmentAcceptance").then(({ mountEnvironmentAcceptance }) => mountEnvironmentAcceptance(root));
} else {
  new GameApp(root);
}
