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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam9iLXJlZ2lzdHJ5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9ub2RlL2V4cGVyaW1lbnRhbC9qb2JzL2pvYi1yZWdpc3RyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQkFBc0M7QUFDdEMsc0NBQW9GO0FBRXBGLE1BQWEscUJBQXFCO0lBT3RCLFFBQVEsQ0FBQyxJQUFZO1FBQzdCLElBQUk7WUFDRixPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDOUI7UUFBQyxPQUFPLENBQUMsRUFBRTtZQUNWLElBQUssQ0FBMkIsQ0FBQyxJQUFJLEtBQUssa0JBQWtCLEVBQUU7Z0JBQzVELE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFDRCxNQUFNLENBQUMsQ0FBQztTQUNUO0lBQ0gsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsR0FBRyxDQUNELElBQW9DO1FBRXBDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFcEQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMvQyxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ2pCLE9BQU8sSUFBQSxTQUFFLEVBQUMsSUFBSSxDQUFDLENBQUM7U0FDakI7UUFFRCxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDbEMsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLFVBQVUsSUFBSSxTQUFTLENBQUMsQ0FBQztRQUM3QyxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ1osT0FBTyxJQUFBLFNBQUUsRUFBQyxJQUFJLENBQUMsQ0FBQztTQUNqQjtRQUVELFNBQVMsU0FBUyxDQUFDLEdBQUcsTUFBaUI7WUFDckMsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxZQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDO1FBQzVELENBQUM7UUFFRCxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDM0QsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2xELE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNyRCxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFM0QsT0FBTyxJQUFBLFNBQUUsRUFDUCxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUU7WUFDckMsY0FBYyxFQUFFO2dCQUNkLFFBQVE7Z0JBQ1IsS0FBSztnQkFDTCxNQUFNO2dCQUNOLFFBQVE7YUFDVDtTQUNGLENBQUMsQ0FDSCxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBNURELHNEQTREQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBvZiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgSnNvblZhbHVlLCBleHBlcmltZW50YWwgYXMgY29yZV9leHBlcmltZW50YWwsIHNjaGVtYSB9IGZyb20gJy4uLy4uLy4uL3NyYyc7XG5cbmV4cG9ydCBjbGFzcyBOb2RlTW9kdWxlSm9iUmVnaXN0cnk8XG4gIE1pbmltdW1Bcmd1bWVudFZhbHVlVCBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZSxcbiAgTWluaW11bUlucHV0VmFsdWVUIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuICBNaW5pbXVtT3V0cHV0VmFsdWVUIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuPiBpbXBsZW1lbnRzXG4gICAgY29yZV9leHBlcmltZW50YWwuam9icy5SZWdpc3RyeTxNaW5pbXVtQXJndW1lbnRWYWx1ZVQsIE1pbmltdW1JbnB1dFZhbHVlVCwgTWluaW11bU91dHB1dFZhbHVlVD5cbntcbiAgcHJvdGVjdGVkIF9yZXNvbHZlKG5hbWU6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gcmVxdWlyZS5yZXNvbHZlKG5hbWUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmICgoZSBhcyBOb2RlSlMuRXJybm9FeGNlcHRpb24pLmNvZGUgPT09ICdNT0RVTEVfTk9UX0ZPVU5EJykge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIGpvYiBkZXNjcmlwdGlvbiBmb3IgYSBuYW1lZCBqb2IuXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBqb2IuXG4gICAqIEByZXR1cm5zIEEgZGVzY3JpcHRpb24sIG9yIG51bGwgaWYgdGhlIGpvYiBpcyBub3QgcmVnaXN0ZXJlZC5cbiAgICovXG4gIGdldDxBIGV4dGVuZHMgTWluaW11bUFyZ3VtZW50VmFsdWVULCBJIGV4dGVuZHMgTWluaW11bUlucHV0VmFsdWVULCBPIGV4dGVuZHMgTWluaW11bU91dHB1dFZhbHVlVD4oXG4gICAgbmFtZTogY29yZV9leHBlcmltZW50YWwuam9icy5Kb2JOYW1lLFxuICApOiBPYnNlcnZhYmxlPGNvcmVfZXhwZXJpbWVudGFsLmpvYnMuSm9iSGFuZGxlcjxBLCBJLCBPPiB8IG51bGw+IHtcbiAgICBjb25zdCBbbW9kdWxlTmFtZSwgZXhwb3J0TmFtZV0gPSBuYW1lLnNwbGl0KC8jLywgMik7XG5cbiAgICBjb25zdCByZXNvbHZlZFBhdGggPSB0aGlzLl9yZXNvbHZlKG1vZHVsZU5hbWUpO1xuICAgIGlmICghcmVzb2x2ZWRQYXRoKSB7XG4gICAgICByZXR1cm4gb2YobnVsbCk7XG4gICAgfVxuXG4gICAgY29uc3QgcGtnID0gcmVxdWlyZShyZXNvbHZlZFBhdGgpO1xuICAgIGNvbnN0IGhhbmRsZXIgPSBwa2dbZXhwb3J0TmFtZSB8fCAnZGVmYXVsdCddO1xuICAgIGlmICghaGFuZGxlcikge1xuICAgICAgcmV0dXJuIG9mKG51bGwpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9nZXRWYWx1ZSguLi5maWVsZHM6IHVua25vd25bXSkge1xuICAgICAgcmV0dXJuIGZpZWxkcy5maW5kKCh4KSA9PiBzY2hlbWEuaXNKc29uU2NoZW1hKHgpKSB8fCB0cnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGFyZ3VtZW50ID0gX2dldFZhbHVlKHBrZy5hcmd1bWVudCwgaGFuZGxlci5hcmd1bWVudCk7XG4gICAgY29uc3QgaW5wdXQgPSBfZ2V0VmFsdWUocGtnLmlucHV0LCBoYW5kbGVyLmlucHV0KTtcbiAgICBjb25zdCBvdXRwdXQgPSBfZ2V0VmFsdWUocGtnLm91dHB1dCwgaGFuZGxlci5vdXRwdXQpO1xuICAgIGNvbnN0IGNoYW5uZWxzID0gX2dldFZhbHVlKHBrZy5jaGFubmVscywgaGFuZGxlci5jaGFubmVscyk7XG5cbiAgICByZXR1cm4gb2YoXG4gICAgICBPYmplY3QuYXNzaWduKGhhbmRsZXIuYmluZCh1bmRlZmluZWQpLCB7XG4gICAgICAgIGpvYkRlc2NyaXB0aW9uOiB7XG4gICAgICAgICAgYXJndW1lbnQsXG4gICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgb3V0cHV0LFxuICAgICAgICAgIGNoYW5uZWxzLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxufVxuIl19