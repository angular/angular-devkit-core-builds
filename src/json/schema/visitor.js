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
const operators_1 = require("rxjs/operators");
const utils_1 = require("../../utils");
const pointer_1 = require("./pointer");
function _getObjectSubSchema(schema, key) {
    if (typeof schema !== 'object' || schema === null) {
        return undefined;
    }
    // Is it an object schema?
    if (typeof schema.properties == 'object' || schema.type == 'object') {
        if (typeof schema.properties == 'object'
            && typeof schema.properties[key] == 'object') {
            return schema.properties[key];
        }
        if (typeof schema.additionalProperties == 'object') {
            return schema.additionalProperties;
        }
        return undefined;
    }
    // Is it an array schema?
    if (typeof schema.items == 'object' || schema.type == 'array') {
        return typeof schema.items == 'object' ? schema.items : undefined;
    }
    return undefined;
}
function _visitJsonRecursive(json, visitor, ptr, schema, refResolver, context, // tslint:disable-line:no-any
root) {
    if (schema && schema.hasOwnProperty('$ref') && typeof schema['$ref'] == 'string') {
        if (refResolver) {
            const resolved = refResolver(schema['$ref'], context);
            schema = resolved.schema;
            context = resolved.context;
        }
    }
    const value = visitor(json, ptr, schema, root);
    return (utils_1.isObservable(value)
        ? value
        : rxjs_1.of(value)).pipe(operators_1.concatMap((value) => {
        if (Array.isArray(value)) {
            return rxjs_1.concat(rxjs_1.from(value).pipe(operators_1.mergeMap((item, i) => {
                return _visitJsonRecursive(item, visitor, pointer_1.joinJsonPointer(ptr, '' + i), _getObjectSubSchema(schema, '' + i), refResolver, context, root || value).pipe(operators_1.tap(x => value[i] = x));
            }), operators_1.ignoreElements()), rxjs_1.of(value));
        }
        else if (typeof value == 'object' && value !== null) {
            return rxjs_1.concat(rxjs_1.from(Object.getOwnPropertyNames(value)).pipe(operators_1.mergeMap(key => {
                return _visitJsonRecursive(value[key], visitor, pointer_1.joinJsonPointer(ptr, key), _getObjectSubSchema(schema, key), refResolver, context, root || value).pipe(operators_1.tap(x => value[key] = x));
            }), operators_1.ignoreElements()), rxjs_1.of(value));
        }
        else {
            return rxjs_1.of(value);
        }
    }));
}
/**
 * Visit all the properties in a JSON object, allowing to transform them. It supports calling
 * properties synchronously or asynchronously (through Observables).
 * The original object can be mutated or replaced entirely. In case where it's replaced, the new
 * value is returned. When it's mutated though the original object will be changed.
 *
 * Please note it is possible to have an infinite loop here (which will result in a stack overflow)
 * if you return 2 objects that references each others (or the same object all the time).
 *
 * @param {JsonValue} json The Json value to visit.
 * @param {JsonVisitor} visitor A function that will be called on every items.
 * @param {JsonObject} schema A JSON schema to pass through to the visitor (where possible).
 * @param refResolver a function to resolve references in the schema.
 * @returns {Observable< | undefined>} The observable of the new root, if the root changed.
 */
function visitJson(json, visitor, schema, refResolver, context) {
    return _visitJsonRecursive(json, visitor, pointer_1.buildJsonPointer([]), schema, refResolver, context);
}
exports.visitJson = visitJson;
function visitJsonSchema(schema, visitor) {
    const keywords = {
        additionalItems: true,
        items: true,
        contains: true,
        additionalProperties: true,
        propertyNames: true,
        not: true,
    };
    const arrayKeywords = {
        items: true,
        allOf: true,
        anyOf: true,
        oneOf: true,
    };
    const propsKeywords = {
        definitions: true,
        properties: true,
        patternProperties: true,
        additionalProperties: true,
        dependencies: true,
        items: true,
    };
    function _traverse(schema, jsonPtr, rootSchema, parentSchema, keyIndex) {
        if (schema && typeof schema == 'object' && !Array.isArray(schema)) {
            visitor(schema, jsonPtr, parentSchema, keyIndex);
            for (const key of Object.keys(schema)) {
                const sch = schema[key];
                if (key in propsKeywords) {
                    if (sch && typeof sch == 'object') {
                        for (const prop of Object.keys(sch)) {
                            _traverse(sch[prop], pointer_1.joinJsonPointer(jsonPtr, key, prop), rootSchema, schema, prop);
                        }
                    }
                }
                else if (key in keywords) {
                    _traverse(sch, pointer_1.joinJsonPointer(jsonPtr, key), rootSchema, schema, key);
                }
                else if (key in arrayKeywords) {
                    if (Array.isArray(sch)) {
                        for (let i = 0; i < sch.length; i++) {
                            _traverse(sch[i], pointer_1.joinJsonPointer(jsonPtr, key, '' + i), rootSchema, sch, '' + i);
                        }
                    }
                }
                else if (Array.isArray(sch)) {
                    for (let i = 0; i < sch.length; i++) {
                        _traverse(sch[i], pointer_1.joinJsonPointer(jsonPtr, key, '' + i), rootSchema, sch, '' + i);
                    }
                }
            }
        }
    }
    _traverse(schema, pointer_1.buildJsonPointer([]), schema);
}
exports.visitJsonSchema = visitJsonSchema;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlzaXRvci5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvanNvbi9zY2hlbWEvdmlzaXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILCtCQUFvRTtBQUNwRSw4Q0FBMEU7QUFDMUUsdUNBQTJDO0FBRzNDLHVDQUE4RDtBQU85RCxTQUFTLG1CQUFtQixDQUMxQixNQUE4QixFQUM5QixHQUFXO0lBRVgsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLElBQUksTUFBTSxLQUFLLElBQUksRUFBRTtRQUNqRCxPQUFPLFNBQVMsQ0FBQztLQUNsQjtJQUVELDBCQUEwQjtJQUMxQixJQUFJLE9BQU8sTUFBTSxDQUFDLFVBQVUsSUFBSSxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksSUFBSSxRQUFRLEVBQUU7UUFDbkUsSUFBSSxPQUFPLE1BQU0sQ0FBQyxVQUFVLElBQUksUUFBUTtlQUNqQyxPQUFRLE1BQU0sQ0FBQyxVQUF5QixDQUFDLEdBQUcsQ0FBQyxJQUFJLFFBQVEsRUFBRTtZQUNoRSxPQUFRLE1BQU0sQ0FBQyxVQUF5QixDQUFDLEdBQUcsQ0FBZSxDQUFDO1NBQzdEO1FBQ0QsSUFBSSxPQUFPLE1BQU0sQ0FBQyxvQkFBb0IsSUFBSSxRQUFRLEVBQUU7WUFDbEQsT0FBTyxNQUFNLENBQUMsb0JBQWtDLENBQUM7U0FDbEQ7UUFFRCxPQUFPLFNBQVMsQ0FBQztLQUNsQjtJQUVELHlCQUF5QjtJQUN6QixJQUFJLE9BQU8sTUFBTSxDQUFDLEtBQUssSUFBSSxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksSUFBSSxPQUFPLEVBQUU7UUFDN0QsT0FBTyxPQUFPLE1BQU0sQ0FBQyxLQUFLLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBRSxNQUFNLENBQUMsS0FBb0IsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0tBQ25GO0lBRUQsT0FBTyxTQUFTLENBQUM7QUFD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Q1AsR0FBRyxDQUFDLENBQUMsQ0FBYyxFQUNuQix5QkFBZSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUNyQyxVQUFVLEVBQ1YsR0FBRyxFQUNILEVBQUUsR0FBRyxDQUFDLENBQ1AsQ0FBQztxQkFDSDtpQkFDRjthQUNGO1NBQ0Y7SUFDSCxDQUFDO0lBRUQsU0FBUyxDQUFDLE1BQU0sRUFBRSwwQkFBZ0IsQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNsRCxDQUFDO0FBaEZELDBDQWdGQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IE9ic2VydmFibGUsIGNvbmNhdCwgZnJvbSwgb2YgYXMgb2JzZXJ2YWJsZU9mIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBjb25jYXRNYXAsIGlnbm9yZUVsZW1lbnRzLCBtZXJnZU1hcCwgdGFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgaXNPYnNlcnZhYmxlIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgSnNvbkFycmF5LCBKc29uT2JqZWN0LCBKc29uVmFsdWUgfSBmcm9tICcuLi9pbnRlcmZhY2UnO1xuaW1wb3J0IHsgSnNvblBvaW50ZXIsIEpzb25TY2hlbWFWaXNpdG9yLCBKc29uVmlzaXRvciB9IGZyb20gJy4vaW50ZXJmYWNlJztcbmltcG9ydCB7IGJ1aWxkSnNvblBvaW50ZXIsIGpvaW5Kc29uUG9pbnRlciB9IGZyb20gJy4vcG9pbnRlcic7XG5cblxuZXhwb3J0IGludGVyZmFjZSBSZWZlcmVuY2VSZXNvbHZlcjxDb250ZXh0VD4ge1xuICAocmVmOiBzdHJpbmcsIGNvbnRleHQ/OiBDb250ZXh0VCk6IHsgY29udGV4dD86IENvbnRleHRULCBzY2hlbWE/OiBKc29uT2JqZWN0IH07XG59XG5cbmZ1bmN0aW9uIF9nZXRPYmplY3RTdWJTY2hlbWEoXG4gIHNjaGVtYTogSnNvbk9iamVjdCB8IHVuZGVmaW5lZCxcbiAga2V5OiBzdHJpbmcsXG4pOiBKc29uT2JqZWN0IHwgdW5kZWZpbmVkIHtcbiAgaWYgKHR5cGVvZiBzY2hlbWEgIT09ICdvYmplY3QnIHx8IHNjaGVtYSA9PT0gbnVsbCkge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvLyBJcyBpdCBhbiBvYmplY3Qgc2NoZW1hP1xuICBpZiAodHlwZW9mIHNjaGVtYS5wcm9wZXJ0aWVzID09ICdvYmplY3QnIHx8IHNjaGVtYS50eXBlID09ICdvYmplY3QnKSB7XG4gICAgaWYgKHR5cGVvZiBzY2hlbWEucHJvcGVydGllcyA9PSAnb2JqZWN0J1xuICAgICAgICAmJiB0eXBlb2YgKHNjaGVtYS5wcm9wZXJ0aWVzIGFzIEpzb25PYmplY3QpW2tleV0gPT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiAoc2NoZW1hLnByb3BlcnRpZXMgYXMgSnNvbk9iamVjdClba2V5XSBhcyBKc29uT2JqZWN0O1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHNjaGVtYS5hZGRpdGlvbmFsUHJvcGVydGllcyA9PSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIHNjaGVtYS5hZGRpdGlvbmFsUHJvcGVydGllcyBhcyBKc29uT2JqZWN0O1xuICAgIH1cblxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvLyBJcyBpdCBhbiBhcnJheSBzY2hlbWE/XG4gIGlmICh0eXBlb2Ygc2NoZW1hLml0ZW1zID09ICdvYmplY3QnIHx8IHNjaGVtYS50eXBlID09ICdhcnJheScpIHtcbiAgICByZXR1cm4gdHlwZW9mIHNjaGVtYS5pdGVtcyA9PSAnb2JqZWN0JyA/IChzY2hlbWEuaXRlbXMgYXMgSnNvbk9iamVjdCkgOiB1bmRlZmluZWQ7XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBfdmlzaXRKc29uUmVjdXJzaXZlPENvbnRleHRUPihcbiAganNvbjogSnNvblZhbHVlLFxuICB2aXNpdG9yOiBKc29uVmlzaXRvcixcbiAgcHRyOiBKc29uUG9pbnRlcixcbiAgc2NoZW1hPzogSnNvbk9iamVjdCxcbiAgcmVmUmVzb2x2ZXI/OiBSZWZlcmVuY2VSZXNvbHZlcjxDb250ZXh0VD4sXG4gIGNvbnRleHQ/OiBDb250ZXh0VCwgIC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8tYW55XG4gIHJvb3Q/OiBKc29uT2JqZWN0IHwgSnNvbkFycmF5LFxuKTogT2JzZXJ2YWJsZTxKc29uVmFsdWU+IHtcbiAgaWYgKHNjaGVtYSAmJiBzY2hlbWEuaGFzT3duUHJvcGVydHkoJyRyZWYnKSAmJiB0eXBlb2Ygc2NoZW1hWyckcmVmJ10gPT0gJ3N0cmluZycpIHtcbiAgICBpZiAocmVmUmVzb2x2ZXIpIHtcbiAgICAgIGNvbnN0IHJlc29sdmVkID0gcmVmUmVzb2x2ZXIoc2NoZW1hWyckcmVmJ10gYXMgc3RyaW5nLCBjb250ZXh0KTtcbiAgICAgIHNjaGVtYSA9IHJlc29sdmVkLnNjaGVtYTtcbiAgICAgIGNvbnRleHQgPSByZXNvbHZlZC5jb250ZXh0O1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHZhbHVlID0gdmlzaXRvcihqc29uLCBwdHIsIHNjaGVtYSwgcm9vdCk7XG5cbiAgcmV0dXJuIChpc09ic2VydmFibGUodmFsdWUpXG4gICAgICA/IHZhbHVlIGFzIE9ic2VydmFibGU8SnNvblZhbHVlPlxuICAgICAgOiBvYnNlcnZhYmxlT2YodmFsdWUgYXMgSnNvblZhbHVlKVxuICApLnBpcGUoXG4gICAgY29uY2F0TWFwKCh2YWx1ZTogSnNvblZhbHVlKSA9PiB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIGNvbmNhdChcbiAgICAgICAgICBmcm9tKHZhbHVlKS5waXBlKFxuICAgICAgICAgICAgbWVyZ2VNYXAoKGl0ZW0sIGkpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIF92aXNpdEpzb25SZWN1cnNpdmUoXG4gICAgICAgICAgICAgICAgaXRlbSxcbiAgICAgICAgICAgICAgICB2aXNpdG9yLFxuICAgICAgICAgICAgICAgIGpvaW5Kc29uUG9pbnRlcihwdHIsICcnICsgaSksXG4gICAgICAgICAgICAgICAgX2dldE9iamVjdFN1YlNjaGVtYShzY2hlbWEsICcnICsgaSksXG4gICAgICAgICAgICAgICAgcmVmUmVzb2x2ZXIsXG4gICAgICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgICAgICByb290IHx8IHZhbHVlLFxuICAgICAgICAgICAgICApLnBpcGUodGFwPEpzb25WYWx1ZT4oeCA9PiB2YWx1ZVtpXSA9IHgpKTtcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgaWdub3JlRWxlbWVudHMoKSxcbiAgICAgICAgICApLFxuICAgICAgICAgIG9ic2VydmFibGVPZih2YWx1ZSksXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gY29uY2F0KFxuICAgICAgICAgIGZyb20oT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModmFsdWUpKS5waXBlKFxuICAgICAgICAgICAgbWVyZ2VNYXAoa2V5ID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIF92aXNpdEpzb25SZWN1cnNpdmUoXG4gICAgICAgICAgICAgICAgdmFsdWVba2V5XSxcbiAgICAgICAgICAgICAgICB2aXNpdG9yLFxuICAgICAgICAgICAgICAgIGpvaW5Kc29uUG9pbnRlcihwdHIsIGtleSksXG4gICAgICAgICAgICAgICAgX2dldE9iamVjdFN1YlNjaGVtYShzY2hlbWEsIGtleSksXG4gICAgICAgICAgICAgICAgcmVmUmVzb2x2ZXIsXG4gICAgICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgICAgICByb290IHx8IHZhbHVlLFxuICAgICAgICAgICAgICApLnBpcGUodGFwPEpzb25WYWx1ZT4oeCA9PiB2YWx1ZVtrZXldID0geCkpO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBpZ25vcmVFbGVtZW50cygpLFxuICAgICAgICAgICApLFxuICAgICAgICAgICBvYnNlcnZhYmxlT2YodmFsdWUpLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG9ic2VydmFibGVPZih2YWx1ZSk7XG4gICAgICB9XG4gICAgfSksXG4gICk7XG59XG5cbi8qKlxuICogVmlzaXQgYWxsIHRoZSBwcm9wZXJ0aWVzIGluIGEgSlNPTiBvYmplY3QsIGFsbG93aW5nIHRvIHRyYW5zZm9ybSB0aGVtLiBJdCBzdXBwb3J0cyBjYWxsaW5nXG4gKiBwcm9wZXJ0aWVzIHN5bmNocm9ub3VzbHkgb3IgYXN5bmNocm9ub3VzbHkgKHRocm91Z2ggT2JzZXJ2YWJsZXMpLlxuICogVGhlIG9yaWdpbmFsIG9iamVjdCBjYW4gYmUgbXV0YXRlZCBvciByZXBsYWNlZCBlbnRpcmVseS4gSW4gY2FzZSB3aGVyZSBpdCdzIHJlcGxhY2VkLCB0aGUgbmV3XG4gKiB2YWx1ZSBpcyByZXR1cm5lZC4gV2hlbiBpdCdzIG11dGF0ZWQgdGhvdWdoIHRoZSBvcmlnaW5hbCBvYmplY3Qgd2lsbCBiZSBjaGFuZ2VkLlxuICpcbiAqIFBsZWFzZSBub3RlIGl0IGlzIHBvc3NpYmxlIHRvIGhhdmUgYW4gaW5maW5pdGUgbG9vcCBoZXJlICh3aGljaCB3aWxsIHJlc3VsdCBpbiBhIHN0YWNrIG92ZXJmbG93KVxuICogaWYgeW91IHJldHVybiAyIG9iamVjdHMgdGhhdCByZWZlcmVuY2VzIGVhY2ggb3RoZXJzIChvciB0aGUgc2FtZSBvYmplY3QgYWxsIHRoZSB0aW1lKS5cbiAqXG4gKiBAcGFyYW0ge0pzb25WYWx1ZX0ganNvbiBUaGUgSnNvbiB2YWx1ZSB0byB2aXNpdC5cbiAqIEBwYXJhbSB7SnNvblZpc2l0b3J9IHZpc2l0b3IgQSBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIG9uIGV2ZXJ5IGl0ZW1zLlxuICogQHBhcmFtIHtKc29uT2JqZWN0fSBzY2hlbWEgQSBKU09OIHNjaGVtYSB0byBwYXNzIHRocm91Z2ggdG8gdGhlIHZpc2l0b3IgKHdoZXJlIHBvc3NpYmxlKS5cbiAqIEBwYXJhbSByZWZSZXNvbHZlciBhIGZ1bmN0aW9uIHRvIHJlc29sdmUgcmVmZXJlbmNlcyBpbiB0aGUgc2NoZW1hLlxuICogQHJldHVybnMge09ic2VydmFibGU8IHwgdW5kZWZpbmVkPn0gVGhlIG9ic2VydmFibGUgb2YgdGhlIG5ldyByb290LCBpZiB0aGUgcm9vdCBjaGFuZ2VkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmlzaXRKc29uPENvbnRleHRUPihcbiAganNvbjogSnNvblZhbHVlLFxuICB2aXNpdG9yOiBKc29uVmlzaXRvcixcbiAgc2NoZW1hPzogSnNvbk9iamVjdCxcbiAgcmVmUmVzb2x2ZXI/OiBSZWZlcmVuY2VSZXNvbHZlcjxDb250ZXh0VD4sXG4gIGNvbnRleHQ/OiBDb250ZXh0VCwgIC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8tYW55XG4pOiBPYnNlcnZhYmxlPEpzb25WYWx1ZT4ge1xuICByZXR1cm4gX3Zpc2l0SnNvblJlY3Vyc2l2ZShqc29uLCB2aXNpdG9yLCBidWlsZEpzb25Qb2ludGVyKFtdKSwgc2NoZW1hLCByZWZSZXNvbHZlciwgY29udGV4dCk7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHZpc2l0SnNvblNjaGVtYShzY2hlbWE6IEpzb25PYmplY3QsIHZpc2l0b3I6IEpzb25TY2hlbWFWaXNpdG9yKSB7XG4gIGNvbnN0IGtleXdvcmRzID0ge1xuICAgIGFkZGl0aW9uYWxJdGVtczogdHJ1ZSxcbiAgICBpdGVtczogdHJ1ZSxcbiAgICBjb250YWluczogdHJ1ZSxcbiAgICBhZGRpdGlvbmFsUHJvcGVydGllczogdHJ1ZSxcbiAgICBwcm9wZXJ0eU5hbWVzOiB0cnVlLFxuICAgIG5vdDogdHJ1ZSxcbiAgfTtcblxuICBjb25zdCBhcnJheUtleXdvcmRzID0ge1xuICAgIGl0ZW1zOiB0cnVlLFxuICAgIGFsbE9mOiB0cnVlLFxuICAgIGFueU9mOiB0cnVlLFxuICAgIG9uZU9mOiB0cnVlLFxuICB9O1xuXG4gIGNvbnN0IHByb3BzS2V5d29yZHMgPSB7XG4gICAgZGVmaW5pdGlvbnM6IHRydWUsXG4gICAgcHJvcGVydGllczogdHJ1ZSxcbiAgICBwYXR0ZXJuUHJvcGVydGllczogdHJ1ZSxcbiAgICBhZGRpdGlvbmFsUHJvcGVydGllczogdHJ1ZSxcbiAgICBkZXBlbmRlbmNpZXM6IHRydWUsXG4gICAgaXRlbXM6IHRydWUsXG4gIH07XG5cbiAgZnVuY3Rpb24gX3RyYXZlcnNlKFxuICAgIHNjaGVtYTogSnNvbk9iamVjdCB8IEpzb25BcnJheSxcbiAgICBqc29uUHRyOiBKc29uUG9pbnRlcixcbiAgICByb290U2NoZW1hOiBKc29uT2JqZWN0LFxuICAgIHBhcmVudFNjaGVtYT86IEpzb25PYmplY3QgfCBKc29uQXJyYXksXG4gICAga2V5SW5kZXg/OiBzdHJpbmcsXG4gICkge1xuICAgIGlmIChzY2hlbWEgJiYgdHlwZW9mIHNjaGVtYSA9PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheShzY2hlbWEpKSB7XG4gICAgICB2aXNpdG9yKHNjaGVtYSwganNvblB0ciwgcGFyZW50U2NoZW1hLCBrZXlJbmRleCk7XG5cbiAgICAgIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKHNjaGVtYSkpIHtcbiAgICAgICAgY29uc3Qgc2NoID0gc2NoZW1hW2tleV07XG4gICAgICAgIGlmIChrZXkgaW4gcHJvcHNLZXl3b3Jkcykge1xuICAgICAgICAgIGlmIChzY2ggJiYgdHlwZW9mIHNjaCA9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgZm9yIChjb25zdCBwcm9wIG9mIE9iamVjdC5rZXlzKHNjaCkpIHtcbiAgICAgICAgICAgICAgX3RyYXZlcnNlKFxuICAgICAgICAgICAgICAgIChzY2ggYXMgSnNvbk9iamVjdClbcHJvcF0gYXMgSnNvbk9iamVjdCxcbiAgICAgICAgICAgICAgICBqb2luSnNvblBvaW50ZXIoanNvblB0ciwga2V5LCBwcm9wKSxcbiAgICAgICAgICAgICAgICByb290U2NoZW1hLFxuICAgICAgICAgICAgICAgIHNjaGVtYSxcbiAgICAgICAgICAgICAgICBwcm9wLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChrZXkgaW4ga2V5d29yZHMpIHtcbiAgICAgICAgICBfdHJhdmVyc2Uoc2NoIGFzIEpzb25PYmplY3QsIGpvaW5Kc29uUG9pbnRlcihqc29uUHRyLCBrZXkpLCByb290U2NoZW1hLCBzY2hlbWEsIGtleSk7XG4gICAgICAgIH0gZWxzZSBpZiAoa2V5IGluIGFycmF5S2V5d29yZHMpIHtcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShzY2gpKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNjaC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBfdHJhdmVyc2UoXG4gICAgICAgICAgICAgICAgc2NoW2ldIGFzIEpzb25BcnJheSxcbiAgICAgICAgICAgICAgICBqb2luSnNvblBvaW50ZXIoanNvblB0ciwga2V5LCAnJyArIGkpLFxuICAgICAgICAgICAgICAgIHJvb3RTY2hlbWEsXG4gICAgICAgICAgICAgICAgc2NoLFxuICAgICAgICAgICAgICAgICcnICsgaSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShzY2gpKSB7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzY2gubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIF90cmF2ZXJzZShcbiAgICAgICAgICAgICAgc2NoW2ldIGFzIEpzb25BcnJheSxcbiAgICAgICAgICAgICAgam9pbkpzb25Qb2ludGVyKGpzb25QdHIsIGtleSwgJycgKyBpKSxcbiAgICAgICAgICAgICAgcm9vdFNjaGVtYSxcbiAgICAgICAgICAgICAgc2NoLFxuICAgICAgICAgICAgICAnJyArIGksXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF90cmF2ZXJzZShzY2hlbWEsIGJ1aWxkSnNvblBvaW50ZXIoW10pLCBzY2hlbWEpO1xufVxuIl19