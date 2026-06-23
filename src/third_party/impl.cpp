// Single translation unit for the vendored stb_image (PNG/JPEG decode for textures).
// glTF parsing now happens in JS (mirroring Babylon-Lite), so cgltf is no longer used.
#define STB_IMAGE_IMPLEMENTATION
#define STBI_ONLY_PNG
#define STBI_ONLY_JPEG
#define STBI_NO_STDIO
#include "stb_image.h"
