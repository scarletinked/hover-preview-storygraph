(() => {
  const HOVER_DELAY_MS = 500;
  const BOOK_ANCHOR_SELECTOR = 'a[href^="/books/"]';

  const cache = new Map(); // bookId -> { title, description, ratingScore, ratingCount, error }
  const inFlight = new Map(); // bookId -> Promise

  let currentAnchor = null;
  let hoverTimer = null;
  let lastMouseEvent = null;

  const popup = document.createElement('div');
  popup.id = 'sg-hover-popup';
  popup.setAttribute('aria-hidden', 'true');

  function ensurePopupMounted() {
    if (!popup.isConnected) {
      document.body.appendChild(popup);
    }
  }

  function getBookId(anchor) {
    let pathname;
    try {
      pathname = new URL(anchor.href, location.href).pathname;
    } catch {
      return null;
    }
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length !== 2 || segments[0] !== 'books') return null;
    return segments[1];
  }

  function isCoverAnchor(anchor) {
    return !!anchor && !!anchor.querySelector('img') && !!getBookId(anchor);
  }

  function positionPopup(x, y) {
    const margin = 12;
    const rect = { width: 320, height: popup.offsetHeight || 200 };
    let left = x + margin;
    let top = y + margin;

    if (left + rect.width > window.innerWidth - margin) {
      left = x - rect.width - margin;
    }
    if (left < margin) left = margin;

    if (top + rect.height > window.innerHeight - margin) {
      top = window.innerHeight - rect.height - margin;
    }
    if (top < margin) top = margin;

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  }

  function renderLoading(title) {
    popup.innerHTML = `
      <div class="sg-title"></div>
      <div class="sg-status">Loading…</div>
    `;
    popup.querySelector('.sg-title').textContent = title || '';
  }

  function renderResult(data) {
    const titleHtml = `<div class="sg-title"></div>`;
    const genresHtml = data.genres && data.genres.length ? `<div class="sg-genres"></div>` : '';
    let ratingHtml = '';
    if (data.ratingScore) {
      ratingHtml = `
        <div class="sg-rating">
          <span>${data.ratingScore} / 5</span>
          <span class="sg-rating-count">${data.ratingCount ? `based on ${data.ratingCount} reviews` : ''}</span>
        </div>`;
    } else {
      ratingHtml = `<div class="sg-status">No community rating yet</div>`;
    }

    let descHtml = '';
    if (data.description) {
      descHtml = `<div class="sg-description"></div>`;
    } else if (!data.error) {
      descHtml = `<div class="sg-status">No description available</div>`;
    }

    if (data.error) {
      popup.innerHTML = `${titleHtml}<div class="sg-status">Couldn't load details</div>`;
    } else {
      popup.innerHTML = `${titleHtml}${genresHtml}${ratingHtml}${descHtml}`;
      if (genresHtml) {
        const genresEl = popup.querySelector('.sg-genres');
        data.genres.forEach((genre) => {
          const tag = document.createElement('span');
          tag.className = 'sg-genre-tag';
          tag.textContent = genre;
          genresEl.appendChild(tag);
        });
      }
      if (data.description) {
        popup.querySelector('.sg-description').textContent = data.description;
      }
    }
    popup.querySelector('.sg-title').textContent = data.title || '';
  }

  function showPopup() {
    ensurePopupMounted();
    requestAnimationFrame(() => popup.classList.add('sg-visible'));
  }

  function hidePopup() {
    popup.classList.remove('sg-visible');
  }

  function clearHoverTimer() {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  }

  async function fetchBookData(bookId) {
    if (cache.has(bookId)) return cache.get(bookId);
    if (inFlight.has(bookId)) return inFlight.get(bookId);

    const promise = (async () => {
      try {
        const [bookHtml, reviewsHtml] = await Promise.all([
          fetch(`https://app.thestorygraph.com/books/${bookId}`, { credentials: 'include' }).then((r) => r.text()),
          fetch(`https://app.thestorygraph.com/books/${bookId}/community_reviews`, { credentials: 'include' }).then((r) => r.text()),
        ]);

        const bookDoc = new DOMParser().parseFromString(bookHtml, 'text/html');
        const reviewsDoc = new DOMParser().parseFromString(reviewsHtml, 'text/html');

        let descriptionEl = bookDoc.querySelector('.blurb-pane .trix-content');
        if (!descriptionEl) {
          const heading = [...bookDoc.querySelectorAll('h3,h4')].find(
            (h) => h.textContent.trim() === 'Description'
          );
          descriptionEl = heading && heading.parentElement.querySelector('.trix-content');
        }
        const description = descriptionEl ? descriptionEl.textContent.trim() : null;

        const genreEls = bookDoc.querySelectorAll('.book-page-tag-section span[class*="text-teal-700"]');
        const genres = [...new Set([...genreEls].map((el) => el.textContent.trim()).filter(Boolean))];

        let ratingScore = null;
        let ratingCount = null;
        const ratingEl = reviewsDoc.querySelector('[aria-label*="Book rating"]');
        if (ratingEl) {
          const match = ratingEl
            .getAttribute('aria-label')
            .match(/Book rating:\s*([\d.]+)\s*out of\s*5\s*stars(?:\s*based on\s*([\d,]+)\s*reviews?)?/i);
          if (match) {
            ratingScore = match[1];
            ratingCount = match[2] || null;
          }
        }

        const result = { description, genres, ratingScore, ratingCount, error: false };
        cache.set(bookId, result);
        return result;
      } catch (err) {
        const result = { error: true };
        cache.set(bookId, result);
        return result;
      } finally {
        inFlight.delete(bookId);
      }
    })();

    inFlight.set(bookId, promise);
    return promise;
  }

  async function triggerPopup(anchor) {
    const bookId = getBookId(anchor);
    if (!bookId) return;

    const img = anchor.querySelector('img');
    const title = img ? img.alt : '';

    renderLoading(title);
    if (lastMouseEvent) positionPopup(lastMouseEvent.clientX, lastMouseEvent.clientY);
    showPopup();

    const data = await fetchBookData(bookId);

    if (currentAnchor !== anchor) return; // mouse moved away before data arrived

    renderResult({ title, ...data });
    if (lastMouseEvent) positionPopup(lastMouseEvent.clientX, lastMouseEvent.clientY);
  }

  document.addEventListener(
    'mouseover',
    (e) => {
      const anchor = e.target.closest && e.target.closest(BOOK_ANCHOR_SELECTOR);
      if (!anchor || !isCoverAnchor(anchor) || anchor === currentAnchor) return;

      clearHoverTimer();
      currentAnchor = anchor;
      lastMouseEvent = e;
      hoverTimer = setTimeout(() => triggerPopup(anchor), HOVER_DELAY_MS);
    },
    true
  );

  document.addEventListener(
    'mousemove',
    (e) => {
      if (currentAnchor) lastMouseEvent = e;
    },
    true
  );

  document.addEventListener(
    'mouseout',
    (e) => {
      const anchor = e.target.closest && e.target.closest(BOOK_ANCHOR_SELECTOR);
      if (!anchor || anchor !== currentAnchor) return;
      if (anchor.contains(e.relatedTarget)) return;

      clearHoverTimer();
      currentAnchor = null;
      hidePopup();
    },
    true
  );

  window.addEventListener('scroll', () => {
    clearHoverTimer();
    currentAnchor = null;
    hidePopup();
  }, true);
})();
