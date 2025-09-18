import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* GeoMap polygon picker for Indian Ocean */
export default function GeoMapPicker({ onConfirm }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef({ markers: [], line: null, polygon: null });
  const [points, setPoints] = useState([]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
      });

      // Fit to Indian Ocean approx bounds: lat -60..30, lon 20..120
      const bounds = L.latLngBounds(L.latLng(-60, 20), L.latLng(30, 120));
      map.fitBounds(bounds, { padding: [20, 20] });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 7,
      }).addTo(map);

      // Ocean overlays (light borders, distinct colors)
      const oceans = [
        {
          name: "Indian Ocean",
          color: "#06B6D4",
          fill: "#06B6D4",
          polygons: [
            [
              [-60, 20],
              [-60, 120],
              [30, 120],
              [30, 20],
            ],
          ],
          label: { lat: -15, lng: 80 },
        },
        {
          name: "Pacific Ocean",
          color: "#F59E0B",
          fill: "#F59E0B",
          // Split across antimeridian as two rectangles
          polygons: [
            [
              [-60, 120],
              [-60, 180],
              [60, 180],
              [60, 120],
            ],
            [
              [-60, -180],
              [-60, -70],
              [60, -70],
              [60, -180],
            ],
          ],
          label: { lat: -5, lng: -140 },
        },
        {
          name: "Atlantic Ocean",
          color: "#8B5CF6",
          fill: "#8B5CF6",
          polygons: [
            [
              [-60, -70],
              [-60, 20],
              [70, 20],
              [70, -70],
            ],
          ],
          label: { lat: 0, lng: -20 },
        },
      ];

      oceans.forEach((o) => {
        // Draw polygons
        o.polygons.forEach((coords) => {
          L.polygon(coords, {
            color: o.color,
            weight: 1,
            opacity: 0.8,
            fillColor: o.fill,
            fillOpacity: 0.08,
            interactive: false,
            smoothFactor: 1,
            dashArray: "4 4",
          }).addTo(map);
        });
        // Add label
        const labelHtml = `<div style="font-size:12px;font-weight:600;color:#0f172a;background:rgba(255,255,255,0.85);border:1px solid rgba(6,182,212,0.25);padding:2px 6px;border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,0.06)">${o.name}</div>`;
        L.marker([o.label.lat, o.label.lng], {
          interactive: false,
          icon: L.divIcon({ className: "", html: labelHtml }),
        }).addTo(map);
      });

      map.on("click", (e) => {
        setPoints((prev) => {
          if (prev.length >= 5) return prev;
          const next = [...prev, [e.latlng.lat, e.latlng.lng]];
          return next;
        });
      });

      mapRef.current = map;
    }
  }, []);

  // draw points and shapes when points change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const { markers, line, polygon } = layerRef.current;

    // clear existing markers/line/polygon
    markers.forEach((m) => m.remove());
    layerRef.current.markers = [];

    if (line) {
      line.remove();
      layerRef.current.line = null;
    }
    if (polygon) {
      polygon.remove();
      layerRef.current.polygon = null;
    }

    // redraw markers
    points.forEach(([lat, lng], idx) => {
      const m = L.circleMarker([lat, lng], {
        radius: 6,
        color: "#0284C7",
        fillColor: "#0EA5E9",
        fillOpacity: 0.9,
        weight: 2,
      }).bindTooltip(`P${idx + 1}`, { permanent: true, direction: "top", offset: [0, -6] });
      m.addTo(map);
      layerRef.current.markers.push(m);
    });

    // draw line or polygon
    if (points.length >= 2 && points.length < 5) {
      layerRef.current.line = L.polyline(points, { color: "#06B6D4", weight: 2 }).addTo(map);
    } else if (points.length === 5) {
      layerRef.current.polygon = L.polygon(points, {
        color: "#06B6D4",
        weight: 2,
        fillOpacity: 0.15,
        fillColor: "#06B6D4",
      }).addTo(map);
    }
  }, [points]);

  const reset = () => setPoints([]);

  const handleConfirm = async () => {
    if (points.length !== 5) return;
    await onConfirm(points);
  };

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      {/* Overlay UI */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] bg-white/90 backdrop-blur-xl border border-[#06B6D4]/30 rounded-full px-4 py-2 shadow">
        <div className="text-sm text-slate-700">
          {points.length < 5 ? `Select ${5 - points.length} more point${5 - points.length === 1 ? "" : "s"} in the Indian Ocean` : "Polygon ready"}
        </div>
      </div>
      {/* Ocean legend */}
      <div className="absolute top-4 left-4 z-[9999]">
        <div className="bg-white/90 backdrop-blur-xl border border-[#06B6D4]/30 rounded-xl px-3 py-2 shadow">
          <div className="text-xs font-semibold text-slate-700 mb-1">Oceans</div>
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#06B6D4' }} />
              <span className="text-slate-700">Indian Ocean</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#F59E0B' }} />
              <span className="text-slate-700">Pacific Ocean</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#8B5CF6' }} />
              <span className="text-slate-700">Atlantic Ocean</span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2">
        <Button
          type="button"
          onClick={reset}
          variant="outline"
          className="rounded-full bg-white/90 hover:bg-white"
        >
          Reset
        </Button>
        {points.length === 5 && (
          <Button
            type="button"
            onClick={handleConfirm}
            className={cn(
              "rounded-full px-4",
              "bg-gradient-to-r from-[#06B6D4] to-[#0EA5E9] text-white"
            )}
          >
            Confirm
          </Button>
        )}
      </div>
    </div>
  );
}