"use client";

import { Spin } from "antd";
import SalesDashboard from "@/components/Sales/SalesDashboard";
import SalesManagerDashboard from "@/components/Sales/SalesManagerDashboard";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { useAuth } from "@/context/AuthContext";
import { useDateFilter } from "@/hooks/useDateFilter";
import DateFilter from "@/components/Dashboard/DateFilter";

export default function SalesDashboardPage() {
  const { status } = useRoleGuard(["sales", "sales_manager", "admin"]);
  const { roles } = useAuth();
  const { filterState, dateRange, setPreset, setCustomMonth, setCustomYear } = useDateFilter();

  if (status === "loading" || status === "redirecting") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const isManagerOrAdmin = roles.some((r) =>
    ["sales_manager", "admin"].includes(
      r.role_name.toLowerCase().replace(/\s+/g, "_")
    )
  );

  const filterBar = (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
      <DateFilter
        filterState={filterState}
        label={dateRange.label}
        onPresetChange={setPreset}
        onCustomMonthChange={setCustomMonth}
        onCustomYearChange={setCustomYear}
      />
    </div>
  );

  return isManagerOrAdmin
    ? <SalesManagerDashboard filterBar={filterBar} startDate={dateRange.startDate} endDate={dateRange.endDate} />
    : <SalesDashboard startDate={dateRange.startDate} endDate={dateRange.endDate} filterBar={filterBar} />;
}
