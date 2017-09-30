const Nightmare = require('nightmare');

//this is all the runner code. Rest is function definitions
var scp = scpHolder(process.argv.slice(-1)).then(prettyPrint);

//Main function. Gets a piece of the info, updates the console with a
//progress log, and returns all the information at the end
async function scpHolder(number) {
  updateProgress('Instantiating Nightmare');
  var nightmare = Nightmare({ show: false });
  var result = {};

  updateProgress('Navigating to page');
  await nightmare.goto('http://www.scp-wiki.net/scp-' + number);

  updateProgress('Copying page content');
  result.page = await getCurrentPageContent(nightmare);

  updateProgress('Copying page rating');
  result.rating = await getCurrentPageRating(nightmare);

  updateProgress('Loading page raters');
  result.raters = await getCurrentPageRaters(nightmare);

  updateProgress('Loading discussion posts');
  result.discussion = await getCurrentPageDiscussions(nightmare);

  updateProgress('Finishing up');
  await nightmare.end();
  return result;
}

function prettyPrint(obj) {
  console.log(JSON.stringify(obj, null, 4));
}

function updateProgress(msg, cur = 0, max = 1) {
  var stream = process.stdout;
  var str = msg + '...';
  stream.cursorTo(0);
  stream.write(str);
  stream.clearLine(1);
}

async function getCurrentPageContent(nightmare) {
  return await nightmare.evaluate(
    () => document.getElementById('page-content').innerHTML
  );
}

async function getCurrentPageRating(nightmare) {
  return await nightmare.evaluate(() =>
    document.querySelector('#pagerate-button').innerText.slice(6, -1)
  );
}

async function getCurrentPageRaters(nightmare) {
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

  return raters;
}

async function getCurrentPageDiscussions(nightmare) {
  var discussion = await nightmare
    .click('#discuss-button')
    .wait('#thread-container-posts')
    .evaluate(getDiscussionPosts);

  while (
    await nightmare.evaluate(() =>
      document.querySelector('#thread-container-posts .pager span:last-child a')
    )
  ) {
    discussion = discussion.concat(
      await nightmare
        .click('#thread-container-posts .pager span:last-child a')
        .wait(500)
        .evaluate(getDiscussionPosts)
    );
  }

  return discussion;
}

function getDiscussionPosts() {
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
