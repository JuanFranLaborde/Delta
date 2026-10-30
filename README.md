# DELTA — Asiento portátil para fotografía de naturaleza

Landing page interactiva de **DELTA**, un asiento individual portátil, triangular y plegable, impreso en 3D para fotógrafos de naturaleza que pasan horas en un mismo lugar. Tiene tres patas de un solo tramo, una base de 300 mm por lado y el asiento a 280 mm del suelo.

Proyecto del Taller de Diseño Industrial 3B · FDA · UNLP.

## Ver la página

- Abrí `index.html` en el navegador (necesita conexión a internet para las tipografías y las animaciones; sin conexión se ve estática).
- O levantá un servidor local desde esta carpeta:

  ```bash
  python -m http.server 8000
  ```

  y entrá a `http://localhost:8000`.

## Estructura

```
index.html                 Página
css/styles.css             Estilos
js/main.js                 Interacciones y animaciones
assets/img/                Imágenes optimizadas (WebP)
assets/favicon.svg         Ícono
Panel Comercial DELTA.pdf  Panel comercial (enlazado desde la página)
Presentación ... .pdf      Presentación completa del proyecto (enlazada desde la página)
```

## Secciones

1. Hero con obturador triangular (Δ) y presentación de fotos
2. Concepto: ligero, resistente, funcional
3. El objeto: render con puntos de interés
4. Atributos: compacto, estable, cómodo (recorrido horizontal)
5. Secuencia de uso interactiva: tomar, desplegar, apoyar, listo
6. Ficha técnica
7. ¿Por qué DELTA? Forma, ergonomía y fabricación
8. Proceso: usuario, ámbito, antecedentes y exploración
9. Cierre y descargas

## Tecnología

HTML, CSS y JavaScript sin compilación. Animaciones con [GSAP](https://gsap.com/) + ScrollTrigger y scroll suave con [Lenis](https://lenis.darkroom.engineering/), cargados desde CDN. Respeta la preferencia de movimiento reducido del sistema.

## Créditos

Creado por Jiménez Lourdes, Menoyo Eliseo, García Benjamín y Juan Francisco Laborde.
