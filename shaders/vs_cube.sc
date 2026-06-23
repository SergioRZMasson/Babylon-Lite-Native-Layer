$input a_position, a_normal
$output v_normal, v_wpos

// Standard-material vertex stage, hand-ported from Babylon-Lite
// material/standard/standard-template.ts (the WGSL _vertexTemplate):
//   worldPos = world * position; vn = normalize(world3x3 * normal); clip = viewProj * worldPos
// Here u_model[0] is the per-draw world matrix (bgfx::setTransform) and
// u_modelViewProj / u_viewProj are bgfx built-ins from bgfx::setViewTransform.

#include <bgfx_shader.sh>

void main()
{
	vec4 wpos = mul(u_model[0], vec4(a_position, 1.0));
	v_wpos = wpos.xyz;

	mat3 nmat = mat3(
		u_model[0][0].xyz,
		u_model[0][1].xyz,
		u_model[0][2].xyz);
	v_normal = normalize(mul(nmat, a_normal));

	gl_Position = mul(u_modelViewProj, vec4(a_position, 1.0));
}
