"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Layout, Avatar, Dropdown } from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/Notifications/NotificationBell";
import GlobalSearch from "@/components/Dashboard/GlobalSearch";

const { Header } = Layout;

export default function DashboardHeader() {
  const router = useRouter();
  const { user, profile, roles, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const roleNames = roles.map((r) => r.role_name?.toLowerCase() ?? "");
  const roleLabel = roleNames.includes("internal_admin")
    ? "Internal Admin"
    : roleNames.includes("internal_operator")
      ? "Internal Operator"
      : roleNames.includes("client_viewer")
        ? "Client Viewer"
        : roleNames.includes("admin")
          ? "Admin"
          : roleNames.length > 0
            ? roles[0]?.role_name ?? "User"
            : "User";

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === "logout") {
      setSigningOut(true);
      void signOut().catch(() => {
        setSigningOut(false);
      });
    }
  };

  const userMenuItems = [
    { key: "profile", icon: <UserOutlined />, label: "Profile" },
    { key: "settings", icon: <SettingOutlined />, label: "Settings" },
    { type: "divider" as const },
    { key: "logout", icon: <LogoutOutlined />, label: "Sign out", danger: true },
  ];

  return (
    <Header
      style={{
        height: 70,
        minHeight: 70,
        padding: "0 24px",
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        flexShrink: 0,
        zIndex: 99,
        overflow: "visible",
      }}
    >
      <GlobalSearch />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexShrink: 0,
        }}
      >
        <NotificationBell />
        <Dropdown
          menu={{ items: userMenuItems, onClick: handleMenuClick }}
          placement="bottomRight"
          disabled={signingOut}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: signingOut ? "wait" : "pointer",
              opacity: signingOut ? 0.7 : 1,
            }}
          >
            <Avatar
              size={36}
              icon={<UserOutlined />}
              style={{ backgroundColor: "#1677ff", flexShrink: 0 }}
            />
            <div style={{ textAlign: "left", lineHeight: 1.3 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {signingOut ? "Signing out..." : (profile?.full_name || user?.email || "User")}
              </div>
              <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                {signingOut ? "Signing out..." : roleLabel}
              </div>
            </div>
          </div>
        </Dropdown>
      </div>
    </Header>
  );
}
