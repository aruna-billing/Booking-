// DATOS DE LA MARCA — Morel Estudio (Morel Media Group).
// Planes tomados de la página pública de Morel Estudio. Contacto y textos de apoyo
// son de ejemplo y se editan desde el panel (Marcas y Personalización).

export const brands = [
  {
    id: 'morel-estudio',
    name: 'Morel Estudio',
    shortName: 'Morel Estudio',
    tagline: 'Retrato de estudio, fresco y delicado.',
    description: 'Fotografía de estudio, de imagen personal y corporativa.',
    currency: 'DOP',
    locale: 'es-DO',
    depositPercent: 50, // ejemplo: ajustar en Marcas
    bookingType: 'session',
    deliveryDays: 10, // días hábiles desde la sesión hasta la entrega (ejemplo)
    published: true,
    whatsappDisplay: '+1 (809) 555-0123 · número ficticio',
    email: 'reservas@morelestudio.example',
    theme: {
      bg: '#FFFFFF',
      surface: '#FFFFFF',
      ink: '#111111',
      muted: '#5C5852',
      accent: '#D7262E',
      accentInk: '#FFFFFF',
      line: '#DAD7D2',
      hero: '#1C1C1C',
      heroInk: '#FFFFFF',
      fontDisplay: "'Libre Baskerville', Georgia, serif",
      displayStyle: 'normal',
    },
    heroTone: 'ink',
    studio: {
      headline: 'Reserva tu cita',
      intro: 'Fotografía de estudio, de imagen personal y corporativa, con un estilo de retrato fresco y delicado.',
      cta: 'Reserva una cita',
      gallery: ['Retrato', 'Corporativo', 'Imagen personal', 'Retrato', 'Estudio'],
      instagram: '@morel.estudio',
    },
  },
];

export const getBrandById = (list, id) => list.find((b) => b.id === id);

/** ¿La marca trabaja por eventos de día completo (bodas) en vez de sesiones con horario? */
export const isEventBrand = (brand) => brand?.bookingType === 'event';
