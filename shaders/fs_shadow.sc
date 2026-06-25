$input v_sdepth

// Shadow caster (depth) fragment stage: write the cascade-space depth into the R32F
// shadow atlas. The receiver compares this against its own projected depth (with bias).

#include <bgfx_shader.sh>

void main()
{
	gl_FragColor = vec4(v_sdepth.x, 0.0, 0.0, 1.0);
}
