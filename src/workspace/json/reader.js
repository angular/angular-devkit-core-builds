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
const ANGULAR_WORKSPACE_EXTENSIONS = Object.freeze([
    'cli',
    'defaultProject',
    'newProjectRoot',
    'schematics',
]);
const ANGULAR_PROJECT_EXTENSIONS = Object.freeze(['cli', 'schematics', 'projectType', 'i18n']);
async function readJsonWorkspace(path, host, options = {}) {
    var _a, _b;
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
        unprefixedWorkspaceExtensions: new Set([
            ...ANGULAR_WORKSPACE_EXTENSIONS,
            ...((_a = options.allowedWorkspaceExtensions) !== null && _a !== void 0 ? _a : []),
        ]),
        unprefixedProjectExtensions: new Set([
            ...ANGULAR_PROJECT_EXTENSIONS,
            ...((_b = options.allowedProjectExtensions) !== null && _b !== void 0 ? _b : []),
        ]),
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
            if (!context.unprefixedWorkspaceExtensions.has(name) && !/^[a-z]{1,3}-.*/.test(name)) {
                context.warn(`Workspace extension with invalid name (${name}) found.`, name);
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
                if (!context.unprefixedProjectExtensions.has(name) && !/^[a-z]{1,3}-.*/.test(name)) {
                    context.warn(`Project extension with invalid name (${name}) found.`, name);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVhZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvd29ya3NwYWNlL2pzb24vcmVhZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILCtDQUFpRjtBQUNqRiw0Q0FBMkQ7QUFDM0QsZ0RBT3dCO0FBRXhCLHlDQUF3RTtBQUN4RSwyQ0FBcUQ7QUFFckQsTUFBTSw0QkFBNEIsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ2pELEtBQUs7SUFDTCxnQkFBZ0I7SUFDaEIsZ0JBQWdCO0lBQ2hCLFlBQVk7Q0FDYixDQUFDLENBQUM7QUFDSCxNQUFNLDBCQUEwQixHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBaUJ4RixLQUFLLFVBQVUsaUJBQWlCLENBQ3JDLElBQVksRUFDWixJQUFtQixFQUNuQixVQUFnQyxFQUFFOztJQUVsQyxNQUFNLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdEMsSUFBSSxHQUFHLEtBQUssU0FBUyxFQUFFO1FBQ3JCLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztLQUNuRDtJQUVELE1BQU0sR0FBRyxHQUFHLElBQUEsd0JBQVMsRUFBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDN0YsSUFBSSxDQUFBLEdBQUcsYUFBSCxHQUFHLHVCQUFILEdBQUcsQ0FBRSxJQUFJLE1BQUssUUFBUSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRTtRQUMzQyxNQUFNLElBQUksS0FBSyxDQUFDLGdEQUFnRCxD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O1lBQ3hCLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFBLGtDQUFzQixFQUFtQixLQUFLLEVBQUU7Z0JBQzlELE9BQU8sRUFBRSxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsc0JBQXNCLENBQUM7Z0JBQ3pFLFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSztvQkFDbEIsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUNyRixDQUFDO2FBQ0YsQ0FBQyxDQUFDO1NBQ0o7YUFBTTtZQUNMLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFvQyxDQUFDO1NBQ3REO0tBQ0Y7SUFFRCxPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IE5vZGUsIGZpbmROb2RlQXRMb2NhdGlvbiwgZ2V0Tm9kZVZhbHVlLCBwYXJzZVRyZWUgfSBmcm9tICdqc29uYy1wYXJzZXInO1xuaW1wb3J0IHsgSnNvblZhbHVlLCBpc0pzb25PYmplY3QgfSBmcm9tICcuLi8uLi9qc29uL3V0aWxzJztcbmltcG9ydCB7XG4gIERlZmluaXRpb25Db2xsZWN0aW9uTGlzdGVuZXIsXG4gIFByb2plY3REZWZpbml0aW9uLFxuICBQcm9qZWN0RGVmaW5pdGlvbkNvbGxlY3Rpb24sXG4gIFRhcmdldERlZmluaXRpb24sXG4gIFRhcmdldERlZmluaXRpb25Db2xsZWN0aW9uLFxuICBXb3Jrc3BhY2VEZWZpbml0aW9uLFxufSBmcm9tICcuLi9kZWZpbml0aW9ucyc7XG5pbXBvcnQgeyBXb3Jrc3BhY2VIb3N0IH0gZnJvbSAnLi4vaG9zdCc7XG5pbXBvcnQgeyBKc29uV29ya3NwYWNlTWV0YWRhdGEsIEpzb25Xb3Jrc3BhY2VTeW1ib2wgfSBmcm9tICcuL21ldGFkYXRhJztcbmltcG9ydCB7IGNyZWF0ZVZpcnR1YWxBc3RPYmplY3QgfSBmcm9tICcuL3V0aWxpdGllcyc7XG5cbmNvbnN0IEFOR1VMQVJfV09SS1NQQUNFX0VYVEVOU0lPTlMgPSBPYmplY3QuZnJlZXplKFtcbiAgJ2NsaScsXG4gICdkZWZhdWx0UHJvamVjdCcsXG4gICduZXdQcm9qZWN0Um9vdCcsXG4gICdzY2hlbWF0aWNzJyxcbl0pO1xuY29uc3QgQU5HVUxBUl9QUk9KRUNUX0VYVEVOU0lPTlMgPSBPYmplY3QuZnJlZXplKFsnY2xpJywgJ3NjaGVtYXRpY3MnLCAncHJvamVjdFR5cGUnLCAnaTE4biddKTtcblxuaW50ZXJmYWNlIFBhcnNlckNvbnRleHQge1xuICByZWFkb25seSBob3N0OiBXb3Jrc3BhY2VIb3N0O1xuICByZWFkb25seSBtZXRhZGF0YTogSnNvbldvcmtzcGFjZU1ldGFkYXRhO1xuICByZWFkb25seSB0cmFja0NoYW5nZXM6IGJvb2xlYW47XG4gIHJlYWRvbmx5IHVucHJlZml4ZWRXb3Jrc3BhY2VFeHRlbnNpb25zOiBSZWFkb25seVNldDxzdHJpbmc+O1xuICByZWFkb25seSB1bnByZWZpeGVkUHJvamVjdEV4dGVuc2lvbnM6IFJlYWRvbmx5U2V0PHN0cmluZz47XG4gIGVycm9yKG1lc3NhZ2U6IHN0cmluZywgbm9kZTogSnNvblZhbHVlKTogdm9pZDtcbiAgd2FybihtZXNzYWdlOiBzdHJpbmcsIG5vZGU6IEpzb25WYWx1ZSk6IHZvaWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSnNvbldvcmtzcGFjZU9wdGlvbnMge1xuICBhbGxvd2VkUHJvamVjdEV4dGVuc2lvbnM/OiBzdHJpbmdbXTtcbiAgYWxsb3dlZFdvcmtzcGFjZUV4dGVuc2lvbnM/OiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWRKc29uV29ya3NwYWNlKFxuICBwYXRoOiBzdHJpbmcsXG4gIGhvc3Q6IFdvcmtzcGFjZUhvc3QsXG4gIG9wdGlvbnM6IEpzb25Xb3Jrc3BhY2VPcHRpb25zID0ge30sXG4pOiBQcm9taXNlPFdvcmtzcGFjZURlZmluaXRpb24+IHtcbiAgY29uc3QgcmF3ID0gYXdhaXQgaG9zdC5yZWFkRmlsZShwYXRoKTtcbiAgaWYgKHJhdyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gcmVhZCB3b3Jrc3BhY2UgZmlsZS4nKTtcbiAgfVxuXG4gIGNvbnN0IGFzdCA9IHBhcnNlVHJlZShyYXcsIHVuZGVmaW5lZCwgeyBhbGxvd1RyYWlsaW5nQ29tbWE6IHRydWUsIGRpc2FsbG93Q29tbWVudHM6IGZhbHNlIH0pO1xuICBpZiAoYXN0Py50eXBlICE9PSAnb2JqZWN0JyB8fCAhYXN0LmNoaWxkcmVuKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHdvcmtzcGFjZSBmaWxlIC0gZXhwZWN0ZWQgSlNPTiBvYmplY3QuJyk7XG4gIH1cblxuICAvLyBWZXJzaW9uIGNoZWNrXG4gIGNvbnN0IHZlcnNpb25Ob2RlID0gZmluZE5vZGVBdExvY2F0aW9uKGFzdCwgWyd2ZXJzaW9uJ10pO1xuICBpZiAoIXZlcnNpb25Ob2RlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGZvcm1hdCAtIHZlcnNpb24gc3BlY2lmaWVyIG5vdCBmb3VuZC4nKTtcbiAgfVxuICBjb25zdCB2ZXJzaW9uID0gdmVyc2lvbk5vZGUudmFsdWU7XG4gIGlmICh2ZXJzaW9uICE9PSAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGZvcm1hdCB2ZXJzaW9uIGRldGVjdGVkIC0gRXhwZWN0ZWQ6WyAxIF0gRm91bmQ6IFsgJHt2ZXJzaW9ufSBdYCk7XG4gIH1cblxuICBjb25zdCBjb250ZXh0OiBQYXJzZXJDb250ZXh0ID0ge1xuICAgIGhvc3QsXG4gICAgbWV0YWRhdGE6IG5ldyBKc29uV29ya3NwYWNlTWV0YWRhdGEocGF0aCwgYXN0LCByYXcpLFxuICAgIHRyYWNrQ2hhbmdlczogdHJ1ZSxcbiAgICB1bnByZWZpeGVkV29ya3NwYWNlRXh0ZW5zaW9uczogbmV3IFNldChbXG4gICAgICAuLi5BTkdVTEFSX1dPUktTUEFDRV9FWFRFTlNJT05TLFxuICAgICAgLi4uKG9wdGlvbnMuYWxsb3dlZFdvcmtzcGFjZUV4dGVuc2lvbnMgPz8gW10pLFxuICAgIF0pLFxuICAgIHVucHJlZml4ZWRQcm9qZWN0RXh0ZW5zaW9uczogbmV3IFNldChbXG4gICAgICAuLi5BTkdVTEFSX1BST0pFQ1RfRVhURU5TSU9OUyxcbiAgICAgIC4uLihvcHRpb25zLmFsbG93ZWRQcm9qZWN0RXh0ZW5zaW9ucyA/PyBbXSksXG4gICAgXSksXG4gICAgZXJyb3IobWVzc2FnZSwgX25vZGUpIHtcbiAgICAgIC8vIFRPRE86IERpYWdub3N0aWMgcmVwb3J0aW5nIHN1cHBvcnRcbiAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICB9LFxuICAgIHdhcm4obWVzc2FnZSwgX25vZGUpIHtcbiAgICAgIC8vIFRPRE86IERpYWdub3N0aWMgcmVwb3J0aW5nIHN1cHBvcnRcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgICBjb25zb2xlLndhcm4obWVzc2FnZSk7XG4gICAgfSxcbiAgfTtcblxuICBjb25zdCB3b3Jrc3BhY2UgPSBwYXJzZVdvcmtzcGFjZShhc3QsIGNvbnRleHQpO1xuXG4gIHJldHVybiB3b3Jrc3BhY2U7XG59XG5cbmZ1bmN0aW9uIHBhcnNlV29ya3NwYWNlKHdvcmtzcGFjZU5vZGU6IE5vZGUsIGNvbnRleHQ6IFBhcnNlckNvbnRleHQpOiBXb3Jrc3BhY2VEZWZpbml0aW9uIHtcbiAgY29uc3QganNvbk1ldGFkYXRhID0gY29udGV4dC5tZXRhZGF0YTtcbiAgbGV0IHByb2plY3RzO1xuICBsZXQgZXh0ZW5zaW9uczogUmVjb3JkPHN0cmluZywgSnNvblZhbHVlPiB8IHVuZGVmaW5lZDtcbiAgaWYgKCFjb250ZXh0LnRyYWNrQ2hhbmdlcykge1xuICAgIGV4dGVuc2lvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICB9XG5cbiAgLy8gVE9ETzogYGdldE5vZGVWYWx1ZWAgLSBsb29rcyBwb3RlbnRpYWxseSBleHBlbnNpdmUgc2luY2UgaXQgd2Fsa3MgdGhlIHdob2xlIHRyZWUgYW5kIGluc3RhbnRpYXRlcyB0aGUgZnVsbCBvYmplY3Qgc3RydWN0dXJlIGVhY2ggdGltZS5cbiAgLy8gTWlnaHQgYmUgc29tZXRoaW5nIHRvIGxvb2sgYXQgbW92aW5nIGZvcndhcmQgdG8gb3B0aW1pemUuXG4gIGNvbnN0IHdvcmtzcGFjZU5vZGVWYWx1ZSA9IGdldE5vZGVWYWx1ZSh3b3Jrc3BhY2VOb2RlKTtcbiAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzPEpzb25WYWx1ZT4od29ya3NwYWNlTm9kZVZhbHVlKSkge1xuICAgIGlmIChuYW1lID09PSAnJHNjaGVtYScgfHwgbmFtZSA9PT0gJ3ZlcnNpb24nKSB7XG4gICAgICAvLyBza2lwXG4gICAgfSBlbHNlIGlmIChuYW1lID09PSAncHJvamVjdHMnKSB7XG4gICAgICBjb25zdCBub2RlcyA9IGZpbmROb2RlQXRMb2NhdGlvbih3b3Jrc3BhY2VOb2RlLCBbJ3Byb2plY3RzJ10pO1xuICAgICAgaWYgKCFpc0pzb25PYmplY3QodmFsdWUpIHx8ICFub2Rlcykge1xuICAgICAgICBjb250ZXh0LmVycm9yKCdJbnZhbGlkIFwicHJvamVjdHNcIiBmaWVsZCBmb3VuZDsgZXhwZWN0ZWQgYW4gb2JqZWN0LicsIHZhbHVlKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHByb2plY3RzID0gcGFyc2VQcm9qZWN0c09iamVjdChub2RlcywgY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghY29udGV4dC51bnByZWZpeGVkV29ya3NwYWNlRXh0ZW5zaW9ucy5oYXMobmFtZSkgJiYgIS9eW2Etel17MSwzfS0uKi8udGVzdChuYW1lKSkge1xuICAgICAgICBjb250ZXh0Lndhcm4oYFdvcmtzcGFjZSBleHRlbnNpb24gd2l0aCBpbnZhbGlkIG5hbWUgKCR7bmFtZX0pIGZvdW5kLmAsIG5hbWUpO1xuICAgICAgfVxuICAgICAgaWYgKGV4dGVuc2lvbnMpIHtcbiAgICAgICAgZXh0ZW5zaW9uc1tuYW1lXSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGxldCBjb2xsZWN0aW9uTGlzdGVuZXI6IERlZmluaXRpb25Db2xsZWN0aW9uTGlzdGVuZXI8UHJvamVjdERlZmluaXRpb24+IHwgdW5kZWZpbmVkO1xuICBpZiAoY29udGV4dC50cmFja0NoYW5nZXMpIHtcbiAgICBjb2xsZWN0aW9uTGlzdGVuZXIgPSAobmFtZSwgbmV3VmFsdWUpID0+IHtcbiAgICAgIGpzb25NZXRhZGF0YS5hZGRDaGFuZ2UoWydwcm9qZWN0cycsIG5hbWVdLCBuZXdWYWx1ZSwgJ3Byb2plY3QnKTtcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgcHJvamVjdENvbGxlY3Rpb24gPSBuZXcgUHJvamVjdERlZmluaXRpb25Db2xsZWN0aW9uKHByb2plY3RzLCBjb2xsZWN0aW9uTGlzdGVuZXIpO1xuXG4gIHJldHVybiB7XG4gICAgW0pzb25Xb3Jrc3BhY2VTeW1ib2xdOiBqc29uTWV0YWRhdGEsXG4gICAgcHJvamVjdHM6IHByb2plY3RDb2xsZWN0aW9uLFxuICAgIC8vIElmIG5vdCB0cmFja2luZyBjaGFuZ2VzIHRoZSBgZXh0ZW5zaW9uc2AgdmFyaWFibGUgd2lsbCBjb250YWluIHRoZSBwYXJzZWRcbiAgICAvLyB2YWx1ZXMuICBPdGhlcndpc2UgdGhlIGV4dGVuc2lvbnMgYXJlIHRyYWNrZWQgdmlhIGEgdmlydHVhbCBBU1Qgb2JqZWN0LlxuICAgIGV4dGVuc2lvbnM6XG4gICAgICBleHRlbnNpb25zID8/XG4gICAgICBjcmVhdGVWaXJ0dWFsQXN0T2JqZWN0KHdvcmtzcGFjZU5vZGVWYWx1ZSwge1xuICAgICAgICBleGNsdWRlOiBbJyRzY2hlbWEnLCAndmVyc2lvbicsICdwcm9qZWN0cyddLFxuICAgICAgICBsaXN0ZW5lcihwYXRoLCB2YWx1ZSkge1xuICAgICAgICAgIGpzb25NZXRhZGF0YS5hZGRDaGFuZ2UocGF0aCwgdmFsdWUpO1xuICAgICAgICB9LFxuICAgICAgfSksXG4gIH0gYXMgV29ya3NwYWNlRGVmaW5pdGlvbjtcbn1cblxuZnVuY3Rpb24gcGFyc2VQcm9qZWN0c09iamVjdChcbiAgcHJvamVjdHNOb2RlOiBOb2RlLFxuICBjb250ZXh0OiBQYXJzZXJDb250ZXh0LFxuKTogUmVjb3JkPHN0cmluZywgUHJvamVjdERlZmluaXRpb24+IHtcbiAgY29uc3QgcHJvamVjdHM6IFJlY29yZDxzdHJpbmcsIFByb2plY3REZWZpbml0aW9uPiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzPEpzb25WYWx1ZT4oZ2V0Tm9kZVZhbHVlKHByb2plY3RzTm9kZSkpKSB7XG4gICAgY29uc3Qgbm9kZXMgPSBmaW5kTm9kZUF0TG9jYXRpb24ocHJvamVjdHNOb2RlLCBbbmFtZV0pO1xuICAgIGlmICghaXNKc29uT2JqZWN0KHZhbHVlKSB8fCAhbm9kZXMpIHtcbiAgICAgIGNvbnRleHQud2FybignU2tpcHBpbmcgaW52YWxpZCBwcm9qZWN0IHZhbHVlOyBleHBlY3RlZCBhbiBvYmplY3QuJywgdmFsdWUpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgcHJvamVjdHNbbmFtZV0gPSBwYXJzZVByb2plY3QobmFtZSwgbm9kZXMsIGNvbnRleHQpO1xuICB9XG5cbiAgcmV0dXJuIHByb2plY3RzO1xufVxuXG5mdW5jdGlvbiBwYXJzZVByb2plY3QoXG4gIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gIHByb2plY3ROb2RlOiBOb2RlLFxuICBjb250ZXh0OiBQYXJzZXJDb250ZXh0LFxuKTogUHJvamVjdERlZmluaXRpb24ge1xuICBjb25zdCBqc29uTWV0YWRhdGEgPSBjb250ZXh0Lm1ldGFkYXRhO1xuICBsZXQgdGFyZ2V0cztcbiAgbGV0IGhhc1RhcmdldHMgPSBmYWxzZTtcbiAgbGV0IGV4dGVuc2lvbnM6IFJlY29yZDxzdHJpbmcsIEpzb25WYWx1ZT4gfCB1bmRlZmluZWQ7XG4gIGxldCBwcm9wZXJ0aWVzOiBSZWNvcmQ8J3Jvb3QnIHwgJ3NvdXJjZVJvb3QnIHwgJ3ByZWZpeCcsIHN0cmluZz4gfCB1bmRlZmluZWQ7XG4gIGlmICghY29udGV4dC50cmFja0NoYW5nZXMpIHtcbiAgICAvLyBJZiBub3QgdHJhY2tpbmcgY2hhbmdlcywgdGhlIHBhcnNlciB3aWxsIHN0b3JlIHRoZSB2YWx1ZXMgZGlyZWN0bHkgaW4gc3RhbmRhcmQgb2JqZWN0c1xuICAgIGV4dGVuc2lvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIHByb3BlcnRpZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICB9XG5cbiAgY29uc3QgcHJvamVjdE5vZGVWYWx1ZSA9IGdldE5vZGVWYWx1ZShwcm9qZWN0Tm9kZSk7XG4gIGlmICghKCdyb290JyBpbiBwcm9qZWN0Tm9kZVZhbHVlKSkge1xuICAgIC8vIFRPRE8oYWxhbi1hZ2l1czQpOiBjaGFuZ2UgdGhpcyB0byBlcnJvciBpbiB2MTUuXG4gICAgY29udGV4dC53YXJuKFxuICAgICAgYFByb2plY3QgXCIke3Byb2plY3ROYW1lfVwiIGlzIG1pc3NpbmcgYSByZXF1aXJlZCBwcm9wZXJ0eSBcInJvb3RcIi4gVGhpcyB3aWxsIGJlY29tZSBhbiBlcnJvciBpbiB0aGUgbmV4dCBtYWpvciB2ZXJzaW9uLmAsXG4gICAgICBwcm9qZWN0Tm9kZVZhbHVlLFxuICAgICk7XG4gIH1cblxuICBmb3IgKGNvbnN0IFtuYW1lLCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXM8SnNvblZhbHVlPihwcm9qZWN0Tm9kZVZhbHVlKSkge1xuICAgIHN3aXRjaCAobmFtZSkge1xuICAgICAgY2FzZSAndGFyZ2V0cyc6XG4gICAgICBjYXNlICdhcmNoaXRlY3QnOlxuICAgICAgICBjb25zdCBub2RlcyA9IGZpbmROb2RlQXRMb2NhdGlvbihwcm9qZWN0Tm9kZSwgW25hbWVdKTtcbiAgICAgICAgaWYgKCFpc0pzb25PYmplY3QodmFsdWUpIHx8ICFub2Rlcykge1xuICAgICAgICAgIGNvbnRleHQuZXJyb3IoYEludmFsaWQgXCIke25hbWV9XCIgZmllbGQgZm91bmQ7IGV4cGVjdGVkIGFuIG9iamVjdC5gLCB2YWx1ZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaGFzVGFyZ2V0cyA9IHRydWU7XG4gICAgICAgIHRhcmdldHMgPSBwYXJzZVRhcmdldHNPYmplY3QocHJvamVjdE5hbWUsIG5vZGVzLCBjb250ZXh0KTtcbiAgICAgICAganNvbk1ldGFkYXRhLmhhc0xlZ2FjeVRhcmdldHNOYW1lID0gbmFtZSA9PT0gJ2FyY2hpdGVjdCc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAncHJlZml4JzpcbiAgICAgIGNhc2UgJ3Jvb3QnOlxuICAgICAgY2FzZSAnc291cmNlUm9vdCc6XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgY29udGV4dC53YXJuKGBQcm9qZWN0IHByb3BlcnR5IFwiJHtuYW1lfVwiIHNob3VsZCBiZSBhIHN0cmluZy5gLCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHByb3BlcnRpZXMpIHtcbiAgICAgICAgICBwcm9wZXJ0aWVzW25hbWVdID0gdmFsdWUgYXMgc3RyaW5nO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKCFjb250ZXh0LnVucHJlZml4ZWRQcm9qZWN0RXh0ZW5zaW9ucy5oYXMobmFtZSkgJiYgIS9eW2Etel17MSwzfS0uKi8udGVzdChuYW1lKSkge1xuICAgICAgICAgIGNvbnRleHQud2FybihgUHJvamVjdCBleHRlbnNpb24gd2l0aCBpbnZhbGlkIG5hbWUgKCR7bmFtZX0pIGZvdW5kLmAsIG5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChleHRlbnNpb25zKSB7XG4gICAgICAgICAgZXh0ZW5zaW9uc1tuYW1lXSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGxldCBjb2xsZWN0aW9uTGlzdGVuZXI6IERlZmluaXRpb25Db2xsZWN0aW9uTGlzdGVuZXI8VGFyZ2V0RGVmaW5pdGlvbj4gfCB1bmRlZmluZWQ7XG4gIGlmIChjb250ZXh0LnRyYWNrQ2hhbmdlcykge1xuICAgIGNvbGxlY3Rpb25MaXN0ZW5lciA9IChuYW1lLCBuZXdWYWx1ZSwgY29sbGVjdGlvbikgPT4ge1xuICAgICAgaWYgKGhhc1RhcmdldHMpIHtcbiAgICAgICAganNvbk1ldGFkYXRhLmFkZENoYW5nZShbJ3Byb2plY3RzJywgcHJvamVjdE5hbWUsICd0YXJnZXRzJywgbmFtZV0sIG5ld1ZhbHVlLCAndGFyZ2V0Jyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKFxuICAgICAgICAgIFsncHJvamVjdHMnLCBwcm9qZWN0TmFtZSwgJ3RhcmdldHMnXSxcbiAgICAgICAgICBjb2xsZWN0aW9uLFxuICAgICAgICAgICd0YXJnZXRjb2xsZWN0aW9uJyxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgY29uc3QgYmFzZSA9IHtcbiAgICB0YXJnZXRzOiBuZXcgVGFyZ2V0RGVmaW5pdGlvbkNvbGxlY3Rpb24odGFyZ2V0cywgY29sbGVjdGlvbkxpc3RlbmVyKSxcbiAgICAvLyBJZiBub3QgdHJhY2tpbmcgY2hhbmdlcyB0aGUgYGV4dGVuc2lvbnNgIHZhcmlhYmxlIHdpbGwgY29udGFpbiB0aGUgcGFyc2VkXG4gICAgLy8gdmFsdWVzLiAgT3RoZXJ3aXNlIHRoZSBleHRlbnNpb25zIGFyZSB0cmFja2VkIHZpYSBhIHZpcnR1YWwgQVNUIG9iamVjdC5cbiAgICBleHRlbnNpb25zOlxuICAgICAgZXh0ZW5zaW9ucyA/P1xuICAgICAgY3JlYXRlVmlydHVhbEFzdE9iamVjdChwcm9qZWN0Tm9kZVZhbHVlLCB7XG4gICAgICAgIGV4Y2x1ZGU6IFsnYXJjaGl0ZWN0JywgJ3ByZWZpeCcsICdyb290JywgJ3NvdXJjZVJvb3QnLCAndGFyZ2V0cyddLFxuICAgICAgICBsaXN0ZW5lcihwYXRoLCB2YWx1ZSkge1xuICAgICAgICAgIGpzb25NZXRhZGF0YS5hZGRDaGFuZ2UoWydwcm9qZWN0cycsIHByb2plY3ROYW1lLCAuLi5wYXRoXSwgdmFsdWUpO1xuICAgICAgICB9LFxuICAgICAgfSksXG4gIH07XG5cbiAgY29uc3QgYmFzZUtleXMgPSBuZXcgU2V0KE9iamVjdC5rZXlzKGJhc2UpKTtcbiAgY29uc3QgcHJvamVjdCA9XG4gICAgcHJvcGVydGllcyA/P1xuICAgIGNyZWF0ZVZpcnR1YWxBc3RPYmplY3Q8UHJvamVjdERlZmluaXRpb24+KHByb2plY3ROb2RlVmFsdWUsIHtcbiAgICAgIGluY2x1ZGU6IFsncHJlZml4JywgJ3Jvb3QnLCAnc291cmNlUm9vdCcsIC4uLmJhc2VLZXlzXSxcbiAgICAgIGxpc3RlbmVyKHBhdGgsIHZhbHVlKSB7XG4gICAgICAgIGlmICghYmFzZUtleXMuaGFzKHBhdGhbMF0pKSB7XG4gICAgICAgICAganNvbk1ldGFkYXRhLmFkZENoYW5nZShbJ3Byb2plY3RzJywgcHJvamVjdE5hbWUsIC4uLnBhdGhdLCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocHJvamVjdCwgYmFzZSkgYXMgUHJvamVjdERlZmluaXRpb247XG59XG5cbmZ1bmN0aW9uIHBhcnNlVGFyZ2V0c09iamVjdChcbiAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgdGFyZ2V0c05vZGU6IE5vZGUsXG4gIGNvbnRleHQ6IFBhcnNlckNvbnRleHQsXG4pOiBSZWNvcmQ8c3RyaW5nLCBUYXJnZXREZWZpbml0aW9uPiB7XG4gIGNvbnN0IGpzb25NZXRhZGF0YSA9IGNvbnRleHQubWV0YWRhdGE7XG4gIGNvbnN0IHRhcmdldHM6IFJlY29yZDxzdHJpbmcsIFRhcmdldERlZmluaXRpb24+ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICBmb3IgKGNvbnN0IFtuYW1lLCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXM8SnNvblZhbHVlPihnZXROb2RlVmFsdWUodGFyZ2V0c05vZGUpKSkge1xuICAgIGlmICghaXNKc29uT2JqZWN0KHZhbHVlKSkge1xuICAgICAgY29udGV4dC53YXJuKCdTa2lwcGluZyBpbnZhbGlkIHRhcmdldCB2YWx1ZTsgZXhwZWN0ZWQgYW4gb2JqZWN0LicsIHZhbHVlKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChjb250ZXh0LnRyYWNrQ2hhbmdlcykge1xuICAgICAgdGFyZ2V0c1tuYW1lXSA9IGNyZWF0ZVZpcnR1YWxBc3RPYmplY3Q8VGFyZ2V0RGVmaW5pdGlvbj4odmFsdWUsIHtcbiAgICAgICAgaW5jbHVkZTogWydidWlsZGVyJywgJ29wdGlvbnMnLCAnY29uZmlndXJhdGlvbnMnLCAnZGVmYXVsdENvbmZpZ3VyYXRpb24nXSxcbiAgICAgICAgbGlzdGVuZXIocGF0aCwgdmFsdWUpIHtcbiAgICAgICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKFsncHJvamVjdHMnLCBwcm9qZWN0TmFtZSwgJ3RhcmdldHMnLCBuYW1lLCAuLi5wYXRoXSwgdmFsdWUpO1xuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhcmdldHNbbmFtZV0gPSB2YWx1ZSBhcyB1bmtub3duIGFzIFRhcmdldERlZmluaXRpb247XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRhcmdldHM7XG59XG4iXX0=