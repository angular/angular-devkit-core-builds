"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggingAnalytics = void 0;
/**
 * Analytics implementation that logs analytics events to a logger. This should be used for
 * debugging mainly.
 */
class LoggingAnalytics {
    constructor(_logger) {
        this._logger = _logger;
    }
    event(category, action, options) {
        this._logger.info('event ' + JSON.stringify({ category, action, ...options }));
    }
    screenview(screenName, appName, options) {
        this._logger.info('screenview ' + JSON.stringify({ screenName, appName, ...options }));
    }
    pageview(path, options) {
        this._logger.info('pageview ' + JSON.stringify({ path, ...options }));
    }
    timing(category, variable, time, options) {
        this._logger.info('timing ' + JSON.stringify({ category, variable, time, ...options }));
    }
    flush() {
        return Promise.resolve();
    }
}
exports.LoggingAnalytics = LoggingAnalytics;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nZ2luZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL2FuYWx5dGljcy9sb2dnaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUtIOzs7R0FHRztBQUNILE1BQWEsZ0JBQWdCO0lBQzNCLFlBQXNCLE9BQWU7UUFBZixZQUFPLEdBQVAsT0FBTyxDQUFRO0lBQUcsQ0FBQztJQUV6QyxLQUFLLENBQUMsUUFBZ0IsRUFBRSxNQUFjLEVBQUUsT0FBc0I7UUFDNUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLEdBQUcsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2pGLENBQUM7SUFDRCxVQUFVLENBQUMsVUFBa0IsRUFBRSxPQUFlLEVBQUUsT0FBMkI7UUFDekUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLEdBQUcsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3pGLENBQUM7SUFDRCxRQUFRLENBQUMsSUFBWSxFQUFFLE9BQXlCO1FBQzlDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsSUFBSSxFQUFFLEdBQUcsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3hFLENBQUM7SUFDRCxNQUFNLENBQUMsUUFBZ0IsRUFBRSxRQUFnQixFQUFFLElBQXFCLEVBQUUsT0FBdUI7UUFDdkYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxHQUFHLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMxRixDQUFDO0lBRUQsS0FBSztRQUNILE9BQU8sT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQzNCLENBQUM7Q0FDRjtBQW5CRCw0Q0FtQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSAnLi4vbG9nZ2VyJztcbmltcG9ydCB7IEFuYWx5dGljcywgRXZlbnRPcHRpb25zLCBQYWdldmlld09wdGlvbnMsIFNjcmVlbnZpZXdPcHRpb25zLCBUaW1pbmdPcHRpb25zIH0gZnJvbSAnLi9hcGknO1xuXG4vKipcbiAqIEFuYWx5dGljcyBpbXBsZW1lbnRhdGlvbiB0aGF0IGxvZ3MgYW5hbHl0aWNzIGV2ZW50cyB0byBhIGxvZ2dlci4gVGhpcyBzaG91bGQgYmUgdXNlZCBmb3JcbiAqIGRlYnVnZ2luZyBtYWlubHkuXG4gKi9cbmV4cG9ydCBjbGFzcyBMb2dnaW5nQW5hbHl0aWNzIGltcGxlbWVudHMgQW5hbHl0aWNzIHtcbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIF9sb2dnZXI6IExvZ2dlcikge31cblxuICBldmVudChjYXRlZ29yeTogc3RyaW5nLCBhY3Rpb246IHN0cmluZywgb3B0aW9ucz86IEV2ZW50T3B0aW9ucyk6IHZvaWQge1xuICAgIHRoaXMuX2xvZ2dlci5pbmZvKCdldmVudCAnICsgSlNPTi5zdHJpbmdpZnkoeyBjYXRlZ29yeSwgYWN0aW9uLCAuLi5vcHRpb25zIH0pKTtcbiAgfVxuICBzY3JlZW52aWV3KHNjcmVlbk5hbWU6IHN0cmluZywgYXBwTmFtZTogc3RyaW5nLCBvcHRpb25zPzogU2NyZWVudmlld09wdGlvbnMpOiB2b2lkIHtcbiAgICB0aGlzLl9sb2dnZXIuaW5mbygnc2NyZWVudmlldyAnICsgSlNPTi5zdHJpbmdpZnkoeyBzY3JlZW5OYW1lLCBhcHBOYW1lLCAuLi5vcHRpb25zIH0pKTtcbiAgfVxuICBwYWdldmlldyhwYXRoOiBzdHJpbmcsIG9wdGlvbnM/OiBQYWdldmlld09wdGlvbnMpOiB2b2lkIHtcbiAgICB0aGlzLl9sb2dnZXIuaW5mbygncGFnZXZpZXcgJyArIEpTT04uc3RyaW5naWZ5KHsgcGF0aCwgLi4ub3B0aW9ucyB9KSk7XG4gIH1cbiAgdGltaW5nKGNhdGVnb3J5OiBzdHJpbmcsIHZhcmlhYmxlOiBzdHJpbmcsIHRpbWU6IHN0cmluZyB8IG51bWJlciwgb3B0aW9ucz86IFRpbWluZ09wdGlvbnMpOiB2b2lkIHtcbiAgICB0aGlzLl9sb2dnZXIuaW5mbygndGltaW5nICcgKyBKU09OLnN0cmluZ2lmeSh7IGNhdGVnb3J5LCB2YXJpYWJsZSwgdGltZSwgLi4ub3B0aW9ucyB9KSk7XG4gIH1cblxuICBmbHVzaCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cbn1cbiJdfQ==