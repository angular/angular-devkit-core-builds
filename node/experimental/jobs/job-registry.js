"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const rxjs_1 = require("rxjs");
const src_1 = require("../../../src");
const resolve_1 = require("../../resolve");
class NodeModuleJobRegistry {
    constructor(_resolveLocal = true, _resolveGlobal = false) {
        this._resolveLocal = _resolveLocal;
        this._resolveGlobal = _resolveGlobal;
    }
    _resolve(name) {
        try {
            return resolve_1.resolve(name, {
                checkLocal: this._resolveLocal,
                checkGlobal: this._resolveGlobal,
                basedir: __dirname,
            });
        }
        catch (e) {
            if (e instanceof resolve_1.ModuleNotFoundException) {
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
            return rxjs_1.of(null);
        }
        const pkg = require(resolvedPath);
        const handler = pkg[exportName || 'default'];
        if (!handler) {
            return rxjs_1.of(null);
        }
        // TODO: this should be unknown
        // tslint:disable-next-line:no-any
        function _getValue(...fields) {
            return fields.find(x => src_1.schema.isJsonSchema(x)) || true;
        }
        const argument = _getValue(pkg.argument, handler.argument);
        const input = _getValue(pkg.input, handler.input);
        const output = _getValue(pkg.output, handler.output);
        const channels = _getValue(pkg.channels, handler.channels);
        return rxjs_1.of(Object.assign(handler.bind(undefined), {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam9iLXJlZ2lzdHJ5LmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL25vZGUvZXhwZXJpbWVudGFsL2pvYnMvam9iLXJlZ2lzdHJ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsK0JBQXNDO0FBQ3RDLHNDQUFvRjtBQUNwRiwyQ0FBaUU7QUFFakUsTUFBYSxxQkFBcUI7SUFNaEMsWUFBMkIsZ0JBQWdCLElBQUksRUFBVSxpQkFBaUIsS0FBSztRQUFwRCxrQkFBYSxHQUFiLGFBQWEsQ0FBTztRQUFVLG1CQUFjLEdBQWQsY0FBYyxDQUFRO0lBQy9FLENBQUM7SUFFUyxRQUFRLENBQUMsSUFBWTtRQUM3QixJQUFJO1lBQ0YsT0FBTyxpQkFBTyxDQUFDLElBQUksRUFBRTtnQkFDbkIsVUFBVSxFQUFFLElBQUksQ0FBQyxhQUFhO2dCQUM5QixXQUFXLEVBQUUsSUFBSSxDQUFDLGNBQWM7Z0JBQ2hDLE9BQU8sRUFBRSxTQUFTO2FBQ25CLENBQUMsQ0FBQztTQUNKO1FBQUMsT0FBTyxDQUFDLEVBQUU7WUFDVixJQUFJLENBQUMsWUFBWSxpQ0FBdUIsRUFBRTtnQkFDeEMsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUNELE1BQU0sQ0FBQyxDQUFDO1NBQ1Q7SUFDSCxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxHQUFHLENBSUQsSUFBb0M7UUFFcEMsTUFBTSxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUVwRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDakIsT0FBTyxTQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDakI7UUFFRCxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDbEMsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLFVBQVUsSUFBSSxTQUFTLENBQUMsQ0FBQztRQUM3QyxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ1osT0FBTyxTQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDakI7UUFFRCwrQkFBK0I7UUFDL0Isa0NBQWtDO1FBQ2xDLFNBQVMsU0FBUyxDQUFDLEdBQUcsTUFBYTtZQUNqQyxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxZQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDO1FBQzFELENBQUM7UUFFRCxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDM0QsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2xELE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNyRCxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFM0QsT0FBTyxTQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFO1lBQy9DLGNBQWMsRUFBRTtnQkFDZCxRQUFRO2dCQUNSLEtBQUs7Z0JBQ0wsTUFBTTtnQkFDTixRQUFRO2FBQ1Q7U0FDRixDQUFDLENBQUMsQ0FBQztJQUNOLENBQUM7Q0FDRjtBQXJFRCxzREFxRUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBvZiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgSnNvblZhbHVlLCBleHBlcmltZW50YWwgYXMgY29yZV9leHBlcmltZW50YWwsIHNjaGVtYSB9IGZyb20gJy4uLy4uLy4uL3NyYyc7XG5pbXBvcnQgeyBNb2R1bGVOb3RGb3VuZEV4Y2VwdGlvbiwgcmVzb2x2ZSB9IGZyb20gJy4uLy4uL3Jlc29sdmUnO1xuXG5leHBvcnQgY2xhc3MgTm9kZU1vZHVsZUpvYlJlZ2lzdHJ5PE1pbmltdW1Bcmd1bWVudFZhbHVlVCBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZSxcbiAgTWluaW11bUlucHV0VmFsdWVUIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuICBNaW5pbXVtT3V0cHV0VmFsdWVUIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuPiBpbXBsZW1lbnRzIGNvcmVfZXhwZXJpbWVudGFsLmpvYnMuUmVnaXN0cnk8TWluaW11bUFyZ3VtZW50VmFsdWVULFxuICBNaW5pbXVtSW5wdXRWYWx1ZVQsXG4gIE1pbmltdW1PdXRwdXRWYWx1ZVQ+IHtcbiAgcHVibGljIGNvbnN0cnVjdG9yKHByaXZhdGUgX3Jlc29sdmVMb2NhbCA9IHRydWUsIHByaXZhdGUgX3Jlc29sdmVHbG9iYWwgPSBmYWxzZSkge1xuICB9XG5cbiAgcHJvdGVjdGVkIF9yZXNvbHZlKG5hbWU6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZShuYW1lLCB7XG4gICAgICAgIGNoZWNrTG9jYWw6IHRoaXMuX3Jlc29sdmVMb2NhbCxcbiAgICAgICAgY2hlY2tHbG9iYWw6IHRoaXMuX3Jlc29sdmVHbG9iYWwsXG4gICAgICAgIGJhc2VkaXI6IF9fZGlybmFtZSxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgTW9kdWxlTm90Rm91bmRFeGNlcHRpb24pIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSBqb2IgZGVzY3JpcHRpb24gZm9yIGEgbmFtZWQgam9iLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBUaGUgbmFtZSBvZiB0aGUgam9iLlxuICAgKiBAcmV0dXJucyBBIGRlc2NyaXB0aW9uLCBvciBudWxsIGlmIHRoZSBqb2IgaXMgbm90IHJlZ2lzdGVyZWQuXG4gICAqL1xuICBnZXQ8QSBleHRlbmRzIE1pbmltdW1Bcmd1bWVudFZhbHVlVCxcbiAgICBJIGV4dGVuZHMgTWluaW11bUlucHV0VmFsdWVULFxuICAgIE8gZXh0ZW5kcyBNaW5pbXVtT3V0cHV0VmFsdWVULFxuICAgID4oXG4gICAgbmFtZTogY29yZV9leHBlcmltZW50YWwuam9icy5Kb2JOYW1lLFxuICApOiBPYnNlcnZhYmxlPGNvcmVfZXhwZXJpbWVudGFsLmpvYnMuSm9iSGFuZGxlcjxBLCBJLCBPPiB8IG51bGw+IHtcbiAgICBjb25zdCBbbW9kdWxlTmFtZSwgZXhwb3J0TmFtZV0gPSBuYW1lLnNwbGl0KC8jLywgMik7XG5cbiAgICBjb25zdCByZXNvbHZlZFBhdGggPSB0aGlzLl9yZXNvbHZlKG1vZHVsZU5hbWUpO1xuICAgIGlmICghcmVzb2x2ZWRQYXRoKSB7XG4gICAgICByZXR1cm4gb2YobnVsbCk7XG4gICAgfVxuXG4gICAgY29uc3QgcGtnID0gcmVxdWlyZShyZXNvbHZlZFBhdGgpO1xuICAgIGNvbnN0IGhhbmRsZXIgPSBwa2dbZXhwb3J0TmFtZSB8fCAnZGVmYXVsdCddO1xuICAgIGlmICghaGFuZGxlcikge1xuICAgICAgcmV0dXJuIG9mKG51bGwpO1xuICAgIH1cblxuICAgIC8vIFRPRE86IHRoaXMgc2hvdWxkIGJlIHVua25vd25cbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgZnVuY3Rpb24gX2dldFZhbHVlKC4uLmZpZWxkczogYW55W10pIHtcbiAgICAgIHJldHVybiBmaWVsZHMuZmluZCh4ID0+IHNjaGVtYS5pc0pzb25TY2hlbWEoeCkpIHx8IHRydWU7XG4gICAgfVxuXG4gICAgY29uc3QgYXJndW1lbnQgPSBfZ2V0VmFsdWUocGtnLmFyZ3VtZW50LCBoYW5kbGVyLmFyZ3VtZW50KTtcbiAgICBjb25zdCBpbnB1dCA9IF9nZXRWYWx1ZShwa2cuaW5wdXQsIGhhbmRsZXIuaW5wdXQpO1xuICAgIGNvbnN0IG91dHB1dCA9IF9nZXRWYWx1ZShwa2cub3V0cHV0LCBoYW5kbGVyLm91dHB1dCk7XG4gICAgY29uc3QgY2hhbm5lbHMgPSBfZ2V0VmFsdWUocGtnLmNoYW5uZWxzLCBoYW5kbGVyLmNoYW5uZWxzKTtcblxuICAgIHJldHVybiBvZihPYmplY3QuYXNzaWduKGhhbmRsZXIuYmluZCh1bmRlZmluZWQpLCB7XG4gICAgICBqb2JEZXNjcmlwdGlvbjoge1xuICAgICAgICBhcmd1bWVudCxcbiAgICAgICAgaW5wdXQsXG4gICAgICAgIG91dHB1dCxcbiAgICAgICAgY2hhbm5lbHMsXG4gICAgICB9LFxuICAgIH0pKTtcbiAgfVxufVxuIl19