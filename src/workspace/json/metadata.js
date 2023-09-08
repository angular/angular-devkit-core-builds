"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonWorkspaceMetadata = exports.JsonWorkspaceSymbol = void 0;
const jsonc_parser_1 = require("jsonc-parser");
exports.JsonWorkspaceSymbol = Symbol.for('@angular/core:workspace-json');
function escapeKey(key) {
    return key.replace('~', '~0').replace('/', '~1');
}
class JsonWorkspaceMetadata {
    filePath;
    ast;
    raw;
    changes = new Map();
    hasLegacyTargetsName = true;
    constructor(filePath, ast, raw) {
        this.filePath = filePath;
        this.ast = ast;
        this.raw = raw;
    }
    get hasChanges() {
        return this.changes.size > 0;
    }
    get changeCount() {
        return this.changes.size;
    }
    getNodeValueFromAst(path) {
        const node = (0, jsonc_parser_1.findNodeAtLocation)(this.ast, path);
        return node && (0, jsonc_parser_1.getNodeValue)(node);
    }
    findChangesForPath(path) {
        return this.changes.get(path);
    }
    addChange(jsonPath, value, type) {
        let currentPath = '';
        for (let index = 0; index < jsonPath.length - 1; index++) {
            currentPath = currentPath + '/' + escapeKey(jsonPath[index]);
            if (this.changes.has(currentPath)) {
                // Ignore changes on children as parent is updated.
                return;
            }
        }
        const pathKey = '/' + jsonPath.map((k) => escapeKey(k)).join('/');
        for (const key of this.changes.keys()) {
            if (key.startsWith(pathKey + '/')) {
                // changes on the same or child paths are redundant.
                this.changes.delete(key);
            }
        }
        this.changes.set(pathKey, { jsonPath, type, value });
    }
}
exports.JsonWorkspaceMetadata = JsonWorkspaceMetadata;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YWRhdGEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy93b3Jrc3BhY2UvanNvbi9tZXRhZGF0YS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQ0FBZ0Y7QUFJbkUsUUFBQSxtQkFBbUIsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLDhCQUE4QixDQUFDLENBQUM7QUFvQjlFLFNBQVMsU0FBUyxDQUFDLEdBQVc7SUFDNUIsT0FBTyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ25ELENBQUM7QUFFRCxNQUFhLHFCQUFxQjtJQUtYO0lBQW1DO0lBQW9CO0lBSm5FLE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBc0IsQ0FBQztJQUVqRCxvQkFBb0IsR0FBRyxJQUFJLENBQUM7SUFFNUIsWUFBcUIsUUFBZ0IsRUFBbUIsR0FBUyxFQUFXLEdBQVc7UUFBbEUsYUFBUSxHQUFSLFFBQVEsQ0FBUTtRQUFtQixRQUFHLEdBQUgsR0FBRyxDQUFNO1FBQVcsUUFBRyxHQUFILEdBQUcsQ0FBUTtJQUFHLENBQUM7SUFFM0YsSUFBSSxVQUFVO1FBQ1osT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVELElBQUksV0FBVztRQUNiLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDM0IsQ0FBQztJQUVELG1CQUFtQixDQUFDLElBQWM7UUFDaEMsTUFBTSxJQUFJLEdBQUcsSUFBQSxpQ0FBa0IsRUFBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRWhELE9BQU8sSUFBSSxJQUFJLElBQUEsMkJBQVksRUFBQyxJQUFJLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsa0JBQWtCLENBQUMsSUFBWTtRQUM3QixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hDLENBQUM7SUFFRCxTQUFTLENBQ1AsUUFBa0IsRUFDbEIsS0FBa0MsRUFDbEMsSUFBUTtRQUVSLElBQUksV0FBVyxHQUFHLEVBQUUsQ0FBQztRQUNyQixLQUFLLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRSxLQUFLLEdBQUcsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUU7WUFDeEQsV0FBVyxHQUFHLFdBQVcsR0FBRyxHQUFHLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQzdELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQ2pDLG1EQUFtRDtnQkFDbkQsT0FBTzthQUNSO1NBQ0Y7UUFFRCxNQUFNLE9BQU8sR0FBRyxHQUFHLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2xFLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUNyQyxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQyxFQUFFO2dCQUNqQyxvREFBb0Q7Z0JBQ3BELElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2FBQzFCO1NBQ0Y7UUFFRCxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDdkQsQ0FBQztDQUNGO0FBakRELHNEQWlEQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBKU09OUGF0aCwgTm9kZSwgZmluZE5vZGVBdExvY2F0aW9uLCBnZXROb2RlVmFsdWUgfSBmcm9tICdqc29uYy1wYXJzZXInO1xuaW1wb3J0IHsgSnNvblZhbHVlIH0gZnJvbSAnLi4vLi4vanNvbic7XG5pbXBvcnQgeyBQcm9qZWN0RGVmaW5pdGlvbiwgVGFyZ2V0RGVmaW5pdGlvbiwgV29ya3NwYWNlRGVmaW5pdGlvbiB9IGZyb20gJy4uL2RlZmluaXRpb25zJztcblxuZXhwb3J0IGNvbnN0IEpzb25Xb3Jrc3BhY2VTeW1ib2wgPSBTeW1ib2wuZm9yKCdAYW5ndWxhci9jb3JlOndvcmtzcGFjZS1qc29uJyk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSnNvbldvcmtzcGFjZURlZmluaXRpb24gZXh0ZW5kcyBXb3Jrc3BhY2VEZWZpbml0aW9uIHtcbiAgW0pzb25Xb3Jrc3BhY2VTeW1ib2xdOiBKc29uV29ya3NwYWNlTWV0YWRhdGE7XG59XG5cbmludGVyZmFjZSBDaGFuZ2VWYWx1ZXMge1xuICBqc29uOiBKc29uVmFsdWU7XG4gIHByb2plY3Q6IFByb2plY3REZWZpbml0aW9uO1xuICB0YXJnZXQ6IFRhcmdldERlZmluaXRpb247XG4gIHByb2plY3Rjb2xsZWN0aW9uOiBJdGVyYWJsZTxbc3RyaW5nLCBQcm9qZWN0RGVmaW5pdGlvbl0+O1xuICB0YXJnZXRjb2xsZWN0aW9uOiBJdGVyYWJsZTxbc3RyaW5nLCBUYXJnZXREZWZpbml0aW9uXT47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSnNvbkNoYW5nZSB7XG4gIHZhbHVlPzogdW5rbm93bjtcbiAgdHlwZT86IGtleW9mIENoYW5nZVZhbHVlcztcbiAganNvblBhdGg6IHN0cmluZ1tdO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVLZXkoa2V5OiBzdHJpbmcpOiBzdHJpbmcgfCBudW1iZXIge1xuICByZXR1cm4ga2V5LnJlcGxhY2UoJ34nLCAnfjAnKS5yZXBsYWNlKCcvJywgJ34xJyk7XG59XG5cbmV4cG9ydCBjbGFzcyBKc29uV29ya3NwYWNlTWV0YWRhdGEge1xuICByZWFkb25seSBjaGFuZ2VzID0gbmV3IE1hcDxzdHJpbmcsIEpzb25DaGFuZ2U+KCk7XG5cbiAgaGFzTGVnYWN5VGFyZ2V0c05hbWUgPSB0cnVlO1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IGZpbGVQYXRoOiBzdHJpbmcsIHByaXZhdGUgcmVhZG9ubHkgYXN0OiBOb2RlLCByZWFkb25seSByYXc6IHN0cmluZykge31cblxuICBnZXQgaGFzQ2hhbmdlcygpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5jaGFuZ2VzLnNpemUgPiAwO1xuICB9XG5cbiAgZ2V0IGNoYW5nZUNvdW50KCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuY2hhbmdlcy5zaXplO1xuICB9XG5cbiAgZ2V0Tm9kZVZhbHVlRnJvbUFzdChwYXRoOiBKU09OUGF0aCk6IHVua25vd24ge1xuICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUF0TG9jYXRpb24odGhpcy5hc3QsIHBhdGgpO1xuXG4gICAgcmV0dXJuIG5vZGUgJiYgZ2V0Tm9kZVZhbHVlKG5vZGUpO1xuICB9XG5cbiAgZmluZENoYW5nZXNGb3JQYXRoKHBhdGg6IHN0cmluZyk6IEpzb25DaGFuZ2UgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLmNoYW5nZXMuZ2V0KHBhdGgpO1xuICB9XG5cbiAgYWRkQ2hhbmdlPFQgZXh0ZW5kcyBrZXlvZiBDaGFuZ2VWYWx1ZXMgPSBrZXlvZiBDaGFuZ2VWYWx1ZXM+KFxuICAgIGpzb25QYXRoOiBzdHJpbmdbXSxcbiAgICB2YWx1ZTogQ2hhbmdlVmFsdWVzW1RdIHwgdW5kZWZpbmVkLFxuICAgIHR5cGU/OiBULFxuICApOiB2b2lkIHtcbiAgICBsZXQgY3VycmVudFBhdGggPSAnJztcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwganNvblBhdGgubGVuZ3RoIC0gMTsgaW5kZXgrKykge1xuICAgICAgY3VycmVudFBhdGggPSBjdXJyZW50UGF0aCArICcvJyArIGVzY2FwZUtleShqc29uUGF0aFtpbmRleF0pO1xuICAgICAgaWYgKHRoaXMuY2hhbmdlcy5oYXMoY3VycmVudFBhdGgpKSB7XG4gICAgICAgIC8vIElnbm9yZSBjaGFuZ2VzIG9uIGNoaWxkcmVuIGFzIHBhcmVudCBpcyB1cGRhdGVkLlxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcGF0aEtleSA9ICcvJyArIGpzb25QYXRoLm1hcCgoaykgPT4gZXNjYXBlS2V5KGspKS5qb2luKCcvJyk7XG4gICAgZm9yIChjb25zdCBrZXkgb2YgdGhpcy5jaGFuZ2VzLmtleXMoKSkge1xuICAgICAgaWYgKGtleS5zdGFydHNXaXRoKHBhdGhLZXkgKyAnLycpKSB7XG4gICAgICAgIC8vIGNoYW5nZXMgb24gdGhlIHNhbWUgb3IgY2hpbGQgcGF0aHMgYXJlIHJlZHVuZGFudC5cbiAgICAgICAgdGhpcy5jaGFuZ2VzLmRlbGV0ZShrZXkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuY2hhbmdlcy5zZXQocGF0aEtleSwgeyBqc29uUGF0aCwgdHlwZSwgdmFsdWUgfSk7XG4gIH1cbn1cbiJdfQ==