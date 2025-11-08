/// <reference path="../types/react-shim.d.ts" />
import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type MapPlace = {
  title: string;
  lat: number;
  lng: number;
  vibe?: string;
  distance_km?: number | null;
  score?: number;
};

type Visit = {
  title: string;
  lat: number;
  lng: number;
};

type Props = {
  places: MapPlace[];
  onComplete: (p: MapPlace) => void;
  completed: Visit[];
};

const ATL = { lat: 33.749, lng: -84.388 };

function FitAtlanta() {
  const map = useMap();
  useEffect(() => {
    map.setView([ATL.lat, ATL.lng], 12);
  }, [map]);
  return null;
}

export default function MapUI({ places, onComplete, completed }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const normalized = useMemo<MapPlace[]>(() => {
    return places.map((p, i) => {
      if (typeof p.lat === "number" && typeof p.lng === "number") return p;
      // jitter near Atlanta if missing coordinates
      const dx = (Math.random() - 0.5) * 0.3;
      const dy = (Math.random() - 0.5) * 0.3;
      return {
        ...p,
        lat: ATL.lat + dx,
        lng: ATL.lng + dy,
      };
    });
  }, [places]);

  return (
    <div className="map-wrap">
      <MapContainer center={[ATL.lat, ATL.lng]} zoom={12} scrollWheelZoom style={{ height: 560 }}>
        <FitAtlanta />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {normalized.map((p) => {
          const active = hover === p.title;
          return (
            <Marker
              key={`${p.title}-${p.lat}-${p.lng}`}
              position={[p.lat, p.lng]}
              eventHandlers={{
                mouseover: () => setHover(p.title),
                mouseout: () => setHover((h) => (h === p.title ? null : h)),
              }}
            >
              <Popup>
                <div className="map-pop">
                  <strong>{p.title}</strong>
                  <div className="map-meta">
                    <span className="badge">{p.vibe || "activity"}</span>
                    {typeof p.distance_km === "number" && <span>{p.distance_km} km</span>}
                    {typeof p.score === "number" && <span>{Math.round((p.score || 0) * 100)}%</span>}
                  </div>
                  <button className="primary" onClick={() => onComplete(p)}>
                    Mark completed
                  </button>
                </div>
              </Popup>
              {active && (
                <Circle
                  center={[p.lat, p.lng]}
                  radius={300}
                  pathOptions={{ color: "#63b3ed", fillColor: "#63b3ed", fillOpacity: 0.15 }}
                />
              )}
            </Marker>
          );
        })}
        {completed.map((v) => (
          <Circle
            key={`done-${v.title}-${v.lat}-${v.lng}`}
            center={[v.lat, v.lng]}
            radius={500}
            pathOptions={{ color: "#9ae6b4", fillColor: "#9ae6b4", fillOpacity: 0.25 }}
          />
        ))}
      </MapContainer>
    </div>
  );
}


