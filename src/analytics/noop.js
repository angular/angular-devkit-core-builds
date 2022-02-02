"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopAnalytics = void 0;
/**
 * Analytics implementation that does nothing.
 */
class NoopAnalytics {
    event() { }
    screenview() { }
    pageview() { }
    timing() { }
    flush() {
        return Promise.resolve();
    }
}
exports.NoopAnalytics = NoopAnalytics;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9vcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL2FuYWx5dGljcy9ub29wLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUlIOztHQUVHO0FBQ0gsTUFBYSxhQUFhO0lBQ3hCLEtBQUssS0FBSSxDQUFDO0lBQ1YsVUFBVSxLQUFJLENBQUM7SUFDZixRQUFRLEtBQUksQ0FBQztJQUNiLE1BQU0sS0FBSSxDQUFDO0lBQ1gsS0FBSztRQUNILE9BQU8sT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQzNCLENBQUM7Q0FDRjtBQVJELHNDQVFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEFuYWx5dGljcyB9IGZyb20gJy4vYXBpJztcblxuLyoqXG4gKiBBbmFseXRpY3MgaW1wbGVtZW50YXRpb24gdGhhdCBkb2VzIG5vdGhpbmcuXG4gKi9cbmV4cG9ydCBjbGFzcyBOb29wQW5hbHl0aWNzIGltcGxlbWVudHMgQW5hbHl0aWNzIHtcbiAgZXZlbnQoKSB7fVxuICBzY3JlZW52aWV3KCkge31cbiAgcGFnZXZpZXcoKSB7fVxuICB0aW1pbmcoKSB7fVxuICBmbHVzaCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cbn1cbiJdfQ==