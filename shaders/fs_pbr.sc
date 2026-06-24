$input v_normal, v_wpos, v_uv, v_tangent

// glTF metallic-roughness PBR (Cook-Torrance) with base-color / metallic-roughness /
// normal / emissive / occlusion textures, a single direct light, and — when an
// environment is bound — image-based lighting (IBL): SH irradiance for diffuse +
// a prefiltered specular cubemap (split-sum) for specular, with ACES tonemapping.
// Falls back to a hemispheric ambient approximation when no environment is set.

#include <bgfx_shader.sh>

SAMPLER2D(s_baseColor, 0);
SAMPLER2D(s_metalRough, 1);
SAMPLER2D(s_normalTex, 2);
SAMPLER2D(s_emissive, 3);
SAMPLER2D(s_occlusion, 4);
SAMPLERCUBE(s_envSpecular, 5);

uniform vec4 u_baseColorFactor;  // rgba
uniform vec4 u_mrParams;         // x=metallic, y=roughness, z=occlusionStrength, w=alphaCutoff
uniform vec4 u_emissiveFactor;   // rgb, w unused
uniform vec4 u_texFlags;         // x=baseTex, y=mrTex, z=normalTex, w=emissiveTex (1/0)
uniform vec4 u_occFlag;          // x=occlusionTex (1/0)
uniform vec4 u_lightDir;         // xyz = direction to light
uniform vec4 u_lightColor;       // rgb * intensity
uniform vec4 u_ambientSky;       // rgb hemispheric up colour (no-IBL fallback)
uniform vec4 u_ambientGround;    // rgb hemispheric down colour (no-IBL fallback)
uniform vec4 u_eyePos;           // xyz
uniform vec4 u_envParams;        // x=numMips, y=intensity, z=hasEnv(1/0), w=exposure
uniform vec4 u_envParams2;       // x=lodGenerationScale, y=contrast
uniform vec4 u_envSH[9];         // pre-scaled SH irradiance (L00,L1_1,L10,L11,L2_2,L2_1,L20,L21,L22)

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

// SH irradiance from the 9 pre-scaled harmonics (Babylon polynomial→harmonics form).
vec3 shIrradiance(vec3 n) {
	return u_envSH[0].rgb
		+ u_envSH[1].rgb * n.y
		+ u_envSH[2].rgb * n.z
		+ u_envSH[3].rgb * n.x
		+ u_envSH[4].rgb * (n.y * n.x)
		+ u_envSH[5].rgb * (n.y * n.z)
		+ u_envSH[6].rgb * (3.0 * n.z * n.z - 1.0)
		+ u_envSH[7].rgb * (n.z * n.x)
		+ u_envSH[8].rgb * (n.x * n.x - n.y * n.y);
}

// Analytic environment-BRDF approximation (Karis) — avoids a BRDF LUT texture.
vec2 envBRDFApprox(float NoV, float roughness) {
	vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
	vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
	vec4 r = roughness * c0 + c1;
	float a004 = min(r.x * r.x, exp2(-9.28 * NoV)) * r.x + r.y;
	return vec2(-1.04, 1.04) * a004 + r.zw;
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
	vec3 geoN = N;                 // geometric (un-normal-mapped) normal, for horizon occlusion
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
	float NdotVUnclamped = dot(N, V);
	float NdotV = max(NdotVUnclamped, 1e-4);
	float NdotH = max(dot(N, H), 0.0);
	float VdotH = max(dot(V, H), 0.0);

	vec3 F0 = mix(vec3_splat(0.04), albedo, metallic);
	// Babylon surfaceAlbedo: baseColor·(1−dielectricF0)·(1−metallic) (dielectricF0 = 0.04).
	vec3 diffuseColor = albedo * 0.96 * (1.0 - metallic);

	float D = distributionGGX(NdotH, roughness * roughness);
	float G = geometrySmith(NdotV, NdotL, roughness);
	vec3 F = fresnelSchlick(VdotH, F0);
	vec3 spec = (D * G) * F / max(4.0 * NdotV * NdotL, 1e-4);
	vec3 kd = (vec3_splat(1.0) - F) * (1.0 - metallic);

	vec3 direct = (kd * diffuseColor / PI + spec) * u_lightColor.rgb * NdotL;

	vec3 ambient;
	if (u_envParams.z > 0.5) {
		// Image-based lighting — matches Babylon Lite's pbr-mr-helper IBL.
		// Diffuse: SH irradiance × surface albedo × occlusion.
		vec3 irr = max(shIrradiance(N), vec3_splat(0.0));
		vec3 diffuseIBL = irr * diffuseColor * occlusion;

		// Specular: prefiltered cube sampled at a roughness-derived LOD using Babylon's
		// formula  specLod = log2(cubemapDim · alphaG) · lodGenerationScale  (alphaG =
		// roughness²). Our previous lod = roughness·(numMips−1) under-blurred mid-roughness
		// surfaces, reading a too-sharp mip → reflections looked too shiny/mirror-like.
		float alphaG = roughness * roughness;
		float maxLod = max(u_envParams.x - 1.0, 0.0);
		float cubemapDim = exp2(maxLod);
		float specLod = clamp(log2(cubemapDim * alphaG) * u_envParams2.x, 0.0, maxLod);
		vec3 R = reflect(-V, N);
		vec3 prefiltered = textureCubeLod(s_envSpecular, R, specLod).rgb;

		// Split-sum env BRDF (analytic) weighted by specular occlusion (seo) + horizon
		// occlusion (eho) — Babylon reduces the environment reflectance with both.
		vec2 ab = envBRDFApprox(NdotV, roughness);
		vec3 specReflectance = F0 * ab.x + vec3_splat(ab.y);
		float seo = clamp((NdotVUnclamped + occlusion) * (NdotVUnclamped + occlusion) - 1.0 + occlusion, 0.0, 1.0);
		float gf = dot(geoN, V) > 0.0 ? 1.0 : -1.0;
		float ehoT = clamp(1.0 + 1.1 * dot(R, geoN * gf), 0.0, 1.0);
		float eho = ehoT * ehoT;
		vec3 specularIBL = prefiltered * specReflectance * seo * eho;

		ambient = (diffuseIBL + specularIBL) * u_envParams.y;
	} else {
		// Hemispheric ambient fallback (no environment bound).
		vec3 ambColor = mix(u_ambientGround.rgb, u_ambientSky.rgb, N.y * 0.5 + 0.5);
		ambient = diffuseColor * ambColor * occlusion + F0 * ambColor * 0.5;
	}

	vec3 color = direct + ambient + emissive;

	if (u_envParams.z > 0.5) {
		// Babylon image-processing: exposure → standard tonemap → gamma → clamp → contrast.
		color = max(color, vec3_splat(0.0)) * u_envParams.w;          // exposure
		color = vec3_splat(1.0) - exp2(-1.590579 * color);            // standard exponential tonemap
		color = pow(max(color, vec3_splat(0.0)), vec3_splat(0.45454545)); // gamma encode
		color = clamp(color, vec3_splat(0.0), vec3_splat(1.0));
		vec3 highContrast = color * color * (vec3_splat(3.0) - color * 2.0);
		color = mix(color, highContrast, max(u_envParams2.y - 1.0, 0.0)); // contrast (>1)
	} else {
		// Reinhard fallback for non-IBL scenes (unchanged behaviour).
		color = color / (color + vec3_splat(1.0));
		color = pow(color, vec3_splat(1.0 / 2.2));
	}

	gl_FragColor = vec4(color, baseColor.a);
}

