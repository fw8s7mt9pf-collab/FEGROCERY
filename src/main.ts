import "./styles.css";
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
let stopHeroPlasma: (() => void) | undefined;

const plasmaVertexShader = `
  attribute vec2 a_position;
  void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const plasmaFragmentShader = `
  precision mediump float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_dark;

  vec3 palette(float value) {
    vec3 deepForest = vec3(0.035, 0.15, 0.075);
    vec3 forest = vec3(0.07, 0.29, 0.13);
    vec3 leaf = vec3(0.42, 0.64, 0.30);
    vec3 paper = vec3(0.96, 0.91, 0.70);
    vec3 shadow = vec3(0.015, 0.08, 0.04);
    vec3 color = mix(deepForest, forest, smoothstep(0.12, 0.5, value));
    color = mix(color, leaf, smoothstep(0.52, 0.86, value) * 0.36);
    color = mix(color, paper, smoothstep(0.87, 1.0, value) * 0.18);
    return mix(color, shadow, u_dark * 0.44);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float time = u_time * 0.15;
    float field = sin(p.x * 4.1 + time)
      + sin(p.y * 3.4 - time * 0.7)
      + sin((p.x + p.y) * 2.8 + time * 0.5)
      + sin(length(p) * 5.0 - time);
    float value = 0.5 + 0.5 * sin(field);
    float vignette = 1.0 - 0.32 * smoothstep(0.25, 1.05, length(uv - 0.5));
    gl_FragColor = vec4(palette(value) * vignette, 1.0);
  }
`;

function startHeroPlasma(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext("webgl", { alpha: false });
  if (!context) return () => undefined;

  const compile = (type: number, source: string): WebGLShader | undefined => {
    const shader = context.createShader(type);
    if (!shader) return undefined;
    context.shaderSource(shader, source);
    context.compileShader(shader);
    return context.getShaderParameter(shader, context.COMPILE_STATUS) ? shader : undefined;
  };
  const vertex = compile(context.VERTEX_SHADER, plasmaVertexShader);
  const fragment = compile(context.FRAGMENT_SHADER, plasmaFragmentShader);
  if (!vertex || !fragment) return () => undefined;
  const program = context.createProgram();
  if (!program) return () => undefined;
  context.attachShader(program, vertex);
  context.attachShader(program, fragment);
  context.linkProgram(program);
  if (!context.getProgramParameter(program, context.LINK_STATUS)) return () => undefined;

  const buffer = context.createBuffer();
  const position = context.getAttribLocation(program, "a_position");
  const resolution = context.getUniformLocation(program, "u_resolution");
  const time = context.getUniformLocation(program, "u_time");
  const dark = context.getUniformLocation(program, "u_dark");
  if (!buffer || position < 0 || !resolution || !time || !dark) return () => undefined;
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), context.STATIC_DRAW);

  let frame = 0;
  const draw = (milliseconds: number): void => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
    const height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.viewport(0, 0, width, height);
    context.useProgram(program);
    context.enableVertexAttribArray(position);
    context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);
    context.uniform2f(resolution, width, height);
    context.uniform1f(time, milliseconds / 1000);
    context.uniform1f(dark, selectedTheme === "dark" ? 1 : 0);
    context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
    frame = window.requestAnimationFrame(draw);
  };
  frame = window.requestAnimationFrame(draw);
  return () => window.cancelAnimationFrame(frame);
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
  stopHeroPlasma?.();
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
    <section class="hero">
      <canvas class="hero-plasma" aria-hidden="true"></canvas>
      <button class="sky-toggle" id="theme-toggle" type="button" role="switch" aria-checked="${selectedTheme === "dark"}" aria-label="Alternar tema claro e escuro">
        <span class="sky-clouds" aria-hidden="true"></span>
        <span class="sky-stars" aria-hidden="true">✦ &nbsp;✦</span>
        <span class="sky-thumb" aria-hidden="true"><span class="sky-sun"></span><span class="sky-moon"></span></span>
      </button>
      <div class="hero-copy">
        <h1>Ofertas em</h1>
        <p class="eyebrow">Camaqua, Rio Grande do Sul</p>
        <p class="hero-description">Descontos ativos nos mercados da cidade.</p>
        <p class="refresh">Atualizado automaticamente 2-3 vezes por dia</p>
      </div>
      <div class="hero-mark" aria-hidden="true">
        <span>✦</span>
        <small>DE OLHO<br>NO PRECO</small>
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

  const plasmaCanvas = app.querySelector<HTMLCanvasElement>(".hero-plasma");
  if (plasmaCanvas) stopHeroPlasma = startHeroPlasma(plasmaCanvas);

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
