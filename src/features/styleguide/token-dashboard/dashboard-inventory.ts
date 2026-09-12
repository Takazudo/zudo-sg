/**
 * Measured SSR inventory for the three declared-defaults dashboards.
 *
 * Keep these values in sync with the rows emitted by zdtp's `include` filters.
 * They are shared by the dashboard unit test and the tokens-dashboard e2e so
 * those checks use one measured source of truth.
 */
export const UI_DASHBOARD_TOKEN_COUNT = 102;
export const UI_DASHBOARD_MODE_DEPENDENT_COUNT = 15;
export const UI_DASHBOARD_MODE_INDEPENDENT_COUNT = 87;

if (
  UI_DASHBOARD_MODE_DEPENDENT_COUNT + UI_DASHBOARD_MODE_INDEPENDENT_COUNT !==
  UI_DASHBOARD_TOKEN_COUNT
) {
  throw new Error(
    "UI dashboard inventory counts must add up to the total token count",
  );
}
