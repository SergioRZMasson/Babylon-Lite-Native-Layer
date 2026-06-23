$input v_normal, v_wpos

// Standard-material fragment stage, hand-ported from Babylon-Lite
// material/standard/standard-template.ts. This implements the HEMISPHERIC light
// path (Lite light type 3 in computeLighting) plus the final colour assembly:
//
//   nl   = 0.5 + 0.5 * dot(N, Ldir)
//   diff = mix(groundColor, diffuseColor, nl)
//   h    = normalize(viewDir + Ldir);  s = pow(max(0,dot(N,h)), max(1, glossiness))
//   finalDiffuse  = clamp(diff * matDiffuse, 0, 1) * baseColor   (baseColor=1, no diffuse texture)
//   finalSpecular = s * specularColor
//   color = finalDiffuse + finalSpecular
//
// Emissive/ambient/reflection/fog are zero for the default createStandardMaterial()
// cube, so they are omitted here (they are additional fragments in the real engine).

#include <bgfx_shader.sh>

uniform vec4 u_lightDir;     // xyz = direction to light (Lite vLightData.xyz)
uniform vec4 u_lightDiffuse; // rgb = diffuse colour * intensity
uniform vec4 u_lightGround;  // rgb = hemispheric ground colour
uniform vec4 u_diffuseColor; // rgb = material diffuse, a = alpha
uniform vec4 u_specular;     // rgb = specular colour, a = glossiness
uniform vec4 u_eyePos;       // xyz = camera world position

void main()
{
	vec3 N = normalize(v_normal);
	vec3 viewDir = normalize(u_eyePos.xyz - v_wpos);
	vec3 Ldir = normalize(u_lightDir.xyz);

	float nl = 0.5 + 0.5 * dot(N, Ldir);
	vec3 diff = mix(u_lightGround.xyz, u_lightDiffuse.xyz, nl);

	vec3 h = normalize(viewDir + Ldir);
	float s = pow(max(0.0, dot(N, h)), max(1.0, u_specular.w));

	vec3 finalDiffuse = clamp(diff * u_diffuseColor.xyz, 0.0, 1.0);
	vec3 finalSpecular = s * u_specular.xyz;

	vec3 color = finalDiffuse + finalSpecular;
	gl_FragColor = vec4(color, u_diffuseColor.w);
}
