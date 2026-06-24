$input a_position, a_normal, a_texcoord0, a_tangent, a_indices, a_weight
$output v_normal, v_wpos, v_uv, v_tangent

// Skinned PBR vertex stage. The bone palette u_bones[j] = invMeshWorld * jointWorld * IBM
// (computed natively each frame, see lite.cpp). The weighted bone matrix transforms the
// mesh-local vertex; u_model[0] (mesh world) then places it in world space. Pairs with
// fs_pbr (same varyings).

#include <bgfx_shader.sh>

uniform mat4 u_bones[128];

void main()
{
	mat4 skin =
		  a_weight.x * u_bones[int(a_indices.x)]
		+ a_weight.y * u_bones[int(a_indices.y)]
		+ a_weight.z * u_bones[int(a_indices.z)]
		+ a_weight.w * u_bones[int(a_indices.w)];

	vec4 lpos = mul(skin, vec4(a_position, 1.0));   // mesh-local, skinned
	vec4 wpos = mul(u_model[0], lpos);              // mesh world
	v_wpos = wpos.xyz;

	mat3 sm = mat3(skin[0].xyz, skin[1].xyz, skin[2].xyz);
	mat3 nm = mat3(u_model[0][0].xyz, u_model[0][1].xyz, u_model[0][2].xyz);
	v_normal = normalize(mul(nm, mul(sm, a_normal)));
	v_tangent = vec4(normalize(mul(nm, mul(sm, a_tangent.xyz))), a_tangent.w);
	v_uv = a_texcoord0;

	gl_Position = mul(u_viewProj, wpos);
}
