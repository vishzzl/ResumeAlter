"use client";

import { useEffect, useState } from "react";
import { useAIConfig, Model } from "@/app/context/AIConfigContext";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Clock3,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatTokenCount } from "@/lib/gemini-quota";

interface ModelSelectorProps {
  estimatedInputTokens?: number;
}

function familyTone(model?: Model) {
  if (model?.family === "pro") return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  if (model?.family === "experimental") return "bg-rose-500/20 text-rose-300 border-rose-500/40";
  return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
}

function statusDotClass(state?: string) {
  switch (state) {
    case "ok":
      return "bg-emerald-500";
    case "quota":
      return "bg-amber-500";
    case "timeout":
    case "network":
      return "bg-orange-500";
    case "auth":
    case "model":
    case "error":
      return "bg-rose-500";
    case "checking":
      return "bg-sky-500";
    default:
      return "bg-emerald-400";
  }
}

function statusLabel(state?: string) {
  switch (state) {
    case "ok":
      return "Ready";
    case "quota":
      return "Quota";
    case "timeout":
      return "Timeout";
    case "network":
      return "Network";
    case "auth":
      return "Key";
    case "model":
      return "Unavailable";
    case "checking":
      return "Checking";
    case "error":
      return "Issue";
    default:
      return "Active";
  }
}

export function ModelSelector({ estimatedInputTokens }: ModelSelectorProps) {
  const {
    availableModels,
    selectedModel,
    setSelectedModel,
    isLoadingModels,
    geminiStatuses,
    refreshGeminiStatus,
  } = useAIConfig();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const currentModel = availableModels.find(model => model.name === selectedModel) || {
    name: selectedModel,
    displayName: selectedModel,
    description: "Google Gemini Model",
    family: selectedModel.includes("pro") ? "pro" : "flash",
    stability: "stable",
  };
  const currentStatus = geminiStatuses[selectedModel];
  const cooldown = currentStatus?.retryAfterSeconds
    ? Math.max(0, currentStatus.retryAfterSeconds - Math.floor((now - currentStatus.checkedAt) / 1000))
    : null;

  const geminiModels = availableModels.filter(model => {
    const haystack = `${model.displayName} ${model.name} ${model.description || ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const requestSize = estimatedInputTokens ? `~${formatTokenCount(estimatedInputTokens)}` : "1Pass Stream";

  const currentModelDisplay = () => {
    return currentModel.displayName || selectedModel;
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setShowDetails(false);
          setNow(Date.now());
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          role="combobox"
          aria-expanded={open}
          className="skeuo-button-secondary px-3 py-1.5 flex items-center justify-between gap-2 text-xs w-[240px]"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn("h-2 w-2 shrink-0 rounded-full shadow-sm", statusDotClass(currentStatus?.state))} />
            <span className="truncate font-bold">{currentModelDisplay()}</span>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="flex max-h-[min(76vh,620px)] w-[min(92vw,380px)] flex-col overflow-hidden skeuo-panel p-0 shadow-2xl z-50"
      >
        {/* Header Title Bar */}
        <div className="flex items-center justify-between border-b border-[#d8cfc0] dark:border-[#282e3c] px-4 py-3 bg-[#e6e0d4] dark:bg-[#12151f]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Google AI Model Engine
            </span>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
            Free Tier Optimized
          </span>
        </div>

        {/* Selected Model Details Plate */}
        <div className="shrink-0 border-b border-[#d8cfc0] dark:border-[#282e3c] bg-[#ede8de] dark:bg-[#151923] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Active Model</p>
              <h3 className="mt-0.5 truncate text-sm font-extrabold text-slate-900 dark:text-slate-100">{currentModelDisplay()}</h3>
            </div>
            <span className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase", familyTone(currentModel))}>
              {currentModel.family || "flash"}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <div className="skeuo-well px-2 py-1.5 text-center">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Health</p>
              <p className={cn("mt-0.5 font-extrabold", currentStatus?.state === "quota" ? "text-amber-600" : "text-emerald-600 dark:text-emerald-400")}>
                {statusLabel(currentStatus?.state)}
              </p>
            </div>
            <div className="skeuo-well px-2 py-1.5 text-center">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Pipeline</p>
              <p className="mt-0.5 font-extrabold text-slate-800 dark:text-slate-200">{requestSize}</p>
            </div>
            <div className="skeuo-well px-2 py-1.5 text-center">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Context</p>
              <p className="mt-0.5 font-extrabold text-slate-800 dark:text-slate-200">{formatTokenCount(currentModel.inputTokenLimit ?? 1000000)}</p>
            </div>
          </div>
        </div>

        {/* Filter Input & Actions */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 space-y-2.5 border-b border-[#d8cfc0] dark:border-[#282e3c] p-3">
            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter Gemini models..."
                className="skeuo-well h-8 min-w-0 flex-1 px-3 text-[11px] font-medium outline-none"
              />
              <button
                type="button"
                onClick={() => refreshGeminiStatus()}
                disabled={currentStatus?.state === "checking"}
                className="skeuo-button-secondary h-8 px-2.5 flex items-center justify-center"
                title="Refresh Gemini Health"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", currentStatus?.state === "checking" && "animate-spin")} />
              </button>
              <button
                type="button"
                onClick={() => setShowDetails(value => !value)}
                className="skeuo-button-secondary h-8 px-2.5 flex items-center justify-center"
                title="Show Quota Details"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDetails && "rotate-180")} />
              </button>
            </div>

            {showDetails && (
              <div className="skeuo-well p-3 text-[11px] space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">Gemini Free Tier Specs:</p>
                <p className="text-slate-600 dark:text-slate-400">• Max 15 Requests Per Minute (RPM)</p>
                <p className="text-slate-600 dark:text-slate-400">• 1,000,000 Tokens Limit per Minute</p>
                <p className="text-slate-600 dark:text-slate-400">• Optimized via 1-Pass Consolidated Tailoring Pipeline</p>
              </div>
            )}
          </div>

          {/* Model Options List */}
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {isLoadingModels ? (
              <div className="skeuo-well p-3 text-xs text-center text-slate-500">Loading Gemini catalog...</div>
            ) : geminiModels.length === 0 ? (
              <div className="skeuo-well p-3 text-xs text-center text-slate-500">No Gemini models match.</div>
            ) : geminiModels.map(model => {
              const isSelected = selectedModel === model.name;

              return (
                <button
                  key={model.name}
                  type="button"
                  onClick={() => {
                    setSelectedModel(model.name);
                    setOpen(false);
                  }}
                  className={cn(
                    "mb-2 flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left transition-all border",
                    isSelected
                      ? "bg-amber-700 dark:bg-indigo-600 text-white border-amber-800 dark:border-indigo-500 shadow-md"
                      : "skeuo-button-secondary"
                  )}
                >
                  <Check className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-xs font-bold">{model.displayName}</span>
                      <span className={cn(
                        "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-extrabold uppercase",
                        isSelected ? "border-white/30 bg-white/20 text-white" : familyTone(model)
                      )}>
                        {model.family || "flash"}
                      </span>
                    </div>
                    <p className={cn("truncate text-[11px]", isSelected ? "text-amber-100 dark:text-indigo-100" : "text-slate-600 dark:text-slate-400")}>
                      {model.bestFor || model.name}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
