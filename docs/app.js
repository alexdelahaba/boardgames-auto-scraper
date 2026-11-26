const OWNER = 'alexdelahaba';
const REPOSITORY = 'boardgames-auto-scraper';
const BRANCH = 'master';
const WORKFLOW = 'consultar-ofertas-pages.yml';
const API_ROOT = `https://api.github.com/repos/${OWNER}/${REPOSITORY}`;
const RUN_TITLE_PREFIX = 'Consulta ';
const RUN_TIMEOUT_MS = 5 * 60 * 1000;

const form = document.querySelector('#check-form');
const tokenInput = document.querySelector('#github-token');
const button = document.querySelector('#check-button');
const statusText = document.querySelector('#status');
const actionsLink = document.querySelector('#actions-link');
const resultsSection = document.querySelector('#results');
const summary = document.querySelector('#summary');
const productsList = document.querySelector('#products');

function setStatus(message) {
  statusText.textContent = message;
}

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('GitHub devolvió una respuesta JSON no válida.');
    }

    throw error;
  }
}

async function githubRequest(url, token, options) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...githubHeaders(token),
      ...(options && options.headers),
    },
  });

  if (response.status === 204) {
    return null;
  }

  const data = await readJsonResponse(response);
  if (!response.ok) {
    const message = typeof data.message === 'string'
      ? data.message
      : `HTTP ${response.status}`;
    throw new Error(`GitHub API: ${message}`);
  }

  return data;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function dispatchCheck(token, requestId) {
  const url = `${API_ROOT}/actions/workflows/${WORKFLOW}/dispatches`;
  await githubRequest(url, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ref: BRANCH,
      inputs: { request_id: requestId },
    }),
  });
}

async function waitForCheck(token, requestId) {
  const url = new URL(`${API_ROOT}/actions/workflows/${WORKFLOW}/runs`);
  url.searchParams.set('event', 'workflow_dispatch');
  url.searchParams.set('branch', BRANCH);
  url.searchParams.set('per_page', '20');
  const expectedTitle = `${RUN_TITLE_PREFIX}${requestId}`;
  const deadline = Date.now() + RUN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const data = await githubRequest(url, token);
    const run = data.workflow_runs.find(
      (candidate) => candidate.display_title === expectedTitle,
    );

    if (run && run.status === 'completed') {
      if (run.conclusion !== 'success') {
        actionsLink.href = run.html_url;
        actionsLink.hidden = false;
        throw new Error(`La consulta terminó con estado «${run.conclusion}».`);
      }

      return;
    }

    setStatus('Consulta en marcha; esperando el resultado…');
    await wait(3000);
  }

  actionsLink.hidden = false;
  throw new Error('La consulta tarda demasiado. Revisa su estado en GitHub Actions.');
}

async function fetchResult(requestId) {
  const resultUrl = new URL(
    `results/${encodeURIComponent(requestId)}.json`,
    document.baseURI,
  );
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const response = await fetch(`${resultUrl}?t=${Date.now()}`, {
      cache: 'no-store',
    });

    if (response.ok) {
      const result = await readJsonResponse(response);
      if (result.requestId === requestId && Array.isArray(result.products)) {
        return result;
      }
    } else if (response.status !== 404) {
      throw new Error(`No se pudo leer el resultado (HTTP ${response.status}).`);
    }

    await wait(2000);
  }

  throw new Error('El resultado aún no aparece publicado en GitHub Pages.');
}

function renderResults(result) {
  productsList.replaceChildren();
  const checkedAt = new Date(result.checkedAt).toLocaleString('es-ES');
  summary.textContent = result.products.length === 0
    ? `No hay novedades respecto al JSON de referencia. Comprobado: ${checkedAt}.`
    : `${result.products.length} novedad(es) disponible(s). Comprobado: ${checkedAt}.`;

  for (const product of result.products) {
    const item = document.createElement('li');
    item.className = 'product';

    let url;
    try {
      url = new URL(product.url);
    } catch {
      url = null;
    }

    if (url && url.protocol === 'https:' && url.hostname === 'tienda.malditogames.com') {
      const link = document.createElement('a');
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = product.name;
      item.append(link);
    } else {
      const name = document.createElement('strong');
      name.textContent = product.name;
      item.append(name);
    }

    const price = document.createElement('p');
    price.textContent = Number.isFinite(product.priceEUR)
      ? new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
      }).format(product.priceEUR)
      : 'Precio no disponible';
    item.append(price);

    if (Number.isFinite(product.discountPercent) && product.discountPercent > 0) {
      const discount = document.createElement('p');
      discount.textContent = `Descuento: ${product.discountPercent}%`;
      item.append(discount);
    }

    productsList.append(item);
  }

  resultsSection.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const token = tokenInput.value.trim();
  tokenInput.value = '';
  if (!token) {
    setStatus('Introduce un Fine-grained PAT para iniciar la consulta.');
    return;
  }

  button.disabled = true;
  actionsLink.hidden = true;
  resultsSection.hidden = true;
  setStatus('Iniciando consulta…');

  try {
    const requestId = crypto.randomUUID();
    await dispatchCheck(token, requestId);
    await waitForCheck(token, requestId);
    const result = await fetchResult(requestId);
    renderResults(result);
    setStatus('Consulta completada.');
  } catch (error) {
    setStatus(error.message);
  } finally {
    button.disabled = false;
  }
});
