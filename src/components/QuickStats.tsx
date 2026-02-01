"use client";

import { Users, FileText, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import Card from "./Card";

type StatCard = {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: "blue" | "green" | "yellow" | "purple";
  trend?: string;
};

export default function QuickStats({ stats }: { stats: StatCard[] }) {
  const colorClasses = {
    blue: "bg-[var(--primary-bg)] border-[var(--primary)]",
    green: "bg-[var(--success-bg)] border-[var(--success)]",
    yellow: "bg-[var(--warning-bg)] border-[var(--warning)]",
    purple: "bg-[var(--info-bg)] border-[var(--info)]",
  };

  const iconColorClasses = {
    blue: "text-[var(--primary)]",
    green: "text-[var(--success)]",
    yellow: "text-[var(--warning)]",
    purple: "text-[var(--info)]",
  };

  const textColorClasses = {
    blue: "text-[var(--primary)]",
    green: "text-[var(--success)]",
    yellow: "text-[var(--warning)]",
    purple: "text-[var(--info)]",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => (
        <Card key={index} className={`app-card border ${colorClasses[stat.color]} hover:shadow-lg transition-all`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--muted)] mb-1">{stat.label}</p>
              <p className={`text-3xl font-bold ${textColorClasses[stat.color]}`}>{stat.value}</p>
              {stat.trend && (
                <p className="text-xs mt-2 text-[var(--text-secondary)] flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {stat.trend}
                </p>
              )}
            </div>
            <div className={`${iconColorClasses[stat.color]} opacity-80`}>
              {stat.icon}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

