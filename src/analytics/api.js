"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvYW5hbHl0aWNzL2FwaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmV4cG9ydCBpbnRlcmZhY2UgQ3VzdG9tRGltZW5zaW9uc0FuZE1ldHJpY3NPcHRpb25zIHtcbiAgZGltZW5zaW9ucz86IChib29sZWFuIHwgbnVtYmVyIHwgc3RyaW5nKVtdO1xuICBtZXRyaWNzPzogKGJvb2xlYW4gfCBudW1iZXIgfCBzdHJpbmcpW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXZlbnRPcHRpb25zIGV4dGVuZHMgQ3VzdG9tRGltZW5zaW9uc0FuZE1ldHJpY3NPcHRpb25zIHtcbiAgbGFiZWw/OiBzdHJpbmc7XG4gIHZhbHVlPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNjcmVlbnZpZXdPcHRpb25zIGV4dGVuZHMgQ3VzdG9tRGltZW5zaW9uc0FuZE1ldHJpY3NPcHRpb25zIHtcbiAgYXBwVmVyc2lvbj86IHN0cmluZztcbiAgYXBwSWQ/OiBzdHJpbmc7XG4gIGFwcEluc3RhbGxlcklkPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBhZ2V2aWV3T3B0aW9ucyBleHRlbmRzIEN1c3RvbURpbWVuc2lvbnNBbmRNZXRyaWNzT3B0aW9ucyB7XG4gIGhvc3RuYW1lPzogc3RyaW5nO1xuICB0aXRsZT86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUaW1pbmdPcHRpb25zIGV4dGVuZHMgQ3VzdG9tRGltZW5zaW9uc0FuZE1ldHJpY3NPcHRpb25zIHtcbiAgbGFiZWw/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogSW50ZXJmYWNlIGZvciBtYW5hZ2luZyBhbmFseXRpY3MuIFRoaXMgaXMgaGlnaGx5IHBsYXRmb3JtIGRlcGVuZGVudCwgYW5kIG1vc3RseSBtYXRjaGVzXG4gKiBHb29nbGUgQW5hbHl0aWNzLiBUaGUgcmVhc29uIHRoZSBpbnRlcmZhY2UgaXMgaGVyZSBpcyB0byByZW1vdmUgdGhlIGRlcGVuZGVuY3kgdG8gYW5cbiAqIGltcGxlbWVudGF0aW9uIGZyb20gbW9zdCBvdGhlciBwbGFjZXMuXG4gKlxuICogVGhlIG1ldGhvZHMgZXhwb3J0ZWQgZnJvbSB0aGlzIGludGVyZmFjZSBtb3JlIG9yIGxlc3MgbWF0Y2ggdGhvc2UgbmVlZGVkIGJ5IHVzIGluIHRoZVxuICogdW5pdmVyc2FsIGFuYWx5dGljcyBwYWNrYWdlLCBzZWUgaHR0cHM6Ly91bnBrZy5jb20vQHR5cGVzL3VuaXZlcnNhbC1hbmFseXRpY3NAMC40LjIvaW5kZXguZC50c1xuICogZm9yIHR5cGluZ3MuIFdlIG1vc3RseSBuYW1lZCBhcmd1bWVudHMgdG8gbWFrZSBpdCBlYXNpZXIgdG8gZm9sbG93LCBidXQgZGlkbid0IGNoYW5nZSBvclxuICogYWRkIGFueSBzZW1hbnRpY3MgdG8gdGhvc2UgbWV0aG9kcy4gVGhleSdyZSBtYXBwaW5nIEdBIGFuZCB1LWEgb25lIGZvciBvbmUuXG4gKlxuICogVGhlIEFuZ3VsYXIgQ0xJIChvciBhbnkgb3RoZXIga2luZCBvZiBiYWNrZW5kKSBzaG91bGQgZm9yd2FyZCBpdCB0byBzb21lIGNvbXBhdGlibGUgYmFja2VuZC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBBbmFseXRpY3Mge1xuICBldmVudChjYXRlZ29yeTogc3RyaW5nLCBhY3Rpb246IHN0cmluZywgb3B0aW9ucz86IEV2ZW50T3B0aW9ucyk6IHZvaWQ7XG4gIHNjcmVlbnZpZXcoc2NyZWVuTmFtZTogc3RyaW5nLCBhcHBOYW1lOiBzdHJpbmcsIG9wdGlvbnM/OiBTY3JlZW52aWV3T3B0aW9ucyk6IHZvaWQ7XG4gIHBhZ2V2aWV3KHBhdGg6IHN0cmluZywgb3B0aW9ucz86IFBhZ2V2aWV3T3B0aW9ucyk6IHZvaWQ7XG4gIHRpbWluZyhjYXRlZ29yeTogc3RyaW5nLCB2YXJpYWJsZTogc3RyaW5nLCB0aW1lOiBzdHJpbmcgfCBudW1iZXIsIG9wdGlvbnM/OiBUaW1pbmdPcHRpb25zKTogdm9pZDtcblxuICBmbHVzaCgpOiBQcm9taXNlPHZvaWQ+O1xufVxuIl19