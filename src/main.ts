import "./style.css";
import { GameApp } from "./app/GameApp";
const root = document.querySelector<HTMLElement>("#app")!;
new GameApp(root);
