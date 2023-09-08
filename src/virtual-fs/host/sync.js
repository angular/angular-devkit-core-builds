"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncDelegateHost = exports.SynchronousDelegateExpectedException = void 0;
const exception_1 = require("../../exception");
class SynchronousDelegateExpectedException extends exception_1.BaseException {
    constructor() {
        super(`Expected a synchronous delegate but got an asynchronous one.`);
    }
}
exports.SynchronousDelegateExpectedException = SynchronousDelegateExpectedException;
/**
 * Implement a synchronous-only host interface (remove the Observable parts).
 */
class SyncDelegateHost {
    _delegate;
    constructor(_delegate) {
        this._delegate = _delegate;
        if (!_delegate.capabilities.synchronous) {
            throw new SynchronousDelegateExpectedException();
        }
    }
    _doSyncCall(observable) {
        let completed = false;
        let result = undefined;
        let errorResult = undefined;
        // Perf note: this is not using an observer object to avoid a performance penalty in RxJS.
        // See https://github.com/ReactiveX/rxjs/pull/5646 for details.
        observable.subscribe((x) => (result = x), (err) => (errorResult = err), () => (completed = true));
        if (errorResult !== undefined) {
            throw errorResult;
        }
        if (!completed) {
            throw new SynchronousDelegateExpectedException();
        }
        // The non-null operation is to work around `void` type. We don't allow to return undefined
        // but ResultT could be void, which is undefined in JavaScript, so this doesn't change the
        // behaviour.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return result;
    }
    get capabilities() {
        return this._delegate.capabilities;
    }
    get delegate() {
        return this._delegate;
    }
    write(path, content) {
        return this._doSyncCall(this._delegate.write(path, content));
    }
    read(path) {
        return this._doSyncCall(this._delegate.read(path));
    }
    delete(path) {
        return this._doSyncCall(this._delegate.delete(path));
    }
    rename(from, to) {
        return this._doSyncCall(this._delegate.rename(from, to));
    }
    list(path) {
        return this._doSyncCall(this._delegate.list(path));
    }
    exists(path) {
        return this._doSyncCall(this._delegate.exists(path));
    }
    isDirectory(path) {
        return this._doSyncCall(this._delegate.isDirectory(path));
    }
    isFile(path) {
        return this._doSyncCall(this._delegate.isFile(path));
    }
    // Some hosts may not support stat.
    stat(path) {
        const result = this._delegate.stat(path);
        if (result) {
            return this._doSyncCall(result);
        }
        else {
            return null;
        }
    }
    watch(path, options) {
        return this._delegate.watch(path, options);
    }
}
exports.SyncDelegateHost = SyncDelegateHost;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3luYy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL3ZpcnR1YWwtZnMvaG9zdC9zeW5jLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILCtDQUFnRDtBQVloRCxNQUFhLG9DQUFxQyxTQUFRLHlCQUFhO0lBQ3JFO1FBQ0UsS0FBSyxDQUFDLDhEQUE4RCxDQUFDLENBQUM7SUFDeEUsQ0FBQztDQUNGO0FBSkQsb0ZBSUM7QUFFRDs7R0FFRztBQUNILE1BQWEsZ0JBQWdCO0lBQ0w7SUFBdEIsWUFBc0IsU0FBa0I7UUFBbEIsY0FBUyxHQUFULFNBQVMsQ0FBUztRQUN0QyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxXQUFXLEVBQUU7WUFDdkMsTUFBTSxJQUFJLG9DQUFvQyxFQUFFLENBQUM7U0FDbEQ7SUFDSCxDQUFDO0lBRVMsV0FBVyxDQUFVLFVBQStCO1FBQzVELElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQztRQUN0QixJQUFJLE1BQU0sR0FBd0IsU0FBUyxDQUFDO1FBQzVDLElBQUksV0FBVyxHQUFzQixTQUFTLENBQUM7UUFDL0MsMEZBQTBGO1FBQzFGLCtEQUErRDtRQUMvRCxVQUFVLENBQUMsU0FBUyxDQUNsQixDQUFDLENBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEVBQzVCLENBQUMsR0FBVSxFQUFFLEVBQUUsQ0FBQyxDQUFDLFdBQVcsR0FBRyxHQUFHLENBQUMsRUFDbkMsR0FBRyxFQUFFLENBQUMsQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLENBQ3pCLENBQUM7UUFFRixJQUFJLFdBQVcsS0FBSyxTQUFTLEVBQUU7WUFDN0IsTUFBTSxXQUFXLENBQUM7U0FDbkI7UUFDRCxJQUFJLENBQUMsU0FBUyxFQUFFO1lBQ2QsTUFBTSxJQUFJLG9DQUFvQyxFQUFFLENBQUM7U0FDbEQ7UUFFRCwyRkFBMkY7UUFDM0YsMEZBQTBGO1FBQzFGLGFBQWE7UUFDYixvRUFBb0U7UUFDcEUsT0FBTyxNQUFPLENBQUM7SUFDakIsQ0FBQztJQUVELElBQUksWUFBWTtRQUNkLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUM7SUFDckMsQ0FBQztJQUNELElBQUksUUFBUTtRQUNWLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUN4QixDQUFDO0lBRUQsS0FBSyxDQUFDLElBQVUsRUFBRSxPQUF1QjtRQUN2QyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDL0QsQ0FBQztJQUNELElBQUksQ0FBQyxJQUFVO1FBQ2IsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUNELE1BQU0sQ0FBQyxJQUFVO1FBQ2YsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDdkQsQ0FBQztJQUNELE1BQU0sQ0FBQyxJQUFVLEVBQUUsRUFBUTtRQUN6QixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUVELElBQUksQ0FBQyxJQUFVO1FBQ2IsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVELE1BQU0sQ0FBQyxJQUFVO1FBQ2YsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDdkQsQ0FBQztJQUNELFdBQVcsQ0FBQyxJQUFVO1FBQ3BCLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzVELENBQUM7SUFDRCxNQUFNLENBQUMsSUFBVTtRQUNmLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3ZELENBQUM7SUFFRCxtQ0FBbUM7SUFDbkMsSUFBSSxDQUFDLElBQVU7UUFDYixNQUFNLE1BQU0sR0FBdUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFN0UsSUFBSSxNQUFNLEVBQUU7WUFDVixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7U0FDakM7YUFBTTtZQUNMLE9BQU8sSUFBSSxDQUFDO1NBQ2I7SUFDSCxDQUFDO0lBRUQsS0FBSyxDQUFDLElBQVUsRUFBRSxPQUEwQjtRQUMxQyxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUM3QyxDQUFDO0NBQ0Y7QUFqRkQsNENBaUZDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IE9ic2VydmFibGUgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IEJhc2VFeGNlcHRpb24gfSBmcm9tICcuLi8uLi9leGNlcHRpb24nO1xuaW1wb3J0IHsgUGF0aCwgUGF0aEZyYWdtZW50IH0gZnJvbSAnLi4vcGF0aCc7XG5pbXBvcnQge1xuICBGaWxlQnVmZmVyLFxuICBGaWxlQnVmZmVyTGlrZSxcbiAgSG9zdCxcbiAgSG9zdENhcGFiaWxpdGllcyxcbiAgSG9zdFdhdGNoRXZlbnQsXG4gIEhvc3RXYXRjaE9wdGlvbnMsXG4gIFN0YXRzLFxufSBmcm9tICcuL2ludGVyZmFjZSc7XG5cbmV4cG9ydCBjbGFzcyBTeW5jaHJvbm91c0RlbGVnYXRlRXhwZWN0ZWRFeGNlcHRpb24gZXh0ZW5kcyBCYXNlRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoYEV4cGVjdGVkIGEgc3luY2hyb25vdXMgZGVsZWdhdGUgYnV0IGdvdCBhbiBhc3luY2hyb25vdXMgb25lLmApO1xuICB9XG59XG5cbi8qKlxuICogSW1wbGVtZW50IGEgc3luY2hyb25vdXMtb25seSBob3N0IGludGVyZmFjZSAocmVtb3ZlIHRoZSBPYnNlcnZhYmxlIHBhcnRzKS5cbiAqL1xuZXhwb3J0IGNsYXNzIFN5bmNEZWxlZ2F0ZUhvc3Q8VCBleHRlbmRzIG9iamVjdCA9IHt9PiB7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCBfZGVsZWdhdGU6IEhvc3Q8VD4pIHtcbiAgICBpZiAoIV9kZWxlZ2F0ZS5jYXBhYmlsaXRpZXMuc3luY2hyb25vdXMpIHtcbiAgICAgIHRocm93IG5ldyBTeW5jaHJvbm91c0RlbGVnYXRlRXhwZWN0ZWRFeGNlcHRpb24oKTtcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgX2RvU3luY0NhbGw8UmVzdWx0VD4ob2JzZXJ2YWJsZTogT2JzZXJ2YWJsZTxSZXN1bHRUPik6IFJlc3VsdFQge1xuICAgIGxldCBjb21wbGV0ZWQgPSBmYWxzZTtcbiAgICBsZXQgcmVzdWx0OiBSZXN1bHRUIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGxldCBlcnJvclJlc3VsdDogRXJyb3IgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgLy8gUGVyZiBub3RlOiB0aGlzIGlzIG5vdCB1c2luZyBhbiBvYnNlcnZlciBvYmplY3QgdG8gYXZvaWQgYSBwZXJmb3JtYW5jZSBwZW5hbHR5IGluIFJ4SlMuXG4gICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdGl2ZVgvcnhqcy9wdWxsLzU2NDYgZm9yIGRldGFpbHMuXG4gICAgb2JzZXJ2YWJsZS5zdWJzY3JpYmUoXG4gICAgICAoeDogUmVzdWx0VCkgPT4gKHJlc3VsdCA9IHgpLFxuICAgICAgKGVycjogRXJyb3IpID0+IChlcnJvclJlc3VsdCA9IGVyciksXG4gICAgICAoKSA9PiAoY29tcGxldGVkID0gdHJ1ZSksXG4gICAgKTtcblxuICAgIGlmIChlcnJvclJlc3VsdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBlcnJvclJlc3VsdDtcbiAgICB9XG4gICAgaWYgKCFjb21wbGV0ZWQpIHtcbiAgICAgIHRocm93IG5ldyBTeW5jaHJvbm91c0RlbGVnYXRlRXhwZWN0ZWRFeGNlcHRpb24oKTtcbiAgICB9XG5cbiAgICAvLyBUaGUgbm9uLW51bGwgb3BlcmF0aW9uIGlzIHRvIHdvcmsgYXJvdW5kIGB2b2lkYCB0eXBlLiBXZSBkb24ndCBhbGxvdyB0byByZXR1cm4gdW5kZWZpbmVkXG4gICAgLy8gYnV0IFJlc3VsdFQgY291bGQgYmUgdm9pZCwgd2hpY2ggaXMgdW5kZWZpbmVkIGluIEphdmFTY3JpcHQsIHNvIHRoaXMgZG9lc24ndCBjaGFuZ2UgdGhlXG4gICAgLy8gYmVoYXZpb3VyLlxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gICAgcmV0dXJuIHJlc3VsdCE7XG4gIH1cblxuICBnZXQgY2FwYWJpbGl0aWVzKCk6IEhvc3RDYXBhYmlsaXRpZXMge1xuICAgIHJldHVybiB0aGlzLl9kZWxlZ2F0ZS5jYXBhYmlsaXRpZXM7XG4gIH1cbiAgZ2V0IGRlbGVnYXRlKCkge1xuICAgIHJldHVybiB0aGlzLl9kZWxlZ2F0ZTtcbiAgfVxuXG4gIHdyaXRlKHBhdGg6IFBhdGgsIGNvbnRlbnQ6IEZpbGVCdWZmZXJMaWtlKTogdm9pZCB7XG4gICAgcmV0dXJuIHRoaXMuX2RvU3luY0NhbGwodGhpcy5fZGVsZWdhdGUud3JpdGUocGF0aCwgY29udGVudCkpO1xuICB9XG4gIHJlYWQocGF0aDogUGF0aCk6IEZpbGVCdWZmZXIge1xuICAgIHJldHVybiB0aGlzLl9kb1N5bmNDYWxsKHRoaXMuX2RlbGVnYXRlLnJlYWQocGF0aCkpO1xuICB9XG4gIGRlbGV0ZShwYXRoOiBQYXRoKTogdm9pZCB7XG4gICAgcmV0dXJuIHRoaXMuX2RvU3luY0NhbGwodGhpcy5fZGVsZWdhdGUuZGVsZXRlKHBhdGgpKTtcbiAgfVxuICByZW5hbWUoZnJvbTogUGF0aCwgdG86IFBhdGgpOiB2b2lkIHtcbiAgICByZXR1cm4gdGhpcy5fZG9TeW5jQ2FsbCh0aGlzLl9kZWxlZ2F0ZS5yZW5hbWUoZnJvbSwgdG8pKTtcbiAgfVxuXG4gIGxpc3QocGF0aDogUGF0aCk6IFBhdGhGcmFnbWVudFtdIHtcbiAgICByZXR1cm4gdGhpcy5fZG9TeW5jQ2FsbCh0aGlzLl9kZWxlZ2F0ZS5saXN0KHBhdGgpKTtcbiAgfVxuXG4gIGV4aXN0cyhwYXRoOiBQYXRoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuX2RvU3luY0NhbGwodGhpcy5fZGVsZWdhdGUuZXhpc3RzKHBhdGgpKTtcbiAgfVxuICBpc0RpcmVjdG9yeShwYXRoOiBQYXRoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuX2RvU3luY0NhbGwodGhpcy5fZGVsZWdhdGUuaXNEaXJlY3RvcnkocGF0aCkpO1xuICB9XG4gIGlzRmlsZShwYXRoOiBQYXRoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuX2RvU3luY0NhbGwodGhpcy5fZGVsZWdhdGUuaXNGaWxlKHBhdGgpKTtcbiAgfVxuXG4gIC8vIFNvbWUgaG9zdHMgbWF5IG5vdCBzdXBwb3J0IHN0YXQuXG4gIHN0YXQocGF0aDogUGF0aCk6IFN0YXRzPFQ+IHwgbnVsbCB7XG4gICAgY29uc3QgcmVzdWx0OiBPYnNlcnZhYmxlPFN0YXRzPFQ+IHwgbnVsbD4gfCBudWxsID0gdGhpcy5fZGVsZWdhdGUuc3RhdChwYXRoKTtcblxuICAgIGlmIChyZXN1bHQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9kb1N5bmNDYWxsKHJlc3VsdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHdhdGNoKHBhdGg6IFBhdGgsIG9wdGlvbnM/OiBIb3N0V2F0Y2hPcHRpb25zKTogT2JzZXJ2YWJsZTxIb3N0V2F0Y2hFdmVudD4gfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5fZGVsZWdhdGUud2F0Y2gocGF0aCwgb3B0aW9ucyk7XG4gIH1cbn1cbiJdfQ==