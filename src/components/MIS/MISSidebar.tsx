"use client";

import { Layout, Tooltip } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  DashboardOutlined,
  TeamOutlined,
  AppstoreOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  BarChartOutlined,
} from "@ant-design/icons";

const { Sider } = Layout;

const misMenuItems = [
  { key: "/mis/dashboard", icon: <DashboardOutlined />, label: "Dashboard", href: "/mis/dashboard" },
  {
    key: "/mis/campaigns",
    icon: <AppstoreOutlined />,
    label: "Campaigns",
    href: "/mis/campaigns",
  },
  {
    key: "/mis/lead-upload",
    icon: <CloudUploadOutlined />,
    label: "Lead Upload",
    href: "/mis/lead-upload",
  },
  {
    key: "/mis/leads",
    icon: <DatabaseOutlined />,
    label: "Lead Database",
    href: "/mis/leads",
  },
  {
    key: "/mis/reports",
    icon: <BarChartOutlined />,
    label: "Reports",
    href: "/mis/reports",
  },
];

export default function MISSidebar() {
  const pathname = usePathname();

  const selectedKey =
    pathname?.startsWith("/mis/campaigns")
      ? "/mis/campaigns"
      : pathname?.startsWith("/mis/lead-upload")
      ? "/mis/lead-upload"
      : pathname?.startsWith("/mis/leads")
      ? "/mis/leads"
      : pathname?.startsWith("/mis/reports")
      ? "/mis/reports"
      : "/mis/dashboard";

  return (
    <Sider
      width={92}
      theme="light"
      style={{
        position: "fixed",
        insetInlineStart: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "16px 0",
        background: "#ffffff",
        borderRight: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        <Image
          src="/projects/sidebar_logo.png"
          alt="Gandiv"
          width={50}
          height={50}
          style={{ objectFit: "contain" }}
          priority
        />
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: 16,
          gap: 20,
        }}
      >
        {misMenuItems.map((item) => {
          const active = selectedKey === item.key;
          return (
            <Tooltip key={item.key} title={item.label} placement="right">
              <Link
                href={item.href}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  width: 64,
                  padding: "6px 4px",
                  borderRadius: 14,
                  textDecoration: "none",
                  background: active ? "#eff6ff" : "transparent",
                  transition: "all 0.18s ease",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "999px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: active ? "#1677ff" : "#f3f4f6",
                    color: active ? "#ffffff" : "#4b5563",
                    boxShadow: active
                      ? "0 6px 14px rgba(22,119,255,0.28)"
                      : "none",
                    fontSize: 20,
                  }}
                >
                  {item.icon}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    lineHeight: 1.1,
                    color: active ? "#0f172a" : "#6b7280",
                    fontWeight: active ? 600 : 500,
                    textAlign: "center",
                    maxWidth: "100%",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </span>
              </Link>
            </Tooltip>
          );
        })}
      </div>
    </Sider>
  );
}

