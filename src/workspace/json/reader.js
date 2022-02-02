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
const parser_1 = require("../../json/parser");
const definitions_1 = require("../definitions");
const metadata_1 = require("./metadata");
const utilities_1 = require("./utilities");
async function readJsonWorkspace(path, host) {
    const raw = await host.readFile(path);
    if (raw === undefined) {
        throw new Error('Unable to read workspace file.');
    }
    const ast = (0, parser_1.parseJsonAst)(raw, parser_1.JsonParseMode.Loose);
    if (ast.kind !== 'object') {
        throw new Error('Invalid workspace file - expected JSON object.');
    }
    // Version check
    const versionNode = ast.properties.find((pair) => pair.key.value === 'version');
    if (!versionNode) {
        throw new Error('Unknown format - version specifier not found.');
    }
    const formatVersion = versionNode.value.value;
    if (formatVersion !== 1) {
        throw new Error(`Invalid format version detected - Expected:[ 1 ] Found: [ ${formatVersion} ]`);
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
    let projectsNode;
    let extensions;
    if (!context.trackChanges) {
        extensions = Object.create(null);
    }
    for (const { key, value } of workspaceNode.properties) {
        const name = key.value;
        if (name === '$schema' || name === 'version') {
            // skip
        }
        else if (name === 'projects') {
            if (value.kind !== 'object') {
                context.error('Invalid "projects" field found; expected an object.', value);
                continue;
            }
            projectsNode = value;
            projects = parseProjectsObject(value, context);
        }
        else {
            if (!specialWorkspaceExtensions.includes(name) && !/^[a-z]{1,3}-.*/.test(name)) {
                context.warn(`Project extension with invalid name found.`, key);
            }
            if (extensions) {
                extensions[name] = value.value;
            }
        }
    }
    let collectionListener;
    if (context.trackChanges && projectsNode) {
        const parentNode = projectsNode;
        collectionListener = (name, action, newValue) => {
            jsonMetadata.addChange(action, `/projects/${(0, utilities_1.escapeKey)(name)}`, parentNode, newValue, 'project');
        };
    }
    const projectCollection = new definitions_1.ProjectDefinitionCollection(projects, collectionListener);
    return {
        [metadata_1.JsonWorkspaceSymbol]: jsonMetadata,
        projects: projectCollection,
        // If not tracking changes the `extensions` variable will contain the parsed
        // values.  Otherwise the extensions are tracked via a virtual AST object.
        extensions: extensions ||
            (0, utilities_1.createVirtualAstObject)(workspaceNode, {
                exclude: ['$schema', 'version', 'projects'],
                listener(op, path, node, value) {
                    jsonMetadata.addChange(op, path, node, value);
                },
            }),
    };
}
function parseProjectsObject(projectsNode, context) {
    const projects = Object.create(null);
    for (const { key, value } of projectsNode.properties) {
        if (value.kind !== 'object') {
            context.warn('Skipping invalid project value; expected an object.', value);
            continue;
        }
        const name = key.value;
        projects[name] = parseProject(name, value, context);
    }
    return projects;
}
function parseProject(projectName, projectNode, context) {
    const jsonMetadata = context.metadata;
    let targets;
    let targetsNode;
    let extensions;
    let properties;
    if (!context.trackChanges) {
        // If not tracking changes, the parser will store the values directly in standard objects
        extensions = Object.create(null);
        properties = Object.create(null);
    }
    for (const { key, value } of projectNode.properties) {
        const name = key.value;
        switch (name) {
            case 'targets':
            case 'architect':
                if (value.kind !== 'object') {
                    context.error(`Invalid "${name}" field found; expected an object.`, value);
                    break;
                }
                targetsNode = value;
                targets = parseTargetsObject(projectName, value, context);
                break;
            case 'prefix':
            case 'root':
            case 'sourceRoot':
                if (value.kind !== 'string') {
                    context.warn(`Project property "${name}" should be a string.`, value);
                }
                if (properties) {
                    properties[name] = value.value;
                }
                break;
            default:
                if (!specialProjectExtensions.includes(name) && !/^[a-z]{1,3}-.*/.test(name)) {
                    context.warn(`Project extension with invalid name found.`, key);
                }
                if (extensions) {
                    extensions[name] = value.value;
                }
                break;
        }
    }
    let collectionListener;
    if (context.trackChanges) {
        if (targetsNode) {
            const parentNode = targetsNode;
            collectionListener = (name, action, newValue) => {
                jsonMetadata.addChange(action, `/projects/${projectName}/targets/${(0, utilities_1.escapeKey)(name)}`, parentNode, newValue, 'target');
            };
        }
        else {
            let added = false;
            collectionListener = (_name, action, _new, _old, collection) => {
                if (added || action !== 'add') {
                    return;
                }
                jsonMetadata.addChange('add', `/projects/${projectName}/targets`, projectNode, collection, 'targetcollection');
                added = true;
            };
        }
    }
    const base = {
        targets: new definitions_1.TargetDefinitionCollection(targets, collectionListener),
        // If not tracking changes the `extensions` variable will contain the parsed
        // values.  Otherwise the extensions are tracked via a virtual AST object.
        extensions: extensions ||
            (0, utilities_1.createVirtualAstObject)(projectNode, {
                exclude: ['architect', 'prefix', 'root', 'sourceRoot', 'targets'],
                listener(op, path, node, value) {
                    jsonMetadata.addChange(op, `/projects/${projectName}${path}`, node, value);
                },
            }),
    };
    let project;
    if (context.trackChanges) {
        project = (0, utilities_1.createVirtualAstObject)(projectNode, {
            base,
            include: ['prefix', 'root', 'sourceRoot'],
            listener(op, path, node, value) {
                jsonMetadata.addChange(op, `/projects/${projectName}${path}`, node, value);
            },
        });
    }
    else {
        project = {
            ...base,
            ...properties,
        };
    }
    return project;
}
function parseTargetsObject(projectName, targetsNode, context) {
    const jsonMetadata = context.metadata;
    const targets = Object.create(null);
    for (const { key, value } of targetsNode.properties) {
        if (value.kind !== 'object') {
            context.warn('Skipping invalid target value; expected an object.', value);
            continue;
        }
        const name = key.value;
        if (context.trackChanges) {
            targets[name] = (0, utilities_1.createVirtualAstObject)(value, {
                include: ['builder', 'options', 'configurations', 'defaultConfiguration'],
                listener(op, path, node, value) {
                    jsonMetadata.addChange(op, `/projects/${projectName}/targets/${name}${path}`, node, value);
                },
            });
        }
        else {
            targets[name] = value.value;
        }
    }
    return targets;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVhZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvd29ya3NwYWNlL2pzb24vcmVhZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILDhDQUFnRTtBQUdoRSxnREFPd0I7QUFFeEIseUNBQXdFO0FBQ3hFLDJDQUFnRTtBQVV6RCxLQUFLLFVBQVUsaUJBQWlCLENBQ3JDLElBQVksRUFDWixJQUFtQjtJQUVuQixNQUFNLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFdEMsSUFBSSxHQUFHLEtBQUssU0FBUyxFQUFFO1FBQ3JCLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztLQUNuRDtJQUVELE1BQU0sR0FBRyxHQUFHLElBQUEscUJBQVksRUFBQyxHQUFHLEVBQUUsc0JBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNuRCxJQUFJLEdBQUcsQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO1FBQ3pCLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0RBQWdELENBQUMsQ0FBQztLQUNuRTtJQUVELGdCQUFnQjtJQUNoQixNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEtBQUssU0FBUyxDQUFDLENBQUM7SUFDaEYsSUFBSSxDQUFDLFdBQVcsRUFBRTtRQUNoQixNQUFNLElBQUksS0FBSyxDQUFDLCtDQUErQyxDQUFDLENBQUM7S0FDbEU7SUFDRCxNQUFNLGFBQWEsR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztJQUM5QyxJQUFJLGFBQWEsS0FBSyxDQUFDLEVBQUU7UUFDdkIsTUFBTSxJQUFJLEtBQUssQ0FBQyw2REFBNkQsYUFBYSxJQUFJLENBQUMsQ0FBQztLQUNqRztJQUVELE1BQU0sT0FBTyxHQUFrQjtRQUM3QixJQUFJO1FBQ0osUUFBUSxFQUFFLElBQUksZ0NBQXFCLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUM7UUFDbkQsWUFBWSxFQUFFLElBQUk7UUFDbEIsS0FBSyxDQUFDLE9BQU8sRUFBRSxLQUFLO1lBQ2xCLHFDQUFxQztZQUNyQyxNQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzNCLENBQUM7UUFDRCxJQUFJLENBQUMsUUFBUSxFQUFFLEtBQUs7WUFDbEIscUNBQXFDO1FBQ3ZDLENBQUM7S0FDRixDQUFDO0lBRUYsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUUvQyxPQUFPLFNBQVMsQ0FBQztBQUNuQixDQUFDO0FBekNELDhDQXlDQztBQUVELE1BQU0sMEJBQTBCLEdBQUcsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFFN0YsTUFBTSx3QkFBd0IsR0FBRyxDQUFDLEtBQUssRUFBRSxZQUFZLEVBQUUsYUFBYSxDQUFDLENBQUM7QUFFdEUsU0FBUyxjQUFjLENBQUMsYUFBNEIsRUFBRSxPQUFzQjtJQUMxRSxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDO0lBQ3RDLElBQUksUUFBUSxDQUFDO0lBQ2IsSUFBSSxZQUF1QyxDQUFDO0lBQzVDLElBQUksVUFBaUQsQ0FBQztJQUN0RCxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRTtRQUN6QixVQUFVLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNsQztJQUVELEtBQUssTUFBTSxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxhQUFhLENBQUMsVUFBVSxFQUFFO1FBQ3JELE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUM7UUFFdkIsSUFBSSxJQUFJLEtBQUssU0FBUyxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUU7WUFDNUMsT0FBTztTQUNSO2FBQU0sSUFBSSxJQUFJLEtBQUssVUFBVSxFQUFFO1lBQzlCLElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7Z0JBQzNCLE9BQU8sQ0FBQyxLQUFLLENBQUMscURBQXFELEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQzVFLFNBQVM7YUFDVjtZQUVELFlBQVksR0FBRyxLQUFLLENBQUM7WUFDckIsUUFBUSxHQUFHLG1CQUFtQixDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztTQUNoRDthQUFNO1lBQ0wsSUFBSSxDQUFDLDBCQUEwQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDOUUsT0FBTyxDQUFDLElBQUksQ0FBQyw0Q0FBNEMsRUFBRSxHQUFHLENBQUMsQ0FBQzthQUNqRTtZQUNELElBQUksVUFBVSxFQUFFO2dCQUNkLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDO2FBQ2hDO1NBQ0Y7S0FDRjtJQUVELElBQUksa0JBQStFLENBQUM7SUFDcEYsSUFBSSxPQUFPLENBQUMsWUFBWSxJQUFJLFlBQVksRUFBRTtRQUN4QyxNQUFNLFVBQVUsR0FBRyxZQUFZLENBQUM7UUFDaEMsa0JBQWtCLEdBQUcsQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxFQUFFO1lBQzlDLFlBQVksQ0FBQyxTQUFTLENBQ3BCLE1BQU0sRUFDTixhQUFhLElBQUEscUJBQVMsRUFBQyxJQUFJLENBQUMsRUFBRSxFQUM5QixVQUFVLEVBQ1YsUUFBUSxFQUNSLFNBQVMsQ0FDVixDQUFDO1FBQ0osQ0FBQyxDQUFDO0tBQ0g7SUFFRCxNQUFNLGlCQUFpQixHQUFHLElBQUkseUNBQTJCLENBQUMsUUFBUSxFQUFFLGtCQUFrQixDQUFDLENBQUM7SUFFeEYsT0FBTztRQUNMLENBQUMsOEJBQW1CLENBQUMsRUFBRSxZQUFZO1FBQ25DLFFBQVEsRUFBRSxpQkFBaUI7UUFDM0IsNEVBQTRFO1FBQzVFLDBFQUEwRTtRQUMxRSxVQUFVLEVBQ1IsVUFBVTtZQUNWLElBQUEsa0NBQXNCLEVBQUMsYUFBYSxFQUFFO2dCQUNwQyxPQUFPLEVBQUUsQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQztnQkFDM0MsUUFBUSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUs7b0JBQzVCLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ2hELENBQUM7YUFDRixDQUFDO0tBQ2tCLENBQUM7QUFDM0IsQ0FBQztBQUVELFNBQVMsbUJBQW1CLENBQzFCLFlBQTJCLEVBQzNCLE9BQXNCO0lBRXRCLE1BQU0sUUFBUSxHQUFzQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRXhFLEtBQUssTUFBTSxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxZQUFZLENBQUMsVUFBVSxFQUFFO1FBQ3BELElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7WUFDM0IsT0FBTyxDQUFDLElBQUksQ0FBQyxxREFBcUQsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUMzRSxTQUFTO1NBQ1Y7UUFFRCxNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDO1FBQ3ZCLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxZQUFZLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztLQUNyRDtJQUVELE9BQU8sUUFBUSxDQUFDO0FBQ2xCLENBQUM7QUFFRCxTQUFTLFlBQVksQ0FDbkIsV0FBbUIsRUFDbkIsV0FBMEIsRUFDMUIsT0FBc0I7SUFFdEIsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQztJQUN0QyxJQUFJLE9BQU8sQ0FBQztJQUNaLElBQUksV0FBc0MsQ0FBQztJQUMzQyxJQUFJLFVBQWlELENBQUM7SUFDdEQsSUFBSSxVQUF3RSxDQUFDO0lBQzdFLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFO1FBQ3pCLHlGQUF5RjtRQUN6RixVQUFVLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNqQyxVQUFVLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNsQztJQUVELEtBQUssTUFBTSxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxXQUFXLENBQUMsVUFBVSxFQUFFO1FBQ25ELE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUM7UUFDdkIsUUFBUSxJQUFJLEVBQUU7WUFDWixLQUFLLFNBQVMsQ0FBQztZQUNmLEtBQUssV0FBVztnQkFDZCxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO29CQUMzQixPQUFPLENBQUMsS0FBSyxDQUFDLFlBQVksSUFBSSxvQ0FBb0MsRUFBRSxLQUFLLENBQUMsQ0FBQztvQkFDM0UsTUFBTTtpQkFDUDtnQkFDRCxXQUFXLEdBQUcsS0FBSyxDQUFDO2dCQUNwQixPQUFPLEdBQUcsa0JBQWtCLENBQUMsV0FBVyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDMUQsTUFBTTtZQUNSLEtBQUssUUFBUSxDQUFDO1lBQ2QsS0FBSyxNQUFNLENBQUM7WUFDWixLQUFLLFlBQVk7Z0JBQ2YsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRTtvQkFDM0IsT0FBTyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsSUFBSSx1QkFBdUIsRUFBRSxLQUFLLENBQUMsQ0FBQztpQkFDdkU7Z0JBQ0QsSUFBSSxVQUFVLEVBQUU7b0JBQ2QsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFlLENBQUM7aUJBQzFDO2dCQUNELE1BQU07WUFDUjtnQkFDRSxJQUFJLENBQUMsd0JBQXdCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUM1RSxPQUFPLENBQUMsSUFBSSxDQUFDLDRDQUE0QyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2lCQUNqRTtnQkFDRCxJQUFJLFVBQVUsRUFBRTtvQkFDZCxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQztpQkFDaEM7Z0JBQ0QsTUFBTTtTQUNUO0tBQ0Y7SUFFRCxJQUFJLGtCQUE4RSxDQUFDO0lBQ25GLElBQUksT0FBTyxDQUFDLFlBQVksRUFBRTtRQUN4QixJQUFJLFdBQVcsRUFBRTtZQUNmLE1BQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQztZQUMvQixrQkFBa0IsR0FBRyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLEVBQUU7Z0JBQzlDLFlBQVksQ0FBQyxTQUFTLENBQ3BCLE1BQU0sRUFDTixhQUFhLFdBQVcsWUFBWSxJQUFBLHFCQUFTLEVBQUMsSUFBSSxDQUFDLEVBQUUsRUFDckQsVUFBVSxFQUNWLFFBQVEsRUFDUixRQUFRLENBQ1QsQ0FBQztZQUNKLENBQUMsQ0FBQztTQUNIO2FBQU07WUFDTCxJQUFJLEtBQUssR0FBRyxLQUFLLENBQUM7WUFDbEIsa0JBQWtCLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLEVBQUU7Z0JBQzdELElBQUksS0FBSyxJQUFJLE1BQU0sS0FBSyxLQUFLLEVBQUU7b0JBQzdCLE9BQU87aUJBQ1I7Z0JBRUQsWUFBWSxDQUFDLFNBQVMsQ0FDcEIsS0FBSyxFQUNMLGFBQWEsV0FBVyxVQUFVLEVBQ2xDLFdBQVcsRUFDWCxVQUFVLEVBQ1Ysa0JBQWtCLENBQ25CLENBQUM7Z0JBQ0YsS0FBSyxHQUFHLElBQUksQ0FBQztZQUNmLENBQUMsQ0FBQztTQUNIO0tBQ0Y7SUFFRCxNQUFNLElBQUksR0FBRztRQUNYLE9BQU8sRUFBRSxJQUFJLHdDQUEwQixDQUFDLE9BQU8sRUFBRSxrQkFBa0IsQ0FBQztRQUNwRSw0RUFBNEU7UUFDNUUsMEVBQTBFO1FBQzFFLFVBQVUsRUFDUixVQUFVO1lBQ1YsSUFBQSxrQ0FBc0IsRUFBQyxXQUFXLEVBQUU7Z0JBQ2xDLE9BQU8sRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxTQUFTLENBQUM7Z0JBQ2pFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLO29CQUM1QixZQUFZLENBQUMsU0FBUyxDQUFDLEVBQUUsRUFBRSxhQUFhLFdBQVcsR0FBRyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQzdFLENBQUM7YUFDRixDQUFDO0tBQ0wsQ0FBQztJQUVGLElBQUksT0FBMEIsQ0FBQztJQUMvQixJQUFJLE9BQU8sQ0FBQyxZQUFZLEVBQUU7UUFDeEIsT0FBTyxHQUFHLElBQUEsa0NBQXNCLEVBQW9CLFdBQVcsRUFBRTtZQUMvRCxJQUFJO1lBQ0osT0FBTyxFQUFFLENBQUMsUUFBUSxFQUFFLE1BQU0sRUFBRSxZQUFZLENBQUM7WUFDekMsUUFBUSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUs7Z0JBQzVCLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFBRSxFQUFFLGFBQWEsV0FBVyxHQUFHLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztZQUM3RSxDQUFDO1NBQ0YsQ0FBQyxDQUFDO0tBQ0o7U0FBTTtRQUNMLE9BQU8sR0FBRztZQUNSLEdBQUcsSUFBSTtZQUNQLEdBQUcsVUFBVTtTQUNPLENBQUM7S0FDeEI7SUFFRCxPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDO0FBRUQsU0FBUyxrQkFBa0IsQ0FDekIsV0FBbUIsRUFDbkIsV0FBMEIsRUFDMUIsT0FBc0I7SUFFdEIsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQztJQUN0QyxNQUFNLE9BQU8sR0FBcUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV0RSxLQUFLLE1BQU0sRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLElBQUksV0FBVyxDQUFDLFVBQVUsRUFBRTtRQUNuRCxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO1lBQzNCLE9BQU8sQ0FBQyxJQUFJLENBQUMsb0RBQW9ELEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDMUUsU0FBUztTQUNWO1FBRUQsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQztRQUN2QixJQUFJLE9BQU8sQ0FBQyxZQUFZLEVBQUU7WUFDeEIsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUEsa0NBQXNCLEVBQW1CLEtBQUssRUFBRTtnQkFDOUQsT0FBTyxFQUFFLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxzQkFBc0IsQ0FBQztnQkFDekUsUUFBUSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUs7b0JBQzVCLFlBQVksQ0FBQyxTQUFTLENBQ3BCLEVBQUUsRUFDRixhQUFhLFdBQVcsWUFBWSxJQUFJLEdBQUcsSUFBSSxFQUFFLEVBQ2pELElBQUksRUFDSixLQUFLLENBQ04sQ0FBQztnQkFDSixDQUFDO2FBQ0YsQ0FBQyxDQUFDO1NBQ0o7YUFBTTtZQUNMLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBb0MsQ0FBQztTQUM1RDtLQUNGO0lBRUQsT0FBTyxPQUFPLENBQUM7QUFDakIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBKc29uUGFyc2VNb2RlLCBwYXJzZUpzb25Bc3QgfSBmcm9tICcuLi8uLi9qc29uL3BhcnNlcic7XG5pbXBvcnQgeyBKc29uQXN0S2V5VmFsdWUsIEpzb25Bc3ROb2RlLCBKc29uQXN0T2JqZWN0IH0gZnJvbSAnLi4vLi4vanNvbi9wYXJzZXJfYXN0JztcbmltcG9ydCB7IEpzb25WYWx1ZSB9IGZyb20gJy4uLy4uL2pzb24vdXRpbHMnO1xuaW1wb3J0IHtcbiAgRGVmaW5pdGlvbkNvbGxlY3Rpb25MaXN0ZW5lcixcbiAgUHJvamVjdERlZmluaXRpb24sXG4gIFByb2plY3REZWZpbml0aW9uQ29sbGVjdGlvbixcbiAgVGFyZ2V0RGVmaW5pdGlvbixcbiAgVGFyZ2V0RGVmaW5pdGlvbkNvbGxlY3Rpb24sXG4gIFdvcmtzcGFjZURlZmluaXRpb24sXG59IGZyb20gJy4uL2RlZmluaXRpb25zJztcbmltcG9ydCB7IFdvcmtzcGFjZUhvc3QgfSBmcm9tICcuLi9ob3N0JztcbmltcG9ydCB7IEpzb25Xb3Jrc3BhY2VNZXRhZGF0YSwgSnNvbldvcmtzcGFjZVN5bWJvbCB9IGZyb20gJy4vbWV0YWRhdGEnO1xuaW1wb3J0IHsgY3JlYXRlVmlydHVhbEFzdE9iamVjdCwgZXNjYXBlS2V5IH0gZnJvbSAnLi91dGlsaXRpZXMnO1xuXG5pbnRlcmZhY2UgUGFyc2VyQ29udGV4dCB7XG4gIHJlYWRvbmx5IGhvc3Q6IFdvcmtzcGFjZUhvc3Q7XG4gIHJlYWRvbmx5IG1ldGFkYXRhOiBKc29uV29ya3NwYWNlTWV0YWRhdGE7XG4gIHJlYWRvbmx5IHRyYWNrQ2hhbmdlczogYm9vbGVhbjtcbiAgZXJyb3IobWVzc2FnZTogc3RyaW5nLCBub2RlOiBKc29uQXN0Tm9kZSB8IEpzb25Bc3RLZXlWYWx1ZSk6IHZvaWQ7XG4gIHdhcm4obWVzc2FnZTogc3RyaW5nLCBub2RlOiBKc29uQXN0Tm9kZSB8IEpzb25Bc3RLZXlWYWx1ZSk6IHZvaWQ7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWFkSnNvbldvcmtzcGFjZShcbiAgcGF0aDogc3RyaW5nLFxuICBob3N0OiBXb3Jrc3BhY2VIb3N0LFxuKTogUHJvbWlzZTxXb3Jrc3BhY2VEZWZpbml0aW9uPiB7XG4gIGNvbnN0IHJhdyA9IGF3YWl0IGhvc3QucmVhZEZpbGUocGF0aCk7XG5cbiAgaWYgKHJhdyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gcmVhZCB3b3Jrc3BhY2UgZmlsZS4nKTtcbiAgfVxuXG4gIGNvbnN0IGFzdCA9IHBhcnNlSnNvbkFzdChyYXcsIEpzb25QYXJzZU1vZGUuTG9vc2UpO1xuICBpZiAoYXN0LmtpbmQgIT09ICdvYmplY3QnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHdvcmtzcGFjZSBmaWxlIC0gZXhwZWN0ZWQgSlNPTiBvYmplY3QuJyk7XG4gIH1cblxuICAvLyBWZXJzaW9uIGNoZWNrXG4gIGNvbnN0IHZlcnNpb25Ob2RlID0gYXN0LnByb3BlcnRpZXMuZmluZCgocGFpcikgPT4gcGFpci5rZXkudmFsdWUgPT09ICd2ZXJzaW9uJyk7XG4gIGlmICghdmVyc2lvbk5vZGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZm9ybWF0IC0gdmVyc2lvbiBzcGVjaWZpZXIgbm90IGZvdW5kLicpO1xuICB9XG4gIGNvbnN0IGZvcm1hdFZlcnNpb24gPSB2ZXJzaW9uTm9kZS52YWx1ZS52YWx1ZTtcbiAgaWYgKGZvcm1hdFZlcnNpb24gIT09IDEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZm9ybWF0IHZlcnNpb24gZGV0ZWN0ZWQgLSBFeHBlY3RlZDpbIDEgXSBGb3VuZDogWyAke2Zvcm1hdFZlcnNpb259IF1gKTtcbiAgfVxuXG4gIGNvbnN0IGNvbnRleHQ6IFBhcnNlckNvbnRleHQgPSB7XG4gICAgaG9zdCxcbiAgICBtZXRhZGF0YTogbmV3IEpzb25Xb3Jrc3BhY2VNZXRhZGF0YShwYXRoLCBhc3QsIHJhdyksXG4gICAgdHJhY2tDaGFuZ2VzOiB0cnVlLFxuICAgIGVycm9yKG1lc3NhZ2UsIF9ub2RlKSB7XG4gICAgICAvLyBUT0RPOiBEaWFnbm9zdGljIHJlcG9ydGluZyBzdXBwb3J0XG4gICAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgfSxcbiAgICB3YXJuKF9tZXNzYWdlLCBfbm9kZSkge1xuICAgICAgLy8gVE9ETzogRGlhZ25vc3RpYyByZXBvcnRpbmcgc3VwcG9ydFxuICAgIH0sXG4gIH07XG5cbiAgY29uc3Qgd29ya3NwYWNlID0gcGFyc2VXb3Jrc3BhY2UoYXN0LCBjb250ZXh0KTtcblxuICByZXR1cm4gd29ya3NwYWNlO1xufVxuXG5jb25zdCBzcGVjaWFsV29ya3NwYWNlRXh0ZW5zaW9ucyA9IFsnY2xpJywgJ2RlZmF1bHRQcm9qZWN0JywgJ25ld1Byb2plY3RSb290JywgJ3NjaGVtYXRpY3MnXTtcblxuY29uc3Qgc3BlY2lhbFByb2plY3RFeHRlbnNpb25zID0gWydjbGknLCAnc2NoZW1hdGljcycsICdwcm9qZWN0VHlwZSddO1xuXG5mdW5jdGlvbiBwYXJzZVdvcmtzcGFjZSh3b3Jrc3BhY2VOb2RlOiBKc29uQXN0T2JqZWN0LCBjb250ZXh0OiBQYXJzZXJDb250ZXh0KTogV29ya3NwYWNlRGVmaW5pdGlvbiB7XG4gIGNvbnN0IGpzb25NZXRhZGF0YSA9IGNvbnRleHQubWV0YWRhdGE7XG4gIGxldCBwcm9qZWN0cztcbiAgbGV0IHByb2plY3RzTm9kZTogSnNvbkFzdE9iamVjdCB8IHVuZGVmaW5lZDtcbiAgbGV0IGV4dGVuc2lvbnM6IFJlY29yZDxzdHJpbmcsIEpzb25WYWx1ZT4gfCB1bmRlZmluZWQ7XG4gIGlmICghY29udGV4dC50cmFja0NoYW5nZXMpIHtcbiAgICBleHRlbnNpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgeyBrZXksIHZhbHVlIH0gb2Ygd29ya3NwYWNlTm9kZS5wcm9wZXJ0aWVzKSB7XG4gICAgY29uc3QgbmFtZSA9IGtleS52YWx1ZTtcblxuICAgIGlmIChuYW1lID09PSAnJHNjaGVtYScgfHwgbmFtZSA9PT0gJ3ZlcnNpb24nKSB7XG4gICAgICAvLyBza2lwXG4gICAgfSBlbHNlIGlmIChuYW1lID09PSAncHJvamVjdHMnKSB7XG4gICAgICBpZiAodmFsdWUua2luZCAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgY29udGV4dC5lcnJvcignSW52YWxpZCBcInByb2plY3RzXCIgZmllbGQgZm91bmQ7IGV4cGVjdGVkIGFuIG9iamVjdC4nLCB2YWx1ZSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBwcm9qZWN0c05vZGUgPSB2YWx1ZTtcbiAgICAgIHByb2plY3RzID0gcGFyc2VQcm9qZWN0c09iamVjdCh2YWx1ZSwgY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghc3BlY2lhbFdvcmtzcGFjZUV4dGVuc2lvbnMuaW5jbHVkZXMobmFtZSkgJiYgIS9eW2Etel17MSwzfS0uKi8udGVzdChuYW1lKSkge1xuICAgICAgICBjb250ZXh0Lndhcm4oYFByb2plY3QgZXh0ZW5zaW9uIHdpdGggaW52YWxpZCBuYW1lIGZvdW5kLmAsIGtleSk7XG4gICAgICB9XG4gICAgICBpZiAoZXh0ZW5zaW9ucykge1xuICAgICAgICBleHRlbnNpb25zW25hbWVdID0gdmFsdWUudmFsdWU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgbGV0IGNvbGxlY3Rpb25MaXN0ZW5lcjogRGVmaW5pdGlvbkNvbGxlY3Rpb25MaXN0ZW5lcjxQcm9qZWN0RGVmaW5pdGlvbj4gfCB1bmRlZmluZWQ7XG4gIGlmIChjb250ZXh0LnRyYWNrQ2hhbmdlcyAmJiBwcm9qZWN0c05vZGUpIHtcbiAgICBjb25zdCBwYXJlbnROb2RlID0gcHJvamVjdHNOb2RlO1xuICAgIGNvbGxlY3Rpb25MaXN0ZW5lciA9IChuYW1lLCBhY3Rpb24sIG5ld1ZhbHVlKSA9PiB7XG4gICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKFxuICAgICAgICBhY3Rpb24sXG4gICAgICAgIGAvcHJvamVjdHMvJHtlc2NhcGVLZXkobmFtZSl9YCxcbiAgICAgICAgcGFyZW50Tm9kZSxcbiAgICAgICAgbmV3VmFsdWUsXG4gICAgICAgICdwcm9qZWN0JyxcbiAgICAgICk7XG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3RDb2xsZWN0aW9uID0gbmV3IFByb2plY3REZWZpbml0aW9uQ29sbGVjdGlvbihwcm9qZWN0cywgY29sbGVjdGlvbkxpc3RlbmVyKTtcblxuICByZXR1cm4ge1xuICAgIFtKc29uV29ya3NwYWNlU3ltYm9sXToganNvbk1ldGFkYXRhLFxuICAgIHByb2plY3RzOiBwcm9qZWN0Q29sbGVjdGlvbixcbiAgICAvLyBJZiBub3QgdHJhY2tpbmcgY2hhbmdlcyB0aGUgYGV4dGVuc2lvbnNgIHZhcmlhYmxlIHdpbGwgY29udGFpbiB0aGUgcGFyc2VkXG4gICAgLy8gdmFsdWVzLiAgT3RoZXJ3aXNlIHRoZSBleHRlbnNpb25zIGFyZSB0cmFja2VkIHZpYSBhIHZpcnR1YWwgQVNUIG9iamVjdC5cbiAgICBleHRlbnNpb25zOlxuICAgICAgZXh0ZW5zaW9ucyB8fFxuICAgICAgY3JlYXRlVmlydHVhbEFzdE9iamVjdCh3b3Jrc3BhY2VOb2RlLCB7XG4gICAgICAgIGV4Y2x1ZGU6IFsnJHNjaGVtYScsICd2ZXJzaW9uJywgJ3Byb2plY3RzJ10sXG4gICAgICAgIGxpc3RlbmVyKG9wLCBwYXRoLCBub2RlLCB2YWx1ZSkge1xuICAgICAgICAgIGpzb25NZXRhZGF0YS5hZGRDaGFuZ2Uob3AsIHBhdGgsIG5vZGUsIHZhbHVlKTtcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICB9IGFzIFdvcmtzcGFjZURlZmluaXRpb247XG59XG5cbmZ1bmN0aW9uIHBhcnNlUHJvamVjdHNPYmplY3QoXG4gIHByb2plY3RzTm9kZTogSnNvbkFzdE9iamVjdCxcbiAgY29udGV4dDogUGFyc2VyQ29udGV4dCxcbik6IFJlY29yZDxzdHJpbmcsIFByb2plY3REZWZpbml0aW9uPiB7XG4gIGNvbnN0IHByb2plY3RzOiBSZWNvcmQ8c3RyaW5nLCBQcm9qZWN0RGVmaW5pdGlvbj4gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gIGZvciAoY29uc3QgeyBrZXksIHZhbHVlIH0gb2YgcHJvamVjdHNOb2RlLnByb3BlcnRpZXMpIHtcbiAgICBpZiAodmFsdWUua2luZCAhPT0gJ29iamVjdCcpIHtcbiAgICAgIGNvbnRleHQud2FybignU2tpcHBpbmcgaW52YWxpZCBwcm9qZWN0IHZhbHVlOyBleHBlY3RlZCBhbiBvYmplY3QuJywgdmFsdWUpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgbmFtZSA9IGtleS52YWx1ZTtcbiAgICBwcm9qZWN0c1tuYW1lXSA9IHBhcnNlUHJvamVjdChuYW1lLCB2YWx1ZSwgY29udGV4dCk7XG4gIH1cblxuICByZXR1cm4gcHJvamVjdHM7XG59XG5cbmZ1bmN0aW9uIHBhcnNlUHJvamVjdChcbiAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgcHJvamVjdE5vZGU6IEpzb25Bc3RPYmplY3QsXG4gIGNvbnRleHQ6IFBhcnNlckNvbnRleHQsXG4pOiBQcm9qZWN0RGVmaW5pdGlvbiB7XG4gIGNvbnN0IGpzb25NZXRhZGF0YSA9IGNvbnRleHQubWV0YWRhdGE7XG4gIGxldCB0YXJnZXRzO1xuICBsZXQgdGFyZ2V0c05vZGU6IEpzb25Bc3RPYmplY3QgfCB1bmRlZmluZWQ7XG4gIGxldCBleHRlbnNpb25zOiBSZWNvcmQ8c3RyaW5nLCBKc29uVmFsdWU+IHwgdW5kZWZpbmVkO1xuICBsZXQgcHJvcGVydGllczogUmVjb3JkPCdyb290JyB8ICdzb3VyY2VSb290JyB8ICdwcmVmaXgnLCBzdHJpbmc+IHwgdW5kZWZpbmVkO1xuICBpZiAoIWNvbnRleHQudHJhY2tDaGFuZ2VzKSB7XG4gICAgLy8gSWYgbm90IHRyYWNraW5nIGNoYW5nZXMsIHRoZSBwYXJzZXIgd2lsbCBzdG9yZSB0aGUgdmFsdWVzIGRpcmVjdGx5IGluIHN0YW5kYXJkIG9iamVjdHNcbiAgICBleHRlbnNpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBwcm9wZXJ0aWVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgeyBrZXksIHZhbHVlIH0gb2YgcHJvamVjdE5vZGUucHJvcGVydGllcykge1xuICAgIGNvbnN0IG5hbWUgPSBrZXkudmFsdWU7XG4gICAgc3dpdGNoIChuYW1lKSB7XG4gICAgICBjYXNlICd0YXJnZXRzJzpcbiAgICAgIGNhc2UgJ2FyY2hpdGVjdCc6XG4gICAgICAgIGlmICh2YWx1ZS5raW5kICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIGNvbnRleHQuZXJyb3IoYEludmFsaWQgXCIke25hbWV9XCIgZmllbGQgZm91bmQ7IGV4cGVjdGVkIGFuIG9iamVjdC5gLCB2YWx1ZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgdGFyZ2V0c05vZGUgPSB2YWx1ZTtcbiAgICAgICAgdGFyZ2V0cyA9IHBhcnNlVGFyZ2V0c09iamVjdChwcm9qZWN0TmFtZSwgdmFsdWUsIGNvbnRleHQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3ByZWZpeCc6XG4gICAgICBjYXNlICdyb290JzpcbiAgICAgIGNhc2UgJ3NvdXJjZVJvb3QnOlxuICAgICAgICBpZiAodmFsdWUua2luZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBjb250ZXh0Lndhcm4oYFByb2plY3QgcHJvcGVydHkgXCIke25hbWV9XCIgc2hvdWxkIGJlIGEgc3RyaW5nLmAsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocHJvcGVydGllcykge1xuICAgICAgICAgIHByb3BlcnRpZXNbbmFtZV0gPSB2YWx1ZS52YWx1ZSBhcyBzdHJpbmc7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAoIXNwZWNpYWxQcm9qZWN0RXh0ZW5zaW9ucy5pbmNsdWRlcyhuYW1lKSAmJiAhL15bYS16XXsxLDN9LS4qLy50ZXN0KG5hbWUpKSB7XG4gICAgICAgICAgY29udGV4dC53YXJuKGBQcm9qZWN0IGV4dGVuc2lvbiB3aXRoIGludmFsaWQgbmFtZSBmb3VuZC5gLCBrZXkpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChleHRlbnNpb25zKSB7XG4gICAgICAgICAgZXh0ZW5zaW9uc1tuYW1lXSA9IHZhbHVlLnZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGxldCBjb2xsZWN0aW9uTGlzdGVuZXI6IERlZmluaXRpb25Db2xsZWN0aW9uTGlzdGVuZXI8VGFyZ2V0RGVmaW5pdGlvbj4gfCB1bmRlZmluZWQ7XG4gIGlmIChjb250ZXh0LnRyYWNrQ2hhbmdlcykge1xuICAgIGlmICh0YXJnZXRzTm9kZSkge1xuICAgICAgY29uc3QgcGFyZW50Tm9kZSA9IHRhcmdldHNOb2RlO1xuICAgICAgY29sbGVjdGlvbkxpc3RlbmVyID0gKG5hbWUsIGFjdGlvbiwgbmV3VmFsdWUpID0+IHtcbiAgICAgICAganNvbk1ldGFkYXRhLmFkZENoYW5nZShcbiAgICAgICAgICBhY3Rpb24sXG4gICAgICAgICAgYC9wcm9qZWN0cy8ke3Byb2plY3ROYW1lfS90YXJnZXRzLyR7ZXNjYXBlS2V5KG5hbWUpfWAsXG4gICAgICAgICAgcGFyZW50Tm9kZSxcbiAgICAgICAgICBuZXdWYWx1ZSxcbiAgICAgICAgICAndGFyZ2V0JyxcbiAgICAgICAgKTtcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBhZGRlZCA9IGZhbHNlO1xuICAgICAgY29sbGVjdGlvbkxpc3RlbmVyID0gKF9uYW1lLCBhY3Rpb24sIF9uZXcsIF9vbGQsIGNvbGxlY3Rpb24pID0+IHtcbiAgICAgICAgaWYgKGFkZGVkIHx8IGFjdGlvbiAhPT0gJ2FkZCcpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBqc29uTWV0YWRhdGEuYWRkQ2hhbmdlKFxuICAgICAgICAgICdhZGQnLFxuICAgICAgICAgIGAvcHJvamVjdHMvJHtwcm9qZWN0TmFtZX0vdGFyZ2V0c2AsXG4gICAgICAgICAgcHJvamVjdE5vZGUsXG4gICAgICAgICAgY29sbGVjdGlvbixcbiAgICAgICAgICAndGFyZ2V0Y29sbGVjdGlvbicsXG4gICAgICAgICk7XG4gICAgICAgIGFkZGVkID0gdHJ1ZTtcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgY29uc3QgYmFzZSA9IHtcbiAgICB0YXJnZXRzOiBuZXcgVGFyZ2V0RGVmaW5pdGlvbkNvbGxlY3Rpb24odGFyZ2V0cywgY29sbGVjdGlvbkxpc3RlbmVyKSxcbiAgICAvLyBJZiBub3QgdHJhY2tpbmcgY2hhbmdlcyB0aGUgYGV4dGVuc2lvbnNgIHZhcmlhYmxlIHdpbGwgY29udGFpbiB0aGUgcGFyc2VkXG4gICAgLy8gdmFsdWVzLiAgT3RoZXJ3aXNlIHRoZSBleHRlbnNpb25zIGFyZSB0cmFja2VkIHZpYSBhIHZpcnR1YWwgQVNUIG9iamVjdC5cbiAgICBleHRlbnNpb25zOlxuICAgICAgZXh0ZW5zaW9ucyB8fFxuICAgICAgY3JlYXRlVmlydHVhbEFzdE9iamVjdChwcm9qZWN0Tm9kZSwge1xuICAgICAgICBleGNsdWRlOiBbJ2FyY2hpdGVjdCcsICdwcmVmaXgnLCAncm9vdCcsICdzb3VyY2VSb290JywgJ3RhcmdldHMnXSxcbiAgICAgICAgbGlzdGVuZXIob3AsIHBhdGgsIG5vZGUsIHZhbHVlKSB7XG4gICAgICAgICAganNvbk1ldGFkYXRhLmFkZENoYW5nZShvcCwgYC9wcm9qZWN0cy8ke3Byb2plY3ROYW1lfSR7cGF0aH1gLCBub2RlLCB2YWx1ZSk7XG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgfTtcblxuICBsZXQgcHJvamVjdDogUHJvamVjdERlZmluaXRpb247XG4gIGlmIChjb250ZXh0LnRyYWNrQ2hhbmdlcykge1xuICAgIHByb2plY3QgPSBjcmVhdGVWaXJ0dWFsQXN0T2JqZWN0PFByb2plY3REZWZpbml0aW9uPihwcm9qZWN0Tm9kZSwge1xuICAgICAgYmFzZSxcbiAgICAgIGluY2x1ZGU6IFsncHJlZml4JywgJ3Jvb3QnLCAnc291cmNlUm9vdCddLFxuICAgICAgbGlzdGVuZXIob3AsIHBhdGgsIG5vZGUsIHZhbHVlKSB7XG4gICAgICAgIGpzb25NZXRhZGF0YS5hZGRDaGFuZ2Uob3AsIGAvcHJvamVjdHMvJHtwcm9qZWN0TmFtZX0ke3BhdGh9YCwgbm9kZSwgdmFsdWUpO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBwcm9qZWN0ID0ge1xuICAgICAgLi4uYmFzZSxcbiAgICAgIC4uLnByb3BlcnRpZXMsXG4gICAgfSBhcyBQcm9qZWN0RGVmaW5pdGlvbjtcbiAgfVxuXG4gIHJldHVybiBwcm9qZWN0O1xufVxuXG5mdW5jdGlvbiBwYXJzZVRhcmdldHNPYmplY3QoXG4gIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gIHRhcmdldHNOb2RlOiBKc29uQXN0T2JqZWN0LFxuICBjb250ZXh0OiBQYXJzZXJDb250ZXh0LFxuKTogUmVjb3JkPHN0cmluZywgVGFyZ2V0RGVmaW5pdGlvbj4ge1xuICBjb25zdCBqc29uTWV0YWRhdGEgPSBjb250ZXh0Lm1ldGFkYXRhO1xuICBjb25zdCB0YXJnZXRzOiBSZWNvcmQ8c3RyaW5nLCBUYXJnZXREZWZpbml0aW9uPiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgZm9yIChjb25zdCB7IGtleSwgdmFsdWUgfSBvZiB0YXJnZXRzTm9kZS5wcm9wZXJ0aWVzKSB7XG4gICAgaWYgKHZhbHVlLmtpbmQgIT09ICdvYmplY3QnKSB7XG4gICAgICBjb250ZXh0Lndhcm4oJ1NraXBwaW5nIGludmFsaWQgdGFyZ2V0IHZhbHVlOyBleHBlY3RlZCBhbiBvYmplY3QuJywgdmFsdWUpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgbmFtZSA9IGtleS52YWx1ZTtcbiAgICBpZiAoY29udGV4dC50cmFja0NoYW5nZXMpIHtcbiAgICAgIHRhcmdldHNbbmFtZV0gPSBjcmVhdGVWaXJ0dWFsQXN0T2JqZWN0PFRhcmdldERlZmluaXRpb24+KHZhbHVlLCB7XG4gICAgICAgIGluY2x1ZGU6IFsnYnVpbGRlcicsICdvcHRpb25zJywgJ2NvbmZpZ3VyYXRpb25zJywgJ2RlZmF1bHRDb25maWd1cmF0aW9uJ10sXG4gICAgICAgIGxpc3RlbmVyKG9wLCBwYXRoLCBub2RlLCB2YWx1ZSkge1xuICAgICAgICAgIGpzb25NZXRhZGF0YS5hZGRDaGFuZ2UoXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIGAvcHJvamVjdHMvJHtwcm9qZWN0TmFtZX0vdGFyZ2V0cy8ke25hbWV9JHtwYXRofWAsXG4gICAgICAgICAgICBub2RlLFxuICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgKTtcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXRzW25hbWVdID0gdmFsdWUudmFsdWUgYXMgdW5rbm93biBhcyBUYXJnZXREZWZpbml0aW9uO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0YXJnZXRzO1xufVxuIl19