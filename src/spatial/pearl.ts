import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Effect } from "@babylonjs/core/Materials/effect";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";

Effect.ShadersStore.loomPearlVertexShader = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 worldViewProjection;
uniform mat4 world;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vLocal;
void main() {
  vPosition = (world * vec4(position, 1.0)).xyz;
  vNormal = normalize(mat3(world) * normal);
  vLocal = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;
Effect.ShadersStore.loomPearlFragmentShader = `
precision highp float;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vLocal;
uniform vec3 cameraPosition;
uniform vec3 stateTint;
uniform float dark;
uniform float time;
void main() {
  vec3 normal = normalize(vNormal);
  vec3 view = normalize(cameraPosition - vPosition);
  float facing = max(dot(normal, view), 0.0);
  float light = dot(normal, normalize(vec3(-0.7, 0.8, -0.6))) * 0.5 + 0.5;
  vec3 pearl = mix(vec3(0.48, 0.41, 0.39), vec3(0.98, 0.94, 0.90), smoothstep(0.0, 1.0, light));
  float longitude = atan(vLocal.z, vLocal.x);
  float latitude = asin(clamp(normalize(vLocal).y, -1.0, 1.0));
  float flow = latitude + 0.34 * sin(longitude + latitude * 1.5 + time * 0.025);
  float stripe = pow(0.5 + 0.5 * cos(flow * 155.0), 24.0);
  pearl += vec3(0.14, 0.12, 0.11) * stripe * (0.4 + 0.6 * facing);
  float rim = pow(1.0 - facing, 2.4);
  pearl = mix(pearl, vec3(1.0, 0.94, 0.86), rim * 0.78);
  pearl += stateTint * (0.035 + rim * 0.14);
  pearl *= 1.0 - dark * 0.08;
  gl_FragColor = vec4(pearl, 1.0);
}`;

export function createPearl(scene: Scene): ShaderMaterial {
  const material = new ShaderMaterial("loom-pearl", scene, "loomPearl", {
    attributes: ["position", "normal"],
    uniforms: ["worldViewProjection", "world", "cameraPosition", "stateTint", "dark", "time"],
  });
  material.setColor3("stateTint", new Color3(0.6, 0.5, 0.7));
  material.setFloat("dark", 0);
  material.setFloat("time", 0);
  return material;
}
