// Texture factories (subset of src/texture). createSolidTexture2D builds a 1×1 native
// texture from a linear RGB triple — used by PBR scenes for constant baseColor/ORM maps.

export function createSolidTexture2D(_engine: any, r?: number, g?: number, b?: number): any {
    return { _id: __bl_createSolidTexture(r == null ? 1 : r, g == null ? 1 : g, b == null ? 1 : b), _kind: "texture" };
}
