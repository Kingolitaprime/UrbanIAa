/* Visor de resultados con pestañas (panel y detalle comparten el mismo HTML).
   Pestañas: Antes y después | Cambios detectados | Estadísticas | Informe | Fuentes.
   Todo texto proveniente de datos se inserta con textContent (previene XSS). */
var UrbaniaVisor = (function () {
  'use strict';
  var capas = {}, graficos = {}, mapaIni = null, mapaFin = null, d = null, resaltado = null, listo = false;
  var ORDEN = ['tab-antes', 'tab-cambios', 'tab-stats', 'tab-informe', 'tab-fuentes'];
  var COLOR_TIPO = { 'Nueva urbanización': '#dc2626', 'Pérdida de vegetación': '#ffffff', 'Ganancia de vegetación': '#7dd3fc' };

  function $(id) { return document.getElementById(id); }
  function fmt(n, suf) {
    return (n === null || n === undefined) ? '—' : Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + (suf || '');
  }
  function el(tag, texto, cls) { var e = document.createElement(tag); if (texto !== undefined) e.textContent = texto; if (cls) e.className = cls; return e; }
  function reducido() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function anunciar(msg) { var a = $('anuncio'); a.textContent = ''; setTimeout(function () { a.textContent = msg; }, 60); }

  /* ------------------------------------------------------------ mapa base */
  function baseMapas(m) {
    var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' });
    var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Imágenes: Esri, Maxar, Earthstar Geographics' });
    osm.addTo(m);
    L.control.layers({ 'Calles (OpenStreetMap)': osm, 'Satélite (Esri)': sat }).addTo(m);
  }

  function limpiarCapas() {
    [mapaIni, mapaFin].forEach(function (m) { if (m) { m.off(); m.remove(); } });
    mapaIni = mapaFin = null; capas = {}; resaltado = null;
  }

  function actualizarEquilibrio() {
    var valor = Number($('cruce').value);
    if (capas.ini) capas.ini.setOpacity(1 - valor / 100);
    if (capas.fin) capas.fin.setOpacity(valor / 100);
    $('texto-equilibrio').textContent = valor === 50
      ? 'Ambos años tienen el mismo protagonismo visual.'
      : valor < 50
        ? d.ano_inicio + ' tiene más protagonismo (' + (100 - valor) + ' %) y ' + d.ano_fin + ' menos (' + valor + ' %).'
        : d.ano_fin + ' tiene más protagonismo (' + valor + ' %) y ' + d.ano_inicio + ' menos (' + (100 - valor) + ' %).';
  }

  function sincronizarMapas() {
    var bloqueado = false;
    function copiar(origen, destino) {
      origen.on('moveend', function () {
        if (bloqueado || !destino) return;
        bloqueado = true; destino.setView(origen.getCenter(), origen.getZoom(), { animate: false }); bloqueado = false;
      });
    }
    copiar(mapaIni, mapaFin); copiar(mapaFin, mapaIni);
  }

  function montarCapas() {
    limpiarCapas();
    mapaIni = L.map('mapa-ini', { scrollWheelZoom: false });
    mapaFin = L.map('mapa-fin', { scrollWheelZoom: false });
    baseMapas(mapaIni); baseMapas(mapaFin);
    var url = function (t) { return '/analisis/' + d.id + '/imagen/' + t + '.png'; };
    capas.ini = L.imageOverlay(url('rgb_inicio'), d.bounds, { opacity: .5, zIndex: 10, alt: 'Imagen satelital ' + d.ano_inicio });
    capas.fin = L.imageOverlay(url('rgb_fin'), d.bounds, { opacity: .5, zIndex: 10, alt: 'Imagen satelital ' + d.ano_fin });
    capas.cambio = L.imageOverlay(url('cambio'), d.bounds, { opacity: 0, zIndex: 12, alt: 'Cambios detectados' });
    capas.ini.addTo(mapaIni); capas.fin.addTo(mapaFin); capas.cambio.addTo(mapaFin);
    mapaIni.fitBounds(d.bounds); mapaFin.fitBounds(d.bounds); sincronizarMapas();
    var cruce = $('cruce'), ver = $('ver-cambio');
    cruce.value = 50; ver.checked = false; actualizarEquilibrio();
    cruce.oninput = actualizarEquilibrio;
    ver.onchange = function () { capas.cambio.setOpacity(ver.checked ? 1 : 0); };
    setTimeout(function () { mapaIni.invalidateSize(); mapaFin.invalidateSize(); }, 100);
  }

  /* ------------------------------------------------------------- pestañas */
  function activar(id, enfocar) {
    ORDEN.forEach(function (tid) {
      var t = $(tid), p = $(t.getAttribute('aria-controls')), sel = (tid === id);
      t.setAttribute('aria-selected', sel ? 'true' : 'false');
      t.tabIndex = sel ? 0 : -1;
      p.hidden = !sel;
    });
    if (enfocar) $(id).focus();
    if (id === 'tab-antes' && mapaIni && mapaFin) setTimeout(function () { mapaIni.invalidateSize(); mapaFin.invalidateSize(); }, 80);
    Object.keys(graficos).forEach(function (k) { graficos[k].resize(); });
  }

  function iniciarPestanas() {
    if (listo) return; listo = true;
    ORDEN.forEach(function (id) {
      var t = $(id);
      t.addEventListener('click', function () { activar(id, false); });
      t.addEventListener('keydown', function (e) {
        var vis = ORDEN.filter(function (x) { return !$(x).hidden; }), i = vis.indexOf(id), n = null;
        if (e.key === 'ArrowRight') n = vis[(i + 1) % vis.length];
        else if (e.key === 'ArrowLeft') n = vis[(i - 1 + vis.length) % vis.length];
        else if (e.key === 'Home') n = vis[0];
        else if (e.key === 'End') n = vis[vis.length - 1];
        if (n) { e.preventDefault(); activar(n, true); }
      });
    });
    $('filtro-zonas').addEventListener('change', function () { renderZonas(this.value); });
  }

  /* ------------------------------------------------------------ componentes */
  function tablaAlt(contId, cabecera, filas) {
    var c = $(contId); c.textContent = '';
    var t = el('table'), th = el('thead'), tr = el('tr');
    cabecera.forEach(function (h) { var x = el('th', h); x.scope = 'col'; tr.appendChild(x); });
    th.appendChild(tr); t.appendChild(th);
    var tb = el('tbody');
    filas.forEach(function (f) { var r = el('tr'); f.forEach(function (v) { r.appendChild(el('td', v)); }); tb.appendChild(r); });
    t.appendChild(tb); c.appendChild(el('div', undefined, 'tabla-scroll')).appendChild(t);
  }

  function dato(cont, valor, etiqueta) {
    var div = el('div', undefined, 'dato');
    div.appendChild(el('b', valor)); div.appendChild(el('span', etiqueta)); cont.appendChild(div);
  }

  function cifras() {
    var s = d.stats, i = d.indicadores || {}, c1 = $('res-cifras'), c2 = $('res-indicadores');
    c1.textContent = ''; c2.textContent = '';
    dato(c1, fmt(s.ha_urbanizadas, ' ha'), 'Nueva superficie urbanizada');
    dato(c1, fmt(s.ha_verdes_perdidas, ' ha'), 'Vegetación perdida');
    dato(c1, fmt(s.ha_verdes_ganadas, ' ha'), 'Vegetación ganada');
    dato(c1, fmt(s.ha_verde_a_urbano, ' ha'), 'Vegetación convertida a urbano');
    dato(c1, fmt(s.ha_urbanas_inicio, ' ha'), 'Superficie urbana en ' + d.ano_inicio);
    dato(c1, fmt(s.ha_urbanas_fin, ' ha'), 'Superficie urbana en ' + d.ano_fin);
    dato(c1, fmt(s.pct_verde_inicio, ' %') + ' → ' + fmt(s.pct_verde_fin, ' %'), 'Cobertura vegetal');
    dato(c1, fmt(s.pct_pixeles_validos, ' %'), 'Área válida (sin nubes)');
    dato(c2, i.crecimiento_pct === null || i.crecimiento_pct === undefined ? '—' : fmt(i.crecimiento_pct, ' %'), 'Crecimiento de la superficie urbana');
    dato(c2, fmt(i.ha_por_ano, ' ha/año'), 'Ritmo de urbanización');
    dato(c2, i.pct_urbanizado_era_verde === null || i.pct_urbanizado_era_verde === undefined ? '—' : fmt(i.pct_urbanizado_era_verde, ' %'), 'De lo urbanizado, antes era vegetación');
    dato(c2, i.variacion_verde_pp === null || i.variacion_verde_pp === undefined ? '—' : (i.variacion_verde_pp > 0 ? '+' : '') + fmt(i.variacion_verde_pp, ' puntos'), 'Cambio en la cobertura vegetal');
  }

  function graficosStats() {
    var s = d.stats;
    var etiquetas = ['Urbano inicial', 'Urbano final', 'Nueva urbanización', 'Vegetación perdida', 'Vegetación ganada'];
    var valores = [s.ha_urbanas_inicio, s.ha_urbanas_fin, s.ha_urbanizadas, s.ha_verdes_perdidas, s.ha_verdes_ganadas];
    $('graf-ha').setAttribute('aria-label', 'Gráfico de barras de hectáreas. ' + etiquetas.map(function (e, k) { return e + ': ' + fmt(valores[k]) + ' ha'; }).join('; '));
    tablaAlt('alt-ha', ['Concepto', 'Hectáreas (est.)'], etiquetas.map(function (e, k) { return [e, fmt(valores[k])]; }));
    if (typeof Chart !== 'undefined') {
      graficos.ha = new Chart($('graf-ha'), {
        type: 'bar',
        data: { labels: etiquetas, datasets: [{ label: 'Hectáreas (estimadas)', data: valores, backgroundColor: ['#bae6fd', '#075985', '#dc2626', '#ffffff', '#7dd3fc'], borderColor: '#333', borderWidth: 1 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }
    var caja = $('caja-anillos');
    if (d.anillos && d.anillos.length) {
      caja.hidden = false;
      var et = d.anillos.map(function (a) { return a.desde_km + ' a ' + a.hasta_km + ' km'; });
      var v1 = d.anillos.map(function (a) { return a.pct_verde_inicio; }), v2 = d.anillos.map(function (a) { return a.pct_verde_fin; });
      $('graf-anillos').setAttribute('aria-label', 'Gráfico de barras de porcentaje de vegetación por distancia al centro. ' + et.map(function (e, k) { return e + ': ' + fmt(v1[k]) + ' % en ' + d.ano_inicio + ' y ' + fmt(v2[k]) + ' % en ' + d.ano_fin; }).join('; '));
      tablaAlt('alt-anillos', ['Distancia al centro', 'Vegetación ' + d.ano_inicio + ' (%)', 'Vegetación ' + d.ano_fin + ' (%)'], et.map(function (e, k) { return [e, fmt(v1[k]), fmt(v2[k])]; }));
      if (typeof Chart !== 'undefined') {
        graficos.anillos = new Chart($('graf-anillos'), {
          type: 'bar',
          data: { labels: et, datasets: [
            { label: d.ano_inicio + ' (%)', data: v1, backgroundColor: '#bae6fd', borderColor: '#333', borderWidth: 1 },
            { label: d.ano_fin + ' (%)', data: v2, backgroundColor: '#075985', borderColor: '#333', borderWidth: 1 }] },
          options: { scales: { y: { beginAtZero: true, max: 100 } } }
        });
      }
    } else { caja.hidden = true; }
  }

  function graficoCoberturas() {
    var caja = $('caja-coberturas'), c = d.cambios && d.cambios.coberturas;
    if (!c || !c.inicio || !c.fin) { caja.hidden = true; return; }
    caja.hidden = false;
    var clases = [
      { clave: 'vegetacion', nombre: 'Vegetación', color: '#7dd3fc' },
      { clave: 'urbano', nombre: 'Urbano / construido', color: '#dc2626' },
      { clave: 'agua', nombre: 'Agua', color: '#075985' },
      { clave: 'suelo_otras', nombre: 'Suelo / otras coberturas', color: '#ffffff' }
    ];
    var filas = [];
    [['inicio', d.ano_inicio], ['fin', d.ano_fin]].forEach(function (periodo) {
      clases.forEach(function (clase) {
        var valor = c[periodo[0]][clase.clave] || { ha: 0, pct: 0 };
        filas.push([periodo[1], clase.nombre, fmt(valor.ha), fmt(valor.pct, ' %')]);
      });
    });
    tablaAlt('alt-coberturas', ['Año', 'Tipo de cobertura', 'Área estimada (ha)', 'Área válida (%)'], filas);
    $('graf-coberturas').setAttribute('aria-label', 'Composición del área válida por cobertura. ' +
      filas.map(function (f) { return f[0] + ', ' + f[1] + ': ' + f[2] + ' hectáreas, ' + f[3]; }).join('; '));
    if (typeof Chart !== 'undefined') {
      graficos.coberturas = new Chart($('graf-coberturas'), {
        type: 'bar',
        data: {
          labels: [String(d.ano_inicio), String(d.ano_fin)],
          datasets: clases.map(function (clase) {
            return {
              label: clase.nombre,
              data: [c.inicio[clase.clave].pct, c.fin[clase.clave].pct],
              backgroundColor: clase.color,
              borderColor: '#333',
              borderWidth: 1
            };
          })
        },
        options: {
          indexAxis: 'y',
          scales: {
            x: { stacked: true, beginAtZero: true, max: 100, title: { display: true, text: '% del área válida' } },
            y: { stacked: true }
          }
        }
      });
    }
  }

  /* ------------------------------------------------------ pestaña de cambios */
  function verEnMapa(p, n) {
    if (!mapaFin) return;
    /* El mapa vive en la pestaña de comparación: primero la hacemos visible. */
    activar('tab-antes', false);
    setTimeout(function () {
      var mapa = mapaFin;
      if (!mapa) return;
      mapa.invalidateSize();
      if (resaltado && mapa.hasLayer(resaltado)) mapa.removeLayer(resaltado);
      var radio = Math.max(Math.sqrt(p.ha * 10000 / Math.PI), 60);
      resaltado = L.circle([p.lat, p.lng], { radius: radio, color: '#000', weight: 4, fillOpacity: 0, dashArray: '8 5' }).addTo(mapa);
      var pop = el('div'); pop.appendChild(el('b', p.tipo)); pop.appendChild(document.createElement('br'));
      pop.appendChild(document.createTextNode(fmt(p.ha) + ' ha · ' + fmt(p.dist_km) + ' km al ' + p.dir_nombre + ' del centro'));
      resaltado.bindPopup(pop).openPopup();
      if (reducido()) mapa.setView([p.lat, p.lng], 16); else mapa.flyTo([p.lat, p.lng], 16, { duration: 0.8 });
      mapa.getContainer().scrollIntoView({ block: 'center', behavior: reducido() ? 'auto' : 'smooth' });
      anunciar('Mostrando en el mapa la zona ' + n + ': ' + p.tipo + ', ' + fmt(p.ha) + ' hectáreas, a ' + fmt(p.dist_km) + ' kilómetros al ' + p.dir_nombre + ' del centro.');
    }, 100);
  }

  function renderZonas(filtro) {
    var tb = $('tabla-zonas').querySelector('tbody'); tb.textContent = '';
    var lista = (d.cambios.parcelas || []).filter(function (p) { return !filtro || p.tipo === filtro; })
      .sort(function (a, b) { return b.ha - a.ha; });
    if (!lista.length) {
      var tr0 = el('tr'), td0 = el('td', 'No hay zonas de este tipo mayores a ' + fmt(d.cambios.min_ha) + ' ha.'); td0.colSpan = 7;
      tr0.appendChild(td0); tb.appendChild(tr0); return;
    }
    lista.forEach(function (p, i) {
      var tr = el('tr'), ET = ['N.º', 'Tipo de cambio', 'Superficie (ha)', 'Ubicación', 'Qué significa', 'Antes era vegetación', ''];
      tr.appendChild(el('td', String(i + 1)));
      var tdT = el('td'); var sw = el('i', undefined, 'muestra'); sw.style.background = COLOR_TIPO[p.tipo] || '#888'; sw.setAttribute('aria-hidden', 'true');
      tdT.appendChild(sw); tdT.appendChild(document.createTextNode(' ' + p.tipo)); tr.appendChild(tdT);
      tr.appendChild(el('td', fmt(p.ha)));
      tr.appendChild(el('td', fmt(p.dist_km) + ' km al ' + p.dir_nombre + ' del centro · ' +
        Number(p.lat).toFixed(5) + ', ' + Number(p.lng).toFixed(5)));
      var significado = p.tipo === 'Nueva urbanización'
        ? 'Aparece como superficie construida en el año final.'
        : p.tipo === 'Pérdida de vegetación'
          ? 'Tenía vegetación al inicio y ya no se clasifica así al final.'
          : 'Se detecta vegetación en el año final donde antes no aparecía.';
      tr.appendChild(el('td', significado));
      tr.appendChild(el('td', p.tipo === 'Ganancia de vegetación' ? '—' : fmt(p.pct_ex_verde, ' %')));
      var tdA = el('td'), b = el('button', 'Ver en el mapa', 'btn btn-chico btn-zona'); b.type = 'button';
      b.setAttribute('aria-label', 'Ver en el mapa la zona ' + (i + 1) + ': ' + p.tipo + ', ' + fmt(p.ha) + ' hectáreas');
      b.addEventListener('click', function () { verEnMapa(p, i + 1); });
      tdA.appendChild(b); tr.appendChild(tdA);
      for (var k = 0; k < tr.children.length; k++) tr.children[k].setAttribute('data-et', ET[k]);
      tb.appendChild(tr);
    });
  }

  function pestanaCambios() {
    var tiene = !!(d.cambios && d.cambios.parcelas);
    $('cambios-contenido').hidden = !tiene; $('cambios-vacio').hidden = tiene;
    document.querySelectorAll('.ano-ini').forEach(function (x) { x.textContent = d.ano_inicio; });
    document.querySelectorAll('.ano-fin').forEach(function (x) { x.textContent = d.ano_fin; });
    $('dl-png').href = '/analisis/' + d.id + '/mapa_cambios.png';
    $('dl-png').setAttribute('download', 'mapa_cambios_' + d.ciudad.replace(/\s+/g, '_') + '_' + d.ano_inicio + '_' + d.ano_fin + '.png');
    $('dl-csv').href = '/analisis/' + d.id + '/cambios.csv';
    if (!tiene) return;
    var n = d.cambios.n_zonas || {};
    $('cambios-conteo').textContent = 'Se detectaron ' + (n.urbanizacion || 0) + ' zonas de nueva urbanización, ' +
      (n.perdida_verde || 0) + ' de pérdida de vegetación y ' + (n.ganancia_verde || 0) + ' de ganancia de vegetación ' +
      '(solo se cuentan zonas mayores a ' + fmt(d.cambios.min_ha) + ' ha; se listan las más grandes de cada tipo).';
    $('min-ha').textContent = fmt(d.cambios.min_ha);
    $('filtro-zonas').value = '';
    renderZonas('');
    var dirs = d.cambios.direcciones || [];
    var etiquetas = dirs.map(function (x) { return x.dir; });
    var urb = dirs.map(function (x) { return x.ha_urbanizadas; }), ver = dirs.map(function (x) { return x.ha_verde_perdido; });
    $('graf-dir').setAttribute('aria-label', 'Gráfico de barras de hectáreas por dirección desde el centro. ' + dirs.map(function (x) { return x.nombre + ': ' + fmt(x.ha_urbanizadas) + ' ha urbanizadas'; }).join('; '));
    tablaAlt('alt-dir', ['Dirección', 'Nueva urbanización (ha)', 'Vegetación perdida (ha)'], dirs.map(function (x) { return [x.nombre, fmt(x.ha_urbanizadas), fmt(x.ha_verde_perdido)]; }));
    if (typeof Chart !== 'undefined') {
      graficos.dir = new Chart($('graf-dir'), {
        type: 'bar',
        data: { labels: etiquetas, datasets: [
          { label: 'Nueva urbanización (ha)', data: urb, backgroundColor: '#dc2626', borderColor: '#333', borderWidth: 1 },
          { label: 'Vegetación perdida (ha)', data: ver, backgroundColor: '#ffffff', borderColor: '#333', borderWidth: 1 }] },
        options: { scales: { y: { beginAtZero: true } } }
      });
    }
  }

  /* ------------------------------------------------- fuentes, informe y voz */
  function escenas() {
    var tb = $('res-escenas').querySelector('tbody'); tb.textContent = '';
    var rot = [d.ano_inicio + ' (inicial)', d.ano_fin + ' (final)'];
    d.escenas.forEach(function (e, i) {
      var tr = el('tr');
      var vals = e && e.id_escena ? [rot[i], e.satelite, e.fecha, fmt(e.nubes, ' %'), e.tile || '—'] : [rot[i], 's/d', 's/d', 's/d', 's/d'];
      vals.forEach(function (v) { tr.appendChild(el('td', v)); });
      var td = el('td');
      if (e && e.url && /^https:\/\//.test(e.url)) {
        var a = el('a', e.producto || 'Ver escena'); a.href = e.url; a.target = '_blank'; a.rel = 'noopener'; td.appendChild(a);
      } else { td.textContent = (e && e.producto) || 'Sin imágenes reales (registro de prueba)'; }
      tr.appendChild(td); tb.appendChild(tr);
    });
  }

  function informe() {
    var r = d.reporte, set = function (id, v) { $(id).textContent = v || '—'; };
    $('bloque-informe').hidden = !r;
    if (!r) return;
    set('txt-diagnostico', r.diagnostico); set('txt-impacto', r.impacto_ambiental);
    set('txt-recomendaciones', r.recomendaciones); set('txt-limitaciones', r.limitaciones);
    $('ins-ia').textContent = r.es_fallback ? 'SIN IA · ' + r.modelo : 'Generado con IA · ' + r.modelo;
  }

  function voz() {
    var ok = window.UrbaniaA11y && window.UrbaniaA11y.vozDisponible();
    $('btn-leer-resumen').hidden = !ok; $('btn-leer-informe').hidden = !ok;
    if (!ok) return;
    $('btn-leer-resumen').onclick = function () { window.UrbaniaA11y.leer($('res-resumen').textContent, this); };
    $('btn-leer-informe').onclick = function () {
      var t = ['Diagnóstico.', $('txt-diagnostico').textContent, 'Impacto ambiental.', $('txt-impacto').textContent,
        'Recomendaciones.', $('txt-recomendaciones').textContent, 'Limitaciones.', $('txt-limitaciones').textContent].join(' ');
      window.UrbaniaA11y.leer(t, this);
    };
  }

  /* ---------------------------------------------------------------- principal */
  function mostrar(m, datos) {
    d = datos;
    Object.keys(graficos).forEach(function (k) { graficos[k].destroy(); }); graficos = {};
    iniciarPestanas();
    $('resultado').hidden = false;
    $('res-titulo').textContent = 'Resultados: ' + d.ciudad + ' ' + d.ano_inicio + ' a ' + d.ano_fin + (d.es_demo ? ' (registro de prueba)' : '');
    $('res-resumen').textContent = d.resumen || '';
    $('lbl-ini').textContent = d.ano_inicio; $('lbl-fin').textContent = d.ano_fin;
    $('lbl-ini-b').textContent = d.ano_inicio; $('lbl-fin-b').textContent = d.ano_fin;

    var hayVisor = !!(d.tiene_imagenes && d.bounds);
    $('tab-antes').hidden = !hayVisor; $('tab-cambios').hidden = !hayVisor;
    if (hayVisor) montarCapas(); else limpiarCapas();
    cifras(); graficosStats(); graficoCoberturas(); pestanaCambios(); escenas(); informe(); voz();
    activar(hayVisor ? 'tab-antes' : 'tab-stats', false);
  }

  return { baseMapas: baseMapas, mostrar: mostrar };
})();
