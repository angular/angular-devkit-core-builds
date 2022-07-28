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
                context.warn(`Project extension with invalid name (${name}) found.`, name);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVhZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvd29ya3NwYWNlL2pzb24vcmVhZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILCtDQUFpRjtBQUNqRiw0Q0FBMkQ7QUFDM0QsZ0RBT3dCO0FBRXhCLHlDQUF3RTtBQUN4RSwyQ0FBcUQ7QUFFckQsTUFBTSw0QkFBNEIsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ2pELEtBQUs7SUFDTCxnQkFBZ0I7SUFDaEIsZ0JBQWdCO0lBQ2hCLFlBQVk7Q0FDYixDQUFDLENBQUM7QUFDSCxNQUFNLDBCQUEwQixHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBaUJ4RixLQUFLLFVBQVUsaUJBQWlCLENBQ3JDLElBQVksRUFDWixJQUFtQixFQUNuQixVQUFnQyxFQUFFOztJQUVsQyxNQUFNLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdEMsSUFBSSxHQUFHLEtBQUssU0FBUyxFQUFFO1FBQ3JCLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztLQUNuRDtJQUVELE1BQU0sR0FBRyxHQUFHLElBQUEsd0JBQVMsRUFBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDN0YsSUFBSSxDQUFBLEdBQUcsYUFBSCxHQUFHLHVCQUFILEdBQUcsQ0FBRSxJQUFJLE1BQUssUUFBUSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRTtRQUMzQyxNQUFNLElBQUksS0FBSyxDQUFDLGdEQUFnRCxD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O1lBQ3hCLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFBLGtDQUFzQixFQUFtQixLQUFLLEVBQUU7Z0JBQzlELE9BQU8sRUFBRSxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsc0JBQXNCLENBQUM7Z0JBQ3pFLFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSztvQkFDbEIsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUNyRixDQUFDO2FBQ0YsQ0FBQyxDQUFDO1NBQ0o7YUFBTTtZQUNMLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFvQyxDQUFDO1NBQ3REO0tBQ0Y7SUFFRCxPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IE5vZGUsIGZpbmROb2RlQXRMb2NhdGlvbiwgZ2V0Tm9kZVZhbHVlLCBwYXJzZVRyZWUgfSBmcm9tICdqc29uYy1wYXJzZXInO1xuaW1wb3J0IHsgSnNvblZhbHVlLCBpc0pzb25PYmplY3QgfSBmcm9tICcuLi8uLi9qc29uL3V0aWxzJztcbmltcG9ydCB7XG4gIERlZmluaXRpb25Db2xsZWN0aW9uTGlzdGVuZXIsXG4gIFByb2plY3REZWZpbml0aW9uLFxuICBQcm9qZWN0RGVmaW5pdGlvbkNvbGxlY3Rpb24sXG4gIFRhcmdldERlZmluaXRpb24sXG4gIFRhcmdldERlZmluaXRpb25Db2xsZWN0aW9uLFxuICBXb3Jrc3BhY2VEZWZpbml0aW9uLFxufSBmcm9tICcuLi9kZWZpbml0aW9ucyc7XG5pbXBvcnQgeyBXb3Jrc3BhY2VIb3N0IH0gZnJvbSAnLi4vaG9zdCc7XG5pbXBvcnQgeyBKc29uV29ya3NwYWNlTWV0YWRhdGEsIEpzb25Xb3Jrc3BhY2VTeW1ib2wgfSBmcm9tICcuL21ldGFkYXRhJztcbmltcG9ydCB7IGNyZWF0ZVZpcnR1YWxBc3RPYmplY3QgfSBmcm9tICcuL3V0aWxpdGllcyc7XG5cbmNvbnN0IEFOR1VMQVJfV09SS1NQQUNFX0VYVEVOU0lPTlMgPSBPYmplY3QuZnJlZXplKFtcbiAgJ2NsaScsXG4gICdkZWZhdWx0UHJvamVjdCcsXG4gICduZXdQcm9qZWN0Um9vdCcsXG4gICdzY2hlbWF0aWNzJyxcbl0pO1xuY29uc3QgQU5HVUxBUl9QUk9KRUNUX0VYVEVOU0lPTlMgPSBPYmplY3QuZnJlZXplKFsnY2xpJywgJ3NjaGVtYXRpY3MnLCAncHJvamVjdFR5cGUnLCAnaTE4biddKTtcblxuaW50ZXJmYWNlIFBhcnNlckNvbnRleHQge1xuICByZWFkb25seSBob3N0OiBXb3Jrc3BhY2VIb3N0O1xuICByZWFkb25seSBtZXRhZGF0YTogSnNvbldvcmtzcGFjZU1ldGFkYXRhO1xuICByZWFkb25seSB0cmFja0NoYW5nZXM6IGJvb2xlYW47XG4gIHJlYWRvbmx5IHVucHJlZml4ZWRXb3Jrc3BhY2VFeHRlbnNpb25zOiBSZWFkb25seVNldDxzdHJpbmc+O1xuICByZWFkb25seSB1bnByZWZpeGVkUHJvamVjdEV4dGVuc2lvbnM6IFJlYWRvbmx5U2V0PHN0cmluZz47XG4gIGVycm9yKG1lc3NhZ2U6IHN0cmluZywgbm9kZTogSnNvblZhbHVlKTogdm9pZDtcbiAgd2FybihtZXNzYWdlOiBzdHJpbmcsIG5vZGU6IEpzb25WYWx1ZSk6IHZvaWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSnNvbldvcmtzcGFjZU9wdGlvbnMge1xuICBhbGxvd2VkUHJvamVjdEV4dGVuc2lvbnM/OiBzdHJpbmdbXTtcbiAgYWxsb3dlZFdvcmtzcGFjZUV4dGVuc2lvbnM/OiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWRKc29uV29ya3NwYWNlKFxuICBwYXRoOiBzdHJpbmcsXG4gIGhvc3Q6IFdvcmtzcGFjZUhvc3QsXG4gIG9wdGlvbnM6IEpzb25Xb3Jrc3BhY2VPcHRpb25zID0ge30sXG4pOiBQcm9taXNlPFdvcmtzcGFjZURlZmluaXRpb24+IHtcbiAgY29uc3QgcmF3ID0gYXdhaXQgaG9zdC5yZWFkRmlsZShwYXRoKTtcbiAgaWYgKHJhdyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gcmVhZCB3b3Jrc3BhY2UgZmlsZS4nKTtcbiAgfVxuXG4gIGNvbnN0IGFzdCA9IHBhcnNlVHJlZShyYXcsIHVuZGVmaW5lZCwgeyBhbGxvd1RyYWlsaW5nQ29tbWE6IHRydWUsIGRpc2FsbG93Q29tbWVudHM6IGZhbHNlIH0pO1xuICBpZiAoYXN0Py50eXBlICE9PSAnb2JqZWN0JyB8fCAhYXN0LmNoaWxkcmVuKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHdvcmtzcGFjZSBmaWxlIC0gZXhwZWN0ZWQgSlNPTiBvYmplY3QuJyk7XG4gIH1cblxuICAvLyBWZXJzaW9uIGNoZWNrXG4gIGNvbnN0IHZlcnNpb25Ob2RlID0gZmluZE5vZGVBdExvY2F0aW9uKGFzdCwgWyd2ZXJzaW9uJ10pO1xuICBpZiAoIXZlcnNpb25Ob2RlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGZvcm1hdCAtIHZlcnNpb24gc3BlY2lmaWVyIG5vdCBmb3VuZC4nKTtcbiAgfVxuICBjb25zdCB2ZXJzaW9uID0gdmVyc2lvbk5vZGUudmFsdWU7XG4gIGlmICh2ZXJzaW9uICE9PSAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGZvcm1hdCB2ZXJzaW9uIGRldGVjdGVkIC0gRXhwZWN0ZWQ6WyAxIF0gRm91bmQ6IFsgJHt2ZXJzaW9ufSBdYCk7XG4gIH1cblxuICBjb25zdCBjb250ZXh0OiBQYXJzZXJDb250ZXh0ID0ge1xuICAgIGhvc3QsXG4gICAgbWV0YWRhdGE6IG5ldyBKc29uV29ya3NwYWNlTWV0YWRhdGEocGF0aCwgYXN0LCByYXcpLFxuICAgIHRyYWNrQ2hhbmdlczogdHJ1ZSxcbiAgICB1bnByZWZpeGVkV29ya3NwYWNlRXh0ZW5zaW9uczogbmV3IFNldChbXG4gICAgICAuLi5BTkdVTEFSX1dPUktTUEFDRV9FWFRFTlNJT05TLFxuICAgICAgLi4uKG9wdGlvbnMuYWxsb3dlZFdvcmtzcGFjZUV4dGVuc2lvbnMgPz8gW10pLFxuICAgIF0pLFxuICAgIHVucHJlZml4ZWRQcm9qZWN0RXh0ZW5zaW9uczogbmV3IFNldChbXG4gICAgICAuLi5BTkdVTEFSX1BST0pFQ1RfRVhURU5TSU9OUyxcbiAgICAgIC4uLihvcHRpb25zLmFsbG93ZWRQcm9qZWN0RXh0ZW5zaW9ucyA/PyBbXSksXG4gICAgXSksXG4gICAgZXJyb3IobWVzc2FnZSwgX25vZGUpIHtcbiAgICAgIC8vIFRPRE86IERpYWdub3N0aWMgcmVwb3J0aW5nIHN1cHBvcnRcbiAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICB9LFxuICAgIHdhcm4obWVzc2FnZSwgX25vZGUpIHtcbiAgICAgIC8vIFRPRE86IERpYWdub3N0aWMgcmVwb3J0aW5nIHN1cHBvcnRcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgICBjb25zb2xlLndhcm4obWVzc2FnZSk7XG4gICAgfSxcbiAgfTtcblxuICBjb25zdCB3b3Jrc3BhY2UgPSBwYXJzZVdvcmtzcGFjZShhc3QsIGNvbnRleHQpO1xuXG4gIHJldHVybiB3b3Jrc3BhY2U7XG59XG5cbmZ1bmN0aW9uIHBhcnNlV29ya3NwYWNlKHdvcmtzcGFjZU5vZGU6IE5vZGUsIGNvbnRleHQ6IFBhcnNlckNvbnRleHQpOiBXb3Jrc3BhY2VEZWZpbml0aW9uIHtcbiAgY29uc3QganNvbk1ldGFkYXRhID0gY29udGV4dC5tZXRhZGF0YTtcbiAgbGV0IHByb2plY3RzO1xuICBsZXQgZXh0ZW5zaW9uczogUmVjb3JkPHN0cmluZywgSnNvblZhbHVlPiB8IHVuZGVmaW5lZDtcbiAgaWYgKCFjb250ZXh0LnRyYWNrQ2hhbmdlcykge1xuICAgIGV4dGVuc2lvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICB9XG5cbiAgLy8gVE9ETzogYGdldE5vZGVWYWx1ZWAgLSBsb29rcyBwb3RlbnRpYWxseSBleHBlbnNpdmUgc2luY2UgaXQgd2Fsa3MgdGhlIHdob2xlIHRyZWUgYW5kIGluc3RhbnRpYXRlcyB0aGUgZnVsbCBvYmplY3Qgc3RydWN0dXJlIGVhY2ggdGltZS5cbiAgLy8gTWlnaHQgYmUgc29tZXRoaW5nIHRvIGxvb2sgYXQgbW92aW5nIGZvcndhcmQgdG8gb3B0aW1pemUuXG4gIGNvbnN0IHdvcmtzcGFjZU5vZGVWYWx1ZSA9IGdldE5vZGVWYWx1ZSh3b3Jrc3BhY2VOb2RlKTtcbiAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzPEpzb25WYWx1ZT4od29ya3NwYWNlTm9kZVZhbHVlKSkge1xuICAgIGlmIChuYW1lID09PSAnJHNjaGVtYScgfHwgbmFtZSA9PT0gJ3ZlcnNpb24nKSB7XG4gICAgICAvLyBza2lwXG4gICAgfSBlbHNlIGlmIChuYW1lID09PSAncHJvamVjdHMnKSB7XG4gICAgICBjb25zdCBub2RlcyA9IGZpbmROb2RlQXRMb2NhdGlvbih3b3Jrc3BhY2VOb2RlLCBbJ3Byb2plY3RzJ10pO1xuICAgICAgaWYgKCFpc0pzb25PYmplY3QodmFsdWUpIHx8ICFub2Rlcykge1xuICAgICAgICBjb250ZXh0LmVycm9yKCdJbnZhbGlkIFwicHJvamVjdHNcIiBmaWVsZCBmb3VuZDsgZXhwZWN0ZWQgYW4gb2JqZWN0LicsIHZhbHVlKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHByb2plY3RzID0gcGFyc2VQcm9qZWN0c09iamVjdChub2RlcywgY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghY29udGV4dC51bnByZWZpeGVkV29ya3NwYWNlRXh0ZW5zaW9ucy5oYXMobmFtZSkgJiYgIS9eW2Etel17MSwzfS0uKi8udGVzdChuYW1lKSkge1xuICAgICAgICBjb250ZXh0Lndhcm4oYFByb2plY3QgZXh0ZW5zaW9uIHdpdGggaW52YWxpZCBuYW1lICgke25hbWV9KSBmb3VuZC5gLCBuYW1lKTtcbiAgICAgIH1cbiAgICAgIGlmIChleHRlbnNpb25zKSB7XG4gICAgICAgIGV4dGVuc2lvbnNbbmFtZV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBsZXQgY29sbGVjdGlvbkxpc3RlbmVyOiBEZWZpbml0aW9uQ29sbGVjdGlvbkxpc3RlbmVyPFByb2plY3REZWZpbml0aW9uPiB8IHVuZGVmaW5lZDtcbiAgaWYgKGNvbnRleHQudHJhY2tDaGFuZ2VzKSB7XG4gICAgY29sbGVjdGlvbkxpc3RlbmVyID0gKG5hbWUsIG5ld1ZhbHVlKSA9PiB7XG4gICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKFsncHJvamVjdHMnLCBuYW1lXSwgbmV3VmFsdWUsICdwcm9qZWN0Jyk7XG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3RDb2xsZWN0aW9uID0gbmV3IFByb2plY3REZWZpbml0aW9uQ29sbGVjdGlvbihwcm9qZWN0cywgY29sbGVjdGlvbkxpc3RlbmVyKTtcblxuICByZXR1cm4ge1xuICAgIFtKc29uV29ya3NwYWNlU3ltYm9sXToganNvbk1ldGFkYXRhLFxuICAgIHByb2plY3RzOiBwcm9qZWN0Q29sbGVjdGlvbixcbiAgICAvLyBJZiBub3QgdHJhY2tpbmcgY2hhbmdlcyB0aGUgYGV4dGVuc2lvbnNgIHZhcmlhYmxlIHdpbGwgY29udGFpbiB0aGUgcGFyc2VkXG4gICAgLy8gdmFsdWVzLiAgT3RoZXJ3aXNlIHRoZSBleHRlbnNpb25zIGFyZSB0cmFja2VkIHZpYSBhIHZpcnR1YWwgQVNUIG9iamVjdC5cbiAgICBleHRlbnNpb25zOlxuICAgICAgZXh0ZW5zaW9ucyA/P1xuICAgICAgY3JlYXRlVmlydHVhbEFzdE9iamVjdCh3b3Jrc3BhY2VOb2RlVmFsdWUsIHtcbiAgICAgICAgZXhjbHVkZTogWyckc2NoZW1hJywgJ3ZlcnNpb24nLCAncHJvamVjdHMnXSxcbiAgICAgICAgbGlzdGVuZXIocGF0aCwgdmFsdWUpIHtcbiAgICAgICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKHBhdGgsIHZhbHVlKTtcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICB9IGFzIFdvcmtzcGFjZURlZmluaXRpb247XG59XG5cbmZ1bmN0aW9uIHBhcnNlUHJvamVjdHNPYmplY3QoXG4gIHByb2plY3RzTm9kZTogTm9kZSxcbiAgY29udGV4dDogUGFyc2VyQ29udGV4dCxcbik6IFJlY29yZDxzdHJpbmcsIFByb2plY3REZWZpbml0aW9uPiB7XG4gIGNvbnN0IHByb2plY3RzOiBSZWNvcmQ8c3RyaW5nLCBQcm9qZWN0RGVmaW5pdGlvbj4gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllczxKc29uVmFsdWU+KGdldE5vZGVWYWx1ZShwcm9qZWN0c05vZGUpKSkge1xuICAgIGNvbnN0IG5vZGVzID0gZmluZE5vZGVBdExvY2F0aW9uKHByb2plY3RzTm9kZSwgW25hbWVdKTtcbiAgICBpZiAoIWlzSnNvbk9iamVjdCh2YWx1ZSkgfHwgIW5vZGVzKSB7XG4gICAgICBjb250ZXh0Lndhcm4oJ1NraXBwaW5nIGludmFsaWQgcHJvamVjdCB2YWx1ZTsgZXhwZWN0ZWQgYW4gb2JqZWN0LicsIHZhbHVlKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHByb2plY3RzW25hbWVdID0gcGFyc2VQcm9qZWN0KG5hbWUsIG5vZGVzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHJldHVybiBwcm9qZWN0cztcbn1cblxuZnVuY3Rpb24gcGFyc2VQcm9qZWN0KFxuICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICBwcm9qZWN0Tm9kZTogTm9kZSxcbiAgY29udGV4dDogUGFyc2VyQ29udGV4dCxcbik6IFByb2plY3REZWZpbml0aW9uIHtcbiAgY29uc3QganNvbk1ldGFkYXRhID0gY29udGV4dC5tZXRhZGF0YTtcbiAgbGV0IHRhcmdldHM7XG4gIGxldCBoYXNUYXJnZXRzID0gZmFsc2U7XG4gIGxldCBleHRlbnNpb25zOiBSZWNvcmQ8c3RyaW5nLCBKc29uVmFsdWU+IHwgdW5kZWZpbmVkO1xuICBsZXQgcHJvcGVydGllczogUmVjb3JkPCdyb290JyB8ICdzb3VyY2VSb290JyB8ICdwcmVmaXgnLCBzdHJpbmc+IHwgdW5kZWZpbmVkO1xuICBpZiAoIWNvbnRleHQudHJhY2tDaGFuZ2VzKSB7XG4gICAgLy8gSWYgbm90IHRyYWNraW5nIGNoYW5nZXMsIHRoZSBwYXJzZXIgd2lsbCBzdG9yZSB0aGUgdmFsdWVzIGRpcmVjdGx5IGluIHN0YW5kYXJkIG9iamVjdHNcbiAgICBleHRlbnNpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBwcm9wZXJ0aWVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3ROb2RlVmFsdWUgPSBnZXROb2RlVmFsdWUocHJvamVjdE5vZGUpO1xuICBpZiAoISgncm9vdCcgaW4gcHJvamVjdE5vZGVWYWx1ZSkpIHtcbiAgICAvLyBUT0RPKGFsYW4tYWdpdXM0KTogY2hhbmdlIHRoaXMgdG8gZXJyb3IgaW4gdjE1LlxuICAgIGNvbnRleHQud2FybihcbiAgICAgIGBQcm9qZWN0IFwiJHtwcm9qZWN0TmFtZX1cIiBpcyBtaXNzaW5nIGEgcmVxdWlyZWQgcHJvcGVydHkgXCJyb290XCIuIFRoaXMgd2lsbCBiZWNvbWUgYW4gZXJyb3IgaW4gdGhlIG5leHQgbWFqb3IgdmVyc2lvbi5gLFxuICAgICAgcHJvamVjdE5vZGVWYWx1ZSxcbiAgICApO1xuICB9XG5cbiAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzPEpzb25WYWx1ZT4ocHJvamVjdE5vZGVWYWx1ZSkpIHtcbiAgICBzd2l0Y2ggKG5hbWUpIHtcbiAgICAgIGNhc2UgJ3RhcmdldHMnOlxuICAgICAgY2FzZSAnYXJjaGl0ZWN0JzpcbiAgICAgICAgY29uc3Qgbm9kZXMgPSBmaW5kTm9kZUF0TG9jYXRpb24ocHJvamVjdE5vZGUsIFtuYW1lXSk7XG4gICAgICAgIGlmICghaXNKc29uT2JqZWN0KHZhbHVlKSB8fCAhbm9kZXMpIHtcbiAgICAgICAgICBjb250ZXh0LmVycm9yKGBJbnZhbGlkIFwiJHtuYW1lfVwiIGZpZWxkIGZvdW5kOyBleHBlY3RlZCBhbiBvYmplY3QuYCwgdmFsdWUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGhhc1RhcmdldHMgPSB0cnVlO1xuICAgICAgICB0YXJnZXRzID0gcGFyc2VUYXJnZXRzT2JqZWN0KHByb2plY3ROYW1lLCBub2RlcywgY29udGV4dCk7XG4gICAgICAgIGpzb25NZXRhZGF0YS5oYXNMZWdhY3lUYXJnZXRzTmFtZSA9IG5hbWUgPT09ICdhcmNoaXRlY3QnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3ByZWZpeCc6XG4gICAgICBjYXNlICdyb290JzpcbiAgICAgIGNhc2UgJ3NvdXJjZVJvb3QnOlxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIGNvbnRleHQud2FybihgUHJvamVjdCBwcm9wZXJ0eSBcIiR7bmFtZX1cIiBzaG91bGQgYmUgYSBzdHJpbmcuYCwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgcHJvcGVydGllc1tuYW1lXSA9IHZhbHVlIGFzIHN0cmluZztcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmICghY29udGV4dC51bnByZWZpeGVkUHJvamVjdEV4dGVuc2lvbnMuaGFzKG5hbWUpICYmICEvXlthLXpdezEsM30tLiovLnRlc3QobmFtZSkpIHtcbiAgICAgICAgICBjb250ZXh0Lndhcm4oYFByb2plY3QgZXh0ZW5zaW9uIHdpdGggaW52YWxpZCBuYW1lICgke25hbWV9KSBmb3VuZC5gLCBuYW1lKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXh0ZW5zaW9ucykge1xuICAgICAgICAgIGV4dGVuc2lvbnNbbmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBsZXQgY29sbGVjdGlvbkxpc3RlbmVyOiBEZWZpbml0aW9uQ29sbGVjdGlvbkxpc3RlbmVyPFRhcmdldERlZmluaXRpb24+IHwgdW5kZWZpbmVkO1xuICBpZiAoY29udGV4dC50cmFja0NoYW5nZXMpIHtcbiAgICBjb2xsZWN0aW9uTGlzdGVuZXIgPSAobmFtZSwgbmV3VmFsdWUsIGNvbGxlY3Rpb24pID0+IHtcbiAgICAgIGlmIChoYXNUYXJnZXRzKSB7XG4gICAgICAgIGpzb25NZXRhZGF0YS5hZGRDaGFuZ2UoWydwcm9qZWN0cycsIHByb2plY3ROYW1lLCAndGFyZ2V0cycsIG5hbWVdLCBuZXdWYWx1ZSwgJ3RhcmdldCcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAganNvbk1ldGFkYXRhLmFkZENoYW5nZShcbiAgICAgICAgICBbJ3Byb2plY3RzJywgcHJvamVjdE5hbWUsICd0YXJnZXRzJ10sXG4gICAgICAgICAgY29sbGVjdGlvbixcbiAgICAgICAgICAndGFyZ2V0Y29sbGVjdGlvbicsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IGJhc2UgPSB7XG4gICAgdGFyZ2V0czogbmV3IFRhcmdldERlZmluaXRpb25Db2xsZWN0aW9uKHRhcmdldHMsIGNvbGxlY3Rpb25MaXN0ZW5lciksXG4gICAgLy8gSWYgbm90IHRyYWNraW5nIGNoYW5nZXMgdGhlIGBleHRlbnNpb25zYCB2YXJpYWJsZSB3aWxsIGNvbnRhaW4gdGhlIHBhcnNlZFxuICAgIC8vIHZhbHVlcy4gIE90aGVyd2lzZSB0aGUgZXh0ZW5zaW9ucyBhcmUgdHJhY2tlZCB2aWEgYSB2aXJ0dWFsIEFTVCBvYmplY3QuXG4gICAgZXh0ZW5zaW9uczpcbiAgICAgIGV4dGVuc2lvbnMgPz9cbiAgICAgIGNyZWF0ZVZpcnR1YWxBc3RPYmplY3QocHJvamVjdE5vZGVWYWx1ZSwge1xuICAgICAgICBleGNsdWRlOiBbJ2FyY2hpdGVjdCcsICdwcmVmaXgnLCAncm9vdCcsICdzb3VyY2VSb290JywgJ3RhcmdldHMnXSxcbiAgICAgICAgbGlzdGVuZXIocGF0aCwgdmFsdWUpIHtcbiAgICAgICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKFsncHJvamVjdHMnLCBwcm9qZWN0TmFtZSwgLi4ucGF0aF0sIHZhbHVlKTtcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICB9O1xuXG4gIGNvbnN0IGJhc2VLZXlzID0gbmV3IFNldChPYmplY3Qua2V5cyhiYXNlKSk7XG4gIGNvbnN0IHByb2plY3QgPVxuICAgIHByb3BlcnRpZXMgPz9cbiAgICBjcmVhdGVWaXJ0dWFsQXN0T2JqZWN0PFByb2plY3REZWZpbml0aW9uPihwcm9qZWN0Tm9kZVZhbHVlLCB7XG4gICAgICBpbmNsdWRlOiBbJ3ByZWZpeCcsICdyb290JywgJ3NvdXJjZVJvb3QnLCAuLi5iYXNlS2V5c10sXG4gICAgICBsaXN0ZW5lcihwYXRoLCB2YWx1ZSkge1xuICAgICAgICBpZiAoIWJhc2VLZXlzLmhhcyhwYXRoWzBdKSkge1xuICAgICAgICAgIGpzb25NZXRhZGF0YS5hZGRDaGFuZ2UoWydwcm9qZWN0cycsIHByb2plY3ROYW1lLCAuLi5wYXRoXSwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0pO1xuXG4gIHJldHVybiBPYmplY3QuYXNzaWduKHByb2plY3QsIGJhc2UpIGFzIFByb2plY3REZWZpbml0aW9uO1xufVxuXG5mdW5jdGlvbiBwYXJzZVRhcmdldHNPYmplY3QoXG4gIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gIHRhcmdldHNOb2RlOiBOb2RlLFxuICBjb250ZXh0OiBQYXJzZXJDb250ZXh0LFxuKTogUmVjb3JkPHN0cmluZywgVGFyZ2V0RGVmaW5pdGlvbj4ge1xuICBjb25zdCBqc29uTWV0YWRhdGEgPSBjb250ZXh0Lm1ldGFkYXRhO1xuICBjb25zdCB0YXJnZXRzOiBSZWNvcmQ8c3RyaW5nLCBUYXJnZXREZWZpbml0aW9uPiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzPEpzb25WYWx1ZT4oZ2V0Tm9kZVZhbHVlKHRhcmdldHNOb2RlKSkpIHtcbiAgICBpZiAoIWlzSnNvbk9iamVjdCh2YWx1ZSkpIHtcbiAgICAgIGNvbnRleHQud2FybignU2tpcHBpbmcgaW52YWxpZCB0YXJnZXQgdmFsdWU7IGV4cGVjdGVkIGFuIG9iamVjdC4nLCB2YWx1ZSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoY29udGV4dC50cmFja0NoYW5nZXMpIHtcbiAgICAgIHRhcmdldHNbbmFtZV0gPSBjcmVhdGVWaXJ0dWFsQXN0T2JqZWN0PFRhcmdldERlZmluaXRpb24+KHZhbHVlLCB7XG4gICAgICAgIGluY2x1ZGU6IFsnYnVpbGRlcicsICdvcHRpb25zJywgJ2NvbmZpZ3VyYXRpb25zJywgJ2RlZmF1bHRDb25maWd1cmF0aW9uJ10sXG4gICAgICAgIGxpc3RlbmVyKHBhdGgsIHZhbHVlKSB7XG4gICAgICAgICAganNvbk1ldGFkYXRhLmFkZENoYW5nZShbJ3Byb2plY3RzJywgcHJvamVjdE5hbWUsICd0YXJnZXRzJywgbmFtZSwgLi4ucGF0aF0sIHZhbHVlKTtcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXRzW25hbWVdID0gdmFsdWUgYXMgdW5rbm93biBhcyBUYXJnZXREZWZpbml0aW9uO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0YXJnZXRzO1xufVxuIl19