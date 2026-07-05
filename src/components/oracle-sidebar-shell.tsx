"use client";

import { type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  Bell,
  BookHeart,
  CalendarCheck2,
  LogOut,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings2,
  Sparkles,
  UserRound,
  Waypoints,
  X,
} from "lucide-react";

type FlowStep = "landing" | "question" | "spread" | "deck" | "reveal" | "reading";

type SidebarProps = {
  collapsed: boolean;
  mobile: boolean;
  step: FlowStep;
  onClose: () => void;
  onToggleCollapse: () => void;
  onFreshReading: () => void;
  onOpenGuide: () => void;
  onOpenTimeline: () => void;
  onOpenDaily: () => void;
  onOpenDream: () => void;
  onOpenCapsule: () => void;
  onOpenReport: () => void;
  pendingDailyCount: number;
  dueCapsuleCount: number;
  onOpenSettings: () => void;
  onOpenMessages: () => void;
  onExit: () => void;
};

type NavItem = {
  key: string;
  label: string;
  hint: string;
  icon: ReactNode;
  onClick: () => void;
  active: boolean;
  badge?: number;
};

export function OracleSidebarShell({
  collapsed,
  mobile,
  step,
  onClose,
  onToggleCollapse,
  onFreshReading,
  onOpenGuide,
  onOpenTimeline,
  onOpenDaily,
  onOpenDream,
  onOpenCapsule,
  onOpenReport,
  pendingDailyCount,
  dueCapsuleCount,
  onOpenSettings,
  onOpenMessages,
  onExit,
}: SidebarProps) {
  const navItems: NavItem[] = [
    {
      key: "fresh",
      label: "新一轮阅读",
      hint: "从提问重新开始",
      icon: <Sparkles className="h-4 w-4" />,
      onClick: onFreshReading,
      active: step === "landing" || step === "question",
    },
    {
      key: "guide",
      label: "使用说明",
      hint: "先看功能怎么用",
      icon: <ScrollText className="h-4 w-4" />,
      onClick: onOpenGuide,
      active: false,
    },
    {
      key: "timeline",
      label: "灵魂时间线",
      hint: "回看每一次内在转折",
      icon: <Waypoints className="h-4 w-4" />,
      onClick: onOpenTimeline,
      active: false,
    },
    {
      key: "daily",
      label: "每日记录",
      hint: "给明天留下一件小事",
      icon: <CalendarCheck2 className="h-4 w-4" />,
      onClick: onOpenDaily,
      active: false,
      badge: pendingDailyCount,
    },
    {
      key: "dream",
      label: "梦境记录",
      hint: "把夜里的回声收住",
      icon: <BookHeart className="h-4 w-4" />,
      onClick: onOpenDream,
      active: false,
    },
    {
      key: "capsule",
      label: "时间胶囊",
      hint: "寄给未来的自己",
      icon: <Archive className="h-4 w-4" />,
      onClick: onOpenCapsule,
      active: false,
      badge: dueCapsuleCount,
    },
    {
      key: "report",
      label: "月度内在报告",
      hint: "把变化慢慢收成一页",
      icon: <NotebookPen className="h-4 w-4" />,
      onClick: onOpenReport,
      active: false,
    },
  ];

  const content = (
    <motion.div
      key={mobile ? "mobile-sidebar-expanded" : "desktop-sidebar-expanded"}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="oracle-scrollbar flex h-full min-h-0 flex-col overflow-y-auto px-1 pb-3 pt-1"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 pl-1 pt-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)]">
            <Sparkles className="h-4 w-4 text-[var(--gold)]" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs uppercase tracking-[0.32em] text-[var(--muted)]">神谕室</p>
            <p className="truncate text-sm text-[var(--foreground)]/84">现代禅意塔罗空间</p>
          </div>
        </div>

        <button
          type="button"
          onClick={mobile ? onClose : onToggleCollapse}
          className="mr-1 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)]"
          aria-label={mobile ? "关闭侧边栏" : "收起侧边栏"}
          title={mobile ? "关闭侧边栏" : "收起侧边栏"}
        >
          {mobile ? <X className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-6 flex-1 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className={`group flex w-full items-center gap-3 rounded-[1.25rem] border px-3 py-3 text-left ${
              item.active
                ? "border-[rgba(214,168,95,0.3)] bg-[rgba(214,168,95,0.1)] text-[var(--foreground)]"
                : "border-transparent bg-transparent text-[var(--muted)] hover:border-[var(--line)] hover:bg-[color:var(--panel-strong)]"
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)]">
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm text-[var(--foreground)]/92">
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[rgba(214,168,95,0.18)] px-1.5 py-0.5 text-[10px] tracking-[0.14em] text-[var(--gold)]">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{item.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5 border-t border-[var(--line)] pt-4">
        <div className="flex items-center gap-3 rounded-[1.25rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-3 py-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[rgba(214,168,95,0.12)] text-[var(--gold)]">
            <UserRound className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-[var(--foreground)]">匿名旅人</p>
            <p className="truncate text-xs text-[var(--muted)]">本地体验中 · 未连接账号</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex h-10 flex-1 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)]"
            aria-label="设置"
            title="设置"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenMessages}
            className="relative flex h-10 flex-1 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)]"
            aria-label="消息"
            title="消息"
          >
            {pendingDailyCount > 0 || dueCapsuleCount > 0 ? (
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--gold)]" />
            ) : null}
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onExit}
            className="flex h-10 flex-1 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)]"
            aria-label="退出"
            title="退出"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 rounded-[1.25rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4">
          <p className="text-sm leading-8 text-[var(--foreground)]/86">
            你越安静，越能听见真正属于自己的回声。
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">留给今夜的寄语</p>
        </div>
      </div>
    </motion.div>
  );

  const panel = (
    <motion.div
      layout
      animate={!mobile ? { width: collapsed ? "5.75rem" : "17.75rem" } : undefined}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className={`sidebar-shell paper-panel relative flex h-full flex-col rounded-[2rem] p-5 ${
        mobile ? "w-[18rem] max-w-[86vw]" : ""
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {collapsed && !mobile ? (
          <motion.div
            key="mini"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-full items-start justify-center pt-1"
          >
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)]"
              aria-label="展开侧边栏"
              title="展开侧边栏"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </motion.div>
        ) : (
          content
        )}
      </AnimatePresence>
    </motion.div>
  );

  if (mobile) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-[rgba(15,12,10,0.28)] p-3 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: -32, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -32, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="h-full"
          onClick={(event) => event.stopPropagation()}
        >
          {panel}
        </motion.div>
      </motion.div>
    );
  }

  return <aside className="hidden lg:flex lg:shrink-0">{panel}</aside>;
}
