/* tslint:disable */
/* eslint-disable */

export class Color {
    free(): void;
    [Symbol.dispose](): void;
    static fromHex(hex: string): Color;
    constructor(red: number, green: number, blue: number, alpha: number);
    toHex(): string;
    readonly alpha: number;
    readonly blue: number;
    readonly green: number;
    readonly red: number;
}

export class Node {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    addChild(options: any): Node;
    children(): Node[];
    readonly colorHex: string;
    readonly drawIndex: number;
    readonly length: number;
    readonly localAngle: number;
    readonly nodeType: number;
    readonly scale: number;
    readonly thickness: number;
    readonly useSegmentColor: boolean;
    readonly useSegmentScale: boolean;
}

export class Stickfigure {
    free(): void;
    [Symbol.dispose](): void;
    addPolyfill(options: any): void;
    allNodeIndices(): Int32Array;
    static fromBytes(bytes: Uint8Array): Stickfigure;
    getNode(idx: number): Node;
    constructor();
    rootNode(): Node;
    setVersion(v: number): void;
    toBytes(): Uint8Array;
    build: number;
    colorHex: string;
    scale: number;
    readonly version: number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_color_free: (a: number, b: number) => void;
    readonly __wbg_node_free: (a: number, b: number) => void;
    readonly __wbg_stickfigure_free: (a: number, b: number) => void;
    readonly color_alpha: (a: number) => number;
    readonly color_blue: (a: number) => number;
    readonly color_fromHex: (a: number, b: number) => [number, number, number];
    readonly color_green: (a: number) => number;
    readonly color_new: (a: number, b: number, c: number, d: number) => number;
    readonly color_red: (a: number) => number;
    readonly color_toHex: (a: number) => [number, number];
    readonly node_addChild: (a: number, b: any) => [number, number, number];
    readonly node_children: (a: number) => [number, number];
    readonly node_colorHex: (a: number) => [number, number];
    readonly node_drawIndex: (a: number) => number;
    readonly node_length: (a: number) => number;
    readonly node_localAngle: (a: number) => number;
    readonly node_nodeType: (a: number) => number;
    readonly node_scale: (a: number) => number;
    readonly node_thickness: (a: number) => number;
    readonly node_useSegmentColor: (a: number) => number;
    readonly node_useSegmentScale: (a: number) => number;
    readonly stickfigure_addPolyfill: (a: number, b: any) => [number, number];
    readonly stickfigure_allNodeIndices: (a: number) => [number, number];
    readonly stickfigure_build: (a: number) => number;
    readonly stickfigure_colorHex: (a: number) => [number, number];
    readonly stickfigure_fromBytes: (a: number, b: number) => [number, number, number];
    readonly stickfigure_getNode: (a: number, b: number) => [number, number, number];
    readonly stickfigure_new: () => number;
    readonly stickfigure_rootNode: (a: number) => number;
    readonly stickfigure_scale: (a: number) => number;
    readonly stickfigure_setVersion: (a: number, b: number) => void;
    readonly stickfigure_set_build: (a: number, b: number) => void;
    readonly stickfigure_set_colorHex: (a: number, b: number, c: number) => [number, number];
    readonly stickfigure_set_scale: (a: number, b: number) => void;
    readonly stickfigure_toBytes: (a: number) => [number, number, number, number];
    readonly stickfigure_version: (a: number) => number;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
