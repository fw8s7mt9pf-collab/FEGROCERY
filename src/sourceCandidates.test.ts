import { describe, expect, it } from "vitest";
import { collectGrupoRoxoCandidates, collectKrolowCandidates } from "./sourceCandidates";

const discoveredAt = "2026-07-31T15:00:00.000Z";

describe("collectGrupoRoxoCandidates", () => {
  it("extracts mirrored flyer images with Instagram source metadata", () => {
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
          id: "grupo-roxo-https-www-instagram-com-p-dbcb0tjfshn",
          supermarket: "Grupo Roxo",
          sourceUrl: "https://www.instagram.com/p/DbcB0tjFSHN/",
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
  it("extracts full-size WhatsApp flyer images and removes resized duplicates", () => {
    const html = `
      <a href="https://macroatacadokrolow.com.br/wp-content/uploads/2026/07/WhatsApp-Image-2026-07-30-at-20.00.14.jpeg">
        <img src="https://macroatacadokrolow.com.br/wp-content/uploads/2026/07/WhatsApp-Image-2026-07-30-at-20.00.14-819x1024.jpeg">
      </a>
    `;

    expect(collectKrolowCandidates(html, discoveredAt).candidates).toEqual([
      {
        id: "krolow-https-macroatacadokrolow-com-br",
        supermarket: "Krolow",
        sourceUrl: "https://macroatacadokrolow.com.br/",
        imageUrl: "https://macroatacadokrolow.com.br/wp-content/uploads/2026/07/WhatsApp-Image-2026-07-30-at-20.00.14.jpeg",
        discoveredAt,
      },
    ]);
  });

  it("records a skipped reason when no flyer-like image is found", () => {
    expect(collectKrolowCandidates("<img src='/logo.png'>", discoveredAt).skipped).toEqual([
      "Krolow homepage did not expose WhatsApp-Image flyer URLs",
    ]);
  });
});
