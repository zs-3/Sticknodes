/* @ts-self-types="./sticknodes_rs.d.ts" */

export class Color {
    static __wrap(ptr) {
        const obj = Object.create(Color.prototype);
        obj.__wbg_ptr = ptr;
        ColorFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ColorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_color_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get alpha() {
        const ret = wasm.color_alpha(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get blue() {
        const ret = wasm.color_blue(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {string} hex
     * @returns {Color}
     */
    static fromHex(hex) {
        const ptr0 = passStringToWasm0(hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.color_fromHex(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Color.__wrap(ret[0]);
    }
    /**
     * @param {number} red
     * @param {number} green
     * @param {number} blue
     * @returns {Color}
     */
    static fromRgb(red, green, blue) {
        const ret = wasm.color_fromRgb(red, green, blue);
        return Color.__wrap(ret);
    }
    /**
     * @returns {number}
     */
    get green() {
        const ret = wasm.color_green(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} red
     * @param {number} green
     * @param {number} blue
     * @param {number} alpha
     */
    constructor(red, green, blue, alpha) {
        const ret = wasm.color_new(red, green, blue, alpha);
        this.__wbg_ptr = ret;
        ColorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    get red() {
        const ret = wasm.color_red(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    toHex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.color_toHex(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) Color.prototype[Symbol.dispose] = Color.prototype.free;

export class Node {
    static __wrap(ptr) {
        const obj = Object.create(Node.prototype);
        obj.__wbg_ptr = ptr;
        NodeFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        NodeFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_node_free(ptr, 0);
    }
    /**
     * @param {any} options
     * @returns {Node}
     */
    addChild(options) {
        const ret = wasm.node_addChild(this.__wbg_ptr, options);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Node.__wrap(ret[0]);
    }
    /**
     * @param {any} options
     * @returns {Node}
     */
    addSibling(options) {
        const ret = wasm.node_addSibling(this.__wbg_ptr, options);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Node.__wrap(ret[0]);
    }
    /**
     * @returns {boolean}
     */
    get angleLockIsMainNode() {
        const ret = wasm.node_angleLockIsMainNode(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get angleLockMode() {
        const ret = wasm.node_angleLockMode(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get angleLockOffset() {
        const ret = wasm.node_angleLockOffset(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get angleLockRelativeMultiplier() {
        const ret = wasm.node_angleLockRelativeMultiplier(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Node[]}
     */
    children() {
        const ret = wasm.node_children(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]);
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {boolean}
     */
    get circleIsHollow() {
        const ret = wasm.node_circleIsHollow(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {string}
     */
    get circleOutlineColorHex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.node_circleOutlineColorHex(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get colorHex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.node_colorHex(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {boolean}
     */
    get curveCirculization() {
        const ret = wasm.node_curveCirculization(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get defaultAngle() {
        const ret = wasm.node_defaultAngle(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get defaultLength() {
        const ret = wasm.node_defaultLength(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get defaultLocalAngle() {
        const ret = wasm.node_defaultLocalAngle(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get defaultThickness() {
        const ret = wasm.node_defaultThickness(this.__wbg_ptr);
        return ret;
    }
    delete() {
        const ret = wasm.node_delete(this.__wbg_ptr);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @returns {boolean}
     */
    get doNotApplySmartStretch() {
        const ret = wasm.node_doNotApplySmartStretch(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get dragLockAngle() {
        const ret = wasm.node_dragLockAngle(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get drawIndex() {
        const ret = wasm.node_drawIndex(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Int32Array}
     */
    getAncestorIndices() {
        const ret = wasm.node_getAncestorIndices(this.__wbg_ptr);
        var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {number | undefined}
     */
    getConnectorEndIndex() {
        const ret = wasm.node_getConnectorEndIndex(this.__wbg_ptr);
        return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
    }
    /**
     * @returns {number | undefined}
     */
    getConnectorLocalX() {
        const ret = wasm.node_getConnectorLocalX(this.__wbg_ptr);
        return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
    }
    /**
     * @returns {number | undefined}
     */
    getConnectorLocalY() {
        const ret = wasm.node_getConnectorLocalY(this.__wbg_ptr);
        return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
    }
    /**
     * @returns {number | undefined}
     */
    getConnectorMethod() {
        const ret = wasm.node_getConnectorMethod(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret;
    }
    /**
     * @returns {number | undefined}
     */
    getConnectorPercentDefault() {
        const ret = wasm.node_getConnectorPercentDefault(this.__wbg_ptr);
        return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
    }
    /**
     * @returns {number | undefined}
     */
    getConnectorPercent() {
        const ret = wasm.node_getConnectorPercent(this.__wbg_ptr);
        return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
    }
    /**
     * @returns {boolean}
     */
    getConnectorReversed() {
        const ret = wasm.node_getConnectorReversed(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number | undefined}
     */
    getConnectorSmartStretchAncestralValue() {
        const ret = wasm.node_getConnectorSmartStretchAncestralValue(this.__wbg_ptr);
        return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
    }
    /**
     * @returns {number | undefined}
     */
    getConnectorValue() {
        const ret = wasm.node_getConnectorValue(this.__wbg_ptr);
        return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
    }
    /**
     * @returns {Int32Array}
     */
    getDescendantIndices() {
        const ret = wasm.node_getDescendantIndices(this.__wbg_ptr);
        var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {string}
     */
    getDisplayColorHex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.node_getDisplayColorHex(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    getEffectiveThickness() {
        const ret = wasm.node_getEffectiveThickness(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    getGlobalAngle() {
        const ret = wasm.node_getGlobalAngle(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Float32Array}
     */
    getGlobalEnd() {
        const ret = wasm.node_getGlobalEnd(this.__wbg_ptr);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {Float32Array}
     */
    getGlobalStart() {
        const ret = wasm.node_getGlobalStart(this.__wbg_ptr);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {number}
     */
    getLocalX() {
        const ret = wasm.node_getLocalX(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    getLocalY() {
        const ret = wasm.node_getLocalY(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {any}
     */
    getNodeOptions() {
        const ret = wasm.node_getNodeOptions(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @returns {number | undefined}
     */
    getParentIndex() {
        const ret = wasm.node_getParentIndex(this.__wbg_ptr);
        return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
    }
    /**
     * @returns {Int32Array}
     */
    getSiblingIndices() {
        const ret = wasm.node_getSiblingIndices(this.__wbg_ptr);
        var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {number}
     */
    getTrapezoidThicknessEnd() {
        const ret = wasm.node_getTrapezoidThicknessEnd(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    getTrapezoidThicknessStart() {
        const ret = wasm.node_getTrapezoidThicknessStart(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get gradientColorHex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.node_gradientColorHex(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get gradientMode() {
        const ret = wasm.node_gradientMode(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get halfArc() {
        const ret = wasm.node_halfArc(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get hasConnector() {
        const ret = wasm.node_hasConnector(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get isAngleLocked() {
        const ret = wasm.node_isAngleLocked(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get isDragLocked() {
        const ret = wasm.node_isDragLocked(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get isFloaty() {
        const ret = wasm.node_isFloaty(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get isSmartStretch() {
        const ret = wasm.node_isSmartStretch(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get isStatic() {
        const ret = wasm.node_isStatic(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get isStretchy() {
        const ret = wasm.node_isStretchy(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get length() {
        const ret = wasm.node_length(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get localAngle() {
        const ret = wasm.node_localAngle(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get nodeType() {
        const ret = wasm.node_nodeType(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get numPolygonVertices() {
        const ret = wasm.node_numPolygonVertices(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get reverseGradient() {
        const ret = wasm.node_reverseGradient(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get scale() {
        const ret = wasm.node_scale(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get segmentCurvePolyfillPrecision() {
        const ret = wasm.node_segmentCurvePolyfillPrecision(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get segmentCurveRadiusAndDefaultCurveRadius() {
        const ret = wasm.node_segmentCurveRadiusAndDefaultCurveRadius(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {boolean} v
     */
    set circleIsHollow(v) {
        wasm.node_set_circleIsHollow(this.__wbg_ptr, v);
    }
    /**
     * @param {string} hex
     */
    set circleOutlineColorHex(hex) {
        const ptr0 = passStringToWasm0(hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.node_set_circleOutlineColorHex(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @param {string} hex
     */
    set colorHex(hex) {
        const ptr0 = passStringToWasm0(hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.node_set_colorHex(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @param {boolean} v
     */
    set curveCirculization(v) {
        wasm.node_set_curveCirculization(this.__wbg_ptr, v);
    }
    /**
     * @param {number} v
     */
    set defaultAngle(v) {
        wasm.node_set_defaultAngle(this.__wbg_ptr, v);
    }
    /**
     * @param {number} v
     */
    set defaultLength(v) {
        wasm.node_set_defaultLength(this.__wbg_ptr, v);
    }
    /**
     * @param {number} v
     */
    set defaultLocalAngle(v) {
        wasm.node_set_defaultLocalAngle(this.__wbg_ptr, v);
    }
    /**
     * @param {number} v
     */
    set defaultThickness(v) {
        wasm.node_set_defaultThickness(this.__wbg_ptr, v);
    }
    /**
     * @param {boolean} v
     */
    set doNotApplySmartStretch(v) {
        wasm.node_set_doNotApplySmartStretch(this.__wbg_ptr, v);
    }
    /**
     * @param {string} hex
     */
    set gradientColorHex(hex) {
        const ptr0 = passStringToWasm0(hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.node_set_gradientColorHex(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @param {boolean} v
     */
    set halfArc(v) {
        wasm.node_set_halfArc(this.__wbg_ptr, v);
    }
    /**
     * @param {boolean} v
     */
    set isDragLocked(v) {
        wasm.node_set_isDragLocked(this.__wbg_ptr, v);
    }
    /**
     * @param {boolean} v
     */
    set isFloaty(v) {
        wasm.node_set_isFloaty(this.__wbg_ptr, v);
    }
    /**
     * @param {boolean} v
     */
    set isSmartStretch(v) {
        wasm.node_set_isSmartStretch(this.__wbg_ptr, v);
    }
    /**
     * @param {boolean} v
     */
    set isStatic(v) {
        wasm.node_set_isStatic(this.__wbg_ptr, v);
    }
    /**
     * @param {boolean} v
     */
    set isStretchy(v) {
        wasm.node_set_isStretchy(this.__wbg_ptr, v);
    }
    /**
     * @param {number} v
     */
    set length(v) {
        wasm.node_set_length(this.__wbg_ptr, v);
    }
    /**
     * @param {number} v
     */
    set localAngle(v) {
        wasm.node_set_localAngle(this.__wbg_ptr, v);
    }
    /**
     * @param {number} v
     */
    set nodeType(v) {
        wasm.node_set_nodeType(this.__wbg_ptr, v);
    }
    /**
     * @param {boolean} v
     */
    set reverseGradient(v) {
        wasm.node_set_reverseGradient(this.__wbg_ptr, v);
    }
    /**
     * @param {number} v
     */
    set scale(v) {
        wasm.node_set_scale(this.__wbg_ptr, v);
    }
    /**
     * @param {boolean} v
     */
    set smartStretchResetImpulse(v) {
        wasm.node_set_smartStretchResetImpulse(this.__wbg_ptr, v);
    }
    /**
     * @param {number} v
     */
    set thickness(v) {
        wasm.node_set_thickness(this.__wbg_ptr, v);
    }
    /**
     * @param {boolean} v
     */
    set trapezoidIsRoundedEnd(v) {
        wasm.node_set_trapezoidIsRoundedEnd(this.__wbg_ptr, v);
    }
    /**
     * @param {boolean} v
     */
    set trapezoidIsRoundedStart(v) {
        wasm.node_set_trapezoidIsRoundedStart(this.__wbg_ptr, v);
    }
    /**
     * @param {boolean} v
     */
    set triangleFlipped(v) {
        wasm.node_set_triangleFlipped(this.__wbg_ptr, v);
    }
    /**
     * @param {boolean} v
     */
    set triangleUpsideDown(v) {
        wasm.node_set_triangleUpsideDown(this.__wbg_ptr, v);
    }
    /**
     * @param {boolean} v
     */
    set useCircleOutline(v) {
        wasm.node_set_useCircleOutline(this.__wbg_ptr, v);
    }
    /**
     * @param {boolean} v
     */
    set useGradient(v) {
        wasm.node_set_useGradient(this.__wbg_ptr, v);
    }
    /**
     * @param {boolean} v
     */
    set useSegmentColor(v) {
        wasm.node_set_useSegmentColor(this.__wbg_ptr, v);
    }
    /**
     * @param {boolean} v
     */
    set useSegmentScale(v) {
        wasm.node_set_useSegmentScale(this.__wbg_ptr, v);
    }
    /**
     * @returns {number}
     */
    get smartStretchMultiplier() {
        const ret = wasm.node_smartStretchMultiplier(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get smartStretchResetImpulse() {
        const ret = wasm.node_smartStretchResetImpulse(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get thickness() {
        const ret = wasm.node_thickness(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get trapezoidIsRoundedEnd() {
        const ret = wasm.node_trapezoidIsRoundedEnd(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get trapezoidIsRoundedStart() {
        const ret = wasm.node_trapezoidIsRoundedStart(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get trapezoidThicknessEnd() {
        const ret = wasm.node_trapezoidThicknessEnd(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get trapezoidThicknessStart() {
        const ret = wasm.node_trapezoidThicknessStart(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get trapezoidTopThicknessRatio() {
        const ret = wasm.node_trapezoidTopThicknessRatio(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get triangleFlipped() {
        const ret = wasm.node_triangleFlipped(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get triangleType() {
        const ret = wasm.node_triangleType(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get triangleUpsideDown() {
        const ret = wasm.node_triangleUpsideDown(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get useCircleOutline() {
        const ret = wasm.node_useCircleOutline(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get useGradient() {
        const ret = wasm.node_useGradient(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get useSegmentColor() {
        const ret = wasm.node_useSegmentColor(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get useSegmentScale() {
        const ret = wasm.node_useSegmentScale(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get useTrapezoidThicknessEnd() {
        const ret = wasm.node_useTrapezoidThicknessEnd(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get useTrapezoidThicknessStart() {
        const ret = wasm.node_useTrapezoidThicknessStart(this.__wbg_ptr);
        return ret !== 0;
    }
}
if (Symbol.dispose) Node.prototype[Symbol.dispose] = Node.prototype.free;

export class PolyfillData {
    static __wrap(ptr) {
        const obj = Object.create(PolyfillData.prototype);
        obj.__wbg_ptr = ptr;
        PolyfillDataFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PolyfillDataFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_polyfilldata_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get anchorDrawIndex() {
        const ret = wasm.polyfilldata_anchorDrawIndex(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Int32Array}
     */
    get attached() {
        const ret = wasm.polyfilldata_attached(this.__wbg_ptr);
        var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {string}
     */
    get colorHex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.polyfilldata_colorHex(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {boolean}
     */
    get usePolyfillColor() {
        const ret = wasm.polyfilldata_usePolyfillColor(this.__wbg_ptr);
        return ret !== 0;
    }
}
if (Symbol.dispose) PolyfillData.prototype[Symbol.dispose] = PolyfillData.prototype.free;

/**
 * @returns {number}
 */
export function SUPPORTED_BUILD() {
    const ret = wasm.SUPPORTED_BUILD();
    return ret;
}

/**
 * @returns {number}
 */
export function SUPPORTED_VERSION() {
    const ret = wasm.SUPPORTED_VERSION();
    return ret;
}

export class Stickfigure {
    static __wrap(ptr) {
        const obj = Object.create(Stickfigure.prototype);
        obj.__wbg_ptr = ptr;
        StickfigureFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StickfigureFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_stickfigure_free(ptr, 0);
    }
    /**
     * @param {any} options
     */
    addPolyfill(options) {
        const ret = wasm.stickfigure_addPolyfill(this.__wbg_ptr, options);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @returns {Int32Array}
     */
    allNodeIndices() {
        const ret = wasm.stickfigure_allNodeIndices(this.__wbg_ptr);
        var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {Node[]}
     */
    allNodes() {
        const ret = wasm.stickfigure_allNodes(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]);
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {PolyfillData[]}
     */
    allPolyfills() {
        const ret = wasm.stickfigure_allPolyfills(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]);
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {number}
     */
    get build() {
        const ret = wasm.stickfigure_build(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} from
     * @param {number} to
     */
    changeDrawIndex(from, to) {
        const ret = wasm.stickfigure_changeDrawIndex(this.__wbg_ptr, from, to);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @returns {string}
     */
    get colorHex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.stickfigure_colorHex(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {number} idx
     * @returns {boolean}
     */
    drawIndexExists(idx) {
        const ret = wasm.stickfigure_drawIndexExists(this.__wbg_ptr, idx);
        return ret !== 0;
    }
    /**
     * @param {number} idx
     * @returns {boolean}
     */
    drawIndexIsPolyfillAnchor(idx) {
        const ret = wasm.stickfigure_drawIndexIsPolyfillAnchor(this.__wbg_ptr, idx);
        return ret !== 0;
    }
    /**
     * @param {Uint8Array} bytes
     * @returns {Stickfigure}
     */
    static fromBytes(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.stickfigure_fromBytes(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Stickfigure.__wrap(ret[0]);
    }
    /**
     * @param {number} version
     * @param {number} build
     * @returns {Stickfigure}
     */
    static fromVersionAndBuild(version, build) {
        const ret = wasm.stickfigure_fromVersionAndBuild(version, build);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Stickfigure.__wrap(ret[0]);
    }
    /**
     * @param {number} idx
     * @returns {Int32Array}
     */
    getChildrenRecursive(idx) {
        const ret = wasm.stickfigure_getChildrenRecursive(this.__wbg_ptr, idx);
        var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @param {number} idx
     * @returns {Int32Array}
     */
    getChildren(idx) {
        const ret = wasm.stickfigure_getChildren(this.__wbg_ptr, idx);
        var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @param {number} idx
     * @returns {Node}
     */
    getNode(idx) {
        const ret = wasm.stickfigure_getNode(this.__wbg_ptr, idx);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Node.__wrap(ret[0]);
    }
    /**
     * @param {number} idx
     * @returns {number | undefined}
     */
    getParent(idx) {
        const ret = wasm.stickfigure_getParent(this.__wbg_ptr, idx);
        return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
    }
    /**
     * @param {number} idx
     * @returns {Int32Array}
     */
    getParentsRecursive(idx) {
        const ret = wasm.stickfigure_getParentsRecursive(this.__wbg_ptr, idx);
        var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @param {number} anchor
     * @returns {Float32Array}
     */
    getPolyfillVertices(anchor) {
        const ret = wasm.stickfigure_getPolyfillVertices(this.__wbg_ptr, anchor);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @param {number} idx
     * @returns {Int32Array}
     */
    getSiblings(idx) {
        const ret = wasm.stickfigure_getSiblings(this.__wbg_ptr, idx);
        var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @param {Int32Array} indices
     * @returns {Int32Array}
     */
    missingDrawIndices(indices) {
        const ptr0 = passArray32ToWasm0(indices, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.stickfigure_missingDrawIndices(this.__wbg_ptr, ptr0, len0);
        var v2 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
    constructor() {
        const ret = wasm.stickfigure_new();
        this.__wbg_ptr = ret;
        StickfigureFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} idx
     */
    removeNode(idx) {
        const ret = wasm.stickfigure_removeNode(this.__wbg_ptr, idx);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @param {number} anchor
     */
    removePolyfill(anchor) {
        const ret = wasm.stickfigure_removePolyfill(this.__wbg_ptr, anchor);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @returns {Node}
     */
    rootNode() {
        const ret = wasm.stickfigure_rootNode(this.__wbg_ptr);
        return Node.__wrap(ret);
    }
    /**
     * @returns {number}
     */
    get scale() {
        const ret = wasm.stickfigure_scale(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {boolean} enabled
     */
    setNodeLimitEnabled(enabled) {
        wasm.stickfigure_setNodeLimitEnabled(this.__wbg_ptr, enabled);
    }
    /**
     * @param {number} v
     */
    setVersion(v) {
        wasm.stickfigure_setVersion(this.__wbg_ptr, v);
    }
    /**
     * @param {number} b
     */
    set build(b) {
        wasm.stickfigure_set_build(this.__wbg_ptr, b);
    }
    /**
     * @param {string} hex
     */
    set colorHex(hex) {
        const ptr0 = passStringToWasm0(hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.stickfigure_set_colorHex(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @param {number} s
     */
    set scale(s) {
        wasm.stickfigure_set_scale(this.__wbg_ptr, s);
    }
    /**
     * @returns {Uint8Array}
     */
    toBytes() {
        const ret = wasm.stickfigure_toBytes(this.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {any}
     */
    toJsObject() {
        const ret = wasm.stickfigure_toJsObject(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @returns {number}
     */
    get version() {
        const ret = wasm.stickfigure_version(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) Stickfigure.prototype[Symbol.dispose] = Stickfigure.prototype.free;

/**
 * @param {number} v
 * @returns {string}
 */
export function nodeTypeFromInt(v) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.nodeTypeFromInt(v);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_67e7344beaa85059: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_Number_c54e7112a3fa7e3e: function(arg0) {
            const ret = Number(arg0);
            return ret;
        },
        __wbg_String_8564e559799eccda: function(arg0, arg1) {
            const ret = String(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_boolean_get_7a12af2b3f899c5a: function(arg0) {
            const v = arg0;
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_debug_string_0e68cf47c9cbd9b0: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_in_50072d4d6e45c193: function(arg0, arg1) {
            const ret = arg0 in arg1;
            return ret;
        },
        __wbg___wbindgen_is_function_fcda5e3902d732fe: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_object_edb6b15aa3afe12e: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_string_c4f7cb494a2a21f1: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_8c687d0b90d5b524: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_jsval_loose_eq_3c30021c243b64cd: function(arg0, arg1) {
            const ret = arg0 == arg1;
            return ret;
        },
        __wbg___wbindgen_number_get_1dc732b810cb937c: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_string_get_92ab86bb19cbc12f: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_5d9e815e6fdf150f: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_269c5566fbede3eb: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.call(arg1);
            return ret;
        }, arguments); },
        __wbg_done_cffed884d87aa22e: function(arg0) {
            const ret = arg0.done;
            return ret;
        },
        __wbg_entries_972a87586902cf87: function(arg0) {
            const ret = Object.entries(arg0);
            return ret;
        },
        __wbg_get_6cf5a4d4d8ad3c5a: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_b1f0ab13c737f856: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_unchecked_363572bdd397d473: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_with_ref_key_6412cf3094599694: function(arg0, arg1) {
            const ret = arg0[arg1];
            return ret;
        },
        __wbg_instanceof_ArrayBuffer_d4ff01f8247925ae: function(arg0) {
            let result;
            try {
                result = arg0 instanceof ArrayBuffer;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Uint8Array_598adc0fef426aa8: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Uint8Array;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_isArray_5674713bb7b79043: function(arg0) {
            const ret = Array.isArray(arg0);
            return ret;
        },
        __wbg_isSafeInteger_8f51c743827d1ec5: function(arg0) {
            const ret = Number.isSafeInteger(arg0);
            return ret;
        },
        __wbg_iterator_22ddeb808cf55a6f: function() {
            const ret = Symbol.iterator;
            return ret;
        },
        __wbg_length_31bdaf014f5fbde2: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_4e1adc0d42e23620: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_new_1da3429bc3c4541c: function(arg0) {
            const ret = new Uint8Array(arg0);
            return ret;
        },
        __wbg_new_bebc3f4757acf305: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_ffa92086ea89f79c: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_next_95053e306b1c3aed: function(arg0) {
            const ret = arg0.next;
            return ret;
        },
        __wbg_next_f31ecb8646d2c605: function() { return handleError(function (arg0) {
            const ret = arg0.next();
            return ret;
        }, arguments); },
        __wbg_node_new: function(arg0) {
            const ret = Node.__wrap(arg0);
            return ret;
        },
        __wbg_polyfilldata_new: function(arg0) {
            const ret = PolyfillData.__wrap(arg0);
            return ret;
        },
        __wbg_prototypesetcall_ae9f5e7459250748: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_set_13d25b81ab403f5e: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_value_c227f843d21da141: function(arg0) {
            const ret = arg0.value;
            return ret;
        },
        __wbindgen_generic_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_generic_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./sticknodes_rs_bg.js": import0,
    };
}

const ColorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_color_free(ptr, 1));
const NodeFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_node_free(ptr, 1));
const PolyfillDataFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_polyfilldata_free(ptr, 1));
const StickfigureFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_stickfigure_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayI32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getInt32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let cachedInt32ArrayMemory0 = null;
function getInt32ArrayMemory0() {
    if (cachedInt32ArrayMemory0 === null || cachedInt32ArrayMemory0.byteLength === 0) {
        cachedInt32ArrayMemory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedInt32ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('sticknodes_rs_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
