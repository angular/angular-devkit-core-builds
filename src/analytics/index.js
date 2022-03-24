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
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
    NgCliAnalyticsDimensions[NgCliAnalyticsDimensions["AngularCLIMajorVersion"] = 8] = "AngularCLIMajorVersion";
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
    AngularCLIMajorVersion: ['Angular CLI Major Version', 'string'],
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy9hbmFseXRpY3MvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx3Q0FBc0I7QUFDdEIsOENBQTRCO0FBQzVCLDRDQUEwQjtBQUMxQiwwQ0FBd0I7QUFDeEIseUNBQXVCO0FBRXZCOzs7Ozs7OztHQVFHO0FBQ0gsSUFBWSx3QkFRWDtBQVJELFdBQVksd0JBQXdCO0lBQ2xDLCtFQUFZLENBQUE7SUFDWiwrRUFBWSxDQUFBO0lBQ1osMkZBQWtCLENBQUE7SUFDbEIscUZBQWUsQ0FBQTtJQUNmLDZGQUFtQixDQUFBO0lBQ25CLDJHQUEwQixDQUFBO0lBQzFCLHNGQUFnQixDQUFBO0FBQ2xCLENBQUMsRUFSVyx3QkFBd0IsR0FBeEIsZ0NBQXdCLEtBQXhCLGdDQUF3QixRQVFuQztBQUVELElBQVkscUJBZ0JYO0FBaEJELFdBQVkscUJBQXFCO0lBQy9CLHlGQUFvQixDQUFBO0lBQ3BCLHlFQUFZLENBQUE7SUFDWix5RUFBWSxDQUFBO0lBQ1oseUVBQVksQ0FBQTtJQUNaLDJFQUFhLENBQUE7SUFDYixtRkFBaUIsQ0FBQTtJQUNqQix5RkFBb0IsQ0FBQTtJQUNwQix1RkFBbUIsQ0FBQTtJQUNuQixxRkFBa0IsQ0FBQTtJQUNsQixzRkFBbUIsQ0FBQTtJQUNuQixvRkFBa0IsQ0FBQTtJQUNsQiw4RUFBZSxDQUFBO0lBQ2YsNEVBQWMsQ0FBQTtJQUNkLGtGQUFpQixDQUFBO0lBQ2pCLHdFQUFZLENBQUE7QUFDZCxDQUFDLEVBaEJXLHFCQUFxQixHQUFyQiw2QkFBcUIsS0FBckIsNkJBQXFCLFFBZ0JoQztBQUVELDJGQUEyRjtBQUMzRixtREFBbUQ7QUFDdEMsUUFBQSxnQ0FBZ0MsR0FBeUM7SUFDcEYsUUFBUSxFQUFFLENBQUMsV0FBVyxFQUFFLFFBQVEsQ0FBQztJQUNqQyxRQUFRLEVBQUUsQ0FBQyxXQUFXLEVBQUUsUUFBUSxDQUFDO0lBQ2pDLGNBQWMsRUFBRSxDQUFDLGFBQWEsRUFBRSxRQUFRLENBQUM7SUFDekMsV0FBVyxFQUFFLENBQUMsY0FBYyxFQUFFLFFBQVEsQ0FBQztJQUN2QyxlQUFlLEVBQUUsQ0FBQyxjQUFjLEVBQUUsUUFBUSxDQUFDO0lBQzNDLHNCQUFzQixFQUFFLENBQUMsMkJBQTJCLEVBQUUsUUFBUSxDQUFDO0lBQy9ELFdBQVcsRUFBRSxDQUFDLGdDQUFnQyxFQUFFLFFBQVEsQ0FBQztDQUMxRCxDQUFDO0FBRUYsMkZBQTJGO0FBQzNGLG1EQUFtRDtBQUN0QyxRQUFBLDZCQUE2QixHQUF5QztJQUNqRixnQkFBZ0IsRUFBRSxDQUFDLGtCQUFrQixFQUFFLFFBQVEsQ0FBQztJQUNoRCxRQUFRLEVBQUUsQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDO0lBQzlCLFFBQVEsRUFBRSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUM7SUFDOUIsUUFBUSxFQUFFLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQztJQUM5QixTQUFTLEVBQUUsQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDO0lBQ25DLGFBQWEsRUFBRSxDQUFDLGdCQUFnQixFQUFFLFFBQVEsQ0FBQztJQUMzQyxnQkFBZ0IsRUFBRSxDQUFDLG9CQUFvQixFQUFFLFFBQVEsQ0FBQztJQUNsRCxlQUFlLEVBQUUsQ0FBQyxtQkFBbUIsRUFBRSxRQUFRLENBQUM7SUFDaEQsY0FBYyxFQUFFLENBQUMsa0JBQWtCLEVBQUUsUUFBUSxDQUFDO0lBQzlDLGNBQWMsRUFBRSxDQUFDLGtCQUFrQixFQUFFLFFBQVEsQ0FBQztJQUM5QyxhQUFhLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRSxRQUFRLENBQUM7SUFDNUMsVUFBVSxFQUFFLENBQUMsYUFBYSxFQUFFLFFBQVEsQ0FBQztJQUNyQyxTQUFTLEVBQUUsQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDO0lBQ25DLFlBQVksRUFBRSxDQUFDLGdCQUFnQixFQUFFLFFBQVEsQ0FBQztJQUMxQyxPQUFPLEVBQUUsQ0FBQyxXQUFXLEVBQUUsUUFBUSxDQUFDO0NBQ2pDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuZXhwb3J0ICogZnJvbSAnLi9hcGknO1xuZXhwb3J0ICogZnJvbSAnLi9mb3J3YXJkZXInO1xuZXhwb3J0ICogZnJvbSAnLi9sb2dnaW5nJztcbmV4cG9ydCAqIGZyb20gJy4vbXVsdGknO1xuZXhwb3J0ICogZnJvbSAnLi9ub29wJztcblxuLyoqXG4gKiBNQUtFIFNVUkUgVE8gS0VFUCBUSElTIElOIFNZTkMgV0lUSCBUSEUgVEFCTEUgQU5EIENPTlRFTlQgSU4gYC9kb2NzL2Rlc2lnbi9hbmFseXRpY3MubWRgLlxuICogV0UgTElTVCBUSE9TRSBESU1FTlNJT05TIChBTkQgTU9SRSkuXG4gKlxuICogVGhlc2UgY2Fubm90IGJlIGluIHRoZWlyIHJlc3BlY3RpdmUgc2NoZW1hLmpzb24gZmlsZSBiZWNhdXNlIHdlIGVpdGhlciBjaGFuZ2UgdGhlIHR5cGVcbiAqIChlLmcuIC0tYnVpbGRFdmVudExvZyBpcyBzdHJpbmcsIGJ1dCB3ZSB3YW50IHRvIGtub3cgdGhlIHVzYWdlIG9mIGl0LCBub3QgaXRzIHZhbHVlKSwgb3JcbiAqIHNvbWUgdmFsaWRhdGlvbiBuZWVkcyB0byBiZSBkb25lICh3ZSBjYW5ub3QgcmVjb3JkIG5nIGFkZCAtLWNvbGxlY3Rpb24gaWYgaXQncyBub3QgbWFya2VkIGFzXG4gKiBhbGxvd2VkKS5cbiAqL1xuZXhwb3J0IGVudW0gTmdDbGlBbmFseXRpY3NEaW1lbnNpb25zIHtcbiAgQ3B1Q291bnQgPSAxLFxuICBDcHVTcGVlZCA9IDIsXG4gIFJhbUluR2lnYWJ5dGVzID0gMyxcbiAgTm9kZVZlcnNpb24gPSA0LFxuICBOZ0FkZENvbGxlY3Rpb24gPSA2LFxuICBBbmd1bGFyQ0xJTWFqb3JWZXJzaW9uID0gOCxcbiAgQnVpbGRFcnJvcnMgPSAyMCxcbn1cblxuZXhwb3J0IGVudW0gTmdDbGlBbmFseXRpY3NNZXRyaWNzIHtcbiAgTmdDb21wb25lbnRDb3VudCA9IDEsXG4gIFVOVVNFRF8yID0gMixcbiAgVU5VU0VEXzMgPSAzLFxuICBVTlVTRURfNCA9IDQsXG4gIEJ1aWxkVGltZSA9IDUsXG4gIE5nT25Jbml0Q291bnQgPSA2LFxuICBJbml0aWFsQ2h1bmtTaXplID0gNyxcbiAgVG90YWxDaHVua0NvdW50ID0gOCxcbiAgVG90YWxDaHVua1NpemUgPSA5LFxuICBMYXp5Q2h1bmtDb3VudCA9IDEwLFxuICBMYXp5Q2h1bmtTaXplID0gMTEsXG4gIEFzc2V0Q291bnQgPSAxMixcbiAgQXNzZXRTaXplID0gMTMsXG4gIFBvbHlmaWxsU2l6ZSA9IDE0LFxuICBDc3NTaXplID0gMTUsXG59XG5cbi8vIFRoaXMgdGFibGUgaXMgdXNlZCB3aGVuIGdlbmVyYXRpbmcgdGhlIGFuYWx5dGljcy5tZCBmaWxlLiBJdCBzaG91bGQgbWF0Y2ggdGhlIGVudW0gYWJvdmVcbi8vIG9yIHRoZSB2YWxpZGF0ZS11c2VyLWFuYWx5dGljcyBzY3JpcHQgd2lsbCBmYWlsLlxuZXhwb3J0IGNvbnN0IE5nQ2xpQW5hbHl0aWNzRGltZW5zaW9uc0ZsYWdJbmZvOiB7IFtuYW1lOiBzdHJpbmddOiBbc3RyaW5nLCBzdHJpbmddIH0gPSB7XG4gIENwdUNvdW50OiBbJ0NQVSBDb3VudCcsICdudW1iZXInXSxcbiAgQ3B1U3BlZWQ6IFsnQ1BVIFNwZWVkJywgJ251bWJlciddLFxuICBSYW1JbkdpZ2FieXRlczogWydSQU0gKEluIEdCKScsICdudW1iZXInXSxcbiAgTm9kZVZlcnNpb246IFsnTm9kZSBWZXJzaW9uJywgJ251bWJlciddLFxuICBOZ0FkZENvbGxlY3Rpb246IFsnLS1jb2xsZWN0aW9uJywgJ3N0cmluZyddLFxuICBBbmd1bGFyQ0xJTWFqb3JWZXJzaW9uOiBbJ0FuZ3VsYXIgQ0xJIE1ham9yIFZlcnNpb24nLCAnc3RyaW5nJ10sXG4gIEJ1aWxkRXJyb3JzOiBbJ0J1aWxkIEVycm9ycyAoY29tbWEgc2VwYXJhdGVkKScsICdzdHJpbmcnXSxcbn07XG5cbi8vIFRoaXMgdGFibGUgaXMgdXNlZCB3aGVuIGdlbmVyYXRpbmcgdGhlIGFuYWx5dGljcy5tZCBmaWxlLiBJdCBzaG91bGQgbWF0Y2ggdGhlIGVudW0gYWJvdmVcbi8vIG9yIHRoZSB2YWxpZGF0ZS11c2VyLWFuYWx5dGljcyBzY3JpcHQgd2lsbCBmYWlsLlxuZXhwb3J0IGNvbnN0IE5nQ2xpQW5hbHl0aWNzTWV0cmljc0ZsYWdJbmZvOiB7IFtuYW1lOiBzdHJpbmddOiBbc3RyaW5nLCBzdHJpbmddIH0gPSB7XG4gIE5nQ29tcG9uZW50Q291bnQ6IFsnTmdDb21wb25lbnRDb3VudCcsICdudW1iZXInXSxcbiAgVU5VU0VEXzI6IFsnVU5VU0VEXzInLCAnbm9uZSddLFxuICBVTlVTRURfMzogWydVTlVTRURfMycsICdub25lJ10sXG4gIFVOVVNFRF80OiBbJ1VOVVNFRF80JywgJ25vbmUnXSxcbiAgQnVpbGRUaW1lOiBbJ0J1aWxkIFRpbWUnLCAnbnVtYmVyJ10sXG4gIE5nT25Jbml0Q291bnQ6IFsnTmdPbkluaXQgQ291bnQnLCAnbnVtYmVyJ10sXG4gIEluaXRpYWxDaHVua1NpemU6IFsnSW5pdGlhbCBDaHVuayBTaXplJywgJ251bWJlciddLFxuICBUb3RhbENodW5rQ291bnQ6IFsnVG90YWwgQ2h1bmsgQ291bnQnLCAnbnVtYmVyJ10sXG4gIFRvdGFsQ2h1bmtTaXplOiBbJ1RvdGFsIENodW5rIFNpemUnLCAnbnVtYmVyJ10sXG4gIExhenlDaHVua0NvdW50OiBbJ0xhenkgQ2h1bmsgQ291bnQnLCAnbnVtYmVyJ10sXG4gIExhenlDaHVua1NpemU6IFsnTGF6eSBDaHVuayBTaXplJywgJ251bWJlciddLFxuICBBc3NldENvdW50OiBbJ0Fzc2V0IENvdW50JywgJ251bWJlciddLFxuICBBc3NldFNpemU6IFsnQXNzZXQgU2l6ZScsICdudW1iZXInXSxcbiAgUG9seWZpbGxTaXplOiBbJyBQb2x5ZmlsbCBTaXplJywgJ251bWJlciddLFxuICBDc3NTaXplOiBbJyBDc3MgU2l6ZScsICdudW1iZXInXSxcbn07XG4iXX0=