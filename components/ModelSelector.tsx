"use client";

import { useEffect, useState } from "react";
import { useAIConfig, AIProvider, Model } from "@/app/context/AIConfigContext";
import {
    AlertTriangle,
    Check,
    ChevronDown,
    ChevronsUpDown,
    Clock3,
    Cpu,
    KeyRound,
    RefreshCw,
    Server,
    WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatTokenCount } from "@/lib/gemini-quota";

interface ModelSelectorProps {
    estimatedInputTokens?: number;
}



function familyTone(model?: Model) {
    if (model?.family === "pro") return "bg-amber-50 text-amber-700 border-amber-200";
    if (model?.family === "experimental") return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function statusTone(state?: string) {
    switch (state) {
        case "ok":
            return "bg-emerald-50 text-emerald-700 border-emerald-200";
        case "quota":
            return "bg-amber-50 text-amber-700 border-amber-200";
        case "timeout":
        case "network":
            return "bg-orange-50 text-orange-700 border-orange-200";
        case "auth":
        case "model":
        case "error":
            return "bg-rose-50 text-rose-700 border-rose-200";
        case "checking":
            return "bg-sky-50 text-sky-700 border-sky-200";
        default:
            return "bg-slate-100 text-slate-600 border-slate-200";
    }
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
            return "bg-slate-400";
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
            return "Unknown";
    }
}

export function ModelSelector({ estimatedInputTokens }: ModelSelectorProps) {
    const {
        availableModels,
        selectedModel,
        setSelectedModel,
        isLoadingModels,
        selectedProvider,
        setSelectedProvider,
        customModelConfig,
        updateCustomConfig,
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
        description: "Previously selected model",
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

    const requestSize = estimatedInputTokens ? `~${formatTokenCount(estimatedInputTokens)}` : "Unknown";

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
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="h-9 w-[280px] justify-between rounded-xl border-slate-200 bg-white/75 text-xs text-slate-700 shadow-sm backdrop-blur-sm hover:bg-white hover:border-slate-300"
                >
                    <div className="flex min-w-0 items-center gap-2">
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", selectedProvider === "gemini" ? statusDotClass(currentStatus?.state) : selectedProvider === "local" ? "bg-emerald-500" : "bg-violet-500")} />
                        <span className="truncate font-medium">{currentModelDisplay()}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
                </Button>
            </PopoverTrigger>

            <PopoverContent
                align="end"
                className="flex max-h-[min(76vh,620px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-0 shadow-2xl backdrop-blur-xl"
            >
                <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Model</p>
                            <h3 className="mt-0.5 truncate text-sm font-bold text-slate-900">{currentModelDisplay()}</h3>
                        </div>
                        {selectedProvider === "gemini" && (
                            <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", familyTone(currentModel))}>
                                {currentModel.family || "flash"}
                            </span>
                        )}
                    </div>

                    {selectedProvider === "gemini" && (
                        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                                <p className="text-slate-400">Health</p>
                                <p className={cn("mt-0.5 font-bold", currentStatus?.state === "quota" ? "text-amber-700" : currentStatus?.state === "ok" ? "text-emerald-700" : "text-slate-700")}>
                                    {statusLabel(currentStatus?.state)}
                                </p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                                <p className="text-slate-400">Input</p>
                                <p className="mt-0.5 font-bold text-slate-700">{requestSize}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                                <p className="text-slate-400">Limit</p>
                                <p className="mt-0.5 font-bold text-slate-700">{formatTokenCount(currentModel.inputTokenLimit ?? null)}</p>
                            </div>
                        </div>
                    )}
                </div>

                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="shrink-0 space-y-2 border-b border-slate-100 p-3">
                            <div className={cn("rounded-lg border px-3 py-2 text-[11px]", statusTone(currentStatus?.state))}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        {currentStatus?.state === "quota" ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : null}
                                        <span className="truncate font-bold">{currentStatus?.message || "No recent health check"}</span>
                                    </div>
                                    {cooldown && cooldown > 0 ? (
                                        <span className="inline-flex shrink-0 items-center gap-1 font-bold">
                                            <Clock3 className="h-3 w-3" />
                                            {cooldown}s
                                        </span>
                                    ) : null}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Filter models..."
                                    className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-700 outline-none focus:border-slate-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => refreshGeminiStatus()}
                                    disabled={currentStatus?.state === "checking"}
                                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                    title="Refresh Gemini health"
                                >
                                    <RefreshCw className={cn("h-3.5 w-3.5", currentStatus?.state === "checking" && "animate-spin")} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowDetails(value => !value)}
                                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-500 hover:bg-slate-50"
                                    title="Show quota details"
                                >
                                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDetails && "rotate-180")} />
                                </button>
                            </div>

                            {showDetails && (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
                                    <p>{currentStatus?.detail || "Gemini does not expose exact remaining quota counts here. This panel shows last-known health and retry hints."}</p>
                                    {currentStatus?.knownRemaining.requestsToday === 0 || currentStatus?.knownRemaining.inputTokensToday === 0 ? (
                                        <p className="mt-2 font-bold text-amber-700">Known remaining today: 0</p>
                                    ) : null}
                                    {currentStatus?.exhaustedLabels?.length ? (
                                        <p className="mt-2">Exhausted: {currentStatus.exhaustedLabels.join(", ")}</p>
                                    ) : null}
                                    <p className="mt-2">Output cap: {formatTokenCount(currentModel.outputTokenLimit ?? null)} tokens</p>
                                </div>
                            )}
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-2 custom-scrollbar">
                            {isLoadingModels ? (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">Loading models...</div>
                            ) : geminiModels.length === 0 ? (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No models match.</div>
                            ) : geminiModels.map(model => {
                                const modelStatus = geminiStatuses[model.name];
                                const modelCooldown = modelStatus?.retryAfterSeconds
                                    ? Math.max(0, modelStatus.retryAfterSeconds - Math.floor((now - modelStatus.checkedAt) / 1000))
                                    : null;
                                const isSelected = selectedProvider === "gemini" && selectedModel === model.name;

                                return (
                                    <button
                                        key={model.name}
                                        type="button"
                                        onClick={() => {
                                            setSelectedProvider("gemini");
                                            setSelectedModel(model.name);
                                            setOpen(false);
                                        }}
                                        className={cn(
                                            "mb-1.5 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all",
                                            isSelected
                                                ? "border-slate-900 bg-slate-900 text-white"
                                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                        )}
                                    >
                                        <Check className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <span className="truncate text-sm font-semibold">{model.displayName}</span>
                                                <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase", isSelected ? "border-white/20 bg-white/10 text-white" : familyTone(model))}>
                                                    {model.family || "flash"}
                                                </span>
                                            </div>
                                            <p className={cn("truncate text-[11px]", isSelected ? "text-slate-300" : "text-slate-500")}>
                                                {model.bestFor || model.name}
                                            </p>
                                        </div>
                                        {modelStatus?.state && modelStatus.state !== "idle" ? (
                                            <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", isSelected ? "border-white/20 bg-white/10 text-white" : statusTone(modelStatus.state))}>
                                                {modelCooldown && modelCooldown > 0 ? `${modelCooldown}s` : statusLabel(modelStatus.state)}
                                            </span>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
            </PopoverContent>
        </Popover>
    );
}
