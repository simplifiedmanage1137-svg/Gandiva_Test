"use client";

import { useQuery } from "@tanstack/react-query";

export type TLStats = {
  totalCampaigns: number;
  activeCampaigns: number;
  totalLeads: number;
  totalInterested: number;
  conversionPct: number;
  leadTrend?: { date: string; leads: number; campaigns: number }[];
};

export type TLCampaignRow = {
  id: string;
  name: string;
  status: string;
  total_leads: number;
  total_agents: number;
  qualified_leads: number;
};

async function fetchTLStats(startDate?: string, endDate?: string, granularity?: string): Promise<TLStats> {
  const params = new URLSearchParams();
  if (startDate)   params.set("start_date", startDate);
  if (endDate)     params.set("end_date", endDate);
  if (granularity) params.set("granularity", granularity);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/tl/campaigns/stats${qs}`, { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load stats");
  return data;
}

async function fetchTLCampaigns(startDate?: string, endDate?: string): Promise<{ campaigns: TLCampaignRow[] }> {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/tl/campaigns${qs}`, { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load campaigns");
  return data;
}

export function useTLDashboard(enabled: boolean, startDate?: string, endDate?: string, granularity?: string) {
  const statsQuery = useQuery({
    queryKey: ["tl", "dashboard", "stats", startDate, endDate, granularity],
    queryFn: () => fetchTLStats(startDate, endDate, granularity),
    enabled,
    staleTime: 60 * 1000,
  });

  const campaignsQuery = useQuery({
    queryKey: ["tl", "campaigns", startDate, endDate],
    queryFn: () => fetchTLCampaigns(startDate, endDate),
    enabled,
    staleTime: 60 * 1000,
  });

  return {
    stats: statsQuery,
    campaigns: campaignsQuery,
    isLoading: statsQuery.isLoading || campaignsQuery.isLoading,
    isFetching: statsQuery.isFetching || campaignsQuery.isFetching,
    error: statsQuery.error ?? campaignsQuery.error,
    refetch: () => {
      statsQuery.refetch();
      campaignsQuery.refetch();
    },
  };
}
