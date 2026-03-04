"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface SearchSource {
    url: string;
    title: string;
    domain: string;
    faviconUrl?: string;
    snippet?: string;
    citationIndex: number;
}

export interface SearchImage {
    url: string;
    alt: string;
    sourceUrl?: string;
}

export interface SearchState {
    query: string;
    answer: string;
    sources: SearchSource[];
    images: SearchImage[];
    relatedQuestions: string[];
    isStreaming: boolean;
    isConnecting: boolean;
    error: string | null;
    model: string;
    tokensUsed: number;
}

export function useSearch(query: string, focusMode: string = "all") {
    const [state, setState] = useState<SearchState>({
        query,
        answer: "",
        sources: [],
        images: [],
        relatedQuestions: [],
        isStreaming: false,
        isConnecting: true,
        error: null,
        model: "Auto",
        tokensUsed: 0,
    });

    const abortRef = useRef<AbortController | null>(null);
    const hasStarted = useRef(false);

    const runSearch = useCallback(async (q: string, focus: string) => {
        if (!q.trim()) return;

        // Abort any in-flight request
        abortRef.current?.abort();
        abortRef.current = new AbortController();

        setState(prev => ({
            ...prev,
            answer: "",
            sources: [],
            images: [],
            relatedQuestions: [],
            isStreaming: true,
            isConnecting: true,
            error: null,
        }));

        try {
            const response = await fetch(`${API_BASE}/api/v1/search/stream`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(typeof window !== "undefined" && localStorage.getItem("orivanta_access_token")
                        ? { Authorization: `Bearer ${localStorage.getItem("orivanta_access_token")}` }
                        : {}),
                },
                body: JSON.stringify({ query: q, focus_mode: focus }),
                signal: abortRef.current.signal,
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status} ${response.statusText}`);
            }

            setState(prev => ({ ...prev, isConnecting: false }));

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === "data: [DONE]") continue;
                    if (!trimmed.startsWith("data: ")) continue;

                    try {
                        const json = JSON.parse(trimmed.slice(6));

                        if (json.type === "token") {
                            setState(prev => ({ ...prev, answer: prev.answer + (json.content || "") }));
                        } else if (json.type === "sources") {
                            setState(prev => ({ ...prev, sources: json.sources || [] }));
                        } else if (json.type === "images") {
                            setState(prev => ({ ...prev, images: json.images || [] }));
                        } else if (json.type === "related") {
                            setState(prev => ({ ...prev, relatedQuestions: json.questions || [] }));
                        } else if (json.type === "meta") {
                            setState(prev => ({
                                ...prev,
                                model: json.model || "Auto",
                                tokensUsed: json.tokens_used || 0,
                            }));
                        } else if (json.type === "error") {
                            setState(prev => ({ ...prev, error: json.message || "Search failed" }));
                        }
                    } catch {
                        // Partial JSON — skip
                    }
                }
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name === "AbortError") return;
            const msg = err instanceof Error ? err.message : "Search failed";
            setState(prev => ({
                ...prev,
                error: msg,
                isConnecting: false,
            }));
        } finally {
            setState(prev => ({ ...prev, isStreaming: false, isConnecting: false }));
        }
    }, []);

    useEffect(() => {
        if (!query || hasStarted.current) return;
        hasStarted.current = true;
        runSearch(query, focusMode);
        return () => {
            hasStarted.current = false;
            abortRef.current?.abort();
        };
    }, [query, focusMode, runSearch]);

    return { ...state, retry: () => runSearch(query, focusMode) };
}
