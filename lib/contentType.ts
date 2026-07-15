// Urutan nama tipe berdasarkan depth (0 = top level).
// Depth yang lebih dalam dari daftar ini akan memakai nama terakhir.
export const TYPE_BY_DEPTH = ["service", "service_category", "service_detail"];

export function typeForDepth(depth: number): string {
    return TYPE_BY_DEPTH[depth] ?? TYPE_BY_DEPTH[TYPE_BY_DEPTH.length - 1];
}