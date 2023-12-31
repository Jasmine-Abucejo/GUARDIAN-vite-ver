import * as toxicity from "@tensorflow-models/toxicity";
import nlp from "compromise";
import { badWords } from "./profanity.js";

// Create a regular expression pattern for matching profanity words
chrome.runtime.sendMessage({ action: "getBlockSites" }, (toBlockSites) => {
  const currentUrl = window.location.href;
  if (toBlockSites.some((site) => currentUrl.includes(site))) {
    console.log(window.location.href);
    window.location.href = "about:blank";
  }
});
const profanityPattern = `(${badWords
  .map((word) => word.replace(/[-/\\^$*+?.()|[\]{}]/gi, "\\$&"))
  .join("|")})`;
let tweets = null;
// The minimum prediction confidence.
const threshold = 0.9;

// Which toxicity labels to return.
// Remove the unused variable
// const labelsToInclude = ["identity_attack", "insult", "threat", "toxicity"];
toxicity.load(threshold).then((model) => {
  chrome.runtime.sendMessage({ action: "getFilterSites" }, (toFilterSites) => {
    const currentUrl = window.location.href;
    if (toFilterSites.some((site) => currentUrl.includes(site))) {
      console.log("true");

      // document.addEventListener("DOMContentLoaded", processTweets);

      // If DOMContentLoaded has alreadcurredy oc, execute the logic immediately
      if (
        document.readyState === "complete" ||
        document.readyState === "interactive"
      ) {
        const interval = setInterval(() => {
          if (
            document.querySelector('[data-testid = "cellInnerDiv"]')
              ?.parentElement
          ) {
            console.log("ready...");
            clearInterval(interval);
            processTweets();
          }
        }, 100);
      }
    }
  });
  function processTweets() {
    console.log("started");
    let targetNode = document.querySelector(
      '[data-testid = "cellInnerDiv"]'
    ).parentElement;

    console.log(targetNode);

    // Options for the observer (which mutations to observe)
    const config = { attributes: true, childList: true, subtree: true };

    // Callback function to execute when mutations are observed
    const callback = (mutationList, observer) => {
      for (const mutation of mutationList) {
        if (mutation.type === "childList") {
          console.log("A child node has been added or removed.");
          tweets = document.querySelectorAll('[dir = "auto"]');

          // console.log(tweets);
        }
      }
      // console.log(tweets);

      if (tweets && tweets?.length < 100000 && tweets?.length > 0) {
        observer.disconnect();
        [...tweets].forEach(async (tweet) => {
          var xpathExpression = "//*[contains(text(), 'a')]";

          // Evaluate the XPath expression
          var xpathresult = document.evaluate(
            xpathExpression,
            document,
            null,
            XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          console.log(xpathresult);
          for (var i = 0; i < xpathresult.snapshotLength; i++) {
            var matchedElement = xpathresult.snapshotItem(i);
            // Do something with the selected elements
            console.log(matchedElement);
          }

          const fetchedTweet = nlp(tweet.textContent);
          const filteredTweet = fetchedTweet
            .match(profanityPattern)
            .replace("****");
          const predictions = await model.classify([tweet.textContent]);
          const toxicityScores = predictions;

          console.log("Toxicity Scores:", toxicityScores);

          const matchedLabels = toxicityScores
            .filter((score) => score.results[0].match)
            .map((score) => score.label);

          if (matchedLabels.length > 0) {
            // Tweet is toxic
            console.log("Tweet is toxic:", tweet.innerText);
            let caption = "";
            for (const array of filteredTweet.document) {
              for (const word of array) {
                caption += " " + word.text;
              }
            }

            tweet.textContent = caption;
            // console.log("Filtered Caption:", caption);
            // console.log("Original Tweet:", tweet.innerText);
          } else {
            // Tweet is not toxic
            console.log("Tweet is not toxic:", tweet.innerText);
          }

          // let caption = "";
          // for (const array of filteredTweet.document) {
          //   for (const word of array) {
          //     caption += " " + word.text;
          //   }
          // }

          // tweet.textContent = caption;
          // console.log(caption, "CAPTION");
          // console.log(tweet.innerText);
        });
      }
    };

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver(callback);

    // Start observing the target node for configured mutations
    observer.observe(targetNode, config);
  }
});
