"use client";

import { useState, useMemo } from "react";
import dayjs, { type Dayjs } from "dayjs";

export type FilterPreset =
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "last_12_months"
  | "last_3_years"
  | "custom_month"
  | "custom_year";

export interface DateFilterState {
  preset: FilterPreset;
  customMonth: Dayjs | null;
  customYear: number | null;
}

/** Used for monthly-granularity chart axes */
export interface MonthBucket {
  key: string;   // YYYY-MM
  label: string; // "Jan" | "Jan 25"
}

/** Used for daily-granularity chart axes */
export interface DayBucket {
  key: string;   // YYYY-MM-DD
  label: string; // "1 Apr" … "22 Apr"
}

export interface DateRange {
  startDate: string;                    // YYYY-MM-DD
  endDate: string;                      // YYYY-MM-DD  (today for "this_month")
  label: string;
  granularity: "day" | "month";
  /** Populated when granularity === "day" */
  dayBuckets: DayBucket[];
  /** Populated when granularity === "month" */
  monthBuckets: MonthBucket[];
  multiYear: boolean;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function buildDayBuckets(from: Dayjs, to: Dayjs): DayBucket[] {
  const buckets: DayBucket[] = [];
  let cursor = from.startOf("day");
  const end = to.startOf("day");
  while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
    buckets.push({
      key: cursor.format("YYYY-MM-DD"),
      label: cursor.format("D MMM"),   // "1 Apr", "22 Apr"
    });
    cursor = cursor.add(1, "day");
  }
  return buckets;
}

function buildMonthBuckets(from: Dayjs, to: Dayjs, multiYear: boolean): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  let cursor = from.startOf("month");
  const end = to.startOf("month");
  while (cursor.isBefore(end) || cursor.isSame(end, "month")) {
    buckets.push({
      key: cursor.format("YYYY-MM"),
      label: multiYear ? cursor.format("MMM YY") : cursor.format("MMM"),
    });
    cursor = cursor.add(1, "month");
  }
  return buckets;
}

// ─── main calculator ─────────────────────────────────────────────────────────

function calcRange(state: DateFilterState): DateRange {
  const now = dayjs();

  switch (state.preset) {
    case "this_month": {
      // startDate = first of current month, endDate = TODAY (not end of month)
      const start = now.startOf("month");
      const end = now;                          // ← today, not endOf("month")
      return {
        startDate: start.format("YYYY-MM-DD"),
        endDate: end.format("YYYY-MM-DD"),
        label: now.format("MMM YYYY"),
        granularity: "day",
        dayBuckets: buildDayBuckets(start, end),
        monthBuckets: [],
        multiYear: false,
      };
    }

    case "last_month": {
      // startDate = first of previous month, endDate = last day of previous month
      const lm = now.subtract(1, "month");
      const start = lm.startOf("month");
      const end = lm.endOf("month");
      return {
        startDate: start.format("YYYY-MM-DD"),
        endDate: end.format("YYYY-MM-DD"),
        label: lm.format("MMM YYYY"),
        granularity: "day",
        dayBuckets: buildDayBuckets(start, end),
        monthBuckets: [],
        multiYear: false,
      };
    }

    case "last_3_months": {
      const start = now.subtract(2, "month").startOf("month");
      return {
        startDate: start.format("YYYY-MM-DD"),
        endDate: now.format("YYYY-MM-DD"),
        label: "Last 3 Months",
        granularity: "month",
        dayBuckets: [],
        monthBuckets: buildMonthBuckets(start, now, false),
        multiYear: false,
      };
    }

    case "last_12_months": {
      const start = now.subtract(11, "month").startOf("month");
      const multiYear = start.year() !== now.year();
      return {
        startDate: start.format("YYYY-MM-DD"),
        endDate: now.format("YYYY-MM-DD"),
        label: "Last 12 Months",
        granularity: "month",
        dayBuckets: [],
        monthBuckets: buildMonthBuckets(start, now, multiYear),
        multiYear,
      };
    }

    case "last_3_years": {
      const start = now.subtract(2, "year").startOf("year");
      return {
        startDate: start.format("YYYY-MM-DD"),
        endDate: now.format("YYYY-MM-DD"),
        label: "Last 3 Years",
        granularity: "month",
        dayBuckets: [],
        monthBuckets: buildMonthBuckets(start, now, true),
        multiYear: true,
      };
    }

    case "custom_month": {
      if (!state.customMonth) return calcRange({ ...state, preset: "this_month" });
      const m = state.customMonth;
      const start = m.startOf("month");
      // If the custom month is the current month → end at today, else end of that month
      const isCurrentMonth =
        m.year() === now.year() && m.month() === now.month();
      const end = isCurrentMonth ? now : m.endOf("month");
      return {
        startDate: start.format("YYYY-MM-DD"),
        endDate: end.format("YYYY-MM-DD"),
        label: m.format("MMM YYYY"),
        granularity: "day",
        dayBuckets: buildDayBuckets(start, end),
        monthBuckets: [],
        multiYear: false,
      };
    }

    case "custom_year": {
      if (!state.customYear) return calcRange({ ...state, preset: "this_month" });
      const selectedYear = state.customYear;
      const currentYear = now.year();
      const yearStart = dayjs(`${selectedYear}-01-01`);
      // Current year → cap at today; past year → full Jan–Dec
      const yearEnd =
        selectedYear === currentYear
          ? now
          : dayjs(`${selectedYear}-12-31`);
      return {
        startDate: yearStart.format("YYYY-MM-DD"),
        endDate: yearEnd.format("YYYY-MM-DD"),
        label: String(selectedYear),
        granularity: "month",
        dayBuckets: [],
        monthBuckets: buildMonthBuckets(yearStart, yearEnd, false),
        multiYear: false,
      };
    }
  }
}

// ─── hook ────────────────────────────────────────────────────────────────────

export function useDateFilter() {
  const [filterState, setFilterState] = useState<DateFilterState>({
    preset: "this_month",
    customMonth: null,
    customYear: null,
  });

  const dateRange = useMemo(() => calcRange(filterState), [filterState]);

  const setPreset = (preset: FilterPreset) =>
    setFilterState((s) => ({ ...s, preset }));

  const setCustomMonth = (month: Dayjs | null) =>
    setFilterState({ preset: "custom_month", customMonth: month, customYear: null });

  const setCustomYear = (year: number | null) =>
    setFilterState({ preset: "custom_year", customMonth: null, customYear: year });

  return { filterState, dateRange, setPreset, setCustomMonth, setCustomYear };
}
