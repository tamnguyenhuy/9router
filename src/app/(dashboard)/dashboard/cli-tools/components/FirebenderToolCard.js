"use client";

import { useState, useEffect } from "react";
import { Card, Button, Badge, ModelSelectModal } from "@/shared/components";
import Image from "next/image";

export default function FirebenderToolCard({
    tool,
    isExpanded,
    onToggle,
    activeProviders,
    hasActiveProviders,
}) {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [modelMappings, setModelMappings] = useState({});
    const [modalOpen, setModalOpen] = useState(false);
    const [currentEditingAlias, setCurrentEditingAlias] = useState(null);

    useEffect(() => {
        if (isExpanded) {
            loadSavedMappings();
        }
    }, [isExpanded]);

    const loadSavedMappings = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/cli-tools/antigravity-mitm/alias?tool=firebender");
            if (res.ok) {
                const data = await res.json();
                const aliases = data.aliases || {};

                // Merge with defaultOriginModels
                const defaultModels = tool.defaultOriginModels || [];
                const merged = { ...aliases };
                defaultModels.forEach(m => {
                    if (merged[m] === undefined) {
                        merged[m] = "";
                    }
                });

                setModelMappings(merged);
            }
        } catch (error) {
            console.log("Error loading saved mappings:", error);
        } finally {
            setLoading(false);
        }
    };

    const openModelSelector = (alias) => {
        setCurrentEditingAlias(alias);
        setModalOpen(true);
    };

    const handleModelSelect = (model) => {
        if (currentEditingAlias !== null) {
            setModelMappings(prev => ({
                ...prev,
                [currentEditingAlias]: model.value,
            }));
        }
    };

    const handleModelMappingChange = (alias, value) => {
        setModelMappings(prev => ({
            ...prev,
            [alias]: value,
        }));
    };

    const handleDeleteMapping = (alias) => {
        setModelMappings(prev => {
            const next = { ...prev };
            delete next[alias];
            return next;
        });
    };

    const handleAddNewMapping = () => {
        const newKey = `origin-model-${Date.now()}`;
        setModelMappings(prev => ({
            ...prev,
            [newKey]: "" // Empty value to show "Select"
        }));
    };

    const handleRenameAliasKey = (oldKey, newKey) => {
        setModelMappings(prev => {
            if (oldKey === newKey || !newKey.trim()) return prev;
            if (prev[newKey] !== undefined) return prev;

            const next = { ...prev };
            next[newKey] = next[oldKey];
            delete next[oldKey];
            return next;
        });
    };

    const handleSaveMappings = async () => {
        setLoading(true);
        setMessage(null);

        const cleanedMappings = {};
        for (const [key, val] of Object.entries(modelMappings)) {
            if (key && !key.startsWith("origin-model-") && key.trim() !== "") {
                cleanedMappings[key] = val;
            }
        }
        setModelMappings(cleanedMappings);

        try {
            const res = await fetch("/api/cli-tools/antigravity-mitm/alias", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tool: "firebender", mappings: cleanedMappings }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save mappings");
            }

            setMessage({ type: "success", text: "Mappings saved!" });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card padding="sm" className="overflow-hidden">
            <div className="flex items-center justify-between hover:cursor-pointer" onClick={onToggle}>
                <div className="flex items-center gap-3">
                    <div className="size-8 flex items-center justify-center shrink-0">
                        {tool.image ? (
                            <Image
                                src={tool.image}
                                alt={tool.name}
                                width={32}
                                height={32}
                                className="size-8 object-contain rounded-lg"
                            />
                        ) : (
                            <span className="material-symbols-outlined text-[32px]" style={{ color: tool.color }}>{tool.icon || "build"}</span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm">{tool.name}</h3>
                            <Badge variant="success" size="sm">Active Integration</Badge>
                        </div>
                        <p className="text-xs text-text-muted truncate">{tool.description}</p>
                    </div>
                </div>
                <span className={`material-symbols-outlined text-text-muted text-[20px] transition-transform ${isExpanded ? "rotate-180" : ""}`}>expand_more</span>
            </div>

            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">

                    <div className="flex flex-col gap-1.5 px-1 mb-2">
                        <p className="text-xs text-text-muted">
                            Map requested model strings (e.g. from firebender.com) to your available provider models.
                        </p>
                    </div>

                    {message?.type === "error" && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs bg-red-500/10 text-red-600">
                            <span className="material-symbols-outlined text-[14px]">error</span>
                            <span>{message.text}</span>
                        </div>
                    )}
                    {message?.type === "success" && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs bg-green-500/10 text-green-600">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            <span>{message.text}</span>
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        {Object.entries(modelMappings).map(([alias, targetModel]) => {
                            const displayAlias = alias.startsWith("origin-model-") ? "" : alias;
                            return (
                                <div key={alias} className="flex flex-col sm:flex-row sm:items-center gap-2">
                                    <input
                                        type="text"
                                        defaultValue={displayAlias}
                                        onBlur={(e) => handleRenameAliasKey(alias, e.target.value)}
                                        placeholder="Origin Model (e.g. gpt-4)"
                                        className="w-full sm:w-1/3 px-2 py-1.5 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                                    />

                                    <span className="hidden sm:block material-symbols-outlined text-text-muted text-[14px]">arrow_forward</span>

                                    <div className="flex items-center gap-2 flex-1">
                                        <input
                                            type="text"
                                            value={targetModel || ""}
                                            onChange={(e) => handleModelMappingChange(alias, e.target.value)}
                                            placeholder="provider/model-id"
                                            className="flex-1 px-2 py-1.5 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                                        />
                                        <button
                                            onClick={() => openModelSelector(alias)}
                                            disabled={!hasActiveProviders}
                                            className={`px-2 py-1.5 rounded border text-xs transition-colors shrink-0 whitespace-nowrap ${hasActiveProviders ? "bg-surface border-border text-text-main hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed border-border"}`}
                                        >
                                            Select
                                        </button>
                                        <button
                                            onClick={() => handleDeleteMapping(alias)}
                                            className="p-1 text-text-muted hover:text-red-500 rounded transition-colors"
                                            title="Remove"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAddNewMapping}
                        >
                            <span className="material-symbols-outlined text-[14px] mr-1">add</span>
                            Add Model Mapping
                        </Button>

                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSaveMappings}
                            disabled={loading || Object.keys(modelMappings).length === 0}
                        >
                            <span className="material-symbols-outlined text-[14px] mr-1">save</span>
                            Save Mappings
                        </Button>
                    </div>

                </div>
            )}

            {/* Model Select Modal */}
            <ModelSelectModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSelect={handleModelSelect}
                selectedModel={currentEditingAlias ? modelMappings[currentEditingAlias] : null}
                activeProviders={activeProviders}
                title="Select target model"
            />
        </Card>
    );
}
