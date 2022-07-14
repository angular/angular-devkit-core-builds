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
        warn(message, _node) {
            // TODO: Diagnostic reporting support
            // eslint-disable-next-line no-console
            console.warn(message);
        },
    };
    const workspace = parseWorkspace(ast, context);
    return workspace;
}
exports.readJsonWorkspace = readJsonWorkspace;
const specialWorkspaceExtensions = ['cli', 'defaultProject', 'newProjectRoot', 'schematics'];
const specialProjectExtensions = ['cli', 'schematics', 'projectType', 'i18n'];
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
    if (!('root' in projectNodeValue)) {
        // TODO(alan-agius4): change this to error in v15.
        context.warn(`Project "${projectName}" is missing a required property "root". This will become an error in the next major version.`, projectNodeValue);
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVhZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvd29ya3NwYWNlL2pzb24vcmVhZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILCtDQUFpRjtBQUNqRiw0Q0FBMkQ7QUFDM0QsZ0RBT3dCO0FBRXhCLHlDQUF3RTtBQUN4RSwyQ0FBcUQ7QUFVOUMsS0FBSyxVQUFVLGlCQUFpQixDQUNyQyxJQUFZLEVBQ1osSUFBbUI7SUFFbkIsTUFBTSxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3RDLElBQUksR0FBRyxLQUFLLFNBQVMsRUFBRTtRQUNyQixNQUFNLElBQUksS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7S0FDbkQ7SUFFRCxNQUFNLEdBQUcsR0FBRyxJQUFBLHdCQUFTLEVBQUMsR0FBRyxFQUFFLFNBQVMsRUFBRSxFQUFFLGtCQUFrQixFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQzdGLElBQUksQ0FBQSxHQUFHLGFBQUgsR0FBRyx1QkFBSCxHQUFHLENBQUUsSUFBSSxNQUFLLFFBQVEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUU7UUFDM0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxnREFBZ0QsQ0FBQyxDQUFDO0tBQ25FO0lBRUQsZ0JBQWdCO0lBQ2hCLE1BQU0sV0FBVyxHQUFHLElBQUEsaUNBQWtCLEVBQUMsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztJQUN6RCxJQUFJLENBQUMsV0FBVyxFQUFFO1FBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsK0NBQStDLENBQUMsQ0FBQztLQUNsRTtJQUNELE1BQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUM7SUFDbEMs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QztTQUN0RDtLQUNGO0lBRUQsT0FBTyxPQUFPLENBQUM7QUFDakIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBOb2RlLCBmaW5kTm9kZUF0TG9jYXRpb24sIGdldE5vZGVWYWx1ZSwgcGFyc2VUcmVlIH0gZnJvbSAnanNvbmMtcGFyc2VyJztcbmltcG9ydCB7IEpzb25WYWx1ZSwgaXNKc29uT2JqZWN0IH0gZnJvbSAnLi4vLi4vanNvbi91dGlscyc7XG5pbXBvcnQge1xuICBEZWZpbml0aW9uQ29sbGVjdGlvbkxpc3RlbmVyLFxuICBQcm9qZWN0RGVmaW5pdGlvbixcbiAgUHJvamVjdERlZmluaXRpb25Db2xsZWN0aW9uLFxuICBUYXJnZXREZWZpbml0aW9uLFxuICBUYXJnZXREZWZpbml0aW9uQ29sbGVjdGlvbixcbiAgV29ya3NwYWNlRGVmaW5pdGlvbixcbn0gZnJvbSAnLi4vZGVmaW5pdGlvbnMnO1xuaW1wb3J0IHsgV29ya3NwYWNlSG9zdCB9IGZyb20gJy4uL2hvc3QnO1xuaW1wb3J0IHsgSnNvbldvcmtzcGFjZU1ldGFkYXRhLCBKc29uV29ya3NwYWNlU3ltYm9sIH0gZnJvbSAnLi9tZXRhZGF0YSc7XG5pbXBvcnQgeyBjcmVhdGVWaXJ0dWFsQXN0T2JqZWN0IH0gZnJvbSAnLi91dGlsaXRpZXMnO1xuXG5pbnRlcmZhY2UgUGFyc2VyQ29udGV4dCB7XG4gIHJlYWRvbmx5IGhvc3Q6IFdvcmtzcGFjZUhvc3Q7XG4gIHJlYWRvbmx5IG1ldGFkYXRhOiBKc29uV29ya3NwYWNlTWV0YWRhdGE7XG4gIHJlYWRvbmx5IHRyYWNrQ2hhbmdlczogYm9vbGVhbjtcbiAgZXJyb3IobWVzc2FnZTogc3RyaW5nLCBub2RlOiBKc29uVmFsdWUpOiB2b2lkO1xuICB3YXJuKG1lc3NhZ2U6IHN0cmluZywgbm9kZTogSnNvblZhbHVlKTogdm9pZDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWRKc29uV29ya3NwYWNlKFxuICBwYXRoOiBzdHJpbmcsXG4gIGhvc3Q6IFdvcmtzcGFjZUhvc3QsXG4pOiBQcm9taXNlPFdvcmtzcGFjZURlZmluaXRpb24+IHtcbiAgY29uc3QgcmF3ID0gYXdhaXQgaG9zdC5yZWFkRmlsZShwYXRoKTtcbiAgaWYgKHJhdyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gcmVhZCB3b3Jrc3BhY2UgZmlsZS4nKTtcbiAgfVxuXG4gIGNvbnN0IGFzdCA9IHBhcnNlVHJlZShyYXcsIHVuZGVmaW5lZCwgeyBhbGxvd1RyYWlsaW5nQ29tbWE6IHRydWUsIGRpc2FsbG93Q29tbWVudHM6IGZhbHNlIH0pO1xuICBpZiAoYXN0Py50eXBlICE9PSAnb2JqZWN0JyB8fCAhYXN0LmNoaWxkcmVuKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHdvcmtzcGFjZSBmaWxlIC0gZXhwZWN0ZWQgSlNPTiBvYmplY3QuJyk7XG4gIH1cblxuICAvLyBWZXJzaW9uIGNoZWNrXG4gIGNvbnN0IHZlcnNpb25Ob2RlID0gZmluZE5vZGVBdExvY2F0aW9uKGFzdCwgWyd2ZXJzaW9uJ10pO1xuICBpZiAoIXZlcnNpb25Ob2RlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGZvcm1hdCAtIHZlcnNpb24gc3BlY2lmaWVyIG5vdCBmb3VuZC4nKTtcbiAgfVxuICBjb25zdCB2ZXJzaW9uID0gdmVyc2lvbk5vZGUudmFsdWU7XG4gIGlmICh2ZXJzaW9uICE9PSAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGZvcm1hdCB2ZXJzaW9uIGRldGVjdGVkIC0gRXhwZWN0ZWQ6WyAxIF0gRm91bmQ6IFsgJHt2ZXJzaW9ufSBdYCk7XG4gIH1cblxuICBjb25zdCBjb250ZXh0OiBQYXJzZXJDb250ZXh0ID0ge1xuICAgIGhvc3QsXG4gICAgbWV0YWRhdGE6IG5ldyBKc29uV29ya3NwYWNlTWV0YWRhdGEocGF0aCwgYXN0LCByYXcpLFxuICAgIHRyYWNrQ2hhbmdlczogdHJ1ZSxcbiAgICBlcnJvcihtZXNzYWdlLCBfbm9kZSkge1xuICAgICAgLy8gVE9ETzogRGlhZ25vc3RpYyByZXBvcnRpbmcgc3VwcG9ydFxuICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgIH0sXG4gICAgd2FybihtZXNzYWdlLCBfbm9kZSkge1xuICAgICAgLy8gVE9ETzogRGlhZ25vc3RpYyByZXBvcnRpbmcgc3VwcG9ydFxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICAgIGNvbnNvbGUud2FybihtZXNzYWdlKTtcbiAgICB9LFxuICB9O1xuXG4gIGNvbnN0IHdvcmtzcGFjZSA9IHBhcnNlV29ya3NwYWNlKGFzdCwgY29udGV4dCk7XG5cbiAgcmV0dXJuIHdvcmtzcGFjZTtcbn1cblxuY29uc3Qgc3BlY2lhbFdvcmtzcGFjZUV4dGVuc2lvbnMgPSBbJ2NsaScsICdkZWZhdWx0UHJvamVjdCcsICduZXdQcm9qZWN0Um9vdCcsICdzY2hlbWF0aWNzJ107XG5cbmNvbnN0IHNwZWNpYWxQcm9qZWN0RXh0ZW5zaW9ucyA9IFsnY2xpJywgJ3NjaGVtYXRpY3MnLCAncHJvamVjdFR5cGUnLCAnaTE4biddO1xuXG5mdW5jdGlvbiBwYXJzZVdvcmtzcGFjZSh3b3Jrc3BhY2VOb2RlOiBOb2RlLCBjb250ZXh0OiBQYXJzZXJDb250ZXh0KTogV29ya3NwYWNlRGVmaW5pdGlvbiB7XG4gIGNvbnN0IGpzb25NZXRhZGF0YSA9IGNvbnRleHQubWV0YWRhdGE7XG4gIGxldCBwcm9qZWN0cztcbiAgbGV0IGV4dGVuc2lvbnM6IFJlY29yZDxzdHJpbmcsIEpzb25WYWx1ZT4gfCB1bmRlZmluZWQ7XG4gIGlmICghY29udGV4dC50cmFja0NoYW5nZXMpIHtcbiAgICBleHRlbnNpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgfVxuXG4gIC8vIFRPRE86IGBnZXROb2RlVmFsdWVgIC0gbG9va3MgcG90ZW50aWFsbHkgZXhwZW5zaXZlIHNpbmNlIGl0IHdhbGtzIHRoZSB3aG9sZSB0cmVlIGFuZCBpbnN0YW50aWF0ZXMgdGhlIGZ1bGwgb2JqZWN0IHN0cnVjdHVyZSBlYWNoIHRpbWUuXG4gIC8vIE1pZ2h0IGJlIHNvbWV0aGluZyB0byBsb29rIGF0IG1vdmluZyBmb3J3YXJkIHRvIG9wdGltaXplLlxuICBjb25zdCB3b3Jrc3BhY2VOb2RlVmFsdWUgPSBnZXROb2RlVmFsdWUod29ya3NwYWNlTm9kZSk7XG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllczxKc29uVmFsdWU+KHdvcmtzcGFjZU5vZGVWYWx1ZSkpIHtcbiAgICBpZiAobmFtZSA9PT0gJyRzY2hlbWEnIHx8IG5hbWUgPT09ICd2ZXJzaW9uJykge1xuICAgICAgLy8gc2tpcFxuICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ3Byb2plY3RzJykge1xuICAgICAgY29uc3Qgbm9kZXMgPSBmaW5kTm9kZUF0TG9jYXRpb24od29ya3NwYWNlTm9kZSwgWydwcm9qZWN0cyddKTtcbiAgICAgIGlmICghaXNKc29uT2JqZWN0KHZhbHVlKSB8fCAhbm9kZXMpIHtcbiAgICAgICAgY29udGV4dC5lcnJvcignSW52YWxpZCBcInByb2plY3RzXCIgZmllbGQgZm91bmQ7IGV4cGVjdGVkIGFuIG9iamVjdC4nLCB2YWx1ZSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBwcm9qZWN0cyA9IHBhcnNlUHJvamVjdHNPYmplY3Qobm9kZXMsIGNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXNwZWNpYWxXb3Jrc3BhY2VFeHRlbnNpb25zLmluY2x1ZGVzKG5hbWUpICYmICEvXlthLXpdezEsM30tLiovLnRlc3QobmFtZSkpIHtcbiAgICAgICAgY29udGV4dC53YXJuKGBQcm9qZWN0IGV4dGVuc2lvbiB3aXRoIGludmFsaWQgbmFtZSBmb3VuZC5gLCBuYW1lKTtcbiAgICAgIH1cbiAgICAgIGlmIChleHRlbnNpb25zKSB7XG4gICAgICAgIGV4dGVuc2lvbnNbbmFtZV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBsZXQgY29sbGVjdGlvbkxpc3RlbmVyOiBEZWZpbml0aW9uQ29sbGVjdGlvbkxpc3RlbmVyPFByb2plY3REZWZpbml0aW9uPiB8IHVuZGVmaW5lZDtcbiAgaWYgKGNvbnRleHQudHJhY2tDaGFuZ2VzKSB7XG4gICAgY29sbGVjdGlvbkxpc3RlbmVyID0gKG5hbWUsIG5ld1ZhbHVlKSA9PiB7XG4gICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKFsncHJvamVjdHMnLCBuYW1lXSwgbmV3VmFsdWUsICdwcm9qZWN0Jyk7XG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3RDb2xsZWN0aW9uID0gbmV3IFByb2plY3REZWZpbml0aW9uQ29sbGVjdGlvbihwcm9qZWN0cywgY29sbGVjdGlvbkxpc3RlbmVyKTtcblxuICByZXR1cm4ge1xuICAgIFtKc29uV29ya3NwYWNlU3ltYm9sXToganNvbk1ldGFkYXRhLFxuICAgIHByb2plY3RzOiBwcm9qZWN0Q29sbGVjdGlvbixcbiAgICAvLyBJZiBub3QgdHJhY2tpbmcgY2hhbmdlcyB0aGUgYGV4dGVuc2lvbnNgIHZhcmlhYmxlIHdpbGwgY29udGFpbiB0aGUgcGFyc2VkXG4gICAgLy8gdmFsdWVzLiAgT3RoZXJ3aXNlIHRoZSBleHRlbnNpb25zIGFyZSB0cmFja2VkIHZpYSBhIHZpcnR1YWwgQVNUIG9iamVjdC5cbiAgICBleHRlbnNpb25zOlxuICAgICAgZXh0ZW5zaW9ucyA/P1xuICAgICAgY3JlYXRlVmlydHVhbEFzdE9iamVjdCh3b3Jrc3BhY2VOb2RlVmFsdWUsIHtcbiAgICAgICAgZXhjbHVkZTogWyckc2NoZW1hJywgJ3ZlcnNpb24nLCAncHJvamVjdHMnXSxcbiAgICAgICAgbGlzdGVuZXIocGF0aCwgdmFsdWUpIHtcbiAgICAgICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKHBhdGgsIHZhbHVlKTtcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICB9IGFzIFdvcmtzcGFjZURlZmluaXRpb247XG59XG5cbmZ1bmN0aW9uIHBhcnNlUHJvamVjdHNPYmplY3QoXG4gIHByb2plY3RzTm9kZTogTm9kZSxcbiAgY29udGV4dDogUGFyc2VyQ29udGV4dCxcbik6IFJlY29yZDxzdHJpbmcsIFByb2plY3REZWZpbml0aW9uPiB7XG4gIGNvbnN0IHByb2plY3RzOiBSZWNvcmQ8c3RyaW5nLCBQcm9qZWN0RGVmaW5pdGlvbj4gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllczxKc29uVmFsdWU+KGdldE5vZGVWYWx1ZShwcm9qZWN0c05vZGUpKSkge1xuICAgIGNvbnN0IG5vZGVzID0gZmluZE5vZGVBdExvY2F0aW9uKHByb2plY3RzTm9kZSwgW25hbWVdKTtcbiAgICBpZiAoIWlzSnNvbk9iamVjdCh2YWx1ZSkgfHwgIW5vZGVzKSB7XG4gICAgICBjb250ZXh0Lndhcm4oJ1NraXBwaW5nIGludmFsaWQgcHJvamVjdCB2YWx1ZTsgZXhwZWN0ZWQgYW4gb2JqZWN0LicsIHZhbHVlKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHByb2plY3RzW25hbWVdID0gcGFyc2VQcm9qZWN0KG5hbWUsIG5vZGVzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHJldHVybiBwcm9qZWN0cztcbn1cblxuZnVuY3Rpb24gcGFyc2VQcm9qZWN0KFxuICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICBwcm9qZWN0Tm9kZTogTm9kZSxcbiAgY29udGV4dDogUGFyc2VyQ29udGV4dCxcbik6IFByb2plY3REZWZpbml0aW9uIHtcbiAgY29uc3QganNvbk1ldGFkYXRhID0gY29udGV4dC5tZXRhZGF0YTtcbiAgbGV0IHRhcmdldHM7XG4gIGxldCBoYXNUYXJnZXRzID0gZmFsc2U7XG4gIGxldCBleHRlbnNpb25zOiBSZWNvcmQ8c3RyaW5nLCBKc29uVmFsdWU+IHwgdW5kZWZpbmVkO1xuICBsZXQgcHJvcGVydGllczogUmVjb3JkPCdyb290JyB8ICdzb3VyY2VSb290JyB8ICdwcmVmaXgnLCBzdHJpbmc+IHwgdW5kZWZpbmVkO1xuICBpZiAoIWNvbnRleHQudHJhY2tDaGFuZ2VzKSB7XG4gICAgLy8gSWYgbm90IHRyYWNraW5nIGNoYW5nZXMsIHRoZSBwYXJzZXIgd2lsbCBzdG9yZSB0aGUgdmFsdWVzIGRpcmVjdGx5IGluIHN0YW5kYXJkIG9iamVjdHNcbiAgICBleHRlbnNpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBwcm9wZXJ0aWVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3ROb2RlVmFsdWUgPSBnZXROb2RlVmFsdWUocHJvamVjdE5vZGUpO1xuICBpZiAoISgncm9vdCcgaW4gcHJvamVjdE5vZGVWYWx1ZSkpIHtcbiAgICAvLyBUT0RPKGFsYW4tYWdpdXM0KTogY2hhbmdlIHRoaXMgdG8gZXJyb3IgaW4gdjE1LlxuICAgIGNvbnRleHQud2FybihcbiAgICAgIGBQcm9qZWN0IFwiJHtwcm9qZWN0TmFtZX1cIiBpcyBtaXNzaW5nIGEgcmVxdWlyZWQgcHJvcGVydHkgXCJyb290XCIuIFRoaXMgd2lsbCBiZWNvbWUgYW4gZXJyb3IgaW4gdGhlIG5leHQgbWFqb3IgdmVyc2lvbi5gLFxuICAgICAgcHJvamVjdE5vZGVWYWx1ZSxcbiAgICApO1xuICB9XG5cbiAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzPEpzb25WYWx1ZT4ocHJvamVjdE5vZGVWYWx1ZSkpIHtcbiAgICBzd2l0Y2ggKG5hbWUpIHtcbiAgICAgIGNhc2UgJ3RhcmdldHMnOlxuICAgICAgY2FzZSAnYXJjaGl0ZWN0JzpcbiAgICAgICAgY29uc3Qgbm9kZXMgPSBmaW5kTm9kZUF0TG9jYXRpb24ocHJvamVjdE5vZGUsIFtuYW1lXSk7XG4gICAgICAgIGlmICghaXNKc29uT2JqZWN0KHZhbHVlKSB8fCAhbm9kZXMpIHtcbiAgICAgICAgICBjb250ZXh0LmVycm9yKGBJbnZhbGlkIFwiJHtuYW1lfVwiIGZpZWxkIGZvdW5kOyBleHBlY3RlZCBhbiBvYmplY3QuYCwgdmFsdWUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGhhc1RhcmdldHMgPSB0cnVlO1xuICAgICAgICB0YXJnZXRzID0gcGFyc2VUYXJnZXRzT2JqZWN0KHByb2plY3ROYW1lLCBub2RlcywgY29udGV4dCk7XG4gICAgICAgIGpzb25NZXRhZGF0YS5oYXNMZWdhY3lUYXJnZXRzTmFtZSA9IG5hbWUgPT09ICdhcmNoaXRlY3QnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3ByZWZpeCc6XG4gICAgICBjYXNlICdyb290JzpcbiAgICAgIGNhc2UgJ3NvdXJjZVJvb3QnOlxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIGNvbnRleHQud2FybihgUHJvamVjdCBwcm9wZXJ0eSBcIiR7bmFtZX1cIiBzaG91bGQgYmUgYSBzdHJpbmcuYCwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgcHJvcGVydGllc1tuYW1lXSA9IHZhbHVlIGFzIHN0cmluZztcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmICghc3BlY2lhbFByb2plY3RFeHRlbnNpb25zLmluY2x1ZGVzKG5hbWUpICYmICEvXlthLXpdezEsM30tLiovLnRlc3QobmFtZSkpIHtcbiAgICAgICAgICBjb250ZXh0Lndhcm4oYFByb2plY3QgZXh0ZW5zaW9uIHdpdGggaW52YWxpZCBuYW1lIGZvdW5kLmAsIG5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChleHRlbnNpb25zKSB7XG4gICAgICAgICAgZXh0ZW5zaW9uc1tuYW1lXSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGxldCBjb2xsZWN0aW9uTGlzdGVuZXI6IERlZmluaXRpb25Db2xsZWN0aW9uTGlzdGVuZXI8VGFyZ2V0RGVmaW5pdGlvbj4gfCB1bmRlZmluZWQ7XG4gIGlmIChjb250ZXh0LnRyYWNrQ2hhbmdlcykge1xuICAgIGNvbGxlY3Rpb25MaXN0ZW5lciA9IChuYW1lLCBuZXdWYWx1ZSwgY29sbGVjdGlvbikgPT4ge1xuICAgICAgaWYgKGhhc1RhcmdldHMpIHtcbiAgICAgICAganNvbk1ldGFkYXRhLmFkZENoYW5nZShbJ3Byb2plY3RzJywgcHJvamVjdE5hbWUsICd0YXJnZXRzJywgbmFtZV0sIG5ld1ZhbHVlLCAndGFyZ2V0Jyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKFxuICAgICAgICAgIFsncHJvamVjdHMnLCBwcm9qZWN0TmFtZSwgJ3RhcmdldHMnXSxcbiAgICAgICAgICBjb2xsZWN0aW9uLFxuICAgICAgICAgICd0YXJnZXRjb2xsZWN0aW9uJyxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgY29uc3QgYmFzZSA9IHtcbiAgICB0YXJnZXRzOiBuZXcgVGFyZ2V0RGVmaW5pdGlvbkNvbGxlY3Rpb24odGFyZ2V0cywgY29sbGVjdGlvbkxpc3RlbmVyKSxcbiAgICAvLyBJZiBub3QgdHJhY2tpbmcgY2hhbmdlcyB0aGUgYGV4dGVuc2lvbnNgIHZhcmlhYmxlIHdpbGwgY29udGFpbiB0aGUgcGFyc2VkXG4gICAgLy8gdmFsdWVzLiAgT3RoZXJ3aXNlIHRoZSBleHRlbnNpb25zIGFyZSB0cmFja2VkIHZpYSBhIHZpcnR1YWwgQVNUIG9iamVjdC5cbiAgICBleHRlbnNpb25zOlxuICAgICAgZXh0ZW5zaW9ucyA/P1xuICAgICAgY3JlYXRlVmlydHVhbEFzdE9iamVjdChwcm9qZWN0Tm9kZVZhbHVlLCB7XG4gICAgICAgIGV4Y2x1ZGU6IFsnYXJjaGl0ZWN0JywgJ3ByZWZpeCcsICdyb290JywgJ3NvdXJjZVJvb3QnLCAndGFyZ2V0cyddLFxuICAgICAgICBsaXN0ZW5lcihwYXRoLCB2YWx1ZSkge1xuICAgICAgICAgIGpzb25NZXRhZGF0YS5hZGRDaGFuZ2UoWydwcm9qZWN0cycsIHByb2plY3ROYW1lLCAuLi5wYXRoXSwgdmFsdWUpO1xuICAgICAgICB9LFxuICAgICAgfSksXG4gIH07XG5cbiAgY29uc3QgYmFzZUtleXMgPSBuZXcgU2V0KE9iamVjdC5rZXlzKGJhc2UpKTtcbiAgY29uc3QgcHJvamVjdCA9XG4gICAgcHJvcGVydGllcyA/P1xuICAgIGNyZWF0ZVZpcnR1YWxBc3RPYmplY3Q8UHJvamVjdERlZmluaXRpb24+KHByb2plY3ROb2RlVmFsdWUsIHtcbiAgICAgIGluY2x1ZGU6IFsncHJlZml4JywgJ3Jvb3QnLCAnc291cmNlUm9vdCcsIC4uLmJhc2VLZXlzXSxcbiAgICAgIGxpc3RlbmVyKHBhdGgsIHZhbHVlKSB7XG4gICAgICAgIGlmICghYmFzZUtleXMuaGFzKHBhdGhbMF0pKSB7XG4gICAgICAgICAganNvbk1ldGFkYXRhLmFkZENoYW5nZShbJ3Byb2plY3RzJywgcHJvamVjdE5hbWUsIC4uLnBhdGhdLCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocHJvamVjdCwgYmFzZSkgYXMgUHJvamVjdERlZmluaXRpb247XG59XG5cbmZ1bmN0aW9uIHBhcnNlVGFyZ2V0c09iamVjdChcbiAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgdGFyZ2V0c05vZGU6IE5vZGUsXG4gIGNvbnRleHQ6IFBhcnNlckNvbnRleHQsXG4pOiBSZWNvcmQ8c3RyaW5nLCBUYXJnZXREZWZpbml0aW9uPiB7XG4gIGNvbnN0IGpzb25NZXRhZGF0YSA9IGNvbnRleHQubWV0YWRhdGE7XG4gIGNvbnN0IHRhcmdldHM6IFJlY29yZDxzdHJpbmcsIFRhcmdldERlZmluaXRpb24+ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICBmb3IgKGNvbnN0IFtuYW1lLCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXM8SnNvblZhbHVlPihnZXROb2RlVmFsdWUodGFyZ2V0c05vZGUpKSkge1xuICAgIGlmICghaXNKc29uT2JqZWN0KHZhbHVlKSkge1xuICAgICAgY29udGV4dC53YXJuKCdTa2lwcGluZyBpbnZhbGlkIHRhcmdldCB2YWx1ZTsgZXhwZWN0ZWQgYW4gb2JqZWN0LicsIHZhbHVlKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChjb250ZXh0LnRyYWNrQ2hhbmdlcykge1xuICAgICAgdGFyZ2V0c1tuYW1lXSA9IGNyZWF0ZVZpcnR1YWxBc3RPYmplY3Q8VGFyZ2V0RGVmaW5pdGlvbj4odmFsdWUsIHtcbiAgICAgICAgaW5jbHVkZTogWydidWlsZGVyJywgJ29wdGlvbnMnLCAnY29uZmlndXJhdGlvbnMnLCAnZGVmYXVsdENvbmZpZ3VyYXRpb24nXSxcbiAgICAgICAgbGlzdGVuZXIocGF0aCwgdmFsdWUpIHtcbiAgICAgICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKFsncHJvamVjdHMnLCBwcm9qZWN0TmFtZSwgJ3RhcmdldHMnLCBuYW1lLCAuLi5wYXRoXSwgdmFsdWUpO1xuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhcmdldHNbbmFtZV0gPSB2YWx1ZSBhcyB1bmtub3duIGFzIFRhcmdldERlZmluaXRpb247XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRhcmdldHM7XG59XG4iXX0=