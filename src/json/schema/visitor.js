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
    if (schema === true || schema === false) {
        // There's no schema definition, so just visit the JSON recursively.
        schema = undefined;
    }
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
    if (schema === false || schema === true) {
        // Nothing to visit.
        return;
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlzaXRvci5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvanNvbi9zY2hlbWEvdmlzaXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILCtCQUFvRTtBQUNwRSw4Q0FBMEU7QUFDMUUsdUNBQTJDO0FBRzNDLHVDQUE4RDtBQVE5RCxTQUFTLG1CQUFtQixDQUMxQixNQUE4QixFQUM5QixHQUFXO0lBRVgsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLElBQUksTUFBTSxLQUFLLElBQUksRUFBRTtRQUNqRCxPQUFPLFNBQVMsQ0FBQztLQUNsQjtJQUVELDBCQUEwQjtJQUMxQixJQUFJLE9BQU8sTUFBTSxDQUFDLFVBQVUsSUFBSSxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksSUFBSSxRQUFRLEVBQUU7UUFDbkUsSUFBSSxPQUFPLE1BQU0sQ0FBQyxVQUFVLElBQUksUUFBUTtlQUNqQyxPQUFRLE1BQU0sQ0FBQyxVQUF5QixDQUFDLEdBQUcsQ0FBQyxJQUFJLFFBQVEsRUFBRTtZQUNoRSxPQUFRLE1BQU0sQ0FBQyxVQUF5QixDQUFDLEdBQUcsQ0FBZSxDQUFDO1NBQzdEO1FBQ0QsSUFBSSxPQUFPLE1BQU0sQ0FBQyxvQkFBb0IsSUFBSSxRQUFRLEVBQUU7WUFDbEQsT0FBTyxNQUFNLENBQUMsb0JBQWtDLENBQUM7U0FDbEQ7UUFFRCxPQUFPLFNBQVMsQ0FBQztLQUNsQjtJQUVELHlCQUF5QjtJQUN6QixJQUFJLE9BQU8sTUFBTSxDQUFDLEtBQUssSUFBSSxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksSUFBSSxPQUFPLEVBQUU7UUFDN0QsT0FBTyxPQUFPLE1BQU0sQ0FBQyxLQUFLLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBRSxNQUFNLENBQUMsS0FBb0IsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0tBQ25GO0lBRUQsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQztBQUVELFNBQVMsbUJBQW1CLENBQzFCLElBQWUsRUFDZixPQUFvQixFQUNwQixHQUFnQixFQUNoQixNQUFtQixFQUNuQixXQUF5QyxFQUN6QyxPQUFrQixFQUFHLDZCQUE2QjtBQUNsRCxJQUE2QjtJQUU3QixJQUFJLE1BQU0sS0FBSyxJQUFJLElBQUksTUFBTSxLQUFLLEtBQUssRUFBRTtRQUN2QyxvRUFBb0U7UUFDcEUsTUFBTSxHQUFHLFNBQVMsQ0FBQztLQUNwQjtJQUNELElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLElBQUksT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksUUFBUSxFQUFFO1FBQ2hGLElBQUksV0FBVyxFQUFFO1lBQ2YsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUNoRSxNQUFNLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQztZQUN6QixPQUFPLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQztTQUM1QjtLQUNGO0lBRUQsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBRS9DLE9BQU8sQ0FBQyxvQkFBWSxDQUFDLEtBQUssQ0FBQztRQUN2QixDQUFDLENBQUMsS0FBOEI7UUFDaEMsQ0FBQyxDQUFDLFNBQVksQ0FBQyxLQUFrQixDQUFDLENBQ3JDLENBQUMsSUFBSSxDQUNKLHFCQUFTLENBQUMsQ0FBQyxLQUFnQixFQUFFLEVBQUU7UUFDN0IsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQ3hCLE9BQU8sYUFBTSxDQUNYLFdBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQ2Qsb0JBQVEsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDbkIsT0FBTyxtQkFBbUIsQ0FDeEIsSUFBSSxFQUNKLE9BQU8sRUFDUCx5QkFBZSxDQUFDLEdBQUcsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQzVCLG1CQUFtQixDQUFDLE1BQU0sRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQ25DLFdBQVcsRUFDWCxPQUFPLEVBQ1AsSUFBSSxJQUFJLEtBQUssQ0FDZCxDQUFDLElBQUksQ0FBQyxlQUFHLENBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1QyxDQUFDLENBQUMsRUFDRiwwQkFBYyxFQUFFLENBQ2pCLEVBQ0QsU0FBWSxDQUFZLEtBQUssQ0FBQyxDQUMvQixDQUFDO1NBQ0g7YUFBTSxJQUFJLE9BQU8sS0FBSyxJQUFJLFFBQVEsSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFO1lBQ3JELE9BQU8sYUFBTSxDQUNYLFdBQUksQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQzFDLG9CQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQ2IsT0FBTyxtQkFBbUIsQ0FDeEIsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUNWLE9BQU8sRUFDUCx5QkFBZSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFDekIsbUJBQW1CLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxFQUNoQyxXQUFXLEVBQ1gsT0FBTyxFQUNQLElBQUksSUFBSSxLQUFLLENBQ2QsQ0FBQyxJQUFJLENBQUMsZUFBRyxDQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDOUMsQ0FBQyxDQUFDLEVBQ0YsMEJBQWMsRUFBRSxDQUNoQixFQUNELFNBQVksQ0FBQyxLQUFLLENBQUMsQ0FDckIsQ0FBQztTQUNIO2FBQU07WUFDTCxPQUFPLFNBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUM1QjtJQUNILENBQUMsQ0FBQyxDQUNILENBQUM7QUFDSixDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7O0dBY0c7QUFDSCxTQUFnQixTQUFTLENBQ3ZCLElBQWUsRUFDZixPQUFvQixFQUNwQixNQUFtQixFQUNuQixXQUF5QyxFQUN6QyxPQUFrQjtJQUVsQixPQUFPLG1CQUFtQixDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsMEJBQWdCLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUNoRyxDQUFDO0FBUkQsOEJBUUM7QUFHRCxTQUFnQixlQUFlLENBQUMsTUFBa0IsRUFBRSxPQUEwQjtJQUM1RSxJQUFJLE1BQU0sS0FBSyxLQUFLLElBQUksTUFBTSxLQUFLLElBQUksRUFBRTtRQUN2QyxvQkFBb0I7UUFDcEIsT0FBTztLQUNSO0lBRUQsTUFBTSxRQUFRLEdBQUc7UUFDZixlQUFlLEVBQUUsSUFBSTtRQUNyQixLQUFLLEVBQUUsSUFBSTtRQUNYLFFBQVEsRUFBRSxJQUFJO1FBQ2Qsb0JBQW9CLEVBQUUsSUFBSTtRQUMxQixhQUFhLEVBQUUsSUFBSTtRQUNuQixHQUFHLEVBQUUsSUFBSTtLQUNWLENBQUM7SUFFRixNQUFNLGFBQWEsR0FBRztRQUNwQixLQUFLLEVBQUUsSUFBSTtRQUNYLEtBQUssRUFBRSxJQUFJO1FBQ1gsS0FBSyxFQUFFLElBQUk7UUFDWCxLQUFLLEVBQUUsSUFBSTtLQUNaLENBQUM7SUFFRixNQUFNLGFBQWEsR0FBRztRQUNwQixXQUFXLEVBQUUsSUFBSTtRQUNqQixVQUFVLEVBQUUsSUFBSTtRQUNoQixpQkFBaUIsRUFBRSxJQUFJO1FBQ3ZCLG9CQUFvQixFQUFFLElBQUk7UUFDMUIsWUFBWSxFQUFFLElBQUk7UUFDbEIsS0FBSyxFQUFFLElBQUk7S0FDWixDQUFDO0lBRUYsU0FBUyxTQUFTLENBQ2hCLE1BQThCLEVBQzlCLE9BQW9CLEVBQ3BCLFVBQXNCLEVBQ3RCLFlBQXFDLEVBQ3JDLFFBQWlCO1FBRWpCLElBQUksTUFBTSxJQUFJLE9BQU8sTUFBTSxJQUFJLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDakUsT0FBTyxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBRWpELEtBQUssTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDckMsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN4QixJQUFJLEdBQUcsSUFBSSxhQUFhLEVBQUU7b0JBQ3hCLElBQUksR0FBRyxJQUFJLE9BQU8sR0FBRyxJQUFJLFFBQVEsRUFBRTt3QkFDakMsS0FBSyxNQUFNLElBQUksSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFOzRCQUNuQyxTQUFTLENBQ04sR0FBa0IsQ0FBQyxJQUFJLENBQWUsRUFDdkMseUJBQWUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUNuQyxVQUFVLEVBQ1YsTUFBTSxFQUNOLElBQUksQ0FDTCxDQUFDO3lCQUNIO3FCQUNGO2lCQUNGO3FCQUFNLElBQUksR0FBRyxJQUFJLFFBQVEsRUFBRTtvQkFDMUIsU0FBUyxDQUFDLEdBQWlCLEVBQUUseUJBQWUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FBQztpQkFDdEY7cUJBQU0sSUFBSSxHQUFHLElBQUksYUFBYSxFQUFFO29CQUMvQixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7d0JBQ3RCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFOzRCQUNuQyxTQUFTLENBQ1AsR0FBRyxDQUFDLENBQUMsQ0FBYyxFQUNuQix5QkFBZSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUNyQyxVQUFVLEVBQ1YsR0FBRyxFQUNILEVBQUUsR0FBRyxDQUFDLENBQ1AsQ0FBQzt5QkFDSDtxQkFDRjtpQkFDRjtxQkFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7b0JBQzdCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO3dCQUNuQyxTQUFTLENBQ1AsR0FBRyxDQUFDLENBQUMsQ0FBYyxFQUNuQix5QkFBZSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUNyQyxVQUFVLEVBQ1YsR0FBRyxFQUNILEVBQUUsR0FBRyxDQUFDLENBQ1AsQ0FBQztxQkFDSDtpQkFDRjthQUNGO1NBQ0Y7SUFDSCxDQUFDO0lBRUQsU0FBUyxDQUFDLE1BQU0sRUFBRSwwQkFBZ0IsQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNsRCxDQUFDO0FBckZELDBDQXFGQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IE9ic2VydmFibGUsIGNvbmNhdCwgZnJvbSwgb2YgYXMgb2JzZXJ2YWJsZU9mIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBjb25jYXRNYXAsIGlnbm9yZUVsZW1lbnRzLCBtZXJnZU1hcCwgdGFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgaXNPYnNlcnZhYmxlIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgSnNvbkFycmF5LCBKc29uT2JqZWN0LCBKc29uVmFsdWUgfSBmcm9tICcuLi9pbnRlcmZhY2UnO1xuaW1wb3J0IHsgSnNvblBvaW50ZXIsIEpzb25TY2hlbWFWaXNpdG9yLCBKc29uVmlzaXRvciB9IGZyb20gJy4vaW50ZXJmYWNlJztcbmltcG9ydCB7IGJ1aWxkSnNvblBvaW50ZXIsIGpvaW5Kc29uUG9pbnRlciB9IGZyb20gJy4vcG9pbnRlcic7XG5pbXBvcnQgeyBKc29uU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVmZXJlbmNlUmVzb2x2ZXI8Q29udGV4dFQ+IHtcbiAgKHJlZjogc3RyaW5nLCBjb250ZXh0PzogQ29udGV4dFQpOiB7IGNvbnRleHQ/OiBDb250ZXh0VCwgc2NoZW1hPzogSnNvbk9iamVjdCB9O1xufVxuXG5mdW5jdGlvbiBfZ2V0T2JqZWN0U3ViU2NoZW1hKFxuICBzY2hlbWE6IEpzb25TY2hlbWEgfCB1bmRlZmluZWQsXG4gIGtleTogc3RyaW5nLFxuKTogSnNvbk9iamVjdCB8IHVuZGVmaW5lZCB7XG4gIGlmICh0eXBlb2Ygc2NoZW1hICE9PSAnb2JqZWN0JyB8fCBzY2hlbWEgPT09IG51bGwpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgLy8gSXMgaXQgYW4gb2JqZWN0IHNjaGVtYT9cbiAgaWYgKHR5cGVvZiBzY2hlbWEucHJvcGVydGllcyA9PSAnb2JqZWN0JyB8fCBzY2hlbWEudHlwZSA9PSAnb2JqZWN0Jykge1xuICAgIGlmICh0eXBlb2Ygc2NoZW1hLnByb3BlcnRpZXMgPT0gJ29iamVjdCdcbiAgICAgICAgJiYgdHlwZW9mIChzY2hlbWEucHJvcGVydGllcyBhcyBKc29uT2JqZWN0KVtrZXldID09ICdvYmplY3QnKSB7XG4gICAgICByZXR1cm4gKHNjaGVtYS5wcm9wZXJ0aWVzIGFzIEpzb25PYmplY3QpW2tleV0gYXMgSnNvbk9iamVjdDtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBzY2hlbWEuYWRkaXRpb25hbFByb3BlcnRpZXMgPT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiBzY2hlbWEuYWRkaXRpb25hbFByb3BlcnRpZXMgYXMgSnNvbk9iamVjdDtcbiAgICB9XG5cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgLy8gSXMgaXQgYW4gYXJyYXkgc2NoZW1hP1xuICBpZiAodHlwZW9mIHNjaGVtYS5pdGVtcyA9PSAnb2JqZWN0JyB8fCBzY2hlbWEudHlwZSA9PSAnYXJyYXknKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBzY2hlbWEuaXRlbXMgPT0gJ29iamVjdCcgPyAoc2NoZW1hLml0ZW1zIGFzIEpzb25PYmplY3QpIDogdW5kZWZpbmVkO1xuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gX3Zpc2l0SnNvblJlY3Vyc2l2ZTxDb250ZXh0VD4oXG4gIGpzb246IEpzb25WYWx1ZSxcbiAgdmlzaXRvcjogSnNvblZpc2l0b3IsXG4gIHB0cjogSnNvblBvaW50ZXIsXG4gIHNjaGVtYT86IEpzb25TY2hlbWEsXG4gIHJlZlJlc29sdmVyPzogUmVmZXJlbmNlUmVzb2x2ZXI8Q29udGV4dFQ+LFxuICBjb250ZXh0PzogQ29udGV4dFQsICAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWFueVxuICByb290PzogSnNvbk9iamVjdCB8IEpzb25BcnJheSxcbik6IE9ic2VydmFibGU8SnNvblZhbHVlPiB7XG4gIGlmIChzY2hlbWEgPT09IHRydWUgfHwgc2NoZW1hID09PSBmYWxzZSkge1xuICAgIC8vIFRoZXJlJ3Mgbm8gc2NoZW1hIGRlZmluaXRpb24sIHNvIGp1c3QgdmlzaXQgdGhlIEpTT04gcmVjdXJzaXZlbHkuXG4gICAgc2NoZW1hID0gdW5kZWZpbmVkO1xuICB9XG4gIGlmIChzY2hlbWEgJiYgc2NoZW1hLmhhc093blByb3BlcnR5KCckcmVmJykgJiYgdHlwZW9mIHNjaGVtYVsnJHJlZiddID09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHJlZlJlc29sdmVyKSB7XG4gICAgICBjb25zdCByZXNvbHZlZCA9IHJlZlJlc29sdmVyKHNjaGVtYVsnJHJlZiddIGFzIHN0cmluZywgY29udGV4dCk7XG4gICAgICBzY2hlbWEgPSByZXNvbHZlZC5zY2hlbWE7XG4gICAgICBjb250ZXh0ID0gcmVzb2x2ZWQuY29udGV4dDtcbiAgICB9XG4gIH1cblxuICBjb25zdCB2YWx1ZSA9IHZpc2l0b3IoanNvbiwgcHRyLCBzY2hlbWEsIHJvb3QpO1xuXG4gIHJldHVybiAoaXNPYnNlcnZhYmxlKHZhbHVlKVxuICAgICAgPyB2YWx1ZSBhcyBPYnNlcnZhYmxlPEpzb25WYWx1ZT5cbiAgICAgIDogb2JzZXJ2YWJsZU9mKHZhbHVlIGFzIEpzb25WYWx1ZSlcbiAgKS5waXBlKFxuICAgIGNvbmNhdE1hcCgodmFsdWU6IEpzb25WYWx1ZSkgPT4ge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgIHJldHVybiBjb25jYXQoXG4gICAgICAgICAgZnJvbSh2YWx1ZSkucGlwZShcbiAgICAgICAgICAgIG1lcmdlTWFwKChpdGVtLCBpKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBfdmlzaXRKc29uUmVjdXJzaXZlKFxuICAgICAgICAgICAgICAgIGl0ZW0sXG4gICAgICAgICAgICAgICAgdmlzaXRvcixcbiAgICAgICAgICAgICAgICBqb2luSnNvblBvaW50ZXIocHRyLCAnJyArIGkpLFxuICAgICAgICAgICAgICAgIF9nZXRPYmplY3RTdWJTY2hlbWEoc2NoZW1hLCAnJyArIGkpLFxuICAgICAgICAgICAgICAgIHJlZlJlc29sdmVyLFxuICAgICAgICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAgICAgICAgcm9vdCB8fCB2YWx1ZSxcbiAgICAgICAgICAgICAgKS5waXBlKHRhcDxKc29uVmFsdWU+KHggPT4gdmFsdWVbaV0gPSB4KSk7XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIGlnbm9yZUVsZW1lbnRzKCksXG4gICAgICAgICAgKSxcbiAgICAgICAgICBvYnNlcnZhYmxlT2Y8SnNvblZhbHVlPih2YWx1ZSksXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gY29uY2F0KFxuICAgICAgICAgIGZyb20oT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModmFsdWUpKS5waXBlKFxuICAgICAgICAgICAgbWVyZ2VNYXAoa2V5ID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIF92aXNpdEpzb25SZWN1cnNpdmUoXG4gICAgICAgICAgICAgICAgdmFsdWVba2V5XSxcbiAgICAgICAgICAgICAgICB2aXNpdG9yLFxuICAgICAgICAgICAgICAgIGpvaW5Kc29uUG9pbnRlcihwdHIsIGtleSksXG4gICAgICAgICAgICAgICAgX2dldE9iamVjdFN1YlNjaGVtYShzY2hlbWEsIGtleSksXG4gICAgICAgICAgICAgICAgcmVmUmVzb2x2ZXIsXG4gICAgICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgICAgICByb290IHx8IHZhbHVlLFxuICAgICAgICAgICAgICApLnBpcGUodGFwPEpzb25WYWx1ZT4oeCA9PiB2YWx1ZVtrZXldID0geCkpO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBpZ25vcmVFbGVtZW50cygpLFxuICAgICAgICAgICApLFxuICAgICAgICAgICBvYnNlcnZhYmxlT2YodmFsdWUpLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG9ic2VydmFibGVPZih2YWx1ZSk7XG4gICAgICB9XG4gICAgfSksXG4gICk7XG59XG5cbi8qKlxuICogVmlzaXQgYWxsIHRoZSBwcm9wZXJ0aWVzIGluIGEgSlNPTiBvYmplY3QsIGFsbG93aW5nIHRvIHRyYW5zZm9ybSB0aGVtLiBJdCBzdXBwb3J0cyBjYWxsaW5nXG4gKiBwcm9wZXJ0aWVzIHN5bmNocm9ub3VzbHkgb3IgYXN5bmNocm9ub3VzbHkgKHRocm91Z2ggT2JzZXJ2YWJsZXMpLlxuICogVGhlIG9yaWdpbmFsIG9iamVjdCBjYW4gYmUgbXV0YXRlZCBvciByZXBsYWNlZCBlbnRpcmVseS4gSW4gY2FzZSB3aGVyZSBpdCdzIHJlcGxhY2VkLCB0aGUgbmV3XG4gKiB2YWx1ZSBpcyByZXR1cm5lZC4gV2hlbiBpdCdzIG11dGF0ZWQgdGhvdWdoIHRoZSBvcmlnaW5hbCBvYmplY3Qgd2lsbCBiZSBjaGFuZ2VkLlxuICpcbiAqIFBsZWFzZSBub3RlIGl0IGlzIHBvc3NpYmxlIHRvIGhhdmUgYW4gaW5maW5pdGUgbG9vcCBoZXJlICh3aGljaCB3aWxsIHJlc3VsdCBpbiBhIHN0YWNrIG92ZXJmbG93KVxuICogaWYgeW91IHJldHVybiAyIG9iamVjdHMgdGhhdCByZWZlcmVuY2VzIGVhY2ggb3RoZXJzIChvciB0aGUgc2FtZSBvYmplY3QgYWxsIHRoZSB0aW1lKS5cbiAqXG4gKiBAcGFyYW0ge0pzb25WYWx1ZX0ganNvbiBUaGUgSnNvbiB2YWx1ZSB0byB2aXNpdC5cbiAqIEBwYXJhbSB7SnNvblZpc2l0b3J9IHZpc2l0b3IgQSBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIG9uIGV2ZXJ5IGl0ZW1zLlxuICogQHBhcmFtIHtKc29uT2JqZWN0fSBzY2hlbWEgQSBKU09OIHNjaGVtYSB0byBwYXNzIHRocm91Z2ggdG8gdGhlIHZpc2l0b3IgKHdoZXJlIHBvc3NpYmxlKS5cbiAqIEBwYXJhbSByZWZSZXNvbHZlciBhIGZ1bmN0aW9uIHRvIHJlc29sdmUgcmVmZXJlbmNlcyBpbiB0aGUgc2NoZW1hLlxuICogQHJldHVybnMge09ic2VydmFibGU8IHwgdW5kZWZpbmVkPn0gVGhlIG9ic2VydmFibGUgb2YgdGhlIG5ldyByb290LCBpZiB0aGUgcm9vdCBjaGFuZ2VkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmlzaXRKc29uPENvbnRleHRUPihcbiAganNvbjogSnNvblZhbHVlLFxuICB2aXNpdG9yOiBKc29uVmlzaXRvcixcbiAgc2NoZW1hPzogSnNvblNjaGVtYSxcbiAgcmVmUmVzb2x2ZXI/OiBSZWZlcmVuY2VSZXNvbHZlcjxDb250ZXh0VD4sXG4gIGNvbnRleHQ/OiBDb250ZXh0VCwgIC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8tYW55XG4pOiBPYnNlcnZhYmxlPEpzb25WYWx1ZT4ge1xuICByZXR1cm4gX3Zpc2l0SnNvblJlY3Vyc2l2ZShqc29uLCB2aXNpdG9yLCBidWlsZEpzb25Qb2ludGVyKFtdKSwgc2NoZW1hLCByZWZSZXNvbHZlciwgY29udGV4dCk7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHZpc2l0SnNvblNjaGVtYShzY2hlbWE6IEpzb25TY2hlbWEsIHZpc2l0b3I6IEpzb25TY2hlbWFWaXNpdG9yKSB7XG4gIGlmIChzY2hlbWEgPT09IGZhbHNlIHx8IHNjaGVtYSA9PT0gdHJ1ZSkge1xuICAgIC8vIE5vdGhpbmcgdG8gdmlzaXQuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3Qga2V5d29yZHMgPSB7XG4gICAgYWRkaXRpb25hbEl0ZW1zOiB0cnVlLFxuICAgIGl0ZW1zOiB0cnVlLFxuICAgIGNvbnRhaW5zOiB0cnVlLFxuICAgIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB0cnVlLFxuICAgIHByb3BlcnR5TmFtZXM6IHRydWUsXG4gICAgbm90OiB0cnVlLFxuICB9O1xuXG4gIGNvbnN0IGFycmF5S2V5d29yZHMgPSB7XG4gICAgaXRlbXM6IHRydWUsXG4gICAgYWxsT2Y6IHRydWUsXG4gICAgYW55T2Y6IHRydWUsXG4gICAgb25lT2Y6IHRydWUsXG4gIH07XG5cbiAgY29uc3QgcHJvcHNLZXl3b3JkcyA9IHtcbiAgICBkZWZpbml0aW9uczogdHJ1ZSxcbiAgICBwcm9wZXJ0aWVzOiB0cnVlLFxuICAgIHBhdHRlcm5Qcm9wZXJ0aWVzOiB0cnVlLFxuICAgIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB0cnVlLFxuICAgIGRlcGVuZGVuY2llczogdHJ1ZSxcbiAgICBpdGVtczogdHJ1ZSxcbiAgfTtcblxuICBmdW5jdGlvbiBfdHJhdmVyc2UoXG4gICAgc2NoZW1hOiBKc29uT2JqZWN0IHwgSnNvbkFycmF5LFxuICAgIGpzb25QdHI6IEpzb25Qb2ludGVyLFxuICAgIHJvb3RTY2hlbWE6IEpzb25PYmplY3QsXG4gICAgcGFyZW50U2NoZW1hPzogSnNvbk9iamVjdCB8IEpzb25BcnJheSxcbiAgICBrZXlJbmRleD86IHN0cmluZyxcbiAgKSB7XG4gICAgaWYgKHNjaGVtYSAmJiB0eXBlb2Ygc2NoZW1hID09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHNjaGVtYSkpIHtcbiAgICAgIHZpc2l0b3Ioc2NoZW1hLCBqc29uUHRyLCBwYXJlbnRTY2hlbWEsIGtleUluZGV4KTtcblxuICAgICAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoc2NoZW1hKSkge1xuICAgICAgICBjb25zdCBzY2ggPSBzY2hlbWFba2V5XTtcbiAgICAgICAgaWYgKGtleSBpbiBwcm9wc0tleXdvcmRzKSB7XG4gICAgICAgICAgaWYgKHNjaCAmJiB0eXBlb2Ygc2NoID09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHByb3Agb2YgT2JqZWN0LmtleXMoc2NoKSkge1xuICAgICAgICAgICAgICBfdHJhdmVyc2UoXG4gICAgICAgICAgICAgICAgKHNjaCBhcyBKc29uT2JqZWN0KVtwcm9wXSBhcyBKc29uT2JqZWN0LFxuICAgICAgICAgICAgICAgIGpvaW5Kc29uUG9pbnRlcihqc29uUHRyLCBrZXksIHByb3ApLFxuICAgICAgICAgICAgICAgIHJvb3RTY2hlbWEsXG4gICAgICAgICAgICAgICAgc2NoZW1hLFxuICAgICAgICAgICAgICAgIHByb3AsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGtleSBpbiBrZXl3b3Jkcykge1xuICAgICAgICAgIF90cmF2ZXJzZShzY2ggYXMgSnNvbk9iamVjdCwgam9pbkpzb25Qb2ludGVyKGpzb25QdHIsIGtleSksIHJvb3RTY2hlbWEsIHNjaGVtYSwga2V5KTtcbiAgICAgICAgfSBlbHNlIGlmIChrZXkgaW4gYXJyYXlLZXl3b3Jkcykge1xuICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHNjaCkpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2NoLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgIF90cmF2ZXJzZShcbiAgICAgICAgICAgICAgICBzY2hbaV0gYXMgSnNvbkFycmF5LFxuICAgICAgICAgICAgICAgIGpvaW5Kc29uUG9pbnRlcihqc29uUHRyLCBrZXksICcnICsgaSksXG4gICAgICAgICAgICAgICAgcm9vdFNjaGVtYSxcbiAgICAgICAgICAgICAgICBzY2gsXG4gICAgICAgICAgICAgICAgJycgKyBpLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHNjaCkpIHtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNjaC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgX3RyYXZlcnNlKFxuICAgICAgICAgICAgICBzY2hbaV0gYXMgSnNvbkFycmF5LFxuICAgICAgICAgICAgICBqb2luSnNvblBvaW50ZXIoanNvblB0ciwga2V5LCAnJyArIGkpLFxuICAgICAgICAgICAgICByb290U2NoZW1hLFxuICAgICAgICAgICAgICBzY2gsXG4gICAgICAgICAgICAgICcnICsgaSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX3RyYXZlcnNlKHNjaGVtYSwgYnVpbGRKc29uUG9pbnRlcihbXSksIHNjaGVtYSk7XG59XG4iXX0=