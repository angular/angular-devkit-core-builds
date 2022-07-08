"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.readJsonWorkspace = void 0;
const jsonc_parser_1 = require("jsonc-parser");
const utils_1 = require("../../json/utils");
const definitions_1 = require("../definitions");
const metadata_1 = require("./metadata");
const utilities_1 = require("./utilities");
async function readJsonWorkspace(path, host) {
    const raw = await host.readFile(path);
    if (raw === undefined) {
        throw new Error('Unable to read workspace file.');
    }
    const ast = (0, jsonc_parser_1.parseTree)(raw, undefined, { allowTrailingComma: true, disallowComments: false });
    if ((ast === null || ast === void 0 ? void 0 : ast.type) !== 'object' || !ast.children) {
        throw new Error('Invalid workspace file - expected JSON object.');
    }
    // Version check
    const versionNode = (0, jsonc_parser_1.findNodeAtLocation)(ast, ['version']);
    if (!versionNode) {
        throw new Error('Unknown format - version specifier not found.');
    }
    const version = versionNode.value;
    if (version !== 1) {
        throw new Error(`Invalid format version detected - Expected:[ 1 ] Found: [ ${version} ]`);
    }
    const context = {
        host,
        metadata: new metadata_1.JsonWorkspaceMetadata(path, ast, raw),
        trackChanges: true,
        error(message, _node) {
            // TODO: Diagnostic reporting support
            throw new Error(message);
        },
        warn(_message, _node) {
            // TODO: Diagnostic reporting support
        },
    };
    const workspace = parseWorkspace(ast, context);
    return workspace;
}
exports.readJsonWorkspace = readJsonWorkspace;
const specialWorkspaceExtensions = ['cli', 'defaultProject', 'newProjectRoot', 'schematics'];
const specialProjectExtensions = ['cli', 'schematics', 'projectType'];
function parseWorkspace(workspaceNode, context) {
    const jsonMetadata = context.metadata;
    let projects;
    let extensions;
    if (!context.trackChanges) {
        extensions = Object.create(null);
    }
    // TODO: `getNodeValue` - looks potentially expensive since it walks the whole tree and instantiates the full object structure each time.
    // Might be something to look at moving forward to optimize.
    const workspaceNodeValue = (0, jsonc_parser_1.getNodeValue)(workspaceNode);
    for (const [name, value] of Object.entries(workspaceNodeValue)) {
        if (name === '$schema' || name === 'version') {
            // skip
        }
        else if (name === 'projects') {
            const nodes = (0, jsonc_parser_1.findNodeAtLocation)(workspaceNode, ['projects']);
            if (!(0, utils_1.isJsonObject)(value) || !nodes) {
                context.error('Invalid "projects" field found; expected an object.', value);
                continue;
            }
            projects = parseProjectsObject(nodes, context);
        }
        else {
            if (!specialWorkspaceExtensions.includes(name) && !/^[a-z]{1,3}-.*/.test(name)) {
                context.warn(`Project extension with invalid name found.`, name);
            }
            if (extensions) {
                extensions[name] = value;
            }
        }
    }
    let collectionListener;
    if (context.trackChanges) {
        collectionListener = (name, newValue) => {
            jsonMetadata.addChange(['projects', name], newValue, 'project');
        };
    }
    const projectCollection = new definitions_1.ProjectDefinitionCollection(projects, collectionListener);
    return {
        [metadata_1.JsonWorkspaceSymbol]: jsonMetadata,
        projects: projectCollection,
        // If not tracking changes the `extensions` variable will contain the parsed
        // values.  Otherwise the extensions are tracked via a virtual AST object.
        extensions: extensions !== null && extensions !== void 0 ? extensions : (0, utilities_1.createVirtualAstObject)(workspaceNodeValue, {
            exclude: ['$schema', 'version', 'projects'],
            listener(path, value) {
                jsonMetadata.addChange(path, value);
            },
        }),
    };
}
function parseProjectsObject(projectsNode, context) {
    const projects = Object.create(null);
    for (const [name, value] of Object.entries((0, jsonc_parser_1.getNodeValue)(projectsNode))) {
        const nodes = (0, jsonc_parser_1.findNodeAtLocation)(projectsNode, [name]);
        if (!(0, utils_1.isJsonObject)(value) || !nodes) {
            context.warn('Skipping invalid project value; expected an object.', value);
            continue;
        }
        projects[name] = parseProject(name, nodes, context);
    }
    return projects;
}
function parseProject(projectName, projectNode, context) {
    const jsonMetadata = context.metadata;
    let targets;
    let hasTargets = false;
    let extensions;
    let properties;
    if (!context.trackChanges) {
        // If not tracking changes, the parser will store the values directly in standard objects
        extensions = Object.create(null);
        properties = Object.create(null);
    }
    const projectNodeValue = (0, jsonc_parser_1.getNodeValue)(projectNode);
    for (const [name, value] of Object.entries(projectNodeValue)) {
        switch (name) {
            case 'targets':
            case 'architect':
                const nodes = (0, jsonc_parser_1.findNodeAtLocation)(projectNode, [name]);
                if (!(0, utils_1.isJsonObject)(value) || !nodes) {
                    context.error(`Invalid "${name}" field found; expected an object.`, value);
                    break;
                }
                hasTargets = true;
                targets = parseTargetsObject(projectName, nodes, context);
                jsonMetadata.hasLegacyTargetsName = name === 'architect';
                break;
            case 'prefix':
            case 'root':
            case 'sourceRoot':
                if (typeof value !== 'string') {
                    context.warn(`Project property "${name}" should be a string.`, value);
                }
                if (properties) {
                    properties[name] = value;
                }
                break;
            default:
                if (!specialProjectExtensions.includes(name) && !/^[a-z]{1,3}-.*/.test(name)) {
                    context.warn(`Project extension with invalid name found.`, name);
                }
                if (extensions) {
                    extensions[name] = value;
                }
                break;
        }
    }
    let collectionListener;
    if (context.trackChanges) {
        collectionListener = (name, newValue, collection) => {
            if (hasTargets) {
                jsonMetadata.addChange(['projects', projectName, 'targets', name], newValue, 'target');
            }
            else {
                jsonMetadata.addChange(['projects', projectName, 'targets'], collection, 'targetcollection');
            }
        };
    }
    const base = {
        targets: new definitions_1.TargetDefinitionCollection(targets, collectionListener),
        // If not tracking changes the `extensions` variable will contain the parsed
        // values.  Otherwise the extensions are tracked via a virtual AST object.
        extensions: extensions !== null && extensions !== void 0 ? extensions : (0, utilities_1.createVirtualAstObject)(projectNodeValue, {
            exclude: ['architect', 'prefix', 'root', 'sourceRoot', 'targets'],
            listener(path, value) {
                jsonMetadata.addChange(['projects', projectName, ...path], value);
            },
        }),
    };
    const baseKeys = new Set(Object.keys(base));
    const project = properties !== null && properties !== void 0 ? properties : (0, utilities_1.createVirtualAstObject)(projectNodeValue, {
        include: ['prefix', 'root', 'sourceRoot', ...baseKeys],
        listener(path, value) {
            if (!baseKeys.has(path[0])) {
                jsonMetadata.addChange(['projects', projectName, ...path], value);
            }
        },
    });
    return Object.assign(project, base);
}
function parseTargetsObject(projectName, targetsNode, context) {
    const jsonMetadata = context.metadata;
    const targets = Object.create(null);
    for (const [name, value] of Object.entries((0, jsonc_parser_1.getNodeValue)(targetsNode))) {
        if (!(0, utils_1.isJsonObject)(value)) {
            context.warn('Skipping invalid target value; expected an object.', value);
            continue;
        }
        if (context.trackChanges) {
            targets[name] = (0, utilities_1.createVirtualAstObject)(value, {
                include: ['builder', 'options', 'configurations', 'defaultConfiguration'],
                listener(path, value) {
                    jsonMetadata.addChange(['projects', projectName, 'targets', name, ...path], value);
                },
            });
        }
        else {
            targets[name] = value;
        }
    }
    return targets;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVhZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvd29ya3NwYWNlL2pzb24vcmVhZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILCtDQUFpRjtBQUNqRiw0Q0FBMkQ7QUFDM0QsZ0RBT3dCO0FBRXhCLHlDQUF3RTtBQUN4RSwyQ0FBcUQ7QUFVOUMsS0FBSyxVQUFVLGlCQUFpQixDQUNyQyxJQUFZLEVBQ1osSUFBbUI7SUFFbkIsTUFBTSxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3RDLElBQUksR0FBRyxLQUFLLFNBQVMsRUFBRTtRQUNyQixNQUFNLElBQUksS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7S0FDbkQ7SUFFRCxNQUFNLEdBQUcsR0FBRyxJQUFBLHdCQUFTLEVBQUMsR0FBRyxFQUFFLFNBQVMsRUFBRSxFQUFFLGtCQUFrQixFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQzdGLElBQUksQ0FBQSxHQUFHLGFBQUgsR0FBRyx1QkFBSCxHQUFHLENBQUUsSUFBSSxNQUFLLFFBQVEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUU7UUFDM0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxnREFBZ0QsQ0FBQyxDQUFDO0tBQ25FO0lBRUQsZ0JBQWdCO0lBQ2hCLE1BQU0sV0FBVyxHQUFHLElBQUEsaUNBQWtCLEVBQUMsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztJQUN6RCxJQUFJLENBQUMsV0FBVyxFQUFFO1FBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsK0NBQStDLENBQUMsQ0FBQztLQUNsRTtJQUNELE1BQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUM7SUFDbEMs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V0FBaUIsRUFDakIsT0FBc0I7SUFFdEIsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQztJQUN0QyxNQUFNLE9BQU8sR0FBcUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV0RSxLQUFLLE1BQU0sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBWSxJQUFBLDJCQUFZLEVBQUMsV0FBVyxDQUFDLENBQUMsRUFBRTtRQUNoRixJQUFJLENBQUMsSUFBQSxvQkFBWSxFQUFDLEtBQUssQ0FBQyxFQUFFO1lBQ3hCLE9BQU8sQ0FBQyxJQUFJLENBQUMsb0RBQW9ELEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDMUUsU0FBUztTQUNWO1FBRUQsSUFBSSxPQUFPLENBQUMsWUFBWSxFQUFFO1lBQ3hCLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFBLGtDQUFzQixFQUFtQixLQUFLLEVBQUU7Z0JBQzlELE9BQU8sRUFBRSxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsc0JBQXNCLENBQUM7Z0JBQ3pFLFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSztvQkFDbEIsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUNyRixDQUFDO2FBQ0YsQ0FBQyxDQUFDO1NBQ0o7YUFBTTtZQUNMLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFvQyxDQUFDO1NBQ3REO0tBQ0Y7SUFFRCxPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IE5vZGUsIGZpbmROb2RlQXRMb2NhdGlvbiwgZ2V0Tm9kZVZhbHVlLCBwYXJzZVRyZWUgfSBmcm9tICdqc29uYy1wYXJzZXInO1xuaW1wb3J0IHsgSnNvblZhbHVlLCBpc0pzb25PYmplY3QgfSBmcm9tICcuLi8uLi9qc29uL3V0aWxzJztcbmltcG9ydCB7XG4gIERlZmluaXRpb25Db2xsZWN0aW9uTGlzdGVuZXIsXG4gIFByb2plY3REZWZpbml0aW9uLFxuICBQcm9qZWN0RGVmaW5pdGlvbkNvbGxlY3Rpb24sXG4gIFRhcmdldERlZmluaXRpb24sXG4gIFRhcmdldERlZmluaXRpb25Db2xsZWN0aW9uLFxuICBXb3Jrc3BhY2VEZWZpbml0aW9uLFxufSBmcm9tICcuLi9kZWZpbml0aW9ucyc7XG5pbXBvcnQgeyBXb3Jrc3BhY2VIb3N0IH0gZnJvbSAnLi4vaG9zdCc7XG5pbXBvcnQgeyBKc29uV29ya3NwYWNlTWV0YWRhdGEsIEpzb25Xb3Jrc3BhY2VTeW1ib2wgfSBmcm9tICcuL21ldGFkYXRhJztcbmltcG9ydCB7IGNyZWF0ZVZpcnR1YWxBc3RPYmplY3QgfSBmcm9tICcuL3V0aWxpdGllcyc7XG5cbmludGVyZmFjZSBQYXJzZXJDb250ZXh0IHtcbiAgcmVhZG9ubHkgaG9zdDogV29ya3NwYWNlSG9zdDtcbiAgcmVhZG9ubHkgbWV0YWRhdGE6IEpzb25Xb3Jrc3BhY2VNZXRhZGF0YTtcbiAgcmVhZG9ubHkgdHJhY2tDaGFuZ2VzOiBib29sZWFuO1xuICBlcnJvcihtZXNzYWdlOiBzdHJpbmcsIG5vZGU6IEpzb25WYWx1ZSk6IHZvaWQ7XG4gIHdhcm4obWVzc2FnZTogc3RyaW5nLCBub2RlOiBKc29uVmFsdWUpOiB2b2lkO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVhZEpzb25Xb3Jrc3BhY2UoXG4gIHBhdGg6IHN0cmluZyxcbiAgaG9zdDogV29ya3NwYWNlSG9zdCxcbik6IFByb21pc2U8V29ya3NwYWNlRGVmaW5pdGlvbj4ge1xuICBjb25zdCByYXcgPSBhd2FpdCBob3N0LnJlYWRGaWxlKHBhdGgpO1xuICBpZiAocmF3ID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuYWJsZSB0byByZWFkIHdvcmtzcGFjZSBmaWxlLicpO1xuICB9XG5cbiAgY29uc3QgYXN0ID0gcGFyc2VUcmVlKHJhdywgdW5kZWZpbmVkLCB7IGFsbG93VHJhaWxpbmdDb21tYTogdHJ1ZSwgZGlzYWxsb3dDb21tZW50czogZmFsc2UgfSk7XG4gIGlmIChhc3Q/LnR5cGUgIT09ICdvYmplY3QnIHx8ICFhc3QuY2hpbGRyZW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgd29ya3NwYWNlIGZpbGUgLSBleHBlY3RlZCBKU09OIG9iamVjdC4nKTtcbiAgfVxuXG4gIC8vIFZlcnNpb24gY2hlY2tcbiAgY29uc3QgdmVyc2lvbk5vZGUgPSBmaW5kTm9kZUF0TG9jYXRpb24oYXN0LCBbJ3ZlcnNpb24nXSk7XG4gIGlmICghdmVyc2lvbk5vZGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZm9ybWF0IC0gdmVyc2lvbiBzcGVjaWZpZXIgbm90IGZvdW5kLicpO1xuICB9XG4gIGNvbnN0IHZlcnNpb24gPSB2ZXJzaW9uTm9kZS52YWx1ZTtcbiAgaWYgKHZlcnNpb24gIT09IDEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZm9ybWF0IHZlcnNpb24gZGV0ZWN0ZWQgLSBFeHBlY3RlZDpbIDEgXSBGb3VuZDogWyAke3ZlcnNpb259IF1gKTtcbiAgfVxuXG4gIGNvbnN0IGNvbnRleHQ6IFBhcnNlckNvbnRleHQgPSB7XG4gICAgaG9zdCxcbiAgICBtZXRhZGF0YTogbmV3IEpzb25Xb3Jrc3BhY2VNZXRhZGF0YShwYXRoLCBhc3QsIHJhdyksXG4gICAgdHJhY2tDaGFuZ2VzOiB0cnVlLFxuICAgIGVycm9yKG1lc3NhZ2UsIF9ub2RlKSB7XG4gICAgICAvLyBUT0RPOiBEaWFnbm9zdGljIHJlcG9ydGluZyBzdXBwb3J0XG4gICAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgfSxcbiAgICB3YXJuKF9tZXNzYWdlLCBfbm9kZSkge1xuICAgICAgLy8gVE9ETzogRGlhZ25vc3RpYyByZXBvcnRpbmcgc3VwcG9ydFxuICAgIH0sXG4gIH07XG5cbiAgY29uc3Qgd29ya3NwYWNlID0gcGFyc2VXb3Jrc3BhY2UoYXN0LCBjb250ZXh0KTtcblxuICByZXR1cm4gd29ya3NwYWNlO1xufVxuXG5jb25zdCBzcGVjaWFsV29ya3NwYWNlRXh0ZW5zaW9ucyA9IFsnY2xpJywgJ2RlZmF1bHRQcm9qZWN0JywgJ25ld1Byb2plY3RSb290JywgJ3NjaGVtYXRpY3MnXTtcblxuY29uc3Qgc3BlY2lhbFByb2plY3RFeHRlbnNpb25zID0gWydjbGknLCAnc2NoZW1hdGljcycsICdwcm9qZWN0VHlwZSddO1xuXG5mdW5jdGlvbiBwYXJzZVdvcmtzcGFjZSh3b3Jrc3BhY2VOb2RlOiBOb2RlLCBjb250ZXh0OiBQYXJzZXJDb250ZXh0KTogV29ya3NwYWNlRGVmaW5pdGlvbiB7XG4gIGNvbnN0IGpzb25NZXRhZGF0YSA9IGNvbnRleHQubWV0YWRhdGE7XG4gIGxldCBwcm9qZWN0cztcbiAgbGV0IGV4dGVuc2lvbnM6IFJlY29yZDxzdHJpbmcsIEpzb25WYWx1ZT4gfCB1bmRlZmluZWQ7XG4gIGlmICghY29udGV4dC50cmFja0NoYW5nZXMpIHtcbiAgICBleHRlbnNpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgfVxuXG4gIC8vIFRPRE86IGBnZXROb2RlVmFsdWVgIC0gbG9va3MgcG90ZW50aWFsbHkgZXhwZW5zaXZlIHNpbmNlIGl0IHdhbGtzIHRoZSB3aG9sZSB0cmVlIGFuZCBpbnN0YW50aWF0ZXMgdGhlIGZ1bGwgb2JqZWN0IHN0cnVjdHVyZSBlYWNoIHRpbWUuXG4gIC8vIE1pZ2h0IGJlIHNvbWV0aGluZyB0byBsb29rIGF0IG1vdmluZyBmb3J3YXJkIHRvIG9wdGltaXplLlxuICBjb25zdCB3b3Jrc3BhY2VOb2RlVmFsdWUgPSBnZXROb2RlVmFsdWUod29ya3NwYWNlTm9kZSk7XG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllczxKc29uVmFsdWU+KHdvcmtzcGFjZU5vZGVWYWx1ZSkpIHtcbiAgICBpZiAobmFtZSA9PT0gJyRzY2hlbWEnIHx8IG5hbWUgPT09ICd2ZXJzaW9uJykge1xuICAgICAgLy8gc2tpcFxuICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ3Byb2plY3RzJykge1xuICAgICAgY29uc3Qgbm9kZXMgPSBmaW5kTm9kZUF0TG9jYXRpb24od29ya3NwYWNlTm9kZSwgWydwcm9qZWN0cyddKTtcbiAgICAgIGlmICghaXNKc29uT2JqZWN0KHZhbHVlKSB8fCAhbm9kZXMpIHtcbiAgICAgICAgY29udGV4dC5lcnJvcignSW52YWxpZCBcInByb2plY3RzXCIgZmllbGQgZm91bmQ7IGV4cGVjdGVkIGFuIG9iamVjdC4nLCB2YWx1ZSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBwcm9qZWN0cyA9IHBhcnNlUHJvamVjdHNPYmplY3Qobm9kZXMsIGNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXNwZWNpYWxXb3Jrc3BhY2VFeHRlbnNpb25zLmluY2x1ZGVzKG5hbWUpICYmICEvXlthLXpdezEsM30tLiovLnRlc3QobmFtZSkpIHtcbiAgICAgICAgY29udGV4dC53YXJuKGBQcm9qZWN0IGV4dGVuc2lvbiB3aXRoIGludmFsaWQgbmFtZSBmb3VuZC5gLCBuYW1lKTtcbiAgICAgIH1cbiAgICAgIGlmIChleHRlbnNpb25zKSB7XG4gICAgICAgIGV4dGVuc2lvbnNbbmFtZV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBsZXQgY29sbGVjdGlvbkxpc3RlbmVyOiBEZWZpbml0aW9uQ29sbGVjdGlvbkxpc3RlbmVyPFByb2plY3REZWZpbml0aW9uPiB8IHVuZGVmaW5lZDtcbiAgaWYgKGNvbnRleHQudHJhY2tDaGFuZ2VzKSB7XG4gICAgY29sbGVjdGlvbkxpc3RlbmVyID0gKG5hbWUsIG5ld1ZhbHVlKSA9PiB7XG4gICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKFsncHJvamVjdHMnLCBuYW1lXSwgbmV3VmFsdWUsICdwcm9qZWN0Jyk7XG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3RDb2xsZWN0aW9uID0gbmV3IFByb2plY3REZWZpbml0aW9uQ29sbGVjdGlvbihwcm9qZWN0cywgY29sbGVjdGlvbkxpc3RlbmVyKTtcblxuICByZXR1cm4ge1xuICAgIFtKc29uV29ya3NwYWNlU3ltYm9sXToganNvbk1ldGFkYXRhLFxuICAgIHByb2plY3RzOiBwcm9qZWN0Q29sbGVjdGlvbixcbiAgICAvLyBJZiBub3QgdHJhY2tpbmcgY2hhbmdlcyB0aGUgYGV4dGVuc2lvbnNgIHZhcmlhYmxlIHdpbGwgY29udGFpbiB0aGUgcGFyc2VkXG4gICAgLy8gdmFsdWVzLiAgT3RoZXJ3aXNlIHRoZSBleHRlbnNpb25zIGFyZSB0cmFja2VkIHZpYSBhIHZpcnR1YWwgQVNUIG9iamVjdC5cbiAgICBleHRlbnNpb25zOlxuICAgICAgZXh0ZW5zaW9ucyA/P1xuICAgICAgY3JlYXRlVmlydHVhbEFzdE9iamVjdCh3b3Jrc3BhY2VOb2RlVmFsdWUsIHtcbiAgICAgICAgZXhjbHVkZTogWyckc2NoZW1hJywgJ3ZlcnNpb24nLCAncHJvamVjdHMnXSxcbiAgICAgICAgbGlzdGVuZXIocGF0aCwgdmFsdWUpIHtcbiAgICAgICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKHBhdGgsIHZhbHVlKTtcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICB9IGFzIFdvcmtzcGFjZURlZmluaXRpb247XG59XG5cbmZ1bmN0aW9uIHBhcnNlUHJvamVjdHNPYmplY3QoXG4gIHByb2plY3RzTm9kZTogTm9kZSxcbiAgY29udGV4dDogUGFyc2VyQ29udGV4dCxcbik6IFJlY29yZDxzdHJpbmcsIFByb2plY3REZWZpbml0aW9uPiB7XG4gIGNvbnN0IHByb2plY3RzOiBSZWNvcmQ8c3RyaW5nLCBQcm9qZWN0RGVmaW5pdGlvbj4gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllczxKc29uVmFsdWU+KGdldE5vZGVWYWx1ZShwcm9qZWN0c05vZGUpKSkge1xuICAgIGNvbnN0IG5vZGVzID0gZmluZE5vZGVBdExvY2F0aW9uKHByb2plY3RzTm9kZSwgW25hbWVdKTtcbiAgICBpZiAoIWlzSnNvbk9iamVjdCh2YWx1ZSkgfHwgIW5vZGVzKSB7XG4gICAgICBjb250ZXh0Lndhcm4oJ1NraXBwaW5nIGludmFsaWQgcHJvamVjdCB2YWx1ZTsgZXhwZWN0ZWQgYW4gb2JqZWN0LicsIHZhbHVlKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHByb2plY3RzW25hbWVdID0gcGFyc2VQcm9qZWN0KG5hbWUsIG5vZGVzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHJldHVybiBwcm9qZWN0cztcbn1cblxuZnVuY3Rpb24gcGFyc2VQcm9qZWN0KFxuICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICBwcm9qZWN0Tm9kZTogTm9kZSxcbiAgY29udGV4dDogUGFyc2VyQ29udGV4dCxcbik6IFByb2plY3REZWZpbml0aW9uIHtcbiAgY29uc3QganNvbk1ldGFkYXRhID0gY29udGV4dC5tZXRhZGF0YTtcbiAgbGV0IHRhcmdldHM7XG4gIGxldCBoYXNUYXJnZXRzID0gZmFsc2U7XG4gIGxldCBleHRlbnNpb25zOiBSZWNvcmQ8c3RyaW5nLCBKc29uVmFsdWU+IHwgdW5kZWZpbmVkO1xuICBsZXQgcHJvcGVydGllczogUmVjb3JkPCdyb290JyB8ICdzb3VyY2VSb290JyB8ICdwcmVmaXgnLCBzdHJpbmc+IHwgdW5kZWZpbmVkO1xuICBpZiAoIWNvbnRleHQudHJhY2tDaGFuZ2VzKSB7XG4gICAgLy8gSWYgbm90IHRyYWNraW5nIGNoYW5nZXMsIHRoZSBwYXJzZXIgd2lsbCBzdG9yZSB0aGUgdmFsdWVzIGRpcmVjdGx5IGluIHN0YW5kYXJkIG9iamVjdHNcbiAgICBleHRlbnNpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBwcm9wZXJ0aWVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3ROb2RlVmFsdWUgPSBnZXROb2RlVmFsdWUocHJvamVjdE5vZGUpO1xuXG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllczxKc29uVmFsdWU+KHByb2plY3ROb2RlVmFsdWUpKSB7XG4gICAgc3dpdGNoIChuYW1lKSB7XG4gICAgICBjYXNlICd0YXJnZXRzJzpcbiAgICAgIGNhc2UgJ2FyY2hpdGVjdCc6XG4gICAgICAgIGNvbnN0IG5vZGVzID0gZmluZE5vZGVBdExvY2F0aW9uKHByb2plY3ROb2RlLCBbbmFtZV0pO1xuICAgICAgICBpZiAoIWlzSnNvbk9iamVjdCh2YWx1ZSkgfHwgIW5vZGVzKSB7XG4gICAgICAgICAgY29udGV4dC5lcnJvcihgSW52YWxpZCBcIiR7bmFtZX1cIiBmaWVsZCBmb3VuZDsgZXhwZWN0ZWQgYW4gb2JqZWN0LmAsIHZhbHVlKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBoYXNUYXJnZXRzID0gdHJ1ZTtcbiAgICAgICAgdGFyZ2V0cyA9IHBhcnNlVGFyZ2V0c09iamVjdChwcm9qZWN0TmFtZSwgbm9kZXMsIGNvbnRleHQpO1xuICAgICAgICBqc29uTWV0YWRhdGEuaGFzTGVnYWN5VGFyZ2V0c05hbWUgPSBuYW1lID09PSAnYXJjaGl0ZWN0JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdwcmVmaXgnOlxuICAgICAgY2FzZSAncm9vdCc6XG4gICAgICBjYXNlICdzb3VyY2VSb290JzpcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBjb250ZXh0Lndhcm4oYFByb2plY3QgcHJvcGVydHkgXCIke25hbWV9XCIgc2hvdWxkIGJlIGEgc3RyaW5nLmAsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocHJvcGVydGllcykge1xuICAgICAgICAgIHByb3BlcnRpZXNbbmFtZV0gPSB2YWx1ZSBhcyBzdHJpbmc7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAoIXNwZWNpYWxQcm9qZWN0RXh0ZW5zaW9ucy5pbmNsdWRlcyhuYW1lKSAmJiAhL15bYS16XXsxLDN9LS4qLy50ZXN0KG5hbWUpKSB7XG4gICAgICAgICAgY29udGV4dC53YXJuKGBQcm9qZWN0IGV4dGVuc2lvbiB3aXRoIGludmFsaWQgbmFtZSBmb3VuZC5gLCBuYW1lKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXh0ZW5zaW9ucykge1xuICAgICAgICAgIGV4dGVuc2lvbnNbbmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBsZXQgY29sbGVjdGlvbkxpc3RlbmVyOiBEZWZpbml0aW9uQ29sbGVjdGlvbkxpc3RlbmVyPFRhcmdldERlZmluaXRpb24+IHwgdW5kZWZpbmVkO1xuICBpZiAoY29udGV4dC50cmFja0NoYW5nZXMpIHtcbiAgICBjb2xsZWN0aW9uTGlzdGVuZXIgPSAobmFtZSwgbmV3VmFsdWUsIGNvbGxlY3Rpb24pID0+IHtcbiAgICAgIGlmIChoYXNUYXJnZXRzKSB7XG4gICAgICAgIGpzb25NZXRhZGF0YS5hZGRDaGFuZ2UoWydwcm9qZWN0cycsIHByb2plY3ROYW1lLCAndGFyZ2V0cycsIG5hbWVdLCBuZXdWYWx1ZSwgJ3RhcmdldCcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAganNvbk1ldGFkYXRhLmFkZENoYW5nZShcbiAgICAgICAgICBbJ3Byb2plY3RzJywgcHJvamVjdE5hbWUsICd0YXJnZXRzJ10sXG4gICAgICAgICAgY29sbGVjdGlvbixcbiAgICAgICAgICAndGFyZ2V0Y29sbGVjdGlvbicsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IGJhc2UgPSB7XG4gICAgdGFyZ2V0czogbmV3IFRhcmdldERlZmluaXRpb25Db2xsZWN0aW9uKHRhcmdldHMsIGNvbGxlY3Rpb25MaXN0ZW5lciksXG4gICAgLy8gSWYgbm90IHRyYWNraW5nIGNoYW5nZXMgdGhlIGBleHRlbnNpb25zYCB2YXJpYWJsZSB3aWxsIGNvbnRhaW4gdGhlIHBhcnNlZFxuICAgIC8vIHZhbHVlcy4gIE90aGVyd2lzZSB0aGUgZXh0ZW5zaW9ucyBhcmUgdHJhY2tlZCB2aWEgYSB2aXJ0dWFsIEFTVCBvYmplY3QuXG4gICAgZXh0ZW5zaW9uczpcbiAgICAgIGV4dGVuc2lvbnMgPz9cbiAgICAgIGNyZWF0ZVZpcnR1YWxBc3RPYmplY3QocHJvamVjdE5vZGVWYWx1ZSwge1xuICAgICAgICBleGNsdWRlOiBbJ2FyY2hpdGVjdCcsICdwcmVmaXgnLCAncm9vdCcsICdzb3VyY2VSb290JywgJ3RhcmdldHMnXSxcbiAgICAgICAgbGlzdGVuZXIocGF0aCwgdmFsdWUpIHtcbiAgICAgICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKFsncHJvamVjdHMnLCBwcm9qZWN0TmFtZSwgLi4ucGF0aF0sIHZhbHVlKTtcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICB9O1xuXG4gIGNvbnN0IGJhc2VLZXlzID0gbmV3IFNldChPYmplY3Qua2V5cyhiYXNlKSk7XG4gIGNvbnN0IHByb2plY3QgPVxuICAgIHByb3BlcnRpZXMgPz9cbiAgICBjcmVhdGVWaXJ0dWFsQXN0T2JqZWN0PFByb2plY3REZWZpbml0aW9uPihwcm9qZWN0Tm9kZVZhbHVlLCB7XG4gICAgICBpbmNsdWRlOiBbJ3ByZWZpeCcsICdyb290JywgJ3NvdXJjZVJvb3QnLCAuLi5iYXNlS2V5c10sXG4gICAgICBsaXN0ZW5lcihwYXRoLCB2YWx1ZSkge1xuICAgICAgICBpZiAoIWJhc2VLZXlzLmhhcyhwYXRoWzBdKSkge1xuICAgICAgICAgIGpzb25NZXRhZGF0YS5hZGRDaGFuZ2UoWydwcm9qZWN0cycsIHByb2plY3ROYW1lLCAuLi5wYXRoXSwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0pO1xuXG4gIHJldHVybiBPYmplY3QuYXNzaWduKHByb2plY3QsIGJhc2UpIGFzIFByb2plY3REZWZpbml0aW9uO1xufVxuXG5mdW5jdGlvbiBwYXJzZVRhcmdldHNPYmplY3QoXG4gIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gIHRhcmdldHNOb2RlOiBOb2RlLFxuICBjb250ZXh0OiBQYXJzZXJDb250ZXh0LFxuKTogUmVjb3JkPHN0cmluZywgVGFyZ2V0RGVmaW5pdGlvbj4ge1xuICBjb25zdCBqc29uTWV0YWRhdGEgPSBjb250ZXh0Lm1ldGFkYXRhO1xuICBjb25zdCB0YXJnZXRzOiBSZWNvcmQ8c3RyaW5nLCBUYXJnZXREZWZpbml0aW9uPiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzPEpzb25WYWx1ZT4oZ2V0Tm9kZVZhbHVlKHRhcmdldHNOb2RlKSkpIHtcbiAgICBpZiAoIWlzSnNvbk9iamVjdCh2YWx1ZSkpIHtcbiAgICAgIGNvbnRleHQud2FybignU2tpcHBpbmcgaW52YWxpZCB0YXJnZXQgdmFsdWU7IGV4cGVjdGVkIGFuIG9iamVjdC4nLCB2YWx1ZSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoY29udGV4dC50cmFja0NoYW5nZXMpIHtcbiAgICAgIHRhcmdldHNbbmFtZV0gPSBjcmVhdGVWaXJ0dWFsQXN0T2JqZWN0PFRhcmdldERlZmluaXRpb24+KHZhbHVlLCB7XG4gICAgICAgIGluY2x1ZGU6IFsnYnVpbGRlcicsICdvcHRpb25zJywgJ2NvbmZpZ3VyYXRpb25zJywgJ2RlZmF1bHRDb25maWd1cmF0aW9uJ10sXG4gICAgICAgIGxpc3RlbmVyKHBhdGgsIHZhbHVlKSB7XG4gICAgICAgICAganNvbk1ldGFkYXRhLmFkZENoYW5nZShbJ3Byb2plY3RzJywgcHJvamVjdE5hbWUsICd0YXJnZXRzJywgbmFtZSwgLi4ucGF0aF0sIHZhbHVlKTtcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXRzW25hbWVdID0gdmFsdWUgYXMgdW5rbm93biBhcyBUYXJnZXREZWZpbml0aW9uO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0YXJnZXRzO1xufVxuIl19