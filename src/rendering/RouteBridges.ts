import * as THREE from "three";
import { type Route, routeHeading, routePosition } from "../simulation/Routes";
import { terrainHeight } from "../simulation/Terrain";
import { aircraftShadowGLSL } from "./AircraftShadows";
import { cloudShadowGLSL } from "./CloudShadowShader";

export function routeBridges(routes: Route[], lighting: THREE.ShaderMaterial["uniforms"]) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const deckCoordinates: number[] = [];
  const road = new THREE.Color("#7c7d68");
  const ballast = new THREE.Color("#756b5e");
  const coping = new THREE.Color("#c4ad87");
  const stone = new THREE.Color("#646c64");
  const spacing = .7;

  for (const route of routes) {
    if (route.kind === "water") continue;
    const width = route.kind === "rail" ? 1.16 : 2.6;
    const deck = route.kind === "rail" ? ballast : road;
    const parapet = route.kind === "rail" ? .19 : .49;
    const profile = [
      [-width, -.83, stone],
      [-width, parapet, coping],
      [-width + .28, parapet, coping],
      [-width + .34, .075, deck],
      [width - .34, .075, deck],
      [width - .28, parapet, coping],
      [width, parapet, coping],
      [width, -.83, stone],
    ] as const;
    const steps = Math.ceil(route.length / spacing);
    const needsDeck = Array.from({ length: steps + 1 }, (_, index) => {
      const { x, y, z } = routePosition(route, index * spacing);
      return y - terrainHeight(x, z, route.seed) > .16;
    });
    let previous = -1;
    for (let section = 0; section <= steps; section++) {
      if (!needsDeck[section] && !needsDeck[section - 1] && !needsDeck[section + 1]) {
        previous = -1;
        continue;
      }

      const distance = section * spacing;
      const { x, y, z } = routePosition(route, distance);
      const heading = routeHeading(route, distance);
      const offsetX = Math.cos(heading), offsetZ = -Math.sin(heading);
      const start = positions.length / 3;
      const colorVariation = 1 + .07 * Math.sin(section * 1.13);
      const edgeHeight = needsDeck[section] ? 1 : .35;
      for (const [across, height, color] of profile) {
        const profileHeight = height > .075 ? THREE.MathUtils.lerp(.075, height, edgeHeight) : height;
        positions.push(x + across * offsetX, y + profileHeight, z + across * offsetZ);
        colors.push(color.r * colorVariation, color.g * colorVariation, color.b * colorVariation);
        deckCoordinates.push(across, distance);
      }
      if (previous >= 0) {
        for (let side = 0; side < profile.length - 1; side++) {
          const a = previous + side, b = start + side;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
      previous = start;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(deckCoordinates, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, lighting);
    shader.vertexShader = `varying vec3 vBridgeWorld; varying vec2 vBridgeDeck;\n` + shader.vertexShader.replace(
      "#include <project_vertex>",
      `#include <project_vertex>
        vBridgeWorld = (modelMatrix * vec4(transformed, 1.)).xyz;
        vBridgeDeck = uv;`,
    );
    shader.fragmentShader = `varying vec3 vBridgeWorld; varying vec2 vBridgeDeck; ${cloudShadowGLSL} ${aircraftShadowGLSL}` +
      shader.fragmentShader.replace("#include <opaque_fragment>", `
        vec2 pavement = vBridgeDeck * vec2(1.35, 1.8);
        pavement.x += mod(floor(pavement.y), 2.) * .5;
        vec2 seam = min(fract(pavement), 1. - fract(pavement));
        vec2 edge = smoothstep(vec2(.01), max(fwidth(pavement), vec2(.04)), seam);
        float fade = 1. - smoothstep(.17, .45, max(fwidth(pavement.x), fwidth(pavement.y)));
        outgoingLight *= 1. - (1. - edge.x * edge.y) * fade * .17;
        float sunExposure = cloudLightAt(vBridgeWorld);
        outgoingLight *= sunExposure * mix(1., aircraftSunlightAt(vBridgeWorld), sunExposure);
        #include <opaque_fragment>`);
  };
  return new THREE.Mesh(geometry, material);
}
