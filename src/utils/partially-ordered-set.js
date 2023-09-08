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
    _items = new Map();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGlhbGx5LW9yZGVyZWQtc2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvdXRpbHMvcGFydGlhbGx5LW9yZGVyZWQtc2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILDRDQUE2QztBQUU3QyxNQUFhLDJCQUE0QixTQUFRLHlCQUFhO0lBQzVEO1FBQ0UsS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUM7SUFDM0QsQ0FBQztDQUNGO0FBSkQsa0VBSUM7QUFDRCxNQUFhLGdDQUFpQyxTQUFRLHlCQUFhO0lBQ2pFO1FBQ0UsS0FBSyxDQUFDLDhCQUE4QixDQUFDLENBQUM7SUFDeEMsQ0FBQztDQUNGO0FBSkQsNEVBSUM7QUFFRCxNQUFhLG1CQUFtQjtJQUN0QixNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQWEsQ0FBQztJQUU1QiwwQkFBMEIsQ0FBQyxJQUFPLEVBQUUsSUFBWTtRQUN4RCxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDbEIsTUFBTSxJQUFJLGdDQUFnQyxFQUFFLENBQUM7U0FDOUM7UUFFRCxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xHLENBQUM7SUFFRCxLQUFLO1FBQ0gsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUN0QixDQUFDO0lBQ0QsR0FBRyxDQUFDLElBQU87UUFDVCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFDRCxJQUFJLElBQUk7UUFDTixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQzFCLENBQUM7SUFDRCxPQUFPLENBQ0wsVUFBc0UsRUFDdEUsT0FBYTtRQUViLEtBQUssTUFBTSxDQUFDLElBQUksSUFBSSxFQUFFO1lBQ3BCLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDdEM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxDQUFDLE9BQU87UUFDTixLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksRUFBRTtZQUN2QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ3BCO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSTtRQUNGLE9BQU8sSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU07UUFDSixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztJQUNqQyxDQUFDO0lBRUQsR0FBRyxDQUFDLElBQU8sRUFBRSxPQUFxQixJQUFJLEdBQUcsRUFBRTtRQUN6QyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDdkIsSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ3RCO1FBRUQseUNBQXlDO1FBQ3pDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDekIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxHQUFHLEVBQUssQ0FBQztZQUV2RCxpRkFBaUY7WUFDakYsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDO1lBQ2pCLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFO2dCQUN0QixJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtvQkFDdEIsS0FBSyxHQUFHLEtBQUssQ0FBQztvQkFDZCxNQUFNO2lCQUNQO2FBQ0Y7WUFDRCxJQUFJLEtBQUssRUFBRTtnQkFDVCxLQUFLLE1BQU0sR0FBRyxJQUFJLFFBQVEsRUFBRTtvQkFDMUIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUU7d0JBQ2xCLEtBQUssR0FBRyxLQUFLLENBQUM7d0JBQ2QsTUFBTTtxQkFDUDtpQkFDRjthQUNGO1lBRUQsSUFBSSxLQUFLLEVBQUU7Z0JBQ1QsT0FBTyxJQUFJLENBQUM7YUFDYjtpQkFBTTtnQkFDTCxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUMxQjtTQUNGO1FBRUQsK0NBQStDO1FBQy9DLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFO1lBQ3RCLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDekIsTUFBTSxJQUFJLDJCQUEyQixFQUFFLENBQUM7YUFDekM7U0FDRjtRQUVELHNDQUFzQztRQUN0QyxJQUFJLENBQUMsMEJBQTBCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRTVDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRXJDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELE1BQU0sQ0FBQyxJQUFPO1FBQ1osSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQzFCLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFFRCxvREFBb0Q7UUFDcEQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUVuRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFFRCxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQztRQUNoQixNQUFNLElBQUksR0FBbUIsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRWxELEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDekMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztTQUMvQjtRQUVELE9BQU8sSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUU7WUFDcEIsTUFBTSxHQUFHLEdBQVEsRUFBRSxDQUFDO1lBQ3BCLDRDQUE0QztZQUM1QyxLQUFLLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFO2dCQUN6QyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxFQUFFO29CQUNsQixHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUNoQjthQUNGO1lBRUQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLEVBQUU7Z0JBQ3RCLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDcEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbEIsTUFBTSxJQUFJLENBQUM7YUFDWjtZQUVELElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7Z0JBQ25CLFdBQVc7Z0JBQ1gsTUFBTSxJQUFJLGdDQUFnQyxFQUFFLENBQUM7YUFDOUM7U0FDRjtJQUNILENBQUM7SUFFRCxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQztRQUN0QixPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7Q0FDRjtBQS9JRCxrREErSUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQmFzZUV4Y2VwdGlvbiB9IGZyb20gJy4uL2V4Y2VwdGlvbic7XG5cbmV4cG9ydCBjbGFzcyBEZXBlbmRlbmN5Tm90Rm91bmRFeGNlcHRpb24gZXh0ZW5kcyBCYXNlRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoJ09uZSBvZiB0aGUgZGVwZW5kZW5jaWVzIGlzIG5vdCBwYXJ0IG9mIHRoZSBzZXQuJyk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBDaXJjdWxhckRlcGVuZGVuY3lGb3VuZEV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcignQ2lyY3VsYXIgZGVwZW5kZW5jaWVzIGZvdW5kLicpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQYXJ0aWFsbHlPcmRlcmVkU2V0PFQ+IGltcGxlbWVudHMgU2V0PFQ+IHtcbiAgcHJpdmF0ZSBfaXRlbXMgPSBuZXcgTWFwPFQsIFNldDxUPj4oKTtcblxuICBwcm90ZWN0ZWQgX2NoZWNrQ2lyY3VsYXJEZXBlbmRlbmNpZXMoaXRlbTogVCwgZGVwczogU2V0PFQ+KSB7XG4gICAgaWYgKGRlcHMuaGFzKGl0ZW0pKSB7XG4gICAgICB0aHJvdyBuZXcgQ2lyY3VsYXJEZXBlbmRlbmN5Rm91bmRFeGNlcHRpb24oKTtcbiAgICB9XG5cbiAgICBkZXBzLmZvckVhY2goKGRlcCkgPT4gdGhpcy5fY2hlY2tDaXJjdWxhckRlcGVuZGVuY2llcyhpdGVtLCB0aGlzLl9pdGVtcy5nZXQoZGVwKSB8fCBuZXcgU2V0KCkpKTtcbiAgfVxuXG4gIGNsZWFyKCkge1xuICAgIHRoaXMuX2l0ZW1zLmNsZWFyKCk7XG4gIH1cbiAgaGFzKGl0ZW06IFQpIHtcbiAgICByZXR1cm4gdGhpcy5faXRlbXMuaGFzKGl0ZW0pO1xuICB9XG4gIGdldCBzaXplKCkge1xuICAgIHJldHVybiB0aGlzLl9pdGVtcy5zaXplO1xuICB9XG4gIGZvckVhY2goXG4gICAgY2FsbGJhY2tmbjogKHZhbHVlOiBULCB2YWx1ZTI6IFQsIHNldDogUGFydGlhbGx5T3JkZXJlZFNldDxUPikgPT4gdm9pZCxcbiAgICB0aGlzQXJnPzogYW55LCAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCB4IG9mIHRoaXMpIHtcbiAgICAgIGNhbGxiYWNrZm4uY2FsbCh0aGlzQXJnLCB4LCB4LCB0aGlzKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhbiBpdGVyYWJsZSBvZiBbdix2XSBwYWlycyBmb3IgZXZlcnkgdmFsdWUgYHZgIGluIHRoZSBzZXQuXG4gICAqL1xuICAqZW50cmllcygpOiBJdGVyYWJsZUl0ZXJhdG9yPFtULCBUXT4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzKSB7XG4gICAgICB5aWVsZCBbaXRlbSwgaXRlbV07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIERlc3BpdGUgaXRzIG5hbWUsIHJldHVybnMgYW4gaXRlcmFibGUgb2YgdGhlIHZhbHVlcyBpbiB0aGUgc2V0LFxuICAgKi9cbiAga2V5cygpOiBJdGVyYWJsZUl0ZXJhdG9yPFQ+IHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFuIGl0ZXJhYmxlIG9mIHZhbHVlcyBpbiB0aGUgc2V0LlxuICAgKi9cbiAgdmFsdWVzKCk6IEl0ZXJhYmxlSXRlcmF0b3I8VD4ge1xuICAgIHJldHVybiB0aGlzW1N5bWJvbC5pdGVyYXRvcl0oKTtcbiAgfVxuXG4gIGFkZChpdGVtOiBULCBkZXBzOiBTZXQ8VD4gfCBUW10gPSBuZXcgU2V0KCkpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShkZXBzKSkge1xuICAgICAgZGVwcyA9IG5ldyBTZXQoZGVwcyk7XG4gICAgfVxuXG4gICAgLy8gVmVyaWZ5IGl0ZW0gaXMgbm90IGFscmVhZHkgaW4gdGhlIHNldC5cbiAgICBpZiAodGhpcy5faXRlbXMuaGFzKGl0ZW0pKSB7XG4gICAgICBjb25zdCBpdGVtRGVwcyA9IHRoaXMuX2l0ZW1zLmdldChpdGVtKSB8fCBuZXcgU2V0PFQ+KCk7XG5cbiAgICAgIC8vIElmIHRoZSBkZXBlbmRlbmN5IGxpc3QgaXMgZXF1YWwsIGp1c3QgcmV0dXJuLCBvdGhlcndpc2UgcmVtb3ZlIGFuZCBrZWVwIGdvaW5nLlxuICAgICAgbGV0IGVxdWFsID0gdHJ1ZTtcbiAgICAgIGZvciAoY29uc3QgZGVwIG9mIGRlcHMpIHtcbiAgICAgICAgaWYgKCFpdGVtRGVwcy5oYXMoZGVwKSkge1xuICAgICAgICAgIGVxdWFsID0gZmFsc2U7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChlcXVhbCkge1xuICAgICAgICBmb3IgKGNvbnN0IGRlcCBvZiBpdGVtRGVwcykge1xuICAgICAgICAgIGlmICghZGVwcy5oYXMoZGVwKSkge1xuICAgICAgICAgICAgZXF1YWwgPSBmYWxzZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZXF1YWwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9pdGVtcy5kZWxldGUoaXRlbSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gVmVyaWZ5IGFsbCBkZXBlbmRlbmNpZXMgYXJlIHBhcnQgb2YgdGhlIFNldC5cbiAgICBmb3IgKGNvbnN0IGRlcCBvZiBkZXBzKSB7XG4gICAgICBpZiAoIXRoaXMuX2l0ZW1zLmhhcyhkZXApKSB7XG4gICAgICAgIHRocm93IG5ldyBEZXBlbmRlbmN5Tm90Rm91bmRFeGNlcHRpb24oKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBWZXJpZnkgdGhlcmUncyBubyBkZXBlbmRlbmN5IGN5Y2xlLlxuICAgIHRoaXMuX2NoZWNrQ2lyY3VsYXJEZXBlbmRlbmNpZXMoaXRlbSwgZGVwcyk7XG5cbiAgICB0aGlzLl9pdGVtcy5zZXQoaXRlbSwgbmV3IFNldChkZXBzKSk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGRlbGV0ZShpdGVtOiBUKSB7XG4gICAgaWYgKCF0aGlzLl9pdGVtcy5oYXMoaXRlbSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgaXQgZnJvbSBhbGwgZGVwZW5kZW5jaWVzIGlmIGZvcmNlID09IHRydWUuXG4gICAgdGhpcy5faXRlbXMuZm9yRWFjaCgodmFsdWUpID0+IHZhbHVlLmRlbGV0ZShpdGVtKSk7XG5cbiAgICByZXR1cm4gdGhpcy5faXRlbXMuZGVsZXRlKGl0ZW0pO1xuICB9XG5cbiAgKltTeW1ib2wuaXRlcmF0b3JdKCkge1xuICAgIGNvbnN0IGNvcHk6IE1hcDxULCBTZXQ8VD4+ID0gbmV3IE1hcCh0aGlzLl9pdGVtcyk7XG5cbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBjb3B5LmVudHJpZXMoKSkge1xuICAgICAgY29weS5zZXQoa2V5LCBuZXcgU2V0KHZhbHVlKSk7XG4gICAgfVxuXG4gICAgd2hpbGUgKGNvcHkuc2l6ZSA+IDApIHtcbiAgICAgIGNvbnN0IHJ1bjogVFtdID0gW107XG4gICAgICAvLyBUYWtlIHRoZSBmaXJzdCBpdGVtIHdpdGhvdXQgZGVwZW5kZW5jaWVzLlxuICAgICAgZm9yIChjb25zdCBbaXRlbSwgZGVwc10gb2YgY29weS5lbnRyaWVzKCkpIHtcbiAgICAgICAgaWYgKGRlcHMuc2l6ZSA9PSAwKSB7XG4gICAgICAgICAgcnVuLnB1c2goaXRlbSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHJ1bikge1xuICAgICAgICBjb3B5LmZvckVhY2goKHMpID0+IHMuZGVsZXRlKGl0ZW0pKTtcbiAgICAgICAgY29weS5kZWxldGUoaXRlbSk7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG5cbiAgICAgIGlmIChydW4ubGVuZ3RoID09IDApIHtcbiAgICAgICAgLy8gdWggb2guLi5cbiAgICAgICAgdGhyb3cgbmV3IENpcmN1bGFyRGVwZW5kZW5jeUZvdW5kRXhjZXB0aW9uKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2V0IFtTeW1ib2wudG9TdHJpbmdUYWddKCk6ICdTZXQnIHtcbiAgICByZXR1cm4gJ1NldCc7XG4gIH1cbn1cbiJdfQ==