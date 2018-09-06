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
    if (!schema) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNmb3Jtcy5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvanNvbi9zY2hlbWEvdHJhbnNmb3Jtcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILDRDQUFtRTtBQUVuRSx1Q0FBNkM7QUFFN0MsOEJBQ0UsS0FBZ0IsRUFDaEIsUUFBcUIsRUFDckIsTUFBbUI7SUFFbkIsSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUNYLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFFRCxNQUFNLEtBQUssR0FBRywwQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN2QyxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFO1FBQ3BCLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFFRCxJQUFJLElBQUksQ0FBQztJQUNULElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUU7UUFDcEIsMEJBQTBCO1FBQzFCLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQzdCO1NBQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUU7UUFDeEUsa0RBQWtEO1FBQ2xELElBQUksR0FBRyxPQUFPLENBQUM7S0FDaEI7U0FBTSxJQUFJLE1BQU0sQ0FBQyxVQUFVLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRTtRQUNuRCxnQkFBZ0I7UUFDaEIsSUFBSSxHQUFHLFFBQVEsQ0FBQztLQUNqQjtTQUFNLElBQUksTUFBTSxDQUFDLEtBQUssSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQzdDLGVBQWU7UUFDZixJQUFJLEdBQUcsT0FBTyxDQUFDO0tBQ2hCO1NBQU07UUFDTCwyREFBMkQ7UUFDM0QsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUVELElBQUksSUFBSSxLQUFLLE9BQU8sRUFBRTtRQUNwQixPQUFPLEtBQUssSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0tBQ3hDO0lBRUQsSUFBSSxJQUFJLEtBQUssUUFBUSxFQUFFO1FBQ3JCLElBQUksUUFBUSxDQUFDO1FBQ2IsSUFBSSxLQUFLLElBQUksU0FBUyxFQUFFO1lBQ3RCLFFBQVEsR0FBRyxFQUFnQixDQUFDO1NBQzdCO2FBQU0sSUFBSSx3QkFBWSxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQzlCLFFBQVEsR0FBRyxLQUFLLENBQUM7U0FDbEI7YUFBTTtZQUNMLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFFRCxJQUFJLENBQUMsd0JBQVksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDcEMsT0FBTyxRQUFRLENBQUM7U0FDakI7UUFFRCxLQUFLLE1BQU0sUUFBUSxJQUFJLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDcEUsSUFBSSxRQUFRLElBQUksUUFBUSxFQUFFO2dCQUN4QixTQUFTO2FBQ1Y7aUJBQU0sSUFBSSxRQUFRLElBQUksU0FBUyxFQUFFO2dCQUNoQyxTQUFTO2FBQ1Y7WUFFRCwwRUFBMEU7WUFDMUUsTUFBTSxZQUFZLEdBQUksTUFBTSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQWdCLENBQUMsT0FBTyxDQUFDO1lBRXpFLFFBQVEsQ0FBQyxRQUFRLENBQUMsR0FBRyxZQUFZLENBQUM7U0FDbkM7UUFFRCxPQUFPLFFBQVEsQ0FBQztLQUNqQjtJQUVELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQW5FRCxvREFtRUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgeyBKc29uT2JqZWN0LCBKc29uVmFsdWUsIGlzSnNvbk9iamVjdCB9IGZyb20gJy4uL2ludGVyZmFjZSc7XG5pbXBvcnQgeyBKc29uUG9pbnRlciB9IGZyb20gJy4vaW50ZXJmYWNlJztcbmltcG9ydCB7IGdldFR5cGVzT2ZTY2hlbWEgfSBmcm9tICcuL3V0aWxpdHknO1xuXG5leHBvcnQgZnVuY3Rpb24gYWRkVW5kZWZpbmVkRGVmYXVsdHMoXG4gIHZhbHVlOiBKc29uVmFsdWUsXG4gIF9wb2ludGVyOiBKc29uUG9pbnRlcixcbiAgc2NoZW1hPzogSnNvbk9iamVjdCxcbik6IEpzb25WYWx1ZSB7XG4gIGlmICghc2NoZW1hKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgY29uc3QgdHlwZXMgPSBnZXRUeXBlc09mU2NoZW1hKHNjaGVtYSk7XG4gIGlmICh0eXBlcy5zaXplID09PSAwKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgbGV0IHR5cGU7XG4gIGlmICh0eXBlcy5zaXplID09PSAxKSB7XG4gICAgLy8gb25seSBvbmUgcG90ZW50aWFsIHR5cGVcbiAgICB0eXBlID0gQXJyYXkuZnJvbSh0eXBlcylbMF07XG4gIH0gZWxzZSBpZiAodHlwZXMuc2l6ZSA9PT0gMiAmJiB0eXBlcy5oYXMoJ2FycmF5JykgJiYgdHlwZXMuaGFzKCdvYmplY3QnKSkge1xuICAgIC8vIG5lZWQgdG8gY3JlYXRlIG9uZSBvZiB0aGVtIGFuZCBhcnJheSBpcyBzaW1wbGVyXG4gICAgdHlwZSA9ICdhcnJheSc7XG4gIH0gZWxzZSBpZiAoc2NoZW1hLnByb3BlcnRpZXMgJiYgdHlwZXMuaGFzKCdvYmplY3QnKSkge1xuICAgIC8vIGFzc3VtZSBvYmplY3RcbiAgICB0eXBlID0gJ29iamVjdCc7XG4gIH0gZWxzZSBpZiAoc2NoZW1hLml0ZW1zICYmIHR5cGVzLmhhcygnYXJyYXknKSkge1xuICAgIC8vIGFzc3VtZSBhcnJheVxuICAgIHR5cGUgPSAnYXJyYXknO1xuICB9IGVsc2Uge1xuICAgIC8vIGFueXRoaW5nIGVsc2UgbmVlZHMgdG8gYmUgY2hlY2tlZCBieSB0aGUgY29uc3VtZXIgYW55d2F5XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgaWYgKHR5cGUgPT09ICdhcnJheScpIHtcbiAgICByZXR1cm4gdmFsdWUgPT0gdW5kZWZpbmVkID8gW10gOiB2YWx1ZTtcbiAgfVxuXG4gIGlmICh0eXBlID09PSAnb2JqZWN0Jykge1xuICAgIGxldCBuZXdWYWx1ZTtcbiAgICBpZiAodmFsdWUgPT0gdW5kZWZpbmVkKSB7XG4gICAgICBuZXdWYWx1ZSA9IHt9IGFzIEpzb25PYmplY3Q7XG4gICAgfSBlbHNlIGlmIChpc0pzb25PYmplY3QodmFsdWUpKSB7XG4gICAgICBuZXdWYWx1ZSA9IHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgaWYgKCFpc0pzb25PYmplY3Qoc2NoZW1hLnByb3BlcnRpZXMpKSB7XG4gICAgICByZXR1cm4gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBwcm9wTmFtZSBvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhzY2hlbWEucHJvcGVydGllcykpIHtcbiAgICAgIGlmIChwcm9wTmFtZSBpbiBuZXdWYWx1ZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH0gZWxzZSBpZiAocHJvcE5hbWUgPT0gJyRzY2hlbWEnKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBUT0RPOiBEb2VzIG5vdCBjdXJyZW50bHkgaGFuZGxlIG1vcmUgY29tcGxleCBzY2hlbWFzIChvbmVPZi9hbnlPZi9ldGMuKVxuICAgICAgY29uc3QgZGVmYXVsdFZhbHVlID0gKHNjaGVtYS5wcm9wZXJ0aWVzW3Byb3BOYW1lXSBhcyBKc29uT2JqZWN0KS5kZWZhdWx0O1xuXG4gICAgICBuZXdWYWx1ZVtwcm9wTmFtZV0gPSBkZWZhdWx0VmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld1ZhbHVlO1xuICB9XG5cbiAgcmV0dXJuIHZhbHVlO1xufVxuIl19