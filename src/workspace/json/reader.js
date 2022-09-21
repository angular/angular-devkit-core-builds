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
        throw new Error(`Project "${projectName}" is missing a required property "root".`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVhZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvd29ya3NwYWNlL2pzb24vcmVhZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILCtDQUFpRjtBQUNqRiw0Q0FBMkQ7QUFDM0QsZ0RBT3dCO0FBRXhCLHlDQUF3RTtBQUN4RSwyQ0FBcUQ7QUFFckQsTUFBTSw0QkFBNEIsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ2pELEtBQUs7SUFDTCxnQkFBZ0I7SUFDaEIsZ0JBQWdCO0lBQ2hCLFlBQVk7Q0FDYixDQUFDLENBQUM7QUFDSCxNQUFNLDBCQUEwQixHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBaUJ4RixLQUFLLFVBQVUsaUJBQWlCLENBQ3JDLElBQVksRUFDWixJQUFtQixFQUNuQixVQUFnQyxFQUFFOztJQUVsQyxNQUFNLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdEMsSUFBSSxHQUFHLEtBQUssU0FBUyxFQUFFO1FBQ3JCLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztLQUNuRDtJQUVELE1BQU0sR0FBRyxHQUFHLElBQUEsd0JBQVMsRUFBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDN0YsSUFBSSxDQUFBLEdBQUcsYUFBSCxHQUFHLHVCQUFILEdBQUcsQ0FBRSxJQUFJLE1BQUssUUFBUSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRTtRQUMzQyxNQUFNLElBQUksS0FBSyxDQUFDLGdEQUFnRCxD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LEdBQUcsSUFBQSxrQ0FBc0IsRUFBbUIsS0FBSyxFQUFFO2dCQUM5RCxPQUFPLEVBQUUsQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLHNCQUFzQixDQUFDO2dCQUN6RSxRQUFRLENBQUMsSUFBSSxFQUFFLEtBQUs7b0JBQ2xCLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQyxVQUFVLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDckYsQ0FBQzthQUNGLENBQUMsQ0FBQztTQUNKO2FBQU07WUFDTCxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBb0MsQ0FBQztTQUN0RDtLQUNGO0lBRUQsT0FBTyxPQUFPLENBQUM7QUFDakIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBOb2RlLCBmaW5kTm9kZUF0TG9jYXRpb24sIGdldE5vZGVWYWx1ZSwgcGFyc2VUcmVlIH0gZnJvbSAnanNvbmMtcGFyc2VyJztcbmltcG9ydCB7IEpzb25WYWx1ZSwgaXNKc29uT2JqZWN0IH0gZnJvbSAnLi4vLi4vanNvbi91dGlscyc7XG5pbXBvcnQge1xuICBEZWZpbml0aW9uQ29sbGVjdGlvbkxpc3RlbmVyLFxuICBQcm9qZWN0RGVmaW5pdGlvbixcbiAgUHJvamVjdERlZmluaXRpb25Db2xsZWN0aW9uLFxuICBUYXJnZXREZWZpbml0aW9uLFxuICBUYXJnZXREZWZpbml0aW9uQ29sbGVjdGlvbixcbiAgV29ya3NwYWNlRGVmaW5pdGlvbixcbn0gZnJvbSAnLi4vZGVmaW5pdGlvbnMnO1xuaW1wb3J0IHsgV29ya3NwYWNlSG9zdCB9IGZyb20gJy4uL2hvc3QnO1xuaW1wb3J0IHsgSnNvbldvcmtzcGFjZU1ldGFkYXRhLCBKc29uV29ya3NwYWNlU3ltYm9sIH0gZnJvbSAnLi9tZXRhZGF0YSc7XG5pbXBvcnQgeyBjcmVhdGVWaXJ0dWFsQXN0T2JqZWN0IH0gZnJvbSAnLi91dGlsaXRpZXMnO1xuXG5jb25zdCBBTkdVTEFSX1dPUktTUEFDRV9FWFRFTlNJT05TID0gT2JqZWN0LmZyZWV6ZShbXG4gICdjbGknLFxuICAnZGVmYXVsdFByb2plY3QnLFxuICAnbmV3UHJvamVjdFJvb3QnLFxuICAnc2NoZW1hdGljcycsXG5dKTtcbmNvbnN0IEFOR1VMQVJfUFJPSkVDVF9FWFRFTlNJT05TID0gT2JqZWN0LmZyZWV6ZShbJ2NsaScsICdzY2hlbWF0aWNzJywgJ3Byb2plY3RUeXBlJywgJ2kxOG4nXSk7XG5cbmludGVyZmFjZSBQYXJzZXJDb250ZXh0IHtcbiAgcmVhZG9ubHkgaG9zdDogV29ya3NwYWNlSG9zdDtcbiAgcmVhZG9ubHkgbWV0YWRhdGE6IEpzb25Xb3Jrc3BhY2VNZXRhZGF0YTtcbiAgcmVhZG9ubHkgdHJhY2tDaGFuZ2VzOiBib29sZWFuO1xuICByZWFkb25seSB1bnByZWZpeGVkV29ya3NwYWNlRXh0ZW5zaW9uczogUmVhZG9ubHlTZXQ8c3RyaW5nPjtcbiAgcmVhZG9ubHkgdW5wcmVmaXhlZFByb2plY3RFeHRlbnNpb25zOiBSZWFkb25seVNldDxzdHJpbmc+O1xuICBlcnJvcihtZXNzYWdlOiBzdHJpbmcsIG5vZGU6IEpzb25WYWx1ZSk6IHZvaWQ7XG4gIHdhcm4obWVzc2FnZTogc3RyaW5nLCBub2RlOiBKc29uVmFsdWUpOiB2b2lkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEpzb25Xb3Jrc3BhY2VPcHRpb25zIHtcbiAgYWxsb3dlZFByb2plY3RFeHRlbnNpb25zPzogc3RyaW5nW107XG4gIGFsbG93ZWRXb3Jrc3BhY2VFeHRlbnNpb25zPzogc3RyaW5nW107XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWFkSnNvbldvcmtzcGFjZShcbiAgcGF0aDogc3RyaW5nLFxuICBob3N0OiBXb3Jrc3BhY2VIb3N0LFxuICBvcHRpb25zOiBKc29uV29ya3NwYWNlT3B0aW9ucyA9IHt9LFxuKTogUHJvbWlzZTxXb3Jrc3BhY2VEZWZpbml0aW9uPiB7XG4gIGNvbnN0IHJhdyA9IGF3YWl0IGhvc3QucmVhZEZpbGUocGF0aCk7XG4gIGlmIChyYXcgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIHJlYWQgd29ya3NwYWNlIGZpbGUuJyk7XG4gIH1cblxuICBjb25zdCBhc3QgPSBwYXJzZVRyZWUocmF3LCB1bmRlZmluZWQsIHsgYWxsb3dUcmFpbGluZ0NvbW1hOiB0cnVlLCBkaXNhbGxvd0NvbW1lbnRzOiBmYWxzZSB9KTtcbiAgaWYgKGFzdD8udHlwZSAhPT0gJ29iamVjdCcgfHwgIWFzdC5jaGlsZHJlbikge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCB3b3Jrc3BhY2UgZmlsZSAtIGV4cGVjdGVkIEpTT04gb2JqZWN0LicpO1xuICB9XG5cbiAgLy8gVmVyc2lvbiBjaGVja1xuICBjb25zdCB2ZXJzaW9uTm9kZSA9IGZpbmROb2RlQXRMb2NhdGlvbihhc3QsIFsndmVyc2lvbiddKTtcbiAgaWYgKCF2ZXJzaW9uTm9kZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBmb3JtYXQgLSB2ZXJzaW9uIHNwZWNpZmllciBub3QgZm91bmQuJyk7XG4gIH1cbiAgY29uc3QgdmVyc2lvbiA9IHZlcnNpb25Ob2RlLnZhbHVlO1xuICBpZiAodmVyc2lvbiAhPT0gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBmb3JtYXQgdmVyc2lvbiBkZXRlY3RlZCAtIEV4cGVjdGVkOlsgMSBdIEZvdW5kOiBbICR7dmVyc2lvbn0gXWApO1xuICB9XG5cbiAgY29uc3QgY29udGV4dDogUGFyc2VyQ29udGV4dCA9IHtcbiAgICBob3N0LFxuICAgIG1ldGFkYXRhOiBuZXcgSnNvbldvcmtzcGFjZU1ldGFkYXRhKHBhdGgsIGFzdCwgcmF3KSxcbiAgICB0cmFja0NoYW5nZXM6IHRydWUsXG4gICAgdW5wcmVmaXhlZFdvcmtzcGFjZUV4dGVuc2lvbnM6IG5ldyBTZXQoW1xuICAgICAgLi4uQU5HVUxBUl9XT1JLU1BBQ0VfRVhURU5TSU9OUyxcbiAgICAgIC4uLihvcHRpb25zLmFsbG93ZWRXb3Jrc3BhY2VFeHRlbnNpb25zID8/IFtdKSxcbiAgICBdKSxcbiAgICB1bnByZWZpeGVkUHJvamVjdEV4dGVuc2lvbnM6IG5ldyBTZXQoW1xuICAgICAgLi4uQU5HVUxBUl9QUk9KRUNUX0VYVEVOU0lPTlMsXG4gICAgICAuLi4ob3B0aW9ucy5hbGxvd2VkUHJvamVjdEV4dGVuc2lvbnMgPz8gW10pLFxuICAgIF0pLFxuICAgIGVycm9yKG1lc3NhZ2UsIF9ub2RlKSB7XG4gICAgICAvLyBUT0RPOiBEaWFnbm9zdGljIHJlcG9ydGluZyBzdXBwb3J0XG4gICAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgfSxcbiAgICB3YXJuKG1lc3NhZ2UsIF9ub2RlKSB7XG4gICAgICAvLyBUT0RPOiBEaWFnbm9zdGljIHJlcG9ydGluZyBzdXBwb3J0XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxuICAgICAgY29uc29sZS53YXJuKG1lc3NhZ2UpO1xuICAgIH0sXG4gIH07XG5cbiAgY29uc3Qgd29ya3NwYWNlID0gcGFyc2VXb3Jrc3BhY2UoYXN0LCBjb250ZXh0KTtcblxuICByZXR1cm4gd29ya3NwYWNlO1xufVxuXG5mdW5jdGlvbiBwYXJzZVdvcmtzcGFjZSh3b3Jrc3BhY2VOb2RlOiBOb2RlLCBjb250ZXh0OiBQYXJzZXJDb250ZXh0KTogV29ya3NwYWNlRGVmaW5pdGlvbiB7XG4gIGNvbnN0IGpzb25NZXRhZGF0YSA9IGNvbnRleHQubWV0YWRhdGE7XG4gIGxldCBwcm9qZWN0cztcbiAgbGV0IGV4dGVuc2lvbnM6IFJlY29yZDxzdHJpbmcsIEpzb25WYWx1ZT4gfCB1bmRlZmluZWQ7XG4gIGlmICghY29udGV4dC50cmFja0NoYW5nZXMpIHtcbiAgICBleHRlbnNpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgfVxuXG4gIC8vIFRPRE86IGBnZXROb2RlVmFsdWVgIC0gbG9va3MgcG90ZW50aWFsbHkgZXhwZW5zaXZlIHNpbmNlIGl0IHdhbGtzIHRoZSB3aG9sZSB0cmVlIGFuZCBpbnN0YW50aWF0ZXMgdGhlIGZ1bGwgb2JqZWN0IHN0cnVjdHVyZSBlYWNoIHRpbWUuXG4gIC8vIE1pZ2h0IGJlIHNvbWV0aGluZyB0byBsb29rIGF0IG1vdmluZyBmb3J3YXJkIHRvIG9wdGltaXplLlxuICBjb25zdCB3b3Jrc3BhY2VOb2RlVmFsdWUgPSBnZXROb2RlVmFsdWUod29ya3NwYWNlTm9kZSk7XG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllczxKc29uVmFsdWU+KHdvcmtzcGFjZU5vZGVWYWx1ZSkpIHtcbiAgICBpZiAobmFtZSA9PT0gJyRzY2hlbWEnIHx8IG5hbWUgPT09ICd2ZXJzaW9uJykge1xuICAgICAgLy8gc2tpcFxuICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ3Byb2plY3RzJykge1xuICAgICAgY29uc3Qgbm9kZXMgPSBmaW5kTm9kZUF0TG9jYXRpb24od29ya3NwYWNlTm9kZSwgWydwcm9qZWN0cyddKTtcbiAgICAgIGlmICghaXNKc29uT2JqZWN0KHZhbHVlKSB8fCAhbm9kZXMpIHtcbiAgICAgICAgY29udGV4dC5lcnJvcignSW52YWxpZCBcInByb2plY3RzXCIgZmllbGQgZm91bmQ7IGV4cGVjdGVkIGFuIG9iamVjdC4nLCB2YWx1ZSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBwcm9qZWN0cyA9IHBhcnNlUHJvamVjdHNPYmplY3Qobm9kZXMsIGNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIWNvbnRleHQudW5wcmVmaXhlZFdvcmtzcGFjZUV4dGVuc2lvbnMuaGFzKG5hbWUpICYmICEvXlthLXpdezEsM30tLiovLnRlc3QobmFtZSkpIHtcbiAgICAgICAgY29udGV4dC53YXJuKGBXb3Jrc3BhY2UgZXh0ZW5zaW9uIHdpdGggaW52YWxpZCBuYW1lICgke25hbWV9KSBmb3VuZC5gLCBuYW1lKTtcbiAgICAgIH1cbiAgICAgIGlmIChleHRlbnNpb25zKSB7XG4gICAgICAgIGV4dGVuc2lvbnNbbmFtZV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBsZXQgY29sbGVjdGlvbkxpc3RlbmVyOiBEZWZpbml0aW9uQ29sbGVjdGlvbkxpc3RlbmVyPFByb2plY3REZWZpbml0aW9uPiB8IHVuZGVmaW5lZDtcbiAgaWYgKGNvbnRleHQudHJhY2tDaGFuZ2VzKSB7XG4gICAgY29sbGVjdGlvbkxpc3RlbmVyID0gKG5hbWUsIG5ld1ZhbHVlKSA9PiB7XG4gICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKFsncHJvamVjdHMnLCBuYW1lXSwgbmV3VmFsdWUsICdwcm9qZWN0Jyk7XG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3RDb2xsZWN0aW9uID0gbmV3IFByb2plY3REZWZpbml0aW9uQ29sbGVjdGlvbihwcm9qZWN0cywgY29sbGVjdGlvbkxpc3RlbmVyKTtcblxuICByZXR1cm4ge1xuICAgIFtKc29uV29ya3NwYWNlU3ltYm9sXToganNvbk1ldGFkYXRhLFxuICAgIHByb2plY3RzOiBwcm9qZWN0Q29sbGVjdGlvbixcbiAgICAvLyBJZiBub3QgdHJhY2tpbmcgY2hhbmdlcyB0aGUgYGV4dGVuc2lvbnNgIHZhcmlhYmxlIHdpbGwgY29udGFpbiB0aGUgcGFyc2VkXG4gICAgLy8gdmFsdWVzLiAgT3RoZXJ3aXNlIHRoZSBleHRlbnNpb25zIGFyZSB0cmFja2VkIHZpYSBhIHZpcnR1YWwgQVNUIG9iamVjdC5cbiAgICBleHRlbnNpb25zOlxuICAgICAgZXh0ZW5zaW9ucyA/P1xuICAgICAgY3JlYXRlVmlydHVhbEFzdE9iamVjdCh3b3Jrc3BhY2VOb2RlVmFsdWUsIHtcbiAgICAgICAgZXhjbHVkZTogWyckc2NoZW1hJywgJ3ZlcnNpb24nLCAncHJvamVjdHMnXSxcbiAgICAgICAgbGlzdGVuZXIocGF0aCwgdmFsdWUpIHtcbiAgICAgICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKHBhdGgsIHZhbHVlKTtcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICB9IGFzIFdvcmtzcGFjZURlZmluaXRpb247XG59XG5cbmZ1bmN0aW9uIHBhcnNlUHJvamVjdHNPYmplY3QoXG4gIHByb2plY3RzTm9kZTogTm9kZSxcbiAgY29udGV4dDogUGFyc2VyQ29udGV4dCxcbik6IFJlY29yZDxzdHJpbmcsIFByb2plY3REZWZpbml0aW9uPiB7XG4gIGNvbnN0IHByb2plY3RzOiBSZWNvcmQ8c3RyaW5nLCBQcm9qZWN0RGVmaW5pdGlvbj4gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllczxKc29uVmFsdWU+KGdldE5vZGVWYWx1ZShwcm9qZWN0c05vZGUpKSkge1xuICAgIGNvbnN0IG5vZGVzID0gZmluZE5vZGVBdExvY2F0aW9uKHByb2plY3RzTm9kZSwgW25hbWVdKTtcbiAgICBpZiAoIWlzSnNvbk9iamVjdCh2YWx1ZSkgfHwgIW5vZGVzKSB7XG4gICAgICBjb250ZXh0Lndhcm4oJ1NraXBwaW5nIGludmFsaWQgcHJvamVjdCB2YWx1ZTsgZXhwZWN0ZWQgYW4gb2JqZWN0LicsIHZhbHVlKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHByb2plY3RzW25hbWVdID0gcGFyc2VQcm9qZWN0KG5hbWUsIG5vZGVzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHJldHVybiBwcm9qZWN0cztcbn1cblxuZnVuY3Rpb24gcGFyc2VQcm9qZWN0KFxuICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICBwcm9qZWN0Tm9kZTogTm9kZSxcbiAgY29udGV4dDogUGFyc2VyQ29udGV4dCxcbik6IFByb2plY3REZWZpbml0aW9uIHtcbiAgY29uc3QganNvbk1ldGFkYXRhID0gY29udGV4dC5tZXRhZGF0YTtcbiAgbGV0IHRhcmdldHM7XG4gIGxldCBoYXNUYXJnZXRzID0gZmFsc2U7XG4gIGxldCBleHRlbnNpb25zOiBSZWNvcmQ8c3RyaW5nLCBKc29uVmFsdWU+IHwgdW5kZWZpbmVkO1xuICBsZXQgcHJvcGVydGllczogUmVjb3JkPCdyb290JyB8ICdzb3VyY2VSb290JyB8ICdwcmVmaXgnLCBzdHJpbmc+IHwgdW5kZWZpbmVkO1xuICBpZiAoIWNvbnRleHQudHJhY2tDaGFuZ2VzKSB7XG4gICAgLy8gSWYgbm90IHRyYWNraW5nIGNoYW5nZXMsIHRoZSBwYXJzZXIgd2lsbCBzdG9yZSB0aGUgdmFsdWVzIGRpcmVjdGx5IGluIHN0YW5kYXJkIG9iamVjdHNcbiAgICBleHRlbnNpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBwcm9wZXJ0aWVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3ROb2RlVmFsdWUgPSBnZXROb2RlVmFsdWUocHJvamVjdE5vZGUpO1xuICBpZiAoISgncm9vdCcgaW4gcHJvamVjdE5vZGVWYWx1ZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFByb2plY3QgXCIke3Byb2plY3ROYW1lfVwiIGlzIG1pc3NpbmcgYSByZXF1aXJlZCBwcm9wZXJ0eSBcInJvb3RcIi5gKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllczxKc29uVmFsdWU+KHByb2plY3ROb2RlVmFsdWUpKSB7XG4gICAgc3dpdGNoIChuYW1lKSB7XG4gICAgICBjYXNlICd0YXJnZXRzJzpcbiAgICAgIGNhc2UgJ2FyY2hpdGVjdCc6XG4gICAgICAgIGNvbnN0IG5vZGVzID0gZmluZE5vZGVBdExvY2F0aW9uKHByb2plY3ROb2RlLCBbbmFtZV0pO1xuICAgICAgICBpZiAoIWlzSnNvbk9iamVjdCh2YWx1ZSkgfHwgIW5vZGVzKSB7XG4gICAgICAgICAgY29udGV4dC5lcnJvcihgSW52YWxpZCBcIiR7bmFtZX1cIiBmaWVsZCBmb3VuZDsgZXhwZWN0ZWQgYW4gb2JqZWN0LmAsIHZhbHVlKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBoYXNUYXJnZXRzID0gdHJ1ZTtcbiAgICAgICAgdGFyZ2V0cyA9IHBhcnNlVGFyZ2V0c09iamVjdChwcm9qZWN0TmFtZSwgbm9kZXMsIGNvbnRleHQpO1xuICAgICAgICBqc29uTWV0YWRhdGEuaGFzTGVnYWN5VGFyZ2V0c05hbWUgPSBuYW1lID09PSAnYXJjaGl0ZWN0JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdwcmVmaXgnOlxuICAgICAgY2FzZSAncm9vdCc6XG4gICAgICBjYXNlICdzb3VyY2VSb290JzpcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBjb250ZXh0Lndhcm4oYFByb2plY3QgcHJvcGVydHkgXCIke25hbWV9XCIgc2hvdWxkIGJlIGEgc3RyaW5nLmAsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocHJvcGVydGllcykge1xuICAgICAgICAgIHByb3BlcnRpZXNbbmFtZV0gPSB2YWx1ZSBhcyBzdHJpbmc7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAoIWNvbnRleHQudW5wcmVmaXhlZFByb2plY3RFeHRlbnNpb25zLmhhcyhuYW1lKSAmJiAhL15bYS16XXsxLDN9LS4qLy50ZXN0KG5hbWUpKSB7XG4gICAgICAgICAgY29udGV4dC53YXJuKGBQcm9qZWN0IGV4dGVuc2lvbiB3aXRoIGludmFsaWQgbmFtZSAoJHtuYW1lfSkgZm91bmQuYCwgbmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV4dGVuc2lvbnMpIHtcbiAgICAgICAgICBleHRlbnNpb25zW25hbWVdID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgbGV0IGNvbGxlY3Rpb25MaXN0ZW5lcjogRGVmaW5pdGlvbkNvbGxlY3Rpb25MaXN0ZW5lcjxUYXJnZXREZWZpbml0aW9uPiB8IHVuZGVmaW5lZDtcbiAgaWYgKGNvbnRleHQudHJhY2tDaGFuZ2VzKSB7XG4gICAgY29sbGVjdGlvbkxpc3RlbmVyID0gKG5hbWUsIG5ld1ZhbHVlLCBjb2xsZWN0aW9uKSA9PiB7XG4gICAgICBpZiAoaGFzVGFyZ2V0cykge1xuICAgICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKFsncHJvamVjdHMnLCBwcm9qZWN0TmFtZSwgJ3RhcmdldHMnLCBuYW1lXSwgbmV3VmFsdWUsICd0YXJnZXQnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGpzb25NZXRhZGF0YS5hZGRDaGFuZ2UoXG4gICAgICAgICAgWydwcm9qZWN0cycsIHByb2plY3ROYW1lLCAndGFyZ2V0cyddLFxuICAgICAgICAgIGNvbGxlY3Rpb24sXG4gICAgICAgICAgJ3RhcmdldGNvbGxlY3Rpb24nLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBjb25zdCBiYXNlID0ge1xuICAgIHRhcmdldHM6IG5ldyBUYXJnZXREZWZpbml0aW9uQ29sbGVjdGlvbih0YXJnZXRzLCBjb2xsZWN0aW9uTGlzdGVuZXIpLFxuICAgIC8vIElmIG5vdCB0cmFja2luZyBjaGFuZ2VzIHRoZSBgZXh0ZW5zaW9uc2AgdmFyaWFibGUgd2lsbCBjb250YWluIHRoZSBwYXJzZWRcbiAgICAvLyB2YWx1ZXMuICBPdGhlcndpc2UgdGhlIGV4dGVuc2lvbnMgYXJlIHRyYWNrZWQgdmlhIGEgdmlydHVhbCBBU1Qgb2JqZWN0LlxuICAgIGV4dGVuc2lvbnM6XG4gICAgICBleHRlbnNpb25zID8/XG4gICAgICBjcmVhdGVWaXJ0dWFsQXN0T2JqZWN0KHByb2plY3ROb2RlVmFsdWUsIHtcbiAgICAgICAgZXhjbHVkZTogWydhcmNoaXRlY3QnLCAncHJlZml4JywgJ3Jvb3QnLCAnc291cmNlUm9vdCcsICd0YXJnZXRzJ10sXG4gICAgICAgIGxpc3RlbmVyKHBhdGgsIHZhbHVlKSB7XG4gICAgICAgICAganNvbk1ldGFkYXRhLmFkZENoYW5nZShbJ3Byb2plY3RzJywgcHJvamVjdE5hbWUsIC4uLnBhdGhdLCB2YWx1ZSk7XG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgfTtcblxuICBjb25zdCBiYXNlS2V5cyA9IG5ldyBTZXQoT2JqZWN0LmtleXMoYmFzZSkpO1xuICBjb25zdCBwcm9qZWN0ID1cbiAgICBwcm9wZXJ0aWVzID8/XG4gICAgY3JlYXRlVmlydHVhbEFzdE9iamVjdDxQcm9qZWN0RGVmaW5pdGlvbj4ocHJvamVjdE5vZGVWYWx1ZSwge1xuICAgICAgaW5jbHVkZTogWydwcmVmaXgnLCAncm9vdCcsICdzb3VyY2VSb290JywgLi4uYmFzZUtleXNdLFxuICAgICAgbGlzdGVuZXIocGF0aCwgdmFsdWUpIHtcbiAgICAgICAgaWYgKCFiYXNlS2V5cy5oYXMocGF0aFswXSkpIHtcbiAgICAgICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKFsncHJvamVjdHMnLCBwcm9qZWN0TmFtZSwgLi4ucGF0aF0sIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9KTtcblxuICByZXR1cm4gT2JqZWN0LmFzc2lnbihwcm9qZWN0LCBiYXNlKSBhcyBQcm9qZWN0RGVmaW5pdGlvbjtcbn1cblxuZnVuY3Rpb24gcGFyc2VUYXJnZXRzT2JqZWN0KFxuICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICB0YXJnZXRzTm9kZTogTm9kZSxcbiAgY29udGV4dDogUGFyc2VyQ29udGV4dCxcbik6IFJlY29yZDxzdHJpbmcsIFRhcmdldERlZmluaXRpb24+IHtcbiAgY29uc3QganNvbk1ldGFkYXRhID0gY29udGV4dC5tZXRhZGF0YTtcbiAgY29uc3QgdGFyZ2V0czogUmVjb3JkPHN0cmluZywgVGFyZ2V0RGVmaW5pdGlvbj4gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllczxKc29uVmFsdWU+KGdldE5vZGVWYWx1ZSh0YXJnZXRzTm9kZSkpKSB7XG4gICAgaWYgKCFpc0pzb25PYmplY3QodmFsdWUpKSB7XG4gICAgICBjb250ZXh0Lndhcm4oJ1NraXBwaW5nIGludmFsaWQgdGFyZ2V0IHZhbHVlOyBleHBlY3RlZCBhbiBvYmplY3QuJywgdmFsdWUpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKGNvbnRleHQudHJhY2tDaGFuZ2VzKSB7XG4gICAgICB0YXJnZXRzW25hbWVdID0gY3JlYXRlVmlydHVhbEFzdE9iamVjdDxUYXJnZXREZWZpbml0aW9uPih2YWx1ZSwge1xuICAgICAgICBpbmNsdWRlOiBbJ2J1aWxkZXInLCAnb3B0aW9ucycsICdjb25maWd1cmF0aW9ucycsICdkZWZhdWx0Q29uZmlndXJhdGlvbiddLFxuICAgICAgICBsaXN0ZW5lcihwYXRoLCB2YWx1ZSkge1xuICAgICAgICAgIGpzb25NZXRhZGF0YS5hZGRDaGFuZ2UoWydwcm9qZWN0cycsIHByb2plY3ROYW1lLCAndGFyZ2V0cycsIG5hbWUsIC4uLnBhdGhdLCB2YWx1ZSk7XG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGFyZ2V0c1tuYW1lXSA9IHZhbHVlIGFzIHVua25vd24gYXMgVGFyZ2V0RGVmaW5pdGlvbjtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGFyZ2V0cztcbn1cbiJdfQ==