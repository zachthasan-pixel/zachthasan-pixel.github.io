/* ============================================================
   BOOK LIST — Dr. Zahir Hasan's website
   ============================================================
   This is the ONE file to edit when a new book comes out, or
   when a buy link changes. Every page on the site (the homepage,
   the Children's Books page, and the Political Science page)
   reads its book list from here — so you only ever update it
   in one spot, and it shows up everywhere automatically.

   HOW TO ADD A NEW BOOK
   ----------------------
   1. Find the list it belongs in below (childrens books or
      political science books).
   2. Copy one whole block, from the opening { to the closing },
      and paste it as a new entry in that same list.
   3. Change the text inside the quotes to match the new book.
   4. To show a real cover picture, add the image file to the
      images/covers folder in the website files, then set
      image: "images/covers/your-file-name.jpg" below. Leave the
      image line out entirely if you don't have a cover yet — the
      book will just show its title and description instead.
   5. Save the file. That's it — no other page needs to change.

   Fields you can use for each book:
     title       - the book's name
     category    - a short line above the title (e.g. "Children's Picture Book")
     description - one or two sentences about the book
     image       - path to the cover picture (optional, see above)
     buyUrl      - the Amazon (or other store) link — leave as null if not for sale yet
     buyLabel    - button text, defaults to "Buy on Amazon" if left out
     badge       - the little pill/tag, e.g. "Available" or "Coming Soon"
     featured    - set to true if this book should also appear on the homepage
   ============================================================ */

// The two ongoing series (these get their own page + cover art)
const CHILDRENS_SERIES = [
  {
    title: "The Whispering Realms",
    subtitle: "Episode 1 · The First Shadow",
    image: "images/covers/whispering-realms.jpg",
    category: "Fantasy Series · Ages 7–12",
    description: "Follow young Aelira as she steps into a world where shadows begin to speak and ancient realms awaken.",
    badge: "Episode 1 Available",
    url: "whispering-realms.html",
    urlLabel: "View Series"
  },
  {
    title: "The Elk Kingdom Chronicles",
    subtitle: "Book 1 · The Silent Veil — Available Now",
    image: "images/covers/elk-kingdom.jpg",
    category: "Fantasy Series · Ages 6–11",
    description: "Deep in an ancient forest kingdom, the Silent Veil protects more than just the trees. Young Elian begins to hear what others cannot — and learns what it means to be a Listener.",
    badge: "Available",
    url: "elk-kingdom.html",
    urlLabel: "Explore the Kingdom"
  }
];

// Every individual children's book / picture book you can buy today
const CHILDRENS_BOOKS = [
  {
    title: "The First Shadow",
    category: "Fantasy · The Whispering Realms",
    description: "The opening story of The Whispering Realms. Young Aelira discovers that some shadows carry messages — and some messages change everything.",
    image: "images/covers/whispering-realms.jpg",
    badge: "Available",
    buyUrl: "https://www.amazon.co.jp/dp/B0HBCPSJ4X",
    featured: false
  },
  {
    title: "The Elk Kingdom: Book I – The Silent Veil",
    category: "Fantasy · The Elk Kingdom Chronicles",
    description: "Six-year-old Elian has always heard more than most. When the ancient pact between the Great Elk and the First Elf begins to break early, he must decide whether to answer a call that could save everything he loves.",
    image: "images/covers/elk-kingdom.jpg",
    badge: "Available",
    buyUrl: "https://www.amazon.com/dp/B0HBRTFMD7",
    featured: false
  },
  {
    title: "Aidan and the Ember Hollow",
    category: "Children's Fantasy · Book 1: The Compass Awakens",
    description: "Aidan's grandmother left him an old brass compass — dull, ordinary, easy to forget. Until the day it starts to hum. A warm, wonder-filled adventure about friendship, hidden gifts, and the courage to step through the door nobody else can see.",
    image: "images/covers/aidan-ember-hollow.jpg",
    badge: "Available",
    buyUrl: "https://www.amazon.com/dp/B0HBNG3HZ6",
    featured: false
  },
  {
    title: "Tasneem's Glider",
    category: "Children's Picture Book",
    description: "How Persistence Found the Wind. A story about Tasneem, her glider, and the power of not giving up.",
    image: "images/covers/tasneems-glider.jpg",
    badge: "Available",
    buyUrl: "https://www.amazon.co.jp/dp/B0H9CQF2D7",
    featured: true
  },
  {
    title: "Aidan and the Butterfly Kingdom",
    category: "Children's Picture Book",
    description: "A Kingdom of Dreamo Story. Young Aidan steps into a magical butterfly kingdom full of wonder and discovery.",
    image: "images/covers/aidan-butterfly-kingdom.jpg",
    badge: "Available",
    buyUrl: "https://www.amazon.co.jp/dp/B0H956VRZD",
    featured: false
  },
  {
    title: "Maz and the Map of Whispering Stars",
    category: "Children's Picture Book",
    description: "A story of maps, stars, and the quiet magic of finding your way.",
    image: "images/covers/maz-whispering-stars.jpg",
    badge: "Available",
    buyUrl: "https://www.amazon.co.jp/dp/B0HB62P7NN",
    featured: false
  },
  {
    title: "The Little Robo",
    category: "Children's Picture Book",
    description: "A gentle story about a small robot and the big feelings that come with growing and belonging.",
    image: "images/covers/little-robo.jpg",
    badge: "Available",
    buyUrl: "https://www.amazon.co.jp/dp/B0H8XV9SHK",
    featured: false
  },
  {
    title: "The Code of the Cosmic Compass",
    category: "Children's Adventure",
    description: "An M1Z3 Adventure. A cosmic journey of codes, compasses, and courage.",
    image: "images/covers/cosmic-compass.jpg",
    badge: "Available",
    buyUrl: "https://www.amazon.co.jp/dp/B0HBMQ9MQ9",
    featured: false
  },
  {
    title: "Dash and the Morning Spark",
    category: "Children's Picture Book",
    description: "A bright morning story about energy, movement, and starting the day with heart.",
    image: "images/covers/dash-morning-spark.jpg",
    badge: "Available",
    buyUrl: "https://www.amazon.co.jp/dp/B0H9HWWKB3",
    featured: false
  },
  {
    title: "The Spiderweb Mystery",
    category: "Children's Picture Book",
    description: "Curiosity is a Superpower. A gentle mystery that celebrates asking questions and looking closer.",
    image: "images/covers/spiderweb-mystery.jpg",
    badge: "Available",
    buyUrl: "https://www.amazon.co.jp/dp/B0H9HJF5P2",
    featured: false
  }
];

// Political science, law & social issues books
const POLITICAL_BOOKS = [
  {
    title: "The Permanent Suspect",
    category: "Political Science / Law",
    description: "An examination of how suspicion becomes permanent — and what that means for justice, identity, and the state.",
    image: "images/covers/permanent-suspect.jpg",
    badge: "Available",
    buyUrl: "https://www.amazon.co.jp/dp/B0HBLT47RP",
    featured: true
  },
  {
    title: "A Manufactured War",
    category: "Political Science / International Relations",
    description: "How conflicts are constructed, sustained, and sold — and who benefits from the stories we are told about war.",
    image: "images/covers/manufactured-war.jpg",
    badge: "Available",
    buyUrl: "https://www.amazon.co.jp/dp/B0H9J8XMFW",
    featured: true
  },
  {
    title: "The Sovereignty of Truth",
    category: "Political Philosophy",
    description: "On the struggle between power and truth, and why the right to define reality has become one of the central battles of our time.",
    image: "images/covers/sovereignty-of-truth.jpg",
    badge: "Available",
    buyUrl: "https://www.amazon.co.jp/dp/B0HB4JY8P9",
    featured: true
  },
  {
    title: "The Politics of Removal",
    category: "Political Science / Social Issues",
    description: "An inquiry into displacement, exclusion, and the political logic that decides who belongs and who is removed.",
    image: "images/covers/politics-of-removal.jpg",
    badge: "Available",
    buyUrl: "https://www.amazon.co.jp/dp/B0H9SKQRPC",
    featured: false
  },
  {
    title: "Japan's Strategic Awakening",
    category: "International Relations / Strategy",
    description: "Law, Capability, and the Realignment of Indo-Pacific Security. An analysis of Japan's evolving security posture and the strategic choices reshaping the Indo-Pacific.",
    image: "images/covers/japans-strategic-awakening.jpg",
    badge: "Available",
    buyUrl: "https://www.amazon.co.jp/dp/B0H9X5HM5L",
    featured: false
  },
  {
    title: "The Arab Dilemma",
    category: "Political Science / International Relations",
    description: "Gaza, Atrocity, and the Politics of Abandonment After October 7. Drawing on international law, diplomatic history, and the shifting politics of the Middle East, this book traces why Arab governments and the wider international community largely stood aside as the war in Gaza unfolded.",
    image: "images/covers/arab-dilemma.jpg",
    badge: "Available",
    buyUrl: "https://www.amazon.com/dp/B0HDPS31RK",
    featured: false
  }
];

// Make these lists available to render-books.js no matter how the
// scripts get loaded on the page.
window.CHILDRENS_SERIES = CHILDRENS_SERIES;
window.CHILDRENS_BOOKS = CHILDRENS_BOOKS;
window.POLITICAL_BOOKS = POLITICAL_BOOKS;
