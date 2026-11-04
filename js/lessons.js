import { db } from "./firebase-config.js";
import { collection, getDocs }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const LESSONS = [
  [1,"Introducing Yourself","A は B です","Learn to say your name, country and job, and to ask and answer simple questions with は, か and も."],
  [2,"This, That and Which","これ / それ / あれ","Learn to point at things near and far, and to say who something belongs to using の."],
  [3,"Places and Prices","ここ / そこ / あそこ","Learn to say where places are and how much things cost."],
  [4,"Telling Time","Hours, minutes, daily schedule","Learn to tell the time, use に with times, and describe your daily routine."],
  [5,"Going and Coming","へ / で / と particles","Learn to say where you go, how you travel and who you go with."],
  [6,"Everyday Verbs","を particle, invitations","Learn basic action verbs with を and で, and to invite someone with ませんか and ましょう."],
  [7,"Giving and Receiving","あげます / もらいます / もう","Learn to talk about giving, receiving and tools, and to say something is already done."],
  [8,"Describing Things","い- and な-adjectives","Learn い- and な-adjectives and how to use them before nouns."],
  [9,"Likes and Reasons","が, から","Learn to say what you like or understand with が, and to give reasons with から."],
  [10,"Existence","あります / います","Learn to say what exists and who is where, using あります and います."],
  [11,"Counting and Frequency","Counters, how often","Learn to count things, use quantity words, and say how often you do something."],
  [12,"Past Tense and Comparison","でした, より, いちばん","Learn the past tense of nouns and adjectives, comparing with より, and choosing the best."],
  [13,"Wants and Purpose","〜たい, 〜に行きます","Learn to say what you want with 〜たい and to go somewhere for a purpose."],
  [14,"Requests and Offers","て-form, 〜ています","Learn the て-form for requests, offers and ongoing actions."],
  [15,"Permission and States","〜てもいい, 〜ています","Learn to ask for permission and describe continuing states."],
  [16,"Linking Actions","て-form sequences","Learn to link several actions and descriptions with the て-form."],
  [17,"Negative Requests and Duties","ない-form","Learn the ない-form for negative requests, and to say what you must or need not do."],
  [18,"Abilities and Hobbies","Dictionary form","Learn the dictionary form to talk about abilities, hobbies and what you do before something."],
  [19,"Experiences","た-form, 〜たり, becoming","Learn to talk about past experiences, example actions and gradual change."],
  [20,"Casual Speech","Plain form","Learn plain (casual) form for friendly conversation."],
  [21,"Opinions and Quoting","と思います, と言いました","Learn to share opinions and report what someone said using と."],
  [22,"Describing with Clauses","Relative clauses","Learn to describe nouns with full clauses."],
  [23,"When and If","とき, と","Learn to say when something happens and what follows automatically, with とき and と."],
  [24,"Favors","くれます / てあげます / てもらいます","Learn to talk about giving and receiving favors."],
  [25,"Conditions","〜たら, 〜ても","Learn conditional sentences with 〜たら and 〜ても."]
].map(([id, title, topic, summary]) => ({
  id, title, topic, summary, volume: id <= 12 ? 1 : 2
}));

function card(l) {
  const a = document.createElement("a");
  a.className = "card";
  a.dataset.id = l.id;
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

  // Show titles edited by the admin (if any)
  getDocs(collection(db, "lessons")).then((snap) => {
    snap.forEach((d) => {
      const x = d.data();
      const c = document.querySelector('.card[data-id="' + d.id + '"]');
      if (!c) return;
      if (x.title) c.querySelector("h3").textContent = x.title;
      if (x.topic) c.querySelector("p").textContent = x.topic;
    });
  }).catch(() => {});
}
