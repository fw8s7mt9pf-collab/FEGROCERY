import "./styles.css";
import gsap from "gsap";
import { categories, getCurrentDeals, getSupermarkets, type Category, type Deal } from "./deals";

function getAppRoot(): HTMLElement {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) {
    throw new Error("App root was not found");
  }
  return root;
}

const app = getAppRoot();

const categoryLabels: Record<Category, string> = {
  Meats: "Carnes",
  Produce: "Hortifruti",
  "Basic Groceries": "Basicos",
  Cleaning: "Limpeza",
  Hygiene: "Higiene",
  Beverages: "Bebidas",
  Alcohol: "Bebidas alcoolicas",
  Bakery: "Padaria",
  Frozen: "Congelados",
  Other: "Outros",
};

let allDeals: Deal[] = [];
let selectedCategory: "All" | Category = "All";
let selectedSupermarkets: string[] = [];
type ThemeKey = "light" | "dark";
let selectedTheme: ThemeKey = "light";
type ViewMode = "list" | "grid";
let viewMode: ViewMode = "list";
let stopHeroMotion: (() => void) | undefined;

function startHeroMotion(hero: HTMLElement): () => void {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const titleLayers = Array.from(hero.querySelectorAll<HTMLElement>(".hero-title-line, .hero-title-place"));
  const fogClouds = Array.from(hero.querySelectorAll<HTMLElement>(".fog-cloud"));
  const sceneLayers = [
    { element: hero.querySelector<HTMLElement>(".hero-scene"), depth: 3 },
    { element: hero.querySelector<HTMLElement>(".fog-back"), depth: 3.4 },
    { element: hero.querySelector<HTMLElement>(".hero-copy"), depth: 13 },
    { element: hero.querySelector<HTMLElement>(".fog-front"), depth: 4.2 },
  ].filter((layer): layer is { element: HTMLElement; depth: number } => Boolean(layer.element));
  const context = gsap.context(() => {
    gsap.fromTo(
      hero.querySelectorAll(".hero-kicker, .hero-title-line, .hero-title-place, .hero-description, .refresh"),
      { opacity: 0, y: reduceMotion ? 0 : 22 },
      { opacity: 1, y: 0, duration: reduceMotion ? 0.01 : 0.8, stagger: reduceMotion ? 0 : 0.07, ease: "power3.out" },
    );
    if (!reduceMotion) {
      gsap.set(hero.querySelector(".hero-scene"), { scale: 1.008, transformOrigin: "50% 50%" });
      hero.querySelectorAll<HTMLElement>(".fog-drift").forEach((fog, index) => {
        gsap.to(fog, {
          x: index % 2 ? -(16 + index * 2) : 14 + index * 2,
          y: index % 3 === 0 ? -3 : 3,
          scaleX: 1.025 + index * 0.006,
          scaleY: .985 + index * 0.004,
          duration: 15 + index * 2.6,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
      fogClouds.forEach((cloud, index) => {
        const isBackLayer = index < 3;
        gsap.to(cloud, {
          opacity: isBackLayer ? (index % 2 ? .2 : .16) : (index % 2 ? .58 : .48),
          scale: index % 2 ? 2.59 : 2.45,
          duration: 8 + index * 1.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
    }
  }, hero);

  const sceneParallax = sceneLayers.map(({ element, depth }) => ({
    x: gsap.quickTo(element, "x", { duration: .85, ease: "power3.out" }),
    y: gsap.quickTo(element, "y", { duration: .85, ease: "power3.out" }),
    depth,
  }));
  const onPointerMove = (event: PointerEvent): void => {
    if (reduceMotion) return;
    const bounds = hero.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    sceneParallax.forEach((layer) => {
      layer.x(x * layer.depth);
      layer.y(y * layer.depth * .72);
    });
  };
  const onPointerLeave = (): void => {
    if (reduceMotion) return;
    sceneParallax.forEach((layer) => { layer.x(0); layer.y(0); });
  };
  hero.addEventListener("pointermove", onPointerMove);
  hero.addEventListener("pointerleave", onPointerLeave);
  return () => {
    hero.removeEventListener("pointermove", onPointerMove);
    hero.removeEventListener("pointerleave", onPointerLeave);
    gsap.killTweensOf([...fogClouds, ...titleLayers, ...sceneLayers.map((layer) => layer.element)]);
    context.revert();
  };
}

async function loadDeals(): Promise<Deal[]> {
  let response = await fetch(`./data/deals.json?updated=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    response = await fetch("./data/deals.sample.json");
  }
  if (!response.ok) {
    throw new Error(`Could not load deals: ${response.status}`);
  }
  return response.json() as Promise<Deal[]>;
}

function formatDate(value?: string): string {
  if (!value) return "data incerta";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function render(): void {
  stopHeroMotion?.();
  app.dataset.style = "ledger";
  app.dataset.theme = selectedTheme;
  app.dataset.view = viewMode;
  const supermarkets = getSupermarkets(allDeals);
  const deals = getCurrentDeals(allDeals, {
    category: selectedCategory,
    supermarket: "All",
    now: new Date(),
  }).filter((deal) => selectedSupermarkets.length === 0 || selectedSupermarkets.includes(deal.supermarket));

  app.innerHTML = `
    <section class="hero hero-v1">
      <svg class="hero-fog-filters" aria-hidden="true">
        <filter id="fog-distortion" x="-35%" y="-80%" width="170%" height="260%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.026" numOctaves="3" seed="11" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="38" xChannelSelector="R" yChannelSelector="G" result="distorted" />
          <feGaussianBlur in="distorted" stdDeviation="6" />
        </filter>
      </svg>
      <div class="hero-art" aria-hidden="true">
        <div class="hero-scene">
          <img class="hero-scene-day" src="./images/camaqua-watercolor.jpg" alt="">
          <img class="hero-scene-night" src="./images/camaqua-watercolor-night-crescent.png" alt="">
        </div>
      </div>
      <div class="fog-field fog-back" aria-hidden="true">
        <span class="fog-drift"><span class="fog-cloud"></span></span>
        <span class="fog-drift"><span class="fog-cloud"></span></span>
        <span class="fog-drift"><span class="fog-cloud"></span></span>
      </div>
      <button class="sky-toggle" id="theme-toggle" type="button" role="switch" aria-checked="${selectedTheme === "dark"}" aria-label="Alternar tema claro e escuro">
        <span class="sky-clouds" aria-hidden="true"></span>
        <span class="sky-stars" aria-hidden="true">✦ &nbsp;✦</span>
        <span class="sky-thumb" aria-hidden="true"><span class="sky-sun"></span><span class="sky-moon"></span></span>
      </button>
      <div class="hero-copy">
        <p class="hero-kicker">Economia local, escolha inteligente</p>
        <h1><span class="hero-title-line">Melhores Ofertas em</span> <em class="hero-title-place">Camaquã</em></h1>
        <p class="hero-description">Descontos ativos nos mercados da cidade.</p>
        <p class="refresh">Atualizado automaticamente 2-3 vezes por dia</p>
      </div>
      <div class="hero-mark" aria-hidden="true">
        <span>✦</span>
        <small>DE OLHO<br>NO PRECO</small>
      </div>
      <div class="fog-field fog-front" aria-hidden="true">
        <span class="fog-drift"><span class="fog-cloud"></span></span>
        <span class="fog-drift"><span class="fog-cloud"></span></span>
        <span class="fog-drift"><span class="fog-cloud"></span></span>
      </div>
    </section>

    <section class="deal-board" aria-label="Ofertas atuais">
      <div class="board-heading">
        <div>
          <p class="eyebrow">Descontos ativos nos mercados da cidade</p>
        </div>
        <div class="board-actions">
          <p class="summary" aria-live="polite"><strong>${deals.length}</strong> ofertas atuais</p>
          <div class="view-switch" role="group" aria-label="Modo de visualizacao">
            <button type="button" class="${viewMode === "list" ? "active" : ""}" data-view-mode="list">Lista</button>
            <button type="button" class="${viewMode === "grid" ? "active" : ""}" data-view-mode="grid">Grade</button>
          </div>
        </div>
      </div>

      <section class="filters" aria-label="Filtros">
        <details class="filter-menu">
          <summary>Categoria <span>${selectedCategory === "All" ? "Todas" : categoryLabels[selectedCategory]}</span></summary>
          <div class="filter-options" role="menu">
            <button class="${selectedCategory === "All" ? "active" : ""}" data-category="All">Todas</button>
            ${categories.map((category) => `<button class="${selectedCategory === category ? "active" : ""}" data-category="${category}">${categoryLabels[category]}</button>`).join("")}
          </div>
        </details>
        <details class="filter-menu market-menu">
          <summary>Mercado <span>${selectedSupermarkets.length ? `${selectedSupermarkets.length} selecionados` : "Todos"}</span></summary>
          <div class="filter-options" role="menu">
            <label class="check-option"><input type="checkbox" data-supermarket="All" ${selectedSupermarkets.length === 0 ? "checked" : ""}> Todos</label>
            ${supermarkets.map((supermarket) => `<label class="check-option"><input type="checkbox" data-supermarket="${supermarket}" ${selectedSupermarkets.includes(supermarket) ? "checked" : ""}> ${supermarket}</label>`).join("")}
          </div>
        </details>
      </section>

      <section class="grid">
      ${
        deals.length
          ? deals
              .map(
                (deal) => `
                  <article class="flyer">
                    <button class="image-button" data-open="${deal.id}" aria-label="Abrir ${deal.title}">
                      <img src="${deal.imageUrl}" alt="${deal.title}" loading="lazy">
                    </button>
                    <div class="flyer-body">
                      <div>
                        <p class="store">${deal.supermarket}</p>
                        <h2>${deal.title}</h2>
                      </div>
                      <p class="category">${categoryLabels[deal.category]}</p>
                      ${
                        deal.dealPrice !== undefined
                          ? `<div class="price-row">
                              <strong><small>R$</small>${formatPrice(deal.dealPrice).replace("R$", "")}</strong>
                              ${deal.regularPrice !== undefined && deal.regularPrice > deal.dealPrice ? `<s>${formatPrice(deal.regularPrice)}</s>` : ""}
                              ${deal.unitText ? `<span>${deal.unitText}</span>` : ""}
                            </div>`
                          : ""
                      }
                      ${deal.limitText ? `<p class="limit">${deal.limitText}</p>` : ""}
                      <p class="validity">Valido: ${formatDate(deal.validFrom)} ate ${formatDate(deal.validUntil)}</p>
                      ${deal.warning ? `<p class="warning">${deal.warning}</p>` : ""}
                      ${
                        viewMode === "grid"
                          ? `<button class="grid-open" type="button" data-open="${deal.id}">Ver oferta <span aria-hidden="true">→</span></button>`
                          : `<a href="${deal.sourceUrl}" target="_blank" rel="noreferrer">Ver fonte <span aria-hidden="true">→</span></a>`
                      }
                    </div>
                  </article>
                `,
              )
              .join("")
          : `<p class="empty">Nenhuma oferta atual encontrada para estes filtros.</p>`
      }
      </section>
    </section>
  `;

  const hero = app.querySelector<HTMLElement>(".hero");
  if (hero) {
    stopHeroMotion = startHeroMotion(hero);
  }

  app.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((button: HTMLButtonElement) => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category as "All" | Category;
      render();
    });
  });

  app.querySelectorAll<HTMLInputElement>("[data-supermarket]").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.dataset.supermarket === "All") {
        selectedSupermarkets = input.checked ? [] : selectedSupermarkets;
      } else if (input.checked) {
        selectedSupermarkets = [...selectedSupermarkets, input.dataset.supermarket!];
      } else {
        selectedSupermarkets = selectedSupermarkets.filter((market) => market !== input.dataset.supermarket);
      }
      render();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-view-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      viewMode = button.dataset.viewMode as ViewMode;
      render();
    });
  });

  app.querySelector<HTMLButtonElement>("#theme-toggle")?.addEventListener("click", (event: MouseEvent) => {
    selectedTheme = selectedTheme === "light" ? "dark" : "light";
    app.dataset.theme = selectedTheme;
    const button = event.currentTarget as HTMLButtonElement;
    button.setAttribute("aria-checked", String(selectedTheme === "dark"));
  });

  app.querySelectorAll<HTMLButtonElement>("[data-open]").forEach((button: HTMLButtonElement) => {
    button.addEventListener("click", () => {
      const deal = allDeals.find((candidate) => candidate.id === button.dataset.open);
      if (deal) openFlyer(deal);
    });
  });

}

function openFlyer(deal: Deal): void {
  const dialog = document.createElement("dialog");
  dialog.className = "dialog";
  dialog.innerHTML = `
    <button class="close" aria-label="Fechar">Fechar</button>
    <div class="dialog-content">
      <img src="${deal.imageUrl}" alt="${deal.title}">
      <div class="dialog-copy">
        <p class="store">${deal.supermarket}</p>
        <h2>${deal.title}</h2>
        ${deal.dealPrice !== undefined ? `<strong class="dialog-price">${formatPrice(deal.dealPrice)}</strong>` : ""}
        ${deal.unitText ? `<p class="limit">${deal.unitText}</p>` : ""}
        <p class="validity">Valido: ${formatDate(deal.validFrom)} ate ${formatDate(deal.validUntil)}</p>
        <a href="${deal.sourceUrl}" target="_blank" rel="noreferrer">Abrir fonte <span aria-hidden="true">→</span></a>
      </div>
    </div>
  `;
  document.body.append(dialog);
  dialog.querySelector("button")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
}

loadDeals()
  .then((deals) => {
    allDeals = deals;
    render();
  })
  .catch((error: unknown) => {
    app.innerHTML = `<p class="empty">Nao foi possivel carregar as ofertas.</p>`;
    console.error(error);
  });
