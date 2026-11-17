// Coordenadas precisas da Sede IPCF (Estrada do Encanamento, 1210) e bairros do Recife
export const IPCF_SEDE_COORDS: [number, number] = [-8.029622, -34.920729];
export const IPCF_SEDE_ADDRESS =
  "Estrada do Encanamento, 1210 · Casa Forte · Recife - PE · CEP 52070-000";

export const NEIGHBORHOOD_COORDS: Record<string, [number, number]> = {
  "Alto José do Pinho": [-8.0222, -34.9104],
  "Casa Forte": [-8.0368, -34.9194],
  "Parnamirim": [-8.0375, -34.909],
  "Jaqueira": [-8.035, -34.904],
  "Casa Amarela": [-8.0267, -34.915],
  "Poço da Panela": [-8.0328, -34.922],
  "Santana": [-8.0398, -34.9145],
  "Monteiro": [-8.031, -34.928],
  "Apipucos": [-8.024, -34.938],
  "Tamarineira": [-8.032, -34.908],
  "Rosarinho": [-8.0335, -34.8995],
  "Espinheiro": [-8.043, -34.896],
  "Graças": [-8.045, -34.903],
  "Aflitos": [-8.0405, -34.8992],
  "Derby": [-8.053, -34.898],
  "Madalena": [-8.056, -34.909],
  "Torre": [-8.049, -34.913],
  "Cordeiro": [-8.0535, -34.927],
  "Iputinga": [-8.0395, -34.9405],
  "Várzea": [-8.048, -34.965],
  "Caxangá": [-8.038, -34.96],
  "Boa Viagem": [-8.125, -34.902],
  "Setúbal": [-8.14, -34.904],
  "Pina": [-8.089, -34.885],
  "Santo Amaro": [-8.048, -34.882],
  "Encruzilhada": [-8.035, -34.892],
  "Campo Grande": [-8.032, -34.885],
  "Arruda": [-8.024, -34.887],
  "Água Fria": [-8.018, -34.895],
  "Bomba do Hemetério": [-8.016, -34.903],
  "Vasco da Gama": [-8.018, -34.918],
  "Macaxeira": [-8.012, -34.925],
  "Dois Irmãos": [-8.0155, -34.947],
  "Recife": [-8.0476, -34.877],
};

function normalizeNeighborhood(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function getCoordsForNeighborhood(bairro: string | null | undefined): [number, number] {
  if (!bairro) return IPCF_SEDE_COORDS;
  const target = normalizeNeighborhood(bairro);

  const match = Object.keys(NEIGHBORHOOD_COORDS).find(
    (k) => normalizeNeighborhood(k) === target
  );
  if (match) return NEIGHBORHOOD_COORDS[match];

  const partial = Object.keys(NEIGHBORHOOD_COORDS).find(
    (k) =>
      target.includes(normalizeNeighborhood(k)) ||
      normalizeNeighborhood(k).includes(target)
  );
  return partial ? NEIGHBORHOOD_COORDS[partial] : IPCF_SEDE_COORDS;
}

/**
 * Tenta geocodificar endereço exato via Nominatim (OpenStreetMap gratuito) com fallback seguro por bairro.
 */
export async function geocodeAddress(
  logradouro: string,
  numero: string,
  bairro: string,
  cidade: string = "Recife"
): Promise<{ latitude: number; longitude: number }> {
  try {
    const query = `${logradouro}, ${numero}, ${bairro}, ${cidade}, Pernambuco, Brasil`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&limit=1`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      headers: { "User-Agent": "DadosIPCF/1.0 (contato@ipcf.local)" },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (json?.[0]?.lat && json?.[0]?.lon) {
        return {
          latitude: Number(parseFloat(json[0].lat).toFixed(7)),
          longitude: Number(parseFloat(json[0].lon).toFixed(7)),
        };
      }
    }
  } catch {
    // Fallback silencioso para coordenadas precisas do bairro
  }

  const [lat, lng] = getCoordsForNeighborhood(bairro);
  return { latitude: lat, longitude: lng };
}

export function buildGpsUrl(
  logradouro?: string | null,
  numero?: string | null,
  bairro?: string | null,
  cidade?: string | null
): string {
  const addr = [logradouro, numero, bairro, cidade || "Recife", "Brasil"]
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
}
