import farmaciaFuturistaImg from '../assets/images/farmacia_futurista_1792535049245.jpg';
import remisMapsImg from '../assets/images/remis_maps_1792536166967.jpg';
import remisFuturistaImg from '../assets/images/remis_futurista_1792535049306.jpg';

export interface FeaturedBusiness {
  id: string;
  type: 'pharmacy' | 'remis';
  name: string;
  badge: string;
  tagline: string;
  description: string;
  address: string;
  crossStreets: string;
  phone: string;
  directDial: string;
  whatsapp?: string;
  socialUrl?: string;
  socialLabel?: string;
  image: string; // Real Google Maps Street View photo
  futuristicImage: string; // Cyber futuristic HD version
  streetViewUrl: string;
  hours: string;
  highlights: string[];
  lat: number;
  lng: number;
  telemetry: {
    status: string;
    responseTime: string;
    coverage: string;
  };
}

// Exactly verified addresses in Punta Alta
// Farmacia Verón: Brown esquina Rivadavia
// Remis Centro: Espora entre Rivadavia y Murature
export const FEATURED_PHARMACIES: FeaturedBusiness[] = [
  {
    id: 'farmacia_veron',
    type: 'pharmacy',
    name: 'Farmacia Verón',
    badge: 'FARMACIA DESTACADA · BROWN ESQ. RIVADAVIA',
    tagline: 'Tu salud, nuestra prioridad · En pleno centro de Punta Alta',
    description: 'Atención farmacéutica profesional en la histórica esquina de Brown y Rivadavia. Amplio stock de medicamentos recetados, cobertura con Obras Sociales (IOMA, PAMI, DIBA, OSDE, Swiss Medical), perfumería, regalería y atención personalizada.',
    address: 'Brown esquina Rivadavia, Punta Alta',
    crossStreets: 'Esquina emblemática céntrica (Brown y Rivadavia)',
    phone: '(02932) 42-7979',
    directDial: '02932427979',
    whatsapp: '5492932427979',
    image: '/assets/aistudio/image_3bb9a38e.png',
    futuristicImage: farmaciaFuturistaImg,
    streetViewUrl: 'https://www.google.com/maps/search/?api=1&query=Brown+y+Rivadavia+Punta+Alta+Buenos+Aires',
    hours: 'Lunes a Sábado: 8:30 a 12:30 y 16:30 a 20:30 hs (y guardias de turno oficial)',
    highlights: [
      'Ubicación central: Brown esquina Rivadavia',
      'Obras Sociales (IOMA, PAMI, DIBA, OSDE)',
      'Medicamentos especiales y recetas médicas',
      'Perfumería, regalería y dermocosmética'
    ],
    lat: -38.879916,
    lng: -62.076030,
    telemetry: {
      status: 'OPERATIVO · GUARDIA ACTIVA',
      responseTime: 'Respuesta WhatsApp < 5 min',
      coverage: 'Punta Alta y Puerto Belgrano'
    }
  }
];

export const FEATURED_REMISES: FeaturedBusiness[] = [
  {
    id: 'remis_centro',
    type: 'remis',
    name: 'Remis Centro 24 Hs',
    badge: 'REMISERÍA 24 HORAS · ESPORA E/ RIVADAVIA Y MURATURE',
    tagline: 'Seguro · Rápido · Confiable · Flota permanente las 24hs',
    description: 'Central de remises y traslados privados ubicada sobre calle Espora, entre Rivadavia y Murature. Flota moderna con choferes profesionales para viajes dentro de Punta Alta, ingreso a Base Naval Puerto Belgrano (HNPB), Pehuen Co y traslados a Bahía Blanca.',
    address: 'Espora entre Rivadavia y Murature, Punta Alta',
    crossStreets: 'Calle Espora (entre Rivadavia y Murature)',
    phone: '(02932) 43-9000',
    directDial: '02932439000',
    whatsapp: '5492932439000',
    image: remisMapsImg,
    futuristicImage: remisFuturistaImg,
    streetViewUrl: 'https://www.google.com/maps/search/?api=1&query=Espora+entre+Rivadavia+y+Murature+Punta+Alta+Buenos+Aires',
    hours: 'Servicio continuo las 24 horas del día · 365 días del año',
    highlights: [
      'Base en Espora e/ Rivadavia y Murature',
      'Móviles permanentes día y noche',
      'Viajes a Bahía Blanca (Hospitales y Aeropuerto)',
      'Habilitación e ingreso a Base Naval Puerto Belgrano'
    ],
    lat: -38.880344,
    lng: -62.077800,
    telemetry: {
      status: 'FLOTA EN SERVICIO ACTIVO 24/7',
      responseTime: 'Demora estimada: 3 a 6 minutos',
      coverage: 'Punta Alta, Puerto Belgrano, Pehuen Co, Bahía Blanca'
    }
  }
];

export const SPONSOR_CONTACT = {
  title: '¿Querés publicitar tu negocio en Vortex ID?',
  description: 'Sumá tu farmacia, remisería, clínica o comercio al asistente de emergencias y servicios esenciales de Punta Alta.',
  whatsapp: '5492932427979',
  email: 'contacto@vortexid.com.ar'
};
