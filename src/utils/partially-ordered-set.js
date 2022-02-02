"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartiallyOrderedSet = exports.CircularDependencyFoundException = exports.DependencyNotFoundException = void 0;
const exception_1 = require("../exception");
class DependencyNotFoundException extends exception_1.BaseException {
    constructor() {
        super('One of the dependencies is not part of the set.');
    }
}
exports.DependencyNotFoundException = DependencyNotFoundException;
class CircularDependencyFoundException extends exception_1.BaseException {
    constructor() {
        super('Circular dependencies found.');
    }
}
exports.CircularDependencyFoundException = CircularDependencyFoundException;
class PartiallyOrderedSet {
    constructor() {
        this._items = new Map();
    }
    _checkCircularDependencies(item, deps) {
        if (deps.has(item)) {
            throw new CircularDependencyFoundException();
        }
        deps.forEach((dep) => this._checkCircularDependencies(item, this._items.get(dep) || new Set()));
    }
    clear() {
        this._items.clear();
    }
    has(item) {
        return this._items.has(item);
    }
    get size() {
        return this._items.size;
    }
    forEach(callbackfn, thisArg) {
        for (const x of this) {
            callbackfn.call(thisArg, x, x, this);
        }
    }
    /**
     * Returns an iterable of [v,v] pairs for every value `v` in the set.
     */
    *entries() {
        for (const item of this) {
            yield [item, item];
        }
    }
    /**
     * Despite its name, returns an iterable of the values in the set,
     */
    keys() {
        return this.values();
    }
    /**
     * Returns an iterable of values in the set.
     */
    values() {
        return this[Symbol.iterator]();
    }
    add(item, deps = new Set()) {
        if (Array.isArray(deps)) {
            deps = new Set(deps);
        }
        // Verify item is not already in the set.
        if (this._items.has(item)) {
            const itemDeps = this._items.get(item) || new Set();
            // If the dependency list is equal, just return, otherwise remove and keep going.
            let equal = true;
            for (const dep of deps) {
                if (!itemDeps.has(dep)) {
                    equal = false;
                    break;
                }
            }
            if (equal) {
                for (const dep of itemDeps) {
                    if (!deps.has(dep)) {
                        equal = false;
                        break;
                    }
                }
            }
            if (equal) {
                return this;
            }
            else {
                this._items.delete(item);
            }
        }
        // Verify all dependencies are part of the Set.
        for (const dep of deps) {
            if (!this._items.has(dep)) {
                throw new DependencyNotFoundException();
            }
        }
        // Verify there's no dependency cycle.
        this._checkCircularDependencies(item, deps);
        this._items.set(item, new Set(deps));
        return this;
    }
    delete(item) {
        if (!this._items.has(item)) {
            return false;
        }
        // Remove it from all dependencies if force == true.
        this._items.forEach((value) => value.delete(item));
        return this._items.delete(item);
    }
    *[Symbol.iterator]() {
        const copy = new Map(this._items);
        for (const [key, value] of copy.entries()) {
            copy.set(key, new Set(value));
        }
        while (copy.size > 0) {
            const run = [];
            // Take the first item without dependencies.
            for (const [item, deps] of copy.entries()) {
                if (deps.size == 0) {
                    run.push(item);
                }
            }
            for (const item of run) {
                copy.forEach((s) => s.delete(item));
                copy.delete(item);
                yield item;
            }
            if (run.length == 0) {
                // uh oh...
                throw new CircularDependencyFoundException();
            }
        }
    }
    get [Symbol.toStringTag]() {
        return 'Set';
    }
}
exports.PartiallyOrderedSet = PartiallyOrderedSet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGlhbGx5LW9yZGVyZWQtc2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvdXRpbHMvcGFydGlhbGx5LW9yZGVyZWQtc2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILDRDQUE2QztBQUU3QyxNQUFhLDJCQUE0QixTQUFRLHlCQUFhO0lBQzVEO1FBQ0UsS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUM7SUFDM0QsQ0FBQztDQUNGO0FBSkQsa0VBSUM7QUFDRCxNQUFhLGdDQUFpQyxTQUFRLHlCQUFhO0lBQ2pFO1FBQ0UsS0FBSyxDQUFDLDhCQUE4QixDQUFDLENBQUM7SUFDeEMsQ0FBQztDQUNGO0FBSkQsNEVBSUM7QUFFRCxNQUFhLG1CQUFtQjtJQUFoQztRQUNVLFdBQU0sR0FBRyxJQUFJLEdBQUcsRUFBYSxDQUFDO0lBOEl4QyxDQUFDO0lBNUlXLDBCQUEwQixDQUFDLElBQU8sRUFBRSxJQUFZO1FBQ3hELElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNsQixNQUFNLElBQUksZ0NBQWdDLEVBQUUsQ0FBQztTQUM5QztRQUVELElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDbEcsQ0FBQztJQUVELEtBQUs7UUFDSCxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ3RCLENBQUM7SUFDRCxHQUFHLENBQUMsSUFBTztRQUNULE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7SUFD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UUFDdEIsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0NBQ0Y7QUEvSUQsa0RBK0lDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJhc2VFeGNlcHRpb24gfSBmcm9tICcuLi9leGNlcHRpb24nO1xuXG5leHBvcnQgY2xhc3MgRGVwZW5kZW5jeU5vdEZvdW5kRXhjZXB0aW9uIGV4dGVuZHMgQmFzZUV4Y2VwdGlvbiB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCdPbmUgb2YgdGhlIGRlcGVuZGVuY2llcyBpcyBub3QgcGFydCBvZiB0aGUgc2V0LicpO1xuICB9XG59XG5leHBvcnQgY2xhc3MgQ2lyY3VsYXJEZXBlbmRlbmN5Rm91bmRFeGNlcHRpb24gZXh0ZW5kcyBCYXNlRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoJ0NpcmN1bGFyIGRlcGVuZGVuY2llcyBmb3VuZC4nKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGFydGlhbGx5T3JkZXJlZFNldDxUPiBpbXBsZW1lbnRzIFNldDxUPiB7XG4gIHByaXZhdGUgX2l0ZW1zID0gbmV3IE1hcDxULCBTZXQ8VD4+KCk7XG5cbiAgcHJvdGVjdGVkIF9jaGVja0NpcmN1bGFyRGVwZW5kZW5jaWVzKGl0ZW06IFQsIGRlcHM6IFNldDxUPikge1xuICAgIGlmIChkZXBzLmhhcyhpdGVtKSkge1xuICAgICAgdGhyb3cgbmV3IENpcmN1bGFyRGVwZW5kZW5jeUZvdW5kRXhjZXB0aW9uKCk7XG4gICAgfVxuXG4gICAgZGVwcy5mb3JFYWNoKChkZXApID0+IHRoaXMuX2NoZWNrQ2lyY3VsYXJEZXBlbmRlbmNpZXMoaXRlbSwgdGhpcy5faXRlbXMuZ2V0KGRlcCkgfHwgbmV3IFNldCgpKSk7XG4gIH1cblxuICBjbGVhcigpIHtcbiAgICB0aGlzLl9pdGVtcy5jbGVhcigpO1xuICB9XG4gIGhhcyhpdGVtOiBUKSB7XG4gICAgcmV0dXJuIHRoaXMuX2l0ZW1zLmhhcyhpdGVtKTtcbiAgfVxuICBnZXQgc2l6ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5faXRlbXMuc2l6ZTtcbiAgfVxuICBmb3JFYWNoKFxuICAgIGNhbGxiYWNrZm46ICh2YWx1ZTogVCwgdmFsdWUyOiBULCBzZXQ6IFBhcnRpYWxseU9yZGVyZWRTZXQ8VD4pID0+IHZvaWQsXG4gICAgdGhpc0FyZz86IGFueSwgLy8gZXNsaW50LWRpc2FibGUtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICk6IHZvaWQge1xuICAgIGZvciAoY29uc3QgeCBvZiB0aGlzKSB7XG4gICAgICBjYWxsYmFja2ZuLmNhbGwodGhpc0FyZywgeCwgeCwgdGhpcyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYW4gaXRlcmFibGUgb2YgW3Ysdl0gcGFpcnMgZm9yIGV2ZXJ5IHZhbHVlIGB2YCBpbiB0aGUgc2V0LlxuICAgKi9cbiAgKmVudHJpZXMoKTogSXRlcmFibGVJdGVyYXRvcjxbVCwgVF0+IHtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcykge1xuICAgICAgeWllbGQgW2l0ZW0sIGl0ZW1dO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEZXNwaXRlIGl0cyBuYW1lLCByZXR1cm5zIGFuIGl0ZXJhYmxlIG9mIHRoZSB2YWx1ZXMgaW4gdGhlIHNldCxcbiAgICovXG4gIGtleXMoKTogSXRlcmFibGVJdGVyYXRvcjxUPiB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVzKCk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhbiBpdGVyYWJsZSBvZiB2YWx1ZXMgaW4gdGhlIHNldC5cbiAgICovXG4gIHZhbHVlcygpOiBJdGVyYWJsZUl0ZXJhdG9yPFQ+IHtcbiAgICByZXR1cm4gdGhpc1tTeW1ib2wuaXRlcmF0b3JdKCk7XG4gIH1cblxuICBhZGQoaXRlbTogVCwgZGVwczogU2V0PFQ+IHwgVFtdID0gbmV3IFNldCgpKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZGVwcykpIHtcbiAgICAgIGRlcHMgPSBuZXcgU2V0KGRlcHMpO1xuICAgIH1cblxuICAgIC8vIFZlcmlmeSBpdGVtIGlzIG5vdCBhbHJlYWR5IGluIHRoZSBzZXQuXG4gICAgaWYgKHRoaXMuX2l0ZW1zLmhhcyhpdGVtKSkge1xuICAgICAgY29uc3QgaXRlbURlcHMgPSB0aGlzLl9pdGVtcy5nZXQoaXRlbSkgfHwgbmV3IFNldDxUPigpO1xuXG4gICAgICAvLyBJZiB0aGUgZGVwZW5kZW5jeSBsaXN0IGlzIGVxdWFsLCBqdXN0IHJldHVybiwgb3RoZXJ3aXNlIHJlbW92ZSBhbmQga2VlcCBnb2luZy5cbiAgICAgIGxldCBlcXVhbCA9IHRydWU7XG4gICAgICBmb3IgKGNvbnN0IGRlcCBvZiBkZXBzKSB7XG4gICAgICAgIGlmICghaXRlbURlcHMuaGFzKGRlcCkpIHtcbiAgICAgICAgICBlcXVhbCA9IGZhbHNlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZXF1YWwpIHtcbiAgICAgICAgZm9yIChjb25zdCBkZXAgb2YgaXRlbURlcHMpIHtcbiAgICAgICAgICBpZiAoIWRlcHMuaGFzKGRlcCkpIHtcbiAgICAgICAgICAgIGVxdWFsID0gZmFsc2U7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGVxdWFsKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5faXRlbXMuZGVsZXRlKGl0ZW0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFZlcmlmeSBhbGwgZGVwZW5kZW5jaWVzIGFyZSBwYXJ0IG9mIHRoZSBTZXQuXG4gICAgZm9yIChjb25zdCBkZXAgb2YgZGVwcykge1xuICAgICAgaWYgKCF0aGlzLl9pdGVtcy5oYXMoZGVwKSkge1xuICAgICAgICB0aHJvdyBuZXcgRGVwZW5kZW5jeU5vdEZvdW5kRXhjZXB0aW9uKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gVmVyaWZ5IHRoZXJlJ3Mgbm8gZGVwZW5kZW5jeSBjeWNsZS5cbiAgICB0aGlzLl9jaGVja0NpcmN1bGFyRGVwZW5kZW5jaWVzKGl0ZW0sIGRlcHMpO1xuXG4gICAgdGhpcy5faXRlbXMuc2V0KGl0ZW0sIG5ldyBTZXQoZGVwcykpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBkZWxldGUoaXRlbTogVCkge1xuICAgIGlmICghdGhpcy5faXRlbXMuaGFzKGl0ZW0pKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIGl0IGZyb20gYWxsIGRlcGVuZGVuY2llcyBpZiBmb3JjZSA9PSB0cnVlLlxuICAgIHRoaXMuX2l0ZW1zLmZvckVhY2goKHZhbHVlKSA9PiB2YWx1ZS5kZWxldGUoaXRlbSkpO1xuXG4gICAgcmV0dXJuIHRoaXMuX2l0ZW1zLmRlbGV0ZShpdGVtKTtcbiAgfVxuXG4gICpbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICBjb25zdCBjb3B5OiBNYXA8VCwgU2V0PFQ+PiA9IG5ldyBNYXAodGhpcy5faXRlbXMpO1xuXG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgY29weS5lbnRyaWVzKCkpIHtcbiAgICAgIGNvcHkuc2V0KGtleSwgbmV3IFNldCh2YWx1ZSkpO1xuICAgIH1cblxuICAgIHdoaWxlIChjb3B5LnNpemUgPiAwKSB7XG4gICAgICBjb25zdCBydW4gPSBbXTtcbiAgICAgIC8vIFRha2UgdGhlIGZpcnN0IGl0ZW0gd2l0aG91dCBkZXBlbmRlbmNpZXMuXG4gICAgICBmb3IgKGNvbnN0IFtpdGVtLCBkZXBzXSBvZiBjb3B5LmVudHJpZXMoKSkge1xuICAgICAgICBpZiAoZGVwcy5zaXplID09IDApIHtcbiAgICAgICAgICBydW4ucHVzaChpdGVtKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgcnVuKSB7XG4gICAgICAgIGNvcHkuZm9yRWFjaCgocykgPT4gcy5kZWxldGUoaXRlbSkpO1xuICAgICAgICBjb3B5LmRlbGV0ZShpdGVtKTtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJ1bi5sZW5ndGggPT0gMCkge1xuICAgICAgICAvLyB1aCBvaC4uLlxuICAgICAgICB0aHJvdyBuZXcgQ2lyY3VsYXJEZXBlbmRlbmN5Rm91bmRFeGNlcHRpb24oKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZXQgW1N5bWJvbC50b1N0cmluZ1RhZ10oKTogJ1NldCcge1xuICAgIHJldHVybiAnU2V0JztcbiAgfVxufVxuIl19