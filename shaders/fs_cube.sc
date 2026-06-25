$input v_normal, v_wpos

// Standard-material fragment stage, hand-ported from Babylon-Lite
// material/standard/standard-template.ts. Implements the HEMISPHERIC light path plus a
// directional "sun" term that is shadowed by a 4-cascade CSM (the ground in the benchmark
// is a standard-material shadow receiver). Scenes without a sun set u_sunColor=0 and
// u_shadowEnable=0, so the output is identical to the plain hemispheric path.

#include <bgfx_shader.sh>

uniform vec4 u_lightDir;     // xyz = direction to light (Lite vLightData.xyz)
uniform vec4 u_lightDiffuse; // rgb = diffuse colour * intensity
uniform vec4 u_lightGround;  // rgb = hemispheric ground colour
uniform vec4 u_diffuseColor; // rgb = material diffuse, a = alpha
uniform vec4 u_specular;     // rgb = specular colour, a = glossiness
uniform vec4 u_eyePos;       // xyz = camera world position

// ---- Directional sun + cascaded shadow map ----
uniform mat4 u_csmVP[4];      // per-cascade light view-proj (column-major)
uniform vec4 u_csmSplits;     // view-space far distance per cascade (x..w)
uniform vec4 u_shadowParams;  // x=numCascades, y=bias, z=atlasTexel(1/atlasDim), w=originBottomLeft
uniform vec4 u_shadowEnable;  // x = receiveShadows (per draw)
uniform vec4 u_sunDir;        // xyz = sun travel direction
uniform vec4 u_sunColor;      // rgb = sun colour * intensity
uniform vec4 u_camForward;    // xyz = camera forward (cascade selection by view depth)
SAMPLER2D(s_shadowAtlas, 0);

float csmShadow(vec3 wpos)
{
	float vd = dot(wpos - u_eyePos.xyz, u_camForward.xyz);
	int nC = int(u_shadowParams.x);
	int c = 0;
	if (vd > u_csmSplits.x) { c = 1; }
	if (vd > u_csmSplits.y) { c = 2; }
	if (vd > u_csmSplits.z) { c = 3; }
	if (c > nC - 1) { c = nC - 1; }

	vec4 lc = mul(u_csmVP[c], vec4(wpos, 1.0));
	vec3 ndc = lc.xyz / lc.w;
	vec2 uv = ndc.xy * 0.5 + 0.5;
	if (u_shadowParams.w < 0.5) { uv.y = 1.0 - uv.y; }
	if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { return 1.0; }

	// 2x2 atlas: cascade c lives in quadrant (c%2, c/2).
	float qx = (c == 1 || c == 3) ? 0.5 : 0.0;
	float qy = (c >= 2) ? 0.5 : 0.0;
	vec2 base = vec2(qx, qy) + uv * 0.5;

	float curr = ndc.z - u_shadowParams.y;
	float tex = u_shadowParams.z;
	float sh = 0.0;
	for (int dy = -1; dy <= 1; dy++) {
		for (int dx = -1; dx <= 1; dx++) {
			vec2 o = vec2(float(dx), float(dy)) * tex;
			float d = texture2D(s_shadowAtlas, base + o).x;
			sh += (curr <= d) ? 1.0 : 0.0;
		}
	}
	return sh / 9.0;
}

void main()
{
	vec3 N = normalize(v_normal);
	vec3 viewDir = normalize(u_eyePos.xyz - v_wpos);
	vec3 Ldir = normalize(u_lightDir.xyz);

	float nl = 0.5 + 0.5 * dot(N, Ldir);
	vec3 diff = mix(u_lightGround.xyz, u_lightDiffuse.xyz, nl);

	vec3 h = normalize(viewDir + Ldir);
	float s = pow(max(0.0, dot(N, h)), max(1.0, u_specular.w));

	// Directional sun (shadowed). u_sunColor is 0 for scenes without a sun.
	float shadow = (u_shadowEnable.x > 0.5) ? csmShadow(v_wpos) : 1.0;
	vec3 sunDirToLight = normalize(-u_sunDir.xyz);
	float sunNl = max(0.0, dot(N, sunDirToLight));
	vec3 sunTerm = u_sunColor.xyz * (sunNl * shadow);

	vec3 finalDiffuse = clamp(diff * u_diffuseColor.xyz, 0.0, 1.0) + sunTerm * u_diffuseColor.xyz;
	vec3 finalSpecular = s * u_specular.xyz;

	vec3 color = finalDiffuse + finalSpecular;
	gl_FragColor = vec4(color, u_diffuseColor.w);
}
