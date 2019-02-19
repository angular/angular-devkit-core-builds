"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const interface_1 = require("../interface");
const utility_1 = require("./utility");
function addUndefinedDefaults(value, _pointer, schema) {
    if (schema === true || schema === false) {
        return value;
    }
    if (schema === undefined) {
        return value;
    }
    const types = utility_1.getTypesOfSchema(schema);
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
        else if (interface_1.isJsonObject(value)) {
            newValue = value;
        }
        else {
            return value;
        }
        if (!interface_1.isJsonObject(schema.properties)) {
            return newValue;
        }
        for (const propName of Object.getOwnPropertyNames(schema.properties)) {
            if (propName in newValue) {
                continue;
            }
            else if (propName == '$schema') {
                continue;
            }
            // TODO: Does not currently handle more complex schemas (oneOf/anyOf/etc.)
            const defaultValue = schema.properties[propName].default;
            newValue[propName] = defaultValue;
        }
        return newValue;
    }
    return value;
}
exports.addUndefinedDefaults = addUndefinedDefaults;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNmb3Jtcy5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvanNvbi9zY2hlbWEvdHJhbnNmb3Jtcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILDRDQUFtRTtBQUduRSx1Q0FBNkM7QUFFN0MsU0FBZ0Isb0JBQW9CLENBQ2xDLEtBQWdCLEVBQ2hCLFFBQXFCLEVBQ3JCLE1BQW1CO0lBRW5CLElBQUksTUFBTSxLQUFLLElBQUksSUFBSSxNQUFNLEtBQUssS0FBSyxFQUFFO1FBQ3ZDLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFDRCxJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUU7UUFDeEIsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUVELE1BQU0sS0FBSyxHQUFHLDBCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3ZDLElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUU7UUFDcEIsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUVELElBQUksSUFBSSxDQUFDO0lBQ1QsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRTtRQUNwQiwwQkFBMEI7UUFDMUIsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDN0I7U0FBTSxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRTtRQUN4RSxrREFBa0Q7UUFDbEQsSUFBSSxHQUFHLE9BQU8sQ0FBQztLQUNoQjtTQUFNLElBQUksTUFBTSxDQUFDLFVBQVUsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1FBQ25ELGdCQUFnQjtRQUNoQixJQUFJLEdBQUcsUUFBUSxDQUFDO0tBQ2pCO1NBQU0sSUFBSSxNQUFNLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDN0MsZUFBZTtRQUNmLElBQUksR0FBRyxPQUFPLENBQUM7S0FDaEI7U0FBTTtRQUNMLDJEQUEyRDtRQUMzRCxPQUFPLEtBQUssQ0FBQztLQUNkO0lBRUQsSUFBSSxJQUFJLEtBQUssT0FBTyxFQUFFO1FBQ3BCLE9BQU8sS0FBSyxJQUFJLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7S0FDeEM7SUFFRCxJQUFJLElBQUksS0FBSyxRQUFRLEVBQUU7UUFDckIsSUFBSSxRQUFRLENBQUM7UUFDYixJQUFJLEtBQUssSUFBSSxTQUFTLEVBQUU7WUFDdEIsUUFBUSxHQUFHLEVBQWdCLENBQUM7U0FDN0I7YUFBTSxJQUFJLHdCQUFZLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDOUIsUUFBUSxHQUFHLEtBQUssQ0FBQztTQUNsQjthQUFNO1lBQ0wsT0FBTyxLQUFLLENBQUM7U0FDZDtRQUVELElBQUksQ0FBQyx3QkFBWSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUNwQyxPQUFPLFFBQVEsQ0FBQztTQUNqQjtRQUVELEtBQUssTUFBTSxRQUFRLElBQUksTUFBTSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUNwRSxJQUFJLFFBQVEsSUFBSSxRQUFRLEVBQUU7Z0JBQ3hCLFNBQVM7YUFDVjtpQkFBTSxJQUFJLFFBQVEsSUFBSSxTQUFTLEVBQUU7Z0JBQ2hDLFNBQVM7YUFDVjtZQUVELDBFQUEwRTtZQUMxRSxNQUFNLFlBQVksR0FBSSxNQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBZ0IsQ0FBQyxPQUFPLENBQUM7WUFFekUsUUFBUSxDQUFDLFFBQVEsQ0FBQyxHQUFHLFlBQVksQ0FBQztTQUNuQztRQUVELE9BQU8sUUFBUSxDQUFDO0tBQ2pCO0lBRUQsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBdEVELG9EQXNFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IEpzb25PYmplY3QsIEpzb25WYWx1ZSwgaXNKc29uT2JqZWN0IH0gZnJvbSAnLi4vaW50ZXJmYWNlJztcbmltcG9ydCB7IEpzb25Qb2ludGVyIH0gZnJvbSAnLi9pbnRlcmZhY2UnO1xuaW1wb3J0IHsgSnNvblNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcbmltcG9ydCB7IGdldFR5cGVzT2ZTY2hlbWEgfSBmcm9tICcuL3V0aWxpdHknO1xuXG5leHBvcnQgZnVuY3Rpb24gYWRkVW5kZWZpbmVkRGVmYXVsdHMoXG4gIHZhbHVlOiBKc29uVmFsdWUsXG4gIF9wb2ludGVyOiBKc29uUG9pbnRlcixcbiAgc2NoZW1hPzogSnNvblNjaGVtYSxcbik6IEpzb25WYWx1ZSB7XG4gIGlmIChzY2hlbWEgPT09IHRydWUgfHwgc2NoZW1hID09PSBmYWxzZSkge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuICBpZiAoc2NoZW1hID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICBjb25zdCB0eXBlcyA9IGdldFR5cGVzT2ZTY2hlbWEoc2NoZW1hKTtcbiAgaWYgKHR5cGVzLnNpemUgPT09IDApIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICBsZXQgdHlwZTtcbiAgaWYgKHR5cGVzLnNpemUgPT09IDEpIHtcbiAgICAvLyBvbmx5IG9uZSBwb3RlbnRpYWwgdHlwZVxuICAgIHR5cGUgPSBBcnJheS5mcm9tKHR5cGVzKVswXTtcbiAgfSBlbHNlIGlmICh0eXBlcy5zaXplID09PSAyICYmIHR5cGVzLmhhcygnYXJyYXknKSAmJiB0eXBlcy5oYXMoJ29iamVjdCcpKSB7XG4gICAgLy8gbmVlZCB0byBjcmVhdGUgb25lIG9mIHRoZW0gYW5kIGFycmF5IGlzIHNpbXBsZXJcbiAgICB0eXBlID0gJ2FycmF5JztcbiAgfSBlbHNlIGlmIChzY2hlbWEucHJvcGVydGllcyAmJiB0eXBlcy5oYXMoJ29iamVjdCcpKSB7XG4gICAgLy8gYXNzdW1lIG9iamVjdFxuICAgIHR5cGUgPSAnb2JqZWN0JztcbiAgfSBlbHNlIGlmIChzY2hlbWEuaXRlbXMgJiYgdHlwZXMuaGFzKCdhcnJheScpKSB7XG4gICAgLy8gYXNzdW1lIGFycmF5XG4gICAgdHlwZSA9ICdhcnJheSc7XG4gIH0gZWxzZSB7XG4gICAgLy8gYW55dGhpbmcgZWxzZSBuZWVkcyB0byBiZSBjaGVja2VkIGJ5IHRoZSBjb25zdW1lciBhbnl3YXlcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICBpZiAodHlwZSA9PT0gJ2FycmF5Jykge1xuICAgIHJldHVybiB2YWx1ZSA9PSB1bmRlZmluZWQgPyBbXSA6IHZhbHVlO1xuICB9XG5cbiAgaWYgKHR5cGUgPT09ICdvYmplY3QnKSB7XG4gICAgbGV0IG5ld1ZhbHVlO1xuICAgIGlmICh2YWx1ZSA9PSB1bmRlZmluZWQpIHtcbiAgICAgIG5ld1ZhbHVlID0ge30gYXMgSnNvbk9iamVjdDtcbiAgICB9IGVsc2UgaWYgKGlzSnNvbk9iamVjdCh2YWx1ZSkpIHtcbiAgICAgIG5ld1ZhbHVlID0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICBpZiAoIWlzSnNvbk9iamVjdChzY2hlbWEucHJvcGVydGllcykpIHtcbiAgICAgIHJldHVybiBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHByb3BOYW1lIG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHNjaGVtYS5wcm9wZXJ0aWVzKSkge1xuICAgICAgaWYgKHByb3BOYW1lIGluIG5ld1ZhbHVlKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfSBlbHNlIGlmIChwcm9wTmFtZSA9PSAnJHNjaGVtYScpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIFRPRE86IERvZXMgbm90IGN1cnJlbnRseSBoYW5kbGUgbW9yZSBjb21wbGV4IHNjaGVtYXMgKG9uZU9mL2FueU9mL2V0Yy4pXG4gICAgICBjb25zdCBkZWZhdWx0VmFsdWUgPSAoc2NoZW1hLnByb3BlcnRpZXNbcHJvcE5hbWVdIGFzIEpzb25PYmplY3QpLmRlZmF1bHQ7XG5cbiAgICAgIG5ld1ZhbHVlW3Byb3BOYW1lXSA9IGRlZmF1bHRWYWx1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3VmFsdWU7XG4gIH1cblxuICByZXR1cm4gdmFsdWU7XG59XG4iXX0=