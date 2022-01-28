"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsReporter = exports.ForwardingAnalytics = exports.AnalyticsReportKind = void 0;
var AnalyticsReportKind;
(function (AnalyticsReportKind) {
    AnalyticsReportKind["Event"] = "event";
    AnalyticsReportKind["Screenview"] = "screenview";
    AnalyticsReportKind["Pageview"] = "pageview";
    AnalyticsReportKind["Timing"] = "timing";
})(AnalyticsReportKind = exports.AnalyticsReportKind || (exports.AnalyticsReportKind = {}));
/**
 * A class that follows the Analytics interface and forwards analytic reports (JavaScript objects).
 * AnalyticsReporter is the counterpart which takes analytic reports and report them to another
 * Analytics interface.
 */
class ForwardingAnalytics {
    constructor(_fn) {
        this._fn = _fn;
    }
    event(category, action, options) {
        this._fn({
            kind: AnalyticsReportKind.Event,
            category,
            action,
            options: { ...options },
        });
    }
    screenview(screenName, appName, options) {
        this._fn({
            kind: AnalyticsReportKind.Screenview,
            screenName,
            appName,
            options: { ...options },
        });
    }
    pageview(path, options) {
        this._fn({
            kind: AnalyticsReportKind.Pageview,
            path,
            options: { ...options },
        });
    }
    timing(category, variable, time, options) {
        this._fn({
            kind: AnalyticsReportKind.Timing,
            category,
            variable,
            time,
            options: { ...options },
        });
    }
    // We do not support flushing.
    flush() {
        return Promise.resolve();
    }
}
exports.ForwardingAnalytics = ForwardingAnalytics;
class AnalyticsReporter {
    constructor(_analytics) {
        this._analytics = _analytics;
    }
    report(report) {
        switch (report.kind) {
            case AnalyticsReportKind.Event:
                this._analytics.event(report.category, report.action, report.options);
                break;
            case AnalyticsReportKind.Screenview:
                this._analytics.screenview(report.screenName, report.appName, report.options);
                break;
            case AnalyticsReportKind.Pageview:
                this._analytics.pageview(report.path, report.options);
                break;
            case AnalyticsReportKind.Timing:
                this._analytics.timing(report.category, report.variable, report.time, report.options);
                break;
            default:
                throw new Error('Unexpected analytics report: ' + JSON.stringify(report));
        }
    }
}
exports.AnalyticsReporter = AnalyticsReporter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9yd2FyZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvYW5hbHl0aWNzL2ZvcndhcmRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFLSCxJQUFZLG1CQUtYO0FBTEQsV0FBWSxtQkFBbUI7SUFDN0Isc0NBQWUsQ0FBQTtJQUNmLGdEQUF5QixDQUFBO0lBQ3pCLDRDQUFxQixDQUFBO0lBQ3JCLHdDQUFpQixDQUFBO0FBQ25CLENBQUMsRUFMVyxtQkFBbUIsR0FBbkIsMkJBQW1CLEtBQW5CLDJCQUFtQixRQUs5QjtBQTJDRDs7OztHQUlHO0FBQ0gsTUFBYSxtQkFBbUI7SUFDOUIsWUFBc0IsR0FBeUI7UUFBekIsUUFBRyxHQUFILEdBQUcsQ0FBc0I7SUFBRyxDQUFDO0lBRW5ELEtBQUssQ0FBQyxRQUFnQixFQUFFLE1BQWMsRUFBRSxPQUFzQjtRQUM1RCxJQUFJLENBQUMsR0FBRyxDQUFDO1lBQ1AsSUFBSSxFQUFFLG1CQUFtQixDQUFDLEtBQUs7WUFDL0IsUUFBUTtZQUNSLE1BQU07WUFDTixPQUFPLEVBQUUsRUFBRSxHQUFHLE9BQU8sRUFBZ0I7U0FDdEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUNELFVBQVUsQ0FBQyxVQUFrQixFQUFFLE9BQWUsRUFBRSxPQUEyQjtRQUN6RSxJQUFJLENBQUMsR0FBRyxDQUFDO1lBQ1AsSUFBSSxFQUFFLG1CQUFtQixDQUFDLFVBQVU7WUFDcEMsVUFBVTtZQUNWLE9BQU87WUFDUCxPQUFPLEVBQUUsRUFBRSxHQUFHLE9BQU8sRUFBZ0I7U0FDdEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUNELFFBQVEsQ0FBQyxJQUFZLEVBQUUsT0FBeUI7UUFDOUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztZQUNQLElBQUksRUFBRSxtQkFBbUIsQ0FBQyxRQUFRO1lBQ2xDLElBQUk7WUFDSixPQUFPLEVBQUUsRUFBRSxHQUFHLE9BQU8sRUFBZ0I7U0FDdEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUNELE1BQU0sQ0FBQyxRQUFnQixFQUFFLFFBQWdCLEVBQUUsSUFBcUIsRUFBRSxPQUF1QjtRQUN2RixJQUFJLENBQUMsR0FBRyxDQUFDO1lBQ1AsSUFBSSxFQUFFLG1CQUFtQixDQUFDLE1BQU07WUFDaEMsUUFBUTtZQUNSLFFBQVE7WUFDUixJQUFJO1lBQ0osT0FBTyxFQUFFLEVBQUUsR0FBRyxPQUFPLEVBQWdCO1NBQ3RDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCw4QkFBOEI7SUFDOUIsS0FBSztRQUNILE9BQU8sT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQzNCLENBQUM7Q0FDRjtBQXhDRCxrREF3Q0M7QUFFRCxNQUFhLGlCQUFpQjtJQUM1QixZQUFzQixVQUFxQjtRQUFyQixlQUFVLEdBQVYsVUFBVSxDQUFXO0lBQUcsQ0FBQztJQUUvQyxNQUFNLENBQUMsTUFBdUI7UUFDNUIsUUFBUSxNQUFNLENBQUMsSUFBSSxFQUFFO1lBQ25CLEtBQUssbUJBQW1CLENBQUMsS0FBSztnQkFDNUIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDdEUsTUFBTTtZQUNSLEtBQUssbUJBQW1CLENBQUMsVUFBVTtnQkFDakMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDOUUsTUFBTTtZQUNSLEtBQUssbUJBQW1CLENBQUMsUUFBUTtnQkFDL0IsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ3RELE1BQU07WUFDUixLQUFLLG1CQUFtQixDQUFDLE1BQU07Z0JBQzdCLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDdEYsTUFBTTtZQUVSO2dCQUNFLE1BQU0sSUFBSSxLQUFLLENBQUMsK0JBQStCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1NBQzdFO0lBQ0gsQ0FBQztDQUNGO0FBdEJELDhDQXNCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBKc29uT2JqZWN0IH0gZnJvbSAnLi4vanNvbic7XG5pbXBvcnQgeyBBbmFseXRpY3MsIEV2ZW50T3B0aW9ucywgUGFnZXZpZXdPcHRpb25zLCBTY3JlZW52aWV3T3B0aW9ucywgVGltaW5nT3B0aW9ucyB9IGZyb20gJy4vYXBpJztcblxuZXhwb3J0IGVudW0gQW5hbHl0aWNzUmVwb3J0S2luZCB7XG4gIEV2ZW50ID0gJ2V2ZW50JyxcbiAgU2NyZWVudmlldyA9ICdzY3JlZW52aWV3JyxcbiAgUGFnZXZpZXcgPSAncGFnZXZpZXcnLFxuICBUaW1pbmcgPSAndGltaW5nJyxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBbmFseXRpY3NSZXBvcnRCYXNlIGV4dGVuZHMgSnNvbk9iamVjdCB7XG4gIGtpbmQ6IEFuYWx5dGljc1JlcG9ydEtpbmQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQW5hbHl0aWNzUmVwb3J0RXZlbnQgZXh0ZW5kcyBBbmFseXRpY3NSZXBvcnRCYXNlIHtcbiAga2luZDogQW5hbHl0aWNzUmVwb3J0S2luZC5FdmVudDtcbiAgb3B0aW9uczogSnNvbk9iamVjdCAmIEV2ZW50T3B0aW9ucztcbiAgY2F0ZWdvcnk6IHN0cmluZztcbiAgYWN0aW9uOiBzdHJpbmc7XG59XG5leHBvcnQgaW50ZXJmYWNlIEFuYWx5dGljc1JlcG9ydFNjcmVlbnZpZXcgZXh0ZW5kcyBBbmFseXRpY3NSZXBvcnRCYXNlIHtcbiAga2luZDogQW5hbHl0aWNzUmVwb3J0S2luZC5TY3JlZW52aWV3O1xuICBvcHRpb25zOiBKc29uT2JqZWN0ICYgU2NyZWVudmlld09wdGlvbnM7XG4gIHNjcmVlbk5hbWU6IHN0cmluZztcbiAgYXBwTmFtZTogc3RyaW5nO1xufVxuZXhwb3J0IGludGVyZmFjZSBBbmFseXRpY3NSZXBvcnRQYWdldmlldyBleHRlbmRzIEFuYWx5dGljc1JlcG9ydEJhc2Uge1xuICBraW5kOiBBbmFseXRpY3NSZXBvcnRLaW5kLlBhZ2V2aWV3O1xuICBvcHRpb25zOiBKc29uT2JqZWN0ICYgUGFnZXZpZXdPcHRpb25zO1xuICBwYXRoOiBzdHJpbmc7XG59XG5leHBvcnQgaW50ZXJmYWNlIEFuYWx5dGljc1JlcG9ydFRpbWluZyBleHRlbmRzIEFuYWx5dGljc1JlcG9ydEJhc2Uge1xuICBraW5kOiBBbmFseXRpY3NSZXBvcnRLaW5kLlRpbWluZztcbiAgb3B0aW9uczogSnNvbk9iamVjdCAmIFRpbWluZ09wdGlvbnM7XG4gIGNhdGVnb3J5OiBzdHJpbmc7XG4gIHZhcmlhYmxlOiBzdHJpbmc7XG4gIHRpbWU6IHN0cmluZyB8IG51bWJlcjtcbn1cblxuZXhwb3J0IHR5cGUgQW5hbHl0aWNzUmVwb3J0ID1cbiAgfCBBbmFseXRpY3NSZXBvcnRFdmVudFxuICB8IEFuYWx5dGljc1JlcG9ydFNjcmVlbnZpZXdcbiAgfCBBbmFseXRpY3NSZXBvcnRQYWdldmlld1xuICB8IEFuYWx5dGljc1JlcG9ydFRpbWluZztcblxuLyoqXG4gKiBBIGZ1bmN0aW9uIHRoYXQgY2FuIGZvcndhcmQgYW5hbHl0aWNzIGFsb25nIHNvbWUgc3RyZWFtLiBBbmFseXRpY3NSZXBvcnQgaXMgYWxyZWFkeSBhXG4gKiBKc29uT2JqZWN0IGRlc2NlbmRhbnQsIGJ1dCB3ZSBmb3JjZSBpdCBoZXJlIHNvIHRoZSB1c2VyIGtub3dzIGl0J3Mgc2FmZSB0byBzZXJpYWxpemUuXG4gKi9cbmV4cG9ydCB0eXBlIEFuYWx5dGljc0ZvcndhcmRlckZuID0gKHJlcG9ydDogSnNvbk9iamVjdCAmIEFuYWx5dGljc1JlcG9ydCkgPT4gdm9pZDtcblxuLyoqXG4gKiBBIGNsYXNzIHRoYXQgZm9sbG93cyB0aGUgQW5hbHl0aWNzIGludGVyZmFjZSBhbmQgZm9yd2FyZHMgYW5hbHl0aWMgcmVwb3J0cyAoSmF2YVNjcmlwdCBvYmplY3RzKS5cbiAqIEFuYWx5dGljc1JlcG9ydGVyIGlzIHRoZSBjb3VudGVycGFydCB3aGljaCB0YWtlcyBhbmFseXRpYyByZXBvcnRzIGFuZCByZXBvcnQgdGhlbSB0byBhbm90aGVyXG4gKiBBbmFseXRpY3MgaW50ZXJmYWNlLlxuICovXG5leHBvcnQgY2xhc3MgRm9yd2FyZGluZ0FuYWx5dGljcyBpbXBsZW1lbnRzIEFuYWx5dGljcyB7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCBfZm46IEFuYWx5dGljc0ZvcndhcmRlckZuKSB7fVxuXG4gIGV2ZW50KGNhdGVnb3J5OiBzdHJpbmcsIGFjdGlvbjogc3RyaW5nLCBvcHRpb25zPzogRXZlbnRPcHRpb25zKSB7XG4gICAgdGhpcy5fZm4oe1xuICAgICAga2luZDogQW5hbHl0aWNzUmVwb3J0S2luZC5FdmVudCxcbiAgICAgIGNhdGVnb3J5LFxuICAgICAgYWN0aW9uLFxuICAgICAgb3B0aW9uczogeyAuLi5vcHRpb25zIH0gYXMgSnNvbk9iamVjdCxcbiAgICB9KTtcbiAgfVxuICBzY3JlZW52aWV3KHNjcmVlbk5hbWU6IHN0cmluZywgYXBwTmFtZTogc3RyaW5nLCBvcHRpb25zPzogU2NyZWVudmlld09wdGlvbnMpIHtcbiAgICB0aGlzLl9mbih7XG4gICAgICBraW5kOiBBbmFseXRpY3NSZXBvcnRLaW5kLlNjcmVlbnZpZXcsXG4gICAgICBzY3JlZW5OYW1lLFxuICAgICAgYXBwTmFtZSxcbiAgICAgIG9wdGlvbnM6IHsgLi4ub3B0aW9ucyB9IGFzIEpzb25PYmplY3QsXG4gICAgfSk7XG4gIH1cbiAgcGFnZXZpZXcocGF0aDogc3RyaW5nLCBvcHRpb25zPzogUGFnZXZpZXdPcHRpb25zKSB7XG4gICAgdGhpcy5fZm4oe1xuICAgICAga2luZDogQW5hbHl0aWNzUmVwb3J0S2luZC5QYWdldmlldyxcbiAgICAgIHBhdGgsXG4gICAgICBvcHRpb25zOiB7IC4uLm9wdGlvbnMgfSBhcyBKc29uT2JqZWN0LFxuICAgIH0pO1xuICB9XG4gIHRpbWluZyhjYXRlZ29yeTogc3RyaW5nLCB2YXJpYWJsZTogc3RyaW5nLCB0aW1lOiBzdHJpbmcgfCBudW1iZXIsIG9wdGlvbnM/OiBUaW1pbmdPcHRpb25zKTogdm9pZCB7XG4gICAgdGhpcy5fZm4oe1xuICAgICAga2luZDogQW5hbHl0aWNzUmVwb3J0S2luZC5UaW1pbmcsXG4gICAgICBjYXRlZ29yeSxcbiAgICAgIHZhcmlhYmxlLFxuICAgICAgdGltZSxcbiAgICAgIG9wdGlvbnM6IHsgLi4ub3B0aW9ucyB9IGFzIEpzb25PYmplY3QsXG4gICAgfSk7XG4gIH1cblxuICAvLyBXZSBkbyBub3Qgc3VwcG9ydCBmbHVzaGluZy5cbiAgZmx1c2goKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBBbmFseXRpY3NSZXBvcnRlciB7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCBfYW5hbHl0aWNzOiBBbmFseXRpY3MpIHt9XG5cbiAgcmVwb3J0KHJlcG9ydDogQW5hbHl0aWNzUmVwb3J0KSB7XG4gICAgc3dpdGNoIChyZXBvcnQua2luZCkge1xuICAgICAgY2FzZSBBbmFseXRpY3NSZXBvcnRLaW5kLkV2ZW50OlxuICAgICAgICB0aGlzLl9hbmFseXRpY3MuZXZlbnQocmVwb3J0LmNhdGVnb3J5LCByZXBvcnQuYWN0aW9uLCByZXBvcnQub3B0aW9ucyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBBbmFseXRpY3NSZXBvcnRLaW5kLlNjcmVlbnZpZXc6XG4gICAgICAgIHRoaXMuX2FuYWx5dGljcy5zY3JlZW52aWV3KHJlcG9ydC5zY3JlZW5OYW1lLCByZXBvcnQuYXBwTmFtZSwgcmVwb3J0Lm9wdGlvbnMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQW5hbHl0aWNzUmVwb3J0S2luZC5QYWdldmlldzpcbiAgICAgICAgdGhpcy5fYW5hbHl0aWNzLnBhZ2V2aWV3KHJlcG9ydC5wYXRoLCByZXBvcnQub3B0aW9ucyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBBbmFseXRpY3NSZXBvcnRLaW5kLlRpbWluZzpcbiAgICAgICAgdGhpcy5fYW5hbHl0aWNzLnRpbWluZyhyZXBvcnQuY2F0ZWdvcnksIHJlcG9ydC52YXJpYWJsZSwgcmVwb3J0LnRpbWUsIHJlcG9ydC5vcHRpb25zKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBhbmFseXRpY3MgcmVwb3J0OiAnICsgSlNPTi5zdHJpbmdpZnkocmVwb3J0KSk7XG4gICAgfVxuICB9XG59XG4iXX0=