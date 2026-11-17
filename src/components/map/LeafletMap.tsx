"use client";

import dynamic from "next/dynamic";
import type { MapMarkerItem } from "./LeafletMapClient";

const DynamicLeafletMap = dynamic(
  () => import("./LeafletMapClient").then((mod) => mod.LeafletMapClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-80 w-full items-center justify-center rounded-xl border border-ipcf-border bg-ipcf-bg text-sm text-ipcf-muted">
        Carregando mapa geográfico...
      </div>
    ),
  }
);

export type { MapMarkerItem };

export function LeafletMap(props: {
  markers: MapMarkerItem[];
  heightClass?: string;
  center?: [number, number];
  zoom?: number;
  showSede?: boolean;
}) {
  return <DynamicLeafletMap {...props} />;
}
