const Nightmare = require('nightmare');

async function scpHolder(number) {
  var nightmare = Nightmare({ show: false });

  var page = await nightmare
    .goto('http://www.scp-wiki.net/scp-' + number)
    .evaluate(() => document.getElementById('page-content').innerHTML);

  var rating = await nightmare.evaluate(() =>
    document.querySelector('#pagerate-button').innerText.slice(6, -1)
  );

  var rawraters = await nightmare
    .click('#pagerate-button')
    .wait('#action-area p a')
    .evaluate(async function makeRatersCall() {
      var cb;
      var promise = new Promise(function(resolve, reject) {
        cb = arg => resolve(arg);
      });

      var b = new Object();
      b.pageId = WIKIREQUEST.info.pageId;

      OZONE.ajax.requestModule('pagerate/WhoRatedPageModule', b, cb);

      var result = await promise;

      return result;
    });

  var re = /\((\d+)\);\s+return false;"\s+>([\w-\s]+)<\/a><\/span>\n\s+<span style="color:#777">\n\s+(\+|-)/gi,
    mymatch,
    raters = [];
  while ((mymatch = re.exec(rawraters.body))) {
    [_, id, name, rating] = mymatch;
    raters.push({ id, name, rating: rating === '+' ? 1 : -1 });
  }

  var discussion = await nightmare
    .click('#discuss-button')
    .wait('#thread-container-posts')
    .evaluate(getPosts);

  while (
    await nightmare.evaluate(() =>
      document.querySelector('#thread-container-posts .pager span:last-child a')
    )
  ) {
    discussion = discussion.concat(
      await nightmare
        .click('#thread-container-posts .pager span:last-child a')
        .wait(500)
        .evaluate(getPosts)
    );
  }
  console.log(5);

  await nightmare.end();

  function getPosts() {
    function readPosts(node) {
      var id = node.id.slice(4);
      var title = node.querySelector('#post-title-' + id).innerText;
      var body = node.querySelector('#post-content-' + id).innerText.trim();
      var author = node.querySelector('.printuser').innerText;
      var date = node.querySelector('.odate').innerText;

      var children = Array.from(node.children).slice(1).map(readPosts);
      return { id, title, author, date, body, children };
    }

    return Array.from(
      document.querySelectorAll('#thread-container-posts > .post-container')
    ).map(readPosts);
  }
  return { page, rating, raters, discussion };
}

function prettyPrint(obj) {
  console.log(JSON.stringify(obj, null, 4));
}

var scp = scpHolder(process.argv.slice(-1)).then(prettyPrint);
