export const LESSONS = [
  [1,"Introducing Yourself","A は B です"],
  [2,"This, That and Which","これ / それ / あれ"],
  [3,"Places and Prices","ここ / そこ / あそこ"],
  [4,"Telling Time","Hours, minutes, daily schedule"],
  [5,"Going and Coming","へ / で / と particles"],
  [6,"Everyday Verbs","を particle, invitations"],
  [7,"Giving and Receiving","あげます / もらいます / もう"],
  [8,"Describing Things","い- and な-adjectives"],
  [9,"Likes and Reasons","が, から"],
  [10,"Existence","あります / います"],
  [11,"Counting and Frequency","Counters, how often"],
  [12,"Past Tense and Comparison","でした, より, いちばん"],
  [13,"Wants and Purpose","〜たい, 〜に行きます"],
  [14,"Requests and Offers","て-form, 〜ています"],
  [15,"Permission and States","〜てもいい, 〜ています"],
  [16,"Linking Actions","て-form sequences"],
  [17,"Negative Requests and Duties","ない-form"],
  [18,"Abilities and Hobbies","Dictionary form"],
  [19,"Experiences","た-form, 〜たり, becoming"],
  [20,"Casual Speech","Plain form"],
  [21,"Opinions and Quoting","と思います, と言いました"],
  [22,"Describing with Clauses","Relative clauses"],
  [23,"When and If","とき, と"],
  [24,"Favors","くれます / てあげます / てもらいます"],
  [25,"Conditions","〜たら, 〜ても"]
].map(([id, title, topic]) => ({ id, title, topic, volume: id <= 12 ? 1 : 2 }));

function card(l) {
  const a = document.createElement("a");
  a.className = "card";
  a.href = "pages/lessons.html?id=" + l.id;
  a.innerHTML = `<span class="num">LESSON ${String(l.id).padStart(2, "0")}</span>
                 <h3></h3><p></p>`;
  a.querySelector("h3").textContent = l.title;
  a.querySelector("p").textContent = l.topic;
  return a;
}

const v1 = document.getElementById("vol1");
const v2 = document.getElementById("vol2");
if (v1 && v2) {
  LESSONS.forEach((l) => (l.volume === 1 ? v1 : v2).appendChild(card(l)));
}
