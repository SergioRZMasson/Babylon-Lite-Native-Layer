$input v_normal, v_wpos, v_uv, v_tangent

// glTF metallic-roughness PBR (Cook-Torrance), with base-color / metallic-roughness /
// normal / emissive / occlusion textures, a single direct light, and a hemispheric
// ambient approximation. NOTE: this is direct + crude ambient only — no image-based
// lighting yet, so it will not match the IBL-lit scene1 golden (that's the next stage).

#include <bgfx_shader.sh>

SAMPLER2D(s_baseColor, 0);
SAMPLER2D(s_metalRough, 1);
SAMPLER2D(s_normalTex, 2);
SAMPLER2D(s_emissive, 3);
SAMPLER2D(s_occlusion, 4);

uniform vec4 u_baseColorFactor;  // rgba
uniform vec4 u_mrParams;         // x=metallic, y=roughness, z=occlusionStrength, w=alphaCutoff
uniform vec4 u_emissiveFactor;   // rgb, w unused
uniform vec4 u_texFlags;         // x=baseTex, y=mrTex, z=normalTex, w=emissiveTex (1/0)
uniform vec4 u_occFlag;          // x=occlusionTex (1/0)
uniform vec4 u_lightDir;         // xyz = direction to light
uniform vec4 u_lightColor;       // rgb * intensity
uniform vec4 u_ambientSky;       // rgb hemispheric up colour
uniform vec4 u_ambientGround;    // rgb hemispheric down colour
uniform vec4 u_eyePos;           // xyz

#define PI 3.14159265359

vec3 srgbToLinear(vec3 c) { return pow(c, vec3_splat(2.2)); }

float distributionGGX(float NdotH, float a) {
	float a2 = a * a;
	float d = (NdotH * NdotH) * (a2 - 1.0) + 1.0;
	return a2 / max(PI * d * d, 1e-7);
}
float geometrySmith(float NdotV, float NdotL, float rough) {
	float r = rough + 1.0;
	float k = (r * r) / 8.0;
	float gv = NdotV / (NdotV * (1.0 - k) + k);
	float gl = NdotL / (NdotL * (1.0 - k) + k);
	return gv * gl;
}
vec3 fresnelSchlick(float cosT, vec3 F0) {
	return F0 + (vec3_splat(1.0) - F0) * pow(1.0 - cosT, 5.0);
}

void main()
{
	vec4 baseColor = u_baseColorFactor;
	if (u_texFlags.x > 0.5) {
		vec4 t = texture2D(s_baseColor, v_uv);
		baseColor.rgb *= srgbToLinear(t.rgb);
		baseColor.a *= t.a;
	}

	float metallic = u_mrParams.x;
	float roughness = u_mrParams.y;
	if (u_texFlags.y > 0.5) {
		vec4 mr = texture2D(s_metalRough, v_uv); // glTF: G=roughness, B=metallic
		roughness *= mr.y;
		metallic *= mr.z;
	}
	roughness = clamp(roughness, 0.04, 1.0);

	vec3 N = normalize(v_normal);
	if (u_texFlags.z > 0.5) {
		vec3 nt = texture2D(s_normalTex, v_uv).xyz * 2.0 - 1.0;
		vec3 T = normalize(v_tangent.xyz);
		vec3 B = cross(N, T) * v_tangent.w;
		N = normalize(nt.x * T + nt.y * B + nt.z * N);
	}

	float occlusion = 1.0;
	if (u_occFlag.x > 0.5) {
		float o = texture2D(s_occlusion, v_uv).r;
		occlusion = 1.0 + u_mrParams.z * (o - 1.0);
	}

	vec3 emissive = u_emissiveFactor.rgb;
	if (u_texFlags.w > 0.5) {
		emissive *= srgbToLinear(texture2D(s_emissive, v_uv).rgb);
	}

	vec3 albedo = baseColor.rgb;
	vec3 V = normalize(u_eyePos.xyz - v_wpos);
	vec3 L = normalize(u_lightDir.xyz);
	vec3 H = normalize(V + L);
	float NdotL = max(dot(N, L), 0.0);
	float NdotV = max(dot(N, V), 1e-4);
	float NdotH = max(dot(N, H), 0.0);
	float VdotH = max(dot(V, H), 0.0);

	vec3 F0 = mix(vec3_splat(0.04), albedo, metallic);
	vec3 diffuseColor = albedo * (1.0 - metallic);

	float D = distributionGGX(NdotH, roughness * roughness);
	float G = geometrySmith(NdotV, NdotL, roughness);
	vec3 F = fresnelSchlick(VdotH, F0);
	vec3 spec = (D * G) * F / max(4.0 * NdotV * NdotL, 1e-4);
	vec3 kd = (vec3_splat(1.0) - F) * (1.0 - metallic);

	vec3 direct = (kd * diffuseColor / PI + spec) * u_lightColor.rgb * NdotL;

	// Hemispheric ambient (no IBL): diffuse from sky/ground, plus a cheap spec ambient.
	vec3 ambColor = mix(u_ambientGround.rgb, u_ambientSky.rgb, N.y * 0.5 + 0.5);
	vec3 ambient = diffuseColor * ambColor * occlusion + F0 * ambColor * 0.5;

	vec3 color = direct + ambient + emissive;

	// Reinhard tonemap + gamma (placeholder until ACES + exposure in the IBL stage).
	color = color / (color + vec3_splat(1.0));
	color = pow(color, vec3_splat(1.0 / 2.2));

	gl_FragColor = vec4(color, baseColor.a);
}
