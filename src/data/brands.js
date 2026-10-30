// DATOS DE LA MARCA — Elian López Photo (bodas).
// Textos, contacto y colores son de partida: se editan desde el panel (Marcas y Personalización).

export const brands = [
  {
    id: 'elian-lopez-photo',
    name: 'Elian López Photo',
    shortName: 'Elian López',
    tagline: 'Bodas contadas como una obra.',
    description: 'Fotografía de bodas con mirada editorial y artística. Cobertura a medida para celebraciones con intención.',
    currency: 'USD',
    locale: 'es-DO',
    depositPercent: 30,
    bookingType: 'event', // una boda por día; se reserva el día completo
    deliveryDays: 30, // días hábiles desde la boda hasta la entrega (se cambia en Marcas)
    published: true,
    whatsappDisplay: '',
    email: '',
    theme: {
      bg: '#FAF8F4',
      surface: '#FFFFFF',
      ink: '#0F0F0E',
      muted: '#5A5650',
      accent: '#A88A5C',
      accentInk: '#0F0F0E',
      line: '#D8D2C6',
      hero: '#111110',
      heroInk: '#F3EFE7',
      fontDisplay: "'Cormorant Garamond', 'Times New Roman', serif",
      displayStyle: 'italic',
    },
    heroTone: 'noir',
    studio: {
      headline: 'Reserva tu fecha',
      intro: 'Elian López Photo documenta bodas con una mirada editorial: preparativos, ceremonia y celebración contados como una sola historia, con pocas fechas por temporada.',
      cta: 'Consulta tu fecha',
      gallery: ['Ceremonia', 'Pareja', 'Detalles', 'Celebración', 'Retrato'],
      instagram: '',
    },
  },
];

export const getBrandById = (list, id) => list.find((b) => b.id === id);

/** ¿La marca trabaja por eventos de día completo (bodas) en vez de sesiones con horario? */
export const isEventBrand = (brand) => brand?.bookingType === 'event';
