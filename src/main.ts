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
  Bakery: "Padaria",
  Frozen: "Congelados",
  Other: "Outros",
};

let allDeals: Deal[] = [];
let selectedCategory: "All" | Category = "All";
let selectedSupermarket = "All";

async function loadDeals(): Promise<Deal[]> {
  let response = await fetch("./data/deals.json");
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

function render(): void {
  const supermarkets = getSupermarkets(allDeals);
  const deals = getCurrentDeals(allDeals, {
    category: selectedCategory,
    supermarket: selectedSupermarket,
    now: new Date(),
  });

  app.innerHTML = `
    <section class="topbar">
      <div>
        <p class="eyebrow">Camaqua / RS</p>
        <h1>Ofertas de mercado</h1>
      </div>
      <p class="refresh">Atualizado automaticamente 2-3 vezes por dia</p>
    </section>

    <section class="filters" aria-label="Filtros">
      <div class="filter-group" data-filter="category">
        <button class="${selectedCategory === "All" ? "active" : ""}" data-category="All">Todas</button>
        ${categories
          .map(
            (category) =>
              `<button class="${selectedCategory === category ? "active" : ""}" data-category="${category}">${categoryLabels[category]}</button>`,
          )
          .join("")}
      </div>
      <label>
        Mercado
        <select id="supermarket-filter">
          <option value="All">Todos</option>
          ${supermarkets
            .map(
              (supermarket) =>
                `<option value="${supermarket}" ${selectedSupermarket === supermarket ? "selected" : ""}>${supermarket}</option>`,
            )
            .join("")}
        </select>
      </label>
    </section>

    <section class="summary" aria-live="polite">
      <strong>${deals.length}</strong> ofertas atuais
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
                      <p class="validity">Valido: ${formatDate(deal.validFrom)} ate ${formatDate(deal.validUntil)}</p>
                      ${deal.warning ? `<p class="warning">${deal.warning}</p>` : ""}
                      <a href="${deal.sourceUrl}" target="_blank" rel="noreferrer">Fonte</a>
                    </div>
                  </article>
                `,
              )
              .join("")
          : `<p class="empty">Nenhuma oferta atual encontrada para estes filtros.</p>`
      }
    </section>
  `;

  app.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((button: HTMLButtonElement) => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category as "All" | Category;
      render();
    });
  });

  app.querySelector<HTMLSelectElement>("#supermarket-filter")?.addEventListener("change", (event: Event) => {
    selectedSupermarket = (event.target as HTMLSelectElement).value;
    render();
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
    <img src="${deal.imageUrl}" alt="${deal.title}">
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
