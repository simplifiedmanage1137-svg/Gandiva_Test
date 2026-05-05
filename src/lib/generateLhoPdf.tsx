"use client";

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#0f1720",
    fontFamily: "Helvetica",
    padding: 0,
  },
  container: {
    margin: 24,
    backgroundColor: "#1b2530",
    borderRadius: 8,
    padding: "44 48 52",
    color: "#d1d5db",
    position: "relative",
    flexGrow: 1,
  },
  circle: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#3b2a1f",
    top: -80,
    left: -80,
    opacity: 0.6,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 30,
    color: "#0ea5e9",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  logoI: {
    fontSize: 30,
    color: "#facc15",
    fontFamily: "Helvetica-Bold",
  },
  yellowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#facc15",
    marginBottom: -10,
    alignSelf: "center",
  },
  subTitle: {
    marginTop: 6,
    fontSize: 13,
    color: "#cbd5e1",
    fontFamily: "Helvetica",
    textAlign: "center",
  },
  sectionHeading: {
    fontSize: 14,
    color: "#e5e7eb",
    fontFamily: "Helvetica-Bold",
    marginBottom: 14,
    marginTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#2d3f52",
    paddingBottom: 6,
  },
  row: {
    flexDirection: "row",
    marginBottom: 10,
  },
  label: {
    width: 155,
    fontSize: 10,
    color: "#94a3b8",
    fontFamily: "Helvetica-Bold",
  },
  colon: {
    width: 12,
    fontSize: 10,
    color: "#94a3b8",
    fontFamily: "Helvetica-Bold",
  },
  value: {
    flex: 1,
    fontSize: 10,
    color: "#e2e8f0",
    fontFamily: "Helvetica",
    lineHeight: 1.5,
  },
  divider: {
    height: 1,
    backgroundColor: "#2d3f52",
    marginVertical: 18,
  },
  // Notes page
  notesHeading: {
    fontSize: 14,
    color: "#e5e7eb",
    fontFamily: "Helvetica-Bold",
    marginBottom: 18,
    marginTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#2d3f52",
    paddingBottom: 6,
  },
  notePoint: {
    flexDirection: "row",
    marginBottom: 14,
    alignItems: "flex-start",
  },
  noteBullet: {
    width: 16,
    fontSize: 10,
    color: "#0ea5e9",
    fontFamily: "Helvetica-Bold",
    marginTop: 1,
  },
  noteText: {
    flex: 1,
    fontSize: 10,
    color: "#e2e8f0",
    fontFamily: "Helvetica",
    lineHeight: 1.6,
  },
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type LhoData = {
  // Prospect / Contact
  salutation: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  directNumber: string;
  jobTitle: string;
  jobLevel: string;
  department: string;
  jobFunction: string;
  jobTitleLink: string;
  contactLinkedIn: string;
  // Company
  companyName: string;
  domain: string;
  companyNumber: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  employeeSize: string;
  seeAllEmployees: string;
  industry: string;
  employeeSizeLink: string;
  companyWebsite: string;
  companyLinkedIn: string;
  revenueRange: string;
  revenueLink: string;
  sicCode: string;
  sicCodeLink: string;
  naicsCode: string;
  naicsCodeLink: string;
  foundedYears: string;
  foundedYearsLink: string;
  // Custom / CQ
  callBack: string;
  callNotes: string;
  cq1: string;
  cq2: string;
  cq3: string;
  cq4: string;
  cq5: string;
  raComment: string;
  specialComments: string;
  // Notes (raw text — parsed into numbered points)
  notes: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Only render a row if value is non-empty */
function FieldRow({ label, value }: { label: string; value: string }) {
  if (!value || !value.trim()) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.colon}>:</Text>
      <Text style={styles.value}>{value.trim()}</Text>
    </View>
  );
}

/**
 * Parse notes into bullet points.
 * - Numbered prefixes (1. 1)) are stripped, each becomes a bullet
 * - Double space = new bullet on next line
 * - Single newline = new bullet
 */
function parseNotes(raw: string): string[] {
  if (!raw || !raw.trim()) return [];

  return raw
    .replace(/(\d+[.)]) */g, "\n")   // strip numbered prefixes, insert newline
    .replace(/  +/g, "\n")            // double space → newline
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

// ── Logo component ────────────────────────────────────────────────────────────

function Logo() {
  return (
    <View style={styles.header}>
      <View style={styles.logoRow}>
        <Text style={styles.logoText}>B2B</Text>
        <View style={{ flexDirection: "column", alignItems: "center" }}>
          <View style={styles.yellowDot} />
          <Text style={styles.logoI}>i</Text>
        </View>
        <Text style={styles.logoText}>nDemand</Text>
      </View>
      <Text style={styles.subTitle}>Lead Handover Document</Text>
    </View>
  );
}

// ── Main Document ─────────────────────────────────────────────────────────────

function LhoDocument({ data }: { data: LhoData }) {
  const prospectName = [data.salutation, data.firstName, data.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const fullAddress = [data.address, data.city, data.state, data.country, data.zipCode]
    .filter(Boolean)
    .join(", ");

  const notePoints = parseNotes(data.notes);
  const hasNotes = notePoints.length > 0;

  // Collect CQ fields that are filled
  const cqFields: { label: string; value: string }[] = [
    { label: "CQ1", value: data.cq1 },
    { label: "CQ2", value: data.cq2 },
    { label: "CQ3", value: data.cq3 },
    { label: "CQ4", value: data.cq4 },
    { label: "CQ5", value: data.cq5 },
  ].filter((f) => f.value?.trim());

  return (
    <Document title="Lead Handover Document">

      {/* ── Page 1: Company + Prospect + Custom Questions ── */}
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.container}>
          <View style={styles.circle} />
          <Logo />

          {/* Company Details */}
          <Text style={styles.sectionHeading}>Company Details</Text>
          <FieldRow label="Name of the Company" value={data.companyName} />
          <FieldRow label="Domain" value={data.domain} />
          <FieldRow label="Address" value={fullAddress} />
          <FieldRow label="Board Dial" value={data.companyNumber} />
          <FieldRow label="Website" value={data.companyWebsite} />
          <FieldRow label="Employee Size" value={data.employeeSize} />
          <FieldRow label="See All Employees" value={data.seeAllEmployees} />
          <FieldRow label="Industry" value={data.industry} />
          <FieldRow label="Revenue Range" value={data.revenueRange} />
          <FieldRow label="Revenue Link" value={data.revenueLink} />
          <FieldRow label="Founded Year" value={data.foundedYears} />
          <FieldRow label="Founded Year Link" value={data.foundedYearsLink} />
          <FieldRow label="SIC Code" value={data.sicCode} />
          <FieldRow label="SIC Code Link" value={data.sicCodeLink} />
          <FieldRow label="NAICS Code" value={data.naicsCode} />
          <FieldRow label="NAICS Code Link" value={data.naicsCodeLink} />
          <FieldRow label="Employee Size Link" value={data.employeeSizeLink} />
          <FieldRow label="LinkedIn" value={data.companyLinkedIn} />

          <View style={styles.divider} />

          {/* Prospect Details */}
          <Text style={styles.sectionHeading}>Prospect Details</Text>
          <FieldRow label="Name" value={prospectName} />
          <FieldRow label="Job Title" value={data.jobTitle} />
          <FieldRow label="Job Level" value={data.jobLevel} />
          <FieldRow label="Department" value={data.department} />
          <FieldRow label="Job Function" value={data.jobFunction} />
          <FieldRow label="Job Title Link" value={data.jobTitleLink} />
          <FieldRow label="Email" value={data.email} />
          <FieldRow label="Phone" value={data.phone} />
          <FieldRow label="Direct Line" value={data.directNumber} />
          <FieldRow label="LinkedIn" value={data.contactLinkedIn} />

          {/* Custom Questions — only if any filled */}
          {(cqFields.length > 0 || data.callBack?.trim() || data.callNotes?.trim() || data.raComment?.trim() || data.specialComments?.trim()) && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionHeading}>Custom Questions & Comments</Text>
              <FieldRow label="Call Back" value={data.callBack} />
              <FieldRow label="Call Notes" value={data.callNotes} />
              {cqFields.map((f) => (
                <FieldRow key={f.label} label={f.label} value={f.value} />
              ))}
              <FieldRow label="RA Comment" value={data.raComment} />
              <FieldRow label="Special Comments" value={data.specialComments} />
            </>
          )}
        </View>
      </Page>

      {/* ── Page 2: Notes (only if notes exist) ── */}
      {hasNotes && (
        <Page size="A4" style={styles.page} wrap>
          <View style={styles.container}>
            <View style={styles.circle} />
            <Text style={styles.notesHeading}>Notes</Text>
            {notePoints.map((point, i) => (
              <View key={i} style={styles.notePoint}>
                <Text style={styles.noteBullet}>•</Text>
                <Text style={styles.noteText}>{point}</Text>
              </View>
            ))}
          </View>
        </Page>
      )}

    </Document>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export async function generateLhoPdf(data: LhoData): Promise<void> {
  const doc = <LhoDocument data={data} />;
  const blob = await pdf(doc).toBlob();

  const companySlug = (data.companyName || "Company").replace(/\s+/g, "_");
  const prospectSlug = [data.firstName, data.lastName].filter(Boolean).join("_") || "Prospect";
  const fileName = `LHO_${companySlug}_${prospectSlug}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
