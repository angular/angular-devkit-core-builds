"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeModuleJobRegistry = void 0;
const rxjs_1 = require("rxjs");
const src_1 = require("../../../src");
class NodeModuleJobRegistry {
    _resolve(name) {
        try {
            return require.resolve(name);
        }
        catch (e) {
            if (e.code === 'MODULE_NOT_FOUND') {
                return null;
            }
            throw e;
        }
    }
    /**
     * Get a job description for a named job.
     *
     * @param name The name of the job.
     * @returns A description, or null if the job is not registered.
     */
    get(name) {
        const [moduleName, exportName] = name.split(/#/, 2);
        const resolvedPath = this._resolve(moduleName);
        if (!resolvedPath) {
            return (0, rxjs_1.of)(null);
        }
        const pkg = require(resolvedPath);
        const handler = pkg[exportName || 'default'];
        if (!handler) {
            return (0, rxjs_1.of)(null);
        }
        function _getValue(...fields) {
            return fields.find((x) => src_1.schema.isJsonSchema(x)) || true;
        }
        const argument = _getValue(pkg.argument, handler.argument);
        const input = _getValue(pkg.input, handler.input);
        const output = _getValue(pkg.output, handler.output);
        const channels = _getValue(pkg.channels, handler.channels);
        return (0, rxjs_1.of)(Object.assign(handler.bind(undefined), {
            jobDescription: {
                argument,
                input,
                output,
                channels,
            },
        }));
    }
}
exports.NodeModuleJobRegistry = NodeModuleJobRegistry;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam9iLXJlZ2lzdHJ5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9ub2RlL2V4cGVyaW1lbnRhbC9qb2JzL2pvYi1yZWdpc3RyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQkFBc0M7QUFDdEMsc0NBQW9GO0FBRXBGLE1BQWEscUJBQXFCO0lBVXRCLFFBQVEsQ0FBQyxJQUFZO1FBQzdCLElBQUk7WUFDRixPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDOUI7UUFBQyxPQUFPLENBQUMsRUFBRTtZQUNWLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxrQkFBa0IsRUFBRTtnQkFDakMsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUNELE1BQU0sQ0FBQyxDQUFDO1NBQ1Q7SUFDSCxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxHQUFHLENBQ0QsSUFBb0M7UUFFcEMsTUFBTSxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUVwRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDakIsT0FBTyxJQUFBLFNBQUUsRUFBQyxJQUFJLENBQUMsQ0FBQztTQUNqQjtRQUVELE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUNsQyxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsVUFBVSxJQUFJLFNBQVMsQ0FBQyxDQUFDO1FBQzdDLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDWixPQUFPLElBQUEsU0FBRSxFQUFDLElBQUksQ0FBQyxDQUFDO1NBQ2pCO1FBRUQsU0FBUyxTQUFTLENBQUMsR0FBRyxNQUFpQjtZQUNyQyxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLFlBQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUM7UUFDNUQsQ0FBQztRQUVELE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMzRCxNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbEQsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JELE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUUzRCxPQUFPLElBQUEsU0FBRSxFQUNQLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUNyQyxjQUFjLEVBQUU7Z0JBQ2QsUUFBUTtnQkFDUixLQUFLO2dCQUNMLE1BQU07Z0JBQ04sUUFBUTthQUNUO1NBQ0YsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDO0NBQ0Y7QUEvREQsc0RBK0RDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IE9ic2VydmFibGUsIG9mIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBKc29uVmFsdWUsIGV4cGVyaW1lbnRhbCBhcyBjb3JlX2V4cGVyaW1lbnRhbCwgc2NoZW1hIH0gZnJvbSAnLi4vLi4vLi4vc3JjJztcblxuZXhwb3J0IGNsYXNzIE5vZGVNb2R1bGVKb2JSZWdpc3RyeTxcbiAgTWluaW11bUFyZ3VtZW50VmFsdWVUIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuICBNaW5pbXVtSW5wdXRWYWx1ZVQgZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWUsXG4gIE1pbmltdW1PdXRwdXRWYWx1ZVQgZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWVcbj4gaW1wbGVtZW50c1xuICAgIGNvcmVfZXhwZXJpbWVudGFsLmpvYnMuUmVnaXN0cnk8XG4gICAgICBNaW5pbXVtQXJndW1lbnRWYWx1ZVQsXG4gICAgICBNaW5pbXVtSW5wdXRWYWx1ZVQsXG4gICAgICBNaW5pbXVtT3V0cHV0VmFsdWVUXG4gICAgPiB7XG4gIHByb3RlY3RlZCBfcmVzb2x2ZShuYW1lOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHJlcXVpcmUucmVzb2x2ZShuYW1lKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZS5jb2RlID09PSAnTU9EVUxFX05PVF9GT1VORCcpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSBqb2IgZGVzY3JpcHRpb24gZm9yIGEgbmFtZWQgam9iLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBUaGUgbmFtZSBvZiB0aGUgam9iLlxuICAgKiBAcmV0dXJucyBBIGRlc2NyaXB0aW9uLCBvciBudWxsIGlmIHRoZSBqb2IgaXMgbm90IHJlZ2lzdGVyZWQuXG4gICAqL1xuICBnZXQ8QSBleHRlbmRzIE1pbmltdW1Bcmd1bWVudFZhbHVlVCwgSSBleHRlbmRzIE1pbmltdW1JbnB1dFZhbHVlVCwgTyBleHRlbmRzIE1pbmltdW1PdXRwdXRWYWx1ZVQ+KFxuICAgIG5hbWU6IGNvcmVfZXhwZXJpbWVudGFsLmpvYnMuSm9iTmFtZSxcbiAgKTogT2JzZXJ2YWJsZTxjb3JlX2V4cGVyaW1lbnRhbC5qb2JzLkpvYkhhbmRsZXI8QSwgSSwgTz4gfCBudWxsPiB7XG4gICAgY29uc3QgW21vZHVsZU5hbWUsIGV4cG9ydE5hbWVdID0gbmFtZS5zcGxpdCgvIy8sIDIpO1xuXG4gICAgY29uc3QgcmVzb2x2ZWRQYXRoID0gdGhpcy5fcmVzb2x2ZShtb2R1bGVOYW1lKTtcbiAgICBpZiAoIXJlc29sdmVkUGF0aCkge1xuICAgICAgcmV0dXJuIG9mKG51bGwpO1xuICAgIH1cblxuICAgIGNvbnN0IHBrZyA9IHJlcXVpcmUocmVzb2x2ZWRQYXRoKTtcbiAgICBjb25zdCBoYW5kbGVyID0gcGtnW2V4cG9ydE5hbWUgfHwgJ2RlZmF1bHQnXTtcbiAgICBpZiAoIWhhbmRsZXIpIHtcbiAgICAgIHJldHVybiBvZihudWxsKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfZ2V0VmFsdWUoLi4uZmllbGRzOiB1bmtub3duW10pIHtcbiAgICAgIHJldHVybiBmaWVsZHMuZmluZCgoeCkgPT4gc2NoZW1hLmlzSnNvblNjaGVtYSh4KSkgfHwgdHJ1ZTtcbiAgICB9XG5cbiAgICBjb25zdCBhcmd1bWVudCA9IF9nZXRWYWx1ZShwa2cuYXJndW1lbnQsIGhhbmRsZXIuYXJndW1lbnQpO1xuICAgIGNvbnN0IGlucHV0ID0gX2dldFZhbHVlKHBrZy5pbnB1dCwgaGFuZGxlci5pbnB1dCk7XG4gICAgY29uc3Qgb3V0cHV0ID0gX2dldFZhbHVlKHBrZy5vdXRwdXQsIGhhbmRsZXIub3V0cHV0KTtcbiAgICBjb25zdCBjaGFubmVscyA9IF9nZXRWYWx1ZShwa2cuY2hhbm5lbHMsIGhhbmRsZXIuY2hhbm5lbHMpO1xuXG4gICAgcmV0dXJuIG9mKFxuICAgICAgT2JqZWN0LmFzc2lnbihoYW5kbGVyLmJpbmQodW5kZWZpbmVkKSwge1xuICAgICAgICBqb2JEZXNjcmlwdGlvbjoge1xuICAgICAgICAgIGFyZ3VtZW50LFxuICAgICAgICAgIGlucHV0LFxuICAgICAgICAgIG91dHB1dCxcbiAgICAgICAgICBjaGFubmVscyxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbn1cbiJdfQ==