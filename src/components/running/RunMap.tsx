import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { SuggestedRoute } from '../../lib/running/routes';

interface Props {
  position: [number, number] | null;
  /** Path being run or a past run. */
  track?: [number, number][];
  /** Suggested routes: markers at their start; the selected one is drawn in full. */
  routes?: SuggestedRoute[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  follow?: boolean;
}

/** OpenStreetMap map (free, no key) showing the runner, the track and nearby routes. */
export function RunMap({ position, track, routes = [], selectedId, onSelect, follow }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{ me?: L.CircleMarker; track?: L.Polyline; sel?: L.Polyline; pins: L.LayerGroup }>({ pins: L.layerGroup() });
  const fitted = useRef(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(position ?? [41.9, 12.5], position ? 15 : 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    layers.current.pins.addTo(m);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 200);
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Runner position.
  useEffect(() => {
    const m = map.current;
    if (!m || !position) return;
    const l = layers.current;
    if (!l.me) l.me = L.circleMarker(position, { radius: 8, color: '#fff', weight: 3, fillColor: '#3b6cf6', fillOpacity: 1 }).addTo(m);
    else l.me.setLatLng(position);
    if (!fitted.current) {
      m.setView(position, 15);
      fitted.current = true;
    } else if (follow) m.panTo(position);
  }, [position, follow]);

  // Recorded track.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const l = layers.current;
    l.track?.remove();
    l.track = undefined;
    if (track && track.length > 1) {
      l.track = L.polyline(track, { color: '#e8590c', weight: 5, opacity: 0.9 }).addTo(m);
      if (!follow) m.fitBounds(l.track.getBounds(), { padding: [24, 24] });
    }
  }, [track, follow]);

  // Suggested routes: pins + selected path.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const l = layers.current;
    l.pins.clearLayers();
    l.sel?.remove();
    l.sel = undefined;
    for (const r of routes) {
      const on = r.id === selectedId;
      const pin = L.circleMarker(r.start, { radius: on ? 9 : 6, color: '#fff', weight: 2, fillColor: r.kind === 'park' ? '#2f9e44' : r.kind === 'track' ? '#f59f00' : '#7b6ae6', fillOpacity: 1 });
      pin.bindTooltip(r.name);
      pin.on('click', () => onSelect?.(r.id));
      l.pins.addLayer(pin);
      if (on && r.geometry && r.geometry.length > 1) {
        l.sel = L.polyline(r.geometry, { color: '#7b6ae6', weight: 5, opacity: 0.85, dashArray: r.kind === 'track' ? undefined : '1 9', lineCap: 'round' }).addTo(m);
        m.fitBounds(l.sel.getBounds(), { padding: [30, 30] });
      } else if (on) m.setView(r.start, 16);
    }
  }, [routes, selectedId]);

  return <div ref={el} className="run-map" role="region" aria-label="Mappa" />;
}
