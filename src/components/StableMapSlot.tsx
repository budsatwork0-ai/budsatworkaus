"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export default function StableMapSlot({ children, className, style }: Props) {
  const baseClass = "relative overflow-hidden";
  const mergedClass = className ? `${baseClass} ${className}` : baseClass;
  return (
    <div
      className={mergedClass}
      style={{
        background: "#ffffff",
        isolation: "isolate",
        position: "relative",
        width: "100%",
        contain: "layout paint size",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
