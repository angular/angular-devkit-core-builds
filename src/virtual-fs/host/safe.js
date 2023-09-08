"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafeReadonlyHost = void 0;
const rxjs_1 = require("rxjs");
/**
 * A Host that filters out errors. The only exception is `read()` which will still error out if
 * the delegate returned an error (e.g. NodeJS will error out if the file doesn't exist).
 */
class SafeReadonlyHost {
    _delegate;
    constructor(_delegate) {
        this._delegate = _delegate;
    }
    get capabilities() {
        return this._delegate.capabilities;
    }
    read(path) {
        return this._delegate.read(path);
    }
    list(path) {
        return this._delegate.list(path).pipe((0, rxjs_1.catchError)(() => (0, rxjs_1.of)([])));
    }
    exists(path) {
        return this._delegate.exists(path);
    }
    isDirectory(path) {
        return this._delegate.isDirectory(path).pipe((0, rxjs_1.catchError)(() => (0, rxjs_1.of)(false)));
    }
    isFile(path) {
        return this._delegate.isFile(path).pipe((0, rxjs_1.catchError)(() => (0, rxjs_1.of)(false)));
    }
    // Some hosts may not support stats.
    stat(path) {
        const maybeStat = this._delegate.stat(path);
        return maybeStat && maybeStat.pipe((0, rxjs_1.catchError)(() => (0, rxjs_1.of)(null)));
    }
}
exports.SafeReadonlyHost = SafeReadonlyHost;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2FmZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL3ZpcnR1YWwtZnMvaG9zdC9zYWZlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILCtCQUFrRDtBQUlsRDs7O0dBR0c7QUFDSCxNQUFhLGdCQUFnQjtJQUNQO0lBQXBCLFlBQW9CLFNBQStCO1FBQS9CLGNBQVMsR0FBVCxTQUFTLENBQXNCO0lBQUcsQ0FBQztJQUV2RCxJQUFJLFlBQVk7UUFDZCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDO0lBQ3JDLENBQUM7SUFFRCxJQUFJLENBQUMsSUFBVTtRQUNiLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbkMsQ0FBQztJQUVELElBQUksQ0FBQyxJQUFVO1FBQ2IsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBQSxpQkFBVSxFQUFDLEdBQUcsRUFBRSxDQUFDLElBQUEsU0FBRSxFQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsRSxDQUFDO0lBRUQsTUFBTSxDQUFDLElBQVU7UUFDZixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFDRCxXQUFXLENBQUMsSUFBVTtRQUNwQixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFBLGlCQUFVLEVBQUMsR0FBRyxFQUFFLENBQUMsSUFBQSxTQUFFLEVBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzVFLENBQUM7SUFDRCxNQUFNLENBQUMsSUFBVTtRQUNmLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUEsaUJBQVUsRUFBQyxHQUFHLEVBQUUsQ0FBQyxJQUFBLFNBQUUsRUFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdkUsQ0FBQztJQUVELG9DQUFvQztJQUNwQyxJQUFJLENBQUMsSUFBVTtRQUNiLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTVDLE9BQU8sU0FBUyxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBQSxpQkFBVSxFQUFDLEdBQUcsRUFBRSxDQUFDLElBQUEsU0FBRSxFQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqRSxDQUFDO0NBQ0Y7QUEvQkQsNENBK0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IE9ic2VydmFibGUsIGNhdGNoRXJyb3IsIG9mIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBQYXRoLCBQYXRoRnJhZ21lbnQgfSBmcm9tICcuLi9wYXRoJztcbmltcG9ydCB7IEZpbGVCdWZmZXIsIEhvc3RDYXBhYmlsaXRpZXMsIFJlYWRvbmx5SG9zdCwgU3RhdHMgfSBmcm9tICcuL2ludGVyZmFjZSc7XG5cbi8qKlxuICogQSBIb3N0IHRoYXQgZmlsdGVycyBvdXQgZXJyb3JzLiBUaGUgb25seSBleGNlcHRpb24gaXMgYHJlYWQoKWAgd2hpY2ggd2lsbCBzdGlsbCBlcnJvciBvdXQgaWZcbiAqIHRoZSBkZWxlZ2F0ZSByZXR1cm5lZCBhbiBlcnJvciAoZS5nLiBOb2RlSlMgd2lsbCBlcnJvciBvdXQgaWYgdGhlIGZpbGUgZG9lc24ndCBleGlzdCkuXG4gKi9cbmV4cG9ydCBjbGFzcyBTYWZlUmVhZG9ubHlIb3N0PFN0YXRzVCBleHRlbmRzIG9iamVjdCA9IHt9PiBpbXBsZW1lbnRzIFJlYWRvbmx5SG9zdDxTdGF0c1Q+IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfZGVsZWdhdGU6IFJlYWRvbmx5SG9zdDxTdGF0c1Q+KSB7fVxuXG4gIGdldCBjYXBhYmlsaXRpZXMoKTogSG9zdENhcGFiaWxpdGllcyB7XG4gICAgcmV0dXJuIHRoaXMuX2RlbGVnYXRlLmNhcGFiaWxpdGllcztcbiAgfVxuXG4gIHJlYWQocGF0aDogUGF0aCk6IE9ic2VydmFibGU8RmlsZUJ1ZmZlcj4ge1xuICAgIHJldHVybiB0aGlzLl9kZWxlZ2F0ZS5yZWFkKHBhdGgpO1xuICB9XG5cbiAgbGlzdChwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxQYXRoRnJhZ21lbnRbXT4ge1xuICAgIHJldHVybiB0aGlzLl9kZWxlZ2F0ZS5saXN0KHBhdGgpLnBpcGUoY2F0Y2hFcnJvcigoKSA9PiBvZihbXSkpKTtcbiAgfVxuXG4gIGV4aXN0cyhwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxib29sZWFuPiB7XG4gICAgcmV0dXJuIHRoaXMuX2RlbGVnYXRlLmV4aXN0cyhwYXRoKTtcbiAgfVxuICBpc0RpcmVjdG9yeShwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxib29sZWFuPiB7XG4gICAgcmV0dXJuIHRoaXMuX2RlbGVnYXRlLmlzRGlyZWN0b3J5KHBhdGgpLnBpcGUoY2F0Y2hFcnJvcigoKSA9PiBvZihmYWxzZSkpKTtcbiAgfVxuICBpc0ZpbGUocGF0aDogUGF0aCk6IE9ic2VydmFibGU8Ym9vbGVhbj4ge1xuICAgIHJldHVybiB0aGlzLl9kZWxlZ2F0ZS5pc0ZpbGUocGF0aCkucGlwZShjYXRjaEVycm9yKCgpID0+IG9mKGZhbHNlKSkpO1xuICB9XG5cbiAgLy8gU29tZSBob3N0cyBtYXkgbm90IHN1cHBvcnQgc3RhdHMuXG4gIHN0YXQocGF0aDogUGF0aCk6IE9ic2VydmFibGU8U3RhdHM8U3RhdHNUPiB8IG51bGw+IHwgbnVsbCB7XG4gICAgY29uc3QgbWF5YmVTdGF0ID0gdGhpcy5fZGVsZWdhdGUuc3RhdChwYXRoKTtcblxuICAgIHJldHVybiBtYXliZVN0YXQgJiYgbWF5YmVTdGF0LnBpcGUoY2F0Y2hFcnJvcigoKSA9PiBvZihudWxsKSkpO1xuICB9XG59XG4iXX0=