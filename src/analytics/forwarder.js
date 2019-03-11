"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
            options: Object.assign({}, options),
        });
    }
    screenview(screenName, appName, options) {
        this._fn({
            kind: AnalyticsReportKind.Screenview,
            screenName,
            appName,
            options: Object.assign({}, options),
        });
    }
    pageview(path, options) {
        this._fn({
            kind: AnalyticsReportKind.Pageview,
            path,
            options: Object.assign({}, options),
        });
    }
    timing(category, variable, time, options) {
        this._fn({
            kind: AnalyticsReportKind.Timing,
            category,
            variable,
            time,
            options: Object.assign({}, options),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9yd2FyZGVyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy9hbmFseXRpY3MvZm9yd2FyZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBV0EsSUFBWSxtQkFLWDtBQUxELFdBQVksbUJBQW1CO0lBQzdCLHNDQUFlLENBQUE7SUFDZixnREFBeUIsQ0FBQTtJQUN6Qiw0Q0FBcUIsQ0FBQTtJQUNyQix3Q0FBaUIsQ0FBQTtBQUNuQixDQUFDLEVBTFcsbUJBQW1CLEdBQW5CLDJCQUFtQixLQUFuQiwyQkFBbUIsUUFLOUI7QUE0Q0Q7Ozs7R0FJRztBQUNILE1BQWEsbUJBQW1CO0lBQzlCLFlBQXNCLEdBQXlCO1FBQXpCLFFBQUcsR0FBSCxHQUFHLENBQXNCO0lBQUcsQ0FBQztJQUVuRCxLQUFLLENBQUMsUUFBZ0IsRUFBRSxNQUFjLEVBQUUsT0FBc0I7UUFDNUQsSUFBSSxDQUFDLEdBQUcsQ0FBQztZQUNQLElBQUksRUFBRSxtQkFBbUIsQ0FBQyxLQUFLO1lBQy9CLFFBQVE7WUFDUixNQUFNO1lBQ04sT0FBTyxFQUFFLGtCQUFLLE9BQU8sQ0FBZ0I7U0FDdEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUNELFVBQVUsQ0FBQyxVQUFrQixFQUFFLE9BQWUsRUFBRSxPQUEyQjtRQUN6RSxJQUFJLENBQUMsR0FBRyxDQUFDO1lBQ1AsSUFBSSxFQUFFLG1CQUFtQixDQUFDLFVBQVU7WUFDcEMsVUFBVTtZQUNWLE9BQU87WUFDUCxPQUFPLEVBQUUsa0JBQUssT0FBTyxDQUFnQjtTQUN0QyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBQ0QsUUFBUSxDQUFDLElBQVksRUFBRSxPQUF5QjtRQUM5QyxJQUFJLENBQUMsR0FBRyxDQUFDO1lBQ1AsSUFBSSxFQUFFLG1CQUFtQixDQUFDLFFBQVE7WUFDbEMsSUFBSTtZQUNKLE9BQU8sRUFBRSxrQkFBSyxPQUFPLENBQWdCO1NBQ3RDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFDRCxNQUFNLENBQUMsUUFBZ0IsRUFBRSxRQUFnQixFQUFFLElBQXFCLEVBQUUsT0FBdUI7UUFDdkYsSUFBSSxDQUFDLEdBQUcsQ0FBQztZQUNQLElBQUksRUFBRSxtQkFBbUIsQ0FBQyxNQUFNO1lBQ2hDLFFBQVE7WUFDUixRQUFRO1lBQ1IsSUFBSTtZQUNKLE9BQU8sRUFBRSxrQkFBSyxPQUFPLENBQWdCO1NBQ3RDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCw4QkFBOEI7SUFDOUIsS0FBSztRQUNILE9BQU8sT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQzNCLENBQUM7Q0FDRjtBQXhDRCxrREF3Q0M7QUFHRCxNQUFhLGlCQUFpQjtJQUM1QixZQUFzQixVQUFxQjtRQUFyQixlQUFVLEdBQVYsVUFBVSxDQUFXO0lBQUcsQ0FBQztJQUUvQyxNQUFNLENBQUMsTUFBdUI7UUFDNUIsUUFBUSxNQUFNLENBQUMsSUFBSSxFQUFFO1lBQ25CLEtBQUssbUJBQW1CLENBQUMsS0FBSztnQkFDNUIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDdEUsTUFBTTtZQUNSLEtBQUssbUJBQW1CLENBQUMsVUFBVTtnQkFDakMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDOUUsTUFBTTtZQUNSLEtBQUssbUJBQW1CLENBQUMsUUFBUTtnQkFDL0IsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ3RELE1BQU07WUFDUixLQUFLLG1CQUFtQixDQUFDLE1BQU07Z0JBQzdCLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDdEYsTUFBTTtZQUVSO2dCQUNFLE1BQU0sSUFBSSxLQUFLLENBQUMsK0JBQStCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1NBQzdFO0lBQ0gsQ0FBQztDQUNGO0FBdEJELDhDQXNCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IEpzb25PYmplY3QgfSBmcm9tICcuLi9qc29uJztcbmltcG9ydCB7IEFuYWx5dGljcywgRXZlbnRPcHRpb25zLCBQYWdldmlld09wdGlvbnMsIFNjcmVlbnZpZXdPcHRpb25zLCBUaW1pbmdPcHRpb25zIH0gZnJvbSAnLi9hcGknO1xuXG5cbmV4cG9ydCBlbnVtIEFuYWx5dGljc1JlcG9ydEtpbmQge1xuICBFdmVudCA9ICdldmVudCcsXG4gIFNjcmVlbnZpZXcgPSAnc2NyZWVudmlldycsXG4gIFBhZ2V2aWV3ID0gJ3BhZ2V2aWV3JyxcbiAgVGltaW5nID0gJ3RpbWluZycsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQW5hbHl0aWNzUmVwb3J0QmFzZSBleHRlbmRzIEpzb25PYmplY3Qge1xuICBraW5kOiBBbmFseXRpY3NSZXBvcnRLaW5kO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFuYWx5dGljc1JlcG9ydEV2ZW50IGV4dGVuZHMgQW5hbHl0aWNzUmVwb3J0QmFzZSB7XG4gIGtpbmQ6IEFuYWx5dGljc1JlcG9ydEtpbmQuRXZlbnQ7XG4gIG9wdGlvbnM6IEpzb25PYmplY3QgJiBFdmVudE9wdGlvbnM7XG4gIGNhdGVnb3J5OiBzdHJpbmc7XG4gIGFjdGlvbjogc3RyaW5nO1xufVxuZXhwb3J0IGludGVyZmFjZSBBbmFseXRpY3NSZXBvcnRTY3JlZW52aWV3IGV4dGVuZHMgQW5hbHl0aWNzUmVwb3J0QmFzZSB7XG4gIGtpbmQ6IEFuYWx5dGljc1JlcG9ydEtpbmQuU2NyZWVudmlldztcbiAgb3B0aW9uczogSnNvbk9iamVjdCAmIFNjcmVlbnZpZXdPcHRpb25zO1xuICBzY3JlZW5OYW1lOiBzdHJpbmc7XG4gIGFwcE5hbWU6IHN0cmluZztcbn1cbmV4cG9ydCBpbnRlcmZhY2UgQW5hbHl0aWNzUmVwb3J0UGFnZXZpZXcgZXh0ZW5kcyBBbmFseXRpY3NSZXBvcnRCYXNlIHtcbiAga2luZDogQW5hbHl0aWNzUmVwb3J0S2luZC5QYWdldmlldztcbiAgb3B0aW9uczogSnNvbk9iamVjdCAmIFBhZ2V2aWV3T3B0aW9ucztcbiAgcGF0aDogc3RyaW5nO1xufVxuZXhwb3J0IGludGVyZmFjZSBBbmFseXRpY3NSZXBvcnRUaW1pbmcgZXh0ZW5kcyBBbmFseXRpY3NSZXBvcnRCYXNlIHtcbiAga2luZDogQW5hbHl0aWNzUmVwb3J0S2luZC5UaW1pbmc7XG4gIG9wdGlvbnM6IEpzb25PYmplY3QgJiBUaW1pbmdPcHRpb25zO1xuICBjYXRlZ29yeTogc3RyaW5nO1xuICB2YXJpYWJsZTogc3RyaW5nO1xuICB0aW1lOiBzdHJpbmcgfCBudW1iZXI7XG59XG5cbmV4cG9ydCB0eXBlIEFuYWx5dGljc1JlcG9ydCA9XG4gIEFuYWx5dGljc1JlcG9ydEV2ZW50XG4gIHwgQW5hbHl0aWNzUmVwb3J0U2NyZWVudmlld1xuICB8IEFuYWx5dGljc1JlcG9ydFBhZ2V2aWV3XG4gIHwgQW5hbHl0aWNzUmVwb3J0VGltaW5nXG4gIDtcblxuLyoqXG4gKiBBIGZ1bmN0aW9uIHRoYXQgY2FuIGZvcndhcmQgYW5hbHl0aWNzIGFsb25nIHNvbWUgc3RyZWFtLiBBbmFseXRpY3NSZXBvcnQgaXMgYWxyZWFkeSBhXG4gKiBKc29uT2JqZWN0IGRlc2NlbmRhbnQsIGJ1dCB3ZSBmb3JjZSBpdCBoZXJlIHNvIHRoZSB1c2VyIGtub3dzIGl0J3Mgc2FmZSB0byBzZXJpYWxpemUuXG4gKi9cbmV4cG9ydCB0eXBlIEFuYWx5dGljc0ZvcndhcmRlckZuID0gKHJlcG9ydDogSnNvbk9iamVjdCAmIEFuYWx5dGljc1JlcG9ydCkgPT4gdm9pZDtcblxuLyoqXG4gKiBBIGNsYXNzIHRoYXQgZm9sbG93cyB0aGUgQW5hbHl0aWNzIGludGVyZmFjZSBhbmQgZm9yd2FyZHMgYW5hbHl0aWMgcmVwb3J0cyAoSmF2YVNjcmlwdCBvYmplY3RzKS5cbiAqIEFuYWx5dGljc1JlcG9ydGVyIGlzIHRoZSBjb3VudGVycGFydCB3aGljaCB0YWtlcyBhbmFseXRpYyByZXBvcnRzIGFuZCByZXBvcnQgdGhlbSB0byBhbm90aGVyXG4gKiBBbmFseXRpY3MgaW50ZXJmYWNlLlxuICovXG5leHBvcnQgY2xhc3MgRm9yd2FyZGluZ0FuYWx5dGljcyBpbXBsZW1lbnRzIEFuYWx5dGljcyB7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCBfZm46IEFuYWx5dGljc0ZvcndhcmRlckZuKSB7fVxuXG4gIGV2ZW50KGNhdGVnb3J5OiBzdHJpbmcsIGFjdGlvbjogc3RyaW5nLCBvcHRpb25zPzogRXZlbnRPcHRpb25zKSB7XG4gICAgdGhpcy5fZm4oe1xuICAgICAga2luZDogQW5hbHl0aWNzUmVwb3J0S2luZC5FdmVudCxcbiAgICAgIGNhdGVnb3J5LFxuICAgICAgYWN0aW9uLFxuICAgICAgb3B0aW9uczogeyAuLi5vcHRpb25zIH0gYXMgSnNvbk9iamVjdCxcbiAgICB9KTtcbiAgfVxuICBzY3JlZW52aWV3KHNjcmVlbk5hbWU6IHN0cmluZywgYXBwTmFtZTogc3RyaW5nLCBvcHRpb25zPzogU2NyZWVudmlld09wdGlvbnMpIHtcbiAgICB0aGlzLl9mbih7XG4gICAgICBraW5kOiBBbmFseXRpY3NSZXBvcnRLaW5kLlNjcmVlbnZpZXcsXG4gICAgICBzY3JlZW5OYW1lLFxuICAgICAgYXBwTmFtZSxcbiAgICAgIG9wdGlvbnM6IHsgLi4ub3B0aW9ucyB9IGFzIEpzb25PYmplY3QsXG4gICAgfSk7XG4gIH1cbiAgcGFnZXZpZXcocGF0aDogc3RyaW5nLCBvcHRpb25zPzogUGFnZXZpZXdPcHRpb25zKSB7XG4gICAgdGhpcy5fZm4oe1xuICAgICAga2luZDogQW5hbHl0aWNzUmVwb3J0S2luZC5QYWdldmlldyxcbiAgICAgIHBhdGgsXG4gICAgICBvcHRpb25zOiB7IC4uLm9wdGlvbnMgfSBhcyBKc29uT2JqZWN0LFxuICAgIH0pO1xuICB9XG4gIHRpbWluZyhjYXRlZ29yeTogc3RyaW5nLCB2YXJpYWJsZTogc3RyaW5nLCB0aW1lOiBzdHJpbmcgfCBudW1iZXIsIG9wdGlvbnM/OiBUaW1pbmdPcHRpb25zKTogdm9pZCB7XG4gICAgdGhpcy5fZm4oe1xuICAgICAga2luZDogQW5hbHl0aWNzUmVwb3J0S2luZC5UaW1pbmcsXG4gICAgICBjYXRlZ29yeSxcbiAgICAgIHZhcmlhYmxlLFxuICAgICAgdGltZSxcbiAgICAgIG9wdGlvbnM6IHsgLi4ub3B0aW9ucyB9IGFzIEpzb25PYmplY3QsXG4gICAgfSk7XG4gIH1cblxuICAvLyBXZSBkbyBub3Qgc3VwcG9ydCBmbHVzaGluZy5cbiAgZmx1c2goKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIEFuYWx5dGljc1JlcG9ydGVyIHtcbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIF9hbmFseXRpY3M6IEFuYWx5dGljcykge31cblxuICByZXBvcnQocmVwb3J0OiBBbmFseXRpY3NSZXBvcnQpIHtcbiAgICBzd2l0Y2ggKHJlcG9ydC5raW5kKSB7XG4gICAgICBjYXNlIEFuYWx5dGljc1JlcG9ydEtpbmQuRXZlbnQ6XG4gICAgICAgIHRoaXMuX2FuYWx5dGljcy5ldmVudChyZXBvcnQuY2F0ZWdvcnksIHJlcG9ydC5hY3Rpb24sIHJlcG9ydC5vcHRpb25zKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEFuYWx5dGljc1JlcG9ydEtpbmQuU2NyZWVudmlldzpcbiAgICAgICAgdGhpcy5fYW5hbHl0aWNzLnNjcmVlbnZpZXcocmVwb3J0LnNjcmVlbk5hbWUsIHJlcG9ydC5hcHBOYW1lLCByZXBvcnQub3B0aW9ucyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBBbmFseXRpY3NSZXBvcnRLaW5kLlBhZ2V2aWV3OlxuICAgICAgICB0aGlzLl9hbmFseXRpY3MucGFnZXZpZXcocmVwb3J0LnBhdGgsIHJlcG9ydC5vcHRpb25zKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEFuYWx5dGljc1JlcG9ydEtpbmQuVGltaW5nOlxuICAgICAgICB0aGlzLl9hbmFseXRpY3MudGltaW5nKHJlcG9ydC5jYXRlZ29yeSwgcmVwb3J0LnZhcmlhYmxlLCByZXBvcnQudGltZSwgcmVwb3J0Lm9wdGlvbnMpO1xuICAgICAgICBicmVhaztcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGFuYWx5dGljcyByZXBvcnQ6ICcgKyBKU09OLnN0cmluZ2lmeShyZXBvcnQpKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==