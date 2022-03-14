"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NgCliAnalyticsMetricsFlagInfo = exports.NgCliAnalyticsDimensionsFlagInfo = exports.NgCliAnalyticsMetrics = exports.NgCliAnalyticsDimensions = void 0;
__exportStar(require("./api"), exports);
__exportStar(require("./forwarder"), exports);
__exportStar(require("./logging"), exports);
__exportStar(require("./multi"), exports);
__exportStar(require("./noop"), exports);
/**
 * MAKE SURE TO KEEP THIS IN SYNC WITH THE TABLE AND CONTENT IN `/docs/design/analytics.md`.
 * WE LIST THOSE DIMENSIONS (AND MORE).
 *
 * These cannot be in their respective schema.json file because we either change the type
 * (e.g. --buildEventLog is string, but we want to know the usage of it, not its value), or
 * some validation needs to be done (we cannot record ng add --collection if it's not marked as
 * allowed).
 */
var NgCliAnalyticsDimensions;
(function (NgCliAnalyticsDimensions) {
    NgCliAnalyticsDimensions[NgCliAnalyticsDimensions["CpuCount"] = 1] = "CpuCount";
    NgCliAnalyticsDimensions[NgCliAnalyticsDimensions["CpuSpeed"] = 2] = "CpuSpeed";
    NgCliAnalyticsDimensions[NgCliAnalyticsDimensions["RamInGigabytes"] = 3] = "RamInGigabytes";
    NgCliAnalyticsDimensions[NgCliAnalyticsDimensions["NodeVersion"] = 4] = "NodeVersion";
    NgCliAnalyticsDimensions[NgCliAnalyticsDimensions["NgAddCollection"] = 6] = "NgAddCollection";
    NgCliAnalyticsDimensions[NgCliAnalyticsDimensions["AotEnabled"] = 8] = "AotEnabled";
    NgCliAnalyticsDimensions[NgCliAnalyticsDimensions["BuildErrors"] = 20] = "BuildErrors";
})(NgCliAnalyticsDimensions = exports.NgCliAnalyticsDimensions || (exports.NgCliAnalyticsDimensions = {}));
var NgCliAnalyticsMetrics;
(function (NgCliAnalyticsMetrics) {
    NgCliAnalyticsMetrics[NgCliAnalyticsMetrics["NgComponentCount"] = 1] = "NgComponentCount";
    NgCliAnalyticsMetrics[NgCliAnalyticsMetrics["UNUSED_2"] = 2] = "UNUSED_2";
    NgCliAnalyticsMetrics[NgCliAnalyticsMetrics["UNUSED_3"] = 3] = "UNUSED_3";
    NgCliAnalyticsMetrics[NgCliAnalyticsMetrics["UNUSED_4"] = 4] = "UNUSED_4";
    NgCliAnalyticsMetrics[NgCliAnalyticsMetrics["BuildTime"] = 5] = "BuildTime";
    NgCliAnalyticsMetrics[NgCliAnalyticsMetrics["NgOnInitCount"] = 6] = "NgOnInitCount";
    NgCliAnalyticsMetrics[NgCliAnalyticsMetrics["InitialChunkSize"] = 7] = "InitialChunkSize";
    NgCliAnalyticsMetrics[NgCliAnalyticsMetrics["TotalChunkCount"] = 8] = "TotalChunkCount";
    NgCliAnalyticsMetrics[NgCliAnalyticsMetrics["TotalChunkSize"] = 9] = "TotalChunkSize";
    NgCliAnalyticsMetrics[NgCliAnalyticsMetrics["LazyChunkCount"] = 10] = "LazyChunkCount";
    NgCliAnalyticsMetrics[NgCliAnalyticsMetrics["LazyChunkSize"] = 11] = "LazyChunkSize";
    NgCliAnalyticsMetrics[NgCliAnalyticsMetrics["AssetCount"] = 12] = "AssetCount";
    NgCliAnalyticsMetrics[NgCliAnalyticsMetrics["AssetSize"] = 13] = "AssetSize";
    NgCliAnalyticsMetrics[NgCliAnalyticsMetrics["PolyfillSize"] = 14] = "PolyfillSize";
    NgCliAnalyticsMetrics[NgCliAnalyticsMetrics["CssSize"] = 15] = "CssSize";
})(NgCliAnalyticsMetrics = exports.NgCliAnalyticsMetrics || (exports.NgCliAnalyticsMetrics = {}));
// This table is used when generating the analytics.md file. It should match the enum above
// or the validate-user-analytics script will fail.
exports.NgCliAnalyticsDimensionsFlagInfo = {
    CpuCount: ['CPU Count', 'number'],
    CpuSpeed: ['CPU Speed', 'number'],
    RamInGigabytes: ['RAM (In GB)', 'number'],
    NodeVersion: ['Node Version', 'number'],
    NgAddCollection: ['--collection', 'string'],
    AotEnabled: ['AOT Enabled', 'boolean'],
    BuildErrors: ['Build Errors (comma separated)', 'string'],
};
// This table is used when generating the analytics.md file. It should match the enum above
// or the validate-user-analytics script will fail.
exports.NgCliAnalyticsMetricsFlagInfo = {
    NgComponentCount: ['NgComponentCount', 'number'],
    UNUSED_2: ['UNUSED_2', 'none'],
    UNUSED_3: ['UNUSED_3', 'none'],
    UNUSED_4: ['UNUSED_4', 'none'],
    BuildTime: ['Build Time', 'number'],
    NgOnInitCount: ['NgOnInit Count', 'number'],
    InitialChunkSize: ['Initial Chunk Size', 'number'],
    TotalChunkCount: ['Total Chunk Count', 'number'],
    TotalChunkSize: ['Total Chunk Size', 'number'],
    LazyChunkCount: ['Lazy Chunk Count', 'number'],
    LazyChunkSize: ['Lazy Chunk Size', 'number'],
    AssetCount: ['Asset Count', 'number'],
    AssetSize: ['Asset Size', 'number'],
    PolyfillSize: [' Polyfill Size', 'number'],
    CssSize: [' Css Size', 'number'],
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy9hbmFseXRpY3MvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztBQUVILHdDQUFzQjtBQUN0Qiw4Q0FBNEI7QUFDNUIsNENBQTBCO0FBQzFCLDBDQUF3QjtBQUN4Qix5Q0FBdUI7QUFFdkI7Ozs7Ozs7O0dBUUc7QUFDSCxJQUFZLHdCQVFYO0FBUkQsV0FBWSx3QkFBd0I7SUFDbEMsK0VBQVksQ0FBQTtJQUNaLCtFQUFZLENBQUE7SUFDWiwyRkFBa0IsQ0FBQTtJQUNsQixxRkFBZSxDQUFBO0lBQ2YsNkZBQW1CLENBQUE7SUFDbkIsbUZBQWMsQ0FBQTtJQUNkLHNGQUFnQixDQUFBO0FBQ2xCLENBQUMsRUFSVyx3QkFBd0IsR0FBeEIsZ0NBQXdCLEtBQXhCLGdDQUF3QixRQVFuQztBQUVELElBQVkscUJBZ0JYO0FBaEJELFdBQVkscUJBQXFCO0lBQy9CLHlGQUFvQixDQUFBO0lBQ3BCLHlFQUFZLENBQUE7SUFDWix5RUFBWSxDQUFBO0lBQ1oseUVBQVksQ0FBQTtJQUNaLDJFQUFhLENBQUE7SUFDYixtRkFBaUIsQ0FBQTtJQUNqQix5RkFBb0IsQ0FBQTtJQUNwQix1RkFBbUIsQ0FBQTtJQUNuQixxRkFBa0IsQ0FBQTtJQUNsQixzRkFBbUIsQ0FBQTtJQUNuQixvRkFBa0IsQ0FBQTtJQUNsQiw4RUFBZSxDQUFBO0lBQ2YsNEVBQWMsQ0FBQTtJQUNkLGtGQUFpQixDQUFBO0lBQ2pCLHdFQUFZLENBQUE7QUFDZCxDQUFDLEVBaEJXLHFCQUFxQixHQUFyQiw2QkFBcUIsS0FBckIsNkJBQXFCLFFBZ0JoQztBQUVELDJGQUEyRjtBQUMzRixtREFBbUQ7QUFDdEMsUUFBQSxnQ0FBZ0MsR0FBeUM7SUFDcEYsUUFBUSxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsQ0FBQztJQUNqQyxRQUFRLEVBQUUsQ0FBQyxXQUFXLEVBQUUsUUFBUSxDQUFDO0lBQ2pDLGNBQWMsRUFBRSxDQUFDLGFBQWEsRUFBRSxRQUFRLENBQUM7SUFDekMsV0FBVyxFQUFFLENBQUMsY0FBYyxFQUFFLFFBQVEsQ0FBQztJQUN2QyxlQUFlLEVBQUUsQ0FBQyxjQUFjLEVBQUUsUUFBUSxDQUFDO0lBQzNDLFVBQVUsRUFBRSxDQUFDLGFBQWEsRUFBRSxTQUFTLENBQUM7SUFDdEMsV0FBVyxFQUFFLENBQUMsZ0NBQWdDLEVBQUUsUUFBUSxDQUFDO0NBQzFELENBQUM7QUFFRiwyRkFBMkY7QUFDM0YsbURBQW1EO0FBQ3RDLFFBQUEsNkJBQTZCLEdBQXlDO0lBQ2pGLGdCQUFnQixFQUFFLENBQUMsa0JBQWtCLEVBQUUsUUFBUSxDQUFDO0lBQ2hELFFBQVEsRUFBRSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUM7SUFDOUIsUUFBUSxFQUFFLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQztJQUM5QixRQUFRLEVBQUUsQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDO0lBQzlCLFNBQVMsRUFBRSxDQUFDLFlBQVksRUFBRSxRQUFRLENBQUM7SUFDbkMsYUFBYSxFQUFFLENBQUMsZ0JBQWdCLEVBQUUsUUFBUSxDQUFDO0lBQzNDLGdCQUFnQixFQUFFLENBQUMsb0JBQW9CLEVBQUUsUUFBUSxDQUFDO0lBQ2xELGVBQWUsRUFBRSxDQUFDLG1CQUFtQixFQUFFLFFBQVEsQ0FBQztJQUNoRCxjQUFjLEVBQUUsQ0FBQyxrQkFBa0IsRUFBRSxRQUFRLENBQUM7SUFDOUMsY0FBYyxFQUFFLENBQUMsa0JBQWtCLEVBQUUsUUFBUSxDQUFDO0lBQzlDLGFBQWEsRUFBRSxDQUFDLGlCQUFpQixFQUFFLFFBQVEsQ0FBQztJQUM1QyxVQUFVLEVBQUUsQ0FBQyxhQUFhLEVBQUUsUUFBUSxDQUFDO0lBQ3JDLFNBQVMsRUFBRSxDQUFDLFlBQVksRUFBRSxRQUFRLENBQUM7SUFDbkMsWUFBWSxFQUFFLENBQUMsZ0JBQWdCLEVBQUUsUUFBUSxDQUFDO0lBQzFDLE9BQU8sRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLENBQUM7Q0FDakMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5leHBvcnQgKiBmcm9tICcuL2FwaSc7XG5leHBvcnQgKiBmcm9tICcuL2ZvcndhcmRlcic7XG5leHBvcnQgKiBmcm9tICcuL2xvZ2dpbmcnO1xuZXhwb3J0ICogZnJvbSAnLi9tdWx0aSc7XG5leHBvcnQgKiBmcm9tICcuL25vb3AnO1xuXG4vKipcbiAqIE1BS0UgU1VSRSBUTyBLRUVQIFRISVMgSU4gU1lOQyBXSVRIIFRIRSBUQUJMRSBBTkQgQ09OVEVOVCBJTiBgL2RvY3MvZGVzaWduL2FuYWx5dGljcy5tZGAuXG4gKiBXRSBMSVNUIFRIT1NFIERJTUVOU0lPTlMgKEFORCBNT1JFKS5cbiAqXG4gKiBUaGVzZSBjYW5ub3QgYmUgaW4gdGhlaXIgcmVzcGVjdGl2ZSBzY2hlbWEuanNvbiBmaWxlIGJlY2F1c2Ugd2UgZWl0aGVyIGNoYW5nZSB0aGUgdHlwZVxuICogKGUuZy4gLS1idWlsZEV2ZW50TG9nIGlzIHN0cmluZywgYnV0IHdlIHdhbnQgdG8ga25vdyB0aGUgdXNhZ2Ugb2YgaXQsIG5vdCBpdHMgdmFsdWUpLCBvclxuICogc29tZSB2YWxpZGF0aW9uIG5lZWRzIHRvIGJlIGRvbmUgKHdlIGNhbm5vdCByZWNvcmQgbmcgYWRkIC0tY29sbGVjdGlvbiBpZiBpdCdzIG5vdCBtYXJrZWQgYXNcbiAqIGFsbG93ZWQpLlxuICovXG5leHBvcnQgZW51bSBOZ0NsaUFuYWx5dGljc0RpbWVuc2lvbnMge1xuICBDcHVDb3VudCA9IDEsXG4gIENwdVNwZWVkID0gMixcbiAgUmFtSW5HaWdhYnl0ZXMgPSAzLFxuICBOb2RlVmVyc2lvbiA9IDQsXG4gIE5nQWRkQ29sbGVjdGlvbiA9IDYsXG4gIEFvdEVuYWJsZWQgPSA4LFxuICBCdWlsZEVycm9ycyA9IDIwLFxufVxuXG5leHBvcnQgZW51bSBOZ0NsaUFuYWx5dGljc01ldHJpY3Mge1xuICBOZ0NvbXBvbmVudENvdW50ID0gMSxcbiAgVU5VU0VEXzIgPSAyLFxuICBVTlVTRURfMyA9IDMsXG4gIFVOVVNFRF80ID0gNCxcbiAgQnVpbGRUaW1lID0gNSxcbiAgTmdPbkluaXRDb3VudCA9IDYsXG4gIEluaXRpYWxDaHVua1NpemUgPSA3LFxuICBUb3RhbENodW5rQ291bnQgPSA4LFxuICBUb3RhbENodW5rU2l6ZSA9IDksXG4gIExhenlDaHVua0NvdW50ID0gMTAsXG4gIExhenlDaHVua1NpemUgPSAxMSxcbiAgQXNzZXRDb3VudCA9IDEyLFxuICBBc3NldFNpemUgPSAxMyxcbiAgUG9seWZpbGxTaXplID0gMTQsXG4gIENzc1NpemUgPSAxNSxcbn1cblxuLy8gVGhpcyB0YWJsZSBpcyB1c2VkIHdoZW4gZ2VuZXJhdGluZyB0aGUgYW5hbHl0aWNzLm1kIGZpbGUuIEl0IHNob3VsZCBtYXRjaCB0aGUgZW51bSBhYm92ZVxuLy8gb3IgdGhlIHZhbGlkYXRlLXVzZXItYW5hbHl0aWNzIHNjcmlwdCB3aWxsIGZhaWwuXG5leHBvcnQgY29uc3QgTmdDbGlBbmFseXRpY3NEaW1lbnNpb25zRmxhZ0luZm86IHsgW25hbWU6IHN0cmluZ106IFtzdHJpbmcsIHN0cmluZ10gfSA9IHtcbiAgQ3B1Q291bnQ6IFsnQ1BVIENvdW50JywgJ251bWJlciddLFxuICBDcHVTcGVlZDogWydDUFUgU3BlZWQnLCAnbnVtYmVyJ10sXG4gIFJhbUluR2lnYWJ5dGVzOiBbJ1JBTSAoSW4gR0IpJywgJ251bWJlciddLFxuICBOb2RlVmVyc2lvbjogWydOb2RlIFZlcnNpb24nLCAnbnVtYmVyJ10sXG4gIE5nQWRkQ29sbGVjdGlvbjogWyctLWNvbGxlY3Rpb24nLCAnc3RyaW5nJ10sXG4gIEFvdEVuYWJsZWQ6IFsnQU9UIEVuYWJsZWQnLCAnYm9vbGVhbiddLFxuICBCdWlsZEVycm9yczogWydCdWlsZCBFcnJvcnMgKGNvbW1hIHNlcGFyYXRlZCknLCAnc3RyaW5nJ10sXG59O1xuXG4vLyBUaGlzIHRhYmxlIGlzIHVzZWQgd2hlbiBnZW5lcmF0aW5nIHRoZSBhbmFseXRpY3MubWQgZmlsZS4gSXQgc2hvdWxkIG1hdGNoIHRoZSBlbnVtIGFib3ZlXG4vLyBvciB0aGUgdmFsaWRhdGUtdXNlci1hbmFseXRpY3Mgc2NyaXB0IHdpbGwgZmFpbC5cbmV4cG9ydCBjb25zdCBOZ0NsaUFuYWx5dGljc01ldHJpY3NGbGFnSW5mbzogeyBbbmFtZTogc3RyaW5nXTogW3N0cmluZywgc3RyaW5nXSB9ID0ge1xuICBOZ0NvbXBvbmVudENvdW50OiBbJ05nQ29tcG9uZW50Q291bnQnLCAnbnVtYmVyJ10sXG4gIFVOVVNFRF8yOiBbJ1VOVVNFRF8yJywgJ25vbmUnXSxcbiAgVU5VU0VEXzM6IFsnVU5VU0VEXzMnLCAnbm9uZSddLFxuICBVTlVTRURfNDogWydVTlVTRURfNCcsICdub25lJ10sXG4gIEJ1aWxkVGltZTogWydCdWlsZCBUaW1lJywgJ251bWJlciddLFxuICBOZ09uSW5pdENvdW50OiBbJ05nT25Jbml0IENvdW50JywgJ251bWJlciddLFxuICBJbml0aWFsQ2h1bmtTaXplOiBbJ0luaXRpYWwgQ2h1bmsgU2l6ZScsICdudW1iZXInXSxcbiAgVG90YWxDaHVua0NvdW50OiBbJ1RvdGFsIENodW5rIENvdW50JywgJ251bWJlciddLFxuICBUb3RhbENodW5rU2l6ZTogWydUb3RhbCBDaHVuayBTaXplJywgJ251bWJlciddLFxuICBMYXp5Q2h1bmtDb3VudDogWydMYXp5IENodW5rIENvdW50JywgJ251bWJlciddLFxuICBMYXp5Q2h1bmtTaXplOiBbJ0xhenkgQ2h1bmsgU2l6ZScsICdudW1iZXInXSxcbiAgQXNzZXRDb3VudDogWydBc3NldCBDb3VudCcsICdudW1iZXInXSxcbiAgQXNzZXRTaXplOiBbJ0Fzc2V0IFNpemUnLCAnbnVtYmVyJ10sXG4gIFBvbHlmaWxsU2l6ZTogWycgUG9seWZpbGwgU2l6ZScsICdudW1iZXInXSxcbiAgQ3NzU2l6ZTogWycgQ3NzIFNpemUnLCAnbnVtYmVyJ10sXG59O1xuIl19