const books = [
  {
    id: "book1",
    title: "Book 1",
    author: "",
    category: "Computer Science",
    pdf: "./pdfs/comp%20(1).pdf"
  },

  {
    id: "book2",
    title: "Book 2",
    author: "",
    category: "Computer Science",
    pdf: "./pdfs/comp%20(2).pdf"
  },

  {
    id: "book3",
    title: "Book 3",
    author: "",
    category: "Computer Science",
    pdf: "./pdfs/comp%20(3).pdf"
  },

  {
    id: "book4",
    title: "Book 4",
    author: "",
    category: "Computer Science",
    pdf: "./pdfs/comp%20(4).pdf"
  },

  {
    id: "book5",
    title: "Book 5",
    author: "",
    category: "Computer Science",
    pdf: "./pdfs/comp%20(5).pdf"
  },

  {
    id: "book6",
    title: "Book 6",
    author: "",
    category: "Computer Science",
    pdf: "./pdfs/comp%20(6).pdf"
  },

  {
    id: "book7",
    title: "Book 7",
    author: "",
    category: "Computer Science",
    pdf: "./pdfs/comp%20(7).pdf"
  },

  {
    id: "book8",
    title: "Book 8",
    author: "",
    category: "Computer Science",
    pdf: "./pdfs/comp%20(8).pdf"
  },

  {
    id: "book9",
    title: "Book 9",
    author: "",
    category: "Computer Science",
    pdf: "./pdfs/comp%20(9).pdf"
  },

  {
    id: "book10",
    title: "Book 10",
    author: "",
    category: "Computer Science",
    pdf: "./pdfs/comp%20(10).pdf"
  },

  {
    id: "book11",
    title: "Book 11",
    author: "",
    category: "Computer Science",
    pdf: "./pdfs/comp%20(11).pdf"
  },

  {
    id: "book12",
    title: "Book 12",
    author: "",
    category: "Computer Science",
    pdf: "./pdfs/comp%20(12).pdf"
  },

  {
    id: "book13",
    title: "Book 13",
    author: "",
    category: "Computer Science",
    pdf: "./pdfs/comp%20(13).pdf"
  },

  {
    id: "book14",
    title: "Book 14",
    author: "",
    category: "Computer Science",
    pdf: "./pdfs/comp%20(14).pdf"
  }
];


const bookGrid = document.getElementById("bookGrid");

const libraryView =
  document.getElementById("libraryView");

const readerView =
  document.getElementById("readerView");

const pdfViewer =
  document.getElementById("pdfViewer");

const closeReader =
  document.getElementById("closeReader");

const readerBookTitle =
  document.getElementById("readerBookTitle");

const readerBookAuthor =
  document.getElementById("readerBookAuthor");

const downloadPdf =
  document.getElementById("downloadPdf");

const searchInput =
  document.getElementById("searchInput");

const bookCount =
  document.getElementById("bookCount");


function renderBooks(list) {

  bookGrid.innerHTML = "";

  bookCount.textContent =
    `${list.length} book${list.length === 1 ? "" : "s"}`;

  list.forEach(book => {

    const card = document.createElement("article");

    card.className = "book-card";

    card.innerHTML = `

      <div class="book-icon">
        📖
      </div>

      <h2 class="book-title">
        ${book.title}
      </h2>

      <div class="book-author">
        ${book.author}
      </div>

      <div class="book-category">
        ${book.category}
      </div>

      <div class="book-actions">

        <button
          class="book-button primary"
          data-book-id="${book.id}"
        >
          Read
        </button>

        <a
          class="book-button"
          href="${book.pdf}"
          download
        >
          PDF ↓
        </a>

      </div>

    `;

    bookGrid.appendChild(card);

  });


  document
    .querySelectorAll("[data-book-id]")
    .forEach(button => {

      button.addEventListener("click", () => {

        const book = books.find(
          b => b.id === button.dataset.bookId
        );

        openBook(book);

      });

    });

}


function openBook(book) {

  readerBookTitle.textContent =
    book.title;

  readerBookAuthor.textContent =
    book.author;

  downloadPdf.href =
    book.pdf;

  /*
     Loading the .pdf directly invokes
     the browser's built-in PDF reader.
  */

  pdfViewer.src =
    `${book.pdf}#view=FitH`;

  libraryView.classList.add("hidden");

  readerView.classList.remove("hidden");

  document.body.style.overflow =
    "hidden";

}


function closeBook() {

  readerView.classList.add("hidden");

  libraryView.classList.remove("hidden");

  pdfViewer.src = "";

  document.body.style.overflow = "";

}


closeReader.addEventListener(
  "click",
  closeBook
);


searchInput.addEventListener("input", () => {

  const query =
    searchInput.value
      .toLowerCase()
      .trim();

  const filtered = books.filter(book => {

    return (

      book.title
        .toLowerCase()
        .includes(query)

      ||

      book.author
        .toLowerCase()
        .includes(query)

      ||

      book.category
        .toLowerCase()
        .includes(query)

    );

  });

  renderBooks(filtered);

});


renderBooks(books);