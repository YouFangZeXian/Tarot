"use client";
import {
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  Bell,
  BookHeart,
  ChevronLeft,
  ChevronDown,
  Check,
  Copy,
  Download,
  Home,
  LoaderCircle,
  LogOut,
  Menu,
  MoonStar,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  RotateCw,
  ScrollText,
  Settings2,
  Sparkles,
  SunMedium,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { drawCards, spreads, tarotDeck, type DrawnCard, type SpreadOption } from "@/data/tarot";
import { buildArchetypeProfile } from "@/lib/archetype-profile";
import {
  createDreamJournalEntry,
  type DreamJournalEntry,
  type DreamMood,
} from "@/lib/dream-journal";
import {
  countDueCapsules,
  createTimeCapsuleEntry,
  dismissCapsuleReminder,
  getCapsuleStatus,
  getDefaultCapsuleDate,
  markCapsuleOpened,
  type TimeCapsuleEntry,
} from "@/lib/time-capsule";
import {
  buildMonthlyInnerReport,
  createMonthlyReportSnapshot,
  type MonthlyReportSnapshot,
} from "@/lib/monthly-report";
import {
  创建阅读记录,
  type 阅读记录,
} from "@/lib/reading-history";
import {
  今日待回应数量,
  创建每日记录,
  完成每日记录,
  每日记录状态,
  type 每日记录,
} from "@/lib/daily-record";
import { oracleDataService } from "@/lib/oracle-data-service";
import { createOracleBackup, parseOracleBackup } from "@/lib/oracle-backup";
import { OracleSidebarShell } from "@/components/oracle-sidebar-shell";
import { fetchServerDailyRecords, mergeDailyRecords } from "@/lib/daily-sync";
import { fetchServerDreamEntries, mergeDreamEntries } from "@/lib/dream-sync";
import { fetchServerMonthlyReports, mergeMonthlyReports } from "@/lib/monthly-report-sync";
import { fetchServerReadings, mergeReadingRecords } from "@/lib/reading-sync";
import { fetchServerTimeCapsules, mergeTimeCapsules } from "@/lib/time-capsule-sync";
import {
  flushSyncQueue,
  formatSyncStateLabel,
  getServerSyncStateSnapshot,
  getSyncStateSnapshot,
  persistWithRetry,
  startSyncQueue,
  subscribeSyncState,
} from "@/lib/sync-queue";

type FlowStep = "landing" | "question" | "spread" | "deck" | "reveal" | "reading";
type ThemeMode = "light" | "dark";
type DeckMode = "stack" | "shuffle" | "ring";
type InterpretationMode = "standard" | "shadow";
type WorkspaceView = "oracle" | "timeline";
type ReadingSection = { title: string; paragraphs: string[] };
type ReadingPanelKey = "archetype" | "dream" | "capsule" | "report" | "cards";

type FakeRingCard = {
  id: string;
  angleOffset: number;
};

const heroCards = Array.from({ length: 12 }, (_, index) => index);
const fakeRingCards: FakeRingCard[] = Array.from({ length: 30 }, (_, index) => ({
  id: `ring-${index}`,
  angleOffset: (360 / 30) * index,
}));

const stepOrder: FlowStep[] = ["landing", "question", "spread", "deck", "reveal", "reading"];
const defaultReadingPanels: Record<ReadingPanelKey, boolean> = {
  archetype: false,
  dream: false,
  capsule: false,
  report: false,
  cards: false,
};

const stepMeta: Record<FlowStep, { label: string; title: string; copy?: string }> = {
  landing: { label: "神谕室", title: "读懂象征，慢一点听见自己。" },
  question: {
    label: "步骤一 / 提问",
    title: "你今天想被指引的，是什么？",
    copy: "把问题说得更诚实一点，让塔罗先照见情绪，再靠近答案。",
  },
  spread: {
    label: "步骤二 / 牌阵",
    title: "选择这次抽牌的节奏。",
    copy: "不同的牌阵像不同的镜头，它们决定你会先看见哪一层内在纹理。",
  },
  deck: {
    label: "步骤三 / 牌组",
    title: "让牌组慢慢贴近你的问题。",
    copy: "先洗牌，再进入选牌。你可以轻按上方按钮，让牌环缓缓转动，再点选那些让你停下来的牌。",
  },
  reveal: {
    label: "步骤四 / 出牌",
    title: "让牌一张一张显现。",
    copy: "每一张牌都慢半拍翻面，让悬念先落下，再进入真正的阅读。",
  },
  reading: {
    label: "步骤五 / 解读",
    title: "一封来自牌面的私人来信。",
    copy: "这里不是结论机器，而是一封更贴近情绪、动机和方向的中文来信。",
  },
};

const sectionFade = {
  initial: { opacity: 0, y: 26, filter: "blur(10px)", scale: 0.988 },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", scale: 1 },
  exit: { opacity: 0, y: -14, filter: "blur(8px)", scale: 0.992 },
  transition: {
    duration: 0.72,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  },
};

const readingTitleMap = new Map([
  ["overall energy", "整体能量"],
  ["整体能量", "整体能量"],
  ["card symbolism", "牌面象征解读"],
  ["牌面象征解读", "牌面象征解读"],
  ["jungian reflection", "荣格式映照"],
  ["荣格式映照", "荣格式映照"],
  ["hidden pattern", "隐藏模式"],
  ["隐藏模式", "隐藏模式"],
  ["practical guidance", "实际建议"],
  ["实际建议", "实际建议"],
  ["reflection question", "反思问题"],
  ["反思问题", "反思问题"],
]);

const readingOrder = ["整体能量", "牌面象征解读", "荣格式映照", "隐藏模式", "实际建议", "反思问题"];

const interpretationModes = [
  {
    id: "standard",
    label: "温柔映照",
    title: "清明模式",
    subtitle: "更平衡地照见情绪、动机与下一步方向，适合大多数提问时刻。",
  },
  {
    id: "shadow",
    label: "深层拆解",
    title: "阴影模式",
    subtitle: "更靠近回避、投射、惯性循环与不愿承认的牵引，但仍保持温柔和安全。",
  },
] as const;

const dreamMoods: DreamMood[] = ["朦胧", "平静", "牵挂", "压迫", "惊醒", "温柔", "未知"];

export function TarotSanctuary() {
  const theme = useSyncExternalStore(subscribeThemePreference, getThemePreference, () => "light");
  const syncState = useSyncExternalStore(
    subscribeSyncState,
    getSyncStateSnapshot,
    getServerSyncStateSnapshot,
  );
  const viewportWidth = useViewportWidth();
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("oracle");
  const [step, setStep] = useState<FlowStep>("landing");
  const [question, setQuestion] = useState("");
  const [selectedSpread, setSelectedSpread] = useState<SpreadOption>(spreads[2]);
  const [interpretationMode, setInterpretationMode] = useState<InterpretationMode>("standard");
  const [deckMode, setDeckMode] = useState<DeckMode>("stack");
  const [ringRotation, setRingRotation] = useState(0);
  const [isRingSpinning, setIsRingSpinning] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [revealedCards, setRevealedCards] = useState<number[]>([]);
  const [selectionHint, setSelectionHint] = useState("先洗牌，让问题在心里停一停，再进入选牌。");
  const [readingText, setReadingText] = useState("");
  const [readingError, setReadingError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("复制解读内容");
  const [dreamTitle, setDreamTitle] = useState("");
  const [dreamText, setDreamText] = useState("");
  const [dreamMood, setDreamMood] = useState<DreamMood>("朦胧");
  const [dreamSaveFeedback, setDreamSaveFeedback] = useState("写进梦境簿");
  const [dreamEntries, setDreamEntries] = useState<DreamJournalEntry[]>(() => oracleDataService.dreams.load());
  const [capsuleTitle, setCapsuleTitle] = useState("");
  const [capsuleMessage, setCapsuleMessage] = useState("");
  const [capsuleOpenDate, setCapsuleOpenDate] = useState(getDefaultCapsuleDate);
  const [capsuleSaveFeedback, setCapsuleSaveFeedback] = useState("封存此刻");
  const [timeCapsules, setTimeCapsules] = useState<TimeCapsuleEntry[]>(() => oracleDataService.capsules.load());
  const [reportSaveFeedback, setReportSaveFeedback] = useState("收成本月报告");
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReportSnapshot[]>(() =>
    oracleDataService.monthlyReports.load(),
  );
  const [readingHistory, setReadingHistory] = useState<阅读记录[]>(() => oracleDataService.readings.load());
  const [dailyRecords, setDailyRecords] = useState<每日记录[]>(() => oracleDataService.daily.load());
  const [expandedReadingPanels, setExpandedReadingPanels] =
    useState<Record<ReadingPanelKey, boolean>>(defaultReadingPanels);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isDailyOpen, setIsDailyOpen] = useState(false);
  const [isDreamPanelOpen, setIsDreamPanelOpen] = useState(false);
  const [isCapsulePanelOpen, setIsCapsulePanelOpen] = useState(false);
  const [isReportPanelOpen, setIsReportPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState("可将全部档案保存到本地文件。");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const revealTimers = useRef<number[]>([]);
  const ringSpinRaf = useRef<number | null>(null);
  const ringSpinState = useRef<{ direction: 1 | -1; lastTime: number | null } | null>(null);
  const lastSavedReadingSignature = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("oracle-theme", theme);
  }, [theme]);

  useEffect(() => startSyncQueue(), []);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [question]);

  useEffect(() => {
    return () => {
      revealTimers.current.forEach((timer) => window.clearTimeout(timer));
      if (ringSpinRaf.current) {
        window.cancelAnimationFrame(ringSpinRaf.current);
      }
    };
  }, []);

  const currentStepIndex = stepOrder.indexOf(step);
  const progress = ((currentStepIndex + 1) / stepOrder.length) * 100;
  const canContinue = question.trim().length > 0;
  const canGoBack = workspaceView === "timeline" || step !== "landing";

  const visibleRingCards = useMemo(() => {
    const radiusX =
      viewportWidth < 420 ? 124 : viewportWidth < 640 ? 150 : viewportWidth < 1024 ? 206 : 252;
    const radiusY =
      viewportWidth < 420 ? 62 : viewportWidth < 640 ? 74 : viewportWidth < 1024 ? 94 : 112;
    return fakeRingCards.map((card) => {
      const angle = card.angleOffset + ringRotation - 90;
      const radians = (angle * Math.PI) / 180;
      const depth = (Math.sin(radians) + 1) / 2;
      const x = Math.cos(radians) * radiusX;
      const y = Math.sin(radians) * radiusY;
      const frontness = Math.sin(radians);

      return {
        ...card,
        x,
        y,
        depth,
        angle,
        frontness,
      };
    });
  }, [ringRotation, viewportWidth]);

  const cleanedReading = useMemo(() => cleanReadingOutput(readingText), [readingText]);
  const readingSections = useMemo(() => splitReadingSections(cleanedReading), [cleanedReading]);
  const archetypeProfile = useMemo(
    () =>
      buildArchetypeProfile({
        cards: drawnCards,
        spread: selectedSpread,
        interpretationMode,
      }),
    [drawnCards, interpretationMode, selectedSpread],
  );
  const dreamSymbolSuggestions = useMemo(() => {
    const symbols = new Set<string>();

    drawnCards.forEach((card) => {
      symbols.add(card.nameZh);
      symbols.add(card.archetypeZh);
      card.lightZh.slice(0, 1).forEach((item) => symbols.add(item));
      card.shadowZh.slice(0, 1).forEach((item) => symbols.add(item));
    });

    return Array.from(symbols).slice(0, 6);
  }, [drawnCards]);
  const recentDreamEntries = useMemo(() => dreamEntries.slice(0, 3), [dreamEntries]);
  const recentTimeCapsules = useMemo(() => timeCapsules.slice(0, 3), [timeCapsules]);
  const dueTimeCapsules = useMemo(
    () => timeCapsules.filter((entry) => countDueCapsules([entry]) > 0),
    [timeCapsules],
  );
  const monthlyReportPreview = useMemo(
    () =>
      buildMonthlyInnerReport({
        dreamEntries,
        timeCapsules,
        archetypeProfile,
        interpretationMode,
        question,
      }),
    [archetypeProfile, dreamEntries, interpretationMode, question, timeCapsules],
  );
  const recentMonthlyReports = useMemo(() => monthlyReports.slice(0, 3), [monthlyReports]);
  const recentReadingHistory = useMemo(() => readingHistory.slice(0, 10), [readingHistory]);
  const pendingDailyCount = useMemo(() => 今日待回应数量(dailyRecords), [dailyRecords]);
  const recentDailyRecords = useMemo(() => dailyRecords.slice(0, 8), [dailyRecords]);
  const syncStatusLabel = formatSyncStateLabel(syncState);

  useEffect(() => {
    let cancelled = false;

    const syncReadings = async () => {
      try {
        const serverRecords = await fetchServerReadings();
        if (cancelled) return;
        const localRecords = oracleDataService.readings.load();

        if (serverRecords.length) {
          setReadingHistory((current) => {
            const merged = mergeReadingRecords(current, serverRecords, 80);
            oracleDataService.readings.save(merged);
            return merged;
          });
        }

        const serverIds = new Set(serverRecords.map((record) => record.id));
        localRecords
          .filter((record) => !serverIds.has(record.id))
          .forEach((record) => void persistWithRetry({ entity: "reading", record }));
      } catch {
        // Server-side persistence is an enhancement; local records remain the source of truth if it is unavailable.
      }
    };

    const syncDailyRecords = async () => {
      try {
        const serverRecords = await fetchServerDailyRecords();
        if (cancelled) return;
        const localRecords = oracleDataService.daily.load();

        if (serverRecords.length) {
          setDailyRecords((current) => {
            const merged = mergeDailyRecords(current, serverRecords, 80);
            oracleDataService.daily.save(merged);
            return merged;
          });
        }

        const serverIds = new Set(serverRecords.map((record) => record.id));
        localRecords
          .filter((record) => !serverIds.has(record.id))
          .forEach((record) => void persistWithRetry({ entity: "daily", record }));
      } catch {
        // Daily records remain local-first if the server endpoint is temporarily unavailable.
      }
    };

    const syncDreamEntries = async () => {
      try {
        const serverRecords = await fetchServerDreamEntries();
        if (cancelled) return;
        const localRecords = oracleDataService.dreams.load();

        if (serverRecords.length) {
          setDreamEntries((current) => {
            const merged = mergeDreamEntries(current, serverRecords, 24);
            oracleDataService.dreams.save(merged);
            return merged;
          });
        }

        const serverIds = new Set(serverRecords.map((record) => record.id));
        localRecords
          .filter((record) => !serverIds.has(record.id))
          .forEach((record) => void persistWithRetry({ entity: "dream", record }));
      } catch {
        // Dream journal stays local-first if the server endpoint is temporarily unavailable.
      }
    };

    const syncTimeCapsules = async () => {
      try {
        const serverRecords = await fetchServerTimeCapsules();
        if (cancelled) return;
        const localRecords = oracleDataService.capsules.load();

        if (serverRecords.length) {
          setTimeCapsules((current) => {
            const merged = mergeTimeCapsules(current, serverRecords, 24);
            oracleDataService.capsules.save(merged);
            return merged;
          });
        }

        const serverIds = new Set(serverRecords.map((record) => record.id));
        localRecords
          .filter((record) => !serverIds.has(record.id))
          .forEach((record) => void persistWithRetry({ entity: "capsule", record }));
      } catch {
        // Time capsules remain local-first if the server endpoint is temporarily unavailable.
      }
    };

    const syncMonthlyReports = async () => {
      try {
        const serverRecords = await fetchServerMonthlyReports();
        if (cancelled) return;
        const localRecords = oracleDataService.monthlyReports.load();

        if (serverRecords.length) {
          setMonthlyReports((current) => {
            const merged = mergeMonthlyReports(current, serverRecords, 24);
            oracleDataService.monthlyReports.save(merged);
            return merged;
          });
        }

        const serverIds = new Set(serverRecords.map((record) => record.id));
        localRecords
          .filter((record) => !serverIds.has(record.id))
          .forEach((record) => void persistWithRetry({ entity: "monthlyReport", record }));
      } catch {
        // Monthly reports remain local-first if the server endpoint is temporarily unavailable.
      }
    };

    void syncReadings();
    void syncDailyRecords();
    void syncDreamEntries();
    void syncTimeCapsules();
    void syncMonthlyReports();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step !== "reading" || isStreaming || !question.trim() || !drawnCards.length || !cleanedReading) return;

    const signature = JSON.stringify({
      question: question.trim(),
      spreadId: selectedSpread.id,
      interpretationMode,
      cards: drawnCards.map((card) => `${card.id}:${card.orientation}`),
      readingText: cleanedReading,
    });

    if (lastSavedReadingSignature.current === signature) return;

    const record = 创建阅读记录({
      question: question.trim(),
      spreadId: selectedSpread.id,
      spreadName: selectedSpread.nameZh,
      interpretationMode,
      cards: drawnCards.map((card) => ({
        id: card.id,
        name: card.name,
        nameZh: card.nameZh,
        orientation: card.orientation,
        archetypeZh: card.archetypeZh,
      })),
      readingText: cleanedReading,
      profileName: archetypeProfile.profileName,
    });

    setReadingHistory((current) => {
      const next = [record, ...current].slice(0, 80);
      oracleDataService.readings.save(next);
      return next;
    });
    void persistWithRetry({ entity: "reading", record });

    const practicalGuidance = readingSections.find((section) => section.title === "实际建议")?.paragraphs?.[0];
    const dailyRecord = 创建每日记录({
      reading: record,
      ritualPrompt: archetypeProfile.ritualPrompt,
      practicalGuidance,
    });

    setDailyRecords((current) => {
      const next = [dailyRecord, ...current.filter((entry) => entry.readingId !== record.id)].slice(0, 80);
      oracleDataService.daily.save(next);
      return next;
    });
    void persistWithRetry({ entity: "daily", record: dailyRecord });

    lastSavedReadingSignature.current = signature;
  }, [
    archetypeProfile.profileName,
    archetypeProfile.ritualPrompt,
    cleanedReading,
    drawnCards,
    interpretationMode,
    isStreaming,
    question,
    readingSections,
    selectedSpread.id,
    selectedSpread.nameZh,
    step,
  ]);

  const startRevealSequence = (cards: DrawnCard[]) => {
    revealTimers.current.forEach((timer) => window.clearTimeout(timer));
    revealTimers.current = [];
    setRevealedCards([]);

    cards.forEach((_, index) => {
      const timer = window.setTimeout(() => {
        setRevealedCards((current) => [...current, index]);
      }, 420 * (index + 1));
      revealTimers.current.push(timer);
    });
  };

  const resetForHome = () => {
    lastSavedReadingSignature.current = null;
    setWorkspaceView("oracle");
    setStep("landing");
    setQuestion("");
    setSelectedSpread(spreads[2]);
    setInterpretationMode("standard");
    setDeckMode("stack");
    setRingRotation(0);
    setSelectedSlots([]);
    setDrawnCards([]);
    setRevealedCards([]);
    setReadingText("");
    setReadingError(null);
    setSelectionHint("先洗牌，让问题在心里停一停，再进入选牌。");
    setCopyFeedback("复制解读内容");
    setDreamTitle("");
    setDreamText("");
    setDreamMood("朦胧");
    setDreamSaveFeedback("写进梦境簿");
    setCapsuleTitle("");
    setCapsuleMessage("");
    setCapsuleOpenDate(getDefaultCapsuleDate());
    setCapsuleSaveFeedback("封存此刻");
    setReportSaveFeedback("收成本月报告");
    setExpandedReadingPanels(defaultReadingPanels);
    setIsRingSpinning(false);
  };

  const handleRestoreReading = (record: 阅读记录) => {
    const spread = spreads.find((item) => item.id === record.spreadId) ?? spreads[0];
    const restoredCards = record.cards
      .map((savedCard) => {
        const base = tarotDeck.find((card) => card.id === savedCard.id);
        return base ? { ...base, orientation: savedCard.orientation } : null;
      })
      .filter((card): card is DrawnCard => Boolean(card));

    setQuestion(record.question);
    setSelectedSpread(spread);
    setInterpretationMode(record.interpretationMode);
    setDrawnCards(restoredCards);
    setRevealedCards(restoredCards.map((_, index) => index));
    setReadingText(record.readingText);
    setReadingError(null);
    setIsStreaming(false);
    setExpandedReadingPanels(defaultReadingPanels);
    setWorkspaceView("oracle");
    setStep("reading");
    setIsSidebarOpen(false);
  };

  const handleCompleteDailyRecord = (dailyId: string) => {
    setDailyRecords((current) => {
      const next = 完成每日记录(current, dailyId);
      oracleDataService.daily.save(next);
      const completedRecord = next.find((entry) => entry.id === dailyId);
      if (completedRecord) {
        void persistWithRetry({ entity: "daily", record: completedRecord });
      }
      return next;
    });
  };

  const goBack = () => {
    if (!canGoBack) return;

    if (workspaceView === "timeline") {
      setWorkspaceView("oracle");
      return;
    }

    if (step === "question") {
      setStep("landing");
      return;
    }

    if (step === "spread") {
      setStep("question");
      return;
    }

    if (step === "deck") {
      setStep("spread");
      return;
    }

    if (step === "reveal") {
      setStep("deck");
      return;
    }

    if (step === "reading") {
      setStep("reveal");
    }
  };

  const handleStartDeck = () => {
    setDeckMode("stack");
    setSelectedSlots([]);
    setDrawnCards([]);
    setRevealedCards([]);
    setReadingText("");
    setReadingError(null);
    setRingRotation(0);
    setIsRingSpinning(false);
    setSelectionHint("先洗牌，让问题在心里停一停，再进入选牌。");
    setStep("deck");
  };

  const handleShuffle = () => {
    setDeckMode("shuffle");
    setSelectedSlots([]);
    setRingRotation(0);
    setIsRingSpinning(false);
    setSelectionHint("牌组正在重新洗切，请给它一点安静的时间。");

    window.setTimeout(() => {
      setDeckMode("stack");
      setSelectionHint("牌已经静下来。点“抽牌选牌”，让整组牌自然散开。");
    }, 1450);
  };

  const handleOpenSelection = () => {
    setDeckMode("ring");
    setSelectedSlots([]);
    setRingRotation(0);
    setIsRingSpinning(false);
    setSelectionHint(`轻按上方两侧，让牌环顺着你的方式缓缓转动；或交给命运，先收到 ${selectedSpread.cards} 张有缘之牌。`);
  };

  const toggleSelectSlot = (id: string) => {
    setSelectedSlots((current) => {
      if (current.includes(id)) {
        setSelectionHint("你放下了一张牌，继续感受剩下的牵引。");
        return current.filter((item) => item !== id);
      }

      if (current.length >= selectedSpread.cards) {
        setSelectionHint("已选满，请放下一张无缘的牌。");
        return current;
      }

      const next = [...current, id];
      if (next.length === selectedSpread.cards) {
        setSelectionHint("已经选满，现在可以确认选择，进入翻牌。");
      } else {
        setSelectionHint(`已选 ${next.length} / ${selectedSpread.cards} 张，继续挑选。`);
      }
      return next;
    });
  };

  const handleConfirmSelection = () => {
    if (selectedSlots.length !== selectedSpread.cards) {
      setSelectionHint("请先选满所需牌数，再确认选择。");
      return;
    }

    const cards = drawCards(selectedSpread.cards);
    setDrawnCards(cards);
    setStep("reveal");
    startRevealSequence(cards);
  };

  const stopRingSpin = () => {
    if (ringSpinRaf.current) {
      window.cancelAnimationFrame(ringSpinRaf.current);
      ringSpinRaf.current = null;
    }
    ringSpinState.current = null;
    setIsRingSpinning(false);
  };

  const rotateRing = (direction: "clockwise" | "counterclockwise", amount = 14) => {
    setDeckMode("ring");
    setRingRotation((current) => current + (direction === "clockwise" ? amount : -amount));
    setSelectionHint("牌环已经顺着你的触感轻轻转动，继续挑选让你停下来的牌。");
  };

  const startRingSpin = (direction: "clockwise" | "counterclockwise") => {
    stopRingSpin();
    rotateRing(direction, 1.2);
    setIsRingSpinning(true);
    ringSpinState.current = {
      direction: direction === "clockwise" ? 1 : -1,
      lastTime: null,
    };

    const tick = (time: number) => {
      if (!ringSpinState.current) return;
      const { direction: spinDirection, lastTime } = ringSpinState.current;
      const delta = lastTime === null ? 0 : time - lastTime;
      ringSpinState.current.lastTime = time;
      const degreesPerMs = 0.0145;
      setRingRotation((current) => current + spinDirection * delta * degreesPerMs);
      ringSpinRaf.current = window.requestAnimationFrame(tick);
    };

    ringSpinRaf.current = window.requestAnimationFrame(tick);
  };

  const handleRandomGive = () => {
    const interactiveIds = visibleRingCards
      .filter((card) => card.frontness > 0.28)
      .map((card) => card.id);

    const pool = [...interactiveIds];
    const nextSelected: string[] = [];

    while (pool.length && nextSelected.length < selectedSpread.cards) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      const [picked] = pool.splice(randomIndex, 1);
      if (picked) nextSelected.push(picked);
    }

    setDeckMode("ring");
    setSelectedSlots(nextSelected);
    setIsRingSpinning(false);
    setSelectionHint("命运替你轻轻递来了三张牌。若心意有变，也仍可以把它们轻触放下。");
  };

  const handleInterpretation = async () => {
    setStep("reading");
    setReadingText("");
    setReadingError(null);
    setIsStreaming(true);
    setExpandedReadingPanels(defaultReadingPanels);

    try {
      const response = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          spreadId: selectedSpread.id,
          interpretationMode,
          cards: drawnCards.map((card) => ({
            id: card.id,
            orientation: card.orientation,
          })),
        }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "暂时无法生成这次解读。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setReadingText((current) => current + decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      setReadingError(error instanceof Error ? error.message : "解读生成失败。");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleCopyReading = async () => {
    if (!cleanedReading) return;
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(cleanedReading);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = cleanedReading;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) {
          throw new Error("copy failed");
        }
      }
      setCopyFeedback("已复制");
      window.setTimeout(() => setCopyFeedback("复制解读内容"), 1800);
    } catch {
      setCopyFeedback("复制失败");
      window.setTimeout(() => setCopyFeedback("复制解读内容"), 1800);
    }
  };

  const handleSaveDreamJournal = () => {
    const normalizedDream = dreamText.trim();
    if (!normalizedDream) {
      setDreamSaveFeedback("先写下一段梦");
      window.setTimeout(() => setDreamSaveFeedback("写进梦境簿"), 1800);
      return;
    }

    const entry = createDreamJournalEntry({
      title: dreamTitle.trim() || "未命名梦境",
      dreamText: normalizedDream,
      mood: dreamMood,
      symbols: dreamSymbolSuggestions,
      linkedQuestion: question,
      linkedSpreadName: selectedSpread.nameZh,
      linkedCardNames: drawnCards.map((card) => card.nameZh),
      interpretationMode,
      archetypeProfileName: archetypeProfile.profileName,
    });

    const nextEntries = [entry, ...dreamEntries].slice(0, 12);
    setDreamEntries(nextEntries);
    oracleDataService.dreams.save(nextEntries);
    void persistWithRetry({ entity: "dream", record: entry });
    setDreamTitle("");
    setDreamText("");
    setDreamMood("朦胧");
    setDreamSaveFeedback("已收入梦境簿");
    window.setTimeout(() => setDreamSaveFeedback("写进梦境簿"), 1800);
  };

  const handleSaveTimeCapsule = () => {
    const normalizedMessage = capsuleMessage.trim();
    if (!normalizedMessage) {
      setCapsuleSaveFeedback("先写一句给未来的话");
      window.setTimeout(() => setCapsuleSaveFeedback("封存此刻"), 1800);
      return;
    }

    const entry = createTimeCapsuleEntry({
      title: capsuleTitle.trim() || "写给未来的自己",
      message: normalizedMessage,
      openDate: capsuleOpenDate,
      linkedQuestion: question,
      linkedSpreadName: selectedSpread.nameZh,
      linkedCardNames: drawnCards.map((card) => card.nameZh),
      interpretationMode,
      archetypeProfileName: archetypeProfile.profileName,
    });

    const nextEntries = [entry, ...timeCapsules].slice(0, 12);
    setTimeCapsules(nextEntries);
    oracleDataService.capsules.save(nextEntries);
    void persistWithRetry({ entity: "capsule", record: entry });
    setCapsuleTitle("");
    setCapsuleMessage("");
    setCapsuleOpenDate(getDefaultCapsuleDate());
    setCapsuleSaveFeedback("已封存");
    window.setTimeout(() => setCapsuleSaveFeedback("封存此刻"), 1800);
  };

  const handleSaveMonthlyReport = () => {
    const snapshot = createMonthlyReportSnapshot(monthlyReportPreview);
    const nextEntries = [snapshot, ...monthlyReports].slice(0, 12);
    setMonthlyReports(nextEntries);
    oracleDataService.monthlyReports.save(nextEntries);
    void persistWithRetry({ entity: "monthlyReport", record: snapshot });
    setReportSaveFeedback("已收进本月档案");
    window.setTimeout(() => setReportSaveFeedback("收成本月报告"), 1800);
  };

  const handleOpenDueCapsule = (capsuleId: string) => {
    const nextEntries = markCapsuleOpened(timeCapsules, capsuleId);
    setTimeCapsules(nextEntries);
    oracleDataService.capsules.save(nextEntries);
    const openedCapsule = nextEntries.find((entry) => entry.id === capsuleId);
    if (openedCapsule) {
      void persistWithRetry({ entity: "capsule", record: openedCapsule });
    }
  };

  const handleDismissDueCapsule = (capsuleId: string) => {
    const nextEntries = dismissCapsuleReminder(timeCapsules, capsuleId);
    setTimeCapsules(nextEntries);
    oracleDataService.capsules.save(nextEntries);
    const dismissedCapsule = nextEntries.find((entry) => entry.id === capsuleId);
    if (dismissedCapsule) {
      void persistWithRetry({ entity: "capsule", record: dismissedCapsule });
    }
  };

  const handleExportArchive = () => {
    try {
      const backup = createOracleBackup(oracleDataService.loadSnapshot());
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `神谕室档案-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setBackupFeedback("档案已经整理完成并开始下载。");
    } catch {
      setBackupFeedback("档案导出失败，请稍后再试。");
    }
  };

  const handleImportArchive = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      if (file.size > 5_000_000) {
        throw new Error("Archive is too large.");
      }

      const backup = parseOracleBackup(await file.text());
      const nextReadings = mergeReadingRecords(readingHistory, backup.data.readings, 80);
      const nextDaily = mergeDailyRecords(dailyRecords, backup.data.daily, 80);
      const nextDreams = mergeDreamEntries(dreamEntries, backup.data.dreams, 24);
      const nextCapsules = mergeTimeCapsules(timeCapsules, backup.data.capsules, 24);
      const nextReports = mergeMonthlyReports(monthlyReports, backup.data.monthlyReports, 24);

      oracleDataService.readings.save(nextReadings);
      oracleDataService.daily.save(nextDaily);
      oracleDataService.dreams.save(nextDreams);
      oracleDataService.capsules.save(nextCapsules);
      oracleDataService.monthlyReports.save(nextReports);
      setReadingHistory(nextReadings);
      setDailyRecords(nextDaily);
      setDreamEntries(nextDreams);
      setTimeCapsules(nextCapsules);
      setMonthlyReports(nextReports);

      const importedReadingIds = new Set(backup.data.readings.map((record) => record.id));
      const importedDailyIds = new Set(backup.data.daily.map((record) => record.id));
      const importedDreamIds = new Set(backup.data.dreams.map((record) => record.id));
      const importedCapsuleIds = new Set(backup.data.capsules.map((record) => record.id));
      const importedReportIds = new Set(backup.data.monthlyReports.map((record) => record.id));

      nextReadings
        .filter((record) => importedReadingIds.has(record.id))
        .forEach((record) => void persistWithRetry({ entity: "reading", record }));
      nextDaily
        .filter((record) => importedDailyIds.has(record.id))
        .forEach((record) => void persistWithRetry({ entity: "daily", record }));
      nextDreams
        .filter((record) => importedDreamIds.has(record.id))
        .forEach((record) => void persistWithRetry({ entity: "dream", record }));
      nextCapsules
        .filter((record) => importedCapsuleIds.has(record.id))
        .forEach((record) => void persistWithRetry({ entity: "capsule", record }));
      nextReports
        .filter((record) => importedReportIds.has(record.id))
        .forEach((record) => void persistWithRetry({ entity: "monthlyReport", record }));

      const importedCount =
        backup.data.readings.length +
        backup.data.daily.length +
        backup.data.dreams.length +
        backup.data.capsules.length +
        backup.data.monthlyReports.length;
      setBackupFeedback(`已读取 ${importedCount} 条档案内容，并与当前记录完成合并。`);
    } catch {
      setBackupFeedback("无法读取这个文件，请确认它是由神谕室导出的档案。");
    }
  };

  const toggleTheme = (nextTheme: ThemeMode) => {
    window.localStorage.setItem("oracle-theme", nextTheme);
    window.dispatchEvent(new Event("oracle-theme-change"));
  };

  const toggleReadingPanel = (panel: ReadingPanelKey) => {
    setExpandedReadingPanels((current) => ({
      ...current,
      [panel]: !current[panel],
    }));
  };

  const handleFreshReading = () => {
    resetForHome();
    setWorkspaceView("oracle");
    setStep("question");
    setIsSidebarOpen(false);
  };

  const handleSidebarGuide = () => {
    setIsGuideOpen(true);
    setIsSidebarOpen(false);
  };

  const handleSidebarTimeline = () => {
    setWorkspaceView("timeline");
    setIsSidebarOpen(false);
  };

  const handleSidebarDaily = () => {
    setIsDailyOpen(true);
    setIsSidebarOpen(false);
  };

  const handleSidebarDream = () => {
    setIsDreamPanelOpen(true);
    setIsSidebarOpen(false);
  };

  const handleSidebarCapsule = () => {
    setIsCapsulePanelOpen(true);
    setIsSidebarOpen(false);
  };

  const handleSidebarReport = () => {
    setIsReportPanelOpen(true);
    setIsSidebarOpen(false);
  };

  const handleExitExperience = () => {
    resetForHome();
    setIsSidebarOpen(false);
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-3 py-3 text-[var(--foreground)] sm:px-4 lg:px-5 xl:px-6">
      <div className="mx-auto relative min-h-[calc(100vh-1.5rem)] max-w-[1600px]">
        <AnimatePresence>
          {isSidebarOpen ? (
            <OracleSidebarShell
              key="mobile-sidebar"
              collapsed={false}
              mobile
              step={step}
              onClose={() => setIsSidebarOpen(false)}
              onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
              onFreshReading={handleFreshReading}
              onOpenGuide={handleSidebarGuide}
              onOpenTimeline={handleSidebarTimeline}
              onOpenDaily={handleSidebarDaily}
              onOpenDream={handleSidebarDream}
              onOpenCapsule={handleSidebarCapsule}
              onOpenReport={handleSidebarReport}
              pendingDailyCount={pendingDailyCount}
              dueCapsuleCount={dueTimeCapsules.length}
              pendingSyncCount={syncState.pendingCount}
              syncLabel={syncStatusLabel}
              onOpenSettings={() => {
                setIsSettingsOpen(true);
                setIsSidebarOpen(false);
              }}
              onOpenMessages={() => {
                setIsMessagesOpen(true);
                setIsSidebarOpen(false);
              }}
              onExit={handleExitExperience}
            />
          ) : null}
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 hidden lg:block">
          <div className="pointer-events-auto h-full">
            <OracleSidebarShell
              collapsed={isSidebarCollapsed}
              mobile={false}
              step={step}
              onClose={() => undefined}
              onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
              onFreshReading={handleFreshReading}
              onOpenGuide={handleSidebarGuide}
              onOpenTimeline={handleSidebarTimeline}
              onOpenDaily={handleSidebarDaily}
              onOpenDream={handleSidebarDream}
              onOpenCapsule={handleSidebarCapsule}
              onOpenReport={handleSidebarReport}
              pendingDailyCount={pendingDailyCount}
              dueCapsuleCount={dueTimeCapsules.length}
              pendingSyncCount={syncState.pendingCount}
              syncLabel={syncStatusLabel}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenMessages={() => setIsMessagesOpen(true)}
              onExit={handleExitExperience}
            />
          </div>
        </div>

        <div
          className="flex min-h-[calc(100vh-1.5rem)] min-w-0 flex-1 flex-col transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:pl-[var(--sidebar-space)]"
          style={
            {
              ["--sidebar-space" as string]: isSidebarCollapsed ? "6.75rem" : "19rem",
            } as CSSProperties
          }
        >
          <header className="paper-panel sticky top-3 z-30 flex items-center justify-between rounded-full px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)] lg:hidden"
                aria-label="打开侧边栏"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="flex min-w-0 items-center gap-3 lg:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)]">
                  <Sparkles className="h-4 w-4 text-[var(--gold)]" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs uppercase tracking-[0.3em] text-[var(--muted)]">神谕室</p>
                  <p className="truncate text-sm text-[var(--foreground)]/80">现代禅意塔罗空间</p>
                </div>
              </div>

              <div className="hidden items-center gap-2 sm:flex">
                <HeaderNavButton
                  disabled={!canGoBack}
                  title="后悔一次。"
                  ariaLabel="返回上一步"
                  onClick={goBack}
                  icon={<ChevronLeft className="h-4 w-4" />}
                  label="返回"
                />
                <HeaderNavButton
                  disabled={!canGoBack}
                  title="趁现在，回到最开始。"
                  ariaLabel="回到首页"
                  onClick={resetForHome}
                  icon={<Home className="h-4 w-4" />}
                  label="首页"
                />
              </div>

              <div className="hidden items-center gap-3 rounded-full border border-[var(--line)] px-4 py-2 text-xs tracking-[0.24em] text-[var(--muted)] md:flex">
                <span>仪式进程</span>
                <div className="h-px w-16 overflow-hidden rounded-full bg-[var(--line)]">
                  <div
                    className="h-full rounded-full bg-[var(--gold)] transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                className="rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-2 text-sm text-[var(--foreground)]"
              >
                <span className="inline-flex items-center gap-2">
                  <ScrollText className="h-4 w-4" />
                  <span className="hidden sm:inline">使用说明</span>
                </span>
              </button>

              <button
                type="button"
                aria-label={theme === "light" ? "切换夜间模式" : "切换浅色模式"}
                onClick={() => {
                  const nextTheme = theme === "light" ? "dark" : "light";
                  window.localStorage.setItem("oracle-theme", nextTheme);
                  window.dispatchEvent(new Event("oracle-theme-change"));
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)]"
              >
                {theme === "light" ? (
                  <MoonStar className="h-4 w-4 text-[var(--foreground)]" />
                ) : (
                  <SunMedium className="h-4 w-4 text-[var(--gold)]" />
                )}
              </button>
            </div>
          </header>

          <div className="relative flex flex-1 flex-col justify-center py-5 sm:py-7 lg:py-9">
          <AmbientBackdrop />

          <AnimatePresence mode="wait">
            {workspaceView === "timeline" && (
              <motion.section key="timeline-view" {...sectionFade} className="mx-auto w-full max-w-6xl space-y-6">
                <div className="paper-panel rounded-[2rem] p-6 sm:p-8">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-4">
                      <p className="text-sm uppercase tracking-[0.34em] text-[var(--muted)]">灵魂时间线</p>
                      <h2 className="editorial-title max-w-[12ch] text-balance text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.02]">
                        把每一次提问，留成一条能回看的内在线索。
                      </h2>
                      <p className="max-w-3xl text-base leading-7 text-[var(--muted)]">
                        这里先收起你在这台设备上完成的阅读。等后面接上账号与云端，它就会继续长成真正属于你的长期轨迹。
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setWorkspaceView("oracle")}
                        className="rounded-full border border-[var(--line)] px-5 py-3 text-sm text-[var(--foreground)]"
                      >
                        返回神谕室
                      </button>
                      <button
                        type="button"
                        onClick={handleSidebarDaily}
                        className="rounded-full bg-[var(--foreground)] px-5 py-3 text-sm tracking-[0.16em] text-[var(--background)]"
                      >
                        打开每日记录
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <TimelineSummaryCard label="累计阅读" value={`${readingHistory.length}`} hint="已经被收进时间线的阅读次数" />
                  <TimelineSummaryCard
                    label="待回应小事"
                    value={`${pendingDailyCount}`}
                    hint="适合明天继续完成的一件小事"
                  />
                  <TimelineSummaryCard
                    label="阴影模式"
                    value={`${readingHistory.filter((entry) => entry.interpretationMode === "shadow").length}`}
                    hint="更靠近回避、投射与惯性循环的阅读"
                  />
                  <TimelineSummaryCard
                    label="最近回声"
                    value={readingHistory[0] ? formatLocalDate(readingHistory[0].createdAt) : "尚未开始"}
                    hint="最近一次被记住的提问时间"
                  />
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
                  <div className="space-y-6">
                    <div className="paper-panel rounded-[2rem] p-6">
                      <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">这条线会记住什么</p>
                      <div className="mt-4 space-y-4 text-sm leading-7 text-[var(--muted)]">
                        <p>每次阅读结束后，问题、牌阵、抽到的牌、解读取向、牌面回声与反思问题都会先被留在这里。</p>
                        <p>你以后回头看时，不只是复习牌面，而是在看自己究竟在重复什么、靠近什么、终于放下了什么。</p>
                      </div>
                    </div>

                    <div className="paper-panel rounded-[2rem] p-6">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">????????</p>
                        <span className="rounded-full bg-[rgba(214,168,95,0.12)] px-3 py-1 text-xs text-[var(--gold)]">
                          {pendingDailyCount} ?
                        </span>
                      </div>
                      {recentDailyRecords.length ? (
                        <div className="mt-4 space-y-3">
                          {recentDailyRecords.slice(0, 3).map((entry) => {
                            const isDone = Boolean(entry.completedAt);
                            const today = new Date().toISOString().slice(0, 10);
                            const dailyStatus = isDone
                              ? "???"
                              : entry.dueDate > today
                                ? `?? ${entry.dueDate} ??`
                                : "?????";
                            return (
                              <div
                                key={entry.id}
                                className="rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm text-[var(--foreground)]">{entry.title}</p>
                                    <p className="mt-2 text-xs leading-6 text-[var(--muted)]">{entry.prompt}</p>
                                  </div>
                                  <span
                                    className={`rounded-full px-3 py-1 text-[11px] tracking-[0.14em] ${
                                      isDone
                                        ? "bg-[rgba(124,149,168,0.14)] text-[var(--secondary)]"
                                        : "bg-[rgba(214,168,95,0.12)] text-[var(--gold)]"
                                    }`}
                                  >
                                    {dailyStatus}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                          ??????????????????????????????
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {readingHistory.length ? (
                      readingHistory.map((record) => (
                        <TimelineReadingCard
                          key={record.id}
                          record={record}
                          onRestore={() => handleRestoreReading(record)}
                        />
                      ))
                    ) : (
                      <div className="paper-panel rounded-[2rem] border border-dashed border-[var(--line)] px-6 py-8 text-sm leading-7 text-[var(--muted)]">
                        你的第一条灵魂时间线，还在等待一次完整阅读。等你问出一个真实的问题，这里就会开始留下回声。
                      </div>
                    )}
                  </div>
                </div>
              </motion.section>
            )}

            {workspaceView === "oracle" && step === "landing" && (
              <motion.section
                key="landing"
                {...sectionFade}
                className="grid gap-8 xl:grid-cols-[minmax(0,0.92fr)_minmax(24rem,0.92fr)] xl:items-center xl:gap-10"
              >
                <div className="space-y-7 xl:space-y-8">
                  <div className="space-y-4">
                    <p className="text-sm uppercase tracking-[0.38em] text-[var(--muted)]">数字神谕室</p>
                    <h1 className="editorial-title text-[clamp(2.1rem,9vw,4.75rem)] font-semibold leading-[0.92] tracking-[-0.04em]">
                      <span className="block whitespace-nowrap">读懂象征，</span>
                      <span className="block whitespace-nowrap">慢一点听见自己。</span>
                    </h1>
                    <p className="max-w-2xl text-base leading-8 text-[var(--muted)] md:text-lg">
                      把提问、抽牌、翻牌和解读做成一场慢节奏的数字仪式。它不像一个宣判命运的机器，更像一封写给你的私人占卜来信。
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => setStep("question")}
                      className="rounded-full bg-[var(--foreground)] px-8 py-4 text-sm uppercase tracking-[0.28em] text-[var(--background)] hover:-translate-y-0.5"
                    >
                      开始抽牌
                    </button>
                    <div className="paper-panel rounded-full px-5 py-4 text-sm text-[var(--muted)] sm:px-6">
                      好奇、仪式、悬念、显现、反思、收束。
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-[42rem] xl:justify-self-end 2xl:max-w-[44rem]">
                  <HeroPreview />
                </div>
              </motion.section>
            )}

            {workspaceView === "oracle" && step === "question" && (
              <StepShell step={step}>
                <div className="paper-panel rounded-[2rem] px-6 py-8 sm:px-8 sm:py-10">
                  <StepIntro step={step} />
                  <div className="relative mt-10 rounded-[2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-5 py-5">
                    <label
                      className={`pointer-events-none absolute left-5 transition-all duration-500 ${
                        question
                          ? "top-3 text-xs uppercase tracking-[0.28em] text-[var(--gold)]"
                          : "top-5 text-base text-[var(--muted)]"
                      }`}
                    >
                      你今天想把什么问题轻轻放在这里？
                    </label>
                    <textarea
                      ref={textareaRef}
                      value={question}
                      onChange={(event) => setQuestion(event.target.value.slice(0, 240))}
                      rows={1}
                      className="mt-7 min-h-32 w-full resize-none bg-transparent text-xl leading-9 outline-none"
                    />
                    <div className="mt-4 flex items-center justify-between gap-4 text-sm text-[var(--muted)]">
                      <span>问题越诚实，牌面越容易照见真正的情绪核心。</span>
                      <span>{question.length}/240</span>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end">
                    <button
                      type="button"
                      disabled={!canContinue}
                      onClick={() => setStep("spread")}
                      className="rounded-full bg-[var(--foreground)] px-7 py-3 text-sm uppercase tracking-[0.26em] text-[var(--background)] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      继续
                    </button>
                  </div>
                </div>
              </StepShell>
            )}

            {workspaceView === "oracle" && step === "spread" && (
              <StepShell step={step}>
                <div className="space-y-8">
                  <StepIntro step={step} />
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    {spreads.map((spread) => {
                      const selected = spread.id === selectedSpread.id;
                      return (
                        <button
                          key={spread.id}
                          type="button"
                          onClick={() => setSelectedSpread(spread)}
                          className={`paper-panel group rounded-[1.8rem] px-5 py-6 text-left transition-all duration-500 ${
                            selected
                              ? "soft-ring -translate-y-1.5 border-[rgba(214,168,95,0.34)] bg-[linear-gradient(180deg,rgba(255,251,243,0.98),rgba(255,245,227,0.88))] shadow-[0_18px_42px_rgba(214,168,95,0.14)]"
                              : "hover:-translate-y-1"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                              {spread.cards} 张牌
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs tracking-[0.18em] ${
                                selected
                                  ? "border border-[rgba(214,168,95,0.22)] bg-[rgba(214,168,95,0.12)] text-[var(--gold)]"
                                  : "border border-[rgba(124,149,168,0.2)] bg-[rgba(124,149,168,0.1)] text-[var(--blue)]"
                              }`}
                            >
                              {selected ? "已选择" : "选择"}
                            </span>
                          </div>
                          <h3 className="editorial-title mt-5 text-3xl font-semibold">{spread.nameZh}</h3>
                          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{spread.subtitle}</p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm uppercase tracking-[0.34em] text-[var(--muted)]">解读取向</p>
                      <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
                        先决定这次更想被温柔照见，还是更愿意往阴影深处多走一步。
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {interpretationModes.map((mode) => {
                        const selected = interpretationMode === mode.id;

                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setInterpretationMode(mode.id)}
                            className={`paper-panel group rounded-[1.7rem] px-5 py-5 text-left transition-all duration-500 ${
                              selected
                                ? "soft-ring -translate-y-1 border-[rgba(214,168,95,0.34)] bg-[linear-gradient(180deg,rgba(255,251,243,0.98),rgba(255,245,227,0.88))] shadow-[0_18px_42px_rgba(214,168,95,0.14)]"
                                : "hover:-translate-y-1"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">{mode.label}</span>
                              <span
                                className={`rounded-full px-3 py-1 text-xs tracking-[0.18em] ${
                                  selected
                                    ? "border border-[rgba(214,168,95,0.22)] bg-[rgba(214,168,95,0.12)] text-[var(--gold)]"
                                    : "border border-[rgba(124,149,168,0.2)] bg-[rgba(124,149,168,0.1)] text-[var(--blue)]"
                                }`}
                              >
                                {selected ? "已进入" : "选择"}
                              </span>
                            </div>
                            <h3 className="editorial-title mt-4 text-2xl font-semibold">{mode.title}</h3>
                            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{mode.subtitle}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleStartDeck}
                      className="rounded-full bg-[var(--foreground)] px-7 py-3 text-sm uppercase tracking-[0.26em] text-[var(--background)]"
                    >
                      进入牌组
                    </button>
                  </div>
                </div>
              </StepShell>
            )}

            {workspaceView === "oracle" && step === "deck" && (
              <motion.section
                key="deck"
                {...sectionFade}
                className="grid gap-8 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] xl:items-center xl:gap-10"
              >
                <div className="space-y-6">
                  <StepIntro step={step} />
                  <div className="paper-panel flex flex-wrap gap-3 rounded-[1.75rem] p-4 text-sm text-[var(--muted)]">
                    <span>牌库数量：{tarotDeck.length} 张</span>
                    <span>当前牌阵：{selectedSpread.nameZh}</span>
                    <span>需要选择：{selectedSpread.cards} 张</span>
                    <span>解读取向：{interpretationMode === "shadow" ? "阴影模式" : "清明模式"}</span>
                  </div>

                  <div className="rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
                    {selectionHint}
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <button
                      type="button"
                      onClick={handleShuffle}
                      className="rounded-full border border-[var(--line)] px-7 py-3 text-sm uppercase tracking-[0.26em] text-[var(--foreground)]"
                    >
                      洗牌
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenSelection}
                      className="rounded-full bg-[var(--foreground)] px-7 py-3 text-sm uppercase tracking-[0.26em] text-[var(--background)]"
                    >
                      抽牌选牌
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmSelection}
                      className="rounded-full border border-[var(--line)] px-7 py-3 text-sm uppercase tracking-[0.26em] text-[var(--foreground)]"
                    >
                      确认选择
                    </button>
                  </div>
                </div>

                <DeckScene
                  deckMode={deckMode}
                  ringCards={visibleRingCards}
                  selectedSlots={selectedSlots}
                  maxCards={selectedSpread.cards}
                  onToggleSlot={toggleSelectSlot}
                  onRotateClockwiseStart={() => startRingSpin("clockwise")}
                  onRotateCounterclockwiseStart={() => startRingSpin("counterclockwise")}
                  onRotateStop={stopRingSpin}
                  onRandomGive={handleRandomGive}
                  isRingSpinning={isRingSpinning}
                />
              </motion.section>
            )}

            {workspaceView === "oracle" && step === "reveal" && (
              <StepShell step={step}>
                <div className="space-y-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <StepIntro step={step} />
                    <button
                      type="button"
                      onClick={handleInterpretation}
                      className="rounded-full bg-[var(--foreground)] px-7 py-3 text-sm uppercase tracking-[0.26em] text-[var(--background)]"
                    >
                      开始解读
                    </button>
                  </div>

                  <div className={`grid gap-5 ${selectedSpread.cards === 1 ? "max-w-sm" : "md:grid-cols-3"}`}>
                    {drawnCards.map((card, index) => {
                      const revealed = revealedCards.includes(index);
                      return (
                        <motion.article
                          key={`${card.id}-${index}`}
                          initial={{ opacity: 0, y: 22, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ delay: index * 0.16, duration: 0.72, ease: "easeOut" }}
                          className="relative"
                        >
                          <div className="relative h-[27rem] [perspective:1200px]">
                            <motion.div
                              animate={{ rotateY: revealed ? 180 : 0 }}
                              transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
                              className="relative h-full w-full [transform-style:preserve-3d]"
                            >
                              <CardBack />
                              <CardFace card={card} revealed={revealed} />
                            </motion.div>
                          </div>
                        </motion.article>
                      );
                    })}
                  </div>
                </div>
              </StepShell>
            )}

            {workspaceView === "oracle" && step === "reading" && (
              <motion.section
                key="reading"
                {...sectionFade}
                className="grid gap-6 2xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] 2xl:items-start"
              >
                <div className="paper-panel rounded-[2rem] p-6 sm:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
                    <div>
                      <p className="text-sm uppercase tracking-[0.28em] text-[var(--muted)]">牌面解读</p>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        解读区域固定在这里，可以上下滚动阅读，也可以一键复制。
                      </p>
                      <div className="mt-4 rounded-[1.1rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm leading-7 text-[var(--foreground)]/82">
                        此刻被你放进牌阵里的问题：{question}
                      </div>
                      <div className="mt-3 inline-flex rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-2 text-xs tracking-[0.18em] text-[var(--muted)]">
                        {interpretationMode === "shadow" ? "本次正在进入阴影模式" : "本次采用清明模式"}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleCopyReading}
                        disabled={!cleanedReading}
                        className="rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--foreground)] disabled:opacity-40"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Copy className="h-4 w-4" />
                          {copyFeedback}
                        </span>
                      </button>
                      {isStreaming ? <LoaderCircle className="mt-2 h-5 w-5 animate-spin text-[var(--gold)]" /> : null}
                    </div>
                  </div>

                  <div className="reading-scroll mt-6 h-[24rem] overflow-y-auto pr-2 sm:h-[26rem] lg:h-[30rem] xl:h-[32rem]">
                    {readingSections.length ? (
                      <div className={isStreaming ? "streaming-caret" : ""}>
                        {readingSections.map((section) => (
                          <section
                            key={section.title}
                            className="reading-letter-card mb-5 rounded-[1.5rem] border border-[var(--line)] px-5 py-5 last:mb-0"
                          >
                            <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">来信片段</p>
                            <h3 className="editorial-title mt-3 text-[1.55rem] font-semibold tracking-[-0.02em]">
                              {section.title}
                            </h3>
                            <div className="mt-4 space-y-4 text-[15px] leading-8 text-[var(--foreground)]/88">
                              {section.paragraphs.map((paragraph, index) => (
                                <p key={`${section.title}-${index}`}>{paragraph}</p>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm leading-8 text-[var(--muted)]">
                        解读会在这里逐段浮现，一位私人占卜师正在慢慢为你写信。
                      </p>
                    )}
                    {readingError ? <p className="mt-4 text-sm text-red-500">{readingError}</p> : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <StepIntro step={step} />

                  <ReadingCollapsibleCard
                    title="原型画像"
                    subtitle={archetypeProfile.profileName}
                    badge={interpretationMode === "shadow" ? "阴影模式" : "清明模式"}
                    expanded={expandedReadingPanels.archetype}
                    onToggle={() => toggleReadingPanel("archetype")}
                  >
                    <p className="text-sm leading-7 text-[var(--muted)]">{archetypeProfile.summary}</p>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">当前主导原型</p>
                        <p className="mt-3 text-sm leading-7 text-[var(--foreground)]/86">
                          {archetypeProfile.dominantArchetypes.join(" / ")}
                        </p>
                      </div>
                      <div className="rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">此刻正在发光</p>
                        <p className="mt-3 text-sm leading-7 text-[var(--foreground)]/86">
                          {archetypeProfile.lightTraits.join("、")}
                        </p>
                      </div>
                      <div className="rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">需要留意的阴影</p>
                        <p className="mt-3 text-sm leading-7 text-[var(--foreground)]/86">
                          {archetypeProfile.shadowTraits.join("、")}
                        </p>
                      </div>
                      <div className="rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">今夜可做的小练习</p>
                        <p className="mt-3 text-sm leading-7 text-[var(--foreground)]/86">
                          {archetypeProfile.ritualPrompt}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 space-y-4">
                      <div className="rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">此刻画像</p>
                        <p className="mt-3 text-sm leading-7 text-[var(--foreground)]/86">
                          {archetypeProfile.currentPattern}
                        </p>
                      </div>
                      <div className="rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">正在靠近的成长边缘</p>
                        <p className="mt-3 text-sm leading-7 text-[var(--foreground)]/86">
                          {archetypeProfile.growthEdge}
                        </p>
                      </div>
                    </div>
                  </ReadingCollapsibleCard>

                  <ReadingCollapsibleCard
                    title="梦境记录"
                    subtitle="把梦，也收进这次阅读里。"
                    badge="本地记录"
                    expanded={expandedReadingPanels.dream}
                    onToggle={() => toggleReadingPanel("dream")}
                  >
                    <p className="text-sm leading-7 text-[var(--muted)]">
                      如果这次牌面勾出了某个梦、某个模糊画面，或者一种说不清的夜间情绪，就先把它轻轻记下来。后面做时间线和月度报告时，它会是很重要的一块拼图。
                    </p>
                    <div className="mt-5 grid gap-4">
                      <input
                        value={dreamTitle}
                        onChange={(event) => setDreamTitle(event.target.value.slice(0, 40))}
                        placeholder="给这段梦一个名字，例如：雨夜里的长廊"
                        className="rounded-[1.15rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm outline-none placeholder:text-[var(--muted)]"
                      />
                      <textarea
                        value={dreamText}
                        onChange={(event) => setDreamText(event.target.value.slice(0, 800))}
                        rows={5}
                        placeholder="写下你还记得的画面、人物、重复出现的场景，或者醒来时最强烈的感受。"
                        className="resize-none rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4 text-sm leading-7 outline-none placeholder:text-[var(--muted)]"
                      />
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {dreamMoods.map((mood) => {
                        const selected = mood === dreamMood;
                        return (
                          <button
                            key={mood}
                            type="button"
                            onClick={() => setDreamMood(mood)}
                            className={`rounded-full border px-3 py-1.5 text-xs tracking-[0.16em] ${
                              selected
                                ? "border-[rgba(214,168,95,0.24)] bg-[rgba(214,168,95,0.12)] text-[var(--gold)]"
                                : "border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--muted)]"
                            }`}
                          >
                            {mood}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-5 rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">这次阅读留下的梦境线索</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {dreamSymbolSuggestions.map((symbol) => (
                          <span
                            key={symbol}
                            className="rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.24)] px-3 py-1.5 text-xs text-[var(--foreground)]/82"
                          >
                            {symbol}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs leading-6 text-[var(--muted)]">
                        它会连同本次问题、牌阵、牌名和原型画像一起被保存到本地设备里。
                      </p>
                      <button
                        type="button"
                        onClick={handleSaveDreamJournal}
                        className="rounded-full bg-[var(--foreground)] px-5 py-3 text-sm tracking-[0.18em] text-[var(--background)]"
                      >
                        {dreamSaveFeedback}
                      </button>
                    </div>
                    {recentDreamEntries.length ? (
                      <div className="mt-6 space-y-3">
                        <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">最近写下的梦</p>
                        <div className="grid gap-3">
                          {recentDreamEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm text-[var(--foreground)]">{entry.title}</p>
                                <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                                  {entry.mood}
                                </span>
                              </div>
                              <p className="mt-2 max-h-[5.5rem] overflow-hidden text-sm leading-7 text-[var(--muted)]">
                                {entry.dreamText}
                              </p>
                              <p className="mt-3 text-xs leading-6 text-[var(--muted)]">
                                连接到：{entry.archetypeProfileName} · {entry.linkedSpreadName}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </ReadingCollapsibleCard>

                  <ReadingCollapsibleCard
                    title="时间胶囊"
                    subtitle="把此刻，寄给未来的自己。"
                    badge="本地封存"
                    expanded={expandedReadingPanels.capsule}
                    onToggle={() => toggleReadingPanel("capsule")}
                  >
                    <p className="text-sm leading-7 text-[var(--muted)]">
                      如果这次阅读让你想对未来的自己留一句话，或者想把今天的情绪、决心、犹豫封存在某个日期之后再打开，就先把它写下来。以后做时间线与月度报告时，它会成为最动人的回声。
                    </p>
                    <div className="mt-5 grid gap-4">
                      <input
                        value={capsuleTitle}
                        onChange={(event) => setCapsuleTitle(event.target.value.slice(0, 40))}
                        placeholder="给这枚时间胶囊一个名字，例如：六月末再打开"
                        className="rounded-[1.15rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm outline-none placeholder:text-[var(--muted)]"
                      />
                      <textarea
                        value={capsuleMessage}
                        onChange={(event) => setCapsuleMessage(event.target.value.slice(0, 800))}
                        rows={5}
                        placeholder="写给未来的自己：此刻我在想什么、怕什么、想记住什么，希望那时的我再回头看见什么。"
                        className="resize-none rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4 text-sm leading-7 outline-none placeholder:text-[var(--muted)]"
                      />
                      <div className="rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">准备在哪一天重新打开</p>
                        <input
                          type="date"
                          value={capsuleOpenDate}
                          onChange={(event) => setCapsuleOpenDate(event.target.value)}
                          className="mt-3 rounded-[1rem] border border-[var(--line)] bg-transparent px-4 py-3 text-sm outline-none"
                        />
                      </div>
                    </div>
                    <div className="mt-5 rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">这枚胶囊会一起封存</p>
                      <p className="mt-3 text-sm leading-7 text-[var(--foreground)]/86">
                        当前问题、牌阵、抽到的牌名、解读取向，以及这次生成的原型画像：
                        <span className="text-[var(--foreground)]"> {archetypeProfile.profileName}</span>
                      </p>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs leading-6 text-[var(--muted)]">
                        它会先静静留在你的本地设备里，等你愿意的时候，再被重新打开。
                      </p>
                      <button
                        type="button"
                        onClick={handleSaveTimeCapsule}
                        className="rounded-full bg-[var(--foreground)] px-5 py-3 text-sm tracking-[0.18em] text-[var(--background)]"
                      >
                        {capsuleSaveFeedback}
                      </button>
                    </div>
                    {recentTimeCapsules.length ? (
                      <div className="mt-6 space-y-3">
                        <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">最近封存的时间胶囊</p>
                        <div className="grid gap-3">
                          {recentTimeCapsules.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm text-[var(--foreground)]">{entry.title}</p>
                                <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                                  {getCapsuleStatus(entry.openDate)}
                                </span>
                              </div>
                              <p className="mt-2 max-h-[5.5rem] overflow-hidden text-sm leading-7 text-[var(--muted)]">
                                {entry.message}
                              </p>
                              <p className="mt-3 text-xs leading-6 text-[var(--muted)]">
                                约定开启日：{entry.openDate} · 连接到：{entry.archetypeProfileName}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </ReadingCollapsibleCard>

                  <ReadingCollapsibleCard
                    title="月度内在报告"
                    subtitle="把这个月的内在变化，慢慢收成一页。"
                    badge={monthlyReportPreview.title}
                    expanded={expandedReadingPanels.report}
                    onToggle={() => toggleReadingPanel("report")}
                  >
                    <p className="text-sm leading-7 text-[var(--muted)]">{monthlyReportPreview.summary}</p>
                    <div className="mt-5 space-y-4">
                      <div className="rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">原型脉冲</p>
                        <p className="mt-3 text-sm leading-7 text-[var(--foreground)]/86">
                          {monthlyReportPreview.archetypePulse}
                        </p>
                      </div>
                      <div className="rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">梦境线索</p>
                        <p className="mt-3 text-sm leading-7 text-[var(--foreground)]/86">
                          {monthlyReportPreview.dreamThread}
                        </p>
                      </div>
                      <div className="rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">时间胶囊回声</p>
                        <p className="mt-3 text-sm leading-7 text-[var(--foreground)]/86">
                          {monthlyReportPreview.capsuleEcho}
                        </p>
                      </div>
                      <div className="rounded-[1.3rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">下个月的提醒</p>
                        <p className="mt-3 text-sm leading-7 text-[var(--foreground)]/86">
                          {monthlyReportPreview.nextMonthPrompt}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs leading-6 text-[var(--muted)]">
                        这一页会把本月的梦境、时间胶囊与当前阅读一起收进本地档案，等真正做时间线时，它就能成为月度摘要的起点。
                      </p>
                      <button
                        type="button"
                        onClick={handleSaveMonthlyReport}
                        className="rounded-full bg-[var(--foreground)] px-5 py-3 text-sm tracking-[0.18em] text-[var(--background)]"
                      >
                        {reportSaveFeedback}
                      </button>
                    </div>
                    {recentMonthlyReports.length ? (
                      <div className="mt-6 space-y-3">
                        <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">最近收起的月度报告</p>
                        <div className="grid gap-3">
                          {recentMonthlyReports.map((report) => (
                            <div
                              key={report.id}
                              className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm text-[var(--foreground)]">{report.title}</p>
                                <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                                  {report.monthKey}
                                </span>
                              </div>
                              <p className="mt-2 max-h-[5.5rem] overflow-hidden text-sm leading-7 text-[var(--muted)]">
                                {report.summary}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </ReadingCollapsibleCard>

                  <ReadingCollapsibleCard
                    title="本次抽到的牌"
                    subtitle="把这一次停在你手里的牌，收在同一张清单里。"
                    badge={`${drawnCards.length} 张`}
                    expanded={expandedReadingPanels.cards}
                    onToggle={() => toggleReadingPanel("cards")}
                  >
                    <div className={`grid gap-4 ${drawnCards.length === 1 ? "" : "sm:grid-cols-3 2xl:grid-cols-1"}`}>
                      {drawnCards.map((card, index) => (
                        <div key={`${card.id}-${index}`} className="rounded-[1.5rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4">
                          <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                            {card.orientation === "Upright" ? "正位" : "逆位"}
                          </p>
                          <h3 className="editorial-title mt-3 text-2xl font-semibold">{card.nameZh}</h3>
                          <p className="mt-2 text-sm text-[var(--muted)]">{card.name}</p>
                          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{card.archetypeZh}</p>
                        </div>
                      ))}
                    </div>
                  </ReadingCollapsibleCard>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={resetForHome}
                      className="rounded-full border border-[var(--line)] px-5 py-3 text-sm text-[var(--foreground)]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <RefreshCcw className="h-4 w-4" />
                        返回主页面重新算
                      </span>
                    </button>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>

      <AnimatePresence>
        {isGuideOpen ? (
          <OverlayPanel
            title="使用说明"
            subtitle="先知道这间神谕室里每个功能是做什么的，再慢慢挑你现在最需要的那一束光。"
            onClose={() => setIsGuideOpen(false)}
          >
            <GuideSection
              title="塔罗阅读"
              body="从提问、选牌阵、洗牌、翻牌到解读，是一条单次阅读闭环。它适合你带着一个当下真实的问题，先照见情绪和牵引，再看方向。"
            />
            <GuideSection
              title="清明模式 / 阴影模式"
              body="清明模式更平衡、更温和，适合大多数提问。阴影模式会更靠近回避、投射、防御和惯性循环，适合你想更深一点看见自己的时候。"
            />
            <GuideSection
              title="原型画像"
              body="它会根据这一轮抽到的牌，把你此刻最明显的原型、发光部分、阴影提醒和成长边缘收成一张当下画像。"
            />
            <GuideSection
              title="梦境记录"
              body="如果牌面牵出了一个梦、某段夜间情绪或模糊画面，就把它顺手写下来。它会和这次问题、牌阵、牌名与原型画像一起被保存在本地。"
            />
            <GuideSection
              title="时间胶囊"
              body="把一句想留给未来自己的话封存在某个日期之后再打开。它适合记录此刻的决心、犹豫、害怕与愿望。"
            />
            <GuideSection
              title="月度内在报告"
              body="它会把本月的梦境、时间胶囊和当前阅读一起整理成一页月度摘要。现在是本地版，后续做时间线时会更完整。"
            />
            <GuideSection
              title="当前保存方式"
              body="现在这些扩展功能都先保存在你的本地设备里，还没有接账号和云端同步，所以更适合先体验产品感，再决定后面要不要做长期账户系统。"
            />
          </OverlayPanel>
        ) : null}

        {isTimelineOpen ? (
          <OverlayPanel
            title="灵魂时间线"
            subtitle="把每一次提问、抽牌与解读留在同一条线里。往后回看时，你会更容易认出那些反复出现的主题。"
            onClose={() => setIsTimelineOpen(false)}
          >
            <div className="space-y-4">
              <div className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">此刻的说明</p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  现在先把每次阅读存进本地时间线里。等后面接上账号和云端，它就能自然长成一条真正陪伴你的长期轨迹。
                </p>
              </div>

              {recentReadingHistory.length ? (
                <div className="space-y-3">
                  {recentReadingHistory.map((record) => (
                    <div
                      key={record.id}
                      className="rounded-[1.25rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                            {formatLocalDate(record.createdAt)}
                          </p>
                          <p className="mt-2 text-base leading-7 text-[var(--foreground)]">
                            {record.question}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRestoreReading(record)}
                          className="rounded-full border border-[var(--line)] bg-[color:var(--panel)] px-4 py-2 text-xs tracking-[0.16em] text-[var(--foreground)]"
                        >
                          回到这次阅读
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                          {record.spreadName}
                        </span>
                        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                          {record.interpretationMode === "shadow" ? "阴影模式" : "清明模式"}
                        </span>
                        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                          {record.profileName}
                        </span>
                      </div>

                      <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{record.energyHeadline}</p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {record.cards.map((card, index) => (
                          <span
                            key={`${record.id}-${card.id}-${index}`}
                            className="rounded-full bg-[rgba(214,168,95,0.08)] px-3 py-1.5 text-xs text-[var(--gold)]"
                          >
                            {card.nameZh} · {card.orientation === "Upright" ? "正位" : "逆位"}
                          </span>
                        ))}
                      </div>

                      <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
                        反思问题：{record.reflectionQuestion}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-[var(--line)] px-4 py-5 text-sm leading-7 text-[var(--muted)]">
                  这里会慢慢收起你每一次提问留下的回声。等第一条阅读完成后，灵魂时间线就会开始出现。
                </div>
              )}
            </div>
          </OverlayPanel>
        ) : null}

        {isDailyOpen ? (
          <OverlayPanel
            title="每日记录"
            subtitle="阅读之后，留一件给明天的小事。它不需要很大，只要足够真实，就会让你愿意再回来一次。"
            onClose={() => setIsDailyOpen(false)}
          >
            <div className="space-y-4">
              <div className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">今日待回应</p>
                  <span className="rounded-full bg-[rgba(214,168,95,0.12)] px-3 py-1 text-xs text-[var(--gold)]">
                    {pendingDailyCount} 条
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  每完成一次阅读，系统都会替你留下一件明天可以做的小动作。它不是打卡，而是帮你把感受轻轻落到生活里。
                </p>
              </div>

              {recentDailyRecords.length ? (
                <div className="space-y-3">
                  {recentDailyRecords.map((entry) => {
                    const status = 每日记录状态(entry);
                    const isDone = Boolean(entry.completedAt);
                    return (
                      <div
                        key={entry.id}
                        className="rounded-[1.25rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm text-[var(--foreground)]">{entry.title}</p>
                            <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
                              提醒日期：{entry.dueDate}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs ${
                              isDone
                                ? "bg-[rgba(124,149,168,0.14)] text-[var(--secondary)]"
                                : "bg-[rgba(214,168,95,0.12)] text-[var(--gold)]"
                            }`}
                          >
                            {status}
                          </span>
                        </div>

                        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{entry.prompt}</p>

                        {!isDone ? (
                          <button
                            type="button"
                            onClick={() => handleCompleteDailyRecord(entry.id)}
                            className="mt-4 rounded-full bg-[var(--foreground)] px-4 py-2.5 text-xs tracking-[0.16em] text-[var(--background)]"
                          >
                            今天已完成
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-[var(--line)] px-4 py-5 text-sm leading-7 text-[var(--muted)]">
                  等你完成第一轮解读之后，这里就会开始留下“明天继续回应”的小记录。
                </div>
              )}
            </div>
          </OverlayPanel>
        ) : null}

        {isDreamPanelOpen ? (
          <OverlayPanel
            title="梦境记录"
            subtitle="把夜里的片段、情绪和符号收进同一本簿里，让它和这次阅读互相照亮。"
            onClose={() => setIsDreamPanelOpen(false)}
          >
            <div className="space-y-5">
              <div className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">写下一段梦</p>
                <input
                  value={dreamTitle}
                  onChange={(event) => setDreamTitle(event.target.value)}
                  placeholder="给这一段梦起个名字"
                  className="mt-4 w-full rounded-[1rem] border border-[var(--line)] bg-transparent px-4 py-3 text-sm outline-none"
                />
                <textarea
                  value={dreamText}
                  onChange={(event) => setDreamText(event.target.value)}
                  placeholder="把梦里留下来的画面、气味、对白或醒来后的情绪写下来。"
                  rows={5}
                  className="mt-3 w-full rounded-[1rem] border border-[var(--line)] bg-transparent px-4 py-3 text-sm leading-7 outline-none"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {dreamMoods.map((mood) => {
                    const selected = mood === dreamMood;
                    return (
                      <button
                        key={mood}
                        type="button"
                        onClick={() => setDreamMood(mood)}
                        className={`rounded-full border px-3 py-2 text-xs ${
                          selected
                            ? "border-[rgba(214,168,95,0.34)] bg-[rgba(214,168,95,0.12)] text-[var(--gold)]"
                            : "border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--muted)]"
                        }`}
                      >
                        {mood}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {dreamSymbolSuggestions.map((symbol) => (
                    <span
                      key={symbol}
                      className="rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] px-3 py-1.5 text-xs text-[var(--muted)]"
                    >
                      {symbol}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleSaveDreamJournal}
                  className="mt-4 rounded-full bg-[var(--foreground)] px-5 py-3 text-sm tracking-[0.18em] text-[var(--background)]"
                >
                  {dreamSaveFeedback}
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">最近写下的梦</p>
                {recentDreamEntries.length ? (
                  recentDreamEntries.map((entry) => (
                    <div key={entry.id} className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-[var(--foreground)]">{entry.title}</p>
                        <span className="text-xs text-[var(--muted)]">{entry.mood}</span>
                      </div>
                      <p className="mt-3 line-clamp-4 text-sm leading-7 text-[var(--muted)]">{entry.dreamText}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.2rem] border border-dashed border-[var(--line)] px-4 py-5 text-sm leading-7 text-[var(--muted)]">
                    这里会慢慢收住你写下的梦境片段。第一条可以先从今晚最模糊的一幕开始。
                  </div>
                )}
              </div>
            </div>
          </OverlayPanel>
        ) : null}

        {isCapsulePanelOpen ? (
          <OverlayPanel
            title="时间胶囊"
            subtitle="把此刻想留给未来自己的话封存起来。到了约定的日子，它会回来轻轻提醒你。"
            onClose={() => setIsCapsulePanelOpen(false)}
          >
            <div className="space-y-5">
              <div className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">到期提醒</p>
                  {dueTimeCapsules.length ? (
                    <span className="rounded-full bg-[rgba(214,168,95,0.14)] px-3 py-1 text-xs text-[var(--gold)]">
                      已到期 {dueTimeCapsules.length} 枚
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 space-y-3">
                  {dueTimeCapsules.length ? (
                    dueTimeCapsules.map((entry) => (
                      <div key={entry.id} className="rounded-[1rem] border border-[var(--line)] bg-[color:var(--panel)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm text-[var(--foreground)]">{entry.title}</p>
                          <span className="text-xs text-[var(--gold)]">该开启了</span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{entry.message}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenDueCapsule(entry.id)}
                            className="rounded-full bg-[var(--foreground)] px-4 py-2 text-xs tracking-[0.16em] text-[var(--background)]"
                          >
                            收下回声
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDismissDueCapsule(entry.id)}
                            className="rounded-full border border-[var(--line)] px-4 py-2 text-xs text-[var(--muted)]"
                          >
                            稍后再看
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1rem] border border-dashed border-[var(--line)] px-4 py-5 text-sm leading-7 text-[var(--muted)]">
                      只要有胶囊到了约定日期，这里和侧边栏就会出现提醒。现在先写下第一枚，提醒框架就开始运转了。
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">封存此刻</p>
                <input
                  value={capsuleTitle}
                  onChange={(event) => setCapsuleTitle(event.target.value)}
                  placeholder="写给未来自己的标题"
                  className="mt-4 w-full rounded-[1rem] border border-[var(--line)] bg-transparent px-4 py-3 text-sm outline-none"
                />
                <textarea
                  value={capsuleMessage}
                  onChange={(event) => setCapsuleMessage(event.target.value)}
                  placeholder="把这一刻最想留住的话写给未来的自己。"
                  rows={5}
                  className="mt-3 w-full rounded-[1rem] border border-[var(--line)] bg-transparent px-4 py-3 text-sm leading-7 outline-none"
                />
                <input
                  type="date"
                  value={capsuleOpenDate}
                  onChange={(event) => setCapsuleOpenDate(event.target.value)}
                  className="mt-3 w-full rounded-[1rem] border border-[var(--line)] bg-transparent px-4 py-3 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveTimeCapsule}
                  className="mt-4 rounded-full bg-[var(--foreground)] px-5 py-3 text-sm tracking-[0.18em] text-[var(--background)]"
                >
                  {capsuleSaveFeedback}
                </button>
              </div>
            </div>
          </OverlayPanel>
        ) : null}

        {isReportPanelOpen ? (
          <OverlayPanel
            title="月度内在报告"
            subtitle="把梦、胶囊与本次阅读收成一页月度脉搏，慢慢看见这段时间你正在变成谁。"
            onClose={() => setIsReportPanelOpen(false)}
          >
            <div className="space-y-5">
              <div className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">本月预览</p>
                  <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                    {monthlyReportPreview.title}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{monthlyReportPreview.summary}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[1rem] border border-[var(--line)] bg-[color:var(--panel)] p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">原型脉冲</p>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{monthlyReportPreview.archetypePulse}</p>
                  </div>
                  <div className="rounded-[1rem] border border-[var(--line)] bg-[color:var(--panel)] p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">梦境线索</p>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{monthlyReportPreview.dreamThread}</p>
                  </div>
                  <div className="rounded-[1rem] border border-[var(--line)] bg-[color:var(--panel)] p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">胶囊回声</p>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{monthlyReportPreview.capsuleEcho}</p>
                  </div>
                  <div className="rounded-[1rem] border border-[var(--line)] bg-[color:var(--panel)] p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">下月提醒</p>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{monthlyReportPreview.nextMonthPrompt}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveMonthlyReport}
                  className="mt-4 rounded-full bg-[var(--foreground)] px-5 py-3 text-sm tracking-[0.18em] text-[var(--background)]"
                >
                  {reportSaveFeedback}
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">最近收起的月度报告</p>
                {recentMonthlyReports.length ? (
                  recentMonthlyReports.map((report) => (
                    <div key={report.id} className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-[var(--foreground)]">{report.title}</p>
                        <span className="text-xs text-[var(--muted)]">{report.monthKey}</span>
                      </div>
                      <p className="mt-3 line-clamp-4 text-sm leading-7 text-[var(--muted)]">{report.summary}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.2rem] border border-dashed border-[var(--line)] px-4 py-5 text-sm leading-7 text-[var(--muted)]">
                    这里会慢慢积累你按月收起来的内在报告。它会越来越像一条长期陪伴的变化轨迹。
                  </div>
                )}
              </div>
            </div>
          </OverlayPanel>
        ) : null}

        {isSettingsOpen ? (
          <OverlayPanel
            title="设置"
            subtitle="先把这间房间调成你更舒服的样子。"
            onClose={() => setIsSettingsOpen(false)}
          >
            <div className="space-y-4">
              <div className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">主题</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toggleTheme("light")}
                    className={`rounded-full border px-4 py-2 text-sm ${
                      theme === "light"
                        ? "border-[rgba(214,168,95,0.24)] bg-[rgba(214,168,95,0.12)] text-[var(--gold)]"
                        : "border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)]"
                    }`}
                  >
                    浅色
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleTheme("dark")}
                    className={`rounded-full border px-4 py-2 text-sm ${
                      theme === "dark"
                        ? "border-[rgba(214,168,95,0.24)] bg-[rgba(214,168,95,0.12)] text-[var(--gold)]"
                        : "border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)]"
                    }`}
                  >
                    深色
                  </button>
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">当前本地档案</p>
                <div className="mt-3 space-y-2 text-sm leading-7 text-[var(--muted)]">
                  <p>阅读记录：{readingHistory.length} 条</p>
                  <p>每日记录：{dailyRecords.length} 条</p>
                  <p>梦境记录：{dreamEntries.length} 条</p>
                  <p>时间胶囊：{timeCapsules.length} 枚</p>
                  <p>月度报告：{monthlyReports.length} 份</p>
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">档案同步</p>
                    <p className="mt-3 text-sm text-[var(--foreground)]">{syncStatusLabel}</p>
                    <p className="mt-1 text-xs leading-6 text-[var(--muted)]">
                      {syncState.lastSuccessAt
                        ? `最近完成：${new Date(syncState.lastSuccessAt).toLocaleString("zh-CN", { hour12: false })}`
                        : "尚未完成首次服务器同步"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={syncState.phase === "syncing"}
                    onClick={() => void flushSyncQueue()}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[color:var(--panel)] px-4 py-2 text-xs text-[var(--foreground)] disabled:cursor-wait disabled:opacity-55"
                  >
                    <RefreshCcw className={`h-3.5 w-3.5 ${syncState.phase === "syncing" ? "animate-spin" : ""}`} />
                    {syncState.phase === "syncing" ? "同步中" : "立即重试"}
                  </button>
                </div>
                {syncState.lastError ? (
                  <p className="mt-3 rounded-[0.9rem] bg-[rgba(214,168,95,0.09)] px-3 py-2 text-xs leading-6 text-[var(--muted)]">
                    本地档案仍然安全，服务器恢复后会自动补传。
                  </p>
                ) : null}
              </div>

              <div className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">档案备份</p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  将这间神谕室里的全部记录收成一个文件，或把另一台设备导出的档案合并到这里。导入不会覆盖较新的同名记录。
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleExportArchive}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[color:var(--panel)] px-4 py-2 text-xs text-[var(--foreground)]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    导出全部档案
                  </button>
                  <button
                    type="button"
                    onClick={() => backupInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[color:var(--panel)] px-4 py-2 text-xs text-[var(--foreground)]"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    导入档案文件
                  </button>
                  <input
                    ref={backupInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportArchive}
                    className="hidden"
                    aria-label="选择要导入的神谕室档案"
                  />
                </div>
                <p className="mt-3 text-xs leading-6 text-[var(--muted)]">{backupFeedback}</p>
              </div>

              <div className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">说明</p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  记录会先写入当前浏览器，再同步到现有服务器。即使网络暂时中断，也会保留在待同步队列中，恢复连接后自动补传；账号与多设备隔离仍属于下一阶段。
                </p>
              </div>
            </div>
          </OverlayPanel>
        ) : null}

        {isMessagesOpen ? (
          <OverlayPanel
            title="消息"
            subtitle="这间神谕室暂时还没有联网账号系统，所以消息更像是你留给自己的本地提醒。"
            onClose={() => setIsMessagesOpen(false)}
          >
            <GuideSection
              title="灵魂时间线"
              body={
                recentReadingHistory.length
                  ? `你已经留下了 ${recentReadingHistory.length} 条阅读记录。它们会成为后面那条时间线的起点。`
                  : "第一轮完整阅读结束后，这里就会开始提醒你：这间神谕室已经记住了你的第一道提问。"
              }
            />
            <GuideSection
              title="每日记录"
              body={
                pendingDailyCount
                  ? `现在有 ${pendingDailyCount} 条今天待回应的小事还亮着。哪怕只完成一件，也足以让这次阅读继续留在生活里。`
                  : "暂时没有待回应的每日记录。等下一轮阅读完成后，这里会替你留下明天可以继续的一件小事。"
              }
            />
            <GuideSection
              title="当前提醒"
              body="梦境记录、时间胶囊和月度内在报告，都会先保存在当前浏览器里。只要你不清理本地数据，它们就会继续留在这里。"
            />
            <GuideSection
              title="下一步会发生什么"
              body="等后面接上账号和时间线系统，这里就可以变成真正的消息中心，用来提醒你哪些胶囊到了开启的时候、哪些月度摘要已经收好。"
            />
          </OverlayPanel>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function HeaderNavButton({
  disabled,
  title,
  ariaLabel,
  onClick,
  icon,
  label,
}: {
  disabled: boolean;
  title: string;
  ariaLabel: string;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        title={title}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onClick}
        className="flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] px-3 text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-35"
      >
        {icon}
        <span className="hidden text-xs tracking-[0.18em] sm:inline">{label}</span>
      </button>
      {!disabled ? (
        <span className="pointer-events-none absolute -bottom-11 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] px-3 py-1.5 text-[11px] text-[var(--muted)] opacity-0 shadow-[var(--shadow)] transition-all duration-300 group-hover:block group-hover:opacity-100 md:block">
          {title}
        </span>
      ) : null}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function OracleSidebarLegacy({
  collapsed,
  mobile,
  step,
  onClose,
  onToggleCollapse,
  onFreshReading,
  onOpenGuide,
  onOpenSettings,
  onOpenMessages,
  onExit,
}: {
  collapsed: boolean;
  mobile: boolean;
  step: FlowStep;
  onClose: () => void;
  onToggleCollapse: () => void;
  onFreshReading: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  onOpenMessages: () => void;
  onExit: () => void;
}) {
  const navItems = [
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
      key: "dream",
      label: "梦境记录",
      hint: "把夜里的回声收住",
      icon: <BookHeart className="h-4 w-4" />,
      onClick: onOpenGuide,
      active: step === "reading",
    },
    {
      key: "capsule",
      label: "时间胶囊",
      hint: "寄给未来的自己",
      icon: <Archive className="h-4 w-4" />,
      onClick: onOpenGuide,
      active: false,
    },
    {
      key: "report",
      label: "月度内在报告",
      hint: "把变化慢慢收成一页",
      icon: <NotebookPen className="h-4 w-4" />,
      onClick: onOpenGuide,
      active: false,
    },
  ] as const;

  const isMini = collapsed && !mobile;

  const panel = (
    <motion.div
      layout
      animate={!mobile ? { width: collapsed ? "5.75rem" : "17.5rem" } : undefined}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className={`sidebar-shell paper-panel relative flex h-full flex-col rounded-[2rem] p-5 ${
        mobile ? "w-[18rem] max-w-[86vw]" : ""
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isMini ? (
          <motion.div
            key="mini"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-full items-start justify-center"
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
          <motion.div
            key="expanded"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-full flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
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
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)]"
                aria-label={mobile ? "关闭侧边栏" : "收起侧边栏"}
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
                    <span className="block text-sm text-[var(--foreground)]/92">{item.label}</span>
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
                  className="flex h-10 flex-1 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)]"
                  aria-label="消息"
                  title="消息"
                >
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

function OverlayPanel({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,12,10,0.28)] px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="paper-panel max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] p-6 sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">{title}</p>
            <h3 className="editorial-title mt-3 text-[2rem] font-semibold tracking-[-0.03em]">{title}</h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)]"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-4">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function GuideSection({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4">
      <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">{title}</p>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{body}</p>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-unused-vars */
function OracleSidebarV2({
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
}: {
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
}) {
  const navItems = [
    { key: "fresh", label: "新一轮阅读", hint: "从提问重新开始", icon: <Sparkles className="h-4 w-4" />, onClick: onFreshReading, active: step === "landing" || step === "question" },
    { key: "guide", label: "使用说明", hint: "先看功能怎么用", icon: <ScrollText className="h-4 w-4" />, onClick: onOpenGuide, active: false },
    { key: "dream", label: "梦境记录", hint: "把夜里的回声收住", icon: <BookHeart className="h-4 w-4" />, onClick: onOpenDream, active: false },
    { key: "capsule", label: "时间胶囊", hint: "寄给未来的自己", icon: <Archive className="h-4 w-4" />, onClick: onOpenCapsule, active: false, badge: dueCapsuleCount },
    { key: "report", label: "月度内在报告", hint: "把变化慢慢收成一页", icon: <NotebookPen className="h-4 w-4" />, onClick: onOpenReport, active: false },
  ] as const;

  const expandedContent = (
    <motion.div
      animate={
        mobile
          ? { opacity: 1, x: 0, scale: 1, clipPath: "inset(0% 0% 0% 0% round 1.75rem)" }
          : {
              opacity: collapsed ? 0 : 1,
              x: collapsed ? -18 : 0,
              scale: collapsed ? 0.985 : 1,
              clipPath: collapsed ? "inset(0% 100% 0% 0% round 1.75rem)" : "inset(0% 0% 0% 0% round 1.75rem)",
            }
      }
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      style={{ pointerEvents: mobile || !collapsed ? "auto" : "none" }}
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
                {"badge" in item && item.badge ? (
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

        <div className="mt-3 hidden items-center justify-between gap-2">
          <button type="button" onClick={onOpenSettings} className="flex h-10 flex-1 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)]" aria-label="设置" title="设置">
            <Settings2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={onOpenMessages} className="flex h-10 flex-1 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)]" aria-label="消息" title="消息">
            <Bell className="h-4 w-4" />
          </button>
          <button type="button" onClick={onExit} className="flex h-10 flex-1 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)]" aria-label="退出" title="退出">
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={onOpenSettings} className="flex h-10 flex-1 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)]" aria-label="设置" title="设置">
            <Settings2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={onOpenMessages} className="flex h-10 flex-1 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)]" aria-label="消息" title="消息">
            <Bell className="h-4 w-4" />
          </button>
          <button type="button" onClick={onExit} className="flex h-10 flex-1 items-center justify-center rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] text-[var(--foreground)]" aria-label="退出" title="退出">
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 rounded-[1.25rem] border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-4">
          <p className="text-sm leading-8 text-[var(--foreground)]/86">你越安静，越能听见真正属于自己的回声。</p>
          <p className="mt-3 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">留给今夜的寄语</p>
        </div>
      </div>
    </motion.div>
  );

  const panel = (
    <motion.div
      animate={!mobile ? { width: collapsed ? "5.75rem" : "17.5rem" } : undefined}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className={`sidebar-shell paper-panel relative flex h-full flex-col overflow-hidden rounded-[2rem] p-4 ${
        mobile ? "w-[18rem] max-w-[86vw]" : ""
      }`}
    >
      {mobile ? (
        expandedContent
      ) : (
        <>
          <motion.div
            animate={{ opacity: collapsed ? 1 : 0, scale: collapsed ? 1 : 0.94, y: collapsed ? 0 : -6 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{ pointerEvents: collapsed ? "auto" : "none" }}
            className="absolute inset-x-0 top-4 z-20 flex justify-center"
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
          {expandedContent}
        </>
      )}
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

  return panel;
}
/* eslint-enable @typescript-eslint/no-unused-vars */

function TimelineSummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="paper-panel rounded-[1.6rem] px-5 py-5">
      <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">{label}</p>
      <p className="editorial-title mt-4 text-[2rem] font-semibold leading-none">{value}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function TimelineReadingCard({
  record,
  onRestore,
}: {
  record: {
    id: string;
    createdAt: string;
    question: string;
    spreadName: string;
    interpretationMode: "standard" | "shadow";
    profileName: string;
    energyHeadline: string;
    reflectionQuestion: string;
    cards: Array<{ id: string; nameZh: string; orientation: "Upright" | "Reversed" }>;
  };
  onRestore: () => void;
}) {
  return (
    <article className="paper-panel rounded-[1.8rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">{formatLocalDate(record.createdAt)}</p>
          <h3 className="mt-3 text-lg leading-8 text-[var(--foreground)]">{record.question}</h3>
        </div>
        <button
          type="button"
          onClick={onRestore}
          className="rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-2 text-xs tracking-[0.16em] text-[var(--foreground)]"
        >
          回到这次阅读
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">{record.spreadName}</span>
        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
          {record.interpretationMode === "shadow" ? "阴影模式" : "清明模式"}
        </span>
        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">{record.profileName}</span>
      </div>

      <p className="mt-5 text-sm leading-7 text-[var(--muted)]">{record.energyHeadline}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {record.cards.map((card, index) => (
          <span
            key={`${record.id}-${card.id}-${index}`}
            className="rounded-full bg-[rgba(214,168,95,0.08)] px-3 py-1.5 text-xs text-[var(--gold)]"
          >
            {card.nameZh} · {card.orientation === "Upright" ? "正位" : "逆位"}
          </span>
        ))}
      </div>

      <p className="mt-4 text-xs leading-6 text-[var(--muted)]">反思问题：{record.reflectionQuestion}</p>
    </article>
  );
}

function StepShell({ step, children }: { step: FlowStep; children: ReactNode }) {
  return (
    <motion.section key={step} {...sectionFade} className="mx-auto w-full max-w-6xl">
      {children}
    </motion.section>
  );
}

function StepIntro({ step }: { step: FlowStep }) {
  const meta = stepMeta[step];

  return (
    <div className="space-y-4">
      <p className="text-sm uppercase tracking-[0.34em] text-[var(--muted)]">{meta.label}</p>
      {step === "reading" ? (
        <h2 className="editorial-title max-w-[9.2ch] text-balance text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.02] sm:max-w-none">
          <span className="block">一封来自牌面的</span>
          <span className="block">私人来信。</span>
        </h2>
      ) : (
        <h2 className="editorial-title max-w-[11.5ch] text-balance text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.02] sm:max-w-none">
          {meta.title}
        </h2>
      )}
      {meta.copy ? <p className="max-w-2xl text-base leading-7 text-[var(--muted)]">{meta.copy}</p> : null}
    </div>
  );
}

function getThemePreference(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("oracle-theme");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return stored === "light" || stored === "dark" ? stored : systemDark ? "dark" : "light";
}

function subscribeThemePreference(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const notify = () => onStoreChange();

  window.addEventListener("storage", notify);
  window.addEventListener("oracle-theme-change", notify);
  media.addEventListener("change", notify);

  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener("oracle-theme-change", notify);
    media.removeEventListener("change", notify);
  };
}

function useViewportWidth() {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => undefined;
      const notify = () => onStoreChange();
      window.addEventListener("resize", notify);
      return () => window.removeEventListener("resize", notify);
    },
    () => (typeof window === "undefined" ? 1280 : window.innerWidth),
    () => 1280,
  );
}

function AmbientBackdrop() {
  return (
    <>
      <motion.div
        aria-hidden
        animate={{ opacity: [0.28, 0.42, 0.3], scale: [1, 1.03, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute left-[8%] top-[10%] h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(214,168,95,0.11),transparent_68%)] blur-2xl"
      />
      <motion.div
        aria-hidden
        animate={{ opacity: [0.16, 0.22, 0.17], x: [0, 14, 0], y: [0, 8, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute right-[8%] top-[18%] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(124,149,168,0.08),transparent_72%)] blur-3xl"
      />
    </>
  );
}

function HeroPreview() {
  const [isShuffling, setIsShuffling] = useState(false);

  const handlePreviewShuffle = () => {
    if (isShuffling) return;
    setIsShuffling(true);
    window.setTimeout(() => setIsShuffling(false), 1000);
  };

  return (
    <div className="paper-panel relative overflow-hidden rounded-[2rem] p-4 sm:rounded-[2.2rem] sm:p-5 xl:aspect-[1.02/1]">
      <div className="grid gap-4">
        <div className="rounded-[1.75rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-5 sm:rounded-[2rem] sm:p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">问题示意</p>
          <p className="editorial-title mt-5 text-3xl font-semibold">此刻的我，应该更信任什么？</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[1.75rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4 sm:rounded-[2rem] sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">洗牌仪式</p>
              <button
                type="button"
                onClick={handlePreviewShuffle}
                className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[11px] tracking-[0.2em] text-[var(--muted)] hover:border-[rgba(214,168,95,0.35)] hover:text-[var(--foreground)]"
              >
                {isShuffling ? "洗牌中" : "轻触洗牌"}
              </button>
            </div>

            <div className="relative mt-5 h-44 sm:mt-6 sm:h-56">
              <motion.div
                animate={isShuffling ? { y: [0, -4, 0] } : { y: [0, -2, 0] }}
                transition={isShuffling ? { duration: 0.95, ease: "easeInOut" } : { duration: 8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                {heroCards.map((card) => {
                  const baseX = -54 + card * 5.8;
                  const baseY = -48 + card * 2.2;
                  const baseRotate = -9 + card * 1.18;
                  return (
                    <motion.div
                      key={card}
                      animate={
                        isShuffling
                          ? {
                              x: [baseX, baseX + (card % 2 === 0 ? 12 : -12), baseX + (card % 3 === 0 ? -6 : 6), baseX],
                              y: [baseY, baseY - 7 - (card % 2), baseY + 3, baseY],
                              rotate: [baseRotate, baseRotate - 4, baseRotate + 3, baseRotate],
                            }
                          : {
                              x: baseX,
                              y: baseY,
                              rotate: baseRotate,
                            }
                      }
                      transition={
                        isShuffling
                          ? {
                              duration: 0.9,
                              ease: [0.22, 1, 0.36, 1],
                              delay: card * 0.016,
                            }
                          : {
                              duration: 0.4,
                              ease: "easeOut",
                            }
                      }
                      className="tarot-card-plane card-sheen absolute left-1/2 top-1/2 h-28 w-20 rounded-[0.95rem] border border-[rgba(214,168,95,0.18)] bg-[linear-gradient(180deg,rgb(28,27,31),rgb(59,47,32))] shadow-[0_12px_22px_rgba(38,30,18,0.14)] sm:h-36 sm:w-24 sm:rounded-[1.1rem]"
                    >
                      <div className="absolute inset-2.5 rounded-[0.72rem] border border-white/10 sm:inset-3 sm:rounded-[0.9rem]" />
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-4 sm:rounded-[2rem] sm:p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">解读气质</p>
            <div className="mt-5 max-w-[25rem] space-y-4 text-sm leading-8 text-[var(--muted)]">
              <div>
                <p className="text-[var(--foreground)]">像一封写给你的信</p>
                <p className="mt-2">不急着给结论，而是先照见情绪的纹理、动机的拉扯，以及某种更真实的内在声音。</p>
              </div>
              <div>
                <p className="text-[var(--foreground)]">像一面温柔的镜子</p>
                <p className="mt-2">它不会替你命定未来，只会把你此刻真正需要面对的那一部分，慢慢显出来。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeckScene({
  deckMode,
  ringCards,
  selectedSlots,
  maxCards,
  onToggleSlot,
  onRotateClockwiseStart,
  onRotateCounterclockwiseStart,
  onRotateStop,
  onRandomGive,
  isRingSpinning,
}: {
  deckMode: DeckMode;
  ringCards: Array<FakeRingCard & { x: number; y: number; depth: number; angle: number; frontness: number }>;
  selectedSlots: string[];
  maxCards: number;
  onToggleSlot: (id: string) => void;
  onRotateClockwiseStart: () => void;
  onRotateCounterclockwiseStart: () => void;
  onRotateStop: () => void;
  onRandomGive: () => void;
  isRingSpinning: boolean;
}) {
  return (
    <div
      className="paper-panel gesture-safe relative flex min-h-[44rem] flex-col items-center overflow-hidden rounded-[2rem] px-4 py-6 sm:min-h-[46rem] sm:px-5 sm:py-7 lg:min-h-[40rem] lg:rounded-[2.4rem] lg:px-6 lg:py-8"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,168,95,0.022),transparent_42%)]" />

      <div className="pointer-events-none absolute top-8 z-10 text-center text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
        圆环牌库 · 当前已选 {selectedSlots.length} / {maxCards}
      </div>

      <div className="relative mt-14 flex w-full max-w-[40rem] flex-1 flex-col items-center justify-start sm:mt-16 md:max-w-[41rem] lg:mt-5 lg:max-w-[40rem]">
        <div className="gesture-safe relative z-[1300] mb-7 flex items-center gap-3 rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] px-3 py-2 shadow-[0_10px_24px_rgba(44,34,20,0.06)] backdrop-blur-xl">
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture?.(event.pointerId);
              onRotateClockwiseStart();
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              event.currentTarget.releasePointerCapture?.(event.pointerId);
              onRotateStop();
            }}
            onContextMenu={(event) => event.preventDefault()}
            onPointerCancel={onRotateStop}
            onPointerLeave={onRotateStop}
            onTouchStart={(event) => event.preventDefault()}
            onTouchEnd={onRotateStop}
            className="gesture-safe flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(214,168,95,0.18)] bg-[rgba(255,252,247,0.76)] text-[var(--gold)] hover:border-[rgba(214,168,95,0.38)]"
            aria-label="顺势转动"
            title="顺势转动"
            draggable={false}
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onPointerDown={(event) => event.preventDefault()}
            onClick={onRandomGive}
            onTouchStart={(event) => event.preventDefault()}
            onContextMenu={(event) => event.preventDefault()}
            className="gesture-safe flex h-12 w-12 items-center justify-center rounded-[1rem] border border-[rgba(214,168,95,0.18)] bg-[rgba(255,252,247,0.78)] text-[var(--gold)] hover:border-[rgba(214,168,95,0.38)]"
            aria-label="随机给予"
            title="随机给予"
            draggable={false}
          >
            <Sparkles className="h-4 w-4" />
          </button>
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture?.(event.pointerId);
              onRotateCounterclockwiseStart();
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              event.currentTarget.releasePointerCapture?.(event.pointerId);
              onRotateStop();
            }}
            onContextMenu={(event) => event.preventDefault()}
            onPointerCancel={onRotateStop}
            onPointerLeave={onRotateStop}
            onTouchStart={(event) => event.preventDefault()}
            onTouchEnd={onRotateStop}
            className="gesture-safe flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(214,168,95,0.18)] bg-[rgba(255,252,247,0.76)] text-[var(--gold)] hover:border-[rgba(214,168,95,0.38)]"
            aria-label="逆势转动"
            title="逆势转动"
            draggable={false}
          >
            <RotateCw className="h-4 w-4 -scale-x-100" />
          </button>
        </div>

        <div className="gesture-safe relative h-[16rem] w-full overflow-visible sm:h-[17.5rem] lg:h-[21rem]">
        {ringCards
          .slice()
          .sort((a, b) => a.depth - b.depth)
          .map((card) => {
            const frontSide = card.frontness > -0.05;
            const interactive = card.frontness > 0.28;
            const selected = selectedSlots.includes(card.id);

            let x = 0;
            let y = 0;
            let scale = 1;
            let opacity = 1;
            let rotate = 0;

            if (deckMode === "ring") {
              x = card.x;
              y = card.y;
              scale = 0.54 + card.depth * 0.58;
              opacity = 0.12 + card.depth * 0.88;
              rotate = Math.cos((card.angle * Math.PI) / 180) * 12;
            } else {
              x = 0;
              y = 0;
              scale = 0.92;
              opacity = 0.96 - Math.min((card.angle + 90 + 360) % 360 / 460, 0.42);
              rotate = ((card.angle + 90 + 360) % 360) * 0.18 - 26;
            }

            if (deckMode === "shuffle") {
              rotate += (card.depth - 0.5) * 20;
            }

            return (
              <motion.button
                key={card.id}
                type="button"
                disabled={deckMode !== "ring" || !interactive}
                onClick={() => onToggleSlot(card.id)}
                animate={{
                  x,
                  y,
                  scale: selected && deckMode === "ring" ? scale * 1.04 : scale,
                  rotate,
                }}
                transition={{
                  duration:
                    deckMode === "ring"
                      ? isRingSpinning
                        ? 0.12
                        : 0.68
                      : deckMode === "shuffle"
                        ? 0.9
                        : 0.56,
                  ease:
                    deckMode === "ring" && isRingSpinning
                      ? "linear"
                      : ([0.22, 1, 0.36, 1] as [number, number, number, number]),
                }}
                className="gesture-safe absolute left-1/2 top-[34%] border-0 bg-transparent p-0 outline-none disabled:cursor-default sm:top-[35%] lg:top-[40%]"
                style={{
                  zIndex: Math.round(deckMode === "ring" ? card.depth * 1000 : card.depth * 10),
                  transform: "translate(-50%, -50%)",
                  willChange: "transform, opacity",
                }}
                onDragStart={(event) => event.preventDefault()}
                draggable={false}
              >
                <motion.div
                  animate={{ y: selected && deckMode === "ring" ? -12 : 0, opacity }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className={`tarot-card-plane card-sheen relative h-24 w-[4.5rem] transform-gpu rounded-[0.92rem] border bg-[linear-gradient(180deg,rgb(24,24,28),rgb(59,47,32))] shadow-[0_13px_24px_rgba(34,28,18,0.14)] sm:h-28 sm:w-20 sm:rounded-[1rem] lg:h-40 lg:w-28 lg:rounded-[1.15rem] ${
                    selected
                      ? "border-[rgba(214,168,95,0.62)] shadow-[0_12px_22px_rgba(214,168,95,0.12)]"
                      : "border-[rgba(214,168,95,0.18)]"
                  }`}
                  style={{ willChange: "transform, opacity" } as CSSProperties}
                >
                  <div className="absolute inset-2.5 rounded-[0.62rem] border border-white/8 sm:inset-3 sm:rounded-[0.8rem] lg:rounded-[0.92rem]" />
                  {selected ? (
                    <div className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(214,168,95,0.56)] bg-[rgba(214,168,95,0.12)] text-[var(--gold)]">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  ) : null}
                  {deckMode === "ring" && frontSide && interactive ? (
                    <div className="absolute bottom-3 left-1/2 h-1.5 w-7 -translate-x-1/2 rounded-full bg-[rgba(255,248,238,0.22)]" />
                  ) : null}
                </motion.div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <p className="relative z-10 mt-3 max-w-md px-3 text-center text-xs leading-7 tracking-[0.12em] text-[var(--muted)] sm:mt-5">
        按住中间两侧的按钮，将属于你的，以你的方式，把握到手中。
        <br />
        或是听从命运的安排，获得与你有缘的三张牌
      </p>
    </div>
  );
}

function ReadingCollapsibleCard({
  title,
  subtitle,
  badge,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="paper-panel rounded-[1.8rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">{title}</p>
          <p className="mt-3 text-base leading-7 text-[var(--foreground)]/88 sm:text-lg">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {badge ? (
            <span className="rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] px-3 py-1.5 text-[11px] tracking-[0.18em] text-[var(--muted)]">
              {badge}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onToggle}
            className="rounded-full border border-[var(--line)] bg-[color:var(--panel-strong)] px-4 py-2 text-xs tracking-[0.18em] text-[var(--foreground)]"
            aria-expanded={expanded}
          >
            <span className="inline-flex items-center gap-2">
              {expanded ? "收起内容" : "展开内容"}
              <motion.span
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="inline-flex"
              >
                <ChevronDown className="h-4 w-4" />
              </motion.span>
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-5">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CardBack() {
  return (
    <div className="absolute inset-0 rounded-[1.85rem] border border-[rgba(214,168,95,0.22)] bg-[linear-gradient(180deg,rgba(25,25,28,0.98),rgba(52,42,30,0.95))] shadow-[0_22px_36px_rgba(37,28,17,0.16)] [backface-visibility:hidden]">
      <div className="card-sheen absolute inset-0 rounded-[1.85rem]" />
      <div className="absolute inset-4 rounded-[1.4rem] border border-white/10" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[rgba(214,168,95,0.26)] text-[var(--gold)]">
          <Sparkles className="h-10 w-10" />
        </div>
      </div>
    </div>
  );
}

function CardFace({ card, revealed }: { card: DrawnCard; revealed: boolean }) {
  return (
    <div className="absolute inset-0 rounded-[1.85rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-5 shadow-[var(--card-shadow)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
      <div
        className={`absolute inset-0 rounded-[1.85rem] bg-[radial-gradient(circle_at_top,rgba(214,168,95,0.14),transparent_42%)] transition-opacity duration-1000 ${
          revealed ? "opacity-100" : "opacity-0"
        }`}
      />
      <div className="relative flex h-full flex-col justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
            {card.orientation === "Upright" ? "正位" : "逆位"}
          </p>
          <h3 className="editorial-title mt-4 text-4xl font-semibold leading-none">{card.nameZh}</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">{card.name}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{card.archetypeZh}</p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">光面</p>
            <p className="mt-2 text-sm leading-6">{card.lightZh.slice(0, 3).join(" / ")}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">阴影</p>
            <p className="mt-2 text-sm leading-6">{card.shadowZh.slice(0, 2).join(" / ")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function cleanReadingOutput(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/^\s+|\s+$/gmu, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s*/gmu, "")
    .replace(/^[-*_]{2,}\s*$/gmu, "")
    .replace(/[•●◆▶▷▪]/g, "")
    .replace(/^[\-*]\s+/gmu, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{3,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/Overall Energy/giu, "整体能量")
    .replace(/Card Symbolism/giu, "牌面象征解读")
    .replace(/Jungian Reflection/giu, "荣格式映照")
    .replace(/Hidden Pattern/giu, "隐藏模式")
    .replace(/Practical Guidance/giu, "实际建议")
    .replace(/Reflection Question/giu, "反思问题")
    .trim();
}

function splitReadingSections(text: string): ReadingSection[] {
  if (!text) return [];

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections = new Map<string, string[]>();
  let currentTitle = "整体能量";

  const ensureSection = (title: string) => {
    if (!sections.has(title)) {
      sections.set(title, []);
    }
  };

  ensureSection(currentTitle);

  for (const line of lines) {
    const normalized = line.toLowerCase();
    const mappedTitle = readingTitleMap.get(normalized) ?? readingTitleMap.get(line);

    if (mappedTitle) {
      currentTitle = mappedTitle;
      ensureSection(currentTitle);
      continue;
    }

    const compact = line.replace(/\s+/g, "");
    const compactTitle = readingTitleMap.get(compact);
    if (compactTitle) {
      currentTitle = compactTitle;
      ensureSection(currentTitle);
      continue;
    }

    sections.get(currentTitle)?.push(line);
  }

  return readingOrder
    .filter((title) => (sections.get(title) ?? []).length > 0)
    .map((title) => ({
      title,
      paragraphs: sections.get(title) ?? [],
    }));
}

function formatLocalDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
