"use client";

import { useState } from "react";

interface SearchImage {
    url: string;
    alt: string;
    sourceUrl?: string;
}

interface ImagesGridProps {
    images: SearchImage[];
}

export default function ImagesGrid({ images }: ImagesGridProps) {
    const [lightboxImg, setLightboxImg] = useState<SearchImage | null>(null);

    if (!images || images.length === 0) return null;

    const displayImages = images.slice(0, 4);

    return (
        <>
            <div className="images-grid" id="images-grid">
                {displayImages.map((img, i) => (
                    <button
                        key={i}
                        className="images-grid-item"
                        onClick={() => setLightboxImg(img)}
                        aria-label={`View image: ${img.alt}`}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={img.url}
                            alt={img.alt}
                            className="images-grid-img"
                            loading="lazy"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                            }}
                        />
                        <div className="images-grid-overlay">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                            </svg>
                        </div>
                    </button>
                ))}
            </div>

            {/* Lightbox Modal */}
            {lightboxImg && (
                <div
                    className="lightbox-overlay"
                    onClick={() => setLightboxImg(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Image preview"
                >
                    <button
                        className="lightbox-close"
                        onClick={() => setLightboxImg(null)}
                        aria-label="Close lightbox"
                    >
                        ✕
                    </button>
                    <div className="lightbox-content" onClick={e => e.stopPropagation()}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={lightboxImg.url}
                            alt={lightboxImg.alt}
                            className="lightbox-img"
                        />
                        {lightboxImg.alt && (
                            <p className="lightbox-caption">{lightboxImg.alt}</p>
                        )}
                        {lightboxImg.sourceUrl && (
                            <a
                                href={lightboxImg.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="lightbox-source-link"
                                onClick={e => e.stopPropagation()}
                            >
                                View source ↗
                            </a>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
