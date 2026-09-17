import { db } from './db.js';
import bcrypt from 'bcryptjs';

const USUARIOS = [
  { nombre: 'Administrador', email: 'admin@one.com', password: 'admin123', rol: 'admin' },
  { nombre: 'Bryam Villalba', email: 'bryam@one.com', password: 'tecnico123', rol: 'tecnico' }
];

const TECNICOS = [
  { nombre: 'Yudy Garcia', rol: 'Administradora General / Tutor' },
  { nombre: 'Carlos Pérez', rol: 'Técnico de Campo' },
  { nombre: 'Luis Martínez', rol: 'Técnico de Campo' },
  { nombre: 'Ana Rodríguez', rol: 'Técnico de Redes' },
  { nombre: 'Jorge Gómez', rol: 'Técnico de Campo' },
  { nombre: 'Bryam Villalba', rol: 'Practicante - Soporte Técnico' }
];

const TIPOS_FALLA = [
  {
    nombre: 'Sin servicio de internet',
    descripcion: 'El usuario reporta que no tiene acceso a internet: ONT sin enlace o pérdida total del servicio.',
    icono: 'wifi-off',
    consultas: [
      {
        orden: 1, titulo: 'Estado de la ONT',
        pregunta: '¿Los LEDs de la ONT están de forma correcta?',
        instruccion: 'Verificar en la ONT: Power encendido, PON/LOS fijo (enlace) y LAN activo. Reporte el LED que no coincida.',
        tipo_respuesta: 'si_no_valor', unidad: 'LED', etiqueta_valor: 'LED en estado anormal', referencia: 'Power fijo, PON fijo, LOS apagado, LAN activo'
      },
      {
        orden: 2, titulo: 'Alimentación eléctrica',
        pregunta: '¿La ONT recibe alimentación eléctrica estable?',
        instruccion: 'Confirmar que el adaptador y el regulador están conectados y entregando voltaje. Verificar posibles fluctuaciones.',
        tipo_respuesta: 'si_no', referencia: 'Alimentación estable sin apagones'
      },
      {
        orden: 3, titulo: 'Prueba directa por cable (LAN)',
        pregunta: '¿Prueba directa por cable Ethernet elimina el problema?',
        instruccion: 'Conectar un equipo por cable al puerto LAN1 de la ONT y validar navegación. Descarta el tramo inalámbrico.',
        tipo_respuesta: 'si_no', referencia: 'Navegación OK por cable'
      },
      {
        orden: 4, titulo: 'Señal óptica hacia la ONT',
        pregunta: '¿La señal óptica está dentro del rango aceptable?',
        instruccion: 'Con medidor de potencia (o menú de diagnóstico de la ONT) medir el nivel óptico en el pigtail.', 
        tipo_respuesta: 'si_no_valor', unidad: 'dBm', etiqueta_valor: 'Nivel óptico', referencia: 'Nivel dentro de -8 a -25 dBm'
      },
      {
        orden: 5, titulo: 'Estado del NAP / Splitter',
        pregunta: '¿El NAP y el splitter están en buen estado?',
        instruccion: 'Verificar en la caja de distribución (NAP): splitters bien insertados, puertos limpios y sin humedad.',
        tipo_respuesta: 'si_no', referencia: 'Puerto y splitter en buen estado'
      },
      {
        orden: 6, titulo: 'Acometida de fibra',
        pregunta: '¿La acometida de fibra presenta daños o dobleces?',
        instruccion: 'Inspección visual del tramo de acometida: dobleces pronunciados, conectores aflojados, cortes o mordidas.',
        tipo_respuesta: 'si_no', referencia: 'Acometida íntegra y sin dobleces'
      },
      {
        orden: 7, titulo: 'Estado del servicio en plataforma',
        pregunta: '¿El puerto está provisionado y activo en la plataforma (OLT)?',
        instruccion: 'Consultar la OLT / plataforma de gestión: puerto PON activo, perfil de servicio y VLAN correctos.',
        tipo_respuesta: 'si_no', referencia: 'Puerto provisionado y activo'
      }
    ]
  },
  {
    nombre: 'Velocidad por debajo del contratado',
    descripcion: 'El servicio funciona pero el ancho de banda percibido es inferior al plan contratado.',
    icono: 'gauge',
    consultas: [
      {
        orden: 1, titulo: 'Medición por cable LAN',
        pregunta: '¿La velocidad medida por cable cumple el plan contratado?',
        instruccion: 'Medir con prueba de velocidad desde un equipo por cable LAN. Registrar Mbps obtenidos.',
        tipo_respuesta: 'si_no_valor', unidad: 'Mbps', etiqueta_valor: 'Velocidad medida', referencia: '>= 80% del plan contratado'
      },
      {
        orden: 2, titulo: 'Tráfico simultáneo',
        pregunta: '¿Hay otros dispositivos consumiendo ancho de banda en ese momento?',
        instruccion: 'Identificar descargas activas, streaming en otros equipos o dispositivos conectados en los hogares.',
        tipo_respuesta: 'si_no', referencia: 'Sin consumo simultáneo relevante'
      },
      {
        orden: 3, titulo: 'Estado de la ONT',
        pregunta: '¿La ONT muestra tráfico normal y sin errores?',
        instruccion: 'Revisar contadores de tráfico y errores (CRC) en la ONT o en la OLT para el puerto.',
        tipo_respuesta: 'si_no', referencia: 'Sin errores CRC significativos'
      },
      {
        orden: 4, titulo: 'Señal óptica',
        pregunta: '¿La señal óptica está dentro del rango aceptable?',
        instruccion: 'Medir nivel óptico. Señal muy baja degrada el tráfico.',
        tipo_respuesta: 'si_no_valor', unidad: 'dBm', etiqueta_valor: 'Nivel óptico', referencia: 'Nivel dentro de -8 a -25 dBm'
      },
      {
        orden: 5, titulo: 'Configuración del router / WiFi',
        pregunta: '¿El equipo de red está en banda y canal adecuados?',
        instruccion: 'Revisar si el diagnóstico se hace en 2.4 GHz o 5 GHz, canal saturado o configuración de banda.',
        tipo_respuesta: 'si_no', referencia: 'Canal y banda configurados correctamente'
      },
      {
        orden: 6, titulo: 'Prueba en horario de congestión',
        pregunta: '¿La velocidad es baja en horarios pico?',
        instruccion: 'Repetir la medición en franjas horarias distintas y comparar con horas de alta demanda.',
        tipo_respuesta: 'si_no', referencia: 'Comportamiento estable en horas pico'
      }
    ]
  },
  {
    nombre: 'Falla de televisión (TV)',
    descripcion: 'El usuario presenta falla o ausencia de señal de televisión sobre el servicio FTTH/GPON.',
    icono: 'tv',
    consultas: [
      {
        orden: 1, titulo: 'Estado del decodificador (STB)',
        pregunta: '¿El decodificador enciende y muestra video?',
        instruccion: 'Verificar LEDs del STB, imagen en pantalla, cables HDMI/RCA y la entrada seleccionada en el TV.',
        tipo_respuesta: 'si_no', referencia: 'STB encendido con imagen'
      },
      {
        orden: 2, titulo: 'Estado del servicio de datos',
        pregunta: '¿El servicio de internet está activo (la TV opera sobre GPON)?',
        instruccion: 'Confirmar que la ONT tiene enlace. La televisión IP requiere el circuito de datos activo.',
        tipo_respuesta: 'si_no', referencia: 'Enlace de datos activo'
      },
      {
        orden: 3, titulo: 'Señal óptica',
        pregunta: '¿La señal óptica está dentro del rango aceptable?',
        instruccion: 'Medir nivel óptico hacia la ONT; la TV IP es sensible a niveles bajos y microinterrupciones.',
        tipo_respuesta: 'si_no_valor', unidad: 'dBm', etiqueta_valor: 'Nivel óptico', referencia: 'Nivel dentro de -8 a -25 dBm'
      },
      {
        orden: 4, titulo: 'Provisión / codificación del servicio',
        pregunta: '¿El STB está asociado y el servicio activo en plataforma?',
        instruccion: 'Verificar en la plataforma de gestión el código de servicio TV, estado del STB y señales de pauta.',
        tipo_respuesta: 'si_no', referencia: 'STB asociado y servicio activo'
      },
      {
        orden: 5, titulo: 'Prueba de pauta de canales',
        pregunta: '¿Los canales fallan todos o solo algunos?',
        instruccion: 'Identificar si es falla general (zapping completo) o selectiva por canal o frecuencia.',
        tipo_respuesta: 'si_no', referencia: 'Pauta de canales completa'
      },
      {
        orden: 6, titulo: 'Condición de la acometida',
        pregunta: '¿La acometida y conexiones a la ONT están en buen estado?',
        instruccion: 'Inspección de conectores, empalmes y dobleces del tramo de fibra.',
        tipo_respuesta: 'si_no', referencia: 'Acometida en buen estado'
      }
    ]
  },
  {
    nombre: 'Internet intermitente (se cae)',
    descripcion: 'El servicio se cae y restablece con frecuencia; microcortes o reinicios de enlace.',
    icono: 'activity',
    consultas: [
      {
        orden: 1, titulo: 'Registro de cortes en la ONT',
        pregunta: '¿El contador de reinicios/cortes de la ONT presenta valores altos?',
        instruccion: 'Revisar en la ONT los contadores de enlace perdido y reinicios del equipo.',
        tipo_respuesta: 'si_no', referencia: 'Bajo número de reinicios/enlaces perdidos'
      },
      {
        orden: 2, titulo: 'Señal óptica en rango',
        pregunta: '¿La señal óptica está estable y dentro de rango?',
        instruccion: 'Medir nivel óptico y observarlo durante varios minutos para detectar fluctuaciones.',
        tipo_respuesta: 'si_no_valor', unidad: 'dBm', etiqueta_valor: 'Nivel óptico', referencia: 'Nivel estable dentro de -8 a -25 dBm'
      },
      {
        orden: 3, titulo: 'Acometida y conectores',
        pregunta: '¿Hay dobleces, conectores flojos o empalmes en la acometida?',
        instruccion: 'Inspección del tramo: los microcortes suelen deberse a conectores mal ajustados o dobleces.',
        tipo_respuesta: 'si_no', referencia: 'Conectores ajustados y sin dobleces'
      },
      {
        orden: 4, titulo: 'Estado del NAP y splitter',
        pregunta: '¿El puerto en el NAP está estable?',
        instruccion: 'Verificar inserción del conector en el NAP y condición del splitter/pigtails.',
        tipo_respuesta: 'si_no', referencia: 'Puerto NAP estable'
      },
      {
        orden: 5, titulo: 'Condiciones ambientales',
        pregunta: '¿Hay humedad o daño causado por lluvia/roedores en cajas?',
        instruccion: 'Revisar cajas de distribución y acometida por humedad, óxido o mordidas.',
        tipo_respuesta: 'si_no', referencia: 'Cajas sin humedad ni daños'
      },
      {
        orden: 6, titulo: 'Alimentación eléctrica',
        pregunta: '¿Hay fluctuaciones eléctricas en el sitio?',
        instruccion: 'Verificar regulador y voltaje; las fluctuaciones causan reinicios de la ONT.',
        tipo_respuesta: 'si_no', referencia: 'Alimentación estable'
      },
      {
        orden: 7, titulo: 'Prueba de estabilidad',
        pregunta: '¿El enlace se mantiene estable durante 15 minutos de prueba?',
        instruccion: 'Dejar ping o monitoreo continuo entre 10 y 15 minutos y anotar pérdidas de paquete.',
        tipo_respuesta: 'si_no_valor', unidad: '%', etiqueta_valor: 'Pérdida de paquetes', referencia: 'Pérdida <= 1%'
      }
    ]
  },
  {
    nombre: 'Problemas de WiFi',
    descripcion: 'Lentitud o fallas de conexión en la red inalámbrica del hogar.',
    icono: 'network',
    consultas: [
      {
        orden: 1, titulo: 'Prueba por cable vs WiFi',
        pregunta: '¿La velocidad por cable es normal y solo falla el WiFi?',
        instruccion: 'Comparar medición por cable LAN contra medición inalámbrica para aislar el problema.',
        tipo_respuesta: 'si_no', referencia: 'Cable OK / WiFi deficiente'
      },
      {
        orden: 2, titulo: 'Cobertura de la vivienda',
        pregunta: '¿Hay zonas de la vivienda sin cobertura WiFi?',
        instruccion: 'Ubicar el router y recorrer la vivienda verificando señal en los puntos de uso frecuente.',
        tipo_respuesta: 'si_no', referencia: 'Cobertura suficiente en zonas de uso'
      },
      {
        orden: 3, titulo: 'Interferencias del entorno',
        pregunta: '¿Los canales WiFi están saturados por vecinos?',
        instruccion: 'Escanear redes cercanas; en 2.4 GHz los canales 1, 6 y 11 son los recomendados.',
        tipo_respuesta: 'si_no_valor', unidad: 'canal', etiqueta_valor: 'Canales ocupados', referencia: 'Canal 2.4 GHz sin saturación'
      },
      {
        orden: 4, titulo: 'Uso de bandas',
        pregunta: '¿Los dispositivos usan banda de 5 GHz cuando es posible?',
        instruccion: 'Verificar configuración de banda doble y que los equipos compatibles usen 5 GHz.',
        tipo_respuesta: 'si_no', referencia: 'Banda 5 GHz disponible y usada'
      },
      {
        orden: 5, titulo: 'Cantidad de dispositivos',
        pregunta: '¿La cantidad de dispositivos conectados es alta?',
        instruccion: 'Contar dispositivos activos y validar saturación del equipo de red.',
        tipo_respuesta: 'si_no', referencia: 'Número de dispositivos dentro de la capacidad'
      },
      {
        orden: 6, titulo: 'Estado del equipo de red',
        pregunta: '¿El router/ONT está actualizado y sin sobrecalentamiento?',
        instruccion: 'Revisar firmware, temperatura del equipo y tiempo de encendido (uptime).',
        tipo_respuesta: 'si_no', referencia: 'Equipo actualizado y en buen estado'
      }
    ]
  }
];

const CAUSAS_RAIZ = [
  { categoria: 'Materiales / Equipos', descripcion: 'Falla de la ONT, router, decodificador o equipo de red en mal estado u obsoleto.' },
  { categoria: 'Red externa - Fibra', descripcion: 'Corte, doblez, empalme o daño en la fibra de acometida o la red de distribución.' },
  { categoria: 'Red externa - NAP/Splitter', descripcion: 'Puerto o splitter del NAP con daño, humedad o mala inserción.' },
  { categoria: 'Proveedor / Plataforma', descripcion: 'Falla aguas arriba: OLT, transporte o proveedor mayorista / fallas del core.' },
  { categoria: 'Método / Procedimiento', descripcion: 'Procedimiento de diagnóstico inadecuado o no estandarizado.' },
  { categoria: 'Instalación del cliente', descripcion: 'Instalación inicial deficiente: conectores, acometida o ubicación de equipos.' },
  { categoria: 'Entorno / Condiciones', descripcion: 'Humedad, roedores, vandalismo o condiciones eléctricas del sitio.' },
  { categoria: 'Uso del cliente', descripcion: 'Configuración o uso inadecuado de los equipos por parte del usuario final.' }
];

const NOW = Date.now();
const H = 3600000;

let tecIds = [];
let tipoRowIds = [];
let causaRowIds = [];

function empty(table) {
  return db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c === 0;
}

function reiniciarIdsReferenciales() {
  tecIds = db.prepare('SELECT id FROM tecnicos ORDER BY id').all().map((r) => r.id);
  tipoRowIds = db.prepare('SELECT id FROM tipos_falla ORDER BY id').all().map((r) => r.id);
  causaRowIds = db.prepare('SELECT id FROM causas_raiz ORDER BY id').all().map((r) => r.id);
}

function seedUsuarios() {
  const insUsu = db.prepare('INSERT INTO usuarios (nombre, email, password_hash, rol, creado_en) VALUES (?, ?, ?, ?, ?)');
  if (process.env.NODE_ENV === 'production') {
    const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      console.warn('[seed] En producción la base está vacía y no se definieron ADMIN_EMAIL/ADMIN_PASSWORD. No se crearán usuarios de demostración.');
      return;
    }
    insUsu.run('Administrador', email, bcrypt.hashSync(password, 10), 'admin', Date.now());
    console.warn('[seed] Usuario administrador creado a partir de variables de entorno.');
    return;
  }
  for (const u of USUARIOS) {
    insUsu.run(u.nombre, u.email, bcrypt.hashSync(u.password, 10), u.rol, Date.now());
  }
}

function seedTecnicos() {
  const insTec = db.prepare('INSERT INTO tecnicos (nombre, rol) VALUES (?, ?)');
  for (const t of TECNICOS) {
    insTec.run(t.nombre, t.rol);
  }
}

function seedTiposFalla() {
  const insTipo = db.prepare('INSERT INTO tipos_falla (nombre, descripcion, icono) VALUES (?, ?, ?)');
  const insConsulta = db.prepare('INSERT INTO consultas_tipo_falla (tipo_falla_id, orden, titulo, pregunta, instruccion, tipo_respuesta, unidad, etiqueta_valor, referencia) VALUES (?,?,?,?,?,?,?,?,?)');
  for (const tf of TIPOS_FALLA) {
    const id = Number(insTipo.run(tf.nombre, tf.descripcion, tf.icono).lastInsertRowid);
    for (const c of tf.consultas) {
      insConsulta.run(id, c.orden, c.titulo, c.pregunta, c.instruccion, c.tipo_respuesta, c.unidad ?? null, c.etiqueta_valor ?? null, c.referencia ?? null);
    }
  }
}

function seedCausasRaiz() {
  const insCausa = db.prepare('INSERT INTO causas_raiz (categoria, descripcion) VALUES (?, ?)');
  for (const c of CAUSAS_RAIZ) {
    insCausa.run(c.categoria, c.descripcion);
  }
}

function nextTicket() {
  const maxNum = db.prepare("SELECT COALESCE(MAX(CAST(SUBSTR(numero_ticket, 5) AS INTEGER)), 0) AS m FROM incidencias").get().m;
  return String(maxNum + 1).padStart(4, '0');
}

function seedIncidencias() {
  reiniciarIdsReferenciales();
  if (tecIds.length === 0 || tipoRowIds.length === 0 || causaRowIds.length === 0) {
    console.warn('[seed] No se pudieron crear incidencias de ejemplo: faltan referencias (técnicos, tipos de falla o causas raíz).');
    return;
  }

  const insInc = db.prepare(`INSERT INTO incidencias
    (numero_ticket, cliente, telefono, direccion, barrio, tipo_falla_id, prioridad, estado, tecnico_id, sintomas, descripcion, causa_raiz_id, solucion_aplicada, creada_en, resuelta_en)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  // [tipo, tec, prioridad, estado, causa, horasAtras, horasDuracion|null, barrio]
  const M = [
    [0,1,'alta','resuelta',4, 3, 5, 'Centro'],
    [0,2,'alta','resuelta',4, 5, 8, 'El Prado'],
    [0,3,'media','resuelta',5, 8, 6, 'Las Américas'],
    [0,1,'media','escalada',1, 11, 30, 'Malvinas'],
    [1,2,'media','resuelta',7, 15, 3, 'Centro'],
    [1,3,'baja','resuelta',7, 18, 2, 'Villa Universitaria'],
    [1,1,'media','en_diagnostico',null, 2, null, 'El Prado'],
    [2,3,'baja','resuelta',3, 22, 4, 'Las Américas'],
    [2,2,'baja','resuelta',7, 26, 3, 'Centro'],
    [2,4,'media','resuelta',0, 30, 5, 'Malvinas'],
    [3,1,'alta','resuelta',1, 35, 10, 'Villa Universitaria'],
    [3,2,'alta','escalada',2, 40, 60, 'El Prado'],
    [3,3,'media','resuelta',5, 6, 4, 'Centro'],
    [3,1,'media','en_diagnostico',null, 4, null, 'Las Américas'],
    [4,2,'baja','resuelta',7, 48, 2, 'Malvinas'],
    [4,1,'baja','resuelta',7, 52, 3, 'El Prado'],
    [4,3,'media','resuelta',0, 60, 5, 'Villa Universitaria'],
    [0,5,'alta','resuelta',4, 70, 12, 'Centro'],
    [1,5,'media','resuelta',7, 80, 4, 'Las Américas'],
    [2,5,'baja','nueva',null, 1, null, 'Malvinas'],
    [3,5,'alta','nueva',null, 0.5, null, 'Villa Universitaria'],
    [4,5,'media','nueva',null, 3, null, 'El Prado'],
    [0,5,'media','en_diagnostico',null, 20, null, 'Las Américas'],
    [1,4,'alta','resuelta',4, 90, 9, 'Centro']
  ];

  const clientes = ['Alba Sánchez','Pedro Ramírez','María Torres','Jhon Cárdenas','Luz Dary Gómez','Óscar Rojas','Paula Martínez','Diego Mora','Nora Prieto','Henry Camargo','Lucía Franco','Ernesto Peña'];
  let seq = 1100;
  for (const [tipo, tec, pri, est, causa, hrsAtras, dur, barrio] of M) {
    const creada = NOW - hrsAtras * H;
    const resuelta = dur == null ? null : creada + dur * H;
    const idx = seq % clientes.length;
    const cliente = clientes[idx];
    seq++;
    insInc.run(
      `ONE-${nextTicket()}`,
      cliente,
      `3${(300000000 + Math.floor(Math.random() * 899999999))}`,
      `Cra ${10 + (seq % 18)} # ${20 + (seq % 40)}-${10 + (seq % 9)}`,
      barrio,
      tipoRowIds[tipo],
      pri,
      est,
      tecIds[tec],
      `Cliente reporta: ${TIPOS_FALLA[tipo].nombre.toLowerCase()}.`,
      `Reporte registrado en PQR. Sintomas declarados por el usuario durante la solicitud de servicio.`,
      causa == null ? null : causaRowIds[causa],
      dur == null ? '' : 'Se aplicó protocolo estandarizado; ver respuestas del diagnóstico guiado.',
      creada,
      resuelta
    );
  }
}

export function seedIfEmpty() {
  if (empty('usuarios')) seedUsuarios();
  if (empty('tecnicos')) seedTecnicos();
  if (empty('tipos_falla')) seedTiposFalla();
  if (empty('causas_raiz')) seedCausasRaiz();
  if (empty('incidencias')) seedIncidencias();
}