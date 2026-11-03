import { auth, db, provider } from "./firebase-config.js";
import { signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

export async function isAdmin(uid) {
  try {
    const snap = await getDoc(doc(db, "admins", uid));
    return snap.exists();
  } catch { return false; }
}

async function saveProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      name: user.displayName || "",
      email: user.email || "",
      photo: user.photoURL || "",
      createdAt: serverTimestamp()
    });
  }
}

$("loginBtn")?.addEventListener("click", async () => {
  try { await signInWithPopup(auth, provider); }
  catch (e) { alert("Sign-in failed: " + e.message); }
});

$("logoutBtn")?.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  const loggedIn = !!user;
  $("loginBtn") && ($("loginBtn").hidden = loggedIn);
  $("logoutBtn") && ($("logoutBtn").hidden = !loggedIn);
  $("dashLink") && ($("dashLink").hidden = !loggedIn);
  $("welcome") && ($("welcome").hidden = !loggedIn);

  if (user) {
    if ($("welcome")) $("welcome").textContent = "ようこそ, " + (user.displayName || "student") + "! 🌸";
    await saveProfile(user);
    if ($("adminLink")) $("adminLink").hidden = !(await isAdmin(user.uid));
  } else if ($("adminLink")) {
    $("adminLink").hidden = true;
  }
});
