// FORK-LOCAL: upstream hardcodes a 60-day window. Made configurable via
// MEAL_PLAN_HISTORY_DAYS so a self-hosted instance can keep full history.
// Set to 0 (or a negative value) to disable the window entirely.
// Upstream default of 60 is preserved when the variable is unset.
// Revert to upstream: `export const MEAL_PLAN_HISTORY_DAYS = 60;` and drop the
// `undefined` branch below, restoring the `(): Date` return type.
const parsedHistoryDays = parseInt(
  process.env.MEAL_PLAN_HISTORY_DAYS || "60",
  10,
);

export const MEAL_PLAN_HISTORY_DAYS = Number.isNaN(parsedHistoryDays)
  ? 60
  : parsedHistoryDays;

/**
 * The oldest `scheduledDate` a meal plan query should return, or `undefined` to
 * apply no lower bound. Prisma omits a `gte` filter whose value is `undefined`,
 * so callers can pass the result through unchanged.
 */
export const getMealPlanHistoryDateLimit = (): Date | undefined => {
  if (MEAL_PLAN_HISTORY_DAYS <= 0) return undefined;

  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - MEAL_PLAN_HISTORY_DAYS);
  return dateLimit;
};
