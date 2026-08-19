import assert from "node:assert/strict";
import {
  canonicalUrl, relationCandidates, parseEntry, seriesRecord,
  resolveSeries, releaseId, hrefsFromHtml, unseenPostIds
} from "./core.mjs";

function entry(id, title, labels, url) {
  return {
    id: { $t: `tag:blogger.com,1999:blog-1.post-${id}` },
    title: { $t: title },
    category: labels.map((term) => ({ term })),
    link: [{ rel:"alternate", href:url }],
    published: { $t:new Date().toISOString() }
  };
}

const tensura = seriesRecord("111", {
  title:"Tensei Shitara Slime Datta Ken",
  url:"https://www.verudanava.com/2026/01/tensei-shitara-slime-datta-ken.html"
}, ["Tensura"]);

const rezero = seriesRecord("222", {
  title:"Re:Zero Kara Hajimeru Isekai Seikatsu",
  url:"https://www.verudanava.com/2026/01/re-zero.html"
}, ["Re:Zero"]);

const split = parseEntry(entry(
  "9001","Cilt 12 Bölüm 0",["Bölüm","Tensura","Cilt 12"],
  "https://verudanava.com/2026/08/tensura-cilt-12-bolum-0.html"
));
assert.equal(resolveSeries(split,[tensura,rezero]).id,"111");

const combined = parseEntry(entry(
  "9002","Cilt 12 Bölüm 1",["Bölüm","Tensura Cilt 12"],
  "https://www.verudanava.com/2026/08/tensura-cilt-12-bolum-1.html"
));
assert.equal(resolveSeries(combined,[tensura,rezero]).id,"111");

const volume = parseEntry(entry(
  "9003","Tensura Cilt 13",["Cilt","Tensura","Tensura Cilt 13"],
  "https://www.verudanava.com/2026/08/tensura-cilt-13.html"
));
assert.equal(resolveSeries(volume,[tensura,rezero]).id,"111");

const unknown = parseEntry(entry(
  "9004","Cilt 1 Bölüm 1",["Bölüm","Bilinmeyen Cilt 1"],
  "https://www.verudanava.com/2026/08/bilinmeyen.html"
));
assert.equal(resolveSeries(unknown,[tensura,rezero]),null);

assert.equal(
  canonicalUrl("https://verudanava.blogspot.com/2026/08/a.html"),
  "https://www.verudanava.com/2026/08/a.html"
);

{
  const rel = relationCandidates(["Bölüm","Tensura Cilt 12"]);
  assert.equal(rel.includes("tensura"), true);
  assert.equal(rel.includes("tensura cilt 12"), true);
}

const rid1 = releaseId("111","https://www.verudanava.com/2026/08/a.html");
const rid2 = releaseId("111","https://verudanava.blogspot.com/2026/08/a.html");
assert.equal(rid1,rid2);

const hrefs = hrefsFromHtml(
  '<a href="/2026/08/tensura-cilt-12.html">Cilt 12</a><a href="https://evil.example/x">x</a>',
  "https://www.verudanava.com/series.html"
);
assert.deepEqual(hrefs,["https://www.verudanava.com/2026/08/tensura-cilt-12.html"]);


const feedState = [{postId:"old1"},{postId:"old2"},{postId:"new1"}];
assert.deepEqual(unseenPostIds(feedState,["old1","old2"]),["new1"]);
assert.deepEqual(unseenPostIds(feedState,["old1","old2","new1"]),[]);

// Unmatched/failed posts are intentionally not included in the state helper input;
// when the state still lacks their ID, they remain candidates on the next pass.
assert.deepEqual(unseenPostIds([{postId:"retry1"}],[]),["retry1"]);

console.log(JSON.stringify({
  splitLabels:"PASS",
  combinedLabels:"PASS",
  newVolume:"PASS",
  crossSeriesIsolation:"PASS",
  bloggerCanonicalization:"PASS",
  dedupeDomainParity:"PASS",
  seriesPageAliasDiscovery:"PASS",
  newPostAfterBaseline:"PASS",
  retryUnmatchedOrFailed:"PASS"
},null,2));
