const DESTINO = 'bairesmedicalbroker@gmail.com';
const COBERTURAS = new Set(['Para mí', 'Para mí y mi pareja', 'Para mí, mi pareja y mis hijos']);
const SITUACIONES = new Set(['Monotributista', 'Relación de dependencia', 'Particular']);

function json(status, body) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function limpiar(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function escapar(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function remitenteConfigurado() {
  const personalizado = limpiar(process.env.RESEND_FROM, 240);
  if (personalizado) return personalizado;

  const dominio = limpiar(process.env.RESEND_EMAIL_DOMAIN, 180)
    .replace(/^https?:\/\//i, '')
    .replace(/^@/, '')
    .replace(/\/$/, '');
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(dominio)) return '';
  return `Baires Medical Brokers <formularios@${dominio}>`;
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return json(405, { ok: false, message: 'Método no permitido.' });

    let datos;
    try {
      datos = await request.formData();
    } catch {
      return json(400, { ok: false, message: 'No pudimos leer el formulario.' });
    }

    // Campo señuelo: los bots suelen completarlo, las personas no lo ven.
    if (limpiar(datos.get('contacto_secundario_9f2'), 120)) {
      return json(200, { ok: true, message: '¡Listo! Recibimos tus datos y te vamos a contactar.' });
    }

    const nombre = limpiar(datos.get('nombre'), 80);
    const telefono = limpiar(datos.get('telefono'), 30);
    const email = limpiar(datos.get('email'), 160).toLowerCase();
    const cobertura = limpiar(datos.get('cobertura'), 80);
    const situacion = limpiar(datos.get('situacion'), 80);
    const consentimiento = limpiar(datos.get('consentimiento'), 10);
    const digitos = telefono.replace(/\D+/g, '');

    if (!nombre || !/^[\p{L}\p{M}\s'\-.]+$/u.test(nombre)) {
      return json(422, { ok: false, message: 'Revisá el nombre y apellido ingresados.' });
    }
    if (!COBERTURAS.has(cobertura)) {
      return json(422, { ok: false, message: 'Elegí para quién sería la cobertura.' });
    }
    if (!SITUACIONES.has(situacion)) {
      return json(422, { ok: false, message: 'Elegí tu situación laboral.' });
    }
    if (digitos.length < 8 || digitos.length > 15 || !/^[+\d\s()\-.]+$/.test(telefono)) {
      return json(422, { ok: false, message: 'Revisá el teléfono ingresado.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return json(422, { ok: false, message: 'Revisá el email ingresado.' });
    }
    if (consentimiento !== 'si') {
      return json(422, { ok: false, message: 'Necesitamos tu autorización para poder contactarte.' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const remitente = remitenteConfigurado();
    if (!apiKey || !remitente) {
      console.error('Falta RESEND_API_KEY o un dominio de envío válido en Vercel.');
      return json(503, { ok: false, message: 'El envío por email todavía no está configurado.' });
    }

    const texto = [
      'Nueva consulta recibida desde el formulario del inicio.',
      '',
      `Nombre y apellido: ${nombre}`,
      `Teléfono: ${telefono}`,
      `Email: ${email}`,
      `Cobertura para: ${cobertura}`,
      `Situación laboral: ${situacion}`,
      '',
      `Fecha: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`
    ].join('\n');

    const html = `<h2>Nueva consulta desde la web</h2>
      <p><strong>Nombre y apellido:</strong> ${escapar(nombre)}</p>
      <p><strong>Teléfono:</strong> ${escapar(telefono)}</p>
      <p><strong>Email:</strong> ${escapar(email)}</p>
      <p><strong>Cobertura para:</strong> ${escapar(cobertura)}</p>
      <p><strong>Situación laboral:</strong> ${escapar(situacion)}</p>`;

    try {
      const respuesta = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          from: remitente,
          to: [DESTINO],
          reply_to: email,
          subject: 'Nueva consulta web - Baires Medical Brokers',
          text: texto,
          html
        })
      });

      if (!respuesta.ok) {
        console.error('Resend rechazó el envío:', respuesta.status, await respuesta.text());
        return json(502, { ok: false, message: 'No pudimos enviar el formulario en este momento.' });
      }
    } catch (error) {
      console.error('Error enviando la consulta:', error);
      return json(502, { ok: false, message: 'No pudimos enviar el formulario en este momento.' });
    }

    return json(200, { ok: true, message: '¡Listo! Recibimos tus datos y te vamos a contactar.' });
  }
};
