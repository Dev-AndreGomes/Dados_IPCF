"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  IPCF_SEDE_ADDRESS,
  IPCF_SEDE_COORDS,
} from "@/lib/geocoding/recife-coords";

export interface MapMarkerItem {
  id: string;
  label: string;
  subtitle?: string;
  bairro: string;
  lat: number;
  lng: number;
  count?: number;
  href?: string;
}

interface LeafletMapClientProps {
  markers: MapMarkerItem[];
  heightClass?: string;
  center?: [number, number];
  zoom?: number;
  showSede?: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function LeafletMapClient({
  markers,
  heightClass = "h-80",
  center = IPCF_SEDE_COORDS,
  zoom = 13,
  showSede = true,
}: LeafletMapClientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const sedeLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const initialViewRef = useRef({ center, zoom });

  // Inicializa o mapa e a camada de tiles apenas uma vez (evita recarregar tiles a cada filtro)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: initialViewRef.current.center,
      zoom: initialViewRef.current.zoom,
      scrollWheelZoom: false,
    });
    mapRef.current = map;

    L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
      attribution: "Mapas © Google · Dados IPCF",
      maxZoom: 19,
    }).addTo(map);

    sedeLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      sedeLayerRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Atualiza apenas os pinos e enquadramento quando filtros/marcadores mudam
  useEffect(() => {
    const map = mapRef.current;
    const sedeLayer = sedeLayerRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !sedeLayer || !markersLayer) return;

    sedeLayer.clearLayers();
    markersLayer.clearLayers();

    if (showSede) {
      const sedeIcon = L.divIcon({
        className: "ipcf-sede-marker",
        html: `<div style="width:28px;height:28px;border-radius:9999px;background:#12392a;border:3px solid #cf9841;display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:800;font-size:12px;box-shadow:0 3px 10px rgba(0,0,0,0.3);">✝</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker(IPCF_SEDE_COORDS, { icon: sedeIcon })
        .addTo(sedeLayer)
        .bindPopup(
          `<div style="font-family:sans-serif;min-width:190px;">
            <strong style="color:#12392a;">Igreja Presbiteriana em Casa Forte</strong><br/>
            <span style="font-size:12px;color:#5b6961;">${escapeHtml(IPCF_SEDE_ADDRESS)}</span>
          </div>`
        );
    }

    const validMarkers = markers.filter(
      (m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)
    );

    const boundsPoints: [number, number][] = showSede ? [IPCF_SEDE_COORDS] : [];

    for (const item of validMarkers) {
      boundsPoints.push([item.lat, item.lng]);
      const radius = item.count ? Math.min(18, 7 + item.count * 1.5) : 9;

      const marker = L.circleMarker([item.lat, item.lng], {
        radius,
        color: "#12392a",
        weight: 2,
        fillColor: "#cf9841",
        fillOpacity: 0.88,
      }).addTo(markersLayer);

      const linkHtml = item.href
        ? `<br/><a href="${escapeHtml(item.href)}" style="display:inline-block;margin-top:6px;color:#1b4d37;font-weight:700;text-decoration:underline;font-size:12px;">Abrir ficha completa →</a>`
        : "";

      marker.bindPopup(
        `<div style="font-family:sans-serif;min-width:165px;">
          <strong style="color:#12392a;">${escapeHtml(item.label)}</strong><br/>
          <span style="font-size:12px;color:#5b6961;">${escapeHtml(item.bairro)}</span>
          ${item.subtitle ? `<br/><span style="font-size:12px;color:#17231d;">${escapeHtml(item.subtitle)}</span>` : ""}
          ${linkHtml}
        </div>`
      );
    }

    if (validMarkers.length === 1 && !showSede) {
      map.setView([validMarkers[0].lat, validMarkers[0].lng], 15, {
        animate: false,
      });
    } else if (boundsPoints.length > 1) {
      map.fitBounds(boundsPoints, {
        padding: [36, 36],
        maxZoom: 15,
        animate: false,
      });
    } else {
      map.setView(center, zoom, { animate: false });
    }
  }, [markers, center, zoom, showSede]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Mapa interativo de localização geográfica dos membros da IPCF"
      className={`relative z-0 isolate w-full overflow-hidden rounded-xl border border-ipcf-border bg-ipcf-bg ${heightClass}`}
    />
  );
}
