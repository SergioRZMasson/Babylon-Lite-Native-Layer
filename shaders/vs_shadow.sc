$input a_position
$output v_sdepth

// Shadow caster (depth) vertex stage. The cascade's light view+proj is bound per shadow
// view via bgfx::setViewTransform, and the per-caster world via bgfx::setTransform, so
// u_modelViewProj = lightProj * lightView * world. We pass the projected depth to the
// fragment stage to write into the R32F shadow atlas.

#include <bgfx_shader.sh>

void main()
{
	vec4 clip = mul(u_modelViewProj, vec4(a_position, 1.0));
	gl_Position = clip;
	v_sdepth = vec4(clip.z / clip.w, 0.0, 0.0, 0.0);
}
