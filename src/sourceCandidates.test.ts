import { describe, expect, it } from "vitest";
import {
  collectGrupoRoxoCandidates,
  collectKrolowCandidates,
  collectMercadoPradoCandidates,
  retainMissingSources,
} from "./sourceCandidates";

const discoveredAt = "2026-07-31T15:00:00.000Z";

describe("collectGrupoRoxoCandidates", () => {
  it("extracts mirrored flyer images with the Roxo website as source", () => {
    const html = `
      <li class="zoom-instagram-widget__item wpzoom-instagram" data-media-type="carousel_album">
        <a href="https://www.instagram.com/p/DbcB0tjFSHN/" title="Ofertas do Hortifruti Roxo">
          <img data-src="https://www.gruporoxo.com.br/wp-content/uploads/2026/07/hortifruti.jpg" alt="Ofertas do Hortifruti Roxo">
        </a>
      </li>
    `;

    expect(collectGrupoRoxoCandidates(html, discoveredAt)).toEqual({
      candidates: [
        {
          id: "grupo-roxo-https-www-gruporoxo-com-br-wp-content-uploads-2026-07-hortifruti-jpg",
          supermarket: "Grupo Roxo",
          sourceUrl: "https://www.gruporoxo.com.br/promocoes/",
          imageUrl: "https://www.gruporoxo.com.br/wp-content/uploads/2026/07/hortifruti.jpg",
          discoveredAt,
          rawTitle: "Ofertas do Hortifruti Roxo",
          rawCaption: "Ofertas do Hortifruti Roxo",
          mediaType: "carousel_album",
        },
      ],
      skipped: [],
    });
  });

  it("repairs common UTF-8 text that arrives as mojibake in widget attributes", () => {
    const html = `
      <li class="zoom-instagram-widget__item wpzoom-instagram" data-media-type="video">
        <a href="https://www.instagram.com/reel/example/" title="Ofertas de InÃ­cio de Semana ROXO">
          <img data-src="https://www.gruporoxo.com.br/wp-content/uploads/2026/07/inicio.jpg" alt="EstÃ¡ chegando">
        </a>
      </li>
    `;

    const [candidate] = collectGrupoRoxoCandidates(html, discoveredAt).candidates;

    expect(candidate.rawTitle).toBe("Ofertas de Início de Semana ROXO");
    expect(candidate.rawCaption).toBe("Está chegando");
  });
});

describe("collectKrolowCandidates", () => {
  it("extracts only full-size images from the special offers carousel", () => {
    const html = `
      <section class="hero">
        <img src="https://macroatacadokrolow.com.br/wp-content/uploads/2026/07/macro-atacado-hero.avif">
      </section>
      <h2>Ofertas Especiais <br>Feitas Para Você!</h2>
      <a href="https://macroatacadokrolow.com.br/wp-content/uploads/2026/08/DIAK-0708-ate-0908.avif">
        <img src="https://macroatacadokrolow.com.br/wp-content/uploads/2026/08/DIAK-0708-ate-0908-819x1024.avif">
      </a>
      <p>Verifique a data de validade das ofertas!</p>
    `;

    expect(collectKrolowCandidates(html, discoveredAt).candidates).toEqual([
      {
        id: "krolow-https-macroatacadokrolow-com-br-wp-content-uploads-2026-08-diak-0708-ate-0908-avif",
        supermarket: "Krolow",
        sourceUrl: "https://macroatacadokrolow.com.br/",
        imageUrl: "https://macroatacadokrolow.com.br/wp-content/uploads/2026/08/DIAK-0708-ate-0908.avif",
        discoveredAt,
        rawTitle: "Ofertas Krolow",
        rawCaption: "Ofertas Krolow",
        mediaType: "avif",
      },
    ]);
  });

  it("records a skipped reason when no flyer-like image is found", () => {
    expect(collectKrolowCandidates("<img src='/logo.png'>", discoveredAt).skipped).toEqual([
      'Krolow "Ofertas Especiais Feitas Para Voce" section did not expose flyer images',
    ]);
  });

  it("extracts a current AVIF flyer once, ignoring resized copies", () => {
    const html = `
      <h2>Ofertas Especiais <br>Feitas Para Você!</h2>
      <img src="https://macroatacadokrolow.com.br/wp-content/uploads/2026/08/DIAK-0708-ate-0908.avif">
      <img src="https://macroatacadokrolow.com.br/wp-content/uploads/2026/08/DIAK-0708-ate-0908-203x300.avif">
      <p>Verifique a data de validade das ofertas!</p>
    `;

    expect(collectKrolowCandidates(html, discoveredAt).candidates).toHaveLength(1);
  });
});

describe("collectMercadoPradoCandidates", () => {
  it("collects images from posts published during the last seven days", () => {
    const result = collectMercadoPradoCandidates(
      [
        {
          type: "Image",
          shortCode: "recent",
          url: "https://www.instagram.com/p/recent/",
          timestamp: "2026-07-30T15:00:00.000Z",
          displayUrl: "https://scontent.cdninstagram.com/recent.jpg",
          caption: "Ofertas validas esta semana",
        },
        {
          type: "Image",
          shortCode: "old",
          url: "https://www.instagram.com/p/old/",
          timestamp: "2026-07-20T15:00:00.000Z",
          displayUrl: "https://scontent.cdninstagram.com/old.jpg",
        },
      ],
      discoveredAt,
    );

    expect(result.candidates).toEqual([
      expect.objectContaining({
        supermarket: "Mercado Prado",
        sourceUrl: "https://www.instagram.com/p/recent/",
        imageUrl: "https://scontent.cdninstagram.com/recent.jpg",
        rawTitle: "Ofertas validas esta semana",
        rawCaption: "Ofertas validas esta semana",
      }),
    ]);
  });

  it("expands carousel images and excludes video slides", () => {
    const result = collectMercadoPradoCandidates(
      [
        {
          type: "Sidecar",
          shortCode: "carousel",
          timestamp: "2026-07-31T12:00:00.000Z",
          childPosts: [
            { type: "Image", displayUrl: "https://scontent.cdninstagram.com/one.jpg" },
            { type: "Video", displayUrl: "https://scontent.cdninstagram.com/video.jpg" },
            { type: "Image", displayUrl: "https://scontent.cdninstagram.com/two.webp" },
          ],
        },
      ],
      discoveredAt,
    );

    expect(result.candidates.map((candidate) => candidate.imageUrl)).toEqual([
      "https://scontent.cdninstagram.com/one.jpg",
      "https://scontent.cdninstagram.com/two.webp",
    ]);
    expect(new Set(result.candidates.map((candidate) => candidate.id)).size).toBe(2);
  });

  it("uses Apify image arrays when child posts are unavailable and excludes video posts", () => {
    const result = collectMercadoPradoCandidates(
      [
        {
          type: "Sidecar",
          shortCode: "carousel-images",
          timestamp: "2026-07-31T12:00:00.000Z",
          carouselImages: ["https://cdn.example/one.jpg", "https://cdn.example/two.jpg"],
        },
        {
          type: "Sidecar",
          shortCode: "images",
          timestamp: "2026-07-31T11:00:00.000Z",
          images: ["https://cdn.example/three.jpg"],
        },
        {
          type: "Video",
          shortCode: "video",
          timestamp: "2026-07-31T10:00:00.000Z",
          displayUrl: "https://cdn.example/video-cover.jpg",
        },
      ],
      discoveredAt,
    );

    expect(result.candidates.map((candidate) => candidate.imageUrl)).toEqual([
      "https://cdn.example/one.jpg",
      "https://cdn.example/two.jpg",
      "https://cdn.example/three.jpg",
    ]);
  });
});

describe("retainMissingSources", () => {
  it("keeps the previous candidates for a supermarket whose refresh returned nothing", () => {
    const fresh = collectGrupoRoxoCandidates(
      '<li class="wpzoom-instagram"><a title="Ofertas Roxo"><img data-src="https://www.gruporoxo.com.br/wp-content/uploads/roxo.jpg" alt="Ofertas Roxo"></a></li>',
      discoveredAt,
    ).candidates;
    const previousKrolow = collectKrolowCandidates(
      '<h2>Ofertas Especiais <br>Feitas Para Você!</h2><img src="https://macroatacadokrolow.com.br/wp-content/uploads/krolow.avif"><p>Verifique a data de validade das ofertas!</p>',
      discoveredAt,
    ).candidates;

    expect(retainMissingSources(fresh, previousKrolow, ["Grupo Roxo", "Krolow"]).map((item) => item.supermarket)).toEqual([
      "Grupo Roxo",
      "Krolow",
    ]);
  });
});
