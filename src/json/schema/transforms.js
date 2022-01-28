"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addUndefinedDefaults = void 0;
const utils_1 = require("../utils");
const utility_1 = require("./utility");
function addUndefinedDefaults(value, _pointer, schema) {
    if (typeof schema === 'boolean' || schema === undefined) {
        return value;
    }
    const types = (0, utility_1.getTypesOfSchema)(schema);
    if (types.size === 0) {
        return value;
    }
    let type;
    if (types.size === 1) {
        // only one potential type
        type = Array.from(types)[0];
    }
    else if (types.size === 2 && types.has('array') && types.has('object')) {
        // need to create one of them and array is simpler
        type = 'array';
    }
    else if (schema.properties && types.has('object')) {
        // assume object
        type = 'object';
    }
    else if (schema.items && types.has('array')) {
        // assume array
        type = 'array';
    }
    else {
        // anything else needs to be checked by the consumer anyway
        return value;
    }
    if (type === 'array') {
        return value == undefined ? [] : value;
    }
    if (type === 'object') {
        let newValue;
        if (value == undefined) {
            newValue = {};
        }
        else if ((0, utils_1.isJsonObject)(value)) {
            newValue = value;
        }
        else {
            return value;
        }
        if (!(0, utils_1.isJsonObject)(schema.properties)) {
            return newValue;
        }
        for (const [propName, schemaObject] of Object.entries(schema.properties)) {
            if (propName === '$schema' || !(0, utils_1.isJsonObject)(schemaObject)) {
                continue;
            }
            const value = newValue[propName];
            if (value === undefined) {
                newValue[propName] = schemaObject.default;
            }
            else if ((0, utils_1.isJsonObject)(value)) {
                // Basic support for oneOf and anyOf.
                const propertySchemas = schemaObject.oneOf || schemaObject.anyOf;
                const allProperties = Object.keys(value);
                // Locate a schema which declares all the properties that the object contains.
                const adjustedSchema = (0, utils_1.isJsonArray)(propertySchemas) &&
                    propertySchemas.find((s) => {
                        if (!(0, utils_1.isJsonObject)(s)) {
                            return false;
                        }
                        const schemaType = (0, utility_1.getTypesOfSchema)(s);
                        if (schemaType.size === 1 && schemaType.has('object') && (0, utils_1.isJsonObject)(s.properties)) {
                            const properties = Object.keys(s.properties);
                            return allProperties.every((key) => properties.includes(key));
                        }
                        return false;
                    });
                if (adjustedSchema && (0, utils_1.isJsonObject)(adjustedSchema)) {
                    newValue[propName] = addUndefinedDefaults(value, _pointer, adjustedSchema);
                }
            }
        }
        return newValue;
    }
    return value;
}
exports.addUndefinedDefaults = addUndefinedDefaults;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNmb3Jtcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL2pzb24vc2NoZW1hL3RyYW5zZm9ybXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsb0NBQTRFO0FBRzVFLHVDQUE2QztBQUU3QyxTQUFnQixvQkFBb0IsQ0FDbEMsS0FBZ0IsRUFDaEIsUUFBcUIsRUFDckIsTUFBbUI7SUFFbkIsSUFBSSxPQUFPLE1BQU0sS0FBSyxTQUFTLElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRTtRQUN2RCxPQUFPLEtBQUssQ0FBQztLQUNkO0lBRUQsTUFBTSxLQUFLLEdBQUcsSUFBQSwwQkFBZ0IsRUFBQyxNQUFNLENBQUMsQ0FBQztJQUN2QyxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFO1FBQ3BCLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFFRCxJQUFJLElBQUksQ0FBQztJQUNULElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUU7UUFDcEIsMEJBQTBCO1FBQzFCLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQzdCO1NBQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUU7UUFDeEUsa0RBQWtEO1FBQ2xELElBQUksR0FBRyxPQUFPLENBQUM7S0FDaEI7U0FBTSxJQUFJLE1BQU0sQ0FBQyxVQUFVLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRTtRQUNuRCxnQkFBZ0I7UUFDaEIsSUFBSSxHQUFHLFFBQVEsQ0FBQztLQUNqQjtTQUFNLElBQUksTUFBTSxD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MUZELG9EQTBGQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBKc29uT2JqZWN0LCBKc29uVmFsdWUsIGlzSnNvbkFycmF5LCBpc0pzb25PYmplY3QgfSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgeyBKc29uUG9pbnRlciB9IGZyb20gJy4vaW50ZXJmYWNlJztcbmltcG9ydCB7IEpzb25TY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5pbXBvcnQgeyBnZXRUeXBlc09mU2NoZW1hIH0gZnJvbSAnLi91dGlsaXR5JztcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFVuZGVmaW5lZERlZmF1bHRzKFxuICB2YWx1ZTogSnNvblZhbHVlLFxuICBfcG9pbnRlcjogSnNvblBvaW50ZXIsXG4gIHNjaGVtYT86IEpzb25TY2hlbWEsXG4pOiBKc29uVmFsdWUge1xuICBpZiAodHlwZW9mIHNjaGVtYSA9PT0gJ2Jvb2xlYW4nIHx8IHNjaGVtYSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgY29uc3QgdHlwZXMgPSBnZXRUeXBlc09mU2NoZW1hKHNjaGVtYSk7XG4gIGlmICh0eXBlcy5zaXplID09PSAwKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgbGV0IHR5cGU7XG4gIGlmICh0eXBlcy5zaXplID09PSAxKSB7XG4gICAgLy8gb25seSBvbmUgcG90ZW50aWFsIHR5cGVcbiAgICB0eXBlID0gQXJyYXkuZnJvbSh0eXBlcylbMF07XG4gIH0gZWxzZSBpZiAodHlwZXMuc2l6ZSA9PT0gMiAmJiB0eXBlcy5oYXMoJ2FycmF5JykgJiYgdHlwZXMuaGFzKCdvYmplY3QnKSkge1xuICAgIC8vIG5lZWQgdG8gY3JlYXRlIG9uZSBvZiB0aGVtIGFuZCBhcnJheSBpcyBzaW1wbGVyXG4gICAgdHlwZSA9ICdhcnJheSc7XG4gIH0gZWxzZSBpZiAoc2NoZW1hLnByb3BlcnRpZXMgJiYgdHlwZXMuaGFzKCdvYmplY3QnKSkge1xuICAgIC8vIGFzc3VtZSBvYmplY3RcbiAgICB0eXBlID0gJ29iamVjdCc7XG4gIH0gZWxzZSBpZiAoc2NoZW1hLml0ZW1zICYmIHR5cGVzLmhhcygnYXJyYXknKSkge1xuICAgIC8vIGFzc3VtZSBhcnJheVxuICAgIHR5cGUgPSAnYXJyYXknO1xuICB9IGVsc2Uge1xuICAgIC8vIGFueXRoaW5nIGVsc2UgbmVlZHMgdG8gYmUgY2hlY2tlZCBieSB0aGUgY29uc3VtZXIgYW55d2F5XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgaWYgKHR5cGUgPT09ICdhcnJheScpIHtcbiAgICByZXR1cm4gdmFsdWUgPT0gdW5kZWZpbmVkID8gW10gOiB2YWx1ZTtcbiAgfVxuXG4gIGlmICh0eXBlID09PSAnb2JqZWN0Jykge1xuICAgIGxldCBuZXdWYWx1ZTtcbiAgICBpZiAodmFsdWUgPT0gdW5kZWZpbmVkKSB7XG4gICAgICBuZXdWYWx1ZSA9IHt9IGFzIEpzb25PYmplY3Q7XG4gICAgfSBlbHNlIGlmIChpc0pzb25PYmplY3QodmFsdWUpKSB7XG4gICAgICBuZXdWYWx1ZSA9IHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgaWYgKCFpc0pzb25PYmplY3Qoc2NoZW1hLnByb3BlcnRpZXMpKSB7XG4gICAgICByZXR1cm4gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBbcHJvcE5hbWUsIHNjaGVtYU9iamVjdF0gb2YgT2JqZWN0LmVudHJpZXMoc2NoZW1hLnByb3BlcnRpZXMpKSB7XG4gICAgICBpZiAocHJvcE5hbWUgPT09ICckc2NoZW1hJyB8fCAhaXNKc29uT2JqZWN0KHNjaGVtYU9iamVjdCkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHZhbHVlID0gbmV3VmFsdWVbcHJvcE5hbWVdO1xuICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbmV3VmFsdWVbcHJvcE5hbWVdID0gc2NoZW1hT2JqZWN0LmRlZmF1bHQ7XG4gICAgICB9IGVsc2UgaWYgKGlzSnNvbk9iamVjdCh2YWx1ZSkpIHtcbiAgICAgICAgLy8gQmFzaWMgc3VwcG9ydCBmb3Igb25lT2YgYW5kIGFueU9mLlxuICAgICAgICBjb25zdCBwcm9wZXJ0eVNjaGVtYXMgPSBzY2hlbWFPYmplY3Qub25lT2YgfHwgc2NoZW1hT2JqZWN0LmFueU9mO1xuICAgICAgICBjb25zdCBhbGxQcm9wZXJ0aWVzID0gT2JqZWN0LmtleXModmFsdWUpO1xuICAgICAgICAvLyBMb2NhdGUgYSBzY2hlbWEgd2hpY2ggZGVjbGFyZXMgYWxsIHRoZSBwcm9wZXJ0aWVzIHRoYXQgdGhlIG9iamVjdCBjb250YWlucy5cbiAgICAgICAgY29uc3QgYWRqdXN0ZWRTY2hlbWEgPVxuICAgICAgICAgIGlzSnNvbkFycmF5KHByb3BlcnR5U2NoZW1hcykgJiZcbiAgICAgICAgICBwcm9wZXJ0eVNjaGVtYXMuZmluZCgocykgPT4ge1xuICAgICAgICAgICAgaWYgKCFpc0pzb25PYmplY3QocykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBzY2hlbWFUeXBlID0gZ2V0VHlwZXNPZlNjaGVtYShzKTtcbiAgICAgICAgICAgIGlmIChzY2hlbWFUeXBlLnNpemUgPT09IDEgJiYgc2NoZW1hVHlwZS5oYXMoJ29iamVjdCcpICYmIGlzSnNvbk9iamVjdChzLnByb3BlcnRpZXMpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHByb3BlcnRpZXMgPSBPYmplY3Qua2V5cyhzLnByb3BlcnRpZXMpO1xuXG4gICAgICAgICAgICAgIHJldHVybiBhbGxQcm9wZXJ0aWVzLmV2ZXJ5KChrZXkpID0+IHByb3BlcnRpZXMuaW5jbHVkZXMoa2V5KSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICBpZiAoYWRqdXN0ZWRTY2hlbWEgJiYgaXNKc29uT2JqZWN0KGFkanVzdGVkU2NoZW1hKSkge1xuICAgICAgICAgIG5ld1ZhbHVlW3Byb3BOYW1lXSA9IGFkZFVuZGVmaW5lZERlZmF1bHRzKHZhbHVlLCBfcG9pbnRlciwgYWRqdXN0ZWRTY2hlbWEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld1ZhbHVlO1xuICB9XG5cbiAgcmV0dXJuIHZhbHVlO1xufVxuIl19