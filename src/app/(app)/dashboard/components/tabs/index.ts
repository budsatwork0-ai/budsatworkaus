// Composite tabs (new grouped structure)
export { default as TodayTab }     from './TodayTab';
export { default as MoneyTab }     from './MoneyTab';
export { default as AnalyticsTab } from './AnalyticsTab';

// Leaf tabs (still imported directly by composite tabs)
export { default as ScheduleTab }    from './ScheduleTab';
export { default as DispatchTab }    from './DispatchTab';
export { default as OverviewTab }    from './OverviewTab';
export { default as ReceivablesTab } from './ReceivablesTab';
export { default as PayablesTab }    from './PayablesTab';
export { default as JobsTab }        from './JobsTab';
export { default as ReportsTab }     from './ReportsTab';
// VisitorsTab is heavy (charts + live data) — import via next/dynamic at the call site
