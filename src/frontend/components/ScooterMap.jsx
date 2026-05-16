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

const LEGEND_STATUSES = Object.keys(STATUS_COLOURS);

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

function buildPopupHtml(scooter) {
  const status = scooter?.status || 'offline';
  const safeStatus = LEGEND_STATUSES.includes(status) ? status : 'offline';
  const location = scooter?.location?.description || 'Unknown location';
  const price = formatCurrency(scooter?.pricing?.oneHour ?? 0);

  return `<div class="map-popup">
    <p class="map-popup__title">${scooter?.scooterId ?? 'Unknown'}</p>
    <span class="map-popup__status map-popup__status--${safeStatus}">${toStatusLabel(safeStatus)}</span>
    <div class="map-popup__row">
      <span class="map-popup__row-label">Location</span>
      <span class="map-popup__row-value">${location}</span>
    </div>
    <div class="map-popup__row">
      <span class="map-popup__row-label">From</span>
      <span class="map-popup__row-value">${price}/hr</span>
    </div>
  </div>`;
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

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    const nextSignature = buildMarkerDataSignature(scooters);

    if (markerDataSignatureRef.current === nextSignature) {
      return;
    }

    for (const marker of markersRef.current) {
      map.removeLayer(marker);
    }

    markersRef.current = [];

    if (!Array.isArray(scooters) || scooters.length === 0) {
      markerDataSignatureRef.current = nextSignature;
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

      marker.bindPopup(buildPopupHtml(scooter));

      markersRef.current.push(marker);
    }

    markerDataSignatureRef.current = nextSignature;
  }, [scooters]);

  return (
    <section className="map-shell" data-id="ID18">
      <header className="map-header">
        <h2 className="map-title">Scooter locations</h2>
      </header>

      {isLoading ? (
        <p className="map-loading">Loading map data...</p>
      ) : null}

      {!isLoading && error ? (
        <div className="alert alert--error" role="alert">
          Could not load scooter data: {error}
        </div>
      ) : null}

      <div className="map-legend" aria-label="Scooter status legend">
        {LEGEND_STATUSES.map((status) => (
          <span key={status} className="map-legend__item">
            <span className={`map-legend__dot map-legend__dot--${status}`} />
            {toStatusLabel(status)}
          </span>
        ))}
      </div>

      <div ref={mapContainerRef} className="map-container" />
    </section>
  );
}
