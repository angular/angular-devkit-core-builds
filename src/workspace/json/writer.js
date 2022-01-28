"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeJsonWorkspace = void 0;
const magic_string_1 = __importDefault(require("magic-string"));
const metadata_1 = require("./metadata");
const utilities_1 = require("./utilities");
async function writeJsonWorkspace(workspace, host, path, options = {}) {
    const metadata = workspace[metadata_1.JsonWorkspaceSymbol];
    if (metadata) {
        if (!metadata.hasChanges) {
            // nothing to do
            return;
        }
        // update existing JSON workspace
        const data = updateJsonWorkspace(metadata);
        return host.writeFile(path || metadata.filePath, data);
    }
    else {
        // serialize directly
        if (!path) {
            throw new Error('path option is required');
        }
        const obj = convertJsonWorkspace(workspace, options.schema);
        const data = JSON.stringify(obj, null, 2);
        return host.writeFile(path, data);
    }
}
exports.writeJsonWorkspace = writeJsonWorkspace;
function convertJsonWorkspace(workspace, schema) {
    const obj = {
        $schema: schema || './node_modules/@angular/cli/lib/config/schema.json',
        version: 1,
        ...workspace.extensions,
        projects: workspace.projects ? convertJsonProjectCollection(workspace.projects) : {},
    };
    return obj;
}
function convertJsonProjectCollection(collection) {
    const projects = Object.create(null);
    for (const [projectName, project] of collection) {
        projects[projectName] = convertJsonProject(project);
    }
    return projects;
}
function convertJsonProject(project) {
    let targets;
    if (project.targets.size > 0) {
        targets = Object.create(null);
        for (const [targetName, target] of project.targets) {
            targets[targetName] = convertJsonTarget(target);
        }
    }
    const obj = {
        ...project.extensions,
        root: project.root,
        ...(project.sourceRoot === undefined ? {} : { sourceRoot: project.sourceRoot }),
        ...(project.prefix === undefined ? {} : { prefix: project.prefix }),
        ...(targets === undefined ? {} : { architect: targets }),
    };
    return obj;
}
function isEmpty(obj) {
    return obj === undefined || Object.keys(obj).length === 0;
}
function convertJsonTarget(target) {
    return {
        builder: target.builder,
        ...(isEmpty(target.options) ? {} : { options: target.options }),
        ...(isEmpty(target.configurations)
            ? {}
            : { configurations: target.configurations }),
        ...(target.defaultConfiguration === undefined
            ? {}
            : { defaultConfiguration: target.defaultConfiguration }),
    };
}
function convertJsonTargetCollection(collection) {
    const targets = Object.create(null);
    for (const [projectName, target] of collection) {
        targets[projectName] = convertJsonTarget(target);
    }
    return targets;
}
function findFullStart(node, raw) {
    let i = node.start.offset;
    while (i > 0 && /\s/.test(raw[i - 1])) {
        --i;
    }
    return i;
}
function findFullEnd(node, raw) {
    let i = node.end.offset;
    if (i >= raw.length) {
        return raw.length;
    }
    else if (raw[i] === ',') {
        return i + 1;
    }
    while (i > node.start.offset && /\s/.test(raw[i - 1])) {
        --i;
    }
    return i;
}
function findPrecedingComma(node, raw) {
    let i = node.start.offset;
    if (node.comments && node.comments.length > 0) {
        i = node.comments[0].start.offset;
    }
    while (i > 0 && /\s/.test(raw[i - 1])) {
        --i;
    }
    if (raw[i - 1] === ',') {
        return i - 1;
    }
    return -1;
}
function stringify(value, multiline, depth, indent) {
    if (value === undefined) {
        return '';
    }
    if (multiline) {
        const content = JSON.stringify(value, null, indent);
        const spacing = '\n' + indent.repeat(depth);
        return content.replace(/\n/g, spacing);
    }
    else {
        return JSON.stringify(value);
    }
}
function normalizeValue(value, type) {
    switch (type) {
        case 'project':
            return convertJsonProject(value);
        case 'projectcollection':
            const projects = convertJsonProjectCollection(value);
            return Object.keys(projects).length === 0 ? undefined : projects;
        case 'target':
            return convertJsonTarget(value);
        case 'targetcollection':
            const targets = convertJsonTargetCollection(value);
            return Object.keys(targets).length === 0 ? undefined : targets;
        default:
            return value;
    }
}
function updateJsonWorkspace(metadata) {
    const data = new magic_string_1.default(metadata.raw);
    const indent = data.getIndentString();
    const removedCommas = new Set();
    const nodeChanges = new Map();
    for (const { op, path, node, value, type } of metadata.changes) {
        // targets/projects are typically large objects so always use multiline
        const multiline = node.start.line !== node.end.line || type !== 'json';
        const pathSegments = path.split('/');
        const depth = pathSegments.length - 1; // TODO: more complete analysis
        const propertyOrIndex = (0, utilities_1.unescapeKey)(pathSegments[depth]);
        const jsonValue = normalizeValue(value, type);
        if (op === 'add' && jsonValue === undefined) {
            continue;
        }
        // Track changes to the order/size of any modified objects/arrays
        let elements = nodeChanges.get(node);
        if (!elements) {
            if (node.kind === 'array') {
                elements = node.elements.slice();
                nodeChanges.set(node, elements);
            }
            else if (node.kind === 'object') {
                elements = node.properties.slice();
                nodeChanges.set(node, elements);
            }
            else {
                // keyvalue
                elements = [];
            }
        }
        switch (op) {
            case 'add':
                let contentPrefix = '';
                if (node.kind === 'object') {
                    contentPrefix = `"${propertyOrIndex}": `;
                }
                const spacing = multiline ? '\n' + indent.repeat(depth) : ' ';
                const content = spacing + contentPrefix + stringify(jsonValue, multiline, depth, indent);
                // Additions are handled after analyzing all operations
                // This is mainly to support array operations which can occur at arbitrary indices
                if (node.kind === 'object') {
                    // Object property additions are always added at the end for simplicity
                    elements.push(content);
                }
                else {
                    // Add place holders if adding an index past the length
                    // An empty string is an impossible real value
                    for (let i = elements.length; i < +propertyOrIndex; ++i) {
                        elements[i] = '';
                    }
                    if (elements[+propertyOrIndex] === '') {
                        elements[+propertyOrIndex] = content;
                    }
                    else {
                        elements.splice(+propertyOrIndex, 0, content);
                    }
                }
                break;
            case 'remove':
                let removalIndex = -1;
                if (node.kind === 'object') {
                    removalIndex = elements.findIndex((e) => {
                        return typeof e != 'string' && e.kind === 'keyvalue' && e.key.value === propertyOrIndex;
                    });
                }
                else if (node.kind === 'array') {
                    removalIndex = +propertyOrIndex;
                }
                if (removalIndex === -1) {
                    continue;
                }
                const nodeToRemove = elements[removalIndex];
                if (typeof nodeToRemove === 'string') {
                    // synthetic
                    elements.splice(removalIndex, 1);
                    continue;
                }
                if (elements.length - 1 === removalIndex) {
                    // If the element is a terminal element remove the otherwise trailing comma
                    const commaIndex = findPrecedingComma(nodeToRemove, data.original);
                    if (commaIndex !== -1) {
                        data.remove(commaIndex, commaIndex + 1);
                        removedCommas.add(commaIndex);
                    }
                }
                data.remove(findFullStart(nodeToRemove, data.original), findFullEnd(nodeToRemove, data.original));
                elements.splice(removalIndex, 1);
                break;
            case 'replace':
                let nodeToReplace;
                if (node.kind === 'keyvalue') {
                    nodeToReplace = node.value;
                }
                else if (node.kind === 'array') {
                    nodeToReplace = elements[+propertyOrIndex];
                    if (typeof nodeToReplace === 'string') {
                        // Was already modified. This is already handled.
                        continue;
                    }
                }
                else {
                    continue;
                }
                nodeChanges.delete(nodeToReplace);
                data.overwrite(nodeToReplace.start.offset, nodeToReplace.end.offset, stringify(jsonValue, multiline, depth, indent));
                break;
        }
    }
    for (const [node, elements] of nodeChanges.entries()) {
        let parentPoint = 1 + data.original.indexOf(node.kind === 'array' ? '[' : '{', node.start.offset);
        // Short-circuit for simple case
        if (elements.length === 1 && typeof elements[0] === 'string') {
            data.appendRight(parentPoint, elements[0]);
            continue;
        }
        // Combine adjecent element additions to minimize/simplify insertions
        const optimizedElements = [];
        for (let i = 0; i < elements.length; ++i) {
            const element = elements[i];
            if (typeof element === 'string' && i > 0 && typeof elements[i - 1] === 'string') {
                optimizedElements[optimizedElements.length - 1] += ',' + element;
            }
            else {
                optimizedElements.push(element);
            }
        }
        let prefixComma = false;
        for (const element of optimizedElements) {
            if (typeof element === 'string') {
                data.appendRight(parentPoint, (prefixComma ? ',' : '') + element);
            }
            else {
                parentPoint = findFullEnd(element, data.original);
                prefixComma = data.original[parentPoint - 1] !== ',' || removedCommas.has(parentPoint - 1);
            }
        }
    }
    const result = data.toString();
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3JpdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvd29ya3NwYWNlL2pzb24vd3JpdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUVILGdFQUF1QztBQUt2Qyx5Q0FLb0I7QUFDcEIsMkNBQTBDO0FBRW5DLEtBQUssVUFBVSxrQkFBa0IsQ0FDdEMsU0FBOEIsRUFDOUIsSUFBbUIsRUFDbkIsSUFBYSxFQUNiLFVBRUksRUFBRTtJQUVOLE1BQU0sUUFBUSxHQUFJLFNBQXFDLENBQUMsOEJBQW1CLENBQUMsQ0FBQztJQUU3RSxJQUFJLFFBQVEsRUFBRTtRQUNaLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFO1lBQ3hCLGdCQUFnQjtZQUNoQixPQUFPO1NBQ1I7UUFFRCxpQ0FBaUM7UUFDakMsTUFBTSxJQUFJLEdBQUcsbUJBQW1CLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFM0MsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksSUFBSSxRQUFRLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO0tBQ3hEO1NBQU07UUFDTCxxQkFBcUI7UUFDckIsSUFBSSxDQUFDLElBQUksRUFBRTtZQUNULE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztTQUM1QztRQUVELE1BQU0sR0FBRyxHQUFHLG9CQUFvQixDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDNUQsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRTFDLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7S0FDbkM7QUFDSCxDQUFDO0FBL0JELGdEQStCQztBQUVE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YUFDNUY7U0FDRjtLQUNGO0lBRUQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBRS9CLE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IE1hZ2ljU3RyaW5nIGZyb20gJ21hZ2ljLXN0cmluZyc7XG5pbXBvcnQgeyBKc29uT2JqZWN0LCBKc29uVmFsdWUgfSBmcm9tICcuLi8uLi9qc29uJztcbmltcG9ydCB7IEpzb25Bc3RLZXlWYWx1ZSwgSnNvbkFzdE5vZGUgfSBmcm9tICcuLi8uLi9qc29uL3BhcnNlcl9hc3QnO1xuaW1wb3J0IHsgUHJvamVjdERlZmluaXRpb24sIFRhcmdldERlZmluaXRpb24sIFdvcmtzcGFjZURlZmluaXRpb24gfSBmcm9tICcuLi9kZWZpbml0aW9ucyc7XG5pbXBvcnQgeyBXb3Jrc3BhY2VIb3N0IH0gZnJvbSAnLi4vaG9zdCc7XG5pbXBvcnQge1xuICBKc29uQ2hhbmdlLFxuICBKc29uV29ya3NwYWNlRGVmaW5pdGlvbixcbiAgSnNvbldvcmtzcGFjZU1ldGFkYXRhLFxuICBKc29uV29ya3NwYWNlU3ltYm9sLFxufSBmcm9tICcuL21ldGFkYXRhJztcbmltcG9ydCB7IHVuZXNjYXBlS2V5IH0gZnJvbSAnLi91dGlsaXRpZXMnO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd3JpdGVKc29uV29ya3NwYWNlKFxuICB3b3Jrc3BhY2U6IFdvcmtzcGFjZURlZmluaXRpb24sXG4gIGhvc3Q6IFdvcmtzcGFjZUhvc3QsXG4gIHBhdGg/OiBzdHJpbmcsXG4gIG9wdGlvbnM6IHtcbiAgICBzY2hlbWE/OiBzdHJpbmc7XG4gIH0gPSB7fSxcbik6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBtZXRhZGF0YSA9ICh3b3Jrc3BhY2UgYXMgSnNvbldvcmtzcGFjZURlZmluaXRpb24pW0pzb25Xb3Jrc3BhY2VTeW1ib2xdO1xuXG4gIGlmIChtZXRhZGF0YSkge1xuICAgIGlmICghbWV0YWRhdGEuaGFzQ2hhbmdlcykge1xuICAgICAgLy8gbm90aGluZyB0byBkb1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIHVwZGF0ZSBleGlzdGluZyBKU09OIHdvcmtzcGFjZVxuICAgIGNvbnN0IGRhdGEgPSB1cGRhdGVKc29uV29ya3NwYWNlKG1ldGFkYXRhKTtcblxuICAgIHJldHVybiBob3N0LndyaXRlRmlsZShwYXRoIHx8IG1ldGFkYXRhLmZpbGVQYXRoLCBkYXRhKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBzZXJpYWxpemUgZGlyZWN0bHlcbiAgICBpZiAoIXBhdGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigncGF0aCBvcHRpb24gaXMgcmVxdWlyZWQnKTtcbiAgICB9XG5cbiAgICBjb25zdCBvYmogPSBjb252ZXJ0SnNvbldvcmtzcGFjZSh3b3Jrc3BhY2UsIG9wdGlvbnMuc2NoZW1hKTtcbiAgICBjb25zdCBkYXRhID0gSlNPTi5zdHJpbmdpZnkob2JqLCBudWxsLCAyKTtcblxuICAgIHJldHVybiBob3N0LndyaXRlRmlsZShwYXRoLCBkYXRhKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb252ZXJ0SnNvbldvcmtzcGFjZSh3b3Jrc3BhY2U6IFdvcmtzcGFjZURlZmluaXRpb24sIHNjaGVtYT86IHN0cmluZyk6IEpzb25PYmplY3Qge1xuICBjb25zdCBvYmogPSB7XG4gICAgJHNjaGVtYTogc2NoZW1hIHx8ICcuL25vZGVfbW9kdWxlcy9AYW5ndWxhci9jbGkvbGliL2NvbmZpZy9zY2hlbWEuanNvbicsXG4gICAgdmVyc2lvbjogMSxcbiAgICAuLi53b3Jrc3BhY2UuZXh0ZW5zaW9ucyxcbiAgICBwcm9qZWN0czogd29ya3NwYWNlLnByb2plY3RzID8gY29udmVydEpzb25Qcm9qZWN0Q29sbGVjdGlvbih3b3Jrc3BhY2UucHJvamVjdHMpIDoge30sXG4gIH07XG5cbiAgcmV0dXJuIG9iajtcbn1cblxuZnVuY3Rpb24gY29udmVydEpzb25Qcm9qZWN0Q29sbGVjdGlvbihcbiAgY29sbGVjdGlvbjogSXRlcmFibGU8W3N0cmluZywgUHJvamVjdERlZmluaXRpb25dPixcbik6IEpzb25PYmplY3Qge1xuICBjb25zdCBwcm9qZWN0cyA9IE9iamVjdC5jcmVhdGUobnVsbCkgYXMgSnNvbk9iamVjdDtcblxuICBmb3IgKGNvbnN0IFtwcm9qZWN0TmFtZSwgcHJvamVjdF0gb2YgY29sbGVjdGlvbikge1xuICAgIHByb2plY3RzW3Byb2plY3ROYW1lXSA9IGNvbnZlcnRKc29uUHJvamVjdChwcm9qZWN0KTtcbiAgfVxuXG4gIHJldHVybiBwcm9qZWN0cztcbn1cblxuZnVuY3Rpb24gY29udmVydEpzb25Qcm9qZWN0KHByb2plY3Q6IFByb2plY3REZWZpbml0aW9uKTogSnNvbk9iamVjdCB7XG4gIGxldCB0YXJnZXRzOiBKc29uT2JqZWN0IHwgdW5kZWZpbmVkO1xuICBpZiAocHJvamVjdC50YXJnZXRzLnNpemUgPiAwKSB7XG4gICAgdGFyZ2V0cyA9IE9iamVjdC5jcmVhdGUobnVsbCkgYXMgSnNvbk9iamVjdDtcbiAgICBmb3IgKGNvbnN0IFt0YXJnZXROYW1lLCB0YXJnZXRdIG9mIHByb2plY3QudGFyZ2V0cykge1xuICAgICAgdGFyZ2V0c1t0YXJnZXROYW1lXSA9IGNvbnZlcnRKc29uVGFyZ2V0KHRhcmdldCk7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qgb2JqID0ge1xuICAgIC4uLnByb2plY3QuZXh0ZW5zaW9ucyxcbiAgICByb290OiBwcm9qZWN0LnJvb3QsXG4gICAgLi4uKHByb2plY3Quc291cmNlUm9vdCA9PT0gdW5kZWZpbmVkID8ge30gOiB7IHNvdXJjZVJvb3Q6IHByb2plY3Quc291cmNlUm9vdCB9KSxcbiAgICAuLi4ocHJvamVjdC5wcmVmaXggPT09IHVuZGVmaW5lZCA/IHt9IDogeyBwcmVmaXg6IHByb2plY3QucHJlZml4IH0pLFxuICAgIC4uLih0YXJnZXRzID09PSB1bmRlZmluZWQgPyB7fSA6IHsgYXJjaGl0ZWN0OiB0YXJnZXRzIH0pLFxuICB9O1xuXG4gIHJldHVybiBvYmo7XG59XG5cbmZ1bmN0aW9uIGlzRW1wdHkob2JqPzogb2JqZWN0KTogYm9vbGVhbiB7XG4gIHJldHVybiBvYmogPT09IHVuZGVmaW5lZCB8fCBPYmplY3Qua2V5cyhvYmopLmxlbmd0aCA9PT0gMDtcbn1cblxuZnVuY3Rpb24gY29udmVydEpzb25UYXJnZXQodGFyZ2V0OiBUYXJnZXREZWZpbml0aW9uKTogSnNvbk9iamVjdCB7XG4gIHJldHVybiB7XG4gICAgYnVpbGRlcjogdGFyZ2V0LmJ1aWxkZXIsXG4gICAgLi4uKGlzRW1wdHkodGFyZ2V0Lm9wdGlvbnMpID8ge30gOiB7IG9wdGlvbnM6IHRhcmdldC5vcHRpb25zIGFzIEpzb25PYmplY3QgfSksXG4gICAgLi4uKGlzRW1wdHkodGFyZ2V0LmNvbmZpZ3VyYXRpb25zKVxuICAgICAgPyB7fVxuICAgICAgOiB7IGNvbmZpZ3VyYXRpb25zOiB0YXJnZXQuY29uZmlndXJhdGlvbnMgYXMgSnNvbk9iamVjdCB9KSxcbiAgICAuLi4odGFyZ2V0LmRlZmF1bHRDb25maWd1cmF0aW9uID09PSB1bmRlZmluZWRcbiAgICAgID8ge31cbiAgICAgIDogeyBkZWZhdWx0Q29uZmlndXJhdGlvbjogdGFyZ2V0LmRlZmF1bHRDb25maWd1cmF0aW9uIH0pLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0SnNvblRhcmdldENvbGxlY3Rpb24oY29sbGVjdGlvbjogSXRlcmFibGU8W3N0cmluZywgVGFyZ2V0RGVmaW5pdGlvbl0+KTogSnNvbk9iamVjdCB7XG4gIGNvbnN0IHRhcmdldHMgPSBPYmplY3QuY3JlYXRlKG51bGwpIGFzIEpzb25PYmplY3Q7XG5cbiAgZm9yIChjb25zdCBbcHJvamVjdE5hbWUsIHRhcmdldF0gb2YgY29sbGVjdGlvbikge1xuICAgIHRhcmdldHNbcHJvamVjdE5hbWVdID0gY29udmVydEpzb25UYXJnZXQodGFyZ2V0KTtcbiAgfVxuXG4gIHJldHVybiB0YXJnZXRzO1xufVxuXG5mdW5jdGlvbiBmaW5kRnVsbFN0YXJ0KG5vZGU6IEpzb25Bc3ROb2RlIHwgSnNvbkFzdEtleVZhbHVlLCByYXc6IHN0cmluZyk6IG51bWJlciB7XG4gIGxldCBpID0gbm9kZS5zdGFydC5vZmZzZXQ7XG4gIHdoaWxlIChpID4gMCAmJiAvXFxzLy50ZXN0KHJhd1tpIC0gMV0pKSB7XG4gICAgLS1pO1xuICB9XG5cbiAgcmV0dXJuIGk7XG59XG5cbmZ1bmN0aW9uIGZpbmRGdWxsRW5kKG5vZGU6IEpzb25Bc3ROb2RlIHwgSnNvbkFzdEtleVZhbHVlLCByYXc6IHN0cmluZyk6IG51bWJlciB7XG4gIGxldCBpID0gbm9kZS5lbmQub2Zmc2V0O1xuICBpZiAoaSA+PSByYXcubGVuZ3RoKSB7XG4gICAgcmV0dXJuIHJhdy5sZW5ndGg7XG4gIH0gZWxzZSBpZiAocmF3W2ldID09PSAnLCcpIHtcbiAgICByZXR1cm4gaSArIDE7XG4gIH1cblxuICB3aGlsZSAoaSA+IG5vZGUuc3RhcnQub2Zmc2V0ICYmIC9cXHMvLnRlc3QocmF3W2kgLSAxXSkpIHtcbiAgICAtLWk7XG4gIH1cblxuICByZXR1cm4gaTtcbn1cblxuZnVuY3Rpb24gZmluZFByZWNlZGluZ0NvbW1hKG5vZGU6IEpzb25Bc3ROb2RlIHwgSnNvbkFzdEtleVZhbHVlLCByYXc6IHN0cmluZyk6IG51bWJlciB7XG4gIGxldCBpID0gbm9kZS5zdGFydC5vZmZzZXQ7XG4gIGlmIChub2RlLmNvbW1lbnRzICYmIG5vZGUuY29tbWVudHMubGVuZ3RoID4gMCkge1xuICAgIGkgPSBub2RlLmNvbW1lbnRzWzBdLnN0YXJ0Lm9mZnNldDtcbiAgfVxuICB3aGlsZSAoaSA+IDAgJiYgL1xccy8udGVzdChyYXdbaSAtIDFdKSkge1xuICAgIC0taTtcbiAgfVxuXG4gIGlmIChyYXdbaSAtIDFdID09PSAnLCcpIHtcbiAgICByZXR1cm4gaSAtIDE7XG4gIH1cblxuICByZXR1cm4gLTE7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeShcbiAgdmFsdWU6IEpzb25WYWx1ZSB8IHVuZGVmaW5lZCxcbiAgbXVsdGlsaW5lOiBib29sZWFuLFxuICBkZXB0aDogbnVtYmVyLFxuICBpbmRlbnQ6IHN0cmluZyxcbik6IHN0cmluZyB7XG4gIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgaWYgKG11bHRpbGluZSkge1xuICAgIGNvbnN0IGNvbnRlbnQgPSBKU09OLnN0cmluZ2lmeSh2YWx1ZSwgbnVsbCwgaW5kZW50KTtcbiAgICBjb25zdCBzcGFjaW5nID0gJ1xcbicgKyBpbmRlbnQucmVwZWF0KGRlcHRoKTtcblxuICAgIHJldHVybiBjb250ZW50LnJlcGxhY2UoL1xcbi9nLCBzcGFjaW5nKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodmFsdWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVZhbHVlKFxuICB2YWx1ZTogSnNvbkNoYW5nZVsndmFsdWUnXSB8IHVuZGVmaW5lZCxcbiAgdHlwZTogSnNvbkNoYW5nZVsndHlwZSddLFxuKTogSnNvblZhbHVlIHwgdW5kZWZpbmVkIHtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAncHJvamVjdCc6XG4gICAgICByZXR1cm4gY29udmVydEpzb25Qcm9qZWN0KHZhbHVlIGFzIFByb2plY3REZWZpbml0aW9uKTtcbiAgICBjYXNlICdwcm9qZWN0Y29sbGVjdGlvbic6XG4gICAgICBjb25zdCBwcm9qZWN0cyA9IGNvbnZlcnRKc29uUHJvamVjdENvbGxlY3Rpb24odmFsdWUgYXMgSXRlcmFibGU8W3N0cmluZywgUHJvamVjdERlZmluaXRpb25dPik7XG5cbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyhwcm9qZWN0cykubGVuZ3RoID09PSAwID8gdW5kZWZpbmVkIDogcHJvamVjdHM7XG4gICAgY2FzZSAndGFyZ2V0JzpcbiAgICAgIHJldHVybiBjb252ZXJ0SnNvblRhcmdldCh2YWx1ZSBhcyBUYXJnZXREZWZpbml0aW9uKTtcbiAgICBjYXNlICd0YXJnZXRjb2xsZWN0aW9uJzpcbiAgICAgIGNvbnN0IHRhcmdldHMgPSBjb252ZXJ0SnNvblRhcmdldENvbGxlY3Rpb24odmFsdWUgYXMgSXRlcmFibGU8W3N0cmluZywgVGFyZ2V0RGVmaW5pdGlvbl0+KTtcblxuICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHRhcmdldHMpLmxlbmd0aCA9PT0gMCA/IHVuZGVmaW5lZCA6IHRhcmdldHM7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB2YWx1ZSBhcyBKc29uVmFsdWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gdXBkYXRlSnNvbldvcmtzcGFjZShtZXRhZGF0YTogSnNvbldvcmtzcGFjZU1ldGFkYXRhKTogc3RyaW5nIHtcbiAgY29uc3QgZGF0YSA9IG5ldyBNYWdpY1N0cmluZyhtZXRhZGF0YS5yYXcpO1xuICBjb25zdCBpbmRlbnQgPSBkYXRhLmdldEluZGVudFN0cmluZygpO1xuICBjb25zdCByZW1vdmVkQ29tbWFzID0gbmV3IFNldDxudW1iZXI+KCk7XG4gIGNvbnN0IG5vZGVDaGFuZ2VzID0gbmV3IE1hcDxcbiAgICBKc29uQXN0Tm9kZSB8IEpzb25Bc3RLZXlWYWx1ZSxcbiAgICAoSnNvbkFzdE5vZGUgfCBKc29uQXN0S2V5VmFsdWUgfCBzdHJpbmcpW11cbiAgPigpO1xuXG4gIGZvciAoY29uc3QgeyBvcCwgcGF0aCwgbm9kZSwgdmFsdWUsIHR5cGUgfSBvZiBtZXRhZGF0YS5jaGFuZ2VzKSB7XG4gICAgLy8gdGFyZ2V0cy9wcm9qZWN0cyBhcmUgdHlwaWNhbGx5IGxhcmdlIG9iamVjdHMgc28gYWx3YXlzIHVzZSBtdWx0aWxpbmVcbiAgICBjb25zdCBtdWx0aWxpbmUgPSBub2RlLnN0YXJ0LmxpbmUgIT09IG5vZGUuZW5kLmxpbmUgfHwgdHlwZSAhPT0gJ2pzb24nO1xuICAgIGNvbnN0IHBhdGhTZWdtZW50cyA9IHBhdGguc3BsaXQoJy8nKTtcbiAgICBjb25zdCBkZXB0aCA9IHBhdGhTZWdtZW50cy5sZW5ndGggLSAxOyAvLyBUT0RPOiBtb3JlIGNvbXBsZXRlIGFuYWx5c2lzXG4gICAgY29uc3QgcHJvcGVydHlPckluZGV4ID0gdW5lc2NhcGVLZXkocGF0aFNlZ21lbnRzW2RlcHRoXSk7XG4gICAgY29uc3QganNvblZhbHVlID0gbm9ybWFsaXplVmFsdWUodmFsdWUsIHR5cGUpO1xuICAgIGlmIChvcCA9PT0gJ2FkZCcgJiYganNvblZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFRyYWNrIGNoYW5nZXMgdG8gdGhlIG9yZGVyL3NpemUgb2YgYW55IG1vZGlmaWVkIG9iamVjdHMvYXJyYXlzXG4gICAgbGV0IGVsZW1lbnRzID0gbm9kZUNoYW5nZXMuZ2V0KG5vZGUpO1xuICAgIGlmICghZWxlbWVudHMpIHtcbiAgICAgIGlmIChub2RlLmtpbmQgPT09ICdhcnJheScpIHtcbiAgICAgICAgZWxlbWVudHMgPSBub2RlLmVsZW1lbnRzLnNsaWNlKCk7XG4gICAgICAgIG5vZGVDaGFuZ2VzLnNldChub2RlLCBlbGVtZW50cyk7XG4gICAgICB9IGVsc2UgaWYgKG5vZGUua2luZCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgZWxlbWVudHMgPSBub2RlLnByb3BlcnRpZXMuc2xpY2UoKTtcbiAgICAgICAgbm9kZUNoYW5nZXMuc2V0KG5vZGUsIGVsZW1lbnRzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGtleXZhbHVlXG4gICAgICAgIGVsZW1lbnRzID0gW107XG4gICAgICB9XG4gICAgfVxuXG4gICAgc3dpdGNoIChvcCkge1xuICAgICAgY2FzZSAnYWRkJzpcbiAgICAgICAgbGV0IGNvbnRlbnRQcmVmaXggPSAnJztcbiAgICAgICAgaWYgKG5vZGUua2luZCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICBjb250ZW50UHJlZml4ID0gYFwiJHtwcm9wZXJ0eU9ySW5kZXh9XCI6IGA7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzcGFjaW5nID0gbXVsdGlsaW5lID8gJ1xcbicgKyBpbmRlbnQucmVwZWF0KGRlcHRoKSA6ICcgJztcbiAgICAgICAgY29uc3QgY29udGVudCA9IHNwYWNpbmcgKyBjb250ZW50UHJlZml4ICsgc3RyaW5naWZ5KGpzb25WYWx1ZSwgbXVsdGlsaW5lLCBkZXB0aCwgaW5kZW50KTtcblxuICAgICAgICAvLyBBZGRpdGlvbnMgYXJlIGhhbmRsZWQgYWZ0ZXIgYW5hbHl6aW5nIGFsbCBvcGVyYXRpb25zXG4gICAgICAgIC8vIFRoaXMgaXMgbWFpbmx5IHRvIHN1cHBvcnQgYXJyYXkgb3BlcmF0aW9ucyB3aGljaCBjYW4gb2NjdXIgYXQgYXJiaXRyYXJ5IGluZGljZXNcbiAgICAgICAgaWYgKG5vZGUua2luZCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAvLyBPYmplY3QgcHJvcGVydHkgYWRkaXRpb25zIGFyZSBhbHdheXMgYWRkZWQgYXQgdGhlIGVuZCBmb3Igc2ltcGxpY2l0eVxuICAgICAgICAgIGVsZW1lbnRzLnB1c2goY29udGVudCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQWRkIHBsYWNlIGhvbGRlcnMgaWYgYWRkaW5nIGFuIGluZGV4IHBhc3QgdGhlIGxlbmd0aFxuICAgICAgICAgIC8vIEFuIGVtcHR5IHN0cmluZyBpcyBhbiBpbXBvc3NpYmxlIHJlYWwgdmFsdWVcbiAgICAgICAgICBmb3IgKGxldCBpID0gZWxlbWVudHMubGVuZ3RoOyBpIDwgK3Byb3BlcnR5T3JJbmRleDsgKytpKSB7XG4gICAgICAgICAgICBlbGVtZW50c1tpXSA9ICcnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZWxlbWVudHNbK3Byb3BlcnR5T3JJbmRleF0gPT09ICcnKSB7XG4gICAgICAgICAgICBlbGVtZW50c1srcHJvcGVydHlPckluZGV4XSA9IGNvbnRlbnQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVsZW1lbnRzLnNwbGljZSgrcHJvcGVydHlPckluZGV4LCAwLCBjb250ZW50KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdyZW1vdmUnOlxuICAgICAgICBsZXQgcmVtb3ZhbEluZGV4ID0gLTE7XG4gICAgICAgIGlmIChub2RlLmtpbmQgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgcmVtb3ZhbEluZGV4ID0gZWxlbWVudHMuZmluZEluZGV4KChlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gdHlwZW9mIGUgIT0gJ3N0cmluZycgJiYgZS5raW5kID09PSAna2V5dmFsdWUnICYmIGUua2V5LnZhbHVlID09PSBwcm9wZXJ0eU9ySW5kZXg7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAobm9kZS5raW5kID09PSAnYXJyYXknKSB7XG4gICAgICAgICAgcmVtb3ZhbEluZGV4ID0gK3Byb3BlcnR5T3JJbmRleDtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVtb3ZhbEluZGV4ID09PSAtMSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgbm9kZVRvUmVtb3ZlID0gZWxlbWVudHNbcmVtb3ZhbEluZGV4XTtcbiAgICAgICAgaWYgKHR5cGVvZiBub2RlVG9SZW1vdmUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgLy8gc3ludGhldGljXG4gICAgICAgICAgZWxlbWVudHMuc3BsaWNlKHJlbW92YWxJbmRleCwgMSk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZWxlbWVudHMubGVuZ3RoIC0gMSA9PT0gcmVtb3ZhbEluZGV4KSB7XG4gICAgICAgICAgLy8gSWYgdGhlIGVsZW1lbnQgaXMgYSB0ZXJtaW5hbCBlbGVtZW50IHJlbW92ZSB0aGUgb3RoZXJ3aXNlIHRyYWlsaW5nIGNvbW1hXG4gICAgICAgICAgY29uc3QgY29tbWFJbmRleCA9IGZpbmRQcmVjZWRpbmdDb21tYShub2RlVG9SZW1vdmUsIGRhdGEub3JpZ2luYWwpO1xuICAgICAgICAgIGlmIChjb21tYUluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgZGF0YS5yZW1vdmUoY29tbWFJbmRleCwgY29tbWFJbmRleCArIDEpO1xuICAgICAgICAgICAgcmVtb3ZlZENvbW1hcy5hZGQoY29tbWFJbmRleCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGRhdGEucmVtb3ZlKFxuICAgICAgICAgIGZpbmRGdWxsU3RhcnQobm9kZVRvUmVtb3ZlLCBkYXRhLm9yaWdpbmFsKSxcbiAgICAgICAgICBmaW5kRnVsbEVuZChub2RlVG9SZW1vdmUsIGRhdGEub3JpZ2luYWwpLFxuICAgICAgICApO1xuICAgICAgICBlbGVtZW50cy5zcGxpY2UocmVtb3ZhbEluZGV4LCAxKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdyZXBsYWNlJzpcbiAgICAgICAgbGV0IG5vZGVUb1JlcGxhY2U7XG4gICAgICAgIGlmIChub2RlLmtpbmQgPT09ICdrZXl2YWx1ZScpIHtcbiAgICAgICAgICBub2RlVG9SZXBsYWNlID0gbm9kZS52YWx1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChub2RlLmtpbmQgPT09ICdhcnJheScpIHtcbiAgICAgICAgICBub2RlVG9SZXBsYWNlID0gZWxlbWVudHNbK3Byb3BlcnR5T3JJbmRleF07XG4gICAgICAgICAgaWYgKHR5cGVvZiBub2RlVG9SZXBsYWNlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgLy8gV2FzIGFscmVhZHkgbW9kaWZpZWQuIFRoaXMgaXMgYWxyZWFkeSBoYW5kbGVkLlxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgbm9kZUNoYW5nZXMuZGVsZXRlKG5vZGVUb1JlcGxhY2UpO1xuXG4gICAgICAgIGRhdGEub3ZlcndyaXRlKFxuICAgICAgICAgIG5vZGVUb1JlcGxhY2Uuc3RhcnQub2Zmc2V0LFxuICAgICAgICAgIG5vZGVUb1JlcGxhY2UuZW5kLm9mZnNldCxcbiAgICAgICAgICBzdHJpbmdpZnkoanNvblZhbHVlLCBtdWx0aWxpbmUsIGRlcHRoLCBpbmRlbnQpLFxuICAgICAgICApO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IFtub2RlLCBlbGVtZW50c10gb2Ygbm9kZUNoYW5nZXMuZW50cmllcygpKSB7XG4gICAgbGV0IHBhcmVudFBvaW50ID1cbiAgICAgIDEgKyBkYXRhLm9yaWdpbmFsLmluZGV4T2Yobm9kZS5raW5kID09PSAnYXJyYXknID8gJ1snIDogJ3snLCBub2RlLnN0YXJ0Lm9mZnNldCk7XG5cbiAgICAvLyBTaG9ydC1jaXJjdWl0IGZvciBzaW1wbGUgY2FzZVxuICAgIGlmIChlbGVtZW50cy5sZW5ndGggPT09IDEgJiYgdHlwZW9mIGVsZW1lbnRzWzBdID09PSAnc3RyaW5nJykge1xuICAgICAgZGF0YS5hcHBlbmRSaWdodChwYXJlbnRQb2ludCwgZWxlbWVudHNbMF0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gQ29tYmluZSBhZGplY2VudCBlbGVtZW50IGFkZGl0aW9ucyB0byBtaW5pbWl6ZS9zaW1wbGlmeSBpbnNlcnRpb25zXG4gICAgY29uc3Qgb3B0aW1pemVkRWxlbWVudHM6IHR5cGVvZiBlbGVtZW50cyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZWxlbWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSBlbGVtZW50c1tpXTtcbiAgICAgIGlmICh0eXBlb2YgZWxlbWVudCA9PT0gJ3N0cmluZycgJiYgaSA+IDAgJiYgdHlwZW9mIGVsZW1lbnRzW2kgLSAxXSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgb3B0aW1pemVkRWxlbWVudHNbb3B0aW1pemVkRWxlbWVudHMubGVuZ3RoIC0gMV0gKz0gJywnICsgZWxlbWVudDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdGltaXplZEVsZW1lbnRzLnB1c2goZWxlbWVudCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGV0IHByZWZpeENvbW1hID0gZmFsc2U7XG4gICAgZm9yIChjb25zdCBlbGVtZW50IG9mIG9wdGltaXplZEVsZW1lbnRzKSB7XG4gICAgICBpZiAodHlwZW9mIGVsZW1lbnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGRhdGEuYXBwZW5kUmlnaHQocGFyZW50UG9pbnQsIChwcmVmaXhDb21tYSA/ICcsJyA6ICcnKSArIGVsZW1lbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGFyZW50UG9pbnQgPSBmaW5kRnVsbEVuZChlbGVtZW50LCBkYXRhLm9yaWdpbmFsKTtcbiAgICAgICAgcHJlZml4Q29tbWEgPSBkYXRhLm9yaWdpbmFsW3BhcmVudFBvaW50IC0gMV0gIT09ICcsJyB8fCByZW1vdmVkQ29tbWFzLmhhcyhwYXJlbnRQb2ludCAtIDEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IGRhdGEudG9TdHJpbmcoKTtcblxuICByZXR1cm4gcmVzdWx0O1xufVxuIl19