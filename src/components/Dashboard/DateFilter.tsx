"use client";

import { useState } from "react";
import { Select, DatePicker, Space, Tag } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { FilterPreset, DateFilterState } from "@/hooks/useDateFilter";

const PRESET_OPTIONS: { label: string; value: FilterPreset }[] = [
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 3 Months", value: "last_3_months" },
  { label: "Last 12 Months", value: "last_12_months" },
  { label: "Last 3 Years", value: "last_3_years" },
  { label: "Custom Month", value: "custom_month" },
  { label: "Custom Year", value: "custom_year" },
];

interface DateFilterProps {
  filterState: DateFilterState;
  label: string;
  onPresetChange: (preset: FilterPreset) => void;
  onCustomMonthChange: (month: dayjs.Dayjs | null) => void;
  onCustomYearChange: (year: number | null) => void;
}

export default function DateFilter({
  filterState,
  label,
  onPresetChange,
  onCustomMonthChange,
  onCustomYearChange,
}: DateFilterProps) {
  return (
    <Space size={8} wrap>
      <Select
        value={filterState.preset}
        onChange={onPresetChange}
        options={PRESET_OPTIONS}
        style={{ width: 160 }}
        suffixIcon={<CalendarOutlined />}
      />

      {filterState.preset === "custom_month" && (
        <DatePicker
          picker="month"
          value={filterState.customMonth ?? undefined}
          onChange={(v) => onCustomMonthChange(v ?? null)}
          format="MMM YYYY"
          placeholder="Select Month"
          style={{ width: 140 }}
          allowClear={false}
        />
      )}

      {filterState.preset === "custom_year" && (
        <DatePicker
          picker="year"
          value={filterState.customYear ? dayjs().year(filterState.customYear) : undefined}
          onChange={(v) => onCustomYearChange(v ? v.year() : null)}
          format="YYYY"
          placeholder="Select Year"
          style={{ width: 110 }}
          allowClear={false}
        />
      )}

      <Tag
        icon={<CalendarOutlined />}
        color="blue"
        style={{ margin: 0, fontSize: 12, padding: "2px 8px" }}
      >
        {label}
      </Tag>
    </Space>
  );
}
