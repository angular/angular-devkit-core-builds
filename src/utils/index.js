"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.strings = exports.tags = void 0;
const tags = __importStar(require("./literals"));
exports.tags = tags;
const strings = __importStar(require("./strings"));
exports.strings = strings;
__exportStar(require("./object"), exports);
__exportStar(require("./template"), exports);
__exportStar(require("./partially-ordered-set"), exports);
__exportStar(require("./priority-queue"), exports);
__exportStar(require("./lang"), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy91dGlscy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBUzFCLG9CQUFJO0FBUmIsbURBQXFDO0FBUXRCLDBCQUFPO0FBTnRCLDJDQUF5QjtBQUN6Qiw2Q0FBMkI7QUFDM0IsMERBQXdDO0FBQ3hDLG1EQUFpQztBQUNqQyx5Q0FBdUIiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdGFncyBmcm9tICcuL2xpdGVyYWxzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi9zdHJpbmdzJztcblxuZXhwb3J0ICogZnJvbSAnLi9vYmplY3QnO1xuZXhwb3J0ICogZnJvbSAnLi90ZW1wbGF0ZSc7XG5leHBvcnQgKiBmcm9tICcuL3BhcnRpYWxseS1vcmRlcmVkLXNldCc7XG5leHBvcnQgKiBmcm9tICcuL3ByaW9yaXR5LXF1ZXVlJztcbmV4cG9ydCAqIGZyb20gJy4vbGFuZyc7XG5cbmV4cG9ydCB7IHRhZ3MsIHN0cmluZ3MgfTtcblxuZXhwb3J0IHR5cGUgRGVlcFJlYWRvbmx5PFQ+ID0gVCBleHRlbmRzIChpbmZlciBSKVtdXG4gID8gRGVlcFJlYWRvbmx5QXJyYXk8Uj5cbiAgOiBUIGV4dGVuZHMgRnVuY3Rpb25cbiAgPyBUXG4gIDogVCBleHRlbmRzIG9iamVjdFxuICA/IERlZXBSZWFkb25seU9iamVjdDxUPlxuICA6IFQ7XG5cbi8vIFRoaXMgc2hvdWxkIGJlIFJlYWRvbmx5QXJyYXkgYnV0IGl0IGhhcyBpbXBsaWNhdGlvbnMuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWVtcHR5LWludGVyZmFjZVxuZXhwb3J0IGludGVyZmFjZSBEZWVwUmVhZG9ubHlBcnJheTxUPiBleHRlbmRzIEFycmF5PERlZXBSZWFkb25seTxUPj4ge31cblxuZXhwb3J0IHR5cGUgRGVlcFJlYWRvbmx5T2JqZWN0PFQ+ID0ge1xuICByZWFkb25seSBbUCBpbiBrZXlvZiBUXTogRGVlcFJlYWRvbmx5PFRbUF0+O1xufTtcblxuZXhwb3J0IHR5cGUgUmVhZHdyaXRlPFQ+ID0ge1xuICAtcmVhZG9ubHkgW1AgaW4ga2V5b2YgVF06IFRbUF07XG59O1xuIl19