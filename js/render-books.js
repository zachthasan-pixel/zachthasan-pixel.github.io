/* ============================================================
   BOOK CARD RENDERER
   ------------------------------------------------------------
   This turns the plain lists in books-data.js into the actual
   book cards you see on the site. You shouldn't need to touch
   this file — if you want to change what shows up, edit
   books-data.js instead.
   ============================================================ */

// A cover picture box, used whenever a book has an "image" set.
function coverBoxHTML(book) {
  if (!book.image) return '';
  return `<div class="book-cover"><img src="${book.image}" alt="${book.title} cover" loading="lazy"></div>`;
}

function seriesCardHTML(book) {
  const cover = book.image
    ? coverBoxHTML(book)
    : `
      <div class="book-cover ${book.cover || ''}">
        <div class="book-cover-inner">
          <div class="book-cover-title">${book.title}</div>
          <div class="book-cover-sub">${book.subtitle || ''}</div>
        </div>
      </div>`;
  return `
    <article class="book-card">
      ${cover}
      <div class="book-body">
        <div class="book-meta">${book.category || ''}</div>
        <h3>${book.title}</h3>
        <p>${book.description || ''}</p>
        <div class="book-footer">
          <span class="status-pill ${book.badge && book.badge.toLowerCase().includes('available') ? 'available' : ''}">${book.badge || ''}</span>
          <a href="${book.url}" class="btn btn-primary" style="padding: 0.55rem 1.1rem; font-size: 0.85rem;">${book.urlLabel || 'View Series'}</a>
        </div>
      </div>
    </article>`;
}

function bookCardHTML(book) {
  const cover = coverBoxHTML(book);
  const buyButton = book.buyUrl
    ? `<a href="${book.buyUrl}" class="btn btn-primary" style="padding: 0.55rem 1.1rem; font-size: 0.85rem;" target="_blank" rel="noopener">${book.buyLabel || 'Buy on Amazon'}</a>`
    : '';
  return `
    <article class="book-card">
      ${cover}
      <div class="book-body" style="padding-top: ${book.image ? '1.5rem' : '1.75rem'};">
        <div class="book-meta">${book.category || ''}</div>
        <h3>${book.title}</h3>
        <p>${book.description || ''}</p>
        <div class="book-footer">
          <span class="status-pill ${book.badge && book.badge.toLowerCase().includes('available') ? 'available' : ''}">${book.badge || ''}</span>
          ${buyButton}
        </div>
      </div>
    </article>`;
}

// Renders a list of books/series into a container by ID.
// type is "series" or "book". limit (optional) caps how many show up.
// featuredOnly (optional) only shows entries marked featured: true.
function renderBooks(containerId, list, type, options) {
  const el = document.getElementById(containerId);
  if (!el) return;
  options = options || {};
  let items = list.slice();
  if (options.featuredOnly) items = items.filter(b => b.featured);
  if (options.limit) items = items.slice(0, options.limit);
  el.innerHTML = items.map(type === 'series' ? seriesCardHTML : bookCardHTML).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const series = window.CHILDRENS_SERIES || [];
  const kidsBooks = window.CHILDRENS_BOOKS || [];
  const politicalBooks = window.POLITICAL_BOOKS || [];

  renderBooks('childrens-series-grid', series, 'series');
  renderBooks('childrens-books-grid', kidsBooks, 'book');
  renderBooks('political-books-grid', politicalBooks, 'book');

  // Homepage teasers
  renderBooks('home-series-grid', series, 'series', { limit: 1 });
  renderBooks('home-childrens-grid', kidsBooks, 'book', { featuredOnly: true, limit: 1 });
  renderBooks('home-political-grid', politicalBooks, 'book', { featuredOnly: true, limit: 3 });
});
