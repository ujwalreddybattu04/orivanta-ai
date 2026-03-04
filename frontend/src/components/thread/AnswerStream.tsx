"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SearchSource } from "@/hooks/useSearch";

interface AnswerStreamProps {
    content: string;
    isStreaming: boolean;
    sources: SearchSource[];
    onCopy?: () => void;
}

export default function AnswerStream({ content, isStreaming, sources, onCopy }: AnswerStreamProps) {
    // Convert generic [1] citations into markdown links [1](1)
    // ReactMarkdown parses them into 'a' tags which we intercept below
    const processedContent = content.replace(/\[(\d+)\]/g, '[$1]($1)');

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        onCopy?.();
    };

    return (
        <div className="answer-stream" id="answer-stream">
            {/* Answer header bar */}
            <div className="answer-stream-header">
                <div className="answer-stream-label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <span>Answer</span>
                    {isStreaming && <span className="answer-streaming-dot" />}
                </div>
                <div className="answer-stream-actions">
                    <button
                        className="answer-action-btn"
                        onClick={handleCopy}
                        title="Copy answer"
                        aria-label="Copy answer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                    </button>
                    <button
                        className="answer-action-btn"
                        title="Share"
                        aria-label="Share answer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Markdown content with inline citations */}
            <div className="answer-stream-content">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        p: ({ children }) => (
                            <p className="answer-paragraph">{children}</p>
                        ),
                        h2: ({ children }) => (
                            <h2 className="answer-h2">{children}</h2>
                        ),
                        h3: ({ children }) => (
                            <h3 className="answer-h3">{children}</h3>
                        ),
                        ul: ({ children }) => (
                            <ul className="answer-list">{children}</ul>
                        ),
                        ol: ({ children }) => (
                            <ol className="answer-list answer-list-ordered">{children}</ol>
                        ),
                        li: ({ children }) => (
                            <li className="answer-list-item">{children}</li>
                        ),
                        code: ({ children, className }) => {
                            const isBlock = className?.includes("language-");
                            if (isBlock) {
                                return <pre className="answer-code-block"><code>{children}</code></pre>;
                            }
                            return <code className="answer-code-inline">{children}</code>;
                        },
                        strong: ({ children }) => (
                            <strong className="answer-bold">{children}</strong>
                        ),
                        a: ({ href, children }) => {
                            // Intercept fake [1](1) citation links
                            if (href && !isNaN(Number(href))) {
                                const index = parseInt(href, 10);
                                const realSource = sources[index - 1];
                                return (
                                    <a
                                        href={realSource?.url || "#"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="citation-pill"
                                        title={realSource?.title || "Source"}
                                        data-index={index}
                                    >
                                        <span className="citation-pill-domain">
                                            {realSource?.domain ? realSource.domain.replace(/^www\./, '') : index}
                                        </span>
                                    </a>
                                );
                            }
                            return <a href={href} className="answer-link" target="_blank" rel="noopener noreferrer">{children}</a>;
                        },
                    }}
                >
                    {processedContent}
                </ReactMarkdown>

                {/* Streaming cursor */}
                {isStreaming && <span className="answer-cursor" aria-hidden="true">▋</span>}
            </div>
        </div>
    );
}
