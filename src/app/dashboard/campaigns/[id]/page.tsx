"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Button, Card, Typography, Drawer, message } from "antd";
import { ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import CampaignDashboard from "@/components/command/CampaignDashboard";
import CampaignForm from "@/components/command/CampaignForm";

const { Text } = Typography;

interface CampaignBasic {
  id: string;
  campaign_id: string;
  name: string;
  campaign_type?: string | null;
  lead_aggregated?: string | null;
  description?: string | null;
  industry?: string | null;
  geography?: string | null;
  lead_type?: string | null;
  client_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
  cpl?: number | null;
  revenue?: number | null;
  total_allocation?: number | null;
  campaign_metrics?: {
    sponsor_name?: string | null;
    total_leads_allocated?: number | null;
    total_campaign_spend?: number | null;
    total_leads_delivered?: number | null;
    daily_reporting?: Record<string, unknown> | null;
    channel_split?: Record<string, unknown> | null;
    deficit_leads?: number | null;
    lead_increment?: number | null;
    lead_replace?: number | null;
  }[] | {
    sponsor_name?: string | null;
    total_leads_allocated?: number | null;
    total_campaign_spend?: number | null;
    total_leads_delivered?: number | null;
    daily_reporting?: Record<string, unknown> | null;
    channel_split?: Record<string, unknown> | null;
    deficit_leads?: number | null;
    lead_increment?: number | null;
    lead_replace?: number | null;
  };
}

export default function CampaignDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { hasRole } = useAuth();

  const campaignId = params.id as string;
  const shouldEditOnMount = searchParams.get("edit") === "true";

  const [editDrawer, setEditDrawer] = useState(shouldEditOnMount);
  const [campaignBasic, setCampaignBasic] = useState<CampaignBasic | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const metrics = campaignBasic
    ? (Array.isArray(campaignBasic.campaign_metrics)
      ? campaignBasic.campaign_metrics[0]
      : campaignBasic.campaign_metrics)
    : null;
  const campaignFormInitialValues = campaignBasic
    ? {
      ...campaignBasic,
      sponsor_name: metrics?.sponsor_name ?? null,
      total_leads_allocated: metrics?.total_leads_allocated ?? null,
      total_campaign_spend: metrics?.total_campaign_spend ?? null,
      total_leads_delivered: metrics?.total_leads_delivered ?? null,
      daily_reporting: metrics?.daily_reporting ? JSON.stringify(metrics.daily_reporting, null, 2) : null,
      channel_split: metrics?.channel_split ? JSON.stringify(metrics.channel_split, null, 2) : null,
      deficit_leads: metrics?.deficit_leads ?? null,
      lead_increment: metrics?.lead_increment ?? null,
      lead_replace: metrics?.lead_replace ?? null,
    }
    : undefined;

  const canEdit =
    hasRole("internal_operator") ||
    hasRole("internal_admin") ||
    hasRole("admin") ||
    hasRole("client_viewer");

  useEffect(() => {
    if (!editDrawer) return;

    fetch(`/api/command/campaigns/${campaignId}`)
      .then((r) => r.json())
      .then((d: { campaign?: CampaignBasic }) => {
        if (d.campaign) setCampaignBasic(d.campaign);
      })
      .catch(() => message.error("Failed to load campaign"));
  }, [editDrawer, campaignId]);

  /** Matches horizontal `Content` padding in `AppLayout` so the card spans the full inner width. */
  const contentPad = 24;

  return (
    <div
      style={{
        marginLeft: -contentPad,
        marginRight: -contentPad,
        paddingLeft: contentPad,
        paddingRight: contentPad,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => router.push("/dashboard/campaigns")}
            style={{ paddingLeft: 0, marginBottom: 4 }}
          >
            Campaign Command Center
          </Button>
          <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
            Campaign ID: {campaignId}
          </Text>
        </div>

        {canEdit && (
          <Button
            icon={<EditOutlined />}
            onClick={() => setEditDrawer(true)}
          >
            Edit Campaign
          </Button>
        )}
      </div>

      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          border: "1px solid #f0f0f0",
        }}
        styles={{ body: { padding: 0 } }}
      >
        <CampaignDashboard
          key={refreshKey}
          campaignId={campaignId}
          initialTab={searchParams.get("tab")}
          initialDeliveryStatus={searchParams.get("delivery_status")}
        />
      </Card>

      {canEdit && (
        <Drawer
          title="Edit Campaign"
          open={editDrawer}
          onClose={() => setEditDrawer(false)}
          width={680}
          destroyOnClose
        >
          {campaignBasic && (
            <CampaignForm
              campaignId={campaignId}
              initialValues={campaignFormInitialValues}
              onSuccess={() => {
                setEditDrawer(false);
                setRefreshKey((k) => k + 1);
                message.success("Campaign updated");
              }}
              onCancel={() => setEditDrawer(false)}
            />
          )}
        </Drawer>
      )}
    </div>
  );
}
