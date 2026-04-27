import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useScooters } from '../hooks/useScooters';
import { formatCurrency } from '../utils/currency';

const LEEDS_CENTER = [53.8008, -1.5491];
const DEFAULT_ZOOM = 14;

const STATUS_COLOURS = {
  available: '#22c55e',
  in_use: '#3b82f6',
  reserved: '#f59e0b',
  maintenance: '#ef4444',
  offline: '#6b7280',
};

function toStatusLabel(status) {
  return String(status || '')
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function createCircleIcon(colour) {
  return L.divIcon({
    className: 'scooter-map-marker',
    html: `<div style="
      width: 22px; height: 22px; border-radius: 50%;
      background: ${colour}; border: 3px solid #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,.35);
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
}

export default function ScooterMap() {
  const { scooters, isLoading, error } = useScooters();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const markerDataSignatureRef = useRef('');

  function buildMarkerDataSignature(scooterList) {
    if (!Array.isArray(scooterList) || scooterList.length === 0) {
      return '';
    }

    // Keep the signature stable even if item order changes.
    return scooterList
      .map((scooter) => ({
        scooterId: scooter?.scooterId ?? '',
        status: scooter?.status ?? '',
        latitude: scooter?.location?.latitude ?? null,
        longitude: scooter?.location?.longitude ?? null,
        locationDescription: scooter?.location?.description ?? '',
        oneHourPrice: scooter?.pricing?.oneHour ?? null,
      }))
      .sort((a, b) => String(a.scooterId).localeCompare(String(b.scooterId)))
      .map((entry) =>
        [
          entry.scooterId,
          entry.status,
          entry.latitude,
          entry.longitude,
          entry.locationDescription,
          entry.oneHourPrice,
        ].join('|')
      )
      .join('||');
  }

  // Initialise map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) {
      return;
    }

    const map = L.map(mapContainerRef.current, {
      center: LEEDS_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers whenever scooters change
  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    const nextSignature = buildMarkerDataSignature(scooters);

    if (markerDataSignatureRef.current === nextSignature) {
      return;
    }

    // Remove old markers
    for (const marker of markersRef.current) {
      map.removeLayer(marker);
    }

    markersRef.current = [];

    if (!Array.isArray(scooters) || scooters.length === 0) {
      return;
    }

    for (const scooter of scooters) {
      const lat = scooter.location?.latitude;
      const lng = scooter.location?.longitude;

      if (lat == null || lng == null) {
        continue;
      }

      const colour = STATUS_COLOURS[scooter.status] || STATUS_COLOURS.offline;
      const icon = createCircleIcon(colour);

      const marker = L.marker([lat, lng], { icon }).addTo(map);

      marker.bindPopup(
        `<div style="font-family:inherit; line-height:1.5;">
          <strong>${scooter.scooterId}</strong><br/>
          <span style="color:${colour}; font-weight:600;">● ${toStatusLabel(scooter.status)}</span><br/>
          ${scooter.location?.description || 'Unknown location'}<br/>
          From ${formatCurrency(scooter.pricing?.oneHour ?? 0)}/hr
        </div>`
      );

      markersRef.current.push(marker);
    }

    markerDataSignatureRef.current = nextSignature;
  }, [scooters]);

  return (
    <section className="map-view">
      <article className="panel panel-accent panel-wide">
        <div className="panel-header">
          <p className="panel-kicker">ID18</p>
          <h2>Scooter locations</h2>
        </div>

        {isLoading ? (
          <p className="empty-state">Loading map data...</p>
        ) : error ? (
          <p className="message" data-state="error" role="alert">
            Could not load scooter data: {error}
          </p>
        ) : null}

        <div className="map-legend">
          {Object.entries(STATUS_COLOURS).map(([status, colour]) => (
            <span key={status} className="map-legend__item">
              <span
                className="map-legend__dot"
                style={{ background: colour }}
              />
              {toStatusLabel(status)}
            </span>
          ))}
        </div>

        <div
          ref={mapContainerRef}
          className="leaflet-map-container"
          style={{ height: '480px', width: '100%', borderRadius: '8px' }}
        />
      </article>
    </section>
  );
}
