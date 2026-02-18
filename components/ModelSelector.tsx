"use client";

import { useState, useEffect } from "react";
import { useAIConfig, AIProvider } from "@/app/context/AIConfigContext";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
                        <Command className="bg-transparent">
                            <CommandInput placeholder="Search Gemini models..." className="border-none focus:ring-0 text-xs py-2" />
                            <CommandList className="max-h-[300px] custom-scrollbar">
                                <CommandEmpty className="py-6 text-center text-xs text-slate-400">No model found.</CommandEmpty>
                                <CommandGroup heading="Available Models" className="text-slate-500">
                                    {availableModels.map((model) => (
                                        <CommandItem
                                            key={model.name}
                                            value={model.name}
                                            keywords={[model.displayName, model.name]}
                                            onSelect={(currentValue) => {
                                                console.log("Selected raw value:", currentValue);
                                                // Find model case-insensitively
                                                const targetModel = availableModels.find(
                                                    m => m.name.toLowerCase() === currentValue.toLowerCase() ||
                                                        m.displayName.toLowerCase() === currentValue.toLowerCase()
                                                );

                                                if (targetModel) {
                                                    console.log("Setting model to:", targetModel.name);
                                                    setSelectedProvider('gemini');
                                                    setSelectedModel(targetModel.name);
                                                    setOpen(false);
                                                } else {
                                                    console.warn("Could not find model for value:", currentValue);
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
                    )}

                    {activeTab === 'local' && (
                        <div className="p-4 space-y-4 bg-slate-50/30">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600">Ollama URL</label>
                                <input
                                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                                    placeholder="http://localhost:11434"
                                    value={customModelConfig.localUrl}
                                    onChange={(e) => updateCustomConfig({ localUrl: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600">Model Name</label>
                                <input
                                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                                    placeholder="llama3, mistral, etc."
                                    value={customModelConfig.localModel}
                                    onChange={(e) => updateCustomConfig({ localModel: e.target.value })}
                                />
                            </div>
                            <Button
                                size="sm"
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                onClick={() => {
                                    setSelectedProvider('local');
                                    setOpen(false);
                                }}
                            >
                                Use Local Provider
                            </Button>
                        </div>
                    )}

                    {activeTab === 'custom' && (
                        <div className="p-4 space-y-4 bg-slate-50/30">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600">API Endpoint</label>
                                <input
                                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 outline-none transition-all placeholder:text-slate-300"
                                    placeholder="https://api.openai.com/v1..."
                                    value={customModelConfig.customUrl}
                                    onChange={(e) => updateCustomConfig({ customUrl: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600">API Key</label>
                                <input
                                    type="password"
                                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 outline-none transition-all placeholder:text-slate-300"
                                    placeholder="sk-..."
                                    value={customModelConfig.customKey}
                                    onChange={(e) => updateCustomConfig({ customKey: e.target.value })}
                                />
                            </div>
                            <Button
                                size="sm"
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                                onClick={() => {
                                    setSelectedProvider('custom');
                                    setOpen(false);
                                }}
                            >
                                Use Custom Provider
                            </Button>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
