import { useEffect, useRef, useState } from 'react';
import type L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import { apiFetch, ApiError } from '../lib/api';
import { Card } from '../components/ui/Card';
import { AdminShell } from './dashboard/AdminShell';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';

interface CustomerLocation {
  customerPhone: string;
  customerName: string | null;
  lat: number;
  lng: number;
  capturedAt: string;
}

const DEFAULT_CENTER: [number, number] = [19.4326, -99.1332]; // CDMX

export function AdminLocationsPage() {
  const [locations, setLocations] = useState<CustomerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    apiFetch<CustomerLocation[]>('/admin/locations')
      .then(setLocations)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el mapa'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || !mapContainerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const { default: leaflet } = await import('leaflet');
      if (cancelled || !mapContainerRef.current) return;

      leaflet.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

      const map = leaflet.map(mapContainerRef.current).setView(DEFAULT_CENTER, 12);
      mapRef.current = map;
      leaflet
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        })
        .addTo(map);

      if (locations.length > 0) {
        for (const loc of locations) {
          leaflet
            .marker([loc.lat, loc.lng])
            .addTo(map)
            .bindPopup(
              `<strong>${loc.customerName ?? loc.customerPhone}</strong><br/>${new Date(loc.capturedAt).toLocaleString('es-MX')}`,
            );
        }
        const bounds = leaflet.latLngBounds(locations.map((loc) => [loc.lat, loc.lng]));
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return (
    <AdminShell active="ubicaciones" title="Ubicación de clientes">
      <Card className="mx-auto w-full max-w-4xl">
        <h1 className="mb-1 text-center text-xl font-bold text-secondary">
          Ubicación de clientes
        </h1>
        <p className="mb-6 text-center text-sm text-secondary">
          Última ubicación conocida de cada cliente que la compartió
        </p>

        {error && <Alert variant="error">{error}</Alert>}

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : locations.length === 0 ? (
          <p className="py-8 text-center text-sm text-secondary">
            Ningún cliente compartió su ubicación todavía.
          </p>
        ) : null}

        <div
          ref={mapContainerRef}
          className={`h-[60vh] w-full rounded-xl ${loading ? 'hidden' : ''}`}
        />
      </Card>
    </AdminShell>
  );
}
