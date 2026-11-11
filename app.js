/**
 * ASISTENTE ACADEMICO - Interfaz web
 * Consultas por voz y gestion por formularios.
 *
 * La URL de la API y el token se guardan solo en este navegador (localStorage).
 * La voz nunca escribe en la base: solo consulta.
 */

(function () {
  'use strict';

  const CLAVE_API = 'aca_api';
  const CLAVE_TOKEN = 'aca_token';
  const CLAVE_USUARIO = 'aca_usuario';
  const CLAVE_EMAIL = 'aca_email';
  const CLAVE_TOKEN_EXP = 'aca_token_exp';

  const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
  const DIAS_BONITOS = {
    LUNES: 'Lunes',
    MARTES: 'Martes',
    MIERCOLES: 'Miércoles',
    JUEVES: 'Jueves',
    VIERNES: 'Viernes',
    SABADO: 'Sábado',
    DOMINGO: 'Domingo'
  };
  const TIPOS_HORARIO = ['TEORIA', 'PRACTICA', 'LABORATORIO', 'OTRO'];
  const TIPOS_EXAMEN = ['PARCIAL', 'FINAL', 'TP', 'RECUPERATORIO', 'OTRO'];
  const PRIORIDADES = ['ALTA', 'MEDIA', 'BAJA'];
  const ESTADOS_EXAMEN = ['PROGRAMADO', 'RENDIDO'];
  const COLORES = [
    { valor: '#4cc3ff', nombre: 'Celeste' },
    { valor: '#45d483', nombre: 'Verde' },
    { valor: '#ffc857', nombre: 'Amarillo' },
    { valor: '#ff8a65', nombre: 'Naranja' },
    { valor: '#b388ff', nombre: 'Violeta' },
    { valor: '#4db6ac', nombre: 'Turquesa' },
    { valor: '#f06292', nombre: 'Rosa' }
  ];
  const CODIGOS_SESION = ['SESION_REQUERIDA', 'SESION_INVALIDA', 'SESION_VENCIDA', 'USUARIO_INACTIVO'];
  const NAV = ['principal', 'agenda', 'datos', 'ajustes'];
  const PLURAL = { materia: 'materias', horario: 'horarios', examen: 'examenes', tarea: 'tareas' };

  const estado = {
    api: '',
    token: '',
    usuario: null,
    email: '',
    sesionExp: 0,
    pantalla: 'inicio',
    configVolverA: 'login',
    agendaTab: 'hoy',
    datosTab: 'materias',
    datos: { materias: [], horarios: [], examenes: [], tareas: [] },
    agenda: {},
    reconocimiento: null,
    escuchando: false,
    transcripcionFinal: '',
    ultimaRespuesta: '',
    dialogoGuardar: null,
    timerToast: null
  };

  const $ = function (id) { return document.getElementById(id); };
  const pantallas = {
    inicio: $('pantalla-inicio'),
    config: $('pantalla-config'),
    login: $('pantalla-login'),
    principal: $('pantalla-principal'),
    agenda: $('pantalla-agenda'),
    datos: $('pantalla-datos'),
    ajustes: $('pantalla-ajustes')
  };

  // ------------------------------------------------------------ utilidades

  function escapar_(valor) {
    return String(valor === undefined || valor === null ? '' : valor).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function attr(valor) {
    return escapar_(valor).replace(/"/g, '&quot;');
  }

  function leerJson(texto) {
    try { return JSON.parse(texto); } catch (error) { return null; }
  }

  function capitalizar(texto) {
    const valor = String(texto || '');
    return valor ? valor.charAt(0).toUpperCase() + valor.slice(1) : '';
  }

  function hoyISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function fmtFecha(fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ''))) return String(fecha || '');
    const d = new Date(fecha + 'T12:00:00');
    return capitalizar(d.toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long'
    }).replace(',', ''));
  }

  function fmtFechaCorta(fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ''))) return String(fecha || '');
    const d = new Date(fecha + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function fmtHora(hora) {
    return /^\d{2}:\d{2}$/.test(String(hora || '')) ? hora : '';
  }

  function tipoHorario(tipo) {
    return { TEORIA: 'Teoría', PRACTICA: 'Práctica', LABORATORIO: 'Laboratorio', OTRO: 'Otro' }[String(tipo || '').toUpperCase()] || 'Clase';
  }

  function tipoExamen(tipo) {
    return {
      PARCIAL: 'Parcial',
      FINAL: 'Final',
      TP: 'Trabajo práctico',
      RECUPERATORIO: 'Recuperatorio',
      OTRO: 'Examen'
    }[String(tipo || '').toUpperCase()] || 'Examen';
  }

  function estadoTarea(estadoT) {
    return {
      PENDIENTE: 'Pendiente',
      EN_CURSO: 'En curso',
      ENTREGADA: 'Entregada',
      ANULADA: 'Anulada'
    }[String(estadoT || '').toUpperCase()] || 'Pendiente';
  }

  function prioridadTexto(valor) {
    return { ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' }[String(valor || '').toUpperCase()] || 'Media';
  }

  function recordarTexto(minutos) {
    const numero = Number(minutos);
    return {
      60: '1 hora antes',
      120: '2 horas antes',
      1440: '1 día antes',
      2880: '2 días antes',
      10080: '1 semana antes'
    }[numero] || (numero > 0 ? numero + ' minutos antes' : '1 día antes');
  }

  function etiquetaDias(dias, fecha) {
    if (fecha === hoyISO()) return 'Hoy';
    const n = Number(dias);
    if (!isFinite(n)) return fmtFechaCorta(fecha);
    if (n === 0) return 'Hoy';
    if (n === 1) return 'Mañana';
    if (n > 1) return 'En ' + n + ' días';
    if (n === -1) return 'Ayer';
    return 'Hace ' + Math.abs(n) + ' días';
  }

  function colorSeguro(color) {
    return /^#[0-9a-fA-F]{6}$/.test(String(color || '')) ? color : '#4cc3ff';
  }

  function materiaPorId(id) {
    return estado.datos.materias.filter(function (m) {
      return String(m.materia_id) === String(id);
    })[0] || null;
  }

  function colorDeMateria(id) {
    const materia = materiaPorId(id);
    return colorSeguro(materia && materia.color);
  }

  function vacio(texto) {
    return '<p class="vacio">' + escapar_(texto) + '</p>';
  }

  function toast(texto) {
    const el = $('toast');
    el.textContent = texto;
    el.className = 'toast visible';
    clearTimeout(estado.timerToast);
    estado.timerToast = setTimeout(function () { el.className = 'toast'; }, 4500);
  }

  function actualizarConexion() {
    const enLinea = navigator.onLine;
    $('aviso-conexion').hidden = enLinea;
    $('estado-api').textContent = enLinea ? 'Conectado' : 'Sin conexión';
    $('estado-api').classList.toggle('sin-conexion', !enLinea);
  }

  function esErrorSesion(error) {
    return !!(error && CODIGOS_SESION.indexOf(error.codigo) !== -1);
  }

  function manejarError(error) {
    if (!error) return;
    if (esErrorSesion(error)) {
      limpiarSesion();
      irA('login');
      toast('Tu sesión venció. Ingresá de nuevo.');
      return;
    }
    toast(error.message || 'Ocurrió un error inesperado.');
  }

  // ------------------------------------------------------------ API

  async function apiEn(url, accion, datos) {
    if (!url) throw new Error('Falta configurar la URL de la API.');

    const cuerpo = Object.assign({ accion: accion, token: estado.token }, datos || {});
    const controlador = new AbortController();
    const temporizador = setTimeout(function () { controlador.abort(); }, 25000);
    let respuesta;

    try {
      respuesta = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(cuerpo),
        redirect: 'follow',
        cache: 'no-store',
        signal: controlador.signal
      });
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('La conexión tardó demasiado. Revisá Internet e intentá de nuevo.');
      throw new Error('No se pudo conectar con la API. Revisá la URL y la conexión.');
    } finally {
      clearTimeout(temporizador);
    }

    const texto = await respuesta.text();
    const json = leerJson(texto);

    if (!json) throw new Error('La API no devolvió una respuesta válida. Revisá la URL publicada.');
    if (!respuesta.ok) throw new Error('Error HTTP ' + respuesta.status + '.');
    if (!json.ok) {
      const error = new Error(json.mensaje || 'Error de la API.');
      error.codigo = json.codigo;
      throw error;
    }
    return json.datos;
  }

  function api(accion, datos) {
    return apiEn(estado.api, accion, datos);
  }

  // ------------------------------------------------------------ navegacion

  function irA(nombre) {
    Object.keys(pantallas).forEach(function (clave) {
      pantallas[clave].classList.toggle('oculto', clave !== nombre);
    });
    estado.pantalla = nombre;

    const logueado = !!estado.token;
    const esNav = NAV.indexOf(nombre) !== -1;
    $('nav-inferior').classList.toggle('oculto', !(logueado && esNav));
    $('btn-salir').classList.toggle('oculto', !logueado);

    document.querySelectorAll('[data-nav]').forEach(function (boton) {
      boton.classList.toggle('activo', boton.dataset.nav === nombre);
    });

    if (nombre === 'login') $('login-email').value = estado.email || '';
    if (nombre === 'config') {
      $('api-url').value = estado.api || '';
      $('config-mensaje').textContent = '';
    }
    if (nombre === 'agenda' && logueado) cargarAgenda();
    if (nombre === 'datos' && logueado) {
      renderDatos();
      if (!estado.datos.materias.length) cargarTodo();
    }
    if (nombre === 'ajustes') actualizarAjustes();
    if (nombre === 'principal') cargarResumen();

    window.scrollTo(0, 0);
  }

  function abrirAgenda(tab) {
    estado.agendaTab = tab || 'hoy';
    document.querySelectorAll('[data-agenda]').forEach(function (boton) {
      boton.classList.toggle('activo', boton.dataset.agenda === estado.agendaTab);
    });
    irA('agenda');
  }

  // ------------------------------------------------------------ sesion

  function limpiarSesion() {
    estado.token = '';
    estado.usuario = null;
    estado.sesionExp = 0;
    estado.datos = { materias: [], horarios: [], examenes: [], tareas: [] };
    estado.agenda = {};
    estado.ultimaRespuesta = '';
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    localStorage.removeItem(CLAVE_TOKEN_EXP);
    $('btn-salir').classList.add('oculto');
    $('nav-inferior').classList.add('oculto');
    $('login-mensaje').textContent = '';
    $('tarjeta-respuesta').classList.add('oculto');
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  async function validarSesion() {
    try {
      const usuario = await api('sesion');
      estado.usuario = usuario;
      localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
      entrarEnPrincipal();
    } catch (error) {
      limpiarSesion();
      irA('login');
      if (!esErrorSesion(error)) toast('No se pudo validar la sesión: ' + error.message);
    }
  }

  function entrarEnPrincipal() {
    $('login-mensaje').textContent = '';
    $('login-pin').value = '';
    $('saludo').textContent = 'Hola' + (estado.usuario && estado.usuario.nombre ? ', ' + estado.usuario.nombre : '') + '.';
    irA('principal');
    cargarTodo();
  }

  async function entrar(evento) {
    evento.preventDefault();
    const email = $('login-email').value.trim().toLowerCase();
    const pin = $('login-pin').value.trim();
    if (!email || !pin) return;

    $('login-mensaje').textContent = '';
    try {
      const datos = await api('login', { email: email, pin: pin });
      estado.token = datos.token;
      estado.usuario = datos.usuario;
      estado.email = email;
      estado.sesionExp = Date.now() + (Number(datos.sesion_dias) || 7) * 86400000;

      localStorage.setItem(CLAVE_TOKEN, estado.token);
      localStorage.setItem(CLAVE_USUARIO, JSON.stringify(estado.usuario));
      localStorage.setItem(CLAVE_EMAIL, email);
      localStorage.setItem(CLAVE_TOKEN_EXP, String(estado.sesionExp));

      entrarEnPrincipal();
    } catch (error) {
      $('login-mensaje').textContent = error.message || 'No se pudo iniciar sesión.';
    }
  }

  async function cerrarSesion() {
    if (estado.token) {
      try { await api('logout'); } catch (error) {}
    }
    limpiarSesion();
    irA('login');
  }

  // ------------------------------------------------------------ configuracion

  function normalizarUrl(valor) {
    let url = String(valor || '').trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    return url;
  }

  function urlApiValida(url) {
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/(exec|dev)$/i.test(String(url || ''));
  }

  function abrirConfig(volverA) {
    estado.configVolverA = volverA || (estado.token ? 'ajustes' : 'login');
    irA('config');
  }

  function volverDeConfig() {
    if (estado.token) {
      irA('inicio');
      validarSesion();
    } else {
      irA('login');
    }
  }

  async function guardarConfig(evento) {
    evento.preventDefault();
    const url = normalizarUrl($('api-url').value);
    if (!urlApiValida(url)) {
      $('config-mensaje').textContent = 'La URL debe empezar con https://script.google.com/macros/s/ y terminar en /exec.';
      return;
    }
    estado.api = url;
    localStorage.setItem(CLAVE_API, url);
    const ok = await probarApi(true);
    if (ok) volverDeConfig();
  }

  async function probarApi(desdeConfig) {
    const url = desdeConfig ? normalizarUrl($('api-url').value) : estado.api;
    const mensaje = desdeConfig ? $('config-mensaje') : null;

    if (!url) {
      if (mensaje) mensaje.textContent = 'Primero escribí la URL de la API.';
      else toast('Primero configurá la URL de la API.');
      return false;
    }
    if (desdeConfig && !urlApiValida(url)) {
      if (mensaje) mensaje.textContent = 'La URL no tiene el formato esperado. Debe terminar en /exec.';
      return false;
    }

    if (mensaje) mensaje.textContent = 'Probando conexión…';
    try {
      const datos = await apiEn(url, 'ping', {});
      if (mensaje) mensaje.textContent = 'Conexión correcta: ' + (datos.servicio || 'API') + ' v' + (datos.version || '');
      toast('Conexión correcta.');
      return true;
    } catch (error) {
      if (mensaje) mensaje.textContent = 'No se pudo conectar: ' + error.message;
      else toast('No se pudo conectar: ' + error.message);
      return false;
    }
  }

  async function cambiarPin(evento) {
    evento.preventDefault();
    const actual = $('pin-actual').value.trim();
    const nuevo = $('pin-nuevo').value.trim();
    if (!/^\d{4,8}$/.test(nuevo)) {
      toast('El PIN nuevo debe tener entre 4 y 8 números.');
      return;
    }
    try {
      await api('usuario.pin', { pin_actual: actual, pin_nuevo: nuevo });
      $('pin-actual').value = '';
      $('pin-nuevo').value = '';
      toast('PIN cambiado correctamente.');
    } catch (error) {
      manejarError(error);
    }
  }

  function actualizarAjustes() {
    $('ajustes-api').textContent = estado.api || 'No configurada';
    $('ajustes-usuario').textContent = estado.usuario
      ? (estado.usuario.nombre || 'Alumno') + ' · ' + (estado.usuario.email || '')
      : '';
    $('version').textContent = 'Asistente Académico v0.1.0';
  }

  // ------------------------------------------------------------ voz

  function prepararReconocimiento() {
    const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Constructor) return null;

    const reconocimiento = new Constructor();
    reconocimiento.lang = 'es-AR';
    reconocimiento.interimResults = true;
    reconocimiento.continuous = false;
    reconocimiento.maxAlternatives = 1;

    reconocimiento.onstart = function () {
      estado.escuchando = true;
      estado.transcripcionFinal = '';
      marcarMicro(true);
      $('indicador').textContent = 'Escuchando…';
      $('transcripcion').textContent = '';
    };

    reconocimiento.onresult = function (evento) {
      let parcial = '';
      let final = '';
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const texto = evento.results[i][0].transcript;
        if (evento.results[i].isFinal) final += texto;
        else parcial += texto;
      }
      if (final) estado.transcripcionFinal = (estado.transcripcionFinal + ' ' + final).trim();
      $('transcripcion').textContent = (estado.transcripcionFinal + ' ' + parcial).trim();
    };

    reconocimiento.onerror = function (evento) {
      const mensajes = {
        'not-allowed': 'Permití el micrófono en el navegador para poder preguntar.',
        'no-speech': 'No escuché nada. Tocá el micrófono y probá de nuevo.',
        'audio-capture': 'No se encontró un micrófono disponible.',
        'network': 'Sin conexión. El dictado necesita Internet.'
      };
      $('indicador').textContent = mensajes[evento.error] || 'No pude escuchar. Probá de nuevo.';
    };

    reconocimiento.onend = function () {
      estado.escuchando = false;
      marcarMicro(false);
      const texto = estado.transcripcionFinal.trim();
      if (texto) consultarVoz(texto);
      else $('indicador').textContent = 'Tocá el micrófono y preguntá';
    };

    return reconocimiento;
  }

  function marcarMicro(activo) {
    const boton = $('btn-micro');
    boton.classList.toggle('escuchando', activo);
    boton.setAttribute('aria-pressed', activo ? 'true' : 'false');
  }

  function alternarMicro() {
    if (!estado.reconocimiento) estado.reconocimiento = prepararReconocimiento();
    if (!estado.reconocimiento) {
      toast('Este navegador no permite dictado por voz. Podés escribir la consulta.');
      return;
    }
    if (estado.escuchando) {
      try { estado.reconocimiento.stop(); } catch (error) {}
      return;
    }
    try {
      estado.reconocimiento.start();
    } catch (error) {
      // Si ya estaba iniciado, se ignora.
    }
  }

  function hablar(texto) {
    estado.ultimaRespuesta = texto || '';
    if (!('speechSynthesis' in window) || !texto) return;

    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-AR';
    utterance.rate = 1;
    utterance.pitch = 1;

    const voces = speechSynthesis.getVoices();
    const voz = voces.filter(function (v) { return /^es-AR/i.test(v.lang); })[0] ||
      voces.filter(function (v) { return /^es/i.test(v.lang); })[0];
    if (voz) utterance.voice = voz;
    speechSynthesis.speak(utterance);
  }

  async function consultarVoz(texto) {
    const consulta = String(texto || '').trim();
    if (!consulta) return;

    $('indicador').textContent = 'Consultando…';
    try {
      const datos = await api('voz.consultar', { texto: consulta });
      mostrarRespuesta(datos.texto);
      hablar(datos.texto);
      $('indicador').textContent = 'Tocá el micrófono y preguntá';
    } catch (error) {
      $('indicador').textContent = 'Tocá el micrófono y preguntá';
      manejarError(error);
    }
  }

  function mostrarRespuesta(texto) {
    $('respuesta-texto').textContent = texto || 'No pude obtener una respuesta.';
    $('tarjeta-respuesta').classList.remove('oculto');
    $('tarjeta-respuesta').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ------------------------------------------------------------ datos

  async function cargarMaterias() {
    estado.datos.materias = await api('materia.listar');
  }

  async function cargarHorarios() {
    estado.datos.horarios = await api('horario.listar');
  }

  async function cargarExamenes() {
    estado.datos.examenes = await api('examen.listar');
  }

  async function cargarTareas() {
    estado.datos.tareas = await api('tarea.listar');
  }

  async function cargarTodo() {
    const resultados = await Promise.allSettled([
      cargarMaterias(),
      cargarHorarios(),
      cargarExamenes(),
      cargarTareas()
    ]);
    const fallo = resultados.filter(function (r) { return r.status === 'rejected'; })[0];
    if (fallo) manejarError(fallo.reason);

    cargarResumen();
    if (estado.token && estado.pantalla === 'agenda') await cargarAgenda();
    if (estado.token && estado.pantalla === 'datos') renderDatos();
  }

  function cargarResumen() {
    const cont = $('resumen-proximo');
    if (!cont) return;

    const hoy = hoyISO();
    const items = [];

    estado.datos.examenes.forEach(function (examen) {
      if (examen.fecha >= hoy) items.push({ tipo: 'examen', fecha: examen.fecha, hora: examen.hora, dato: examen });
    });
    estado.datos.tareas.forEach(function (tarea) {
      const pendiente = tarea.estado === 'PENDIENTE' || tarea.estado === 'EN_CURSO';
      if (pendiente && tarea.fecha_entrega >= hoy) {
        items.push({ tipo: 'tarea', fecha: tarea.fecha_entrega, hora: tarea.hora_entrega, dato: tarea });
      }
    });

    items.sort(function (a, b) {
      return String(a.fecha + (a.hora || '')).localeCompare(String(b.fecha + (b.hora || '')));
    });

    if (!items.length) {
      cont.innerHTML = vacio('No tenés exámenes ni entregas próximas.');
      return;
    }
    cont.innerHTML = items.slice(0, 4).map(function (item) {
      return item.tipo === 'examen' ? cardExamen(item.dato) : cardTarea(item.dato);
    }).join('');
  }

  async function cargarAgenda() {
    if (!estado.token) return;
    const cont = $('agenda-contenido');
    cont.innerHTML = '<p class="ayuda">Cargando agenda…</p>';

    try {
      let datos;
      if (estado.agendaTab === 'manana') datos = await api('consulta.manana');
      else if (estado.agendaTab === 'semana') datos = await api('consulta.semana');
      else datos = await api('consulta.hoy');

      estado.agenda[estado.agendaTab] = datos;
      renderAgenda(datos, estado.agendaTab);
    } catch (error) {
      cont.innerHTML = '';
      manejarError(error);
    }
  }

  function seccion(titulo, contenido) {
    return '<section class="bloque"><h2>' + escapar_(titulo) + '</h2>' + contenido + '</section>';
  }

  function renderAgenda(datos, tab) {
    const cont = $('agenda-contenido');
    $('agenda-rango').textContent = tab === 'semana'
      ? 'Del ' + fmtFecha(datos.desde) + ' al ' + fmtFecha(datos.hasta)
      : (datos.fecha_legible || '');

    const partes = [];
    let clasesHtml = '';

    if (datos.horarios && datos.horarios.length) {
      if (tab === 'semana') {
        const grupos = {};
        datos.horarios.forEach(function (h) {
          if (!grupos[h.dia]) grupos[h.dia] = [];
          grupos[h.dia].push(h);
        });
        clasesHtml = DIAS.filter(function (dia) { return grupos[dia]; }).map(function (dia) {
          return '<div class="grupo-dia"><h3>' + DIAS_BONITOS[dia] + '</h3>' +
            '<div class="lista-tarjetas">' + grupos[dia].map(cardClase).join('') + '</div></div>';
        }).join('');
      } else {
        clasesHtml = '<div class="lista-tarjetas">' + datos.horarios.map(cardClase).join('') + '</div>';
      }
    } else {
      clasesHtml = vacio('No tenés clases.');
    }
    partes.push(seccion('Clases', clasesHtml));

    partes.push(seccion('Exámenes', datos.examenes && datos.examenes.length
      ? '<div class="lista-tarjetas">' + datos.examenes.map(cardExamen).join('') + '</div>'
      : vacio('No tenés exámenes en este rango.')));

    partes.push(seccion('Entregas', datos.tareas && datos.tareas.length
      ? '<div class="lista-tarjetas">' + datos.tareas.map(cardTarea).join('') + '</div>'
      : vacio('No tenés entregas en este rango.')));

    if (datos.tareas_vencidas && datos.tareas_vencidas.length) {
      partes.push(seccion('Vencidas', '<div class="lista-tarjetas">' +
        datos.tareas_vencidas.map(cardTarea).join('') + '</div>'));
    }

    cont.innerHTML = partes.join('');
  }

  function cardClase(h) {
    const hora = fmtHora(h.hora_inicio);
    const fin = fmtHora(h.hora_fin);
    const horario = hora ? (hora + (fin ? ' a ' + fin : '')) : 'Sin horario';
    return '<article class="tarjeta-item" style="--color:' + colorSeguro(colorDeMateria(h.materia_id)) + '">' +
      '<div class="item-principal">' +
        '<span class="punto"></span>' +
        '<div><h3>' + escapar_(h.materia_nombre || 'Materia') + '</h3>' +
        '<p>' + escapar_(horario) + (h.aula ? ' · ' + escapar_(h.aula) : '') + '</p></div>' +
      '</div>' +
      '<span class="etiqueta">' + escapar_(tipoHorario(h.tipo)) + '</span>' +
    '</article>';
  }

  function cardExamen(examen) {
    const hora = fmtHora(examen.hora);
    const detalles = [fmtFecha(examen.fecha), hora, examen.aula].filter(Boolean).map(escapar_).join(' · ');
    return '<article class="tarjeta-item">' +
      '<div><h3>' + escapar_(tipoExamen(examen.tipo)) + ' de ' + escapar_(examen.materia_nombre || 'Materia') + '</h3>' +
      '<p>' + detalles + '</p>' +
      (examen.temas ? '<p class="detalle">' + escapar_(examen.temas) + '</p>' : '') + '</div>' +
      '<span class="etiqueta">' + escapar_(etiquetaDias(examen.dias_para, examen.fecha)) + '</span>' +
    '</article>';
  }

  function cardTarea(tarea) {
    const hora = fmtHora(tarea.hora_entrega);
    const detalles = ['Entrega ' + fmtFecha(tarea.fecha_entrega), hora].filter(Boolean).map(escapar_).join(' · ');
    const clase = tarea.vencida ? ' peligro' : (tarea.estado === 'ENTREGADA' ? ' ok' : '');
    return '<article class="tarjeta-item">' +
      '<div><h3>' + escapar_(tarea.descripcion) + '</h3>' +
      '<p>' + escapar_(materiaPorId(tarea.materia_id) ? materiaPorId(tarea.materia_id).nombre : (tarea.materia_nombre || '')) +
      ' · ' + detalles + '</p>' +
      (tarea.observaciones ? '<p class="detalle">' + escapar_(tarea.observaciones) + '</p>' : '') + '</div>' +
      '<span class="etiqueta' + clase + '">' + escapar_(estadoTarea(tarea.estado)) + '</span>' +
    '</article>';
  }

  // ------------------------------------------------------------ gestion

  function opcionesMaterias(seleccion) {
    return estado.datos.materias.map(function (materia) {
      return '<option value="' + attr(materia.materia_id) + '"' +
        (String(materia.materia_id) === String(seleccion) ? ' selected' : '') + '>' +
        escapar_(materia.nombre) + '</option>';
    }).join('');
  }

  function selectColor(valor) {
    const elegido = colorSeguro(valor || COLORES[0].valor);
    return COLORES.map(function (color) {
      return '<option value="' + color.valor + '"' + (color.valor === elegido ? ' selected' : '') + '>' +
        color.nombre + '</option>';
    }).join('');
  }

  function selectRecordar(valor) {
    const opciones = [
      [1440, '1 día antes'],
      [2880, '2 días antes'],
      [10080, '1 semana antes'],
      [120, '2 horas antes'],
      [60, '1 hora antes']
    ];
    const elegido = String(Number(valor) || 1440);
    if (!opciones.some(function (o) { return String(o[0]) === elegido; })) {
      opciones.push([Number(elegido) || 1440, (Number(elegido) || 1440) + ' minutos antes']);
    }
    return opciones.map(function (opcion) {
      return '<option value="' + opcion[0] + '"' + (String(opcion[0]) === elegido ? ' selected' : '') + '>' +
        opcion[1] + '</option>';
    }).join('');
  }

  function selectSimple(valores, seleccion, etiqueta) {
    return valores.map(function (valor) {
      return '<option value="' + attr(valor) + '"' + (String(valor) === String(seleccion) ? ' selected' : '') + '>' +
        escapar_(etiqueta ? etiqueta(valor) : valor) + '</option>';
    }).join('');
  }

  function actualizarBotonNuevo() {
    const etiquetas = {
      materias: 'Agregar materia',
      horarios: 'Agregar horario',
      examenes: 'Agregar examen',
      tareas: 'Agregar tarea'
    };
    $('btn-nuevo').textContent = etiquetas[estado.datosTab] || 'Agregar';
  }

  function renderDatos() {
    actualizarBotonNuevo();
    const cont = $('datos-contenido');

    if (estado.datosTab === 'materias') {
      cont.innerHTML = estado.datos.materias.length
        ? '<div class="lista-tarjetas">' + estado.datos.materias.map(cardMateriaAdmin).join('') + '</div>'
        : vacio('Todavía no cargaste materias. Empezá por agregar una.');
      return;
    }

    if (estado.datosTab === 'horarios') {
      cont.innerHTML = estado.datos.horarios.length
        ? '<div class="lista-tarjetas">' + estado.datos.horarios.map(cardHorarioAdmin).join('') + '</div>'
        : vacio('Todavía no cargaste horarios.');
      return;
    }

    if (estado.datosTab === 'examenes') {
      const examenes = ordenarExamenes(estado.datos.examenes);
      cont.innerHTML = examenes.length
        ? '<div class="lista-tarjetas">' + examenes.map(cardExamenAdmin).join('') + '</div>'
        : vacio('Todavía no cargaste exámenes.');
      return;
    }

    const tareas = ordenarTareas(estado.datos.tareas);
    cont.innerHTML = tareas.length
      ? '<div class="lista-tarjetas">' + tareas.map(cardTareaAdmin).join('') + '</div>'
      : vacio('Todavía no cargaste tareas.');
  }

  function ordenarExamenes(lista) {
    const hoy = hoyISO();
    return lista.slice().sort(function (a, b) {
      const aFuturo = a.fecha >= hoy;
      const bFuturo = b.fecha >= hoy;
      if (aFuturo !== bFuturo) return aFuturo ? -1 : 1;
      const claveA = a.fecha + (a.hora || '');
      const claveB = b.fecha + (b.hora || '');
      return aFuturo ? claveA.localeCompare(claveB) : claveB.localeCompare(claveA);
    });
  }

  function ordenarTareas(lista) {
    function peso(tarea) {
      if (tarea.estado === 'EN_CURSO') return 0;
      if (tarea.estado === 'PENDIENTE') return 1;
      if (tarea.estado === 'ENTREGADA') return 2;
      return 3;
    }
    return lista.slice().sort(function (a, b) {
      const diferencia = peso(a) - peso(b);
      if (diferencia !== 0) return diferencia;
      return (a.fecha_entrega + (a.hora_entrega || '')).localeCompare(b.fecha_entrega + (b.hora_entrega || ''));
    });
  }

  function cardMateriaAdmin(materia) {
    return '<article class="tarjeta-item" style="--color:' + colorSeguro(materia.color) + '">' +
      '<div class="item-principal"><span class="punto"></span><div>' +
        '<h3>' + escapar_(materia.nombre) + '</h3>' +
        '<p>' + escapar_(materia.docente ? 'Docente: ' + materia.docente : 'Sin docente') +
        (materia.aula_habitual ? ' · Aula ' + escapar_(materia.aula_habitual) : '') + '</p>' +
      '</div></div>' +
      '<div class="item-acciones">' +
        '<button type="button" class="btn-mini" data-accion="editar-materia" data-id="' + attr(materia.materia_id) + '">Editar</button>' +
        '<button type="button" class="btn-mini peligro" data-accion="eliminar-materia" data-id="' + attr(materia.materia_id) + '">Eliminar</button>' +
      '</div>' +
    '</article>';
  }

  function cardHorarioAdmin(horario) {
    const materia = materiaPorId(horario.materia_id);
    const nombre = materia ? materia.nombre : (horario.materia_nombre || 'Materia');
    return '<article class="tarjeta-item" style="--color:' + colorSeguro(colorDeMateria(horario.materia_id)) + '">' +
      '<div class="item-principal"><span class="punto"></span><div>' +
        '<h3>' + escapar_(nombre) + '</h3>' +
        '<p>' + escapar_(DIAS_BONITOS[horario.dia] || horario.dia) + ' · ' +
        escapar_(horario.hora_inicio) + ' a ' + escapar_(horario.hora_fin) +
        (horario.aula ? ' · ' + escapar_(horario.aula) : '') + '</p>' +
      '</div></div>' +
      '<div class="item-acciones">' +
        '<span class="etiqueta">' + escapar_(tipoHorario(horario.tipo)) + '</span>' +
        '<button type="button" class="btn-mini" data-accion="editar-horario" data-id="' + attr(horario.horario_id) + '">Editar</button>' +
        '<button type="button" class="btn-mini peligro" data-accion="eliminar-horario" data-id="' + attr(horario.horario_id) + '">Eliminar</button>' +
      '</div>' +
    '</article>';
  }

  function cardExamenAdmin(examen) {
    const hora = fmtHora(examen.hora);
    return '<article class="tarjeta-item">' +
      '<div><h3>' + escapar_(tipoExamen(examen.tipo)) + ' de ' + escapar_(examen.materia_nombre || 'Materia') + '</h3>' +
      '<p>' + escapar_(fmtFecha(examen.fecha)) + (hora ? ' · ' + escapar_(hora) : '') +
      (examen.aula ? ' · ' + escapar_(examen.aula) : '') + '</p>' +
      (examen.temas ? '<p class="detalle">' + escapar_(examen.temas) + '</p>' : '') + '</div>' +
      '<div class="item-acciones">' +
        '<span class="etiqueta' + (examen.estado === 'RENDIDO' ? ' ok' : '') + '">' + escapar_(examen.estado === 'RENDIDO' ? 'Rendido' : 'Programado') + '</span>' +
        '<button type="button" class="btn-mini" data-accion="editar-examen" data-id="' + attr(examen.examen_id) + '">Editar</button>' +
        '<button type="button" class="btn-mini peligro" data-accion="eliminar-examen" data-id="' + attr(examen.examen_id) + '">Eliminar</button>' +
      '</div>' +
    '</article>';
  }

  function cardTareaAdmin(tarea) {
    const hora = fmtHora(tarea.hora_entrega);
    const materia = materiaPorId(tarea.materia_id);
    const nombreMateria = materia ? materia.nombre : (tarea.materia_nombre || '');
    const clase = tarea.vencida ? ' peligro' : (tarea.estado === 'ENTREGADA' ? ' ok' : '');
    let botonesEstado = '';
    if (tarea.estado === 'PENDIENTE') {
      botonesEstado += '<button type="button" class="btn-mini" data-accion="estado-tarea" data-id="' + attr(tarea.tarea_id) + '" data-estado="EN_CURSO">Empezar</button>';
      botonesEstado += '<button type="button" class="btn-mini" data-accion="estado-tarea" data-id="' + attr(tarea.tarea_id) + '" data-estado="ENTREGADA">Entregada</button>';
    } else if (tarea.estado === 'EN_CURSO') {
      botonesEstado += '<button type="button" class="btn-mini" data-accion="estado-tarea" data-id="' + attr(tarea.tarea_id) + '" data-estado="ENTREGADA">Entregada</button>';
    } else if (tarea.estado === 'ENTREGADA') {
      botonesEstado += '<button type="button" class="btn-mini" data-accion="estado-tarea" data-id="' + attr(tarea.tarea_id) + '" data-estado="PENDIENTE">Reabrir</button>';
    }

    return '<article class="tarjeta-item">' +
      '<div><h3>' + escapar_(tarea.descripcion) + '</h3>' +
      '<p>' + escapar_(nombreMateria) + ' · Entrega ' + escapar_(fmtFecha(tarea.fecha_entrega)) +
      (hora ? ' · ' + escapar_(hora) : '') + ' · Prioridad ' + escapar_(prioridadTexto(tarea.prioridad)) + '</p>' +
      (tarea.observaciones ? '<p class="detalle">' + escapar_(tarea.observaciones) + '</p>' : '') + '</div>' +
      '<div class="item-acciones">' +
        '<span class="etiqueta' + clase + '">' + escapar_(estadoTarea(tarea.estado)) + '</span>' +
        botonesEstado +
        '<button type="button" class="btn-mini" data-accion="editar-tarea" data-id="' + attr(tarea.tarea_id) + '">Editar</button>' +
        '<button type="button" class="btn-mini peligro" data-accion="eliminar-tarea" data-id="' + attr(tarea.tarea_id) + '">Eliminar</button>' +
      '</div>' +
    '</article>';
  }

  // ------------------------------------------------------------ formularios

  function abrirDialogo(titulo, campos, guardar) {
    $('dialogo-titulo').textContent = titulo;
    $('dialogo-campos').innerHTML = campos;
    estado.dialogoGuardar = guardar;
    $('dialogo-guardar').disabled = false;
    if (!$('dialogo').open) $('dialogo').showModal();
    setTimeout(function () {
      const primero = $('dialogo-campos').querySelector('input, select, textarea');
      if (primero) primero.focus();
    }, 60);
  }

  function cerrarDialogo() {
    estado.dialogoGuardar = null;
    if ($('dialogo').open) $('dialogo').close();
  }

  function leerCampos() {
    const datos = {};
    new FormData($('dialogo-form')).forEach(function (valor, clave) {
      datos[clave] = typeof valor === 'string' ? valor.trim() : valor;
    });
    return datos;
  }

  async function enviarDialogo(evento) {
    evento.preventDefault();
    if (!estado.dialogoGuardar) return;

    const boton = $('dialogo-guardar');
    boton.disabled = true;
    try {
      await estado.dialogoGuardar();
    } catch (error) {
      manejarError(error);
    } finally {
      boton.disabled = false;
    }
  }

  async function guardarEntidad(tipo, datos, id) {
    const accion = tipo + (id ? '.editar' : '.crear');
    const registro = Object.assign({}, datos);
    if (id) registro[tipo + '_id'] = id;

    const payload = {};
    payload[tipo] = registro;
    await api(accion, payload);

    cerrarDialogo();
    toast('Guardado correctamente.');
    await recargarTodo();
  }

  function abrirFormularioMateria(materia) {
    abrirDialogo(materia ? 'Editar materia' : 'Nueva materia',
      '<label>Nombre<input name="nombre" required maxlength="80" value="' + attr(materia ? materia.nombre : '') + '"></label>' +
      '<label>Docente<input name="docente" maxlength="80" value="' + attr(materia ? materia.docente : '') + '"></label>' +
      '<label>Aula habitual<input name="aula_habitual" maxlength="60" value="' + attr(materia ? materia.aula_habitual : '') + '"></label>' +
      '<label>Color<select name="color">' + selectColor(materia ? materia.color : '') + '</select></label>',
      async function () {
        const campos = leerCampos();
        await guardarEntidad('materia', campos, materia ? materia.materia_id : null);
      });
  }

  function abrirFormularioHorario(horario) {
    if (!estado.datos.materias.length) {
      toast('Primero cargá una materia.');
      return;
    }
    const seleccion = horario ? horario.materia_id : estado.datos.materias[0].materia_id;
    abrirDialogo(horario ? 'Editar horario' : 'Nuevo horario',
      '<label>Materia<select name="materia_id" required>' + opcionesMaterias(seleccion) + '</select></label>' +
      '<label>Día<select name="dia" required>' + selectSimple(DIAS, horario ? horario.dia : 'LUNES', function (d) { return DIAS_BONITOS[d]; }) + '</select></label>' +
      '<div class="fila-campos">' +
        '<label>Inicio<input type="time" name="hora_inicio" required value="' + attr(horario ? horario.hora_inicio : '08:00') + '"></label>' +
        '<label>Fin<input type="time" name="hora_fin" required value="' + attr(horario ? horario.hora_fin : '09:30') + '"></label>' +
      '</div>' +
      '<label>Aula<input name="aula" maxlength="60" value="' + attr(horario ? horario.aula : '') + '"></label>' +
      '<label>Tipo<select name="tipo">' + selectSimple(TIPOS_HORARIO, horario ? horario.tipo : 'TEORIA', tipoHorario) + '</select></label>',
      async function () {
        const campos = leerCampos();
        await guardarEntidad('horario', campos, horario ? horario.horario_id : null);
      });
  }

  function abrirFormularioExamen(examen) {
    if (!estado.datos.materias.length) {
      toast('Primero cargá una materia.');
      return;
    }
    const seleccion = examen ? examen.materia_id : estado.datos.materias[0].materia_id;
    abrirDialogo(examen ? 'Editar examen' : 'Nuevo examen',
      '<label>Materia<select name="materia_id" required>' + opcionesMaterias(seleccion) + '</select></label>' +
      '<label>Tipo<select name="tipo">' + selectSimple(TIPOS_EXAMEN, examen ? examen.tipo : 'PARCIAL', tipoExamen) + '</select></label>' +
      '<label>Fecha<input type="date" name="fecha" required value="' + attr(examen ? examen.fecha : hoyISO()) + '"></label>' +
      '<div class="fila-campos">' +
        '<label>Hora<input type="time" name="hora" value="' + attr(examen ? examen.hora : '') + '"></label>' +
        '<label>Aula<input name="aula" maxlength="60" value="' + attr(examen ? examen.aula : '') + '"></label>' +
      '</div>' +
      '<label>Temas<textarea name="temas" rows="3" maxlength="300">' + escapar_(examen ? examen.temas : '') + '</textarea></label>' +
      '<label>Estado<select name="estado">' + selectSimple(ESTADOS_EXAMEN, examen ? examen.estado : 'PROGRAMADO', function (e) { return e === 'RENDIDO' ? 'Rendido' : 'Programado'; }) + '</select></label>' +
      '<label>Recordatorio<select name="recordar_min">' + selectRecordar(examen ? examen.recordar_min : 1440) + '</select></label>',
      async function () {
        const campos = leerCampos();
        campos.recordar_min = Number(campos.recordar_min) || 1440;
        await guardarEntidad('examen', campos, examen ? examen.examen_id : null);
      });
  }

  function abrirFormularioTarea(tarea) {
    if (!estado.datos.materias.length) {
      toast('Primero cargá una materia.');
      return;
    }
    const seleccion = tarea ? tarea.materia_id : estado.datos.materias[0].materia_id;
    abrirDialogo(tarea ? 'Editar tarea' : 'Nueva tarea',
      '<label>Materia<select name="materia_id" required>' + opcionesMaterias(seleccion) + '</select></label>' +
      '<label>Descripción<input name="descripcion" required maxlength="200" value="' + attr(tarea ? tarea.descripcion : '') + '"></label>' +
      '<div class="fila-campos">' +
        '<label>Fecha de entrega<input type="date" name="fecha_entrega" required value="' + attr(tarea ? tarea.fecha_entrega : hoyISO()) + '"></label>' +
        '<label>Hora<input type="time" name="hora_entrega" value="' + attr(tarea ? tarea.hora_entrega : '') + '"></label>' +
      '</div>' +
      '<label>Prioridad<select name="prioridad">' + selectSimple(PRIORIDADES, tarea ? tarea.prioridad : 'MEDIA', prioridadTexto) + '</select></label>' +
      '<label>Observaciones<textarea name="observaciones" rows="3" maxlength="300">' + escapar_(tarea ? tarea.observaciones : '') + '</textarea></label>' +
      '<label>Recordatorio<select name="recordar_min">' + selectRecordar(tarea ? tarea.recordar_min : 1440) + '</select></label>',
      async function () {
        const campos = leerCampos();
        campos.recordar_min = Number(campos.recordar_min) || 1440;
        await guardarEntidad('tarea', campos, tarea ? tarea.tarea_id : null);
      });
  }

  function abrirNuevo() {
    if (estado.datosTab === 'horarios') abrirFormularioHorario(null);
    else if (estado.datosTab === 'examenes') abrirFormularioExamen(null);
    else if (estado.datosTab === 'tareas') abrirFormularioTarea(null);
    else abrirFormularioMateria(null);
  }

  function abrirFormulario(tipo, id) {
    const lista = estado.datos[PLURAL[tipo]] || [];
    const item = lista.filter(function (registro) {
      return String(registro[tipo + '_id']) === String(id);
    })[0];
    if (!item) return;

    if (tipo === 'materia') abrirFormularioMateria(item);
    else if (tipo === 'horario') abrirFormularioHorario(item);
    else if (tipo === 'examen') abrirFormularioExamen(item);
    else if (tipo === 'tarea') abrirFormularioTarea(item);
  }

  async function recargarTodo() {
    const resultados = await Promise.allSettled([
      cargarMaterias(),
      cargarHorarios(),
      cargarExamenes(),
      cargarTareas()
    ]);
    const fallo = resultados.filter(function (r) { return r.status === 'rejected'; })[0];
    if (fallo) manejarError(fallo.reason);

    cargarResumen();
    if (estado.token && estado.pantalla === 'agenda') await cargarAgenda();
    if (estado.token && estado.pantalla === 'datos') renderDatos();
  }

  async function eliminarEntidad(tipo, id) {
    if (tipo === 'materia') {
      const usada = estado.datos.horarios.some(function (h) { return String(h.materia_id) === String(id); }) ||
        estado.datos.examenes.some(function (e) { return String(e.materia_id) === String(id); }) ||
        estado.datos.tareas.some(function (t) { return String(t.materia_id) === String(id); });
      if (usada) {
        toast('Esa materia tiene horarios, exámenes o tareas. Eliminá primero esos registros.');
        return;
      }
    }

    if (!window.confirm('¿Eliminar este registro?')) return;

    const payload = {};
    payload[tipo + '_id'] = id;
    await api(tipo + '.anular', payload);
    toast('Registro eliminado.');
    await recargarTodo();
  }

  async function cambiarEstadoTarea(id, nuevoEstado) {
    await api('tarea.estado', { tarea_id: id, estado: nuevoEstado });
    toast('Estado actualizado.');
    await recargarTodo();
  }

  async function accionDatos(evento) {
    const boton = evento.target.closest('[data-accion]');
    if (!boton) return;

    const partes = String(boton.dataset.accion).split('-');
    const accion = partes[0];
    const tipo = partes[1];
    const id = boton.dataset.id;

    try {
      if (accion === 'editar') abrirFormulario(tipo, id);
      else if (accion === 'eliminar') await eliminarEntidad(tipo, id);
      else if (accion === 'estado') await cambiarEstadoTarea(id, boton.dataset.estado);
    } catch (error) {
      manejarError(error);
    }
  }

  // ------------------------------------------------------------ eventos

  function al(id, evento, funcion) {
    const elemento = $(id);
    if (elemento) elemento.addEventListener(evento, funcion);
  }

  function conectarEventos() {
    al('form-config', 'submit', guardarConfig);
    al('btn-probar-api', 'click', function () { probarApi(true); });
    al('btn-config-volver', 'click', volverDeConfig);

    al('form-login', 'submit', entrar);
    al('btn-login-config', 'click', function () { abrirConfig('login'); });

    al('btn-micro', 'click', alternarMicro);
    al('form-consulta', 'submit', function (evento) {
      evento.preventDefault();
      const entrada = $('consulta-texto');
      const texto = entrada.value.trim();
      if (!texto) return;
      entrada.value = '';
      consultarVoz(texto);
    });
    al('btn-ver-agenda', 'click', function () { abrirAgenda('hoy'); });
    al('btn-ir-agenda', 'click', function () { abrirAgenda('hoy'); });
    al('btn-repetir', 'click', function () {
      if (estado.ultimaRespuesta) hablar(estado.ultimaRespuesta);
      else toast('Todavía no hay una respuesta para repetir.');
    });

    al('btn-recargar', 'click', async function () {
      await recargarTodo();
      toast('Datos actualizados.');
    });
    al('btn-salir', 'click', cerrarSesion);
    al('btn-salir-ajustes', 'click', cerrarSesion);

    al('btn-config-api', 'click', function () { abrirConfig('ajustes'); });
    al('btn-probar-api-ajustes', 'click', function () { probarApi(false); });
    al('form-pin', 'submit', cambiarPin);
    al('btn-nuevo', 'click', abrirNuevo);

    al('dialogo-form', 'submit', enviarDialogo);
    al('dialogo-cancelar', 'click', cerrarDialogo);
    al('dialogo-cerrar', 'click', cerrarDialogo);

    document.querySelectorAll('[data-consulta]').forEach(function (boton) {
      boton.addEventListener('click', function () { consultarVoz(boton.dataset.consulta); });
    });

    document.querySelectorAll('[data-nav]').forEach(function (boton) {
      boton.addEventListener('click', function () { irA(boton.dataset.nav); });
    });

    document.querySelectorAll('[data-agenda]').forEach(function (boton) {
      boton.addEventListener('click', function () {
        estado.agendaTab = boton.dataset.agenda;
        document.querySelectorAll('[data-agenda]').forEach(function (b) {
          b.classList.toggle('activo', b === boton);
        });
        cargarAgenda();
      });
    });

    document.querySelectorAll('[data-tab]').forEach(function (boton) {
      boton.addEventListener('click', function () {
        estado.datosTab = boton.dataset.tab;
        document.querySelectorAll('[data-tab]').forEach(function (b) {
          b.classList.toggle('activo', b === boton);
        });
        renderDatos();
      });
    });

    $('datos-contenido').addEventListener('click', accionDatos);

    window.addEventListener('online', actualizarConexion);
    window.addEventListener('offline', actualizarConexion);
  }

  function registrarServiceWorker() {
    const seguro = location.protocol === 'https:' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1';
    if (!seguro || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('service-worker.js').catch(function () {});
  }

  function mostrarAvisos() {
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
      $('indicador').textContent = 'Tu navegador no permite dictado. Escribí la consulta abajo.';
    }
    actualizarConexion();
  }

  // ------------------------------------------------------------ inicio

  function iniciar() {
    estado.api = (localStorage.getItem(CLAVE_API) || '').trim();
    estado.token = localStorage.getItem(CLAVE_TOKEN) || '';
    estado.email = localStorage.getItem(CLAVE_EMAIL) || '';
    estado.sesionExp = Number(localStorage.getItem(CLAVE_TOKEN_EXP) || 0);
    estado.usuario = leerJson(localStorage.getItem(CLAVE_USUARIO));

    conectarEventos();
    mostrarAvisos();
    registrarServiceWorker();

    if (!estado.api) {
      irA('config');
      estado.configVolverA = 'login';
      return;
    }

    if (estado.token) {
      if (estado.sesionExp && Date.now() > estado.sesionExp) {
        limpiarSesion();
        irA('login');
        toast('Tu sesión venció. Ingresá de nuevo.');
        return;
      }
      irA('inicio');
      validarSesion();
      return;
    }

    irA('login');
  }

  iniciar();
})();
