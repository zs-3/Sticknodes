/* tslint:disable */
/* eslint-disable */

export class Color {
    free(): void;
    [Symbol.dispose](): void;
    static fromHex(hex: string): Color;
    static fromRgb(red: number, green: number, blue: number): Color;
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
    addSibling(options: any): Node;
    children(): Node[];
    delete(): void;
    getAncestorIndices(): Int32Array;
    getConnectorEndIndex(): number | undefined;
    getConnectorLocalX(): number | undefined;
    getConnectorLocalY(): number | undefined;
    getConnectorMethod(): number | undefined;
    getConnectorPercentDefault(): number | undefined;
    getConnectorPercent(): number | undefined;
    getConnectorReversed(): boolean;
    getConnectorSmartStretchAncestralValue(): number | undefined;
    getConnectorValue(): number | undefined;
    getDescendantIndices(): Int32Array;
    getDisplayColorHex(): string;
    getEffectiveThickness(): number;
    getGlobalAngle(): number;
    getGlobalEnd(): Float32Array;
    getGlobalStart(): Float32Array;
    getLocalX(): number;
    getLocalY(): number;
    getNodeOptions(): any;
    getParentIndex(): number | undefined;
    getSiblingIndices(): Int32Array;
    getTrapezoidThicknessEnd(): number;
    getTrapezoidThicknessStart(): number;
    readonly angleLockIsMainNode: boolean;
    readonly angleLockMode: number;
    readonly angleLockOffset: number;
    readonly angleLockRelativeMultiplier: number;
    circleIsHollow: boolean;
    circleOutlineColorHex: string;
    colorHex: string;
    curveCirculization: boolean;
    defaultAngle: number;
    defaultLength: number;
    defaultLocalAngle: number;
    defaultThickness: number;
    doNotApplySmartStretch: boolean;
    readonly dragLockAngle: number;
    readonly drawIndex: number;
    gradientColorHex: string;
    readonly gradientMode: number;
    halfArc: boolean;
    readonly hasConnector: boolean;
    readonly isAngleLocked: boolean;
    isDragLocked: boolean;
    isFloaty: boolean;
    isSmartStretch: boolean;
    isStatic: boolean;
    isStretchy: boolean;
    length: number;
    localAngle: number;
    nodeType: number;
    readonly numPolygonVertices: number;
    reverseGradient: boolean;
    scale: number;
    readonly segmentCurvePolyfillPrecision: number;
    readonly segmentCurveRadiusAndDefaultCurveRadius: number;
    smartStretchResetImpulse: boolean;
    thickness: number;
    trapezoidIsRoundedEnd: boolean;
    trapezoidIsRoundedStart: boolean;
    triangleFlipped: boolean;
    triangleUpsideDown: boolean;
    useCircleOutline: boolean;
    useGradient: boolean;
    useSegmentColor: boolean;
    useSegmentScale: boolean;
    readonly smartStretchMultiplier: number;
    readonly trapezoidThicknessEnd: number;
    readonly trapezoidThicknessStart: number;
    readonly trapezoidTopThicknessRatio: number;
    readonly triangleType: number;
    readonly useTrapezoidThicknessEnd: boolean;
    readonly useTrapezoidThicknessStart: boolean;
}

export class PolyfillData {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly anchorDrawIndex: number;
    readonly attached: Int32Array;
    readonly colorHex: string;
    readonly usePolyfillColor: boolean;
}

export function SUPPORTED_BUILD(): number;

export function SUPPORTED_VERSION(): number;

export class Stickfigure {
    free(): void;
    [Symbol.dispose](): void;
    addPolyfill(options: any): void;
    allNodeIndices(): Int32Array;
    allNodes(): Node[];
    allPolyfills(): PolyfillData[];
    changeDrawIndex(from: number, to: number): void;
    drawIndexExists(idx: number): boolean;
    drawIndexIsPolyfillAnchor(idx: number): boolean;
    static fromBytes(bytes: Uint8Array): Stickfigure;
    static fromVersionAndBuild(version: number, build: number): Stickfigure;
    getChildrenRecursive(idx: number): Int32Array;
    getChildren(idx: number): Int32Array;
    getNode(idx: number): Node;
    getParent(idx: number): number | undefined;
    getParentsRecursive(idx: number): Int32Array;
    getPolyfillVertices(anchor: number): Float32Array;
    getSiblings(idx: number): Int32Array;
    missingDrawIndices(indices: Int32Array): Int32Array;
    constructor();
    removeNode(idx: number): void;
    removePolyfill(anchor: number): void;
    rootNode(): Node;
    setNodeLimitEnabled(enabled: boolean): void;
    setVersion(v: number): void;
    toBytes(): Uint8Array;
    toJsObject(): any;
    build: number;
    colorHex: string;
    scale: number;
    readonly version: number;
}

export function nodeTypeFromInt(v: number): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly SUPPORTED_BUILD: () => number;
    readonly SUPPORTED_VERSION: () => number;
    readonly __wbg_color_free: (a: number, b: number) => void;
    readonly __wbg_node_free: (a: number, b: number) => void;
    readonly __wbg_polyfilldata_free: (a: number, b: number) => void;
    readonly __wbg_stickfigure_free: (a: number, b: number) => void;
    readonly color_alpha: (a: number) => number;
    readonly color_blue: (a: number) => number;
    readonly color_fromHex: (a: number, b: number) => [number, number, number];
    readonly color_fromRgb: (a: number, b: number, c: number) => number;
    readonly color_green: (a: number) => number;
    readonly color_new: (a: number, b: number, c: number, d: number) => number;
    readonly color_red: (a: number) => number;
    readonly color_toHex: (a: number) => [number, number];
    readonly nodeTypeFromInt: (a: number) => [number, number];
    readonly node_addChild: (a: number, b: any) => [number, number, number];
    readonly node_addSibling: (a: number, b: any) => [number, number, number];
    readonly node_angleLockIsMainNode: (a: number) => number;
    readonly node_angleLockMode: (a: number) => number;
    readonly node_angleLockOffset: (a: number) => number;
    readonly node_angleLockRelativeMultiplier: (a: number) => number;
    readonly node_children: (a: number) => [number, number];
    readonly node_circleIsHollow: (a: number) => number;
    readonly node_circleOutlineColorHex: (a: number) => [number, number];
    readonly node_colorHex: (a: number) => [number, number];
    readonly node_curveCirculization: (a: number) => number;
    readonly node_defaultAngle: (a: number) => number;
    readonly node_defaultLength: (a: number) => number;
    readonly node_defaultLocalAngle: (a: number) => number;
    readonly node_defaultThickness: (a: number) => number;
    readonly node_delete: (a: number) => [number, number];
    readonly node_doNotApplySmartStretch: (a: number) => number;
    readonly node_dragLockAngle: (a: number) => number;
    readonly node_drawIndex: (a: number) => number;
    readonly node_getAncestorIndices: (a: number) => [number, number];
    readonly node_getConnectorEndIndex: (a: number) => number;
    readonly node_getConnectorLocalX: (a: number) => number;
    readonly node_getConnectorLocalY: (a: number) => number;
    readonly node_getConnectorMethod: (a: number) => number;
    readonly node_getConnectorPercent: (a: number) => number;
    readonly node_getConnectorPercentDefault: (a: number) => number;
    readonly node_getConnectorReversed: (a: number) => number;
    readonly node_getConnectorSmartStretchAncestralValue: (a: number) => number;
    readonly node_getConnectorValue: (a: number) => number;
    readonly node_getDescendantIndices: (a: number) => [number, number];
    readonly node_getDisplayColorHex: (a: number) => [number, number];
    readonly node_getEffectiveThickness: (a: number) => number;
    readonly node_getGlobalAngle: (a: number) => number;
    readonly node_getGlobalEnd: (a: number) => [number, number];
    readonly node_getGlobalStart: (a: number) => [number, number];
    readonly node_getLocalX: (a: number) => number;
    readonly node_getLocalY: (a: number) => number;
    readonly node_getNodeOptions: (a: number) => [number, number, number];
    readonly node_getParentIndex: (a: number) => number;
    readonly node_getSiblingIndices: (a: number) => [number, number];
    readonly node_getTrapezoidThicknessEnd: (a: number) => number;
    readonly node_getTrapezoidThicknessStart: (a: number) => number;
    readonly node_gradientColorHex: (a: number) => [number, number];
    readonly node_gradientMode: (a: number) => number;
    readonly node_halfArc: (a: number) => number;
    readonly node_hasConnector: (a: number) => number;
    readonly node_isAngleLocked: (a: number) => number;
    readonly node_isDragLocked: (a: number) => number;
    readonly node_isFloaty: (a: number) => number;
    readonly node_isSmartStretch: (a: number) => number;
    readonly node_isStatic: (a: number) => number;
    readonly node_isStretchy: (a: number) => number;
    readonly node_length: (a: number) => number;
    readonly node_localAngle: (a: number) => number;
    readonly node_nodeType: (a: number) => number;
    readonly node_numPolygonVertices: (a: number) => number;
    readonly node_reverseGradient: (a: number) => number;
    readonly node_scale: (a: number) => number;
    readonly node_segmentCurvePolyfillPrecision: (a: number) => number;
    readonly node_segmentCurveRadiusAndDefaultCurveRadius: (a: number) => number;
    readonly node_set_circleIsHollow: (a: number, b: number) => void;
    readonly node_set_circleOutlineColorHex: (a: number, b: number, c: number) => [number, number];
    readonly node_set_colorHex: (a: number, b: number, c: number) => [number, number];
    readonly node_set_curveCirculization: (a: number, b: number) => void;
    readonly node_set_defaultAngle: (a: number, b: number) => void;
    readonly node_set_defaultLength: (a: number, b: number) => void;
    readonly node_set_defaultLocalAngle: (a: number, b: number) => void;
    readonly node_set_defaultThickness: (a: number, b: number) => void;
    readonly node_set_doNotApplySmartStretch: (a: number, b: number) => void;
    readonly node_set_gradientColorHex: (a: number, b: number, c: number) => [number, number];
    readonly node_set_halfArc: (a: number, b: number) => void;
    readonly node_set_isDragLocked: (a: number, b: number) => void;
    readonly node_set_isFloaty: (a: number, b: number) => void;
    readonly node_set_isSmartStretch: (a: number, b: number) => void;
    readonly node_set_isStatic: (a: number, b: number) => void;
    readonly node_set_isStretchy: (a: number, b: number) => void;
    readonly node_set_length: (a: number, b: number) => void;
    readonly node_set_localAngle: (a: number, b: number) => void;
    readonly node_set_nodeType: (a: number, b: number) => void;
    readonly node_set_reverseGradient: (a: number, b: number) => void;
    readonly node_set_scale: (a: number, b: number) => void;
    readonly node_set_smartStretchResetImpulse: (a: number, b: number) => void;
    readonly node_set_thickness: (a: number, b: number) => void;
    readonly node_set_trapezoidIsRoundedEnd: (a: number, b: number) => void;
    readonly node_set_trapezoidIsRoundedStart: (a: number, b: number) => void;
    readonly node_set_triangleFlipped: (a: number, b: number) => void;
    readonly node_set_triangleUpsideDown: (a: number, b: number) => void;
    readonly node_set_useCircleOutline: (a: number, b: number) => void;
    readonly node_set_useGradient: (a: number, b: number) => void;
    readonly node_set_useSegmentColor: (a: number, b: number) => void;
    readonly node_set_useSegmentScale: (a: number, b: number) => void;
    readonly node_smartStretchMultiplier: (a: number) => number;
    readonly node_smartStretchResetImpulse: (a: number) => number;
    readonly node_thickness: (a: number) => number;
    readonly node_trapezoidIsRoundedEnd: (a: number) => number;
    readonly node_trapezoidIsRoundedStart: (a: number) => number;
    readonly node_trapezoidThicknessEnd: (a: number) => number;
    readonly node_trapezoidThicknessStart: (a: number) => number;
    readonly node_trapezoidTopThicknessRatio: (a: number) => number;
    readonly node_triangleFlipped: (a: number) => number;
    readonly node_triangleType: (a: number) => number;
    readonly node_triangleUpsideDown: (a: number) => number;
    readonly node_useCircleOutline: (a: number) => number;
    readonly node_useGradient: (a: number) => number;
    readonly node_useSegmentColor: (a: number) => number;
    readonly node_useSegmentScale: (a: number) => number;
    readonly node_useTrapezoidThicknessEnd: (a: number) => number;
    readonly node_useTrapezoidThicknessStart: (a: number) => number;
    readonly polyfilldata_anchorDrawIndex: (a: number) => number;
    readonly polyfilldata_attached: (a: number) => [number, number];
    readonly polyfilldata_colorHex: (a: number) => [number, number];
    readonly polyfilldata_usePolyfillColor: (a: number) => number;
    readonly stickfigure_addPolyfill: (a: number, b: any) => [number, number];
    readonly stickfigure_allNodeIndices: (a: number) => [number, number];
    readonly stickfigure_allNodes: (a: number) => [number, number];
    readonly stickfigure_allPolyfills: (a: number) => [number, number];
    readonly stickfigure_build: (a: number) => number;
    readonly stickfigure_changeDrawIndex: (a: number, b: number, c: number) => [number, number];
    readonly stickfigure_colorHex: (a: number) => [number, number];
    readonly stickfigure_drawIndexExists: (a: number, b: number) => number;
    readonly stickfigure_drawIndexIsPolyfillAnchor: (a: number, b: number) => number;
    readonly stickfigure_fromBytes: (a: number, b: number) => [number, number, number];
    readonly stickfigure_fromVersionAndBuild: (a: number, b: number) => [number, number, number];
    readonly stickfigure_getChildren: (a: number, b: number) => [number, number];
    readonly stickfigure_getChildrenRecursive: (a: number, b: number) => [number, number];
    readonly stickfigure_getNode: (a: number, b: number) => [number, number, number];
    readonly stickfigure_getParent: (a: number, b: number) => number;
    readonly stickfigure_getParentsRecursive: (a: number, b: number) => [number, number];
    readonly stickfigure_getPolyfillVertices: (a: number, b: number) => [number, number, number, number];
    readonly stickfigure_getSiblings: (a: number, b: number) => [number, number];
    readonly stickfigure_missingDrawIndices: (a: number, b: number, c: number) => [number, number];
    readonly stickfigure_new: () => number;
    readonly stickfigure_removeNode: (a: number, b: number) => [number, number];
    readonly stickfigure_removePolyfill: (a: number, b: number) => [number, number];
    readonly stickfigure_rootNode: (a: number) => number;
    readonly stickfigure_scale: (a: number) => number;
    readonly stickfigure_setNodeLimitEnabled: (a: number, b: number) => void;
    readonly stickfigure_setVersion: (a: number, b: number) => void;
    readonly stickfigure_set_build: (a: number, b: number) => void;
    readonly stickfigure_set_colorHex: (a: number, b: number, c: number) => [number, number];
    readonly stickfigure_set_scale: (a: number, b: number) => void;
    readonly stickfigure_toBytes: (a: number) => [number, number, number, number];
    readonly stickfigure_toJsObject: (a: number) => [number, number, number];
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
