$input a_position, a_normal, a_texcoord0, a_tangent
$output v_normal, v_wpos, v_uv, v_tangent

// PBR vertex stage: world position/normal/tangent + UV passthrough.

#include <bgfx_shader.sh>

void main()
{
	vec4 wpos = mul(u_model[0], vec4(a_position, 1.0));
	v_wpos = wpos.xyz;

	mat3 nm = mat3(u_model[0][0].xyz, u_model[0][1].xyz, u_model[0][2].xyz);
	v_normal = normalize(mul(nm, a_normal));
	v_tangent = vec4(normalize(mul(nm, a_tangent.xyz)), a_tangent.w);
	v_uv = a_texcoord0;

	gl_Position = mul(u_modelViewProj, vec4(a_position, 1.0));
}
