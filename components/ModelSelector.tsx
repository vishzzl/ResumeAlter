"use client";

import { useState, useEffect } from "react";
import { useAIConfig, AIProvider } from "@/app/context/AIConfigContext";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export function ModelSelector() {
    const {
        availableModels,
        selectedModel,
        setSelectedModel,
        isLoadingModels,
        selectedProvider,
        setSelectedProvider,
        customModelConfig,
        updateCustomConfig
    } = useAIConfig();
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<AIProvider>(selectedProvider);

    // Sync tab with selected provider when opening
    useEffect(() => {
        // eslint-disable-next-line
        if (open) setActiveTab(selectedProvider);
    }, [open, selectedProvider]);

    const currentModelDisplay = () => {
        if (selectedProvider === 'gemini') {
            const m = availableModels.find(m => m.name === selectedModel);
            return m ? m.displayName : selectedModel;
        }
        if (selectedProvider === 'local') return `Local (${customModelConfig.localModel})`;
        if (selectedProvider === 'custom') return "Custom Config";
        return "Select AI Model";
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[260px] justify-between text-xs h-8 bg-white/50 backdrop-blur-sm border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 text-slate-700"
                >
                    <div className="flex items-center gap-2 truncate">
                        {selectedProvider === 'gemini' && <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />}
                        {selectedProvider === 'local' && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                        {selectedProvider === 'custom' && <div className="h-1.5 w-1.5 rounded-full bg-violet-500" />}
                        <span className="truncate font-medium">{currentModelDisplay()}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-40" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0 overflow-hidden bg-white/95 backdrop-blur-xl border border-slate-200 shadow-xl rounded-xl" align="end">
                <div className="flex border-b border-slate-100 bg-slate-50/50">
                    {(['gemini', 'local', 'custom'] as const).map((provider) => (
                        <button
                            key={provider}
                            onClick={() => setActiveTab(provider)}
                            className={cn(
                                "flex-1 px-3 py-2.5 text-[11px] uppercase tracking-wider font-semibold transition-colors border-b-2 outline-none",
                                activeTab === provider
                                    ? "border-indigo-500 text-indigo-600 bg-white"
                                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
                            )}
                        >
                            {provider === 'gemini' && "Gemini Cloud"}
                            {provider === 'local' && "Local LLM"}
                            {provider === 'custom' && "Custom"}
                        </button>
                    ))}
                </div>

                <div className="p-0">
                    {activeTab === 'gemini' && (
                        <div className="flex flex-col h-full">
                            <Command className="bg-transparent flex-1">
                                <CommandInput placeholder="Search Gemini models..." className="border-none focus:ring-0 text-xs py-2" />
                                <CommandList className="max-h-[200px] custom-scrollbar">
                                    <CommandEmpty className="py-6 text-center text-xs text-slate-400">No model found.</CommandEmpty>
                                    <CommandGroup heading="Available Models" className="text-slate-500">
                                        {availableModels.map((model) => (
                                            <CommandItem
                                                key={model.name}
                                                value={model.name}
                                                keywords={[model.displayName, model.name]}
                                                onSelect={(currentValue) => {
                                                    // Find model case-insensitively
                                                    const targetModel = availableModels.find(
                                                        m => m.name.toLowerCase() === currentValue.toLowerCase() ||
                                                            m.displayName.toLowerCase() === currentValue.toLowerCase()
                                                    );

                                                    if (targetModel) {
                                                        setSelectedProvider('gemini');
                                                        setSelectedModel(targetModel.name);
                                                        setOpen(false);
                                                    }
                                                }}
                                                className="cursor-pointer data-[disabled]:pointer-events-auto data-[disabled]:opacity-100 aria-selected:bg-indigo-50 aria-selected:text-indigo-700 my-1 mx-1 rounded-md transition-colors"
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-3.5 w-3.5 text-indigo-500",
                                                        selectedProvider === 'gemini' && selectedModel === model.name ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-700">{model.displayName}</span>
                                                    {model.description && (
                                                        <span className="text-[10px] text-slate-400 line-clamp-1">{model.description}</span>
                                                    )}
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>

                            {/* Status Check Section */}
                            <div className="p-2 border-t border-slate-100 bg-slate-50/50">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-between text-[10px] h-7 px-2 text-slate-500 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-indigo-100"
                                    onClick={async () => {
                                        const toastId = toast.loading("Checking API status...");
                                        try {
                                            const res = await fetch(`/api/quota?modelName=${selectedModel}`);
                                            const data = await res.json();

                                            if (data.status === 'ok') {
                                                toast.success(`Service Operational`, {
                                                    id: toastId,
                                                    description: `Model: ${data.model}`
                                                });
                                            } else {
                                                toast.error(`Issue Detected`, {
                                                    id: toastId,
                                                    description: data.message
                                                });
                                            }
                                        } catch (e) {
                                            toast.error("Failed to check status", {
                                                id: toastId,
                                                description: "Network or server error"
                                            });
                                        }
                                    }}
                                >
                                    <span>Check API Status</span>
                                    <div className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-400" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
