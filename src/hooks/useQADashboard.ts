"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export type QaStats = {
  totalCampaigns: number;
  activeCampaigns: number;
  totalLeads: number;
  totalInterested: number;
  conversionPct: number;
};

export type CampaignWithLeads = {
  id: string;
  name?: string;
  status?: string | null;
  leads: { qa_status: string | null; status?: string | null }[];
};

async function fetchQADashboard(startDate?: string, endDate?: string): Promise<{ campaigns: CampaignWithLeads[] }> {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate)   params.set("end_date", endDate);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/qa/dashboard${qs}`, { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load dashboard");
  return data;
}

function buildStats(campaigns: CampaignWithLeads[]): QaStats {
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active").length;
  const totalLeads = campaigns.reduce(
    (sum, campaign) => sum + (campaign.leads?.length ?? 0),
    0
  );
  const totalInterested = campaigns.reduce(
    (sum, campaign) =>
      sum +
      (campaign.leads?.filter((lead) => {
        const status = String(lead.status ?? "").trim().toLowerCase();
        return ["interested", "followup", "closed_won"].includes(status);
      }).length ?? 0),
    0
  );
  const reviewedLeads = campaigns.reduce(
    (sum, campaign) =>
      sum +
      (campaign.leads?.filter((lead) => {
        const qaStatus = String(lead.qa_status ?? "").trim().toLowerCase();
        return qaStatus.length > 0;
      }).length ?? 0),
    0
  );

  return {
    totalCampaigns,
    activeCampaigns,
    totalLeads,
    totalInterested,
    conversionPct: totalLeads > 0 ? Math.round((reviewedLeads / totalLeads) * 100) : 0,
  };
}

export function useQADashboard(enabled: boolean, startDate?: string, endDate?: string) {
  const dashboardQuery = useQuery({
    queryKey: ["qa", "dashboard", startDate, endDate],
    queryFn: () => fetchQADashboard(startDate, endDate),
    enabled,
    staleTime: 60 * 1000,
  });

  const statsData = useMemo(
    () => buildStats(dashboardQuery.data?.campaigns ?? []),
    [dashboardQuery.data?.campaigns]
  );

  return {
    dashboard: dashboardQuery,
    stats: {
      data: statsData,
      isLoading: dashboardQuery.isLoading,
      isFetching: dashboardQuery.isFetching,
      isSuccess: dashboardQuery.isSuccess,
      isError: dashboardQuery.isError,
      error: dashboardQuery.error,
      refetch: dashboardQuery.refetch,
    },
    isLoading: dashboardQuery.isLoading,
    isFetching: dashboardQuery.isFetching,
    error: dashboardQuery.error,
    refetch: () => {
      dashboardQuery.refetch();
    },
  };
}
